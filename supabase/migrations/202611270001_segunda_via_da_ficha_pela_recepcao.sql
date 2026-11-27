-- Segunda via da ficha anestésica pela recepção (27/11/2026).
--
-- O paciente perdeu a ficha e volta ao balcão: a recepção imprime de novo.
-- Até aqui a ficha anestésica só abria para o acesso clínico (médico,
-- administrador, proprietário). A recepção passa a LER a ficha ENCERRADA e
-- as linhas dela (sinais, drogas, eventos), para a folha impressa sair igual.
-- Nada mais: a ficha aberta continua fechada para ela, e não há escrita
-- nova (as regras de criar e de editar não mudam). Cada segunda via que a
-- recepção imprime fica na auditoria, com quem imprimiu e quando.
--
-- Quem é "recepção": current_has_permission('recepcao') — a função
-- Recepção, ou a área Recepção marcada no cadastro. Proprietário e
-- administrador já liam tudo.
--
-- Validado no banco real antes de aplicar, numa transação desfeita: a
-- recepcionista passou de 0 a 83 fichas (todas as encerradas, nenhuma
-- aberta) e só lê as linhas da encerrada; o médico leu as mesmas 84 fichas e
-- 4754 linhas antes e depois; o anônimo, nada; a auditoria registrou só a
-- segunda via da encerrada.

create or replace function public.pode_segunda_via(p_institution_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select p_institution_id is not null
     and p_institution_id = public.current_institution_id()
     and public.current_has_permission('recepcao')
     and public.evolucao_liberada();
$$;

revoke all on function public.pode_segunda_via(uuid) from public, anon;
grant execute on function public.pode_segunda_via(uuid) to authenticated;

-- A ficha está encerrada? Lida pelo dono da tabela, para a regra das linhas
-- não depender da regra da ficha.
create or replace function public.ficha_encerrada(p_evolucao_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.evolucoes_anestesicas e
                  where e.id = p_evolucao_id and e.status = 'encerrada');
$$;

revoke all on function public.ficha_encerrada(uuid) from public, anon;
grant execute on function public.ficha_encerrada(uuid) to authenticated;

-- Uma regra de leitura por tabela, como antes: o acesso clínico, OU a
-- segunda via da encerrada.
alter policy evolucao_le on public.evolucoes_anestesicas
  using (public.pode_evolucao(institution_id)
         or (status = 'encerrada' and public.pode_segunda_via(institution_id)));

alter policy registro_le on public.evolucao_registros
  using (public.pode_evolucao(institution_id)
         or (public.pode_segunda_via(institution_id) and public.ficha_encerrada(evolucao_id)));

-- A página de impressão chama isto quando quem imprime é a recepção.
create or replace function public.registrar_segunda_via(p_evolucao_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ficha public.evolucoes_anestesicas;
  v_paciente text;
begin
  select * into v_ficha from public.evolucoes_anestesicas
   where id = p_evolucao_id and status = 'encerrada';
  if v_ficha.id is null or not public.pode_segunda_via(v_ficha.institution_id) then
    return;
  end if;
  select nome into v_paciente from public.pacientes where id = v_ficha.patient_id;
  insert into public.auditoria(institution_id, actor_id, user_id, entidade, entidade_id, acao, detalhes)
  values (v_ficha.institution_id, auth.uid(), auth.uid(), 'evolucao_anestesica', v_ficha.id, 'segunda_via_impressa',
    jsonb_build_object('paciente', coalesce(v_paciente, ''),
                       'inicio_em', v_ficha.inicio_em));
end;
$$;

revoke all on function public.registrar_segunda_via(uuid) from public, anon;
grant execute on function public.registrar_segunda_via(uuid) to authenticated;
