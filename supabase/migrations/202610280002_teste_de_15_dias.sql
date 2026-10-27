-- ============================================================================
-- O teste grátis passa de dois meses para 15 dias (27/10/2026).
--
-- `fim_do_teste_gratis()` é o único lugar do banco onde o teste tem duração:
-- `criar_organizacao` e o gatilho `protege_assinatura` a chamam (ver
-- 202609160001 — foi um segundo número escrito no gatilho que fez a campanha
-- dos dois meses entregar duas semanas). Trocar a conta aqui troca para todo
-- cadastro novo.
--
-- A conta é a mesma de lib/teste-gratis.ts (`fimDoTeste`): o último instante
-- do 15º dia depois do dia do cadastro. O dia do cadastro não conta.
--
-- Quem já está em teste NÃO muda: o prazo de cada organização foi gravado em
-- instituicoes.assinatura_ate no cadastro, e esta migração não toca nele.
-- ============================================================================

create or replace function public.fim_do_teste_gratis(a_partir_de timestamptz default now())
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select date_trunc('day', a_partir_de) + interval '16 days' - interval '1 microsecond'
$$;

comment on function public.fim_do_teste_gratis(timestamptz) is
  'Fim do teste grátis de 15 dias: o último instante do 15º dia depois do dia do cadastro. Mesma conta de lib/teste-gratis.ts (fimDoTeste).';
