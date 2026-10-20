-- ============================================================================
-- Mapa cirúrgico (gestão do centro cirúrgico)
--
-- O enfermeiro chefe monta o mapa do dia: em que sala, a que horas, qual
-- paciente, qual cirurgia, de qual convênio e com qual anestesista. Durante o
-- dia o paciente anda pelas etapas — agendado, em sala, RPA, alta — e cada
-- passo fica com hora e autor. No fim do dia, o mapa é a lista dos atos
-- anestésicos, por anestesista e por convênio: é dela que sai o faturamento.
--
-- LIBERADO POR INSTITUIÇÃO, E NÃO PELA COLUNA `modulos`. Em `modulos`, nulo
-- quer dizer "tudo" — é o que mantém inteiras as organizações antigas —, e um
-- módulo novo entrando ali apareceria de uma vez para todos os clientes. O
-- mapa é contrato de hospital: entra pelo mesmo caminho da ficha anestésica
-- (`recursos_por_instituicao`), que só abre onde foi ligado.
--
-- Quem monta: administrador, proprietário, ou quem recebeu a área extra
-- 'centro' (o enfermeiro do centro cirúrgico). Quem só olha: o médico da
-- organização. As duas perguntas são funções, para as políticas e a tela
-- perguntarem a mesma coisa.
-- ============================================================================

insert into public.recursos_liberados (codigo, liberado)
values ('centro_cirurgico', false)
on conflict (codigo) do nothing;

create or replace function public.centro_liberado()
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
                      where r.codigo = 'centro_cirurgico' and r.liberado)
           or exists (select 1 from public.recursos_por_instituicao ri
                      where ri.codigo = 'centro_cirurgico' and ri.institution_id = p.institution_id))
  );
$$;

-- Ver o mapa: a própria casa, o recurso ligado, e acesso clínico ou de centro.
create or replace function public.pode_ver_centro(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_institution_id is not null
     and p_institution_id = public.current_institution_id()
     and public.centro_liberado()
     and (public.current_has_permission('centro') or public.current_has_permission('medico'));
$$;

-- Montar o mapa: só quem tem a área do centro (admin e proprietário já têm).
create or replace function public.pode_montar_centro(p_institution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_institution_id is not null
     and p_institution_id = public.current_institution_id()
     and public.centro_liberado()
     and public.current_has_permission('centro');
$$;

revoke all on function public.centro_liberado() from public, anon;
revoke all on function public.pode_ver_centro(uuid) from public, anon;
revoke all on function public.pode_montar_centro(uuid) from public, anon;
grant execute on function public.centro_liberado() to authenticated;
grant execute on function public.pode_ver_centro(uuid) to authenticated;
grant execute on function public.pode_montar_centro(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- As salas
-- ---------------------------------------------------------------------------
create table if not exists public.centro_salas (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 40),
  ordem smallint not null default 0,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists centro_salas_nome_unico
  on public.centro_salas (institution_id, lower(btrim(nome)));
create index if not exists centro_salas_ordem_idx on public.centro_salas (institution_id, ordem);
alter table public.centro_salas enable row level security;

create policy "centro_salas_le" on public.centro_salas
  for select to authenticated using (public.pode_ver_centro(institution_id));
create policy "centro_salas_cria" on public.centro_salas
  for insert to authenticated with check (public.pode_montar_centro(institution_id));
create policy "centro_salas_altera" on public.centro_salas
  for update to authenticated using (public.pode_montar_centro(institution_id))
  with check (public.pode_montar_centro(institution_id));
-- Sala não se apaga: desativa. Apagar deixaria os mapas antigos sem sala.

-- ---------------------------------------------------------------------------
-- Os pacientes do mapa
--
-- O paciente vai pelo NOME escrito, e não por cadastro obrigatório: o hospital
-- já tem o cadastro dele no sistema do hospital, e exigir um segundo aqui
-- faria o mapa voltar para o quadro branco. `patient_id` fica para quando o
-- anestesista abrir a ficha e ligar os dois.
-- ---------------------------------------------------------------------------
create table if not exists public.centro_casos (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  data date not null,
  sala_id uuid references public.centro_salas(id) on delete set null,
  horario time,
  paciente text not null check (length(btrim(paciente)) between 1 and 120),
  idade smallint check (idade between 0 and 130),
  prontuario text check (prontuario is null or length(prontuario) <= 40),
  procedimento text not null check (length(btrim(procedimento)) between 1 and 200),
  cirurgiao text check (cirurgiao is null or length(cirurgiao) <= 120),
  convenio text check (convenio is null or length(convenio) <= 60),
  anestesista_id uuid references public.perfis(id) on delete set null,
  etapa text not null default 'agendado'
    check (etapa in ('agendado', 'em_sala', 'rpa', 'concluido', 'cancelado')),
  -- Para onde foi ao sair: da sala direto (UTI) ou da RPA (quarto, casa).
  destino text check (destino in ('quarto', 'uti', 'casa', 'outro')),
  entrada_sala_em timestamptz,
  inicio_cirurgia_em timestamptz,
  fim_cirurgia_em timestamptz,
  saida_sala_em timestamptz,
  alta_rpa_em timestamptz,
  aldrete_alta smallint check (aldrete_alta between 0 and 10),
  cancelado_motivo text check (cancelado_motivo is null or length(cancelado_motivo) <= 300),
  observacoes text check (observacoes is null or length(observacoes) <= 500),
  patient_id uuid references public.pacientes(id) on delete set null,
  evolucao_id uuid references public.evolucoes_anestesicas(id) on delete set null,
  created_by uuid default auth.uid() references public.perfis(id) on delete set null,
  updated_by uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Os horários andam para a frente. Sem isto, um toque errado no relógio
  -- faria o tempo de sala sair negativo no relatório do mês.
  constraint centro_casos_sala_em_ordem
    check (saida_sala_em is null or entrada_sala_em is null or saida_sala_em >= entrada_sala_em),
  constraint centro_casos_rpa_em_ordem
    check (alta_rpa_em is null or saida_sala_em is null or alta_rpa_em >= saida_sala_em),
  constraint centro_casos_cirurgia_em_ordem
    check (fim_cirurgia_em is null or inicio_cirurgia_em is null or fim_cirurgia_em >= inicio_cirurgia_em)
);
create index if not exists centro_casos_dia_idx on public.centro_casos (institution_id, data);
create index if not exists centro_casos_anestesista_idx on public.centro_casos (anestesista_id, data);
alter table public.centro_casos enable row level security;

create policy "centro_casos_le" on public.centro_casos
  for select to authenticated using (public.pode_ver_centro(institution_id));
create policy "centro_casos_cria" on public.centro_casos
  for insert to authenticated with check (public.pode_montar_centro(institution_id));
create policy "centro_casos_altera" on public.centro_casos
  for update to authenticated using (public.pode_montar_centro(institution_id))
  with check (public.pode_montar_centro(institution_id));
-- Apagar só o que nunca aconteceu (lançado por engano). Depois de entrar em
-- sala, o caminho é cancelar, e o mapa guarda o motivo.
create policy "centro_casos_apaga" on public.centro_casos
  for delete to authenticated using (public.pode_montar_centro(institution_id) and etapa = 'agendado');

-- A casa do registro é a de quem grava, e a sala e o anestesista têm de ser
-- da mesma casa: a política confere a instituição da linha, e estas travas
-- conferem o que a linha aponta.
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
  if new.etapa = 'cancelado' and btrim(coalesce(new.cancelado_motivo, '')) = '' then
    raise exception 'Diga o motivo do cancelamento.';
  end if;
  return new;
end;
$$;
revoke all on function public.centro_caso_antes_de_gravar() from public, anon;

drop trigger if exists centro_caso_antes_de_gravar on public.centro_casos;
create trigger centro_caso_antes_de_gravar
  before insert or update on public.centro_casos
  for each row execute function public.centro_caso_antes_de_gravar();

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
  new.nome := btrim(new.nome);
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.centro_sala_antes_de_gravar() from public, anon;

drop trigger if exists centro_sala_antes_de_gravar on public.centro_salas;
create trigger centro_sala_antes_de_gravar
  before insert or update on public.centro_salas
  for each row execute function public.centro_sala_antes_de_gravar();

-- ---------------------------------------------------------------------------
-- O histórico das etapas
--
-- Quem mudou o paciente de etapa, de onde para onde e quando. Escrito só pelo
-- gatilho: a tela não grava aqui, e ninguém apaga. É o que responde "quem deu
-- alta da RPA a esse paciente" uma semana depois.
-- ---------------------------------------------------------------------------
create table if not exists public.centro_caso_eventos (
  id bigserial primary key,
  caso_id uuid not null references public.centro_casos(id) on delete cascade,
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  de text,
  para text not null,
  por uuid references public.perfis(id) on delete set null,
  em timestamptz not null default now()
);
create index if not exists centro_caso_eventos_caso_idx on public.centro_caso_eventos (caso_id, em);
alter table public.centro_caso_eventos enable row level security;

create policy "centro_caso_eventos_le" on public.centro_caso_eventos
  for select to authenticated using (public.pode_ver_centro(institution_id));

create or replace function public.centro_caso_registra_etapa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa then
    insert into public.centro_caso_eventos (caso_id, institution_id, de, para, por)
    values (new.id, new.institution_id, case when tg_op = 'UPDATE' then old.etapa end, new.etapa, auth.uid());
  end if;
  return null;
end;
$$;
revoke all on function public.centro_caso_registra_etapa() from public, anon;

drop trigger if exists centro_caso_registra_etapa on public.centro_casos;
create trigger centro_caso_registra_etapa
  after insert or update on public.centro_casos
  for each row execute function public.centro_caso_registra_etapa();

revoke all on public.centro_salas, public.centro_casos, public.centro_caso_eventos from anon;

-- O piloto: o centro cirúrgico da FUNDHOSPAR, pelo nome — o id é gerado, e
-- cada banco tem o seu.
insert into public.recursos_por_instituicao (codigo, institution_id)
select 'centro_cirurgico', i.id
from public.instituicoes i
where i.nome like 'FUNDHOSPAR —%'
on conflict do nothing;
