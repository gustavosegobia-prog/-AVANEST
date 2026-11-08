-- ============================================================================
-- Excluir o médico sem conta junto com os plantões dele
--
-- Pedido de 08/11/2026 ("onde apaga tudo"; "coloca pra funcionar"): o cadastro
-- sem conta — o nome do médico que o centro cirúrgico pôs na escala e no mapa,
-- sem login — não saía, porque tinha plantões. excluir_usuario recusa qualquer
-- registro de escala e faturamento, e com razão: apagar quem tem produção,
-- troca ou atendimento faturado deixaria cobrança sem médico.
--
-- Esta função é o caminho estreito para o caso que sobra:
--   * só cadastro SEM CONTA (sem login, sem e-mail);
--   * só quando a única coisa ligada a ele são PLANTÕES — com produção, troca,
--     atendimento faturado ou prontuário, continua a recusa, e o caminho é
--     desativar;
--   * só proprietário ou administrador da mesma organização, e que monte a
--     escala (o gatilho plantao_do_grupo_protegido pede isso para apagar
--     plantão do grupo);
--   * os plantões apagados ficam na auditoria, um a um, com dia, horário e
--     local; os pacientes do mapa que o tinham como anestesista ficam sem
--     anestesista (a chave já é "on delete set null"), e o número vai junto.
--
-- `o_que_sai_com_o_cadastro` responde antes, para o aviso da tela dizer os
-- números: quantos plantões saem e quantos pacientes do mapa ficam sem
-- anestesista.
-- ============================================================================

create or replace function public.o_que_sai_com_o_cadastro(p_perfil_id uuid)
returns table (plantoes integer, pacientes_no_mapa integer, outros integer, clinico integer, sem_conta boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ator public.perfis;
  v_alvo public.perfis;
  v_plantoes integer;
begin
  select * into v_ator from public.perfis where id = auth.uid() and status = 'ativo';
  select * into v_alvo from public.perfis where id = p_perfil_id;
  if v_ator.id is null or v_alvo.id is null
     or v_ator.institution_id <> v_alvo.institution_id
     or v_ator.role not in ('admin', 'owner') then
    raise exception 'Sem permissão';
  end if;
  select count(*)::integer into v_plantoes from public.plantoes where perfil_id = p_perfil_id;
  return query select
    v_plantoes,
    (select count(*)::integer from public.centro_casos where anestesista_id = p_perfil_id),
    public.perfil_tem_escala(p_perfil_id) - v_plantoes,
    public.perfil_tem_clinico(p_perfil_id),
    coalesce(v_alvo.sem_acesso, false);
end;
$$;

revoke all on function public.o_que_sai_com_o_cadastro(uuid) from public, anon;
grant execute on function public.o_que_sai_com_o_cadastro(uuid) to authenticated;

create or replace function public.excluir_cadastro_com_plantoes(p_perfil_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ator public.perfis;
  v_alvo public.perfis;
  v_plantoes integer;
  v_mapa integer;
  v_lista jsonb;
begin
  select * into v_ator from public.perfis where id = auth.uid() and status = 'ativo';
  select * into v_alvo from public.perfis where id = p_perfil_id;

  if v_ator.id is null or v_alvo.id is null
     or v_ator.institution_id <> v_alvo.institution_id
     or v_ator.role not in ('admin', 'owner') then
    raise exception 'Sem permissão';
  end if;
  if v_alvo.id = auth.uid() then
    raise exception 'Você não pode excluir o próprio cadastro';
  end if;
  if v_alvo.role = 'owner' then
    raise exception 'O proprietário não pode ser excluído. Transfira a propriedade antes.';
  end if;
  if not coalesce(v_alvo.sem_acesso, false) then
    raise exception 'Só o cadastro sem conta sai com os plantões. Quem tem login: use Status: Inativo.';
  end if;
  if public.perfil_tem_clinico(p_perfil_id) > 0 then
    raise exception 'Este cadastro tem registros no prontuário e não pode ser excluído. Use Status: Inativo.';
  end if;

  select count(*)::integer into v_plantoes from public.plantoes where perfil_id = p_perfil_id;
  if public.perfil_tem_escala(p_perfil_id) > v_plantoes then
    raise exception 'Este cadastro tem produção, trocas ou atendimentos faturados, além dos plantões. Apagar deixaria cobrança sem médico: use Status: Inativo.';
  end if;
  if v_plantoes > 0 and not public.pode_montar_escala() then
    raise exception 'Só quem monta a escala pode apagar os plantões de alguém.';
  end if;

  select count(*)::integer into v_mapa from public.centro_casos where anestesista_id = p_perfil_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'data', p.data, 'inicio', p.hora_inicio, 'fim', p.hora_fim, 'situacao', p.situacao,
           'local_id', p.local_id, 'local_texto', p.local_texto) order by p.data, p.hora_inicio), '[]'::jsonb)
    into v_lista from public.plantoes p where p.perfil_id = p_perfil_id;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_ator.institution_id, auth.uid(), 'perfil', p_perfil_id, 'cadastro_excluido_com_plantoes',
    jsonb_build_object('nome', v_alvo.nome, 'role', v_alvo.role, 'plantoes', v_lista,
                       'pacientes_do_mapa_sem_anestesista', v_mapa));

  delete from public.plantoes where perfil_id = p_perfil_id;
  delete from public.convites where invited_by = p_perfil_id and status = 'pendente';
  delete from public.perfis where id = p_perfil_id;

  return jsonb_build_object('plantoes', v_plantoes, 'pacientes_no_mapa', v_mapa);
end;
$$;

revoke all on function public.excluir_cadastro_com_plantoes(uuid) from public, anon;
grant execute on function public.excluir_cadastro_com_plantoes(uuid) to authenticated;
