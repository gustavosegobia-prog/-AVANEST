-- ============================================================================
-- Módulos por organização
--
-- Até aqui o AVANEST tinha um tamanho só: a organização recebia o sistema
-- inteiro e o que variava era o PAPEL de cada pessoa dentro dele. Isso basta
-- enquanto o cliente é um grupo de anestesiologistas que faz tudo.
--
-- Deixa de bastar quando o cliente é um HOSPITAL. O centro cirúrgico quer a
-- ficha anestésica e a escala; não quer — e não deve ter — o financeiro de um
-- serviço médico que não é dele. Não é permissão de pessoa: é o contrato da
-- casa. Nem o administrador de lá deve abrir uma aba de Financeiro, porque
-- aquela organização não contratou financeiro nenhum.
--
-- NULO E VAZIO SIGNIFICAM "TUDO". É o que faz as organizações que já existem
-- continuarem inteiras sem preencher coluna nenhuma: a restrição é a exceção
-- declarada, e o padrão errado aqui apagaria abas de todos os clientes.
--
-- 'admin' não entra na lista, de propósito: é por ela que se convida gente e se
-- paga a assinatura. Uma organização capaz de desligar a própria administração
-- ficaria trancada por fora, sem ninguém lá dentro para reabrir.
-- ============================================================================

alter table public.instituicoes
  add column if not exists modulos text[];

comment on column public.instituicoes.modulos is
  'Áreas de trabalho contratadas. NULO ou vazio = todas. Fora daqui: admin, que acompanha o papel.';

-- Só nomes conhecidos entram. Um 'financeir' com erro de digitação desligaria o
-- Financeiro sem que ninguém entendesse por quê.
alter table public.instituicoes drop constraint if exists instituicoes_modulos_conhecidos;
alter table public.instituicoes add constraint instituicoes_modulos_conhecidos
  check (modulos is null or modulos <@ array['medico','plantoes','recepcao','financeiro']::text[]);

-- ============================================================================
-- Quem pode mexer nisto
--
-- Mesmo motivo das colunas de cobrança: a policy deixa o administrador salvar a
-- própria instituição para trocar o nome, e isso também deixaria ele rodar
--
--   update instituicoes set modulos = null;
--
-- e contratar sozinho o sistema inteiro. O gatilho devolve a coluna ao valor
-- antigo em vez de recusar o update, para não quebrar as telas que gravam o
-- registro completo.
--
-- auth.uid() nulo = service role, editor SQL e migrações: é por eles que o
-- contrato é administrado.
-- ============================================================================

create or replace function public.protege_modulos()
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
    -- Organização nova nasce inteira. Quem vende um contrato menor é o
    -- super-admin, depois, e não o navegador de quem está se cadastrando.
    new.modulos := null;
    return new;
  end if;
  new.modulos := old.modulos;
  return new;
end;
$$;

drop trigger if exists protege_modulos on public.instituicoes;
create trigger protege_modulos
  before insert or update on public.instituicoes
  for each row execute function public.protege_modulos();

-- ============================================================================
-- O módulo, do lado do banco
--
-- A tela já esconde a aba. Esconder não é proibir: enquanto a regra viver só no
-- navegador, um POST na API do PostgREST continua criando linha de financeiro
-- numa organização que não contratou financeiro. As policies abaixo fecham isso.
-- ============================================================================

create or replace function public.modulo_liberado(p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select i.modulos is null
         or cardinality(i.modulos) = 0
         or p_modulo = any(i.modulos)
       from public.instituicoes i
       join public.perfis p on p.institution_id = i.id
      where p.id = auth.uid() and p.status = 'ativo'),
    false)
$$;

-- O Postgres concede EXECUTE a PUBLIC em toda função nova, e PUBLIC inclui o
-- visitante sem login. Com anon o auth.uid() é nulo e a função já devolve
-- falso; a tranca é para o dia em que alguém mexer no corpo dela.
revoke execute on function public.modulo_liberado(text) from public, anon;
revoke execute on function public.protege_modulos() from public, anon;
grant execute on function public.modulo_liberado(text) to authenticated;

-- ── O Financeiro ────────────────────────────────────────────────────────────
-- Uma condição a mais em cada policy que já existe. O isolamento entre
-- organizações continua sendo o current_institution_id(); isto é a camada de
-- dentro, para a organização que não comprou o módulo não acumular dado nele.

drop policy if exists "financeiro_e_admin_gerenciam_atendimentos" on public.financeiro_atendimentos;
create policy "financeiro_e_admin_gerenciam_atendimentos"
on public.financeiro_atendimentos for all to authenticated
using (public.current_institution_id() = institution_id
       and public.current_has_permission('financeiro')
       and public.modulo_liberado('financeiro'))
with check (public.current_institution_id() = institution_id
       and public.current_has_permission('financeiro')
       and public.modulo_liberado('financeiro'));

drop policy if exists "financeiro_e_admin_gerenciam_pagamentos" on public.financeiro_pagamentos;
create policy "financeiro_e_admin_gerenciam_pagamentos"
on public.financeiro_pagamentos for all to authenticated
using (public.current_institution_id() = institution_id
       and public.current_has_permission('financeiro')
       and public.modulo_liberado('financeiro'))
with check (public.current_institution_id() = institution_id
       and public.current_has_permission('financeiro')
       and public.modulo_liberado('financeiro'));

drop policy if exists "financeiro_gerencia_periodos" on public.financeiro_periodos;
create policy "financeiro_gerencia_periodos"
on public.financeiro_periodos for all to authenticated
using (public.modulo_liberado('financeiro') and exists (
    select 1 from public.perfis p
     where p.id = auth.uid() and p.institution_id = financeiro_periodos.institution_id
       and p.status = 'ativo' and p.role in ('financeiro','admin','owner')))
with check (public.modulo_liberado('financeiro') and exists (
    select 1 from public.perfis p
     where p.id = auth.uid() and p.institution_id = financeiro_periodos.institution_id
       and p.status = 'ativo' and p.role in ('financeiro','admin','owner')));

drop policy if exists "admin_gerencia_valores_convenio" on public.convenio_valores;
create policy "admin_gerencia_valores_convenio"
on public.convenio_valores for all to authenticated
using (public.current_institution_id() = institution_id
       and public.current_app_role() in ('admin','owner')
       and public.modulo_liberado('financeiro'))
with check (public.current_institution_id() = institution_id
       and public.current_app_role() in ('admin','owner')
       and public.modulo_liberado('financeiro'));

drop policy if exists "financeiro_le_valores_convenio" on public.convenio_valores;
create policy "financeiro_le_valores_convenio"
on public.convenio_valores for select to authenticated
using (public.current_institution_id() = institution_id
       and public.current_app_role() in ('financeiro','admin','owner')
       and public.modulo_liberado('financeiro'));

-- As despesas são pessoais: cada um lança as suas. Mesmo assim seguem o
-- contrato — organização sem financeiro não tem onde vê-las.
drop policy if exists "despesas_do_servico" on public.despesas;
create policy "despesas_do_servico"
on public.despesas for all to authenticated
using (institution_id = public.current_institution_id()
       and public.modulo_liberado('financeiro')
       and (perfil_id = auth.uid() or public.current_app_role() in ('owner','admin','financeiro')))
with check (institution_id = public.current_institution_id()
       and public.modulo_liberado('financeiro')
       and (perfil_id = auth.uid() or public.current_app_role() in ('owner','admin','financeiro')));

-- ── O convite ───────────────────────────────────────────────────────────────
-- Convidar alguém para um papel que a organização não contratou entrega uma
-- conta que cai numa tela sem nenhuma aba. Fecha-se na origem, e no banco:
-- a lista da tela some, e um POST direto também é recusado.

drop policy if exists "owner_admin_gerencia_convites" on public.convites;
create policy "owner_admin_gerencia_convites"
on public.convites for all to authenticated
using (exists (
    select 1 from public.perfis p
     where p.id = auth.uid() and p.status = 'ativo'
       and p.institution_id = convites.institution_id
       and p.role in ('admin','owner')))
with check (exists (
    select 1 from public.perfis p
     where p.id = auth.uid() and p.status = 'ativo'
       and p.institution_id = convites.institution_id
       and p.role in ('admin','owner'))
  and (convites.role = 'admin' or public.modulo_liberado(convites.role)));
