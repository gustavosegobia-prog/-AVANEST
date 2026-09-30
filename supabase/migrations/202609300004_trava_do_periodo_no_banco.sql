-- ============================================================================
-- A trava do mês fechado passa a morar no banco, e não só na tela.
--
-- As funções do Financeiro (fechar, reabrir, registrar pagamento, estornar,
-- excluir lançamento) são SECURITY INVOKER: rodam com a permissão de quem
-- chama. E as regras de acesso das três tabelas eram "ALL" para quem tem a
-- permissão de financeiro. Resultado: tudo o que as funções recusam — mês
-- fechado, reabrir sem ser administrador, reabrir sem motivo, excluir sem
-- ser administrador, apagar pagamento sem estorno — podia ser feito chamando
-- a API direto, sem passar pela função. A única trava era a tela.
--
-- O conserto: cada função legítima liga uma marca de transação logo na
-- primeira linha — set_config('avanest.escrita_financeira', 'sim', true) — e
-- os gatilhos abaixo deixam passar o que vem com a marca e recusam a escrita
-- direta. A marca não pode ser ligada de fora: a API só executa funções do
-- esquema público, nenhuma delas liga essa variável com valor vindo de quem
-- chama, e cada requisição da API é uma transação própria.
--
-- A linha é inserida no corpo que já está no banco (pg_get_functiondef), e
-- não por um CREATE OR REPLACE copiado à mão: cinco funções recopiadas são
-- cinco chances de mudar uma regra sem querer. Rodar de novo não duplica.
--
-- O que NÃO muda: service_role (a rota que fatura a avaliação) e as funções
-- SECURITY DEFINER (receber_particular) rodam como outro papel e não passam
-- por esta trava — já são código do servidor, não requisição de navegador.
-- ============================================================================

do $marca$
declare
  v_fn text;
  v_def text;
begin
  foreach v_fn in array array[
    'public.conferir_periodo_financeiro(text)',
    'public.reabrir_periodo_financeiro(text,text)',
    'public.registrar_pagamento_financeiro(uuid,numeric,text,text)',
    'public.estornar_pagamento_financeiro(uuid)',
    'public.excluir_lancamento_financeiro(uuid)'
  ] loop
    v_def := pg_get_functiondef(v_fn::regprocedure);
    if position('avanest.escrita_financeira' in v_def) = 0 then
      v_def := regexp_replace(v_def, '(\r?\n)begin(\r?\n)',
        E'\\1begin\\2  perform set_config(''avanest.escrita_financeira'', ''sim'', true);\\2');
      if position('avanest.escrita_financeira' in v_def) = 0 then
        raise exception 'Não achei onde marcar %', v_fn;
      end if;
      execute v_def;
    end if;
  end loop;
end
$marca$;

-- ── Lançamentos ─────────────────────────────────────────────────────────────
create or replace function public.trava_financeiro_atendimentos()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_direto boolean := current_user in ('authenticated', 'anon')
    and coalesce(current_setting('avanest.escrita_financeira', true), '') <> 'sim';
  -- O acompanhamento do recurso de glosa não é dinheiro: a resposta do
  -- convênio chega meses depois, com o mês já fechado, e registrar "aceito"
  -- ou "negado" não muda nenhum número que alguém assinou.
  v_livres text[] := array['glosa_recurso_status', 'glosa_recurso_prazo', 'glosa_recurso_motivo', 'updated_at'];
begin
  if not v_direto then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Use "Excluir lançamento": ele confere a permissão, recusa período fechado e grava a auditoria.';
  end if;

  if tg_op = 'INSERT' then
    if new.fechado_at is not null or new.fechado_by is not null then
      raise exception 'Lançamento não nasce fechado. Quem fecha é o fechamento do período.';
    end if;
    if exists (select 1 from public.financeiro_periodos
                where institution_id = new.institution_id
                  and periodo = coalesce(new.periodo, to_char(now(), 'YYYY-MM'))
                  and status = 'fechado') then
      raise exception 'O período % está fechado. Reabra o período antes de lançar nele.',
        coalesce(new.periodo, to_char(now(), 'YYYY-MM'));
    end if;
    return new;
  end if;

  -- UPDATE
  if new.fechado_at is distinct from old.fechado_at or new.fechado_by is distinct from old.fechado_by then
    raise exception 'Só o fechamento e a reabertura do período mexem na trava de um lançamento.';
  end if;
  if old.fechado_at is not null
     and (to_jsonb(new) - v_livres) is distinct from (to_jsonb(old) - v_livres) then
    raise exception 'Este período está fechado e não pode mais ser alterado.';
  end if;
  if new.periodo is distinct from old.periodo
     and exists (select 1 from public.financeiro_periodos
                  where institution_id = new.institution_id
                    and periodo = new.periodo
                    and status = 'fechado') then
    raise exception 'O período % está fechado. Não dá para mover um lançamento para dentro dele.', new.periodo;
  end if;
  return new;
end;
$$;

drop trigger if exists trava_financeiro_atendimentos on public.financeiro_atendimentos;
create trigger trava_financeiro_atendimentos
  before insert or update or delete on public.financeiro_atendimentos
  for each row execute function public.trava_financeiro_atendimentos();

-- ── Pagamentos ──────────────────────────────────────────────────────────────
-- A tela nunca escreve aqui direto: pagamento entra por registrar e sai por
-- estornar, as duas conferem saldo, permissão e período e deixam rastro.
create or replace function public.trava_financeiro_pagamentos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and coalesce(current_setting('avanest.escrita_financeira', true), '') <> 'sim' then
    raise exception 'Pagamento só entra por "Registrar pagamento" e só sai por "Estornar".';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trava_financeiro_pagamentos on public.financeiro_pagamentos;
create trigger trava_financeiro_pagamentos
  before insert or update or delete on public.financeiro_pagamentos
  for each row execute function public.trava_financeiro_pagamentos();

-- ── Períodos ────────────────────────────────────────────────────────────────
-- Sem isto, quem tem só o papel "financeiro" reabria o mês gravando
-- status = 'aberto' direto — sem ser administrador e sem motivo.
create or replace function public.trava_financeiro_periodos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and coalesce(current_setting('avanest.escrita_financeira', true), '') <> 'sim' then
    raise exception 'O período só fecha por "Confirmar conferência" e só reabre por "Reabrir período".';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trava_financeiro_periodos on public.financeiro_periodos;
create trigger trava_financeiro_periodos
  before insert or update or delete on public.financeiro_periodos
  for each row execute function public.trava_financeiro_periodos();

revoke all on function public.trava_financeiro_atendimentos() from public, anon, authenticated;
revoke all on function public.trava_financeiro_pagamentos() from public, anon, authenticated;
revoke all on function public.trava_financeiro_periodos() from public, anon, authenticated;

-- ── Desmarcar consulta ──────────────────────────────────────────────────────
-- registrar_presenca apaga o lançamento vazio (R$ 0, sem nota, sem
-- pagamento) quando a consulta é desmarcada. Com o mês fechado, aquela
-- linha é parte de um fechamento assinado — fica. O resto da função é o
-- mesmo; as linhas novas são a marca e `fa.fechado_at is null`.
create or replace function public.registrar_presenca(p_agendamento_id uuid, p_status text)
returns public.agendamentos
language plpgsql
set search_path = public
as $$
declare
  v_row public.agendamentos;
  v_paciente text;
  v_apagados uuid[];
begin
  perform set_config('avanest.escrita_financeira', 'sim', true);
  if p_status not in ('agendado','confirmado','presente','faltou','cancelado','reagendado') then
    raise exception 'Status de agenda inválido';
  end if;

  update public.agendamentos
  set status = p_status,
      status_by = auth.uid(),
      status_at = now(),
      updated_at = now()
  where id = p_agendamento_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Agendamento não encontrado ou sem permissão';
  end if;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_row.institution_id, auth.uid(), 'agendamento', v_row.id, 'status_alterado',
    jsonb_build_object('status', p_status, 'patient_id', v_row.patient_id));

  if p_status in ('cancelado','reagendado') then
    select nome into v_paciente from public.pacientes where id = v_row.patient_id;

    with apagados as (
      delete from public.financeiro_atendimentos fa
       where fa.institution_id = v_row.institution_id
         and fa.patient_id = v_row.patient_id
         and fa.periodo = to_char(v_row.data, 'YYYY-MM')
         and fa.fechado_at is null
         and coalesce(fa.valor, 0) = 0
         and coalesce(fa.recebido, 0) = 0
         and fa.nota_fiscal is null
         and not exists (
           select 1 from public.financeiro_pagamentos fp
            where fp.atendimento_id = fa.id
         )
      returning fa.id
    )
    select array_agg(id) into v_apagados from apagados;

    if v_apagados is not null then
      insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
      values (v_row.institution_id, auth.uid(), 'agendamento', v_row.id,
        'lancamento_vazio_removido_ao_desmarcar',
        jsonb_build_object(
          'atendimentos', to_jsonb(v_apagados),
          'paciente', coalesce(v_paciente, '(paciente removido)'),
          'data', v_row.data,
          'periodo', to_char(v_row.data, 'YYYY-MM')));
    end if;
  end if;

  return v_row;
end;
$$;
