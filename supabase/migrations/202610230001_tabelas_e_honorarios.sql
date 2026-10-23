-- ============================================================================
-- Tabelas e honorários anestésicos — a base de dados, parte 1 de 3: TUSS,
-- CBHPM e correspondências (partes 2 e 3: 202610230002 e 202610230003)
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
-- RLS da CBHPM e das correspondências: só quem tem o Financeiro na própria
-- organização (as tabelas de contrato ligam o mesmo, na parte 2)
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'cbhpm_edicoes', 'cbhpm_procedimentos', 'cbhpm_portes', 'tuss_cbhpm_correspondencias'
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
