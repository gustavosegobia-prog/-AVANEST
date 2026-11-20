-- O celular de quem usa o AVANEST.
--
-- Até aqui o perfil não guardava telefone: para falar com um assinante que
-- parou de usar, só sobrava o e-mail. O celular entra no fim do cadastro
-- (organização nova ou convite) e fica só com os dígitos, com DDD
-- (ex.: 41997870810), ou com o código do país quando vier de fora.

alter table public.perfis add column if not exists celular text;

comment on column public.perfis.celular is
  'Celular do usuário, só dígitos, com DDD (10 a 13 dígitos). Preenchido no cadastro.';

-- A própria pessoa grava o próprio celular. Security definer porque o
-- perfil tem regras por coluna; aqui só a linha de auth.uid() é tocada.
create or replace function public.definir_meu_celular(p_celular text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  digitos text := regexp_replace(coalesce(p_celular, ''), '\D', '', 'g');
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para salvar o celular.';
  end if;
  if length(digitos) < 10 or length(digitos) > 13 then
    raise exception 'Informe o celular com DDD, por exemplo (41) 99999-9999.';
  end if;
  update public.perfis set celular = digitos where id = auth.uid();
end $$;

revoke all on function public.definir_meu_celular(text) from public, anon;
grant execute on function public.definir_meu_celular(text) to authenticated;
