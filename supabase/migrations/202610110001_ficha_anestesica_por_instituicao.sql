-- Ficha anestésica: liberada por instituição.
--
-- Até aqui a ficha (evolução anestésica) tinha duas posições: só o
-- super-admin, ou todo mundo de todas as organizações
-- (recursos_liberados.liberado). Agora há uma terceira: liberada para uma
-- organização. É assim que ela sai do teste no INOVANEST sem aparecer para as
-- outras clínicas.
--
-- Continuam valendo as regras de pode_evolucao(): só a própria instituição e
-- só quem tem acesso clínico (médico, administrador, proprietário). A
-- recepção não entra.

create table if not exists public.recursos_por_instituicao (
  codigo text not null references public.recursos_liberados(codigo) on delete cascade,
  institution_id uuid not null references public.instituicoes(id) on delete cascade,
  liberado_em timestamptz not null default now(),
  primary key (codigo, institution_id)
);
alter table public.recursos_por_instituicao enable row level security;
-- Sem política: só as funções abaixo (security definer) leem.

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
                      where r.codigo = 'evolucao_anestesica' and r.liberado)
           or exists (select 1 from public.recursos_por_instituicao ri
                      where ri.codigo = 'evolucao_anestesica' and ri.institution_id = p.institution_id))
  );
$$;
revoke all on function public.evolucao_liberada() from public;
grant execute on function public.evolucao_liberada() to authenticated;

-- O INOVANEST, pelo nome: o id é gerado, e cada banco tem o seu.
insert into public.recursos_por_instituicao (codigo, institution_id)
select 'evolucao_anestesica', i.id
from public.instituicoes i
where i.nome like 'INOVANEST —%'
on conflict do nothing;
