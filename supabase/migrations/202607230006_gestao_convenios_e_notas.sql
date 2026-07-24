-- Gestão de valores de convênios e acompanhamento de notas fiscais.

alter table public.financeiro_atendimentos
  add column if not exists nota_emitida_at date,
  add column if not exists nota_vencimento_at date,
  add column if not exists nota_reprogramada_at date;

create table if not exists public.convenio_valores (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  convenio text not null,
  procedimento text,
  hospital text,
  valor numeric(12,2) not null check (valor >= 0),
  repasse_percentual numeric(5,2) check (repasse_percentual between 0 and 100),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists convenio_valores_institution_idx
  on public.convenio_valores(institution_id, convenio, ativo);

alter table public.convenio_valores enable row level security;

drop policy if exists "admin_gerencia_valores_convenio" on public.convenio_valores;
create policy "admin_gerencia_valores_convenio"
on public.convenio_valores for all to authenticated
using (public.current_institution_id() = institution_id and public.current_app_role() in ('admin','owner'))
with check (public.current_institution_id() = institution_id and public.current_app_role() in ('admin','owner'));

drop policy if exists "financeiro_le_valores_convenio" on public.convenio_valores;
create policy "financeiro_le_valores_convenio"
on public.convenio_valores for select to authenticated
using (public.current_institution_id() = institution_id and public.current_app_role() in ('financeiro','admin','owner'));
