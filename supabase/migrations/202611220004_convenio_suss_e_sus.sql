-- "SusS" era SUS digitado errado (22/11/2026). Uma linha no cadastro do
-- paciente e o lançamento que herdou o nome dele. Quem lançou tem seis de SUS
-- no mesmo hospital e nenhum de SUS C, e o valor é R$ 0,00 como em todos os de
-- SUS.
--
-- SUS e SUS C continuam separados: SUS C é o SUS-Campanha, que paga outro
-- valor (confirmado pelo responsável).

update public.pacientes
   set convenio = 'SUS'
 where convenio = 'SusS';

update public.producao_do_dia
   set convenio = 'SUS', updated_at = now()
 where convenio = 'SusS';
