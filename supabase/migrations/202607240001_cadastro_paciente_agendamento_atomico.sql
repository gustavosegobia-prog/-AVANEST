-- Cria paciente e agendamento em uma única operação: ou os dois são gravados, ou nenhum.
create or replace function public.criar_paciente_e_agendamento(
  p_paciente jsonb,
  p_agendamento jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_paciente public.pacientes;
  v_agendamento public.agendamentos;
begin
  insert into public.pacientes (
    institution_id, created_by, nome, cpf, rg, data_nascimento, sexo, telefone, email,
    endereco, cidade, uf, cep, hospital, cirurgia, especialidade, procedimento, convenio,
    numero_carteirinha, validade, plano, data_consulta, horario, observacoes
  ) values (
    (p_paciente->>'institution_id')::uuid,
    nullif(p_paciente->>'created_by', '')::uuid,
    p_paciente->>'nome', nullif(p_paciente->>'cpf',''), nullif(p_paciente->>'rg',''),
    nullif(p_paciente->>'data_nascimento','')::date, nullif(p_paciente->>'sexo',''),
    nullif(p_paciente->>'telefone',''), nullif(p_paciente->>'email',''), nullif(p_paciente->>'endereco',''),
    nullif(p_paciente->>'cidade',''), nullif(p_paciente->>'uf',''), nullif(p_paciente->>'cep',''),
    nullif(p_paciente->>'hospital',''), nullif(p_paciente->>'cirurgia',''), nullif(p_paciente->>'especialidade',''),
    nullif(p_paciente->>'procedimento',''), nullif(p_paciente->>'convenio',''),
    nullif(p_paciente->>'numero_carteirinha',''), nullif(p_paciente->>'validade','')::date,
    nullif(p_paciente->>'plano',''), nullif(p_paciente->>'data_consulta','')::date,
    nullif(p_paciente->>'horario','')::time, nullif(p_paciente->>'observacoes','')
  ) returning * into v_paciente;

  insert into public.agendamentos (
    institution_id, patient_id, data, horario, hospital, procedimento, convenio, observacoes, created_by
  ) values (
    v_paciente.institution_id, v_paciente.id, (p_agendamento->>'data')::date,
    nullif(p_agendamento->>'horario','')::time, nullif(p_agendamento->>'hospital',''),
    nullif(p_agendamento->>'procedimento',''), nullif(p_agendamento->>'convenio',''),
    nullif(p_agendamento->>'observacoes',''), nullif(p_agendamento->>'created_by','')::uuid
  ) returning * into v_agendamento;

  return jsonb_build_object('patient_id', v_paciente.id, 'appointment_id', v_agendamento.id);
end;
$$;

revoke all on function public.criar_paciente_e_agendamento(jsonb,jsonb) from public, anon;
grant execute on function public.criar_paciente_e_agendamento(jsonb,jsonb) to authenticated;
