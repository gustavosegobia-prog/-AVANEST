-- Evolução Anestésica Digital — o banco.
--
-- ============================================================================
-- O DESENHO, EM TRÊS IDEIAS
-- ============================================================================
-- 1. A FOLHA (evolucoes_anestesicas) guarda o que é de preencher uma vez:
--    cabeçalho, pré-anestésica conferida, técnica, equipe, alta. É um JSON com
--    lock_version, o mesmo arranjo da avaliação pré-anestésica — e cada
--    gravação deixa na auditoria QUAIS campos mudaram, de quê para quê e quem.
--
-- 2. TUDO O QUE ACONTECE NO TEMPO vai para evolucao_registros, e esta tabela
--    NÃO ACEITA UPDATE NEM DELETE. Sinal vital, medicamento, infusão, gás,
--    líquido, evento: cada um é uma linha com horário clínico e autor.
--    Corrigir é inserir uma linha nova com `substitui_id` apontando a velha;
--    excluir é inserir uma linha `anulado` apontando a velha, com motivo. O
--    estado atual da folha são as linhas que ninguém substituiu. O histórico
--    completo não precisa de tabela de auditoria à parte: ele É a tabela.
--
--    Isso resolve de graça três coisas que o prompt pede:
--      • exclusão e correção auditáveis, sem exclusão silenciosa;
--      • salvamento sem perda: o aparelho gera o id, e reenviar a mesma linha
--        depois de uma queda de conexão não duplica (chave primária);
--      • edição por duas pessoas: lançamentos novos nunca conflitam, e duas
--        correções do MESMO ponto ao mesmo tempo esbarram no índice único de
--        `substitui_id` — uma entra, a outra recebe conflito e recarrega.
--
-- 3. O SERVIDOR VALIDA E RECALCULA. Faixa plausível de cada sinal, unidades,
--    coerência entre dose, concentração e volume, mg/kg pelo peso da folha.
--    Dado inválido não entra, mesmo que alguém chame a API sem a tela.
--
-- ============================================================================
-- QUEM VÊ
-- ============================================================================
-- Enquanto o módulo amadurece, só o super-admin (perfis.super_admin). Liberar
-- para todos é UMA linha:
--     update recursos_liberados set liberado = true
--      where codigo = 'evolucao_anestesica';
-- Mesmo liberado, valem as regras de sempre: só a própria instituição, e só
-- quem tem acesso clínico (médico, administrador, proprietário).
--
-- ============================================================================
-- REGRAS DE DOSE
-- ============================================================================
-- regras_de_dose nasce VAZIA. Nenhum valor de dose é escrito aqui ou no
-- código: cada regra entra com fonte, edição, página, revisor e versão, e só
-- vale para o alerta quando `aprovada`. Sem regra aprovada, a tela diz
-- "Referência de dose indisponível para esta situação" — e não declara a dose
-- segura.

-- ---------------------------------------------------------------------------
-- A trava de liberação
-- ---------------------------------------------------------------------------
create table if not exists public.recursos_liberados (
  codigo text primary key,
  liberado boolean not null default false,
  atualizado_em timestamptz not null default now()
);
alter table public.recursos_liberados enable row level security;
-- Sem política: só as funções abaixo (security definer) leem.
insert into public.recursos_liberados(codigo, liberado)
values ('evolucao_anestesica', false)
on conflict (codigo) do nothing;

create or replace function public.evolucao_liberada()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.status = 'ativo'
      and (p.super_admin
           or exists (select 1 from public.recursos_liberados r
                      where r.codigo = 'evolucao_anestesica' and r.liberado))
  );
$$;
revoke all on function public.evolucao_liberada() from public;
grant execute on function public.evolucao_liberada() to authenticated;

-- Quem pode mexer numa folha desta instituição: liberado + clínico + mesma casa.
create or replace function public.pode_evolucao(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_institution_id is not null
     and p_institution_id = public.current_institution_id()
     and public.current_has_permission('medico')
     and public.evolucao_liberada();
$$;
revoke all on function public.pode_evolucao(uuid) from public;
grant execute on function public.pode_evolucao(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- A folha
-- ---------------------------------------------------------------------------
create table if not exists public.evolucoes_anestesicas (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id),
  patient_id uuid not null references public.pacientes(id),
  avaliacao_id uuid references public.avaliacoes(id),
  status text not null default 'aberta' check (status in ('aberta', 'encerrada')),
  dados jsonb not null default '{}'::jsonb,
  lock_version integer not null default 0,
  versao integer not null default 1,
  intervalo_minutos smallint not null default 5 check (intervalo_minutos in (5, 10, 15)),
  inicio_em timestamptz not null default now(),
  encerrada_em timestamptz,
  encerrada_por uuid references public.perfis(id),
  created_by uuid not null default auth.uid() references public.perfis(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evolucoes_instituicao_idx
  on public.evolucoes_anestesicas(institution_id, created_at desc);
create index if not exists evolucoes_paciente_idx on public.evolucoes_anestesicas(patient_id);
alter table public.evolucoes_anestesicas enable row level security;

create policy "evolucao_le" on public.evolucoes_anestesicas
  for select to authenticated using (public.pode_evolucao(institution_id));
create policy "evolucao_cria" on public.evolucoes_anestesicas
  for insert to authenticated with check (public.pode_evolucao(institution_id));
-- Sem política de UPDATE nem de DELETE: o cabeçalho muda pela função
-- salvar_cabecalho_evolucao (que confere a versão e audita), e o status pelas
-- funções de encerrar e reabrir. Folha clínica não se apaga.

-- Paciente e avaliação têm de ser da mesma instituição da folha; quem cria é
-- quem está logado, e a folha nasce aberta. Nada disso vem do aparelho.
create or replace function public.evolucao_antes_de_criar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := auth.uid();
  new.status := 'aberta';
  new.versao := 1;
  new.lock_version := 0;
  new.encerrada_em := null;
  new.encerrada_por := null;
  if not exists (select 1 from public.pacientes p
                 where p.id = new.patient_id and p.institution_id = new.institution_id) then
    raise exception 'PACIENTE_DE_OUTRA_INSTITUICAO';
  end if;
  if new.avaliacao_id is not null and not exists (
       select 1 from public.avaliacoes a
       where a.id = new.avaliacao_id and a.institution_id = new.institution_id
         and a.patient_id = new.patient_id) then
    raise exception 'AVALIACAO_NAO_CONFERE';
  end if;
  return new;
end;
$$;
drop trigger if exists evolucao_antes_de_criar on public.evolucoes_anestesicas;
create trigger evolucao_antes_de_criar before insert on public.evolucoes_anestesicas
  for each row execute function public.evolucao_antes_de_criar();

-- ---------------------------------------------------------------------------
-- Os registros no tempo — imutáveis
-- ---------------------------------------------------------------------------
create table if not exists public.evolucao_registros (
  id uuid primary key,
  evolucao_id uuid not null references public.evolucoes_anestesicas(id) on delete restrict,
  institution_id uuid not null references public.instituicoes(id),
  tipo text not null check (tipo in ('sinal', 'medicamento', 'infusao', 'gas', 'liquido', 'evento')),
  momento timestamptz not null,
  dados jsonb not null default '{}'::jsonb,
  origem text not null default 'manual' check (origem in ('manual', 'estimado', 'importado')),
  substitui_id uuid references public.evolucao_registros(id),
  anulado boolean not null default false,
  motivo text check (motivo is null or char_length(motivo) <= 300),
  created_by uuid not null default auth.uid() references public.perfis(id),
  created_at timestamptz not null default now(),
  check (not anulado or substitui_id is not null)
);
create index if not exists evolucao_registros_folha_idx
  on public.evolucao_registros(evolucao_id, tipo, momento);
-- Cada linha é substituída no máximo uma vez: é o que transforma duas
-- correções simultâneas do mesmo ponto num conflito, e não em dois "atuais".
create unique index if not exists evolucao_registros_substitui_unico
  on public.evolucao_registros(substitui_id) where substitui_id is not null;
alter table public.evolucao_registros enable row level security;

create policy "registro_le" on public.evolucao_registros
  for select to authenticated using (public.pode_evolucao(institution_id));
create policy "registro_cria" on public.evolucao_registros
  for insert to authenticated with check (public.pode_evolucao(institution_id));

create or replace function public.evolucao_registro_imutavel()
returns trigger
language plpgsql
as $$
begin
  raise exception 'REGISTRO_IMUTAVEL: corrija inserindo um registro que substitua este';
end;
$$;
drop trigger if exists evolucao_registro_imutavel on public.evolucao_registros;
create trigger evolucao_registro_imutavel before update or delete on public.evolucao_registros
  for each row execute function public.evolucao_registro_imutavel();

-- Número de um campo do JSON: nulo se ausente, erro se veio texto.
create or replace function public._evo_num(j jsonb, k text)
returns numeric
language plpgsql
immutable
as $$
begin
  if j is null or not (j ? k) or jsonb_typeof(j -> k) = 'null' then return null; end if;
  if jsonb_typeof(j -> k) <> 'number' then
    raise exception 'REGISTRO_INVALIDO: % deve ser número', k;
  end if;
  return (j ->> k)::numeric;
end;
$$;

-- Fator para micrograma (massa) — nulo para unidades que não são massa.
create or replace function public._evo_mcg(u text)
returns numeric
language sql
immutable
as $$
  select case u when 'g' then 1000000 when 'mg' then 1000 when 'mcg' then 1 else null end;
$$;

-- A validação e o recálculo, por tipo. Devolve o JSON normalizado.
create or replace function public.valida_registro_evolucao(p_tipo text, p_dados jsonb, p_peso_kg numeric)
returns jsonb
language plpgsql
immutable
as $$
declare
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  v numeric; dose numeric; vol numeric; conc numeric; u text; uc text;
  massa_conc numeric; massa_dose numeric; calc jsonb := '{}'::jsonb;
  par text; lim_min numeric; lim_max numeric;
begin
  if p_tipo = 'sinal' then
    par := d ->> 'parametro';
    select mi, ma into lim_min, lim_max from (values
      ('pas', 20, 300), ('pad', 10, 200), ('pam', 15, 250), ('fc', 10, 300),
      ('spo2', 30, 100), ('etco2', 0, 150), ('temp', 25, 45)) t(p, mi, ma) where t.p = par;
    if lim_min is null then raise exception 'REGISTRO_INVALIDO: parâmetro desconhecido'; end if;
    v := public._evo_num(d, 'valor');
    if v is null or v < lim_min or v > lim_max then
      raise exception 'REGISTRO_INVALIDO: % fora da faixa possível (% a %)', par, lim_min, lim_max;
    end if;
    return jsonb_build_object('parametro', par, 'valor', v);

  elsif p_tipo = 'medicamento' then
    if coalesce(btrim(d ->> 'nome'), '') = '' or char_length(d ->> 'nome') > 120 then
      raise exception 'REGISTRO_INVALIDO: nome do medicamento';
    end if;
    if coalesce(d ->> 'status', '') not in ('planejado', 'preparado', 'administrado', 'cancelado') then
      raise exception 'REGISTRO_INVALIDO: situação do medicamento';
    end if;
    if coalesce(d ->> 'via', '') not in ('EV', 'IM', 'SC', 'VO', 'intratecal', 'peridural',
        'perineural', 'inalatoria', 'topica', 'retal', 'intranasal', 'outra') then
      raise exception 'REGISTRO_INVALIDO: via de administração';
    end if;
    if coalesce(d ->> 'forma', '') not in ('bolus', 'infusao', 'neuroeixo', 'bloqueio') then
      raise exception 'REGISTRO_INVALIDO: forma de administração';
    end if;
    u := d ->> 'unidade';
    if coalesce(u, '') not in ('g', 'mg', 'mcg', 'UI', 'mEq', 'mL') then
      raise exception 'REGISTRO_INVALIDO: unidade da dose';
    end if;
    dose := public._evo_num(d, 'dose');
    if dose is not null and (dose <= 0 or dose > 1000000) then
      raise exception 'REGISTRO_INVALIDO: dose';
    end if;
    if d ->> 'status' = 'administrado' and dose is null then
      raise exception 'REGISTRO_INVALIDO: medicamento administrado sem dose';
    end if;
    vol := public._evo_num(d, 'volume_ml');
    if vol is not null and (vol <= 0 or vol > 5000) then
      raise exception 'REGISTRO_INVALIDO: volume';
    end if;
    -- Concentração: {valor, unidade} com unidade "mg/mL", "mcg/mL", "g/mL",
    -- "UI/mL", "mEq/mL" ou "%" (g/100 mL — 1% = 10 mg/mL).
    if d ? 'concentracao' and jsonb_typeof(d -> 'concentracao') = 'object' then
      conc := public._evo_num(d -> 'concentracao', 'valor');
      uc := d -> 'concentracao' ->> 'unidade';
      if conc is null or conc <= 0 then raise exception 'REGISTRO_INVALIDO: concentração'; end if;
      if uc = '%' then
        massa_conc := conc * 10 * 1000;             -- mcg/mL
      elsif uc in ('g/mL', 'mg/mL', 'mcg/mL') then
        massa_conc := conc * public._evo_mcg(split_part(uc, '/', 1));
      elsif uc in ('UI/mL', 'mEq/mL') then
        massa_conc := null;
      else
        raise exception 'REGISTRO_INVALIDO: unidade da concentração';
      end if;
      -- Dose em massa com concentração em massa: o volume sai da conta.
      if dose is not null and massa_conc is not null and public._evo_mcg(u) is not null then
        massa_dose := dose * public._evo_mcg(u);
        if vol is null then
          vol := round(massa_dose / massa_conc, 3);
        elsif abs(vol * massa_conc - massa_dose) > 0.02 * massa_dose then
          raise exception 'REGISTRO_INVALIDO: dose, concentração e volume não batem';
        end if;
      elsif dose is not null and u = 'mL' then
        vol := coalesce(vol, dose);
      elsif dose is not null and uc in ('UI/mL', 'mEq/mL') and u = split_part(uc, '/', 1) then
        if vol is null then
          vol := round(dose / conc, 3);
        elsif abs(vol * conc - dose) > 0.02 * dose then
          raise exception 'REGISTRO_INVALIDO: dose, concentração e volume não batem';
        end if;
      elsif dose is not null and u <> 'mL' then
        raise exception 'REGISTRO_INVALIDO: unidade da dose incompatível com a concentração';
      end if;
    end if;
    if vol is not null then calc := calc || jsonb_build_object('volume_ml', vol); end if;
    -- mg/kg (ou mcg/kg, UI/kg…) pelo peso registrado na folha.
    if dose is not null and u <> 'mL' and p_peso_kg is not null and p_peso_kg > 0 then
      calc := calc || jsonb_build_object('dose_por_kg', round(dose / p_peso_kg, 4),
                                         'unidade_por_kg', u || '/kg', 'peso_kg', p_peso_kg);
    end if;
    return (d - 'calc') || jsonb_build_object('calc', calc);

  elsif p_tipo = 'infusao' then
    if coalesce(d ->> 'acao', '') not in ('iniciar', 'ajustar', 'encerrar') then
      raise exception 'REGISTRO_INVALIDO: ação da infusão';
    end if;
    if d ->> 'acao' <> 'iniciar' and coalesce(d ->> 'infusao_id', '') = '' then
      raise exception 'REGISTRO_INVALIDO: infusão não identificada';
    end if;
    if d ->> 'acao' = 'iniciar' and coalesce(btrim(d ->> 'nome'), '') = '' then
      raise exception 'REGISTRO_INVALIDO: nome da infusão';
    end if;
    if d ->> 'acao' in ('iniciar', 'ajustar') then
      v := public._evo_num(d -> 'velocidade', 'valor');
      if v is null or v < 0 or v > 10000 then raise exception 'REGISTRO_INVALIDO: velocidade'; end if;
      if coalesce(d -> 'velocidade' ->> 'unidade', '') not in
         ('mL/h', 'mcg/kg/min', 'mcg/kg/h', 'mg/kg/h', 'mcg/min', 'mg/h', 'UI/h', 'UI/min') then
        raise exception 'REGISTRO_INVALIDO: unidade da velocidade';
      end if;
    end if;
    return d;

  elsif p_tipo = 'gas' then
    for par in select unnest(array['o2', 'ar', 'n2o', 'outro']) loop
      v := public._evo_num(d, par);
      if v is not null and (v < 0 or v > 15) then
        raise exception 'REGISTRO_INVALIDO: fluxo de % (0 a 15 L/min)', par;
      end if;
    end loop;
    v := public._evo_num(d, 'sevo_pct');
    if v is not null and (v < 0 or v > 8) then
      raise exception 'REGISTRO_INVALIDO: sevoflurano no vaporizador (0 a 8%%)';
    end if;
    return d;

  elsif p_tipo = 'liquido' then
    if coalesce(d ->> 'sentido', '') not in ('entrada', 'saida') then
      raise exception 'REGISTRO_INVALIDO: entrada ou saída';
    end if;
    if coalesce(d ->> 'categoria', '') not in ('cristaloide', 'coloide', 'hemoderivado',
        'diurese', 'sangramento', 'outra_perda', 'outro') then
      raise exception 'REGISTRO_INVALIDO: categoria do líquido';
    end if;
    v := public._evo_num(d, 'volume_ml');
    if v is null or v <= 0 or v > 20000 then raise exception 'REGISTRO_INVALIDO: volume'; end if;
    return d;

  elsif p_tipo = 'evento' then
    if coalesce(btrim(d ->> 'codigo'), '') = '' then raise exception 'REGISTRO_INVALIDO: evento'; end if;
    if char_length(coalesce(d ->> 'descricao', '')) > 300 then
      raise exception 'REGISTRO_INVALIDO: descrição longa demais';
    end if;
    return d;
  end if;
  raise exception 'REGISTRO_INVALIDO: tipo';
end;
$$;

create or replace function public.evolucao_registro_antes_de_gravar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.evolucoes_anestesicas%rowtype;
  antigo public.evolucao_registros%rowtype;
  peso numeric;
begin
  select * into f from public.evolucoes_anestesicas where id = new.evolucao_id;
  if not found then raise exception 'FOLHA_INEXISTENTE'; end if;
  if f.status <> 'aberta' then raise exception 'FOLHA_ENCERRADA'; end if;
  new.institution_id := f.institution_id;
  new.created_by := auth.uid();
  new.created_at := now();
  if new.momento > now() + interval '5 minutes' then
    raise exception 'REGISTRO_INVALIDO: horário no futuro';
  end if;
  if new.momento < f.inicio_em - interval '2 days' then
    raise exception 'REGISTRO_INVALIDO: horário anterior à folha';
  end if;
  if new.anulado and new.substitui_id is null then
    raise exception 'REGISTRO_INVALIDO: exclusão sem o registro excluído';
  end if;
  if new.substitui_id is not null then
    select * into antigo from public.evolucao_registros where id = new.substitui_id;
    if not found or antigo.evolucao_id <> new.evolucao_id or antigo.tipo <> new.tipo then
      raise exception 'REGISTRO_INVALIDO: correção não confere com o original';
    end if;
    if antigo.anulado then raise exception 'REGISTRO_INVALIDO: registro já excluído'; end if;
  end if;
  if new.anulado then
    if coalesce(btrim(new.motivo), '') = '' then
      raise exception 'REGISTRO_INVALIDO: exclusão sem motivo';
    end if;
    new.dados := '{}'::jsonb;
    new.momento := antigo.momento;
    return new;
  end if;
  peso := case when jsonb_typeof(f.dados -> 'peso_kg') = 'number'
               then (f.dados ->> 'peso_kg')::numeric end;
  new.dados := public.valida_registro_evolucao(new.tipo, new.dados, peso);
  return new;
end;
$$;
drop trigger if exists evolucao_registro_antes_de_gravar on public.evolucao_registros;
create trigger evolucao_registro_antes_de_gravar before insert on public.evolucao_registros
  for each row execute function public.evolucao_registro_antes_de_gravar();

-- ---------------------------------------------------------------------------
-- As versões documentais: cada encerramento guarda o que foi impresso
-- ---------------------------------------------------------------------------
create table if not exists public.evolucao_versoes (
  id uuid primary key default gen_random_uuid(),
  evolucao_id uuid not null references public.evolucoes_anestesicas(id) on delete restrict,
  institution_id uuid not null references public.instituicoes(id),
  versao integer not null,
  dados jsonb not null,
  registros jsonb not null,
  encerrada_em timestamptz not null,
  encerrada_por uuid not null references public.perfis(id),
  motivo_reabertura text,
  unique (evolucao_id, versao)
);
alter table public.evolucao_versoes enable row level security;
create policy "versao_le" on public.evolucao_versoes
  for select to authenticated using (public.pode_evolucao(institution_id));

-- ---------------------------------------------------------------------------
-- Funções da folha
-- ---------------------------------------------------------------------------
create or replace function public.salvar_cabecalho_evolucao(
  p_id uuid, p_lock_version integer, p_dados jsonb)
returns table(lock_version integer, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.evolucoes_anestesicas%rowtype;
  mudou jsonb;
begin
  select * into f from public.evolucoes_anestesicas where id = p_id for update;
  if not found or not public.pode_evolucao(f.institution_id) then
    raise exception 'FOLHA_INEXISTENTE';
  end if;
  if f.status <> 'aberta' then raise exception 'FOLHA_ENCERRADA'; end if;
  if f.lock_version <> p_lock_version then raise exception 'CONFLITO_DE_EDICAO'; end if;
  if jsonb_typeof(p_dados) <> 'object' or pg_column_size(p_dados) > 200000 then
    raise exception 'CABECALHO_INVALIDO';
  end if;
  if p_dados ? 'peso_kg' and jsonb_typeof(p_dados -> 'peso_kg') <> 'null'
     and (jsonb_typeof(p_dados -> 'peso_kg') <> 'number'
          or (p_dados ->> 'peso_kg')::numeric <= 0 or (p_dados ->> 'peso_kg')::numeric > 400) then
    raise exception 'CABECALHO_INVALIDO: peso';
  end if;
  if p_dados ? 'intervalo_minutos' then
    raise exception 'CABECALHO_INVALIDO: intervalo não vai no cabeçalho';
  end if;
  -- Só os campos que mudaram, de quê para quê: é o que responde "quem
  -- trocou o peso, e quando" sem guardar a folha inteira a cada tecla.
  select jsonb_object_agg(k, jsonb_build_object('antes', f.dados -> k, 'depois', p_dados -> k))
    into mudou
    from (select jsonb_object_keys(f.dados) k union select jsonb_object_keys(p_dados)) ks
   where (f.dados -> k) is distinct from (p_dados -> k);
  update public.evolucoes_anestesicas e
     set dados = p_dados, lock_version = e.lock_version + 1, updated_at = now()
   where e.id = p_id;
  if mudou is not null then
    insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
    values (f.institution_id, auth.uid(), 'evolucao_anestesica', p_id, 'cabecalho', mudou);
  end if;
  return query select e.lock_version, e.updated_at from public.evolucoes_anestesicas e where e.id = p_id;
end;
$$;
revoke all on function public.salvar_cabecalho_evolucao(uuid, integer, jsonb) from public;
grant execute on function public.salvar_cabecalho_evolucao(uuid, integer, jsonb) to authenticated;

create or replace function public.definir_intervalo_evolucao(p_id uuid, p_minutos integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare f public.evolucoes_anestesicas%rowtype;
begin
  select * into f from public.evolucoes_anestesicas where id = p_id;
  if not found or not public.pode_evolucao(f.institution_id) then raise exception 'FOLHA_INEXISTENTE'; end if;
  if p_minutos not in (5, 10, 15) then raise exception 'INTERVALO_INVALIDO'; end if;
  update public.evolucoes_anestesicas set intervalo_minutos = p_minutos where id = p_id;
end;
$$;
revoke all on function public.definir_intervalo_evolucao(uuid, integer) from public;
grant execute on function public.definir_intervalo_evolucao(uuid, integer) to authenticated;

-- Os registros vigentes de uma folha: os que ninguém substituiu nem excluiu.
create or replace function public.registros_vigentes_evolucao(p_id uuid)
returns setof public.evolucao_registros
language sql
stable
security invoker
set search_path = public
as $$
  select r.* from public.evolucao_registros r
   where r.evolucao_id = p_id and not r.anulado
     and not exists (select 1 from public.evolucao_registros s where s.substitui_id = r.id)
   order by r.momento, r.created_at;
$$;
revoke all on function public.registros_vigentes_evolucao(uuid) from public;
grant execute on function public.registros_vigentes_evolucao(uuid) to authenticated;

-- Consumo estimado de sevoflurano, recalculado no servidor.
-- mL ≈ 3,26 × fluxo total (L/min) × concentração no vaporizador (%) × minutos / 60.
-- Cada registro de gás vale do seu horário até o próximo; o último, até o fim
-- da anestesia (evento "fim_anestesia"), o encerramento ou agora.
create or replace function public.consumo_sevoflurano_ml(p_id uuid)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  with fim as (
    select coalesce(
      (select max(r.momento) from public.registros_vigentes_evolucao(p_id) r
        where r.tipo = 'evento' and r.dados ->> 'codigo' = 'fim_anestesia'),
      (select e.encerrada_em from public.evolucoes_anestesicas e where e.id = p_id),
      now()) as t
  ), g as (
    select r.momento,
           lead(r.momento) over (order by r.momento, r.created_at) as proximo,
           coalesce((r.dados ->> 'o2')::numeric, 0) + coalesce((r.dados ->> 'ar')::numeric, 0)
             + coalesce((r.dados ->> 'n2o')::numeric, 0) + coalesce((r.dados ->> 'outro')::numeric, 0) as fgf,
           coalesce((r.dados ->> 'sevo_pct')::numeric, 0) as pct
      from public.registros_vigentes_evolucao(p_id) r where r.tipo = 'gas'
  )
  select round(coalesce(sum(
           3.26 * g.fgf * g.pct
           * greatest(extract(epoch from (least(coalesce(g.proximo, fim.t), fim.t) - g.momento)) / 60, 0)
           / 60), 0), 2)
    from g, fim;
$$;
revoke all on function public.consumo_sevoflurano_ml(uuid) from public;
grant execute on function public.consumo_sevoflurano_ml(uuid) to authenticated;

create or replace function public.encerrar_evolucao(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare f public.evolucoes_anestesicas%rowtype;
begin
  select * into f from public.evolucoes_anestesicas where id = p_id for update;
  if not found or not public.pode_evolucao(f.institution_id) then raise exception 'FOLHA_INEXISTENTE'; end if;
  if f.status <> 'aberta' then raise exception 'FOLHA_ENCERRADA'; end if;
  update public.evolucoes_anestesicas
     set status = 'encerrada', encerrada_em = now(), encerrada_por = auth.uid(), updated_at = now()
   where id = p_id;
  insert into public.evolucao_versoes(evolucao_id, institution_id, versao, dados, registros, encerrada_em, encerrada_por)
  values (p_id, f.institution_id, f.versao, f.dados,
          coalesce((select jsonb_agg(to_jsonb(r)) from public.registros_vigentes_evolucao(p_id) r), '[]'::jsonb),
          now(), auth.uid());
  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (f.institution_id, auth.uid(), 'evolucao_anestesica', p_id, 'encerrar',
          jsonb_build_object('versao', f.versao));
  return f.versao;
end;
$$;
revoke all on function public.encerrar_evolucao(uuid) from public;
grant execute on function public.encerrar_evolucao(uuid) to authenticated;

-- Reabrir é "gerar nova versão documentada após correção autorizada": a
-- versão encerrada fica guardada em evolucao_versoes, e a próxima impressão
-- sai com o número seguinte.
create or replace function public.reabrir_evolucao(p_id uuid, p_motivo text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare f public.evolucoes_anestesicas%rowtype;
begin
  select * into f from public.evolucoes_anestesicas where id = p_id for update;
  if not found or not public.pode_evolucao(f.institution_id) then raise exception 'FOLHA_INEXISTENTE'; end if;
  if f.status <> 'encerrada' then raise exception 'FOLHA_ABERTA'; end if;
  if coalesce(btrim(p_motivo), '') = '' or char_length(p_motivo) > 300 then
    raise exception 'REABERTURA_SEM_MOTIVO';
  end if;
  update public.evolucao_versoes set motivo_reabertura = p_motivo
   where evolucao_id = p_id and versao = f.versao;
  update public.evolucoes_anestesicas
     set status = 'aberta', versao = f.versao + 1, encerrada_em = null, encerrada_por = null,
         updated_at = now()
   where id = p_id;
  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (f.institution_id, auth.uid(), 'evolucao_anestesica', p_id, 'reabrir',
          jsonb_build_object('versao_anterior', f.versao, 'motivo', p_motivo));
  return f.versao + 1;
end;
$$;
revoke all on function public.reabrir_evolucao(uuid, text) from public;
grant execute on function public.reabrir_evolucao(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Regras de dose — vazia, versionada, só vale aprovada
-- ---------------------------------------------------------------------------
create table if not exists public.regras_de_dose (
  id uuid primary key default gen_random_uuid(),
  medicamento text not null,
  apresentacao text,
  via text not null,
  indicacao text not null,
  idade_min_dias integer check (idade_min_dias is null or idade_min_dias >= 0),
  idade_max_dias integer,
  peso_min_kg numeric,
  peso_max_kg numeric,
  unidade_por_kg text not null check (unidade_por_kg in ('mg/kg', 'mcg/kg', 'UI/kg', 'mEq/kg')),
  dose_habitual_min numeric,
  dose_habitual_max numeric,
  dose_critica_max numeric,
  dose_maxima_absoluta numeric,
  unidade_maxima_absoluta text check (unidade_maxima_absoluta is null
                                      or unidade_maxima_absoluta in ('g', 'mg', 'mcg', 'UI', 'mEq')),
  dose_acumulada_max_por_kg numeric,
  intervalo_minimo_min integer,
  condicoes jsonb not null default '{}'::jsonb,
  fonte text not null,
  edicao text not null,
  ano integer not null,
  pagina text,
  revisado_em date,
  revisor text,
  revisor_registro text,
  versao integer not null default 1,
  aprovada boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now(),
  check (not aprovada or (revisado_em is not null and revisor is not null and revisor_registro is not null))
);
alter table public.regras_de_dose enable row level security;
-- Leitura para quem usa o módulo; escrita só pelo SQL do proprietário até
-- existir a tela de revisão clínica.
create policy "regra_le" on public.regras_de_dose
  for select to authenticated using (public.evolucao_liberada());
