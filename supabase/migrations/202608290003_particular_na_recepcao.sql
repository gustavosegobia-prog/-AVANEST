-- ============================================================================
-- O particular que paga na recepção
--
-- Até aqui o dinheiro só entrava no Financeiro num momento: quando o médico
-- CONCLUÍA a avaliação, pela rota /api/avaliacoes/[id]/faturar, e com o valor
-- vindo da tabela de convênios. Serve para convênio, que se cobra depois.
--
-- Não serve para o particular, que paga na hora, no balcão, antes de entrar na
-- sala. Nesse caso o dinheiro existe às 8h05 e o lançamento só apareceria às
-- 8h40 — se a avaliação fosse concluída, e pelo valor da tabela, e não pelo
-- que a pessoa efetivamente pagou.
--
-- POR QUE UMA FUNÇÃO, E NÃO UM INSERT DIRETO DA TELA. As policies das tabelas
-- do Financeiro exigem `current_has_permission('financeiro')`, e a recepção
-- não tem — nem deve ter: dar acesso ao Financeiro inteiro para quem precisa
-- registrar um pagamento de balcão é abrir o faturamento do serviço para
-- resolver um recibo. A função roda com os poderes de quem a criou e confere,
-- ela mesma, quem pode chamá-la.
-- ============================================================================

create or replace function public.receber_particular(
  p_patient_id uuid,
  p_valor numeric,
  p_metodo text,
  p_referencia text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ator public.perfis;
  v_paciente public.pacientes;
  v_atendimento_id uuid;
begin
  select * into v_ator from public.perfis
   where id = auth.uid() and status = 'ativo';
  if v_ator.id is null then
    raise exception 'Sessão inválida';
  end if;

  -- Quem cadastra paciente pode registrar o que ele pagou. Não é o mesmo que
  -- ver o Financeiro: registrar um recibo do balcão é parte de receber a
  -- pessoa, e ler o faturamento do serviço não é.
  if not (public.current_has_permission('recepcao')
          or public.current_has_permission('medico')) then
    raise exception 'Sem permissão para registrar recebimento';
  end if;

  -- A organização que não contratou o Financeiro não acumula dado nele.
  if not public.modulo_liberado('financeiro') then
    raise exception 'Esta organização não contratou o módulo financeiro';
  end if;

  select * into v_paciente from public.pacientes
   where id = p_patient_id and institution_id = v_ator.institution_id;
  if v_paciente.id is null then
    raise exception 'Paciente não encontrado nesta organização';
  end if;

  if coalesce(p_valor, 0) <= 0 then
    raise exception 'Informe o valor recebido';
  end if;
  if p_metodo not in ('PIX','Dinheiro','Cartão','Transferência','Outro') then
    raise exception 'Forma de pagamento inválida';
  end if;

  -- `avaliacao_id` fica NULO de propósito: a avaliação ainda não aconteceu. É
  -- essa linha que a rota de faturar vai ENCONTRAR e completar quando o médico
  -- concluir — em vez de criar uma segunda, que contaria o mesmo paciente duas
  -- vezes no mês.
  insert into public.financeiro_atendimentos (
    institution_id, patient_id, avaliacao_id, medico_id,
    convenio, hospital, valor, recebido, status,
    data_recebimento, periodo, observacoes
  ) values (
    v_ator.institution_id, p_patient_id, null, null,
    'Particular', nullif(trim(coalesce(v_paciente.hospital, '')), ''),
    p_valor, p_valor, 'pago',
    current_date, to_char(current_date, 'YYYY-MM'),
    'Recebido na recepção, no cadastro do paciente.'
  )
  returning id into v_atendimento_id;

  insert into public.financeiro_pagamentos (
    institution_id, atendimento_id, valor, metodo, referencia, created_by
  ) values (
    v_ator.institution_id, v_atendimento_id, p_valor, p_metodo,
    nullif(trim(coalesce(p_referencia, '')), ''), v_ator.id
  );

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_ator.institution_id, v_ator.id, 'financeiro_atendimento', v_atendimento_id,
    'recebimento_particular_na_recepcao',
    jsonb_build_object('valor', p_valor, 'metodo', p_metodo, 'paciente', v_paciente.nome)
  );

  return v_atendimento_id;
end;
$$;

revoke execute on function public.receber_particular(uuid,numeric,text,text) from public, anon;
grant execute on function public.receber_particular(uuid,numeric,text,text) to authenticated;

-- ============================================================================
-- Achar o lançamento que a recepção já abriu
--
-- Sem isto, o mesmo paciente entraria DUAS vezes no Financeiro do mês: a linha
-- do balcão (avaliacao_id nulo) e a que a conclusão da avaliação cria. A chave
-- única não impede — `(institution_id, patient_id, avaliacao_id)` aceita as
-- duas, porque uma tem nulo e a outra não.
--
-- A rota de faturar chama esta função ANTES de inserir. Se achar a linha
-- aberta, apenas amarra a avaliação a ela.
-- ============================================================================

create or replace function public.atendimento_aberto_do_paciente(
  p_institution_id uuid,
  p_patient_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.financeiro_atendimentos
   where institution_id = p_institution_id
     and patient_id = p_patient_id
     and avaliacao_id is null
     and status <> 'cancelado'
     -- Trinta dias: o recibo do balcão e a avaliação acontecem no mesmo dia, ou
     -- quase. Uma janela aberta faria a consulta de dezembro se colar no
     -- pagamento de março do mesmo paciente.
     and created_at > now() - interval '30 days'
   order by created_at desc
   limit 1
$$;

revoke execute on function public.atendimento_aberto_do_paciente(uuid,uuid) from public, anon;
