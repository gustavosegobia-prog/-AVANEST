-- AVANEST: correção pontual do perfil do proprietário e auditoria de presença.
-- Execute esta migração uma vez no Supabase SQL Editor ou pelo Supabase CLI.

update public.perfis as p
set role = 'owner', updated_at = now()
from auth.users as u
where p.id = u.id
  and lower(u.email) = lower('gustavosegobia@icloud.com')
  and p.role is distinct from 'owner';

-- A ação de presença deve ficar disponível somente para um usuário autenticado.
grant execute on function public.registrar_presenca(uuid, text) to authenticated;
