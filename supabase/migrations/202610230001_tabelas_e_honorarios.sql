-- ============================================================================
-- Tabelas e honorários anestésicos — a base de dados (etapa 1)
--
-- Pedido de 23/10/2026: códigos TUSS (ANS), portes anestésicos da CBHPM,
-- contratos por convênio e o honorário previsto de cada anestesia da
-- Produção, com conferência antes de ir ao Financeiro. Esta migração só
-- ACRESCENTA: nenhuma tabela ou coluna existente é apagada ou muda de
-- sentido, e o caminho atual — ficha encerrada → Produção → envio ao
-- Financeiro — continua igual. O cálculo é feito fora daqui
-- (lib/honorarios.ts); o banco guarda o resultado e impede que ele seja
-- escrito à mão.
--
-- QUATRO REGRAS que atravessam o arquivo:
--
-- 1. Nada se inventa. A TUSS vem do arquivo oficial da ANS; a CBHPM, do
--    arquivo licenciado da clínica ou de cadastro manual — com a fonte
--    registrada em cada edição. Nenhum código, porte ou valor nasce aqui.
--
-- 2. Nada se reescreve. Tabela publicada não muda: muda-se publicando outra
--    versão. A TUSS nova não apaga a antiga; o contrato reajustado é uma
--    versão nova do contrato. Assim o honorário calculado em março continua
--    explicável em dezembro — ele guarda a versão que usou (honorario_calculo).
--
-- 3. Cada clínica vê só o que é dela. A TUSS é pública e de todos; CBHPM,
--    correspondências, operadoras e contratos são por organização, com RLS,
--    e só para quem tem o Financeiro (pode_tabelas_honorarios).
--
-- 4. A Produção continua pessoal. O honorário é gravado na linha do médico
--    pelo cálculo (service role, ou função com a marca avanest.honorarios),
--    e não pela tela: um trigger recusa quem tentar escrevê-lo à mão. A
--    tabela de preços do contrato nunca é aberta para o médico.
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Apoio
-- ---------------------------------------------------------------------------

-- O nome do convênio é texto em todo o sistema ("Unimed", "UNIMED ", "unimed
-- campo mourão"). Para ligar a Produção ao contrato, compara-se a forma
-- simples: minúscula, sem acento, só letras e números.
create or replace function public.nome_simples(p text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p, '')),
      'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

-- Quem cuida das tabelas e contratos: quem tem o Financeiro na própria
-- organização, com o módulo contratado. Proprietário e administrador entram
-- por current_has_permission.
create or replace function public.pode_tabelas_honorarios(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_institution_id is not null
     and p_institution_id = public.current_institution_id()
     and public.current_has_permission('financeiro')
     and public.modulo_liberado('financeiro');
$$;
revoke all on function public.pode_tabelas_honorarios(uuid) from public, anon;
grant execute on function public.pode_tabelas_honorarios(uuid) to authenticated;

-- Auditoria de tudo o que muda nas tabelas: quem, quando, antes e depois.
-- Um trigger só para as tabelas de configuração; a Produção tem o seu, mais
-- abaixo, porque lá a privacidade pesa.
create or replace function public.audita_honorarios()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novo jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_velho jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_linha jsonb := coalesce(v_novo, v_velho);
  v_inst uuid := nullif(v_linha->>'institution_id', '')::uuid;
  v_id uuid := nullif(v_linha->>'id', '')::uuid;
begin
  insert into public.auditoria (
    institution_id, actor_id, user_id, tabela, entidade, entidade_id, registro_id,
    acao, detalhes, dados_anteriores, dados_novos
  ) values (
    v_inst, auth.uid(), auth.uid(), tg_table_name, tg_table_name, v_id, v_id,
    lower(tg_op), jsonb_build_object('modulo', 'honorarios'), v_velho, v_novo
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.audita_honorarios() from public, anon, authenticated;

-- ============================================================================
-- 1. TUSS — Terminologia Unificada da Saúde Suplementar (ANS)
--
-- De todos, e só leitura para as clínicas: é o vocabulário nacional, publicado
-- pela ANS (Tabela 22 — procedimentos). Quem importa é a plataforma
-- (super-admin), do arquivo oficial, registrando versão, data, origem e a
-- impressão digital do arquivo. Versão em conferência pode ser corrigida;
-- publicada, não muda mais — a próxima atualização é outra versão, e a
-- anterior fica como "substituída", para o que já foi calculado com ela.
-- ============================================================================

create table if not exists public.tuss_versoes (
  id uuid primary key default gen_random_uuid(),
  tabela text not null default '22' check (tabela ~ '^[0-9]{2}$'),
  versao text not null check (btrim(versao) <> ''),
  publicada_em date,
  origem text not null check (btrim(origem) <> ''),
  arquivo_nome text,
  arquivo_sha256 text check (arquivo_sha256 is null or arquivo_sha256 ~ '^[0-9a-f]{64}$'),
  arquivo_caminho text,
  situacao text not null default 'em_conferencia'
    check (situacao in ('em_conferencia', 'vigente', 'substituida')),
  total_codigos integer not null default 0 check (total_codigos >= 0),
  importada_por uuid references public.perfis(id),
  importada_em timestamptz not null default now(),
  vigente_desde timestamptz,
  unique (tabela, versao)
);
create unique index if not exists tuss_uma_vigente_por_tabela
  on public.tuss_versoes (tabela) where situacao = 'vigente';

create table if not exists public.tuss_codigos (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.tuss_versoes(id) on delete restrict,
  codigo text not null check (codigo ~ '^[0-9]+$'),
  -- A descrição oficial, como a ANS publicou. Não se corrige grafia aqui.
  descricao text not null check (btrim(descricao) <> ''),
  inicio_vigencia date,
  fim_vigencia date,
  fim_implantacao date,
  situacao text not null default 'ativo' check (situacao in ('ativo', 'inativo', 'substituido')),
  substituido_por text check (substituido_por is null or substituido_por ~ '^[0-9]+$'),
  -- Um código uma vez por versão: a duplicidade é recusada pelo banco.
  unique (versao_id, codigo)
);
create index if not exists tuss_codigos_por_codigo
  on public.tuss_codigos (codigo text_pattern_ops);
create index if not exists tuss_codigos_por_descricao
  on public.tuss_codigos using gin (descricao extensions.gin_trgm_ops);

-- Versão publicada não muda; os códigos dela também não.
create or replace function public.tuss_versao_protegida()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.situacao <> 'em_conferencia' then
      raise exception 'Versão da TUSS publicada não se apaga: ela explica os honorários calculados com ela.';
    end if;
    return old;
  end if;
  if old.situacao = 'substituida' and new.situacao <> 'substituida' then
    raise exception 'Versão da TUSS substituída não volta a valer: importe uma versão nova.';
  end if;
  if old.situacao = 'vigente' and new.situacao = 'em_conferencia' then
    raise exception 'Versão da TUSS publicada não volta para conferência.';
  end if;
  if old.situacao <> 'em_conferencia' and (
       new.tabela is distinct from old.tabela or new.versao is distinct from old.versao
       or new.origem is distinct from old.origem or new.arquivo_sha256 is distinct from old.arquivo_sha256
       or new.publicada_em is distinct from old.publicada_em) then
    raise exception 'Versão da TUSS publicada não muda: a origem e o arquivo ficam como foram importados.';
  end if;
  return new;
end;
$$;
drop trigger if exists tuss_versao_protegida on public.tuss_versoes;
create trigger tuss_versao_protegida
  before update or delete on public.tuss_versoes
  for each row execute function public.tuss_versao_protegida();

create or replace function public.tuss_codigo_protegido()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_situacao text;
begin
  select situacao into v_situacao from public.tuss_versoes
   where id = case when tg_op = 'DELETE' then old.versao_id else new.versao_id end;
  if v_situacao is distinct from 'em_conferencia' then
    raise exception 'Os códigos de uma versão da TUSS publicada não mudam: importe uma versão nova.';
  end if;
  if tg_op = 'UPDATE' and new.versao_id <> old.versao_id then
    raise exception 'Um código não troca de versão.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists tuss_codigo_protegido on public.tuss_codigos;
create trigger tuss_codigo_protegido
  before insert or update or delete on public.tuss_codigos
  for each row execute function public.tuss_codigo_protegido();

drop trigger if exists audita_tuss_versoes on public.tuss_versoes;
create trigger audita_tuss_versoes
  after insert or update or delete on public.tuss_versoes
  for each row execute function public.audita_honorarios();

-- Publicar: a versão em conferência passa a valer e a anterior vira
-- "substituída" — as duas continuam no banco.
create or replace function public.publicar_versao_tuss(p_versao_id uuid)
returns public.tuss_versoes
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.tuss_versoes;
begin
  if not public.e_super_admin() then
    raise exception 'Só a plataforma publica uma versão da TUSS.';
  end if;
  select * into v from public.tuss_versoes where id = p_versao_id for update;
  if v.id is null then raise exception 'Versão da TUSS não encontrada.'; end if;
  if v.situacao <> 'em_conferencia' then raise exception 'Esta versão já foi publicada.'; end if;
  if not exists (select 1 from public.tuss_codigos where versao_id = v.id) then
    raise exception 'Versão sem códigos não se publica.';
  end if;
  update public.tuss_versoes set situacao = 'substituida'
   where tabela = v.tabela and situacao = 'vigente';
  update public.tuss_versoes
     set situacao = 'vigente', vigente_desde = now(),
         total_codigos = (select count(*) from public.tuss_codigos where versao_id = v.id)
   where id = v.id
  returning * into v;
  return v;
end;
$$;
revoke all on function public.publicar_versao_tuss(uuid) from public, anon;
grant execute on function public.publicar_versao_tuss(uuid) to authenticated;

alter table public.tuss_versoes enable row level security;
alter table public.tuss_codigos enable row level security;

drop policy if exists "todos_leem_a_tuss" on public.tuss_versoes;
create policy "todos_leem_a_tuss" on public.tuss_versoes
  for select to authenticated using (true);
drop policy if exists "plataforma_mantem_a_tuss" on public.tuss_versoes;
create policy "plataforma_mantem_a_tuss" on public.tuss_versoes
  for all to authenticated using (public.e_super_admin()) with check (public.e_super_admin());

drop policy if exists "todos_leem_os_codigos" on public.tuss_codigos;
create policy "todos_leem_os_codigos" on public.tuss_codigos
  for select to authenticated using (true);
drop policy if exists "plataforma_mantem_os_codigos" on public.tuss_codigos;
create policy "plataforma_mantem_os_codigos" on public.tuss_codigos
  for all to authenticated using (public.e_super_admin()) with check (public.e_super_admin());

-- ============================================================================
-- 2. CBHPM — edições e portes anestésicos (AN0 a AN8), por organização
--
-- A CBHPM é da AMB e tem direitos de uso: cada clínica cadastra a SUA, do
-- arquivo que licenciou ou à mão, e a fonte vai registrada na edição.
-- Nenhuma clínica lê a CBHPM de outra.
-- ============================================================================

create table if not exists public.cbhpm_edicoes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  nome text not null check (btrim(nome) <> ''),
  edicao text not null check (btrim(edicao) <> ''),
  ano smallint check (ano between 1990 and 2100),
  -- De onde veio: "arquivo licenciado CBHPM 2022 (AMB)", "cadastro manual"…
  fonte text not null check (btrim(fonte) <> ''),
  licenca text,
  vigencia_inicio date,
  vigencia_fim date,
  situacao text not null default 'em_conferencia'
    check (situacao in ('em_conferencia', 'vigente', 'encerrada')),
  arquivo_nome text,
  arquivo_sha256 text check (arquivo_sha256 is null or arquivo_sha256 ~ '^[0-9a-f]{64}$'),
  arquivo_caminho text,
  created_by uuid default auth.uid() references public.perfis(id),
  created_at timestamptz not null default now(),
  check (vigencia_fim is null or vigencia_inicio is null or vigencia_fim >= vigencia_inicio),
  unique (institution_id, edicao)
);

create table if not exists public.cbhpm_procedimentos (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.cbhpm_edicoes(id) on delete restrict,
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  codigo text not null check (btrim(codigo) <> ''),
  descricao text not null check (btrim(descricao) <> ''),
  -- AN0 a AN8. Vazio: a edição não dá porte anestésico a este procedimento,
  -- e o cálculo diz isso em vez de supor um.
  porte_anestesico smallint check (porte_anestesico between 0 and 8),
  unique (edicao_id, codigo)
);
create index if not exists cbhpm_procedimentos_por_codigo
  on public.cbhpm_procedimentos (institution_id, codigo);

-- O valor de referência de cada porte, quando a clínica tem autorização para
-- cadastrá-lo. Sem linha aqui, não há valor de referência — e o contrato que
-- dependa dele fica pendente.
create table if not exists public.cbhpm_portes (
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.cbhpm_edicoes(id) on delete restrict,
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  porte smallint not null check (porte between 0 and 8),
  valor_referencia numeric(12,2) not null check (valor_referencia >= 0),
  unidade text not null default 'R$' check (btrim(unidade) <> ''),
  vigencia_inicio date not null,
  fonte text not null check (btrim(fonte) <> ''),
  created_at timestamptz not null default now(),
  unique (edicao_id, porte, vigencia_inicio)
);

-- A organização de cada linha é a da edição: não se escolhe à mão.
create or replace function public.cbhpm_linha_da_edicao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inst uuid;
  v_situacao text;
begin
  select institution_id, situacao into v_inst, v_situacao from public.cbhpm_edicoes
   where id = case when tg_op = 'DELETE' then old.edicao_id else new.edicao_id end;
  if v_situacao is distinct from 'em_conferencia' then
    raise exception 'Edição da CBHPM publicada não muda: cadastre uma edição nova.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.institution_id := v_inst;
  return new;
end;
$$;
drop trigger if exists cbhpm_procedimento_da_edicao on public.cbhpm_procedimentos;
create trigger cbhpm_procedimento_da_edicao
  before insert or update or delete on public.cbhpm_procedimentos
  for each row execute function public.cbhpm_linha_da_edicao();
drop trigger if exists cbhpm_porte_da_edicao on public.cbhpm_portes;
create trigger cbhpm_porte_da_edicao
  before insert or update or delete on public.cbhpm_portes
  for each row execute function public.cbhpm_linha_da_edicao();

create or replace function public.cbhpm_edicao_protegida()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.situacao <> 'em_conferencia' then
      raise exception 'Edição da CBHPM publicada não se apaga: ela explica os honorários calculados com ela.';
    end if;
    return old;
  end if;
  if old.situacao <> 'em_conferencia' then
    if new.situacao = 'em_conferencia' then
      raise exception 'Edição da CBHPM publicada não volta para conferência.';
    end if;
    if new.edicao is distinct from old.edicao or new.fonte is distinct from old.fonte
       or new.arquivo_sha256 is distinct from old.arquivo_sha256
       or new.institution_id is distinct from old.institution_id
       or new.vigencia_inicio is distinct from old.vigencia_inicio then
      raise exception 'Edição da CBHPM publicada não muda: só se encerra.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists cbhpm_edicao_protegida on public.cbhpm_edicoes;
create trigger cbhpm_edicao_protegida
  before update or delete on public.cbhpm_edicoes
  for each row execute function public.cbhpm_edicao_protegida();

-- ============================================================================
-- 3. Correspondência TUSS ↔ CBHPM
--
-- Os dois códigos nem sempre coincidem, e o sistema não supõe que coincidam.
-- Cada ligação é registrada, proposta e VALIDADA por alguém; só a validada
-- entra no cálculo. Mudar uma ligação é revogar a antiga e validar outra — o
-- histórico fica.
-- ============================================================================

create table if not exists public.tuss_cbhpm_correspondencias (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  tuss_codigo text not null check (tuss_codigo ~ '^[0-9]+$'),
  tuss_versao_id uuid references public.tuss_versoes(id) on delete restrict,
  cbhpm_edicao_id uuid not null references public.cbhpm_edicoes(id) on delete restrict,
  cbhpm_codigo text not null check (btrim(cbhpm_codigo) <> ''),
  situacao text not null default 'proposta' check (situacao in ('proposta', 'validada', 'revogada')),
  origem text not null check (btrim(origem) <> ''),
  validada_por uuid references public.perfis(id),
  validada_em timestamptz,
  revogada_por uuid references public.perfis(id),
  revogada_em timestamptz,
  created_by uuid default auth.uid() references public.perfis(id),
  created_at timestamptz not null default now(),
  check (situacao <> 'validada' or (validada_por is not null and validada_em is not null)),
  check (situacao <> 'revogada' or (revogada_por is not null and revogada_em is not null))
);
-- Uma ligação validada por código TUSS em cada edição da CBHPM.
create unique index if not exists correspondencia_uma_validada
  on public.tuss_cbhpm_correspondencias (institution_id, tuss_codigo, cbhpm_edicao_id)
  where situacao = 'validada';

create or replace function public.correspondencia_protegida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.situacao <> 'proposta' then
      raise exception 'Correspondência validada não se apaga: revogue-a, e o histórico fica.';
    end if;
    return old;
  end if;
  new.institution_id := (select institution_id from public.cbhpm_edicoes where id = new.cbhpm_edicao_id);
  if tg_op = 'UPDATE' then
    if old.situacao = 'revogada' then
      raise exception 'Correspondência revogada não volta: cadastre outra.';
    end if;
    if old.situacao = 'validada' and new.situacao <> 'revogada' then
      raise exception 'Correspondência validada só pode ser revogada.';
    end if;
    if old.situacao <> 'proposta' and (new.tuss_codigo is distinct from old.tuss_codigo
       or new.cbhpm_codigo is distinct from old.cbhpm_codigo
       or new.cbhpm_edicao_id is distinct from old.cbhpm_edicao_id) then
      raise exception 'Os códigos de uma correspondência validada não mudam.';
    end if;
  end if;
  -- Quem validou e quando: carimbado pelo banco, e não informado pela tela.
  if new.situacao = 'validada' and (tg_op = 'INSERT' or old.situacao = 'proposta') then
    new.validada_por := coalesce(auth.uid(), new.validada_por);
    new.validada_em := now();
  end if;
  if new.situacao = 'revogada' and (tg_op = 'INSERT' or old.situacao <> 'revogada') then
    new.revogada_por := coalesce(auth.uid(), new.revogada_por);
    new.revogada_em := now();
  end if;
  return new;
end;
$$;
drop trigger if exists correspondencia_protegida on public.tuss_cbhpm_correspondencias;
create trigger correspondencia_protegida
  before insert or update or delete on public.tuss_cbhpm_correspondencias
  for each row execute function public.correspondencia_protegida();

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
    'cbhpm_edicoes', 'cbhpm_procedimentos', 'cbhpm_portes', 'tuss_cbhpm_correspondencias',
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
