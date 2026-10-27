-- ============================================================================
-- Tabelas e honorários — parte 4: o código sai no Financeiro.
--
-- O anestesiologista anota o procedimento como escreve na ficha, marca a
-- urgência e as marcas da clínica (um bloqueio, um cateter...), e envia. No
-- Financeiro, o código TUSS sai pelo nome do procedimento (a lista da
-- clínica, que o próprio Financeiro vai ensinando a cada conferência) e cada
-- marca puxa o código dela. Depende das partes 1 a 3. Só acrescenta.
-- ============================================================================

-- ── 1. Procedimentos da clínica: o nome escrito na ficha → os códigos TUSS ──
-- A chave é o nome sem acento, caixa e espaços repetidos (nomeSimples, em
-- lib/honorarios.ts): "Colecistectomia  videolaparoscópica" e
-- "COLECISTECTOMIA VIDEOLAPAROSCOPICA" são o mesmo procedimento.
create table if not exists public.procedimentos_da_clinica (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  chave text not null check (length(chave) between 1 and 200),
  nome text not null check (length(btrim(nome)) between 1 and 200),
  -- Os códigos na ordem do cálculo (o principal primeiro): [{codigo, descricao}].
  codigos jsonb not null check (jsonb_typeof(codigos) = 'array'
    and jsonb_array_length(codigos) between 1 and 20),
  atualizado_por uuid references public.perfis(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, chave)
);

-- ── 2. Marcas da clínica: o que o médico marca e que puxa um código a mais ──
create table if not exists public.marcas_da_clinica (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 60),
  tuss_codigo text not null check (tuss_codigo ~ '^[0-9]+$'),
  descricao text,
  -- Desativada some da Produção, mas continua explicando os cálculos antigos.
  ativo boolean not null default true,
  ordem smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, nome)
);

-- ── 3. As marcas de cada anestesia ──────────────────────────────────────────
alter table public.producao_do_dia
  add column if not exists marcas uuid[] not null default '{}'
    check (cardinality(marcas) <= 10);

-- Mudar as marcas muda a conta, como a urgência: o cálculo anterior é
-- desfeito. A função é a mesma da parte 3, com as marcas na última regra.
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
       or new.local_id is distinct from old.local_id or new.urgencia is distinct from old.urgencia
       or new.marcas is distinct from old.marcas) then
    new.honorario_situacao := 'nao_calculado';
    new.conferido_por := null;
    new.conferido_em := null;
  end if;
  return new;
end;
$$;

-- Quem mexeu por último na lista, e quando.
create or replace function public.lista_da_clinica_atualizada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_table_name = 'procedimentos_da_clinica' then
    new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  end if;
  return new;
end;
$$;
drop trigger if exists procedimento_da_clinica_atualizado on public.procedimentos_da_clinica;
create trigger procedimento_da_clinica_atualizado
  before update on public.procedimentos_da_clinica
  for each row execute function public.lista_da_clinica_atualizada();
drop trigger if exists marca_da_clinica_atualizada on public.marcas_da_clinica;
create trigger marca_da_clinica_atualizada
  before update on public.marcas_da_clinica
  for each row execute function public.lista_da_clinica_atualizada();

-- Auditoria: as listas mudam o código que vai para a cobrança.
drop trigger if exists audita_procedimentos_da_clinica on public.procedimentos_da_clinica;
create trigger audita_procedimentos_da_clinica
  after insert or update or delete on public.procedimentos_da_clinica
  for each row execute function public.audita_honorarios();
drop trigger if exists audita_marcas_da_clinica on public.marcas_da_clinica;
create trigger audita_marcas_da_clinica
  after insert or update or delete on public.marcas_da_clinica
  for each row execute function public.audita_honorarios();

revoke execute on function public.protege_honorario_da_producao(), public.lista_da_clinica_atualizada()
  from public, anon, authenticated;

-- ── 4. Quem lê e quem grava ─────────────────────────────────────────────────
alter table public.procedimentos_da_clinica enable row level security;
alter table public.marcas_da_clinica enable row level security;
revoke all on public.procedimentos_da_clinica, public.marcas_da_clinica from anon;

-- Todos da clínica leem (o médico vê as marcas para marcar, e a sugestão do
-- código); só o Financeiro da clínica grava.
drop policy if exists "a_clinica_le_os_procedimentos" on public.procedimentos_da_clinica;
create policy "a_clinica_le_os_procedimentos" on public.procedimentos_da_clinica
  for select to authenticated
  using (institution_id = public.current_institution_id());
drop policy if exists "financeiro_mantem_os_procedimentos" on public.procedimentos_da_clinica;
create policy "financeiro_mantem_os_procedimentos" on public.procedimentos_da_clinica
  for all to authenticated
  using (public.pode_tabelas_honorarios(institution_id))
  with check (public.pode_tabelas_honorarios(institution_id));

drop policy if exists "a_clinica_le_as_marcas" on public.marcas_da_clinica;
create policy "a_clinica_le_as_marcas" on public.marcas_da_clinica
  for select to authenticated
  using (institution_id = public.current_institution_id());
drop policy if exists "financeiro_mantem_as_marcas" on public.marcas_da_clinica;
create policy "financeiro_mantem_as_marcas" on public.marcas_da_clinica
  for all to authenticated
  using (public.pode_tabelas_honorarios(institution_id))
  with check (public.pode_tabelas_honorarios(institution_id));

-- O Financeiro grava os códigos da anestesia que o médico JÁ ENVIOU, na
-- própria clínica. Antes do envio, a lista continua só do médico.
drop policy if exists "financeiro_codifica_o_que_foi_enviado" on public.producao_procedimentos;
create policy "financeiro_codifica_o_que_foi_enviado" on public.producao_procedimentos
  for all to authenticated
  using (institution_id = public.current_institution_id()
         and public.current_has_permission('financeiro')
         and exists (select 1 from public.producao_do_dia p
                      where p.id = producao_id and p.enviado_em is not null
                        and p.institution_id = public.current_institution_id()))
  with check (institution_id = public.current_institution_id()
              and public.current_has_permission('financeiro')
              and exists (select 1 from public.producao_do_dia p
                           where p.id = producao_id and p.enviado_em is not null
                             and p.institution_id = public.current_institution_id()));
