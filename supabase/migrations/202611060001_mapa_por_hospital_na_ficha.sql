-- ============================================================================
-- Mapa cirúrgico por hospital, e os pacientes do mapa na ficha anestésica
--
-- Pedido de 06/11/2026: "no lugar de o médico ficar buscando um por um nas
-- fichas pré-anestésicas, lançando o mapa cirúrgico, ele já vai buscar
-- automaticamente ali o paciente para iniciar a ficha anestésica no dia e na
-- instituição específica".
--
-- 1. O HOSPITAL NO MAPA. O mapa era um só por organização; um grupo que atende
--    em seis hospitais misturava os seis. O paciente e a sala passam a guardar
--    o hospital (o escolhido em "Onde você vai atender hoje?", o mesmo que a
--    ficha já usa em dados.local_atendimento_id). Quem não tem hospital —
--    anterior a esta migração — continua valendo em todos, como as fichas
--    antigas (lib/evolucao/local.ts), para nada sumir.
--
-- 2. O PACIENTE PARECIDO, SEM ACENTO. O nome do mapa vem da planilha ou da
--    foto, quase sempre em maiúsculas e sem acento; o cadastro da recepção tem
--    acento. `pacientes_parecidos` compara os dois sem acento e por trigramas
--    (pg_trgm), e roda com os direitos de quem chama: só enxerga os pacientes
--    que a pessoa já enxergaria.
--
-- 3. A FICHA LIGADA AO PACIENTE DO MAPA. `patient_id` e `evolucao_id` já
--    estavam reservados em centro_casos (202610210001) "para quando o
--    anestesista abrir a ficha e ligar os dois". O médico não monta o mapa
--    (a política de update pede a área 'centro'), então a ligação passa por
--    uma função que só escreve essas duas colunas, e só para uma ficha que
--    ele pode ver, da mesma organização.
--
-- Não apaga nada. O índice de nome único das salas é refeito para valer por
-- hospital: duas casas do mesmo grupo podem ter cada uma a sua "Sala 1".
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. O hospital no paciente e na sala do mapa
-- ---------------------------------------------------------------------------
alter table public.centro_casos
  add column if not exists local_atendimento_id uuid references public.locais_atendimento(id) on delete set null;
alter table public.centro_salas
  add column if not exists local_atendimento_id uuid references public.locais_atendimento(id) on delete set null;

-- A data de nascimento do paciente do mapa (06/11/2026: os hospitais passam a
-- mandá-la no mapa). É a trava mais forte para achar o cadastro certo:
-- lib/evolucao/mapa-do-dia.ts, principalDoCaso.
alter table public.centro_casos
  add column if not exists data_nascimento date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'centro_casos_data_nascimento_valida') then
    alter table public.centro_casos add constraint centro_casos_data_nascimento_valida
      check (data_nascimento is null or data_nascimento >= date '1890-01-01');
  end if;
end $$;

create index if not exists centro_casos_local_dia_idx
  on public.centro_casos (institution_id, local_atendimento_id, data);

drop index if exists public.centro_salas_nome_unico;
create unique index if not exists centro_salas_nome_unico
  on public.centro_salas (
    institution_id,
    coalesce(local_atendimento_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(nome))
  );

-- As duas funções de antes de gravar, com a mesma regra para o hospital que já
-- valia para a sala e o anestesista: tem de ser desta organização.
create or replace function public.centro_caso_antes_de_gravar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.institution_id := old.institution_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  if new.sala_id is not null and not exists (
    select 1 from public.centro_salas s where s.id = new.sala_id and s.institution_id = new.institution_id
  ) then
    raise exception 'A sala não é desta organização.';
  end if;
  if new.anestesista_id is not null and not exists (
    select 1 from public.perfis p where p.id = new.anestesista_id and p.institution_id = new.institution_id
  ) then
    raise exception 'O anestesista não é desta organização.';
  end if;
  if new.local_atendimento_id is not null and not exists (
    select 1 from public.locais_atendimento l where l.id = new.local_atendimento_id and l.institution_id = new.institution_id
  ) then
    raise exception 'O hospital não é desta organização.';
  end if;
  if new.etapa = 'cancelado' and btrim(coalesce(new.cancelado_motivo, '')) = '' then
    raise exception 'Diga o motivo do cancelamento.';
  end if;
  return new;
end;
$$;

create or replace function public.centro_sala_antes_de_gravar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.institution_id := old.institution_id;
    new.created_at := old.created_at;
  end if;
  if new.local_atendimento_id is not null and not exists (
    select 1 from public.locais_atendimento l where l.id = new.local_atendimento_id and l.institution_id = new.institution_id
  ) then
    raise exception 'O hospital não é desta organização.';
  end if;
  new.nome := btrim(new.nome);
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. O paciente parecido com o nome do mapa
-- ---------------------------------------------------------------------------
create or replace function public.sem_acento_minusculo(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select btrim(regexp_replace(lower(translate(coalesce(p_texto, ''),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', ' ', 'g'));
$$;

-- Com os direitos de quem chama (security invoker): a política de pacientes
-- decide quem aparece, como na busca da ficha.
create or replace function public.pacientes_parecidos(p_nome text)
returns table (
  id uuid, nome text, data_nascimento date, idade_anos integer, sexo text,
  convenio text, hospital text, cirurgia text, procedimento text, semelhanca real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with alvo as (select public.sem_acento_minusculo(p_nome) as n)
  select p.id, p.nome, p.data_nascimento, p.idade_anos, p.sexo, p.convenio, p.hospital, p.cirurgia, p.procedimento,
         extensions.similarity(public.sem_acento_minusculo(p.nome), alvo.n) as semelhanca
  from public.pacientes p, alvo
  where length(alvo.n) >= 3
    and extensions.similarity(public.sem_acento_minusculo(p.nome), alvo.n) >= 0.35
  order by semelhanca desc, p.nome
  limit 6;
$$;

revoke all on function public.pacientes_parecidos(text) from public, anon;
grant execute on function public.pacientes_parecidos(text) to authenticated;
grant execute on function public.sem_acento_minusculo(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ligar o paciente do mapa à ficha que o anestesista abriu
-- ---------------------------------------------------------------------------
create or replace function public.ligar_caso_a_ficha(p_caso uuid, p_evolucao uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caso public.centro_casos;
  v_ficha public.evolucoes_anestesicas;
begin
  select * into v_caso from public.centro_casos where id = p_caso;
  if not found or not public.pode_ver_centro(v_caso.institution_id) then
    return false;
  end if;
  select * into v_ficha from public.evolucoes_anestesicas where id = p_evolucao;
  if not found
     or v_ficha.institution_id <> v_caso.institution_id
     or not public.pode_evolucao(v_ficha.institution_id) then
    return false;
  end if;
  -- Já ligado a outra ficha: não troca. A primeira ficha aberta para esse
  -- paciente do mapa é a dele; a segunda seria engano.
  if v_caso.evolucao_id is not null and v_caso.evolucao_id <> v_ficha.id then
    return false;
  end if;
  update public.centro_casos
     set patient_id = v_ficha.patient_id, evolucao_id = v_ficha.id
   where id = v_caso.id;
  return true;
end;
$$;

revoke all on function public.ligar_caso_a_ficha(uuid, uuid) from public, anon;
grant execute on function public.ligar_caso_a_ficha(uuid, uuid) to authenticated;
