-- ============================================================================
-- Glosa até aqui era só um status e um valor. Ganha um recurso.
--
-- Marcar um atendimento como "glosa" registrava QUE o convênio recusou pagar
-- e QUANTO — mas nada sobre o que acontece depois. Recorrer de uma glosa tem
-- prazo (perde o direito depois de um certo número de dias), motivo (o que
-- se está alegando) e desfecho (aceito, negado, ainda em análise) — nenhum
-- dos três tinha onde morar.
--
-- Não há um único registro de glosa em produção ainda (checado antes desta
-- migração: zero linhas com status='glosa' ou glosa_valor>0 em toda a
-- plataforma) — glosa_valor em si só existe desde a rodada anterior desta
-- sessão. Por isso o desenho aqui é deliberadamente enxuto: status do
-- recurso, prazo e motivo. Nada de fluxo de reenvio ao convênio, anexo de
-- documento ou histórico de tentativas — sem um caso real para observar,
-- construir mais do que isso seria assumir como o processo funciona em vez
-- de descobrir.
-- ============================================================================

alter table public.financeiro_atendimentos
  add column if not exists glosa_recurso_status text not null default 'sem_recurso'
    check (glosa_recurso_status in ('sem_recurso','em_recurso','aceito','negado')),
  add column if not exists glosa_recurso_prazo date,
  add column if not exists glosa_recurso_motivo text;

comment on column public.financeiro_atendimentos.glosa_recurso_status is
  'sem_recurso = ainda não recorrido; em_recurso = recurso enviado, aguardando resposta do convênio; aceito = convênio revisou e vai pagar; negado = convênio manteve a glosa.';
comment on column public.financeiro_atendimentos.glosa_recurso_prazo is
  'Data limite para entrar com o recurso, quando o convênio ou o contrato define um prazo. Opcional — nem todo convênio informa isso.';
comment on column public.financeiro_atendimentos.glosa_recurso_motivo is
  'O que está sendo alegado no recurso — texto livre, preenchido por quem está recorrendo.';
