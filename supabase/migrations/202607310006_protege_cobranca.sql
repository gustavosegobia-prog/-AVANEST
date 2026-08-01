-- ============================================================================
-- Colunas que decidem dinheiro e poder não podem ser escritas pelo cliente.
--
-- As policies deixam owner/admin atualizarem a própria instituição (para trocar
-- o nome) e os perfis da equipe (para trocar papel e status). Só que isso
-- também deixava qualquer administrador rodar, direto da API:
--
--   update instituicoes set plano='cortesia', assinatura_ate=null;
--   update perfis set super_admin=true where id = auth.uid();
--
-- ou seja, se dar acesso vitalício de graça e enxergar todas as organizações.
-- Os gatilhos abaixo devolvem essas colunas ao valor antigo em vez de recusar
-- o update inteiro, para não quebrar as telas que salvam o registro completo.
--
-- auth.uid() nulo = service role, editor SQL e migrações: esses continuam
-- livres, é por eles que a cobrança é administrada.
-- ============================================================================

create or replace function public.e_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis sa
    where sa.id = auth.uid() and sa.super_admin and sa.status = 'ativo'
  );
$$;

-- O Postgres concede EXECUTE ao PUBLIC assim que a função é criada, então
-- revogar só de "anon, authenticated" não tira nada. É o PUBLIC que precisa sair.
revoke execute on function public.e_super_admin() from public, anon, authenticated;

create or replace function public.protege_assinatura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.e_super_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Organização nova sempre nasce em teste grátis de 14 dias.
    new.plano := 'trial';
    new.assinatura_ate := now() + interval '14 days';
    new.valor_por_profissional := 49.99;
    new.mp_assinatura_id := null;
    return new;
  end if;

  new.plano := old.plano;
  new.assinatura_ate := old.assinatura_ate;
  new.valor_por_profissional := old.valor_por_profissional;
  new.mp_assinatura_id := old.mp_assinatura_id;
  return new;
end;
$$;

drop trigger if exists protege_assinatura on public.instituicoes;
create trigger protege_assinatura
  before insert or update on public.instituicoes
  for each row execute function public.protege_assinatura();

create or replace function public.protege_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.e_super_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.super_admin := false;
  else
    new.super_admin := old.super_admin;
    -- Mudar de organização por update seria furar o isolamento por fora do RLS.
    new.institution_id := old.institution_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protege_super_admin on public.perfis;
create trigger protege_super_admin
  before insert or update on public.perfis
  for each row execute function public.protege_super_admin();
