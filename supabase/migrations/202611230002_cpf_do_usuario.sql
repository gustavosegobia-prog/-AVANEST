-- O CPF de quem cria a conta (23/11/2026), conferido pelos dígitos
-- verificadores. Pega o número digitado errado e o inventado; não consulta a
-- Receita (isso é pago e fica para depois). A mesma conta está em lib/cpf.ts.
--
-- NUMA TABELA À PARTE, e não em perfis: os colegas da organização leem as
-- colunas de perfis uns dos outros (nome, CRM, celular), e o CPF não é dado
-- para circular no grupo. Aqui cada pessoa lê só o próprio, e grava só pela
-- função definir_meu_cpf.

create or replace function public.cpf_valido(p_cpf text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  soma int;
  resto int;
  i int;
begin
  if length(d) <> 11 or d = repeat(substr(d, 1, 1), 11) then
    return false;
  end if;
  soma := 0;
  for i in 1..9 loop soma := soma + substr(d, i, 1)::int * (11 - i); end loop;
  resto := (soma * 10) % 11;
  if resto = 10 then resto := 0; end if;
  if resto <> substr(d, 10, 1)::int then return false; end if;
  soma := 0;
  for i in 1..10 loop soma := soma + substr(d, i, 1)::int * (12 - i); end loop;
  resto := (soma * 10) % 11;
  if resto = 10 then resto := 0; end if;
  return resto = substr(d, 11, 1)::int;
end $$;

create table if not exists public.perfis_cpf (
  perfil_id uuid primary key references public.perfis(id) on delete cascade,
  cpf text not null check (public.cpf_valido(cpf) and cpf ~ '^[0-9]{11}$'),
  atualizado_em timestamptz not null default now()
);

alter table public.perfis_cpf enable row level security;

create policy cada_um_le_o_proprio_cpf on public.perfis_cpf
  for select to authenticated
  using (perfil_id = (select auth.uid()));

revoke all on table public.perfis_cpf from anon;
revoke insert, update, delete, truncate, references, trigger on table public.perfis_cpf from authenticated;
grant select on table public.perfis_cpf to authenticated;

-- A própria pessoa grava o próprio CPF, como o celular (definir_meu_celular).
create or replace function public.definir_meu_cpf(p_cpf text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  digitos text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para salvar o CPF.';
  end if;
  if length(digitos) <> 11 then
    raise exception 'Informe o CPF com os 11 números.';
  end if;
  if not public.cpf_valido(digitos) then
    raise exception 'Esse CPF não confere. Verifique os números.';
  end if;
  insert into public.perfis_cpf (perfil_id, cpf) values (auth.uid(), digitos)
  on conflict (perfil_id) do update set cpf = excluded.cpf, atualizado_em = now();
end $$;

revoke all on function public.definir_meu_cpf(text) from public, anon;
grant execute on function public.definir_meu_cpf(text) to authenticated;
