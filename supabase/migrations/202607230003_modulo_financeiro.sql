create table if not exists public.financeiro_atendimentos (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete restrict,
  patient_id uuid not null references public.pacientes(id) on delete restrict,
  avaliacao_id uuid references public.avaliacoes(id) on delete set null,
  medico_id uuid references public.perfis(id) on delete set null,
  convenio text not null default 'Particular',
  hospital text,
  valor numeric(12,2) not null default 0 check (valor >= 0),
  recebido numeric(12,2) not null default 0 check (recebido >= 0),
  status text not null default 'aguardando' check (status in ('aguardando','pago','glosa','cancelado')),
  nota_fiscal text,
  lote text,
  data_recebimento date,
  repasse_valor numeric(12,2) not null default 0 check (repasse_valor >= 0),
  repasse_status text not null default 'pendente' check (repasse_status in ('pendente','pago','aguardando_recebimento')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, patient_id, avaliacao_id)
);

create table if not exists public.financeiro_pagamentos (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.instituicoes(id) on delete restrict,
  atendimento_id uuid not null references public.financeiro_atendimentos(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  metodo text not null check (metodo in ('PIX','Dinheiro','Cartão','Transferência','Outro')),
  referencia text,
  created_by uuid references public.perfis(id) on delete set null,
  paid_at timestamptz not null default now()
);

create index if not exists financeiro_atendimentos_institution_idx on public.financeiro_atendimentos(institution_id);
create index if not exists financeiro_atendimentos_patient_idx on public.financeiro_atendimentos(patient_id);
create index if not exists financeiro_pagamentos_atendimento_idx on public.financeiro_pagamentos(atendimento_id);

alter table public.financeiro_atendimentos enable row level security;
alter table public.financeiro_pagamentos enable row level security;

drop policy if exists "financeiro_e_admin_gerenciam_atendimentos" on public.financeiro_atendimentos;
create policy "financeiro_e_admin_gerenciam_atendimentos"
on public.financeiro_atendimentos for all to authenticated
using (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = financeiro_atendimentos.institution_id
      and p.role in ('financeiro','admin','owner')
  )
)
with check (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = financeiro_atendimentos.institution_id
      and p.role in ('financeiro','admin','owner')
  )
);

drop policy if exists "financeiro_e_admin_gerenciam_pagamentos" on public.financeiro_pagamentos;
create policy "financeiro_e_admin_gerenciam_pagamentos"
on public.financeiro_pagamentos for all to authenticated
using (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = financeiro_pagamentos.institution_id
      and p.role in ('financeiro','admin','owner')
  )
)
with check (
  exists (
    select 1 from public.perfis p
    where p.id = auth.uid()
      and p.institution_id = financeiro_pagamentos.institution_id
      and p.role in ('financeiro','admin','owner')
  )
);
