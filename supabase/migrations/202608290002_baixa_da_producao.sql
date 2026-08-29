-- ============================================================================
-- A baixa da produção
--
-- A coluna `situacao` existe desde que a produção do dia nasceu, com os quatro
-- estados certos — a_cobrar, faturado, recebido, glosado — e a tela já somava o
-- total do que estava "recebido". Só que não havia por onde MARCAR: nenhum
-- controle da interface escrevia nessa coluna. Na prática, todo ato anestésico
-- ficava "a cobrar" para sempre, e o dinheiro que caía na conta não tinha onde
-- ser registrado.
--
-- Falta a data. É o mesmo defeito que a Escala já teve e que foi corrigido lá:
-- um plantão "pago" sem `pago_em` é um plantão que o fechamento do mês não
-- consegue somar no mês certo. A produção recebida em setembro de uma cirurgia
-- de agosto pertence ao caixa de SETEMBRO — e sem esta coluna não havia como
-- saber disso.
-- ============================================================================

alter table public.producao_do_dia
  add column if not exists recebido_em date;

comment on column public.producao_do_dia.recebido_em is
  'Dia em que o dinheiro caiu. Nulo enquanto não recebido. É a competência de CAIXA, diferente da data do ato.';

-- Quem já estava marcado como recebido antes desta coluna existir não tem data
-- nenhuma, e ficaria fora de qualquer fechamento por caixa. A data do ato é a
-- melhor aproximação disponível — é conservadora e não inventa mês nenhum.
update public.producao_do_dia
   set recebido_em = data
 where situacao = 'recebido' and recebido_em is null;

-- O fechamento por caixa pergunta "o que entrou neste mês?", e sem índice isso
-- varre a tabela inteira a cada abertura do Financeiro.
create index if not exists producao_recebida_em
  on public.producao_do_dia (institution_id, recebido_em)
  where recebido_em is not null;
