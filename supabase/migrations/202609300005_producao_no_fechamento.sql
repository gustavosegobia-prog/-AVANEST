-- ============================================================================
-- O fechamento passa a guardar quanto a Produção do mês somava.
--
-- Fechar trava os lançamentos do Financeiro, mas não a Produção do dia — e o
-- "Total cobrado" do mês fechado soma a produção enviada. Um valor de
-- anestesia corrigido, uma anotação enviada ou apagada depois do fechamento
-- mudava o número conferido sem ninguém saber.
--
-- A Produção continua editável (é o caderninho do médico; travar o registro
-- dele causa atrito sem proteger nada que um aviso não proteja). O que muda:
-- ao fechar, o banco guarda o retrato — quantas anotações enviadas e quanto
-- somam —, e a tela compara com o de agora.
--
-- Por que retrato, e não "alterado depois de fechado_at": dar baixa numa
-- anestesia paga dois meses depois é o fluxo normal e mexe em updated_at sem
-- mudar o faturado. Comparar pela data daria alarme em toda baixa. O retrato
-- só olha o que compõe o faturado: anotações e valor.
-- ============================================================================

alter table public.financeiro_periodos
  add column if not exists producao_no_fechamento jsonb;

comment on column public.financeiro_periodos.producao_no_fechamento is
  'Retrato da produção enviada no momento do fechamento: {"anotacoes": n, "valor": v}. Nulo quando o período não está fechado.';

-- SECURITY DEFINER porque a produção de cada médico só é visível para ele
-- pelas regras de acesso; o resumo precisa da produção de todos. A régua de
-- quem pode pedir é a mesma de producao_do_periodo.
create or replace function public.resumo_producao_do_mes(p_periodo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inicio date;
  v_resumo jsonb;
begin
  if coalesce(public.current_app_role(), '') not in ('financeiro', 'owner', 'admin') then
    raise exception 'Sem permissão para ver a produção enviada';
  end if;
  if p_periodo !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês inválido: use o formato AAAA-MM';
  end if;
  v_inicio := to_date(p_periodo || '-01', 'YYYY-MM-DD');

  select jsonb_build_object('anotacoes', count(*), 'valor', coalesce(sum(pr.valor), 0))
    into v_resumo
    from public.producao_do_dia pr
   where pr.institution_id = public.current_institution_id()
     and pr.enviado_em is not null
     and pr.situacao <> 'cancelado'
     and pr.data >= v_inicio
     and pr.data < (v_inicio + interval '1 month')::date;

  return v_resumo;
end;
$$;

revoke all on function public.resumo_producao_do_mes(text) from public, anon;
grant execute on function public.resumo_producao_do_mes(text) to authenticated;

-- Fechar: o mesmo de antes, mais o retrato da produção.
create or replace function public.conferir_periodo_financeiro(p_periodo text)
returns public.financeiro_periodos
language plpgsql
set search_path = public
as $$
declare
  v_institution uuid;
  v_row public.financeiro_periodos;
  v_agora timestamptz := now();
  v_producao jsonb;
begin
  perform set_config('avanest.escrita_financeira', 'sim', true);
  select institution_id into v_institution
  from public.perfis
  where id = auth.uid()
    and status = 'ativo'
    and role in ('financeiro','admin','owner');

  if v_institution is null then
    raise exception 'Sem permissão';
  end if;

  v_producao := public.resumo_producao_do_mes(p_periodo);

  insert into public.financeiro_periodos(
    institution_id, periodo, status, conferido_by, conferido_at,
    fechado_by, fechado_at, observacoes, producao_no_fechamento
  ) values (
    v_institution, p_periodo, 'fechado', auth.uid(), v_agora,
    auth.uid(), v_agora, null, v_producao
  )
  on conflict (institution_id, periodo) do update
  set status = 'fechado',
      conferido_by = auth.uid(),
      conferido_at = v_agora,
      fechado_by = auth.uid(),
      fechado_at = v_agora,
      observacoes = null,
      producao_no_fechamento = v_producao,
      updated_at = v_agora
  returning * into v_row;

  update public.financeiro_atendimentos
     set fechado_at = v_agora, fechado_by = auth.uid()
   where institution_id = v_institution
     and periodo = p_periodo
     and fechado_at is null;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_institution, auth.uid(), 'financeiro_periodo', v_row.id, 'periodo_fechado',
    jsonb_build_object('periodo', p_periodo, 'producao', v_producao)
  );

  return v_row;
end;
$$;

-- Reabrir: o mesmo de antes, e o retrato sai junto com a trava.
create or replace function public.reabrir_periodo_financeiro(p_periodo text, p_motivo text)
returns public.financeiro_periodos
language plpgsql
set search_path = public
as $$
declare
  v_institution uuid;
  v_row public.financeiro_periodos;
begin
  perform set_config('avanest.escrita_financeira', 'sim', true);
  if p_motivo is null or length(trim(p_motivo)) < 5 then
    raise exception 'Escreva o motivo da reabertura.';
  end if;

  select institution_id into v_institution
  from public.perfis
  where id = auth.uid()
    and status = 'ativo'
    and role in ('admin','owner');

  if v_institution is null then
    raise exception 'Só administrador ou proprietário pode reabrir um período fechado.';
  end if;

  select * into v_row from public.financeiro_periodos
   where institution_id = v_institution and periodo = p_periodo;

  if v_row.id is null or v_row.status <> 'fechado' then
    raise exception 'Este período não está fechado.';
  end if;

  update public.financeiro_periodos
     set status = 'aberto',
         conferido_by = null, conferido_at = null,
         fechado_by = null, fechado_at = null,
         observacoes = p_motivo,
         producao_no_fechamento = null,
         updated_at = now()
   where id = v_row.id
  returning * into v_row;

  update public.financeiro_atendimentos
     set fechado_at = null, fechado_by = null
   where institution_id = v_institution and periodo = p_periodo;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_institution, auth.uid(), 'financeiro_periodo', v_row.id, 'periodo_reaberto',
    jsonb_build_object('periodo', p_periodo, 'motivo', p_motivo)
  );

  return v_row;
end;
$$;
