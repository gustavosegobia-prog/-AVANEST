-- ============================================================================
-- Tabelas e honorários anestésicos — parte 3 de 3: a Produção ganha o
-- honorário previsto, os procedimentos com código TUSS e os movimentos
-- financeiros. Depende das partes 1 e 2. Só acrescenta: o que o médico já usa
-- continua igual.
-- ============================================================================

-- ============================================================================
-- 6. A Produção ganha o honorário
--
-- Tudo acrescentado; nada do que o médico já usa muda. A linha antiga nasce
-- como "nao_calculado" e continua exatamente como era.
-- ============================================================================

alter table public.producao_do_dia
  add column if not exists urgencia boolean not null default false,
  add column if not exists honorario_situacao text not null default 'nao_calculado'
    check (honorario_situacao in ('nao_calculado', 'calculado', 'pendente', 'conferido')),
  add column if not exists honorario_valor_previsto numeric(12,2) check (honorario_valor_previsto >= 0),
  add column if not exists honorario_pendencias jsonb not null default '[]'::jsonb
    check (jsonb_typeof(honorario_pendencias) = 'array'),
  -- A memória do cálculo: versões da TUSS, da CBHPM e do contrato, a regra
  -- aplicada e cada linha. Tabela atualizada depois não muda isto.
  add column if not exists honorario_calculo jsonb,
  add column if not exists honorario_calculado_em timestamptz,
  add column if not exists contrato_versao_id uuid references public.contrato_versoes(id) on delete restrict,
  add column if not exists conferido_por uuid references public.perfis(id),
  add column if not exists conferido_em timestamptz,
  add column if not exists valor_faturado numeric(12,2) check (valor_faturado >= 0),
  add column if not exists valor_recebido numeric(12,2) check (valor_recebido >= 0),
  add column if not exists glosa_valor numeric(12,2) check (glosa_valor >= 0),
  add column if not exists glosa_motivo text,
  add column if not exists glosa_recurso_status text not null default 'sem_recurso'
    check (glosa_recurso_status in ('sem_recurso', 'em_recurso', 'aceito', 'negado')),
  -- Reservado para o faturamento TISS/XML, que ainda não existe e não é ligado
  -- por esta migração.
  add column if not exists tiss_guia text,
  add column if not exists tiss_lote text;

-- Os procedimentos de cada anestesia, com o código TUSS escolhido na
-- conferência. Uma anestesia pode ter vários (procedimentos múltiplos). O
-- campo de texto "procedimento" da Produção continua como sempre foi.
create table if not exists public.producao_procedimentos (
  id uuid primary key default gen_random_uuid(),
  producao_id uuid not null references public.producao_do_dia(id) on delete cascade,
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  ordem smallint not null check (ordem between 1 and 20),
  tuss_codigo text check (tuss_codigo is null or tuss_codigo ~ '^[0-9]+$'),
  tuss_versao_id uuid references public.tuss_versoes(id) on delete restrict,
  -- A descrição oficial no momento da escolha.
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (producao_id, ordem)
);
create index if not exists producao_procedimentos_por_producao
  on public.producao_procedimentos (producao_id);

-- O histórico financeiro de cada anestesia: faturamento, pagamentos
-- (parciais ou não), glosa, recurso e o resultado dele, estorno. Linha
-- escrita não se edita nem se apaga: estorno é outra linha.
create table if not exists public.producao_movimentos (
  id uuid primary key default gen_random_uuid(),
  producao_id uuid not null references public.producao_do_dia(id) on delete restrict,
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  tipo text not null check (tipo in ('faturamento', 'pagamento', 'glosa', 'recurso', 'resultado_recurso', 'estorno')),
  valor numeric(12,2) not null default 0 check (valor >= 0),
  data date not null default current_date,
  observacao text,
  estorno_de uuid references public.producao_movimentos(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.perfis(id),
  created_at timestamptz not null default now(),
  check ((tipo = 'estorno') = (estorno_de is not null))
);
create index if not exists producao_movimentos_por_producao
  on public.producao_movimentos (producao_id, created_at);

-- O honorário não se escreve à mão. Quem grava é o cálculo (service role, sem
-- auth.uid()) ou uma função que marca avanest.honorarios. Mudar o que entra
-- no cálculo — convênio, data, hospital, urgência — desfaz o cálculo
-- anterior, que precisa ser refeito e conferido de novo.
create or replace function public.protege_honorario_da_producao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pelo_calculo boolean := auth.uid() is null
    or coalesce(current_setting('avanest.honorarios', true), '') = 'sim';
begin
  if tg_op = 'INSERT' then
    if not v_pelo_calculo then
      new.honorario_situacao := 'nao_calculado';
      new.honorario_valor_previsto := null;
      new.honorario_pendencias := '[]'::jsonb;
      new.honorario_calculo := null;
      new.honorario_calculado_em := null;
      new.contrato_versao_id := null;
      new.conferido_por := null;
      new.conferido_em := null;
      new.valor_faturado := null;
      new.valor_recebido := null;
      new.glosa_valor := null;
      new.glosa_motivo := null;
      new.glosa_recurso_status := 'sem_recurso';
      new.tiss_guia := null;
      new.tiss_lote := null;
    end if;
    return new;
  end if;

  if not v_pelo_calculo and (
       new.honorario_situacao is distinct from old.honorario_situacao
       or new.honorario_valor_previsto is distinct from old.honorario_valor_previsto
       or new.honorario_pendencias is distinct from old.honorario_pendencias
       or new.honorario_calculo is distinct from old.honorario_calculo
       or new.honorario_calculado_em is distinct from old.honorario_calculado_em
       or new.contrato_versao_id is distinct from old.contrato_versao_id
       or new.conferido_por is distinct from old.conferido_por
       or new.conferido_em is distinct from old.conferido_em
       or new.valor_faturado is distinct from old.valor_faturado
       or new.valor_recebido is distinct from old.valor_recebido
       or new.glosa_valor is distinct from old.glosa_valor
       or new.glosa_motivo is distinct from old.glosa_motivo
       or new.glosa_recurso_status is distinct from old.glosa_recurso_status
       or new.tiss_guia is distinct from old.tiss_guia
       or new.tiss_lote is distinct from old.tiss_lote) then
    raise exception 'O honorário muda pelo cálculo e pela conferência, que registram quem mudou — não por edição direta.';
  end if;

  if old.honorario_situacao <> 'nao_calculado' and (
       new.convenio is distinct from old.convenio or new.data is distinct from old.data
       or new.local_id is distinct from old.local_id or new.urgencia is distinct from old.urgencia) then
    new.honorario_situacao := 'nao_calculado';
    new.conferido_por := null;
    new.conferido_em := null;
  end if;
  return new;
end;
$$;
drop trigger if exists protege_honorario_da_producao on public.producao_do_dia;
create trigger protege_honorario_da_producao
  before insert or update on public.producao_do_dia
  for each row execute function public.protege_honorario_da_producao();

-- O dono e a organização de cada procedimento vêm da linha da Produção; e
-- mexer nos procedimentos também desfaz o cálculo anterior.
create or replace function public.procedimento_da_producao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod public.producao_do_dia;
begin
  select * into v_prod from public.producao_do_dia
   where id = case when tg_op = 'DELETE' then old.producao_id else new.producao_id end;
  if tg_op <> 'DELETE' then
    new.institution_id := v_prod.institution_id;
    new.perfil_id := v_prod.perfil_id;
    new.updated_at := now();
  end if;
  if v_prod.id is not null and v_prod.honorario_situacao <> 'nao_calculado' then
    perform set_config('avanest.honorarios', 'sim', true);
    update public.producao_do_dia
       set honorario_situacao = 'nao_calculado', conferido_por = null, conferido_em = null
     where id = v_prod.id;
    perform set_config('avanest.honorarios', '', true);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists procedimento_da_producao on public.producao_procedimentos;
create trigger procedimento_da_producao
  before insert or update or delete on public.producao_procedimentos
  for each row execute function public.procedimento_da_producao();

create or replace function public.movimento_da_producao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Movimento financeiro registrado não se edita nem se apaga: lance um estorno.';
  end if;
  new.institution_id := (select institution_id from public.producao_do_dia where id = new.producao_id);
  return new;
end;
$$;
drop trigger if exists movimento_da_producao on public.producao_movimentos;
create trigger movimento_da_producao
  before insert or update or delete on public.producao_movimentos
  for each row execute function public.movimento_da_producao();

-- Auditoria da Produção. A lista é pessoal até o médico enviá-la, e a
-- auditoria é lida pela administração: por isso só se registra o que já foi
-- ENVIADO ao Financeiro, e sem o nome do paciente. Antes do envio, as
-- mudanças são o rascunho do próprio médico.
create or replace function public.audita_honorario_da_producao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  campos text[] := array['convenio','data','local_id','urgencia','valor','situacao',
    'honorario_situacao','honorario_valor_previsto','honorario_pendencias','contrato_versao_id',
    'conferido_por','conferido_em','valor_faturado','valor_recebido','glosa_valor','glosa_motivo',
    'glosa_recurso_status'];
  v_velho jsonb := '{}'::jsonb;
  v_novo jsonb := '{}'::jsonb;
  c text;
begin
  if new.enviado_em is null and old.enviado_em is null then
    return new;
  end if;
  foreach c in array campos loop
    if (to_jsonb(old)->c) is distinct from (to_jsonb(new)->c) then
      v_velho := v_velho || jsonb_build_object(c, to_jsonb(old)->c);
      v_novo := v_novo || jsonb_build_object(c, to_jsonb(new)->c);
    end if;
  end loop;
  if v_novo = '{}'::jsonb then
    return new;
  end if;
  insert into public.auditoria (
    institution_id, actor_id, user_id, tabela, entidade, entidade_id, registro_id,
    acao, detalhes, dados_anteriores, dados_novos
  ) values (
    new.institution_id, auth.uid(), auth.uid(), 'producao_do_dia', 'producao_do_dia', new.id, new.id,
    'update', jsonb_build_object('modulo', 'honorarios', 'perfil_id', new.perfil_id), v_velho, v_novo
  );
  return new;
end;
$$;
drop trigger if exists audita_honorario_da_producao on public.producao_do_dia;
create trigger audita_honorario_da_producao
  after update on public.producao_do_dia
  for each row execute function public.audita_honorario_da_producao();

drop trigger if exists audita_producao_movimentos on public.producao_movimentos;
create trigger audita_producao_movimentos
  after insert on public.producao_movimentos
  for each row execute function public.audita_honorarios();

-- Funções de gatilho: só rodam como gatilho, e não ficam ao alcance da API.
revoke execute on function public.protege_honorario_da_producao(), public.procedimento_da_producao(),
  public.movimento_da_producao(), public.audita_honorario_da_producao() from public, anon, authenticated;

alter table public.producao_procedimentos enable row level security;
alter table public.producao_movimentos enable row level security;
revoke all on public.producao_procedimentos, public.producao_movimentos from anon;

-- Os procedimentos seguem a regra da Produção: do médico, e lidos por quem
-- fatura só depois do envio.
drop policy if exists "so_os_meus_procedimentos" on public.producao_procedimentos;
create policy "so_os_meus_procedimentos" on public.producao_procedimentos
  for all to authenticated
  using (institution_id = public.current_institution_id() and perfil_id = auth.uid())
  with check (institution_id = public.current_institution_id() and perfil_id = auth.uid()
              and exists (select 1 from public.producao_do_dia p
                           where p.id = producao_id and p.perfil_id = auth.uid()));
drop policy if exists "financeiro_le_procedimentos_enviados" on public.producao_procedimentos;
create policy "financeiro_le_procedimentos_enviados" on public.producao_procedimentos
  for select to authenticated
  using (institution_id = public.current_institution_id()
         and public.current_has_permission('financeiro')
         and exists (select 1 from public.producao_do_dia p
                      where p.id = producao_id and p.enviado_em is not null));

-- Movimentos: o médico lê os da sua produção; quem fatura lê e lança os da
-- produção enviada. Não há política de update nem de delete.
drop policy if exists "medico_le_os_seus_movimentos" on public.producao_movimentos;
create policy "medico_le_os_seus_movimentos" on public.producao_movimentos
  for select to authenticated
  using (exists (select 1 from public.producao_do_dia p
                  where p.id = producao_id and p.perfil_id = auth.uid()
                    and p.institution_id = public.current_institution_id()));
drop policy if exists "financeiro_le_movimentos" on public.producao_movimentos;
create policy "financeiro_le_movimentos" on public.producao_movimentos
  for select to authenticated
  using (institution_id = public.current_institution_id()
         and public.current_has_permission('financeiro'));
drop policy if exists "financeiro_lanca_movimentos" on public.producao_movimentos;
create policy "financeiro_lanca_movimentos" on public.producao_movimentos
  for insert to authenticated
  with check (public.current_has_permission('financeiro')
              and created_by = auth.uid()
              and exists (select 1 from public.producao_do_dia p
                           where p.id = producao_id and p.enviado_em is not null
                             and p.institution_id = public.current_institution_id()));
