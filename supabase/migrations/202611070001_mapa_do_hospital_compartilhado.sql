-- ============================================================================
-- O mapa cirúrgico do hospital, lido pela ficha anestésica do serviço de
-- anestesia (outra organização)
--
-- Pedido de 07/11/2026. O mapa do dia é montado pelo centro cirúrgico do
-- hospital, na organização DELE; o serviço de anestesia trabalha na sua. Cada
-- organização só enxerga o que é dela, e por isso o mapa não aparecia na
-- entrada da ficha do anestesista — que acabou buscando pelo nome e abrindo a
-- ficha no paciente errado.
--
-- QUEM CONTROLA OS DADOS É O HOSPITAL (LGPD). Por isso nada se compartilha
-- sozinho: esta migração cria o mecanismo e nenhuma ligação. Uma ligação só
-- entra depois da autorização por escrito do hospital, e guarda quem
-- autorizou, quando, e o documento.
--
-- O mínimo necessário:
--   * só leitura: nada é gravado no mapa do hospital;
--   * só os pacientes de HOJE (no fuso do serviço), sem os cancelados;
--   * só para quem pode abrir ficha anestésica, e só no hospital da ligação;
--   * só o que a ficha usa: hora, ordem, sala, nome, idade, data de
--     nascimento, cirurgia, cirurgião, convênio e etapa. Prontuário, leito,
--     observações, anestesista e horários da sala ficam no hospital.
--   * cada leitura fica registrada (uma linha por pessoa por dia), para o
--     hospital saber quem viu.
--
-- Revogar é marcar `revogado_em`: a lista some na próxima vez que a entrada
-- da ficha abrir.
-- ============================================================================

create table if not exists public.centro_compartilhamentos (
  id uuid primary key default gen_random_uuid(),
  -- O hospital: a organização que monta o mapa e, quando ela tem mais de um
  -- local, qual. Nulo é "a organização inteira é este hospital".
  origem_institution_id uuid not null references public.instituicoes(id) on delete cascade,
  origem_local_id uuid references public.locais_atendimento(id) on delete cascade,
  -- O serviço de anestesia e o hospital da sessão em que o mapa aparece.
  destino_institution_id uuid not null references public.instituicoes(id) on delete cascade,
  destino_local_id uuid not null references public.locais_atendimento(id) on delete cascade,
  -- A autorização por escrito do hospital.
  autorizado_por text not null check (length(btrim(autorizado_por)) between 3 and 200),
  autorizado_em date not null,
  documento text not null check (length(btrim(documento)) between 3 and 300),
  valido_ate date,
  criado_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  revogado_em timestamptz,
  revogado_por uuid references public.perfis(id) on delete set null,
  revogado_motivo text check (revogado_motivo is null or length(revogado_motivo) <= 300),
  constraint centro_compartilhamentos_outra_casa check (origem_institution_id <> destino_institution_id),
  constraint centro_compartilhamentos_validade check (valido_ate is null or valido_ate >= autorizado_em)
);

-- Uma ligação viva por hospital de origem e hospital de destino.
create unique index if not exists centro_compartilhamentos_vivo
  on public.centro_compartilhamentos (
    origem_institution_id,
    coalesce(origem_local_id, '00000000-0000-0000-0000-000000000000'::uuid),
    destino_local_id
  )
  where revogado_em is null;

-- Ninguém lê nem grava pela API: a ligação é criada e revogada pelo
-- responsável, no banco, e lida só pela função abaixo.
alter table public.centro_compartilhamentos enable row level security;
revoke all on table public.centro_compartilhamentos from public, anon, authenticated;

-- Os locais têm de ser das organizações certas.
create or replace function public.centro_compartilhamento_antes_de_gravar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.origem_local_id is not null and not exists (
    select 1 from public.locais_atendimento l
    where l.id = new.origem_local_id and l.institution_id = new.origem_institution_id
  ) then
    raise exception 'O local de origem não é da organização do hospital.';
  end if;
  if not exists (
    select 1 from public.locais_atendimento l
    where l.id = new.destino_local_id and l.institution_id = new.destino_institution_id
  ) then
    raise exception 'O local de destino não é da organização do serviço.';
  end if;
  if tg_op = 'UPDATE' then
    -- Depois de criada, a ligação só muda para ser revogada.
    if new.origem_institution_id <> old.origem_institution_id
       or new.origem_local_id is distinct from old.origem_local_id
       or new.destino_institution_id <> old.destino_institution_id
       or new.destino_local_id <> old.destino_local_id
       or new.autorizado_por <> old.autorizado_por
       or new.autorizado_em <> old.autorizado_em
       or new.documento <> old.documento
       or new.created_at <> old.created_at then
      raise exception 'A ligação não se edita: revogue e crie outra.';
    end if;
    if old.revogado_em is not null and new.revogado_em is distinct from old.revogado_em then
      raise exception 'Ligação revogada não volta: crie outra.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists centro_compartilhamento_antes_de_gravar on public.centro_compartilhamentos;
create trigger centro_compartilhamento_antes_de_gravar
  before insert or update on public.centro_compartilhamentos
  for each row execute function public.centro_compartilhamento_antes_de_gravar();

-- Quem leu, por dia.
create table if not exists public.centro_compartilhamento_leituras (
  compartilhamento_id uuid not null references public.centro_compartilhamentos(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  dia date not null,
  vezes integer not null default 1,
  primeira_em timestamptz not null default now(),
  ultima_em timestamptz not null default now(),
  pacientes integer not null default 0,
  primary key (compartilhamento_id, perfil_id, dia)
);
alter table public.centro_compartilhamento_leituras enable row level security;
revoke all on table public.centro_compartilhamento_leituras from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Os pacientes de hoje do mapa do hospital, para a entrada da ficha
-- ---------------------------------------------------------------------------
create or replace function public.mapa_compartilhado_do_dia(p_local uuid)
returns table (
  id uuid, data date, horario time, ordem integer, sala text, paciente text, idade smallint,
  data_nascimento date, procedimento text, cirurgiao text, convenio text, etapa text, hospital text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_inst uuid := public.current_institution_id();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_lig public.centro_compartilhamentos;
  v_total integer;
begin
  -- Quem pode abrir ficha anestésica nesta casa, num local que é dela e que a
  -- pessoa enxerga (o do grupo, ou o particular dela).
  if p_local is null or not public.pode_evolucao(v_inst) then
    return;
  end if;
  if not exists (
    select 1 from public.locais_atendimento l
    where l.id = p_local and l.institution_id = v_inst
      and (l.owner_id is null or l.owner_id = auth.uid())
  ) then
    return;
  end if;

  select * into v_lig from public.centro_compartilhamentos c
  where c.destino_institution_id = v_inst
    and c.destino_local_id = p_local
    and c.revogado_em is null
    and (c.valido_ate is null or c.valido_ate >= v_hoje)
  order by c.created_at desc
  limit 1;
  if not found then
    return;
  end if;

  return query
    select k.id, k.data, k.horario, k.ordem, btrim(coalesce(s.nome, '')), k.paciente, k.idade,
           k.data_nascimento, k.procedimento, k.cirurgiao, k.convenio, k.etapa,
           coalesce(nullif(btrim(lo.nome_fantasia), ''), lo.nome, i.nome)
    from public.centro_casos k
    left join public.centro_salas s on s.id = k.sala_id
    left join public.locais_atendimento lo on lo.id = v_lig.origem_local_id
    join public.instituicoes i on i.id = k.institution_id
    where k.institution_id = v_lig.origem_institution_id
      and k.data = v_hoje
      and k.etapa <> 'cancelado'
      and (v_lig.origem_local_id is null or k.local_atendimento_id = v_lig.origem_local_id)
    order by k.ordem nulls last, k.horario nulls last, k.paciente;

  get diagnostics v_total = row_count;
  insert into public.centro_compartilhamento_leituras as r (compartilhamento_id, perfil_id, dia, pacientes)
  values (v_lig.id, auth.uid(), v_hoje, v_total)
  on conflict (compartilhamento_id, perfil_id, dia)
  do update set vezes = r.vezes + 1, ultima_em = now(), pacientes = excluded.pacientes;
end;
$$;

revoke all on function public.mapa_compartilhado_do_dia(uuid) from public, anon;
grant execute on function public.mapa_compartilhado_do_dia(uuid) to authenticated;
revoke all on function public.centro_compartilhamento_antes_de_gravar() from public, anon, authenticated;
