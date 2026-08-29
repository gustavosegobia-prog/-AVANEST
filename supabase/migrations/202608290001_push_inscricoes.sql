-- ============================================================================
-- Inscrições de notificação (Web Push)
--
-- Isto NÃO é uma tabela de notificações. lib/avisos.ts já explica por que não
-- existe uma: aviso guardado envelhece separado do fato que o originou, e a
-- troca cancelada continua avisando que alguém espera resposta. Os avisos
-- continuam derivados das tabelas que guardam a verdade.
--
-- O que mora aqui é o APARELHO: o endereço que o Chrome, o Firefox ou o
-- Safari deram a este site para poder tocar o telefone de uma pessoa. É
-- cadastro de destino, não de conteúdo — a mesma diferença entre a agenda de
-- telefones e as conversas.
--
-- UMA PESSOA TEM VÁRIOS. Celular, tablet e o computador do consultório são
-- três inscrições do mesmo perfil, e todas recebem. Quem sai da equipe perde
-- as suas por cascade, junto com o perfil.
-- ============================================================================

create table if not exists public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,

  -- O endereço no serviço de push. ÚNICO no sistema inteiro, e não por
  -- organização: o mesmo navegador reinscrito devolve o mesmo endpoint, e sem
  -- a restrição a pessoa acumularia uma linha por vez que abriu o app — e
  -- receberia a mesma notificação cinco vezes.
  endpoint text not null unique,
  -- A chave pública do navegador (65 bytes) e o segredo (16), em base64url.
  p256dh text not null,
  auth text not null,

  -- Para a pessoa reconhecer qual aparelho é, na hora de desligar um deles.
  aparelho text,

  criado_em timestamptz not null default now(),
  ultimo_envio_em timestamptz,
  -- Quantas vezes seguidas o serviço de push recusou. Serve para limpar o que
  -- morreu sem ter dito: navegador desinstalado devolve 410 e sai na hora, mas
  -- há falha de rede que só se revela na repetição.
  falhas integer not null default 0
);

create index if not exists push_por_perfil on public.push_inscricoes (perfil_id);
create index if not exists push_por_instituicao on public.push_inscricoes (institution_id);

alter table public.push_inscricoes enable row level security;

-- Cada um cuida dos SEUS aparelhos, e de mais nenhum. Nem o administrador
-- mexe: um endpoint alheio é o endereço para tocar o telefone de outra
-- pessoa, e não há motivo administrativo para alcançá-lo. Quem envia é o
-- servidor, com a chave de serviço, fora do RLS.
drop policy if exists "cada_um_cuida_dos_seus_aparelhos" on public.push_inscricoes;
create policy "cada_um_cuida_dos_seus_aparelhos"
on public.push_inscricoes for all to authenticated
using (perfil_id = auth.uid() and institution_id = public.current_institution_id())
with check (perfil_id = auth.uid() and institution_id = public.current_institution_id());
