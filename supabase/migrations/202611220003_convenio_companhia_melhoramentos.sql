-- "CAMP DE MELHORAMENTO" e "COMP MELHORAMENTO" são o mesmo convênio (22/11/2026,
-- confirmado pelo responsável: "sim"). Ficam com o nome que o mapa cirúrgico do
-- hospital usa, "Companhia Melhoramentos" — que também entra na lista de
-- sugestões (lib/convenios.ts), para não ser digitado de um terceiro jeito.
--
-- SUS e SUS C continuam separados (também confirmado).

update public.producao_do_dia
   set convenio = 'Companhia Melhoramentos', updated_at = now()
 where public.nome_simples(convenio) in (public.nome_simples('CAMP DE MELHORAMENTO'), public.nome_simples('COMP MELHORAMENTO'));
