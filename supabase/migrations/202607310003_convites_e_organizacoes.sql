-- ============================================================================
-- Convites e criação de organizações
--
-- Permite que um anestesiologista crie sua própria organização (individual ou
-- grupo) e que o dono/administrador de um grupo convide outras pessoas com
-- papel definido e prazo de validade.
--
-- Toda a validação fica no banco: o navegador nunca escolhe a organização nem
-- o papel de quem entra.
-- ============================================================================

create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  email text not null,
  role text not null check (role in ('recepcao','medico','financeiro','admin')),
  token text not null unique default encode(gen_random_bytes(32),'hex'),
  status text not null default 'pendente' check (status in ('pendente','aceito','revogado')),
  expires_at timestamptz not null default now() + interval '7 days',
  invited_by uuid not null references auth.users(id) on delete cascade,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Um único convite pendente por e-mail em cada organização.
create unique index if not exists convites_pendente_unico
  on public.convites (institution_id, lower(email))
  where status = 'pendente';

create index if not exists convites_por_instituicao on public.convites (institution_id);

alter table public.convites enable row level security;

-- Somente dono e administrador enxergam e gerenciam os convites da própria
-- organização. Quem aceita nunca lê a tabela: usa as funções abaixo.
drop policy if exists "owner_admin_gerencia_convites" on public.convites;
create policy "owner_admin_gerencia_convites"
on public.convites for all to authenticated
using (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.status = 'ativo'
      and p.institution_id = convites.institution_id
      and p.role in ('admin','owner')
  )
)
with check (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.status = 'ativo'
      and p.institution_id = convites.institution_id
      and p.role in ('admin','owner')
  )
);

-- ============================================================================
-- Criação da própria organização (primeiro acesso, sem convite)
-- ============================================================================
create or replace function public.criar_organizacao(
  p_tipo text,
  p_nome_organizacao text,
  p_nome_usuario text,
  p_crm text default null,
  p_rqe text default null
)
returns public.perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  v_instituicao public.instituicoes;
  v_perfil public.perfis;
  v_email text;
  v_nome_organizacao text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida';
  end if;

  -- Nesta versão cada pessoa pertence a uma única organização.
  if exists (select 1 from public.perfis where id = auth.uid()) then
    raise exception 'Este usuário já pertence a uma organização';
  end if;

  if p_tipo not in ('individual','grupo') then
    raise exception 'Tipo de organização inválido';
  end if;

  if coalesce(trim(p_nome_usuario),'') = '' then
    raise exception 'Informe o nome do responsável';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  v_nome_organizacao := nullif(trim(coalesce(p_nome_organizacao,'')),'');
  if p_tipo = 'individual' then
    -- O anestesiologista individual não precisa nomear a organização.
    v_nome_organizacao := coalesce(v_nome_organizacao, trim(p_nome_usuario) || ' — Individual');
  elsif v_nome_organizacao is null then
    raise exception 'Informe o nome do grupo';
  end if;

  insert into public.instituicoes (nome, tipo, status, email)
  values (v_nome_organizacao, p_tipo, 'ativa', v_email)
  returning * into v_instituicao;

  insert into public.perfis (id, institution_id, nome, role, crm, rqe, status, must_reset, email)
  values (
    auth.uid(), v_instituicao.id, trim(p_nome_usuario), 'owner',
    nullif(trim(coalesce(p_crm,'')),''), nullif(trim(coalesce(p_rqe,'')),''),
    'ativo', false, v_email
  )
  returning * into v_perfil;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_instituicao.id, auth.uid(), 'instituicao', v_instituicao.id, 'organizacao_criada',
    jsonb_build_object('tipo', p_tipo, 'nome', v_nome_organizacao)
  );

  return v_perfil;
end;
$$;

-- ============================================================================
-- Dados públicos mínimos de um convite, para a tela de aceite
-- ============================================================================
create or replace function public.convite_info(p_token text)
returns table (organizacao text, papel text, email text, valido boolean)
language sql
security definer
set search_path = public
as $$
  select i.nome, c.role, c.email,
         (c.status = 'pendente' and c.expires_at > now())
  from public.convites c
  join public.instituicoes i on i.id = c.institution_id
  where c.token = p_token;
$$;

-- ============================================================================
-- Aceite do convite
-- ============================================================================
create or replace function public.aceitar_convite(
  p_token text,
  p_nome_usuario text,
  p_crm text default null,
  p_rqe text default null
)
returns public.perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite public.convites;
  v_perfil public.perfis;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida';
  end if;

  if exists (select 1 from public.perfis where id = auth.uid()) then
    raise exception 'Este usuário já pertence a uma organização';
  end if;

  select * into v_convite from public.convites where token = p_token for update;

  if v_convite.id is null then
    raise exception 'Convite não encontrado';
  end if;

  if v_convite.status <> 'pendente' then
    raise exception 'Este convite já foi utilizado ou foi cancelado';
  end if;

  if v_convite.expires_at <= now() then
    raise exception 'Este convite expirou';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  -- O convite vale somente para o e-mail convidado.
  if lower(coalesce(v_email,'')) <> lower(v_convite.email) then
    raise exception 'Este convite foi enviado para outro e-mail';
  end if;

  if coalesce(trim(p_nome_usuario),'') = '' then
    raise exception 'Informe seu nome';
  end if;

  insert into public.perfis (id, institution_id, nome, role, crm, rqe, status, must_reset, email)
  values (
    auth.uid(), v_convite.institution_id, trim(p_nome_usuario), v_convite.role,
    nullif(trim(coalesce(p_crm,'')),''), nullif(trim(coalesce(p_rqe,'')),''),
    'ativo', false, v_email
  )
  returning * into v_perfil;

  update public.convites
  set status = 'aceito', accepted_by = auth.uid(), accepted_at = now()
  where id = v_convite.id;

  insert into public.auditoria (institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_convite.institution_id, auth.uid(), 'convite', v_convite.id, 'convite_aceito',
    jsonb_build_object('role', v_convite.role, 'email', v_convite.email)
  );

  return v_perfil;
end;
$$;

-- Estas funções são chamadas por quem acabou de entrar e ainda não tem perfil.
revoke execute on function public.criar_organizacao(text,text,text,text,text) from anon;
revoke execute on function public.aceitar_convite(text,text,text,text) from anon;
grant execute on function public.criar_organizacao(text,text,text,text,text) to authenticated;
grant execute on function public.aceitar_convite(text,text,text,text) to authenticated;
-- A tela de aceite mostra a organização antes do login.
grant execute on function public.convite_info(text) to anon, authenticated;
