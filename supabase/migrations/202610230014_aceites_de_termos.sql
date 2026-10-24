-- ============================================================================
-- Prova do aceite dos Termos de Uso e da Política de Privacidade
--
-- Até aqui, só o pagamento gravava o aceite (instituicoes.termos_aceitos_*),
-- uma vez por organização. A caixa do cadastro não deixava rastro: das 12
-- organizações de 23/10/2026, só 2 tinham o aceite gravado. Agora cada aceite
-- de cada pessoa vira uma linha — no cadastro, no pagamento e no aceite de um
-- texto novo pelo painel —, com a versão do texto (lib/termos.ts).
--
-- Linha só entra: nada se corrige nem se apaga, porque é prova. Por isso não
-- há chave estrangeira — excluir a conta ou a organização não pode levar
-- junto, nem alterar, o registro do que foi aceito.
-- ============================================================================

create table if not exists public.aceites_de_termos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  institution_id uuid,
  versao text not null check (versao ~ '^\d{4}-\d{2}-\d{2}$'),
  origem text not null check (origem in ('cadastro', 'pagamento', 'painel')),
  aceito_em timestamptz not null default now(),
  ip text,
  navegador text
);
create index if not exists aceites_de_termos_por_usuario
  on public.aceites_de_termos (user_id, versao);

-- Cada pessoa lê os próprios aceites (o painel pergunta se falta o atual).
-- Quem grava é o servidor, com a chave de serviço, ou o gatilho do cadastro.
alter table public.aceites_de_termos enable row level security;
revoke all on public.aceites_de_termos from anon, authenticated;
grant select on public.aceites_de_termos to authenticated;
drop policy if exists "cada_um_le_os_seus_aceites" on public.aceites_de_termos;
create policy "cada_um_le_os_seus_aceites" on public.aceites_de_termos
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.aceite_nao_muda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Aceite registrado não se altera nem se apaga: é a prova do que foi aceito.';
end;
$$;
drop trigger if exists aceite_nao_muda on public.aceites_de_termos;
create trigger aceite_nao_muda
  before update or delete on public.aceites_de_termos
  for each row execute function public.aceite_nao_muda();

-- O aceite do cadastro. A conta nasce antes da confirmação do e-mail, sem
-- sessão; a tela manda a versão aceita no metadado da conta (só com a caixa
-- marcada), e este gatilho a grava no instante em que a conta é criada.
-- Nunca impede o cadastro: se a gravação falhar, o painel pede o aceite
-- depois.
create or replace function public.aceite_no_cadastro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'termos_versao', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      insert into public.aceites_de_termos (user_id, email, versao, origem, aceito_em)
      values (new.id, new.email, new.raw_user_meta_data->>'termos_versao', 'cadastro', now());
    exception when others then
      raise warning 'aceite_no_cadastro: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;
drop trigger if exists aceite_no_cadastro on auth.users;
create trigger aceite_no_cadastro
  after insert on auth.users
  for each row execute function public.aceite_no_cadastro();

-- Funções de gatilho: só rodam como gatilho, e não ficam ao alcance da API.
revoke execute on function public.aceite_nao_muda(), public.aceite_no_cadastro()
  from public, anon, authenticated;
