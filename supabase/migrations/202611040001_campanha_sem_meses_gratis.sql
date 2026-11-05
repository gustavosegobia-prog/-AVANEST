-- A campanha deixa de ter meses grátis (04/11/2026).
--
-- Desde 27/10/2026 o período grátis é o teste de 15 dias
-- (fim_do_teste_gratis(), migração 202610280002), e o checkout já não somava
-- os meses da campanha: manda `mesesGratis: 0` e cobra no fim do teste
-- (app/api/assinatura/checkout/route.ts). Mas a linha da campanha continuava
-- gravada como "2 meses grátis", com meses_gratis = 2 — e a tela de planos do
-- super-admin mostrava "Meses grátis concedidos: 2", que não é mais verdade
-- para ninguém.
--
-- O que esta migração NÃO faz, de propósito: mexer nos testes que já estão
-- correndo. Quem começou o teste antigo, sem cartão, segue com a data que
-- recebeu no cadastro (decisão do responsável em 04/11/2026). O prazo é
-- gravado em instituicoes.assinatura_ate, e nada aqui o recalcula.
--
-- Não apaga nada: só troca dois valores de configuração na linha única.

update public.campanha_fundador
set meses_gratis = 0,
    rotulo = 'Preço Fundador',
    updated_at = now()
where id;

comment on column public.campanha_fundador.meses_gratis is
  'Sem uso desde 27/10/2026: o período grátis é o teste de 15 dias (fim_do_teste_gratis). Fica 0.';
