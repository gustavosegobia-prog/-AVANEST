-- ============================================================================
-- Idade informada
--
-- Nem sempre a data de nascimento está à mão: o idoso que não lembra, a ficha
-- de internação que só traz "78 anos", o encaixe de última hora. Antes disso
-- aqui, a avaliação travava — a etapa 1 só fechava com data de nascimento, e
-- sem ela o STOP-Bang e a via aérea pediátrica ficavam sem idade.
--
-- A coluna nova é o segundo caminho, não um substituto. Quando as duas
-- existem, quem manda é a data de nascimento: ela é exata e continua exata no
-- mês que vem, enquanto a idade digitada é a fotografia do dia em que alguém
-- digitou. Essa precedência é decidida em lib/idade.ts, num lugar só, com
-- teste — e não repetida em cada tela.
-- ============================================================================

alter table public.pacientes
  add column if not exists idade_anos integer;

-- 0 é idade válida: recém-nascido opera. O teto acompanha o mesmo limite que
-- o cálculo por data de nascimento aplica.
alter table public.pacientes
  drop constraint if exists pacientes_idade_anos_plausivel;
alter table public.pacientes
  add constraint pacientes_idade_anos_plausivel
  check (idade_anos is null or (idade_anos >= 0 and idade_anos <= 130));

comment on column public.pacientes.idade_anos is
  'Idade em anos, digitada quando não há data de nascimento. A data de nascimento tem precedência — ver lib/idade.ts.';
