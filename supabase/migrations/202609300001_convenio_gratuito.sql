-- ============================================================================
-- Preço zero por DECISÃO, e não por esquecimento
--
-- A interface já sabia dizer "R$ 0,00 ativo" — mas não sabia se aquilo era
-- gratuidade de verdade (SUS que não cobra do serviço, cortesia combinada) ou
-- um convênio que nasceu na tabela e ninguém precificou ainda. Os dois tinham
-- a mesma cara: selo "ATIVO", mesmo verde de quem cobra R$ 380,00.
--
-- A auditoria de 29/09 achou os doze convênios da INOVANEST todos a R$ 0,00 —
-- e nenhum deles era decisão: era tabela recém-criada, esperando ser
-- preenchida. "Preço pendente" resolveu ISSO. O que faltava era o outro lado:
-- quando existir de fato um convênio gratuito, a pessoa precisa poder dizer
-- isso — e a interface parar de cobrar preço de uma linha que nunca vai ter.
-- ============================================================================

alter table public.convenio_valores
  add column if not exists gratuito boolean not null default false;

comment on column public.convenio_valores.gratuito is
  'true = preço zero por decisão (SUS/cortesia); false = os R$ 0,00, quando houver, são preço ainda não preenchido. Só importa quando valor = 0 — não muda nada num convênio que cobra.';
