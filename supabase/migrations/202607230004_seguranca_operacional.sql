-- Segurança operacional, versionamento clínico, agenda e consistência financeira.

alter table public.avaliacoes
  add column if not exists lock_version integer not null default 1,
  add column if not exists snapshot_conclusao jsonb,
  add column if not exists reaberta_de_id uuid references public.avaliacoes(id) on delete set null;

create or replace function public.proteger_avaliacao_concluida()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'concluida' then
    raise exception 'AVALIACAO_CONCLUIDA_IMUTAVEL';
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_avaliacao_concluida_trigger on public.avaliacoes;
create trigger proteger_avaliacao_concluida_trigger
before update on public.avaliacoes
for each row execute function public.proteger_avaliacao_concluida();

alter table public.perfis
  add column if not exists email text;

update public.perfis p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null;

create table if not exists public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete restrict,
  patient_id uuid not null references public.pacientes(id) on delete restrict,
  avaliacao_id uuid references public.avaliacoes(id) on delete set null,
  data date not null,
  horario time,
  status text not null default 'agendado'
    check (status in ('agendado','confirmado','presente','faltou','cancelado','reagendado')),
  hospital text,
  procedimento text,
  convenio text,
  status_by uuid references public.perfis(id) on delete set null,
  status_at timestamptz,
  observacoes text,
  created_by uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agendamentos_unico_idx
  on public.agendamentos(institution_id, patient_id, data, coalesce(horario, '00:00'::time))
  where status not in ('cancelado','reagendado');
create index if not exists agendamentos_institution_data_idx
  on public.agendamentos(institution_id, data);
create index if not exists agendamentos_patient_idx
  on public.agendamentos(patient_id);

insert into public.agendamentos (
  institution_id, patient_id, data, horario, hospital, procedimento, convenio, created_by
)
select
  p.institution_id, p.id, p.data_consulta, p.horario, p.hospital,
  coalesce(p.procedimento, p.cirurgia), p.convenio, p.created_by
from public.pacientes p
where p.data_consulta is not null
on conflict do nothing;

create unique index if not exists pacientes_cpf_unico_por_instituicao_idx
  on public.pacientes (
    institution_id,
    (regexp_replace(cpf, '\D', '', 'g'))
  )
  where cpf is not null
    and regexp_replace(cpf, '\D', '', 'g') <> '';

create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete restrict,
  actor_id uuid references public.perfis(id) on delete set null,
  entidade text not null,
  entidade_id uuid,
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Compatibilidade com a estrutura de auditoria criada nas primeiras versões.
alter table public.auditoria
  add column if not exists actor_id uuid references public.perfis(id) on delete set null,
  add column if not exists entidade text,
  add column if not exists entidade_id uuid,
  add column if not exists detalhes jsonb not null default '{}'::jsonb,
  add column if not exists user_id uuid,
  add column if not exists tabela text not null default 'sistema',
  add column if not exists registro_id uuid,
  add column if not exists dados_anteriores jsonb,
  add column if not exists dados_novos jsonb;

alter table public.auditoria
  alter column tabela set default 'sistema';

update public.auditoria
set entidade = coalesce(entidade, tabela),
    entidade_id = coalesce(entidade_id, registro_id),
    actor_id = coalesce(actor_id, user_id),
    detalhes = coalesce(detalhes, dados_novos, '{}'::jsonb)
where entidade is null
   or entidade_id is null
   or actor_id is null
   or detalhes is null;

create index if not exists auditoria_institution_created_idx
  on public.auditoria(institution_id, created_at desc);
create index if not exists auditoria_entidade_idx
  on public.auditoria(entidade, entidade_id);

alter table public.financeiro_atendimentos
  add column if not exists glosa_valor numeric(12,2) not null default 0 check (glosa_valor >= 0),
  add column if not exists periodo text,
  add column if not exists fechado_at timestamptz,
  add column if not exists fechado_by uuid references public.perfis(id) on delete set null;

create unique index if not exists financeiro_avaliacao_unica_idx
  on public.financeiro_atendimentos(institution_id, avaliacao_id)
  where avaliacao_id is not null;

create table if not exists public.financeiro_periodos (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete restrict,
  periodo text not null check (periodo ~ '^[0-9]{4}-[0-9]{2}$'),
  status text not null default 'aberto' check (status in ('aberto','conferido','fechado')),
  conferido_by uuid references public.perfis(id) on delete set null,
  conferido_at timestamptz,
  fechado_by uuid references public.perfis(id) on delete set null,
  fechado_at timestamptz,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, periodo)
);

alter table public.agendamentos enable row level security;
alter table public.auditoria enable row level security;
alter table public.financeiro_periodos enable row level security;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.perfis where id = auth.uid() and status = 'ativo'
$$;

create or replace function public.current_institution_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select institution_id from public.perfis where id = auth.uid() and status = 'ativo'
$$;

drop policy if exists "equipe_acessa_agendamentos" on public.agendamentos;
create policy "equipe_acessa_agendamentos"
on public.agendamentos for all to authenticated
using (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = agendamentos.institution_id
      and p.status = 'ativo'
      and p.role in ('recepcao','medico','admin','owner')
  )
)
with check (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = agendamentos.institution_id
      and p.status = 'ativo'
      and p.role in ('recepcao','medico','admin','owner')
  )
);

drop policy if exists "admin_consulta_auditoria" on public.auditoria;
create policy "admin_consulta_auditoria"
on public.auditoria for select to authenticated
using (
  public.current_institution_id() = auditoria.institution_id
  and public.current_app_role() in ('admin','owner')
);

drop policy if exists "sistema_registra_auditoria" on public.auditoria;
create policy "sistema_registra_auditoria"
on public.auditoria for insert to authenticated
with check (
  public.current_institution_id() = auditoria.institution_id
  and actor_id = auth.uid()
);

drop policy if exists "financeiro_gerencia_periodos" on public.financeiro_periodos;
create policy "financeiro_gerencia_periodos"
on public.financeiro_periodos for all to authenticated
using (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = financeiro_periodos.institution_id
      and p.status = 'ativo'
      and p.role in ('financeiro','admin','owner')
  )
)
with check (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = financeiro_periodos.institution_id
      and p.status = 'ativo'
      and p.role in ('financeiro','admin','owner')
  )
);

-- Recepção enxerga apenas os dados cadastrais do paciente; conteúdo clínico
-- continua protegido pelas políticas da tabela de avaliações.
alter table public.pacientes enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.perfis enable row level security;

drop policy if exists "financeiro_e_admin_gerenciam_atendimentos" on public.financeiro_atendimentos;
create policy "financeiro_e_admin_gerenciam_atendimentos"
on public.financeiro_atendimentos for all to authenticated
using (
  public.current_institution_id() = financeiro_atendimentos.institution_id
  and public.current_app_role() in ('financeiro','admin','owner')
)
with check (
  public.current_institution_id() = financeiro_atendimentos.institution_id
  and public.current_app_role() in ('financeiro','admin','owner')
);

drop policy if exists "financeiro_e_admin_gerenciam_pagamentos" on public.financeiro_pagamentos;
create policy "financeiro_e_admin_gerenciam_pagamentos"
on public.financeiro_pagamentos for all to authenticated
using (
  public.current_institution_id() = financeiro_pagamentos.institution_id
  and public.current_app_role() in ('financeiro','admin','owner')
)
with check (
  public.current_institution_id() = financeiro_pagamentos.institution_id
  and public.current_app_role() in ('financeiro','admin','owner')
);

create or replace function public.financeiro_listar_pacientes()
returns table (
  id uuid,
  nome text,
  hospital text,
  convenio text,
  data_consulta date,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome, p.hospital, p.convenio, p.data_consulta, p.created_at
  from public.pacientes p
  where p.institution_id = public.current_institution_id()
    and public.current_app_role() in ('financeiro','admin','owner')
  order by p.created_at desc
$$;

drop policy if exists "equipe_acessa_pacientes_da_instituicao" on public.pacientes;
create policy "equipe_acessa_pacientes_da_instituicao"
on public.pacientes for all to authenticated
using (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = pacientes.institution_id
      and p.status = 'ativo'
      and p.role in ('recepcao','medico','admin','owner')
  )
)
with check (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = pacientes.institution_id
      and p.status = 'ativo'
      and p.role in ('recepcao','medico','admin','owner')
  )
);

drop policy if exists "medicos_acessam_avaliacoes_da_instituicao" on public.avaliacoes;
create policy "medicos_acessam_avaliacoes_da_instituicao"
on public.avaliacoes for all to authenticated
using (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = avaliacoes.institution_id
      and p.status = 'ativo'
      and p.role in ('medico','admin','owner')
  )
)
with check (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = avaliacoes.institution_id
      and p.status = 'ativo'
      and p.role in ('medico','admin','owner')
  )
);

drop policy if exists "usuario_le_proprio_perfil" on public.perfis;
create policy "usuario_le_proprio_perfil"
on public.perfis for select to authenticated
using (
  id = auth.uid()
  or (
    public.current_institution_id() = perfis.institution_id
    and public.current_app_role() in ('admin','owner')
  )
);

drop policy if exists "gestor_atualiza_perfis" on public.perfis;

create or replace function public.admin_atualizar_perfil(
  p_perfil_id uuid,
  p_role text,
  p_status text,
  p_nome text,
  p_crm text default null,
  p_rqe text default null
)
returns public.perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.perfis;
  v_target public.perfis;
begin
  select * into v_actor from public.perfis where id = auth.uid() and status = 'ativo';
  select * into v_target from public.perfis where id = p_perfil_id;

  if v_actor.id is null or v_target.id is null
     or v_actor.institution_id <> v_target.institution_id
     or v_actor.role not in ('admin','owner') then
    raise exception 'Sem permissão';
  end if;

  if p_role not in ('recepcao','medico','financeiro','admin','owner')
     or p_status not in ('ativo','inativo') then
    raise exception 'Perfil ou status inválido';
  end if;

  if (v_target.role = 'owner' or p_role = 'owner') and v_actor.role <> 'owner' then
    raise exception 'Somente o proprietário pode alterar proprietário';
  end if;

  if p_perfil_id = auth.uid() and p_status <> 'ativo' then
    raise exception 'Você não pode desativar o próprio acesso';
  end if;

  update public.perfis
  set role = p_role,
      status = p_status,
      nome = trim(p_nome),
      crm = nullif(trim(coalesce(p_crm,'')), ''),
      rqe = nullif(trim(coalesce(p_rqe,'')), ''),
      updated_at = now()
  where id = p_perfil_id
  returning * into v_target;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_actor.institution_id, auth.uid(), 'perfil', v_target.id, 'perfil_atualizado',
    jsonb_build_object('role', p_role, 'status', p_status)
  );

  return v_target;
end;
$$;

create or replace function public.registrar_presenca(
  p_agendamento_id uuid,
  p_status text
)
returns public.agendamentos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.agendamentos;
begin
  if p_status not in ('confirmado','presente','faltou','cancelado','reagendado') then
    raise exception 'Status de agenda inválido';
  end if;

  update public.agendamentos
  set status = p_status,
      status_by = auth.uid(),
      status_at = now(),
      updated_at = now()
  where id = p_agendamento_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Agendamento não encontrado ou sem permissão';
  end if;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (v_row.institution_id, auth.uid(), 'agendamento', v_row.id, 'status_alterado',
    jsonb_build_object('status', p_status, 'patient_id', v_row.patient_id));

  return v_row;
end;
$$;

create or replace function public.salvar_rascunho_avaliacao(
  p_avaliacao_id uuid,
  p_expected_lock_version integer,
  p_dados jsonb
)
returns table(updated_at timestamptz, lock_version integer)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  update public.avaliacoes a
  set dados = p_dados,
      updated_at = now(),
      lock_version = a.lock_version + 1
  where a.id = p_avaliacao_id
    and a.status = 'rascunho'
    and a.lock_version = p_expected_lock_version
  returning a.updated_at, a.lock_version;

  if not found then
    raise exception 'CONFLITO_DE_EDICAO';
  end if;
end;
$$;

create or replace function public.concluir_avaliacao(
  p_avaliacao_id uuid,
  p_expected_lock_version integer,
  p_dados jsonb
)
returns public.avaliacoes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.avaliacoes;
begin
  update public.avaliacoes a
  set dados = p_dados,
      snapshot_conclusao = p_dados,
      status = 'concluida',
      concluida_at = now(),
      updated_at = now(),
      lock_version = a.lock_version + 1
  where a.id = p_avaliacao_id
    and a.status = 'rascunho'
    and a.lock_version = p_expected_lock_version
  returning * into v_row;

  if v_row.id is null then
    raise exception 'CONFLITO_OU_AVALIACAO_JA_CONCLUIDA';
  end if;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_row.institution_id, auth.uid(), 'avaliacao', v_row.id, 'concluida',
    jsonb_build_object('patient_id', v_row.patient_id, 'versao', v_row.versao)
  );

  return v_row;
end;
$$;

create or replace function public.registrar_pagamento_financeiro(
  p_atendimento_id uuid,
  p_valor numeric,
  p_metodo text,
  p_referencia text default null
)
returns public.financeiro_atendimentos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.financeiro_atendimentos;
  v_saldo numeric;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor de pagamento inválido';
  end if;

  select * into v_item
  from public.financeiro_atendimentos
  where id = p_atendimento_id
  for update;

  if v_item.id is null then
    raise exception 'Atendimento não encontrado ou sem permissão';
  end if;

  if v_item.fechado_at is not null then
    raise exception 'Período financeiro já fechado';
  end if;

  v_saldo := greatest(0, v_item.valor - v_item.recebido);
  if p_valor > v_saldo then
    raise exception 'Pagamento maior que o saldo';
  end if;

  insert into public.financeiro_pagamentos(
    institution_id, atendimento_id, valor, metodo, referencia, created_by
  ) values (
    v_item.institution_id, v_item.id, p_valor, p_metodo, p_referencia, auth.uid()
  );

  update public.financeiro_atendimentos
  set recebido = recebido + p_valor,
      status = case when recebido + p_valor >= valor and valor > 0 then 'pago' else status end,
      data_recebimento = current_date,
      updated_at = now()
  where id = v_item.id
  returning * into v_item;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_item.institution_id, auth.uid(), 'financeiro_atendimento', v_item.id, 'pagamento_registrado',
    jsonb_build_object('valor', p_valor, 'metodo', p_metodo)
  );

  return v_item;
end;
$$;

create or replace function public.conferir_periodo_financeiro(p_periodo text)
returns public.financeiro_periodos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_institution uuid;
  v_row public.financeiro_periodos;
begin
  select institution_id into v_institution
  from public.perfis
  where id = auth.uid()
    and status = 'ativo'
    and role in ('financeiro','admin','owner');

  if v_institution is null then
    raise exception 'Sem permissão';
  end if;

  insert into public.financeiro_periodos(
    institution_id, periodo, status, conferido_by, conferido_at
  ) values (
    v_institution, p_periodo, 'conferido', auth.uid(), now()
  )
  on conflict (institution_id, periodo) do update
  set status = 'conferido',
      conferido_by = auth.uid(),
      conferido_at = now(),
      updated_at = now()
  returning * into v_row;

  insert into public.auditoria(institution_id, actor_id, entidade, entidade_id, acao, detalhes)
  values (
    v_institution, auth.uid(), 'financeiro_periodo', v_row.id, 'periodo_conferido',
    jsonb_build_object('periodo', p_periodo)
  );

  return v_row;
end;
$$;

revoke all on function public.financeiro_listar_pacientes() from public, anon;
revoke all on function public.admin_atualizar_perfil(uuid,text,text,text,text,text) from public, anon;
revoke all on function public.registrar_presenca(uuid,text) from public, anon;
revoke all on function public.salvar_rascunho_avaliacao(uuid,integer,jsonb) from public, anon;
revoke all on function public.concluir_avaliacao(uuid,integer,jsonb) from public, anon;
revoke all on function public.registrar_pagamento_financeiro(uuid,numeric,text,text) from public, anon;
revoke all on function public.conferir_periodo_financeiro(text) from public, anon;

grant execute on function public.financeiro_listar_pacientes() to authenticated;
grant execute on function public.admin_atualizar_perfil(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.registrar_presenca(uuid,text) to authenticated;
grant execute on function public.salvar_rascunho_avaliacao(uuid,integer,jsonb) to authenticated;
grant execute on function public.concluir_avaliacao(uuid,integer,jsonb) to authenticated;
grant execute on function public.registrar_pagamento_financeiro(uuid,numeric,text,text) to authenticated;
grant execute on function public.conferir_periodo_financeiro(text) to authenticated;
