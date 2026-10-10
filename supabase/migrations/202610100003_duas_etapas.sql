-- Verificação em duas etapas: o banco cobra o código de quem o ativou.
--
-- A tela que pede o código (/duas-etapas e o login) é o caminho; a tranca é
-- esta. Sem ela, a verificação seria teatro: a chave pública do Supabase está
-- no navegador, e quem tivesse só a senha entraria com uma sessão "aal1" e
-- leria tudo pela API, sem passar por tela nenhuma.
--
-- A REGRA: quem tem um fator verificado em auth.mfa_factors só usa a API com
-- sessão "aal2" — a que já confirmou o código. Quem não ativou a verificação
-- segue como antes (a obrigação para proprietário e administrador é cobrada
-- pelo sistema, que manda cadastrar antes de entrar).
--
-- DUAS PORTAS, porque o porteiro da API não vê tudo:
--   1. pgrst.db_pre_request — roda antes de TODA chamada à API de dados:
--      tabelas e também funções (rpc), que não passam por RLS.
--   2. Política RESTRITIVA nas tabelas que saem por Realtime (a conversa da
--      equipe e os chamados). Realtime não passa pelo porteiro da API; ele
--      confere a RLS — e a restritiva soma-se às que já existem com AND.

create or replace function public.sessao_cumpre_duas_etapas()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is null
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

revoke all on function public.sessao_cumpre_duas_etapas() from public;
grant execute on function public.sessao_cumpre_duas_etapas() to anon, authenticated, service_role;

create or replace function public.porteiro_das_duas_etapas()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.sessao_cumpre_duas_etapas() then
    raise sqlstate 'PGRST' using
      message = json_build_object(
        'code', 'AVN_DUAS_ETAPAS',
        'message', 'Confirme o código da verificação em duas etapas para continuar.')::text,
      detail = json_build_object('status', 401)::text;
  end if;
end;
$$;

revoke all on function public.porteiro_das_duas_etapas() from public;
grant execute on function public.porteiro_das_duas_etapas() to anon, authenticated, service_role;

create policy "exige_duas_etapas" on public.chamados as restrictive
  for all to authenticated
  using ((select public.sessao_cumpre_duas_etapas()))
  with check ((select public.sessao_cumpre_duas_etapas()));

create policy "exige_duas_etapas" on public.chamado_mensagens as restrictive
  for all to authenticated
  using ((select public.sessao_cumpre_duas_etapas()))
  with check ((select public.sessao_cumpre_duas_etapas()));

create policy "exige_duas_etapas" on public.sala_mensagens as restrictive
  for all to authenticated
  using ((select public.sessao_cumpre_duas_etapas()))
  with check ((select public.sessao_cumpre_duas_etapas()));

alter role authenticator set pgrst.db_pre_request = 'public.porteiro_das_duas_etapas';
notify pgrst, 'reload config';

-- Para desligar numa emergência (por exemplo, se a API inteira começar a
-- responder 401):
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';
