-- Desmarcar a consulta tira o lançamento vazio do Financeiro.
--
-- O lançamento nasce sozinho quando a avaliação é concluída. Desmarcada a
-- consulta, ele continuava no Financeiro do mês — um paciente para cobrar que
-- não foi atendido. Quem fecha o mês via "1 atendimento(s) · R$ 0,00" e tinha
-- de lembrar, de cabeça, que aquele tinha caído.
--
-- O QUE É APAGADO, e por que é seguro apagar:
--
--   valor = 0, recebido = 0, sem nota fiscal e sem nenhum pagamento
--   registrado. É o lançamento automático que nunca virou dinheiro. Não há o
--   que preservar nele: ele não é a história de um recebimento, é um espaço
--   reservado para um recebimento que não vai acontecer.
--
-- O QUE NUNCA É APAGADO: qualquer linha com valor, com algum recebimento, com
-- número de nota ou com pagamento lançado. Dinheiro que entrou é história, e
-- história não se apaga por causa de uma mudança de status na agenda — se
-- houver uma dessas, ela fica, e quem fecha o mês decide o que fazer.
--
-- E só no período da consulta desmarcada: o mesmo paciente pode ter um
-- lançamento aberto de outro mês, de outra consulta, que não tem nada a ver
-- com esta.
--
-- A auditoria é escrita antes, com o nome do paciente e a data — depois da
-- linha apagada, o id sozinho não diz nada a quem for conferir.
create or replace function public.registrar_presenca(p_agendamento_id uuid, p_status text)
returns agendamentos
language plpgsql
set search_path to 'public'
as $$
declare
  v_row public.agendamentos;
  v_paciente text;
  v_apagados uuid[];
begin
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

comment on function public.registrar_presenca(uuid,text) is
  'Muda a situação de um agendamento. Ao desmarcar ou reagendar, remove o lançamento financeiro automático daquele paciente no período — e só quando ele está zerado, sem nota e sem pagamento. Tudo auditado.';
