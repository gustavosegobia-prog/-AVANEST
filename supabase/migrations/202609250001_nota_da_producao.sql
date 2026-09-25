-- ============================================================================
-- A data da nota do ato anestésico
--
-- A produção do dia já tinha os quatro estados certos — a_cobrar, faturado,
-- recebido, glosado — e desde agosto tem `recebido_em`, o dia em que o dinheiro
-- caiu. Faltava o par dela: o dia em que a NOTA SAIU.
--
-- É exatamente o buraco que o plantão teve até a migração
-- 202609100001_nota_do_plantao.sql, e pelo mesmo motivo ele importa:
--
--   Sem nota emitida, quem deve uma ação é você — o hospital não tem o que
--   pagar enquanto o documento não sai.
--
--   Com a nota emitida, quem deve é o hospital, e o que resta é cobrar.
--
-- Somados num "a receber" só, os dois se escondem um no outro. E "faturado"
-- sem data é uma bandeira sem idade: não dá para saber se a nota saiu ontem —
-- e aí esperar é o normal — ou em julho, e aí o telefonema está atrasado há
-- dois meses.
-- ============================================================================

alter table public.producao_do_dia
  add column if not exists faturado_em date;

comment on column public.producao_do_dia.faturado_em is
  'Dia em que a nota do ato anestésico foi emitida. Nulo enquanto a nota não sair.';

-- Quem já estava marcado como faturado antes desta coluna existir não tem data
-- nenhuma, e apareceria para sempre como "nota sem idade". A data do ato é a
-- melhor aproximação disponível — é conservadora, e faz a nota parecer mais
-- VELHA do que é, que é o erro que gera o telefonema em vez de esconder a
-- cobrança esquecida.
--
-- SÓ O QUE ESTÁ "faturado". Quem foi marcado direto como recebido ou glosado
-- pode nunca ter tido nota emitida por aqui, e carimbar uma data nesses seria
-- inventar um documento que talvez não exista.
update public.producao_do_dia
   set faturado_em = data
 where situacao = 'faturado' and faturado_em is null;

-- O lembrete pergunta "o que tem nota e ainda não caiu". Sem índice, isso
-- varre a tabela inteira a cada abertura do Financeiro.
create index if not exists producao_com_nota_sem_receber
  on public.producao_do_dia (institution_id, perfil_id, faturado_em)
  where situacao = 'faturado';
