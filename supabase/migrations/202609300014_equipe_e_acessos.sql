-- ============================================================================
-- Equipe e acessos: o que o banco garante, antes de qualquer tela nova.
--
-- Medido numa transação desfeita, antes desta migração:
--
--   1. Um ADMINISTRADOR se promovia a PROPRIETÁRIO com um update direto em
--      perfis (a política owner_admin_atualiza_perfis deixa o admin mudar
--      qualquer coluna). A regra "só o proprietário mexe em proprietário"
--      morava só dentro de admin_atualizar_perfil, e o update direto passava
--      por fora dela.
--   2. O mesmo update direto concedia a qualquer pessoa a permissão "todos"
--      (acesso a todas as áreas).
--   3. O ÚNICO proprietário conseguia se rebaixar pela própria
--      admin_atualizar_perfil, e a organização ficava sem proprietário — sem
--      ninguém que pudesse devolver a propriedade.
--
-- E um defeito de preservação: admin_atualizar_perfil guardava só as três
-- áreas que a tela conhece (recepcao, medico, financeiro). Salvar o cadastro
-- de quem tinha uma concessão antiga ("todos", "clinico") APAGAVA essa
-- concessão em silêncio. Hoje há duas pessoas nessa situação.
--
-- O que esta migração faz:
--   * função, situação, áreas, "sem acesso" e atuação médica só mudam por
--     admin_atualizar_perfil (gatilho protege_papel_e_acesso);
--   * a organização nunca fica sem proprietário ativo;
--   * concessões que a tela não edita são preservadas, e só saem quando o
--     administrador pede explicitamente (p_manter_legado = false);
--   * a auditoria de perfil passa a guardar o ANTES e o DEPOIS;
--   * nasce perfis.atuacao_medica — ver o comentário da coluna;
--   * nasce situacao_de_acesso_da_equipe(): quem já aceitou o convite.
-- ============================================================================

-- ── Atuação médica ─────────────────────────────────────────────────────────
alter table public.perfis add column if not exists atuacao_medica boolean;

comment on column public.perfis.atuacao_medica is
  'A pessoa atua como médica. Separado de role (a função no sistema): um médico '
  'pode ser administrador ou proprietário e continua sendo médico. NULL = não '
  'informado. Preenchido na criação da coluna só onde o dado é confiável: '
  'role = medico (a função clínica) ou CRM cadastrado. Nunca deduzido do nome.';

-- Só o que é certo. Quem não é da função clínica e não tem CRM fica NULL
-- ("não informado") — inclusive proprietário e administrador sem CRM: não há
-- como saber, e a tela pede a confirmação em vez de chutar.
update public.perfis
   set atuacao_medica = true
 where atuacao_medica is null
   and (role = 'medico' or coalesce(trim(crm), '') <> '');

-- ── O gatilho ──────────────────────────────────────────────────────────────
create or replace function public.protege_papel_e_acesso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Rotinas do servidor (chave de serviço, sem usuário) e o suporte seguem.
  if auth.uid() is null or public.e_super_admin() then
    return new;
  end if;
  -- admin_atualizar_perfil marca a própria escrita: é ela que confere as
  -- regras de proprietário e registra a mudança na auditoria.
  if coalesce(current_setting('avanest.admin_perfil', true), '') = 'sim' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Criar o próprio perfil (aceitar convite, criar organização) segue como
    -- era. Criar o de OUTRA pessoa não pode nascer proprietário nem com
    -- concessão fora das três áreas.
    if new.id <> auth.uid()
       and (new.role = 'owner'
            or not (coalesce(new.permissoes, '{}') <@ array['recepcao', 'medico', 'financeiro']::text[])) then
      raise exception 'Proprietário e concessões especiais não se criam por aqui.';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.permissoes is distinct from old.permissoes
     or new.sem_acesso is distinct from old.sem_acesso
     or new.atuacao_medica is distinct from old.atuacao_medica then
    raise exception 'Função, situação do acesso e áreas só mudam pela tela Equipe e acessos, que confere as regras de proprietário e registra a mudança.';
  end if;
  return new;
end;
$$;

revoke execute on function public.protege_papel_e_acesso() from public, anon, authenticated;

drop trigger if exists protege_papel_e_acesso on public.perfis;
create trigger protege_papel_e_acesso
  before insert or update on public.perfis
  for each row execute function public.protege_papel_e_acesso();

-- ── admin_atualizar_perfil, versão 2 ──────────────────────────────────────
-- Os dois parâmetros novos têm padrão: quem chama com os sete de antes (a
-- tela antiga ainda aberta num navegador) cai nesta mesma função.
drop function if exists public.admin_atualizar_perfil(uuid, text, text, text, text, text, text[]);

create function public.admin_atualizar_perfil(
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

  if p_role not in ('recepcao', 'medico', 'financeiro', 'admin', 'owner')
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

  -- A organização nunca fica sem proprietário ativo: é ele quem pode
  -- devolver a propriedade e responder pela assinatura.
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

  -- Quem não tem conta de acesso não pode receber função que só se exerce
  -- entrando no sistema.
  if v_target.sem_acesso and p_role <> 'medico' then
    raise exception 'Este profissional não tem conta de acesso. A função dele continua sendo a da área médica; para dar outra função, ele precisa de uma conta.';
  end if;

  -- As três áreas que a tela edita vêm do pedido (ou ficam como estavam).
  v_areas := array(
    select distinct x from unnest(coalesce(p_permissoes, v_target.permissoes, '{}')) as x
     where x = any(v_editaveis) and x <> p_role
     order by 1);
  -- O resto — concessões que a tela não edita — fica, a menos que o
  -- administrador peça para tirar.
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

revoke execute on function public.admin_atualizar_perfil(uuid, text, text, text, text, text, text[], boolean, boolean) from public, anon;
grant execute on function public.admin_atualizar_perfil(uuid, text, text, text, text, text, text[], boolean, boolean) to authenticated;

-- ── Quem já aceitou o convite ─────────────────────────────────────────────
-- A lista da equipe precisa separar "acesso habilitado" de "convite
-- pendente", e o único lugar que sabe se a pessoa já criou a senha é
-- auth.users. Devolve só datas, só da própria organização, só para quem
-- administra — nenhum e-mail ou dado de autenticação sai daqui.
create or replace function public.situacao_de_acesso_da_equipe()
returns table (perfil_id uuid, convidado_em timestamptz, confirmado_em timestamptz, ultimo_acesso timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, u.invited_at, u.email_confirmed_at, u.last_sign_in_at
    from public.perfis p
    join auth.users u on u.id = p.id
   where p.institution_id = (select public.current_institution_id())
     and (select public.current_app_role()) in ('admin', 'owner');
$$;

revoke execute on function public.situacao_de_acesso_da_equipe() from public, anon;
grant execute on function public.situacao_de_acesso_da_equipe() to authenticated;

notify pgrst, 'reload schema';
