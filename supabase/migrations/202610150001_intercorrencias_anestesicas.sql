-- INTERCORRÊNCIAS ANESTÉSICAS: a equipe científica e o histórico de revisão.
--
-- O conteúdo dos protocolos mora no código (lib/intercorrencias), versionado
-- e testado. Aqui fica só o que precisa de banco: quem pode revisar e cada
-- decisão de revisão, com o instantâneo exato do protocolo que foi lido.
--
-- PAPÉIS
--   admin     o super-admin da plataforma (perfis.super_admin): monta a
--             equipe; pode mandar para revisão e suspender, não aprova.
--   editor    escreve e manda para revisão (rascunho, pendente).
--   revisor   médico com CRM no perfil: aprova, pede atualização, suspende.
--   médico    qualquer usuário: só lê o que foi aprovado.
--
-- O HISTÓRICO SÓ CRESCE. Nenhuma linha muda nem some: aprovar de novo uma
-- versão antiga (a reversão) é uma linha nova que aponta para o instantâneo
-- antigo. É o registro de auditoria das aprovações — e um gatilho impede
-- update e delete até para quem tem acesso direto ao banco.

-- ---------------------------------------------------------------------------
-- Equipe científica
-- ---------------------------------------------------------------------------
create table if not exists public.intercorrencias_equipe (
  user_id uuid primary key references public.perfis(id) on delete cascade,
  papel text not null check (papel in ('editor', 'revisor')),
  incluido_por uuid references public.perfis(id) on delete set null,
  incluido_em timestamptz not null default now()
);
alter table public.intercorrencias_equipe enable row level security;
-- Sem política: só as funções abaixo (security definer) leem e escrevem.

create table if not exists public.intercorrencias_equipe_historico (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  papel_anterior text,
  papel_novo text,
  feito_por uuid not null,
  feito_em timestamptz not null default now()
);
alter table public.intercorrencias_equipe_historico enable row level security;

-- ---------------------------------------------------------------------------
-- Histórico de revisão
-- ---------------------------------------------------------------------------
create table if not exists public.intercorrencias_revisoes (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null check (protocolo ~ '^[a-z0-9-]{2,60}$'),
  versao integer not null check (versao > 0),
  assinatura text not null check (assinatura ~ '^[0-9a-f]{6,40}$'),
  situacao text not null check (situacao in ('rascunho', 'pendente', 'aprovado', 'necessita_atualizacao', 'suspenso')),
  conteudo jsonb not null check (jsonb_typeof(conteudo) = 'object'),
  observacao text check (observacao is null or length(observacao) <= 2000),
  autor_id uuid not null references public.perfis(id) on delete restrict,
  autor_nome text not null,
  autor_crm text,
  autor_papel text not null check (autor_papel in ('admin', 'editor', 'revisor')),
  criado_em timestamptz not null default now(),
  -- Aprovar e pedir atualização é ato do revisor, com CRM.
  check (situacao not in ('aprovado', 'necessita_atualizacao') or (autor_papel = 'revisor' and autor_crm is not null))
);
create index if not exists intercorrencias_revisoes_protocolo on public.intercorrencias_revisoes (protocolo, criado_em);
alter table public.intercorrencias_revisoes enable row level security;

-- Conteúdo clínico sem dado de paciente: qualquer usuário logado lê (o médico
-- precisa saber o que está aprovado, por quem e quando).
drop policy if exists "intercorrencias_revisoes_le" on public.intercorrencias_revisoes;
create policy "intercorrencias_revisoes_le" on public.intercorrencias_revisoes
  for select to authenticated using (true);

create or replace function public.intercorrencias_historico_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'HISTORICO_IMUTAVEL';
end;
$$;
drop trigger if exists intercorrencias_revisoes_imutavel on public.intercorrencias_revisoes;
create trigger intercorrencias_revisoes_imutavel
  before update or delete on public.intercorrencias_revisoes
  for each row execute function public.intercorrencias_historico_imutavel();
drop trigger if exists intercorrencias_equipe_historico_imutavel on public.intercorrencias_equipe_historico;
create trigger intercorrencias_equipe_historico_imutavel
  before update or delete on public.intercorrencias_equipe_historico
  for each row execute function public.intercorrencias_historico_imutavel();

-- ---------------------------------------------------------------------------
-- Quem sou eu no módulo
-- ---------------------------------------------------------------------------
create or replace function public.intercorrencias_meu_papel()
returns table (papel text, admin boolean, nome text, crm text)
language sql
stable
security definer
set search_path = public
as $$
  select e.papel, public.e_super_admin(), p.nome, nullif(trim(coalesce(p.crm, '')), '')
    from public.perfis p
    left join public.intercorrencias_equipe e on e.user_id = p.id
   where p.id = auth.uid() and p.status = 'ativo';
$$;
revoke all on function public.intercorrencias_meu_papel() from public, anon;
grant execute on function public.intercorrencias_meu_papel() to authenticated;

-- ---------------------------------------------------------------------------
-- Registrar uma decisão
-- ---------------------------------------------------------------------------
create or replace function public.intercorrencias_registrar(
  p_protocolo text, p_versao integer, p_assinatura text, p_situacao text, p_conteudo jsonb, p_observacao text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil public.perfis%rowtype;
  v_papel text;
  v_crm text;
  v_id uuid;
begin
  select * into v_perfil from public.perfis where id = auth.uid() and status = 'ativo';
  if not found then raise exception 'SEM_PERMISSAO'; end if;
  select e.papel into v_papel from public.intercorrencias_equipe e where e.user_id = v_perfil.id;
  if v_papel is null and public.e_super_admin() then v_papel := 'admin'; end if;
  if v_papel is null then raise exception 'SEM_PERMISSAO'; end if;

  if p_situacao not in ('rascunho', 'pendente', 'aprovado', 'necessita_atualizacao', 'suspenso') then
    raise exception 'SITUACAO_INVALIDA';
  end if;
  if (v_papel = 'editor' and p_situacao not in ('rascunho', 'pendente'))
     or (v_papel = 'admin' and p_situacao not in ('rascunho', 'pendente', 'suspenso')) then
    raise exception 'SEM_PERMISSAO';
  end if;

  v_crm := nullif(trim(coalesce(v_perfil.crm, '')), '');
  if p_situacao in ('aprovado', 'necessita_atualizacao') and v_crm is null then
    raise exception 'REVISOR_SEM_CRM';
  end if;
  if p_situacao in ('necessita_atualizacao', 'suspenso') and length(trim(coalesce(p_observacao, ''))) < 5 then
    raise exception 'MOTIVO_OBRIGATORIO';
  end if;
  if p_conteudo is null or jsonb_typeof(p_conteudo) <> 'object'
     or p_conteudo->>'id' is distinct from p_protocolo
     or p_conteudo->'versao' is distinct from to_jsonb(p_versao) then
    raise exception 'CONTEUDO_INVALIDO';
  end if;

  insert into public.intercorrencias_revisoes
    (protocolo, versao, assinatura, situacao, conteudo, observacao, autor_id, autor_nome, autor_crm, autor_papel)
  values
    (p_protocolo, p_versao, p_assinatura, p_situacao, p_conteudo, nullif(trim(coalesce(p_observacao, '')), ''),
     v_perfil.id, coalesce(nullif(trim(v_perfil.nome), ''), 'Sem nome'), v_crm, v_papel)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.intercorrencias_registrar(text, integer, text, text, jsonb, text) from public, anon;
grant execute on function public.intercorrencias_registrar(text, integer, text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Montar a equipe (só o super-admin)
-- ---------------------------------------------------------------------------
create or replace function public.intercorrencias_definir_papel(p_email text, p_papel text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo public.perfis%rowtype;
  v_antes text;
begin
  if not public.e_super_admin() then raise exception 'SEM_PERMISSAO'; end if;
  if p_papel is not null and p_papel not in ('editor', 'revisor') then raise exception 'PAPEL_INVALIDO'; end if;
  select * into v_alvo from public.perfis
   where lower(email) = lower(trim(coalesce(p_email, ''))) and status = 'ativo'
   order by created_at limit 1;
  if not found then raise exception 'PESSOA_NAO_ENCONTRADA'; end if;
  if p_papel = 'revisor' and nullif(trim(coalesce(v_alvo.crm, '')), '') is null then
    raise exception 'REVISOR_SEM_CRM';
  end if;

  select papel into v_antes from public.intercorrencias_equipe where user_id = v_alvo.id;
  if p_papel is null then
    delete from public.intercorrencias_equipe where user_id = v_alvo.id;
  else
    insert into public.intercorrencias_equipe (user_id, papel, incluido_por)
    values (v_alvo.id, p_papel, auth.uid())
    on conflict (user_id) do update set papel = excluded.papel, incluido_por = excluded.incluido_por, incluido_em = now();
  end if;
  if v_antes is distinct from p_papel then
    insert into public.intercorrencias_equipe_historico (user_id, papel_anterior, papel_novo, feito_por)
    values (v_alvo.id, v_antes, p_papel, auth.uid());
  end if;
  return coalesce(v_alvo.nome, v_alvo.email);
end;
$$;
revoke all on function public.intercorrencias_definir_papel(text, text) from public, anon;
grant execute on function public.intercorrencias_definir_papel(text, text) to authenticated;

create or replace function public.intercorrencias_equipe_lista()
returns table (user_id uuid, nome text, email text, crm text, papel text, incluido_em timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.e_super_admin() then raise exception 'SEM_PERMISSAO'; end if;
  return query
    select e.user_id, p.nome, p.email, nullif(trim(coalesce(p.crm, '')), ''), e.papel, e.incluido_em
      from public.intercorrencias_equipe e
      join public.perfis p on p.id = e.user_id
     order by e.papel, p.nome;
end;
$$;
revoke all on function public.intercorrencias_equipe_lista() from public, anon;
grant execute on function public.intercorrencias_equipe_lista() to authenticated;
