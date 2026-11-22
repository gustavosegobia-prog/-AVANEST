-- InovaNest (22/11/2026, pelo responsável): o SUS não paga — conta só pela
-- quantidade, em R$ 0,00 —, e o SUS C (SUS-Campanha) paga R$ 250,00.
--
-- O SUS fica marcado como gratuito na tabela de preços: não é preço que
-- falta, e o Financeiro deixa de contá-lo como "sem valor".
update public.convenio_valores
   set gratuito = true, updated_at = now()
 where institution_id in (select id from public.instituicoes where nome ilike 'INOVANEST%')
   and public.nome_simples(convenio) = 'sus'
   and procedimento is null and hospital is null and valor = 0;

-- Os lançamentos em R$ 0,00 de convênio com preço na tabela (hoje, só os 4 de
-- SUS C do dia 21/11) recebem o preço. O que já foi faturado ou recebido não
-- muda.
update public.producao_do_dia pd
   set valor = cv.valor, updated_at = now()
  from public.convenio_valores cv
 where cv.institution_id = pd.institution_id and cv.ativo
   and cv.procedimento is null and cv.hospital is null and cv.valor > 0
   and public.nome_simples(cv.convenio) = public.nome_simples(pd.convenio)
   and pd.valor = 0 and pd.recebido_em is null and pd.faturado_em is null;
