-- ============================================================================
-- Exclusão de usuário sem registro clínico
--
-- Treze tabelas apontam para public.perfis bloqueando exclusão (avaliacoes,
-- pacientes, medicamentos, exames, documentos, etc.). Isso é proposital: num
-- prontuário não se apaga a autoria de um registro clínico.
--
-- Por isso a exclusão só é permitida para quem nunca produziu nada. Para os
-- demais, a ação correta continua sendo desativar o acesso (status inativo),
-- que o RLS já respeita imediatamente.
-- ============================================================================

-- Conta o que impede a exclusão de um perfil.
create or replace function public.perfil_tem_registros(p_perfil_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.avaliacoes    where created_by = p_perfil_id)
  + (select count(*) from public.pacientes     where created_by = p_perfil_id)
  + (select count(*) from public.medicamentos  where created_by = p_perfil_id)
  + (select count(*) from public.exames        where created_by = p_perfil_id)
  + (select count(*) from public.exames_fisicos where created_by = p_perfil_id)
  + (select count(*) from public.vias_aereas   where created_by = p_perfil_id)
  + (select count(*) from public.historias     where created_by = p_perfil_id)
  + (select count(*) from public.comorbidades  where created_by = p_perfil_id)
  + (select count(*) from public.escores       where created_by = p_perfil_id)
  + (select count(*) from public.planejamentos where created_by = p_perfil_id)
  + (select count(*) from public.orientacoes   where created_by = p_perfil_id)
  + (select count(*) from public.conclusoes    where created_by = p_perfil_id)
  + (select count(*) from public.documentos    where created_by = p_perfil_id)
  + (select count(*) from public.protocolos    where created_by = p_perfil_id)
  + (select count(*) from public.financeiro    where created_by = p_perfil_id)
  + (select count(*) from public.pagamentos    where created_by = p_perfil_id)
  + (select count(*) from public.auditoria     where user_id    = p_perfil_id);
$$;

create or replace function public.excluir_usuario(p_perfil_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ator public.perfis;
  v_alvo public.perfis;
  v_registros integer;
begin
  select * into v_ator from public.perfis where id = auth.uid() and status = 'ativo';
  select * into v_alvo from public.perfis where id = p_perfil_id;

  if v_ator.id is null or v_alvo.id is null
     or v_ator.institution_id <> v_alvo.institution_id
     or v_ator.role not in ('admin','owner') then
    raise exception 'Sem permissão';
  end if;

  if v_alvo.id = auth.uid() then
    raise exception 'Você não pode excluir o próprio acesso';
  end if;

  if v_alvo.role = 'owner' then
    raise exception 'O proprietário não pode ser excluído. Transfira a propriedade antes.';
  end if;

  v_registros := public.perfil_tem_registros(p_perfil_id);
  if v_registros > 0 then
    raise exception 'Este usuário possui % registro(s) no sistema e não pode ser excluído. Use Status: Inativo para revogar o acesso sem perder o histórico clínico.', v_registros;
  end if;

  -- A auditoria guarda quem era, mesmo depois da exclusão.
  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_ator.institution_id, auth.uid(), 'perfil', p_perfil_id, 'usuario_excluido',
    jsonb_build_object('nome', v_alvo.nome, 'email', v_alvo.email, 'role', v_alvo.role)
  );

  -- Convites pendentes criados por esta pessoa perdem o sentido.
  delete from public.convites where invited_by = p_perfil_id and status = 'pendente';

  delete from public.perfis where id = p_perfil_id;
end;
$$;

revoke execute on function public.excluir_usuario(uuid) from anon;
revoke execute on function public.perfil_tem_registros(uuid) from anon;
grant execute on function public.excluir_usuario(uuid) to authenticated;
grant execute on function public.perfil_tem_registros(uuid) to authenticated;
