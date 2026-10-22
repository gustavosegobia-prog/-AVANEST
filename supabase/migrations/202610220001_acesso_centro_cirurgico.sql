-- ============================================================================
-- A função "Centro cirúrgico": o login da enfermagem, só o mapa
--
-- Pedido de 22/10/2026: um acesso para os enfermeiros do centro cirúrgico da
-- FUNDHOSPAR verem e atualizarem o mapa (entrou em sala, RPA, alta) — e nada
-- mais. Nada de prontuário, recepção, financeiro, escala ou administração.
--
-- É uma função nova, e não uma área a mais de uma função existente, porque o
-- que ela abre já está nas políticas do mapa (202610210001): pode_montar_centro()
-- pergunta current_has_permission('centro'), e essa resposta é "sim" para
-- quem tem a função 'centro'. Todas as outras tabelas pedem 'recepcao',
-- 'medico', 'financeiro', 'admin' ou 'owner' — que esta função não é. O que
-- fica visível além do mapa é o que toda a equipe já vê: o nome da
-- organização, os locais e os nomes da equipe (o mapa mostra o anestesista).
--
-- O convite é feito pelo proprietário ou administrador em Equipe e acessos;
-- a rota /api/admin/users só aceita a função 'centro' quando o mapa está
-- ligado para a organização de quem convida.
--
-- Este arquivo:
--   1. deixa as duas tabelas (perfis e convites) aceitarem a função;
--   2. deixa admin_atualizar_perfil gravá-la, para a tela de edição funcionar;
--   3. impede definir_na_escala de pôr essa pessoa na escala.
-- ============================================================================

alter table public.perfis drop constraint if exists perfis_role_check;
alter table public.perfis add constraint perfis_role_check
  check (role = any (array['recepcao', 'medico', 'financeiro', 'admin', 'owner', 'centro']));

alter table public.convites drop constraint if exists convites_role_check;
alter table public.convites add constraint convites_role_check
  check (role = any (array['recepcao', 'medico', 'financeiro', 'admin', 'centro']));

-- ---------------------------------------------------------------------------
-- admin_atualizar_perfil: o mesmo corpo de 202609300014, com 'centro' na
-- lista das funções aceitas. Nada mais mudou.
-- ---------------------------------------------------------------------------
create or replace function public.admin_atualizar_perfil(
  p_perfil_id uuid,
  p_role text,
  p_status text,
  p_nome text,
  p_crm text default null,
  p_rqe text default null,
  p_permissoes text[] default null,
  p_atuacao_medica boolean default null,
  p_manter_legado boolean default true
)
returns public.perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfis;
  v_target public.perfis;
  v_antes public.perfis;
  v_editaveis constant text[] := array['recepcao', 'medico', 'financeiro'];
  v_areas text[];
  v_legado text[];
  v_permissoes text[];
  v_outros_donos integer;
begin
  select * into v_actor from public.perfis where id = auth.uid() and status = 'ativo';
  select * into v_target from public.perfis where id = p_perfil_id;

  if v_actor.id is null or v_target.id is null
     or v_actor.institution_id <> v_target.institution_id
     or v_actor.role not in ('admin', 'owner') then
    raise exception 'Sem permissão';
  end if;

  if p_role not in ('recepcao', 'medico', 'financeiro', 'admin', 'owner', 'centro')
     or p_status not in ('ativo', 'inativo') then
    raise exception 'Perfil ou status inválido';
  end if;

  if coalesce(trim(p_nome), '') = '' then
    raise exception 'O nome não pode ficar vazio.';
  end if;

  if (v_target.role = 'owner' or p_role = 'owner') and v_actor.role <> 'owner' then
    raise exception 'Somente o proprietário pode alterar proprietário';
  end if;

  if p_perfil_id = auth.uid() and p_status <> 'ativo' then
    raise exception 'Você não pode desativar o próprio acesso';
  end if;

  if v_target.role = 'owner' and v_target.status = 'ativo'
     and (p_role <> 'owner' or p_status <> 'ativo') then
    select count(*) into v_outros_donos
      from public.perfis
     where institution_id = v_target.institution_id
       and role = 'owner' and status = 'ativo' and id <> v_target.id;
    if v_outros_donos = 0 then
      raise exception 'A organização ficaria sem proprietário ativo. Torne outra pessoa proprietária antes de mudar esta.';
    end if;
  end if;

  if v_target.sem_acesso and p_role <> 'medico' then
    raise exception 'Este profissional não tem conta de acesso. A função dele continua sendo a da área médica; para dar outra função, ele precisa de uma conta.';
  end if;

  v_areas := array(
    select distinct x from unnest(coalesce(p_permissoes, v_target.permissoes, '{}')) as x
     where x = any(v_editaveis) and x <> p_role
     order by 1);
  v_legado := case when p_manter_legado then array(
    select distinct x from unnest(coalesce(v_target.permissoes, '{}')) as x
     where x <> all(v_editaveis)
     order by 1) else '{}' end;
  v_permissoes := v_areas || v_legado;

  v_antes := v_target;

  perform set_config('avanest.admin_perfil', 'sim', true);
  update public.perfis
     set role = p_role,
         status = p_status,
         nome = trim(p_nome),
         crm = nullif(trim(coalesce(p_crm, '')), ''),
         rqe = nullif(trim(coalesce(p_rqe, '')), ''),
         permissoes = v_permissoes,
         atuacao_medica = coalesce(p_atuacao_medica, atuacao_medica),
         updated_at = now()
   where id = p_perfil_id
  returning * into v_target;
  perform set_config('avanest.admin_perfil', '', true);

  insert into public.auditoria (
    institution_id, actor_id, entidade, entidade_id, acao, detalhes, dados_anteriores, dados_novos
  ) values (
    v_actor.institution_id, auth.uid(), 'perfil', v_target.id, 'perfil_atualizado',
    jsonb_build_object('nome', v_target.nome, 'role', p_role, 'status', p_status, 'permissoes', v_permissoes),
    jsonb_build_object('nome', v_antes.nome, 'role', v_antes.role, 'status', v_antes.status,
      'permissoes', v_antes.permissoes, 'crm', v_antes.crm, 'rqe', v_antes.rqe,
      'atuacao_medica', v_antes.atuacao_medica),
    jsonb_build_object('nome', v_target.nome, 'role', v_target.role, 'status', v_target.status,
      'permissoes', v_target.permissoes, 'crm', v_target.crm, 'rqe', v_target.rqe,
      'atuacao_medica', v_target.atuacao_medica)
  );

  return v_target;
end;
$$;

-- ---------------------------------------------------------------------------
-- definir_na_escala: a enfermagem do centro cirúrgico, como a recepção e o
-- financeiro, não entra na escala de anestesia.
-- ---------------------------------------------------------------------------
create or replace function public.definir_na_escala(
  p_perfil_id uuid,
  p_na_escala boolean
)
returns public.perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ator public.perfis; v_alvo public.perfis; v_resultado public.perfis;
begin
  select * into v_ator from public.perfis where id = auth.uid() and status = 'ativo';
  select * into v_alvo from public.perfis where id = p_perfil_id;

  if v_ator.id is null or v_alvo.id is null
     or v_ator.institution_id <> v_alvo.institution_id
     or v_ator.role not in ('admin','owner') then
    raise exception 'Sem permissão';
  end if;

  if p_na_escala and v_alvo.role in ('recepcao','financeiro','centro') then
    raise exception 'Recepção, financeiro e centro cirúrgico não entram na escala';
  end if;

  update public.perfis
     set na_escala = p_na_escala, updated_at = now()
   where id = p_perfil_id
  returning * into v_resultado;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_ator.institution_id, auth.uid(), 'perfil', p_perfil_id,
          case when p_na_escala then 'entrou_na_escala' else 'saiu_da_escala' end,
          jsonb_build_object('nome', v_alvo.nome));

  return v_resultado;
end;
$$;
