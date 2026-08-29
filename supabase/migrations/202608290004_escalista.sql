-- ============================================================================
-- O escalista
--
-- Montar a escala e administrar a casa eram a mesma coisa no código: quem
-- podia lançar plantão para um colega era quem tinha papel de admin. Num grupo
-- de verdade não são a mesma coisa. Quem organiza a escala costuma ser UM
-- anestesiologista — o que virou a escala do mês no papel durante anos — e
-- torná-lo administrador para isso lhe entrega de brinde o Financeiro, os
-- convites e o cadastro de todo mundo.
--
-- É MARCADOR, E NÃO PAPEL. Papel é exclusivo: virar "escalista" custaria o
-- "medico", e o escalista é justamente um médico. O marcador soma-se.
--
-- ---------------------------------------------------------------------------
-- A REGRA DE COMPATIBILIDADE
--
-- Enquanto ninguém estiver marcado na organização, os administradores
-- continuam montando a escala, exatamente como hoje. Valendo de imediato, as
-- organizações que já existem acordariam sem ninguém capaz de lançar um
-- plantão — e a primeira notícia disso seria alguém tentando escalar o plantão
-- de amanhã.
--
-- O PROPRIETÁRIO NUNCA PERDE. Escalista de férias, com a senha perdida ou fora
-- do grupo não pode trancar a escala do mês do lado de fora.
-- ============================================================================

alter table public.perfis
  add column if not exists escalista boolean not null default false;

comment on column public.perfis.escalista is
  'Monta a escala do grupo sem ser administrador. Ninguém marcado = todo admin monta, como antes.';

-- Achar os escalistas de uma organização é a pergunta mais feita pela regra
-- abaixo, e ela roda em cada gravação de plantão.
create index if not exists perfis_escalistas
  on public.perfis (institution_id) where escalista;

-- ============================================================================
-- A regra, do lado do banco
--
-- A tela vai esconder o botão de quem não pode. Esconder não é proibir: sem
-- isto, um POST na API do PostgREST continuaria lançando plantão no nome de
-- qualquer colega — e escala trocada sem se saber por quem é exatamente o
-- problema que este recurso existe para resolver.
-- ============================================================================

create or replace function public.pode_montar_escala()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.role = 'owner'
        or p.escalista
        -- Ninguém eleito nesta organização: segue a regra antiga.
        or (p.role = 'admin' and not exists (
              select 1 from public.perfis e
               where e.institution_id = p.institution_id
                 and e.escalista and e.status = 'ativo'))
      from public.perfis p
     where p.id = auth.uid() and p.status = 'ativo'
  ), false)
$$;

revoke execute on function public.pode_montar_escala() from public, anon;
grant execute on function public.pode_montar_escala() to authenticated;

-- Cada um continua mexendo no PRÓPRIO plantão — trocar o valor, marcar como
-- pago, cancelar o seu. O que passa a exigir o marcador é mexer no plantão dos
-- OUTROS, que é o que "montar a escala do grupo" quer dizer.
drop policy if exists "cada_um_no_seu_plantao" on public.plantoes;
create policy "cada_um_no_seu_plantao" on public.plantoes
  for all using (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or public.pode_montar_escala())
  ) with check (
    institution_id = public.current_institution_id()
    and (perfil_id = auth.uid() or public.pode_montar_escala())
  );

-- ============================================================================
-- Quem pode ELEGER o escalista
--
-- Só proprietário e administrador. Se o próprio escalista pudesse marcar
-- outros, a decisão de quem manda na escala sairia de quem responde pelo
-- grupo — e, pior, ele poderia se desmarcar e trancar a escala sem querer.
--
-- Mesmo padrão das colunas de cobrança: o gatilho devolve o valor antigo em
-- vez de recusar o update inteiro, para não quebrar as telas que gravam o
-- registro completo. auth.uid() nulo = service role e migrações.
-- ============================================================================

create or replace function public.protege_escalista()
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
    -- Ninguém nasce escalista: é escolha de quem já está na casa.
    new.escalista := false;
    return new;
  end if;
  if new.escalista is distinct from old.escalista
     and public.current_app_role() not in ('owner', 'admin') then
    new.escalista := old.escalista;
  end if;
  return new;
end;
$$;

drop trigger if exists protege_escalista on public.perfis;
create trigger protege_escalista
  before insert or update on public.perfis
  for each row execute function public.protege_escalista();

revoke execute on function public.protege_escalista() from public, anon;
