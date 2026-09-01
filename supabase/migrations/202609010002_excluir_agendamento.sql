-- Excluir um agendamento de vez, para o que foi erro de digitação.
--
-- Desmarcar e excluir são coisas diferentes, e as duas precisam existir. O
-- paciente que desistiu vira `cancelado` por `registrar_presenca`: a linha
-- continua na agenda, em cinza, porque saber que a consulta das 13:30 caiu é
-- informação — uma linha que some deixa a dúvida de se ela existiu.
--
-- Já o agendamento criado por engano — a duplicata, o horário errado, o nome
-- digitado duas vezes — não é história de ninguém. Guardá-lo em cinza para
-- sempre suja a agenda com um evento que nunca aconteceu.
--
-- Por que uma função, e não um DELETE direto do cliente:
--
--   1. A POLÍTICA DE RLS já permite o DELETE para a equipe da instituição.
--      Ela é a trava de QUEM, e não a de O QUÊ: nada nela impede apagar um
--      agendamento que já tem avaliação clínica pendurada, e apagar esse
--      deixaria a avaliação órfã — um documento clínico sem a consulta que o
--      originou. Aqui isso é recusado com o motivo escrito.
--
--   2. Exclusão sem rastro não existe num sistema de saúde. A auditoria é
--      escrita ANTES do delete, com o nome do paciente e o horário dentro do
--      detalhe: depois da linha apagada, o id sozinho não diria mais nada a
--      quem for conferir.
--
-- SECURITY INVOKER (o padrão), igual a `registrar_presenca`: a RLS continua
-- valendo, e a função não empresta privilégio nenhum a quem a chama. Quem não
-- pode ver o agendamento não o encontra, e recebe o mesmo erro de "não
-- encontrado" — que é o certo, porque a existência dele também é informação.
create or replace function public.excluir_agendamento(p_agendamento_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $$
declare
  v_row public.agendamentos;
  v_paciente text;
begin
  select * into v_row from public.agendamentos where id = p_agendamento_id;

  if v_row.id is null then
    raise exception 'Agendamento não encontrado ou sem permissão';
  end if;

  if v_row.avaliacao_id is not null then
    raise exception 'Este agendamento já tem avaliação. Desmarque em vez de excluir.';
  end if;

  select nome into v_paciente from public.pacientes where id = v_row.patient_id;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_row.institution_id, auth.uid(), 'agendamento', v_row.id, 'excluido',
    jsonb_build_object(
      'patient_id', v_row.patient_id,
      'paciente', coalesce(v_paciente, '(paciente removido)'),
      'data', v_row.data,
      'horario', v_row.horario,
      'status', v_row.status));

  delete from public.agendamentos where id = p_agendamento_id;
end;
$$;

comment on function public.excluir_agendamento(uuid) is
  'Apaga um agendamento criado por engano. Recusa quando já existe avaliação ligada — nesse caso o caminho é desmarcar. Registra na auditoria antes de apagar.';

grant execute on function public.excluir_agendamento(uuid) to authenticated;
