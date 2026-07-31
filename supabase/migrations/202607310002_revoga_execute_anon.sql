-- current_institution_id() e current_app_role() leem o perfil a partir de
-- auth.uid(), portanto só fazem sentido para um usuário autenticado.
--
-- As 31 políticas de RLS que dependem delas se aplicam somente ao papel
-- `authenticated`, e o aplicativo nunca as chama antes do login. Manter o
-- EXECUTE aberto para `anon` não tinha utilidade e mantinha dois alertas de
-- segurança em aberto.
--
-- Atenção: o EXECUTE para `authenticated` deve permanecer. Revogá-lo quebraria
-- todas as políticas de RLS que chamam estas funções.
revoke execute on function public.current_institution_id() from anon;
revoke execute on function public.current_app_role() from anon;
