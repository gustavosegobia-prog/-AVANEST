-- ============================================================================
-- Tabelas e honorários anestésicos — parte 2 de 3: planos de saúde (operadoras),
-- contratos e versões, a tabela do plano, as importações de arquivo e o
-- bucket privado dos arquivos. Depende da parte 1 (202610230001). Só
-- acrescenta; as regras gerais estão no cabeçalho da parte 1.
-- ============================================================================

-- ============================================================================
-- 4. Operadoras, contratos e versões de contrato
--
-- Cada clínica cadastra os seus. O contrato liga uma operadora (o mesmo nome
-- de convênio que já se usa na Produção) a um hospital, quando for o caso.
-- As REGRAS ficam na versão: valores por porte, valores fixos por
-- procedimento, reajuste sobre a referência, urgência, procedimentos
-- múltiplos, adicionais e redutores, vigência. Não há fórmula universal:
-- cada versão diz a sua, e o que ela não disser vira pendência no cálculo.
--
-- Versão em rascunho se edita à vontade. Publicada ("vigente"), não muda —
-- só se encerra. Reajuste é versão nova; a antiga continua explicando o que
-- foi calculado com ela.
-- ============================================================================

create table if not exists public.operadoras (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  nome_chave text generated always as (public.nome_simples(nome)) stored,
  particular boolean not null default false,
  ativo boolean not null default true,
  created_by uuid default auth.uid() references public.perfis(id),
  created_at timestamptz not null default now()
);
create unique index if not exists operadora_uma_por_nome
  on public.operadoras (institution_id, nome_chave);

create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  operadora_id uuid not null references public.operadoras(id) on delete restrict,
  identificacao text not null check (btrim(identificacao) <> ''),
  -- O hospital, quando o contrato vale só nele. Vazio: vale em qualquer um.
  local_id uuid references public.locais_atendimento(id) on delete restrict,
  ativo boolean not null default true,
  created_by uuid default auth.uid() references public.perfis(id),
  created_at timestamptz not null default now(),
  unique (institution_id, operadora_id, identificacao)
);

create table if not exists public.contrato_versoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete restrict,
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  versao integer not null check (versao > 0),
  vigencia_inicio date not null,
  vigencia_fim date,
  -- 'cbhpm': os portes sem valor negociado usam o valor de referência da
  -- edição indicada, com o reajuste da versão. 'propria': só vale o que a
  -- versão lista — porte ou procedimento fora da lista fica pendente.
  referencia text not null check (referencia in ('cbhpm', 'propria')),
  cbhpm_edicao_id uuid references public.cbhpm_edicoes(id) on delete restrict,
  reajuste_percentual numeric(7,2) not null default 0 check (reajuste_percentual > -100),
  -- Vazio: o contrato não prevê urgência; a anestesia de urgência fica pendente.
  urgencia_percentual numeric(7,2) check (urgencia_percentual is null or urgencia_percentual > -100),
  -- Percentual de cada procedimento por ordem de valor (o maior primeiro):
  -- {100,50} paga o 1º inteiro e os demais pela metade. Vazio: o contrato não
  -- diz, e mais de um procedimento na mesma anestesia fica pendente.
  multiplos_percentuais numeric(7,2)[]
    check (multiplos_percentuais is null or (cardinality(multiplos_percentuais) between 1 and 20
           and 0 <= all (multiplos_percentuais) and 1000 >= all (multiplos_percentuais))),
  -- Adicionais (+) e redutores (−): [{"nome": "...", "tipo": "percentual"|"fixo",
  -- "valor": 10, "quando": "sempre"|"urgencia"}]. Conferidos em lib/honorarios.ts.
  ajustes jsonb not null default '[]'::jsonb check (jsonb_typeof(ajustes) = 'array'),
  -- Os percentuais se somam sobre a mesma base (falso) ou um sobre o outro (verdadeiro).
  ajustes_cumulativos boolean not null default false,
  situacao text not null default 'rascunho' check (situacao in ('rascunho', 'vigente', 'encerrada')),
  observacoes text,
  publicada_por uuid references public.perfis(id),
  publicada_em timestamptz,
  created_by uuid default auth.uid() references public.perfis(id),
  created_at timestamptz not null default now(),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio),
  check (referencia <> 'cbhpm' or cbhpm_edicao_id is not null),
  unique (contrato_id, versao)
);

create table if not exists public.contrato_valores_porte (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.contrato_versoes(id) on delete restrict,
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  porte smallint not null check (porte between 0 and 8),
  valor numeric(12,2) not null check (valor >= 0),
  unique (versao_id, porte)
);

-- A tabela do plano de saúde, código a código: o porte anestésico que o
-- plano dá ao procedimento (vale antes da correspondência com a CBHPM) e/ou
-- um valor fixo de honorário. A descrição é a que veio na tabela do plano;
-- a oficial continua sendo a da TUSS.
create table if not exists public.contrato_valores_procedimento (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.contrato_versoes(id) on delete restrict,
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  tuss_codigo text not null check (tuss_codigo ~ '^[0-9]+$'),
  descricao text,
  porte_anestesico smallint check (porte_anestesico between 0 and 8),
  valor numeric(12,2) check (valor >= 0),
  check (valor is not null or porte_anestesico is not null),
  unique (versao_id, tuss_codigo)
);

-- A organização vem do pai, e a versão publicada não muda.
create or replace function public.contrato_versao_protegida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.situacao <> 'rascunho' then
      raise exception 'Versão de contrato publicada não se apaga: encerre-a, e ela continua explicando o que foi calculado.';
    end if;
    return old;
  end if;
  new.institution_id := (select institution_id from public.contratos where id = new.contrato_id);
  if new.cbhpm_edicao_id is not null and not exists (
       select 1 from public.cbhpm_edicoes e where e.id = new.cbhpm_edicao_id and e.institution_id = new.institution_id) then
    raise exception 'A edição da CBHPM do contrato precisa ser da mesma organização.';
  end if;
  if tg_op = 'UPDATE' and old.situacao <> 'rascunho' then
    if old.situacao = 'encerrada' then
      raise exception 'Versão de contrato encerrada não muda: crie uma versão nova.';
    end if;
    -- Vigente: só se encerra, e o fim da vigência pode ser marcado.
    if new.situacao not in ('vigente', 'encerrada')
       or (to_jsonb(new) - array['situacao','vigencia_fim'])
          is distinct from (to_jsonb(old) - array['situacao','vigencia_fim']) then
      raise exception 'Versão de contrato publicada não muda: para reajustar, crie uma versão nova.';
    end if;
    if new.vigencia_fim is not null and new.vigencia_fim < new.vigencia_inicio then
      raise exception 'O fim da vigência não pode ser antes do início.';
    end if;
  end if;
  if new.situacao = 'vigente' and (tg_op = 'INSERT' or old.situacao = 'rascunho') then
    -- Duas versões do mesmo contrato não valem no mesmo dia.
    if exists (
      select 1 from public.contrato_versoes v
       where v.contrato_id = new.contrato_id and v.id <> new.id and v.situacao = 'vigente'
         and daterange(v.vigencia_inicio, v.vigencia_fim, '[]')
             && daterange(new.vigencia_inicio, new.vigencia_fim, '[]')) then
      raise exception 'Já há uma versão vigente deste contrato nesse período. Encerre-a ou ajuste a vigência.';
    end if;
    new.publicada_por := coalesce(auth.uid(), new.publicada_por);
    new.publicada_em := now();
  end if;
  return new;
end;
$$;
drop trigger if exists contrato_versao_protegida on public.contrato_versoes;
create trigger contrato_versao_protegida
  before insert or update or delete on public.contrato_versoes
  for each row execute function public.contrato_versao_protegida();

create or replace function public.contrato_valor_da_versao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_situacao text;
begin
  select institution_id, situacao into v_inst, v_situacao from public.contrato_versoes
   where id = case when tg_op = 'DELETE' then old.versao_id else new.versao_id end;
  if v_situacao is distinct from 'rascunho' then
    raise exception 'Os valores de uma versão de contrato publicada não mudam: crie uma versão nova.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.institution_id := v_inst;
  return new;
end;
$$;
drop trigger if exists contrato_valor_porte_da_versao on public.contrato_valores_porte;
create trigger contrato_valor_porte_da_versao
  before insert or update or delete on public.contrato_valores_porte
  for each row execute function public.contrato_valor_da_versao();
drop trigger if exists contrato_valor_procedimento_da_versao on public.contrato_valores_procedimento;
create trigger contrato_valor_procedimento_da_versao
  before insert or update or delete on public.contrato_valores_procedimento
  for each row execute function public.contrato_valor_da_versao();

create or replace function public.contrato_da_operadora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select institution_id from public.operadoras where id = new.operadora_id) is distinct from new.institution_id then
    raise exception 'A operadora do contrato precisa ser da mesma organização.';
  end if;
  if new.local_id is not null and (select institution_id from public.locais_atendimento where id = new.local_id)
     is distinct from new.institution_id then
    raise exception 'O hospital do contrato precisa ser da mesma organização.';
  end if;
  return new;
end;
$$;
drop trigger if exists contrato_da_operadora on public.contratos;
create trigger contrato_da_operadora
  before insert or update on public.contratos
  for each row execute function public.contrato_da_operadora();

-- ============================================================================
-- 5. Importações de arquivo
--
-- Todo arquivo importado (TUSS, CBHPM, contrato, correspondências) fica
-- registrado: nome, impressão digital, onde foi guardado, quantas linhas
-- valeram e quais deram erro. Primeiro a prévia; só depois de conferida a
-- importação é aplicada. O mesmo arquivo não se aplica duas vezes.
-- ============================================================================

create table if not exists public.importacoes_tabelas (
  id uuid primary key default gen_random_uuid(),
  -- Vazio: importação da plataforma (TUSS).
  institution_id uuid references public.instituicoes(id) on delete cascade,
  tipo text not null check (tipo in ('tuss', 'cbhpm', 'contrato', 'correspondencia')),
  arquivo_nome text not null check (btrim(arquivo_nome) <> ''),
  arquivo_sha256 text not null check (arquivo_sha256 ~ '^[0-9a-f]{64}$'),
  arquivo_caminho text,
  origem text,
  linhas_total integer not null default 0 check (linhas_total >= 0),
  linhas_validas integer not null default 0 check (linhas_validas >= 0),
  erros jsonb not null default '[]'::jsonb check (jsonb_typeof(erros) = 'array'),
  situacao text not null default 'previa' check (situacao in ('previa', 'aplicada', 'descartada')),
  destino_id uuid,
  created_by uuid default auth.uid() references public.perfis(id),
  created_at timestamptz not null default now(),
  aplicada_em timestamptz,
  check ((tipo = 'tuss') = (institution_id is null))
);
create unique index if not exists importacao_aplicada_uma_vez
  on public.importacoes_tabelas (coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo, arquivo_sha256)
  where situacao = 'aplicada';

-- ============================================================================
-- RLS das tabelas da clínica: só quem tem o Financeiro na própria organização
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'operadoras', 'contratos', 'contrato_versoes', 'contrato_valores_porte', 'contrato_valores_procedimento'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "financeiro_da_clinica" on public.%I', t);
    execute format(
      'create policy "financeiro_da_clinica" on public.%I for all to authenticated
         using (public.pode_tabelas_honorarios(institution_id))
         with check (public.pode_tabelas_honorarios(institution_id))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop trigger if exists audita_%s on public.%I', t, t);
    if t <> 'cbhpm_procedimentos' then
      -- Os procedimentos da edição entram aos milhares numa importação, e a
      -- importação já fica registrada inteira; publicada, a edição não muda.
      execute format(
        'create trigger audita_%s after insert or update or delete on public.%I
           for each row execute function public.audita_honorarios()', t, t);
    end if;
  end loop;
end;
$$;

alter table public.importacoes_tabelas enable row level security;
drop policy if exists "importacoes_da_clinica" on public.importacoes_tabelas;
create policy "importacoes_da_clinica" on public.importacoes_tabelas
  for all to authenticated
  using ((institution_id is not null and public.pode_tabelas_honorarios(institution_id))
         or (institution_id is null and public.e_super_admin()))
  with check ((institution_id is not null and public.pode_tabelas_honorarios(institution_id))
              or (institution_id is null and public.e_super_admin()));
revoke all on public.importacoes_tabelas, public.tuss_versoes, public.tuss_codigos from anon;

-- Os arquivos importados: bucket privado, uma pasta por organização e a pasta
-- "tuss" da plataforma. Arquivo importado é registro: não se troca nem apaga.
insert into storage.buckets (id, name, public)
values ('tabelas-honorarios', 'tabelas-honorarios', false)
on conflict (id) do nothing;

drop policy if exists "tabelas_honorarios_le" on storage.objects;
create policy "tabelas_honorarios_le" on storage.objects
  for select to authenticated
  using (bucket_id = 'tabelas-honorarios' and (
    ((storage.foldername(name))[1] = public.current_institution_id()::text
      and public.pode_tabelas_honorarios(public.current_institution_id()))
    or ((storage.foldername(name))[1] = 'tuss' and public.e_super_admin())));
drop policy if exists "tabelas_honorarios_envia" on storage.objects;
create policy "tabelas_honorarios_envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tabelas-honorarios' and (
    ((storage.foldername(name))[1] = public.current_institution_id()::text
      and public.pode_tabelas_honorarios(public.current_institution_id()))
    or ((storage.foldername(name))[1] = 'tuss' and public.e_super_admin())));
