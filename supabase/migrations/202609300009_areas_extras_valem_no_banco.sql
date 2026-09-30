-- ============================================================================
-- As áreas extras que o administrador marca passam a valer no banco.
--
-- A tela de Administração deixa marcar, para qualquer pessoa, "também
-- acessa: Recepção / Médico / Financeiro / Administrador" — e a tela mostra
-- a área. Mas as regras do banco dessas áreas olhavam só o PAPEL. Medido
-- numa transação desfeita: Financeiro + extra Recepção via 0 pacientes e 0
-- agendamentos; Recepção + extra Médico via 0 avaliações; Médico + extra
-- Administrador via 0 registros de auditoria. A área abria vazia, sem aviso.
-- (Financeiro já foi resolvido em 202609300008.)
--
-- O que muda, sempre só para quem o administrador marcou:
--   - extra Recepção ou Médico: pacientes e agendamentos;
--   - extra Médico: avaliações e as tabelas clínicas, e os arquivos anexos.
-- Conservador de propósito: as políticas novas dão LER, CRIAR e EDITAR — não
-- APAGAR. Excluir avaliação, paciente ou agendamento continua sendo de quem
-- tem o papel. As políticas antigas não mudam; as novas somam a elas.
--
-- "Administrador" deixa de ser área extra: poder de administrador (editar a
-- equipe, convites, assinatura) é o papel, com a trava própria dele, e não
-- uma caixa a mais. Ninguém tem essa extra hoje.
-- ============================================================================

do $areas$
declare
  t text;
begin
  -- Pacientes e agendamentos: extra Recepção ou extra Médico.
  foreach t in array array['pacientes', 'agendamentos'] loop
    execute format('drop policy if exists area_extra_le on public.%I', t);
    execute format('drop policy if exists area_extra_cria on public.%I', t);
    execute format('drop policy if exists area_extra_edita on public.%I', t);
    execute format($p$create policy area_extra_le on public.%I for select
      using (institution_id = public.current_institution_id()
             and (public.current_has_permission('recepcao') or public.current_has_permission('medico')))$p$, t);
    execute format($p$create policy area_extra_cria on public.%I for insert
      with check (institution_id = public.current_institution_id()
                  and (public.current_has_permission('recepcao') or public.current_has_permission('medico')))$p$, t);
    execute format($p$create policy area_extra_edita on public.%I for update
      using (institution_id = public.current_institution_id()
             and (public.current_has_permission('recepcao') or public.current_has_permission('medico')))
      with check (institution_id = public.current_institution_id()
                  and (public.current_has_permission('recepcao') or public.current_has_permission('medico')))$p$, t);
  end loop;

  -- Avaliação e tudo o que é clínico: extra Médico.
  foreach t in array array[
    'avaliacoes', 'comorbidades', 'conclusoes', 'documentos', 'escores', 'exames',
    'exames_fisicos', 'historias', 'medicamentos', 'orientacoes', 'planejamentos',
    'vias_aereas', 'protocolos'
  ] loop
    execute format('drop policy if exists area_extra_le on public.%I', t);
    execute format('drop policy if exists area_extra_cria on public.%I', t);
    execute format('drop policy if exists area_extra_edita on public.%I', t);
    execute format($p$create policy area_extra_le on public.%I for select
      using (institution_id = public.current_institution_id() and public.current_has_permission('medico'))$p$, t);
    execute format($p$create policy area_extra_cria on public.%I for insert
      with check (institution_id = public.current_institution_id() and public.current_has_permission('medico'))$p$, t);
    execute format($p$create policy area_extra_edita on public.%I for update
      using (institution_id = public.current_institution_id() and public.current_has_permission('medico'))
      with check (institution_id = public.current_institution_id() and public.current_has_permission('medico'))$p$, t);
  end loop;
end
$areas$;

-- Arquivos anexos e documentos da avaliação: extra Médico, sem apagar.
drop policy if exists area_extra_medico_le_arquivos on storage.objects;
create policy area_extra_medico_le_arquivos on storage.objects for select
  using (bucket_id = any (array['anexos', 'documentos'])
         and (storage.foldername(name))[1] = public.current_institution_id()::text
         and public.current_has_permission('medico'));
drop policy if exists area_extra_medico_envia_arquivos on storage.objects;
create policy area_extra_medico_envia_arquivos on storage.objects for insert
  with check (bucket_id = any (array['anexos', 'documentos'])
              and (storage.foldername(name))[1] = public.current_institution_id()::text
              and public.current_has_permission('medico'));
drop policy if exists area_extra_medico_atualiza_arquivos on storage.objects;
create policy area_extra_medico_atualiza_arquivos on storage.objects for update
  using (bucket_id = any (array['anexos', 'documentos'])
         and (storage.foldername(name))[1] = public.current_institution_id()::text
         and public.current_has_permission('medico'))
  with check (bucket_id = any (array['anexos', 'documentos'])
              and (storage.foldername(name))[1] = public.current_institution_id()::text
              and public.current_has_permission('medico'));

-- "Administrador" sai das áreas extras aceitas. Mesma técnica de
-- 202609300004: troca só a lista, no corpo que já está no banco.
do $admin$
declare
  v_def text;
  v_velho text := $v$where item in ('recepcao','medico','financeiro','admin');$v$;
  v_novo text := $v$where item in ('recepcao','medico','financeiro');$v$;
begin
  v_def := pg_get_functiondef('public.admin_atualizar_perfil(uuid,text,text,text,text,text,text[])'::regprocedure);
  if position(v_velho in v_def) > 0 then
    execute replace(v_def, v_velho, v_novo);
  elsif position(v_novo in v_def) = 0 then
    raise exception 'admin_atualizar_perfil mudou de forma inesperada; revise antes de aplicar';
  end if;
end
$admin$;
