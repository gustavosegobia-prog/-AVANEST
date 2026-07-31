-- Distingue anestesiologista individual de grupo de anestesiologistas.
-- As instituições existentes são grupos, por isso o default.
alter table public.instituicoes
  add column if not exists tipo text not null default 'grupo';

alter table public.instituicoes
  drop constraint if exists instituicoes_tipo_check;

alter table public.instituicoes
  add constraint instituicoes_tipo_check check (tipo in ('individual','grupo'));

-- rls_auto_enable é um event trigger: ativa RLS automaticamente em toda tabela
-- nova do schema public. Quem dispara é o Postgres, nunca um cliente da API.
-- O EXECUTE aberto não era explorável (o PostgREST não invoca função de event
-- trigger), mas mantinha um alerta de segurança em aberto.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
