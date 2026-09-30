-- ============================================================================
-- Desmarcar consulta limpa o lançamento vazio também quando quem desmarca é
-- a recepção.
--
-- registrar_presenca roda com a permissão de quem chama (SECURITY INVOKER),
-- e a limpeza do lançamento vazio era um DELETE em financeiro_atendimentos —
-- tabela que a recepção não enxerga. Conferido no banco, numa transação
-- desfeita: com o papel de recepção, a consulta ficava cancelada, o
-- lançamento vazio continuava lá e nenhuma auditoria de remoção era
-- gravada. A limpeza só acontecia quando quem desmarcava era administrador
-- ou do financeiro — e quem desmarca, na prática, é a recepção.
--
-- A exclusão vai para uma função SECURITY DEFINER, com os MESMOS filtros de
-- antes (R$ 0, sem recebido, sem nota, sem pagamento, mês aberto) e só para
-- agendamento já cancelado ou reagendado da organização de quem chama. Ela
-- não apaga nada que a regra antiga não apagaria; só passa a funcionar para
-- quem de fato desmarca. A auditoria continua sendo gravada por
-- registrar_presenca, com o nome de quem desmarcou.
-- ============================================================================

create or replace function public.apagar_lancamento_vazio_ao_desmarcar(p_agendamento_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ag public.agendamentos;
  v_apagados uuid[];
begin
  select * into v_ag from public.agendamentos
   where id = p_agendamento_id
     and institution_id = public.current_institution_id();
  if v_ag.id is null or v_ag.status not in ('cancelado', 'reagendado') then
    return null;
  end if;

  with apagados as (
    delete from public.financeiro_atendimentos fa
     where fa.institution_id = v_ag.institution_id
       and fa.patient_id = v_ag.patient_id
       and fa.periodo = to_char(v_ag.data, 'YYYY-MM')
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

  return v_apagados;
end;
$$;

revoke all on function public.apagar_lancamento_vazio_ao_desmarcar(uuid) from public, anon;
grant execute on function public.apagar_lancamento_vazio_ao_desmarcar(uuid) to authenticated;

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

    v_apagados := public.apagar_lancamento_vazio_ao_desmarcar(v_row.id);

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
