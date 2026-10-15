// ===========================================================================
// Dois meses grátis — desde 15/10/2026, com o cartão cadastrado no início
// ===========================================================================
// A campanha começou como "use por 2 meses grátis e após, se gostar, assine",
// sem cartão. Em 15/10/2026 mudou: os 2 meses continuam grátis, mas quem
// cria uma organização cadastra o cartão antes de entrar, e a primeira
// cobrança só vence no fim dos 2 meses. Quem começou o teste antes, sem
// cartão, segue com o combinado naquele cadastro — ver `faltaCartao`.
//
// O que segue é a história do teste sem cartão, e continua valendo para ele.
//
// A campanha é essa frase, e ela obriga o sistema a três coisas que ele não
// fazia:
//
//   1. O teste precisa TER PRAZO. A coluna `plano` já nascia 'trial', mas
//      `assinatura_ate` ficava nula — não havia data nenhuma, e o login mandava
//      todo mundo em 'trial' direto para a tela de pagamento. Na prática não
//      existia teste: existia uma porta fechada, e o Gustavo abria uma a uma,
//      na mão, marcando cada organização como 'cortesia'.
//
//   2. O prazo precisa APARECER. Um teste que corre escondido acaba de
//      surpresa, e quem é surpreendido não assina: reclama.
//
//   3. O fim do prazo NÃO PODE APAGAR NADA. Em dois meses uma pessoa cadastra
//      centenas de pacientes com dado de saúde. O que acaba é o acesso de
//      escrita, não o dado — ver os Termos de Uso, seção "Guarda e exclusão".
//
// ---------------------------------------------------------------------------
// POR QUE POR MÊS FECHADO, E NÃO POR 60 DIAS CORRIDOS
//
// O valor deste sistema chega atrasado. A pessoa faz o plantão em outubro,
// emite a nota em novembro e recebe em dezembro; é só no terceiro momento que
// ela entende para que serve a tela do dinheiro. Sessenta dias corridos
// contados de 28 de setembro entregam DOIS DIAS do primeiro mês — e quem
// entrasse no dia 28 conheceria metade do produto que quem entrou no dia 1º.
//
// Contando até o fim do segundo mês seguinte, todo mundo vive dois fechamentos
// inteiros, entre quem entra no dia 1º e quem entra no dia 30. Ninguém recebe
// menos do que a frase promete: quem entra em 28/09 vai até 30/11, que são
// dois meses e dois dias.
// ===========================================================================

/** Quantos meses cheios o teste dura, além do mês em que a pessoa entrou. */
export const MESES_DE_TESTE = 2;

/**
 * Até quando vai o teste de quem se cadastra agora.
 *
 * Devolve o ÚLTIMO INSTANTE do último dia, e não a meia-noite do primeiro: com
 * a meia-noite, quem abrisse o sistema às nove da manhã do dia 30 encontraria
 * a conta já vencida — um dia a menos do que o combinado, no dia em que a
 * pessoa está justamente decidindo se assina.
 */
export function fimDoTeste(entrouEm: Date): Date {
  // Dia 0 do mês seguinte ao último = o último dia do último mês. É a forma de
  // não precisar saber quantos dias tem cada mês nem se o ano é bissexto.
  const fim = new Date(Date.UTC(
    entrouEm.getUTCFullYear(), entrouEm.getUTCMonth() + MESES_DE_TESTE + 1, 0,
    23, 59, 59, 999,
  ));
  return fim;
}

/**
 * Quantos dias inteiros ainda faltam.
 *
 * Arredondado para CIMA, e é o que a pessoa espera: faltando trinta horas, ela
 * lê "faltam 2 dias" e não "falta 1". Arredondar para baixo faria a tela dizer
 * "falta 1 dia" na antevéspera, e depois "falta 1 dia" de novo na véspera.
 */
export function diasQueFaltam(ate: Date, agora: Date): number {
  const dia = 86_400_000;
  return Math.max(0, Math.ceil((ate.getTime() - agora.getTime()) / dia));
}

export type EstadoDoTeste =
  /** Ainda corre, e falta bastante: a tela não precisa dizer nada. */
  | { fase: "correndo"; dias: number }
  /** Está perto do fim. A tela mostra a faixa e o sino avisa. */
  | { fase: "acabando"; dias: number }
  /** Acabou. Entra o modo somente-leitura. */
  | { fase: "acabou"; dias: 0 };

/**
 * A partir de quantos dias restantes a tela começa a falar.
 *
 * Quinze dias porque é o tempo de conversar com o contador, olhar o preço e
 * decidir sem pressa. Avisar no último dia não é avisar, é cobrar.
 */
export const DIAS_PARA_AVISAR = 15;

export function estadoDoTeste(ate: Date, agora: Date): EstadoDoTeste {
  const dias = diasQueFaltam(ate, agora);
  if (dias <= 0) return { fase: "acabou", dias: 0 };
  if (dias <= DIAS_PARA_AVISAR) return { fase: "acabando", dias };
  return { fase: "correndo", dias };
}

/** "30 de novembro de 2026" — como a data aparece escrita na tela. */
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
               "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * O instante a partir do qual organização nova cadastra o cartão para começar.
 *
 * Quem criou a organização antes disso entrou com a promessa de "sem cartão",
 * e a promessa é cumprida: o teste dela corre como sempre correu. Quem cria
 * depois passa pela assinatura antes de entrar — o Stripe guarda o cartão, e a
 * primeira cobrança vence no fim do teste (`trial_end` = `assinatura_ate`).
 */
export const CARTAO_NO_CADASTRO_DESDE = new Date("2026-10-15T17:35:00Z");

/**
 * Esta organização ainda precisa cadastrar o cartão para começar os 2 meses?
 *
 * Só o teste nascido depois do corte. Cadastrado o cartão, o Stripe confirma o
 * checkout, o banco grava a assinatura como 'ativo' com a validade no fim do
 * período grátis, e a organização sai daqui. Cortesia, plano pago e o teste
 * antigo nunca entram.
 *
 * É a mesma pergunta no login, no painel, na tela da assinatura e na volta do
 * pagamento: uma regra só, para a porta e o painel não discordarem.
 */
export function faltaCartao(org: { plano?: string | null; criadaEm?: string | Date | null } | null | undefined): boolean {
  if (!org || org.plano !== "trial" || !org.criadaEm) return false;
  const criada = new Date(org.criadaEm);
  return Number.isFinite(criada.getTime()) && criada.getTime() >= CARTAO_NO_CADASTRO_DESDE.getTime();
}

export const dataPorExtenso = (quando: Date) =>
  `${quando.getUTCDate()} de ${MESES[quando.getUTCMonth()]} de ${quando.getUTCFullYear()}`;

/**
 * O que a faixa do topo diz.
 *
 * UMA FRASE SÓ, e ela muda de tom conforme o prazo. Enquanto sobra tempo, ela
 * informa; perto do fim, ela chama para a ação. O texto não implora em momento
 * nenhum: quem está testando não deve nada a ninguém, e um aviso que soa a
 * cobrança faz a pessoa fechar a aba antes de ver o produto.
 */
export function fraseDoTeste(estado: EstadoDoTeste, ate: Date): string {
  if (estado.fase === "acabou") {
    return "Seu teste terminou. Seus dados continuam aqui, e voltam a ser editáveis "
      + "assim que você assinar.";
  }
  const quanto = estado.dias === 1 ? "Falta 1 dia" : `Faltam ${estado.dias} dias`;
  if (estado.fase === "acabando") {
    return `${quanto} de teste grátis — até ${dataPorExtenso(ate)}. `
      + "Assine para continuar lançando.";
  }
  // Só o teste antigo chega aqui (o novo já entra com a assinatura), e para ele
  // a frase continua verdadeira: não há cartão nem cobrança automática.
  return `Teste grátis até ${dataPorExtenso(ate)}. Sem cartão, sem cobrança automática.`;
}
