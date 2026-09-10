-- ============================================================================
-- O passo que faltava entre trabalhar e receber: a nota
--
-- O plantão pulava de `realizado` direto para `pago`, e com isso o sistema não
-- sabia dizer a única coisa que muda o que fazer a seguir: DE QUEM é a demora.
--
--   Sem nota emitida, quem está devendo uma ação é você — o hospital não tem
--   o que pagar enquanto o documento não sai.
--
--   Com a nota emitida, quem deve é o hospital, e o que resta é cobrar.
--
-- Somados num "sem receber" só, os dois desaparecem um no outro. E o segundo é
-- justamente o que precisa de lembrete: nota emitida em agosto e esquecida é
-- dinheiro parado que ninguém do outro lado vai lembrar de mandar.
--
-- A PRODUÇÃO JÁ TINHA ISSO, com os mesmos três estados — a_cobrar, faturado,
-- pago. O plantão ficou para trás por acidente, não por decisão: é o mesmo
-- fluxo, com o mesmo nome, e agora com a mesma régua.
-- ============================================================================

alter table public.plantoes
  drop constraint if exists plantoes_situacao_check;

alter table public.plantoes
  add constraint plantoes_situacao_check
  check (situacao in ('escalado', 'realizado', 'faturado', 'pago', 'cancelado'));

-- A DATA DA EMISSÃO, e não só o estado.
--
-- Sem ela, "com nota" é uma bandeira sem idade: não dá para saber se a nota
-- saiu ontem — e aí esperar é o normal — ou em julho, e aí o telefonema está
-- atrasado há dois meses. É a mesma razão pela qual `pago_em` existe ao lado
-- de `pago`.
alter table public.plantoes
  add column if not exists faturado_em date;

comment on column public.plantoes.faturado_em is
  'Dia em que a nota do plantão foi emitida. Nulo enquanto a nota não sair.';

-- A consulta do lembrete pergunta "o que tem nota e ainda não caiu".
create index if not exists plantoes_com_nota_sem_pagar
  on public.plantoes (perfil_id, situacao, faturado_em)
  where situacao = 'faturado';
