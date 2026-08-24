-- ===========================================================================
-- Enviar a produção do mês ao Financeiro
-- ===========================================================================
-- A migração da produção do dia dizia, sobre a política sem exceção para
-- administrador:
--
--   "Se um dia isso mudar, muda com uma decisão explícita e um comentário
--    novo aqui — não de raspão, junto de outra coisa."
--
-- É este arquivo. Aqui está a decisão, e aqui estão os limites dela.
--
-- O que muda
--
-- Nada fica visível ao Financeiro por padrão. A lista continua estritamente
-- pessoal até que o próprio anestesista clique em "Enviar ao financeiro" — e
-- então só o que ele enviou, e só daquele mês, passa a ser legível por quem
-- fatura. O gesto é dele, sobre a lista dele, e a qualquer momento.
--
-- Por que isto não é o mesmo que abrir a tabela
--
-- Abrir a tabela para o papel "financeiro" daria a ele a lista inteira de
-- todos, inclusive o que ainda não foi conferido, inclusive o mês que a
-- pessoa nem terminou de anotar. O envio é o consentimento, e ele é por mês:
-- o que não foi enviado permanece invisível como sempre foi.
--
-- Por que não vira financeiro_atendimentos
--
-- Aquela tabela exige patient_id, de paciente cadastrado com avaliação feita
-- aqui dentro. A produção de plantão não tem isso — é justamente o caso em
-- que a anestesia foi de urgência e o pré não passou pelo sistema. Inserir lá
-- obrigaria a criar um cadastro de paciente por nome digitado, e o resultado
-- seria a base de pacientes cheia de registros sem CPF, sem nascimento e sem
-- ninguém por trás. O Financeiro recebe uma LISTA para faturar, não um
-- prontuário falso.
-- ===========================================================================

alter table public.producao_do_dia
  add column if not exists enviado_em timestamptz;

-- O Financeiro consulta "o que me mandaram neste mês": data e enviado.
create index if not exists producao_enviada_idx
  on public.producao_do_dia (institution_id, enviado_em, data)
  where enviado_em is not null;

-- ---------------------------------------------------------------------------
-- A segunda política: leitura do que foi enviado
--
-- Separada da primeira de propósito. A primeira continua sendo "só a minha,
-- para tudo"; esta é só de leitura, só do que tem enviado_em, e só para quem
-- fatura. Quem escreve continua sendo uma pessoa só: a dona da anotação.
--
-- owner e admin entram junto com financeiro porque em consultório pequeno é a
-- mesma pessoa — e sem eles o dono da clínica não conseguiria faturar a
-- própria produção enviada pela equipe.
-- ---------------------------------------------------------------------------
drop policy if exists "financeiro_le_o_que_foi_enviado" on public.producao_do_dia;
create policy "financeiro_le_o_que_foi_enviado" on public.producao_do_dia
  for select to authenticated
  using (
    institution_id = public.current_institution_id()
    and enviado_em is not null
    and public.current_app_role() in ('financeiro', 'owner', 'admin')
  );

-- ---------------------------------------------------------------------------
-- Enviar
--
-- Função, e não um update com policy, porque o envio precisa dizer QUEM pode
-- enviar O QUÊ: só a própria pessoa, só a própria produção, só o mês pedido.
-- Uma policy de update deixaria qualquer linha ser marcada como enviada por
-- quem conseguisse escrever nela — e escrever nela é o que o dono faz o dia
-- inteiro, editando valor e situação.
--
-- Reenviar não faz nada: enviado_em já preenchido é ignorado. Assim o botão
-- pode ser clicado duas vezes sem duplicar nada nem reabrir uma data antiga.
-- ---------------------------------------------------------------------------
create or replace function public.enviar_producao_ao_financeiro(p_mes text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_primeiro date; v_ultimo date; v_quantas integer;
begin
  -- "2026-08" -> o mês inteiro. Formato errado para aqui em vez de virar um
  -- intervalo maluco que enviaria produção de outro período.
  if p_mes !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês inválido: use o formato AAAA-MM';
  end if;
  v_primeiro := to_date(p_mes || '-01', 'YYYY-MM-DD');
  v_ultimo := (v_primeiro + interval '1 month - 1 day')::date;

  update public.producao_do_dia
     set enviado_em = now()
   where perfil_id = auth.uid()
     and institution_id = public.current_institution_id()
     and data between v_primeiro and v_ultimo
     and enviado_em is null;

  get diagnostics v_quantas = row_count;

  if v_quantas > 0 then
    insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
    values (public.current_institution_id(), auth.uid(), 'producao', null, 'producao_enviada',
            jsonb_build_object('mes', p_mes, 'itens', v_quantas));
  end if;

  return v_quantas;
end;
$$;

-- ---------------------------------------------------------------------------
-- Desfazer
--
-- Existe porque erro de mês acontece — clicar em agosto quando se queria
-- julho — e sem volta a pessoa teria de pedir para alguém apagar no banco.
-- Só desfaz o que é seu, e o Financeiro deixa de enxergar na mesma hora.
-- ---------------------------------------------------------------------------
create or replace function public.desfazer_envio_producao(p_mes text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_primeiro date; v_quantas integer;
begin
  if p_mes !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês inválido: use o formato AAAA-MM';
  end if;
  v_primeiro := to_date(p_mes || '-01', 'YYYY-MM-DD');

  update public.producao_do_dia
     set enviado_em = null
   where perfil_id = auth.uid()
     and institution_id = public.current_institution_id()
     and data between v_primeiro and (v_primeiro + interval '1 month - 1 day')::date
     and enviado_em is not null;

  get diagnostics v_quantas = row_count;
  return v_quantas;
end;
$$;

/**
 * O que o Financeiro recebeu no mês.
 *
 * Devolve o nome de quem enviou junto, que é a informação que falta para
 * faturar: a mesma cirurgia cobrada por dois anestesistas diferentes vira
 * duas guias, e sem o nome não há como separar.
 *
 * security definer porque precisa ler perfis para trazer o nome; a checagem
 * de papel é a mesma da policy, repetida aqui porque a função não passa por
 * ela.
 */
create or replace function public.producao_recebida(p_mes text)
returns table (
  id uuid, data date, paciente text, convenio text, procedimento text,
  valor numeric, situacao text, profissional text, enviado_em timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare v_primeiro date;
begin
  if public.current_app_role() not in ('financeiro', 'owner', 'admin') then
    raise exception 'Sem permissão para ver a produção enviada';
  end if;
  if p_mes !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês inválido: use o formato AAAA-MM';
  end if;
  v_primeiro := to_date(p_mes || '-01', 'YYYY-MM-DD');

  return query
    select pr.id, pr.data, pr.paciente, pr.convenio, pr.procedimento,
           pr.valor, pr.situacao, pe.nome, pr.enviado_em
      from public.producao_do_dia pr
      join public.perfis pe on pe.id = pr.perfil_id
     where pr.institution_id = public.current_institution_id()
       and pr.enviado_em is not null
       and pr.data between v_primeiro and (v_primeiro + interval '1 month - 1 day')::date
     order by pr.convenio, pr.data, pr.paciente;
end;
$$;

revoke execute on function public.enviar_producao_ao_financeiro(text) from public, anon;
revoke execute on function public.desfazer_envio_producao(text)      from public, anon;
revoke execute on function public.producao_recebida(text)            from public, anon;
grant  execute on function public.enviar_producao_ao_financeiro(text) to authenticated;
grant  execute on function public.desfazer_envio_producao(text)       to authenticated;
grant  execute on function public.producao_recebida(text)             to authenticated;
