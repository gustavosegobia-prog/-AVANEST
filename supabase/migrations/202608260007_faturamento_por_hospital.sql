-- ============================================================================
-- Faturamento por hospital, e quem paga cada paciente
--
-- Duas notas saem do mesmo mês e não podem sair da mesma lista: a de plantão
-- é a hora trabalhada, e a de faturamento é o ato anestésico. Hoje a produção
-- só sabe o convênio; para emitir nota separada por hospital falta saber DE
-- QUAL hospital é cada linha, e falta saber QUEM PAGA — porque o mesmo
-- hospital tem paciente que paga direto ao anestesiologista, paciente cuja
-- conta vai para o hospital e paciente que o convênio paga.
--
-- São duas perguntas diferentes e por isso duas colunas. O convênio já existe
-- e continua existindo: um paciente pode ser "Unimed" e mesmo assim ser pago
-- direto, quando o combinado é esse.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- De qual hospital é a linha
-- ---------------------------------------------------------------------------
-- Coluna própria, e não derivada do plantão, porque anestesia fora de plantão
-- existe — cirurgia eletiva agendada, favor para um colega — e é justamente o
-- caso em que a cobrança é mais fácil de esquecer. Derivar do plantão deixaria
-- essas linhas sem hospital, e elas sumiriam da nota.
alter table public.producao_do_dia
  add column if not exists local_id uuid references public.locais_atendimento(id) on delete set null;

comment on column public.producao_do_dia.local_id is
  'Hospital onde o ato foi feito. Separado do plantão porque anestesia fora de plantão existe.';

-- O que já está no banco ganha o hospital do plantão de onde saiu. O que não
-- veio de plantão fica sem, e a tela pede — inventar aqui seria pôr paciente
-- na nota do hospital errado.
update public.producao_do_dia pr
   set local_id = p.local_id
  from public.plantoes p
 where pr.plantao_id = p.id
   and pr.local_id is null
   and p.local_id is not null;

create index if not exists producao_por_local_idx
  on public.producao_do_dia (institution_id, local_id, data);

-- ---------------------------------------------------------------------------
-- Quem paga
-- ---------------------------------------------------------------------------
-- Nulo é um estado legítimo: quer dizer "ainda não decidi". A tela de impressão
-- mostra essas linhas separadas, para a pessoa escolher antes de emitir — e não
-- as inclui numa nota por engano. Um padrão qualquer aqui faria o sistema
-- decidir sozinho para quem a nota vai, que é a única coisa que ele não pode
-- fazer.
alter table public.producao_do_dia
  add column if not exists pagador text
    check (pagador is null or pagador in ('direto','hospital','convenio'));

comment on column public.producao_do_dia.pagador is
  'Quem paga este ato: direto (o paciente paga ao anestesiologista), hospital '
  '(entra na conta do hospital) ou convenio (a operadora paga). Nulo = ainda '
  'não decidido; a folha de faturamento separa essas linhas em vez de adivinhar.';
