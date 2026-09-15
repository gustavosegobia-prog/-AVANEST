// ===========================================================================
// O que cada pessoa quer que toque no telefone dela
// ===========================================================================
// Até aqui o sistema tinha um interruptor só: notificação ligada ou desligada,
// tudo junto. Quem se incomodava com um aviso desligava todos — inclusive o
// pedido de troca da sexta-feira, que é justamente o que ninguém quer perder.
// Um interruptor único não é uma preferência: é uma escolha entre ruído e
// silêncio.
//
// ---------------------------------------------------------------------------
// AUSÊNCIA QUER DIZER LIGADO, E ISSO É A REGRA CENTRAL DESTE ARQUIVO
//
// `comPadrao(null)` devolve tudo ligado, e o mesmo vale para chave que falta
// dentro do objeto guardado. Três coisas saem de graça daí:
//
//   1. Nenhuma conta precisa ser migrada. As dezenas que já existem não têm
//      linha nenhuma gravada e continuam recebendo tudo, como recebiam ontem.
//   2. Conta nova nasce certa sem ninguém gravar nada na criação — que é o que
//      o pedido chama de "configuração padrão para novos usuários".
//   3. Preferência NOVA, acrescentada daqui a seis meses, nasce ligada para
//      quem já salvou as de hoje. Sem isso, quem mexeu nas preferências uma vez
//      deixaria de receber toda categoria criada depois, e o defeito só
//      apareceria como "não recebi o aviso" meses adiante.
//
// O preço é que "desligado" tem de ser gravado explicitamente como `false`.
// É o preço certo: o silêncio é que precisa ser uma decisão, não o toque.
// ===========================================================================

/**
 * As preferências de uma pessoa. Todas booleanas, todas verdadeiras por padrão.
 *
 * Só existe aqui o que a pessoa PODE desligar. Aviso de suporte respondido e
 * mensagem da sala da equipe não têm interruptor: o primeiro é resposta a algo
 * que ela mesma pediu, e o segundo ela silencia saindo da conversa. Inventar
 * interruptor para tudo transforma a tela de preferências numa mesa de som.
 */
export type PreferenciasDeAviso = {
  /** A escala do mês entrou no ar e a pessoa tem plantão nela. */
  escala_publicada: boolean;
  /** "Plantão hoje às 19h" — ver lib/lembrete-de-plantao.ts. */
  lembrete_plantao: boolean;
  /** Mudou data, horário ou local de um plantão dela. */
  plantao_alterado: boolean;
  /** Um plantão dela foi cancelado. */
  plantao_cancelado: boolean;
  /** Troca, repasse, oferta aberta e resposta a oferta. */
  plantao_trocado: boolean;
  /** O telefone pode fazer barulho, ou a notificação chega calada. */
  som: boolean;
  /** Vibra, onde o aparelho souber vibrar. O iPhone ignora; ver o sw.js. */
  vibracao: boolean;
};

export const PADRAO: PreferenciasDeAviso = {
  escala_publicada: true,
  lembrete_plantao: true,
  plantao_alterado: true,
  plantao_cancelado: true,
  plantao_trocado: true,
  som: true,
  vibracao: true,
};

export const CHAVES = Object.keys(PADRAO) as (keyof PreferenciasDeAviso)[];

/**
 * O que veio do banco, completado com o padrão.
 *
 * Aceita nulo, objeto pela metade e lixo — inclusive um array ou uma string,
 * que é o que sobra quando alguém edita a coluna à mão. Em todos os casos o
 * que falta vira `true`: a única forma de desligar é um `false` gravado.
 *
 * Só `false` desliga, e não qualquer valor falso. `0`, `""` e `null` dentro do
 * objeto são lixo, não decisão, e tratá-los como "desligado" silenciaria o
 * telefone de alguém por causa de um dado malformado.
 */
export function comPadrao(guardado: unknown): PreferenciasDeAviso {
  const fonte = (guardado && typeof guardado === "object" && !Array.isArray(guardado))
    ? guardado as Record<string, unknown>
    : {};
  const saida = { ...PADRAO };
  for (const chave of CHAVES) {
    if (fonte[chave] === false) saida[chave] = false;
  }
  return saida;
}

/** Só as chaves conhecidas, só booleanos — é o que vai para o banco. */
export function paraGravar(escolhas: PreferenciasDeAviso): Record<string, boolean> {
  const saida: Record<string, boolean> = {};
  for (const chave of CHAVES) saida[chave] = escolhas[chave] !== false;
  return saida;
}

/**
 * Que tipos de notificação o sistema manda, e qual interruptor governa cada um.
 *
 * O tipo é a string que as rotas de push já usam (`troca`, `escala`, ...), para
 * não existir um segundo vocabulário paralelo ao que está no código de envio.
 *
 * O que NÃO está neste mapa não tem interruptor e sempre toca. É decisão, não
 * esquecimento: ver o comentário no tipo lá em cima.
 */
export const INTERRUPTOR: Record<string, keyof PreferenciasDeAviso> = {
  escala: "escala_publicada",
  lembrete_plantao: "lembrete_plantao",
  plantao_alterado: "plantao_alterado",
  // Um plantão APARECER na sua escala é a forma mais forte de ela ser
  // alterada, e por isso divide o mesmo interruptor: separar os dois daria
  // duas linhas quase idênticas na tela, e quem desligasse "alterado" ficaria
  // recebendo "lançaram um plantão para você" sem entender por quê.
  plantao_novo: "plantao_alterado",
  plantao_cancelado: "plantao_cancelado",
  // Oferta, convite e resposta são a mesma história para quem recebe: o
  // plantão está trocando de mãos.
  troca: "plantao_trocado",
  troca_resolvida: "plantao_trocado",
};

/** Esta pessoa quer receber este tipo de aviso? */
export function aceita(preferencias: PreferenciasDeAviso, tipo: string): boolean {
  const chave = INTERRUPTOR[tipo];
  return chave ? preferencias[chave] !== false : true;
}

/**
 * Como a notificação deve chegar: com som, vibrando, ou calada.
 *
 * Vai junto do conteúdo e é o service worker que aplica, porque é ele quem
 * mostra a notificação — e ele roda com o aplicativo fechado, sem acesso a
 * nada que esteja guardado na página.
 */
export const comoTocar = (preferencias: PreferenciasDeAviso) => ({
  silencioso: preferencias.som === false,
  vibrar: preferencias.vibracao !== false,
});

/** Como cada interruptor aparece na tela, e o que ele significa. */
export const ROTULOS: Array<{
  chave: keyof PreferenciasDeAviso;
  grupo: "escala" | "plantao" | "geral";
  titulo: string;
  detalhe: string;
}> = [
  { chave: "escala_publicada", grupo: "escala", titulo: "Nova escala publicada",
    detalhe: "Quando a escala do mês entra no ar e você tem plantão nela." },
  { chave: "lembrete_plantao", grupo: "escala", titulo: "Lembrete de plantão",
    detalhe: "Plantão da noite: aviso às 7h do mesmo dia. Plantão da manhã: às 19h da véspera." },
  { chave: "plantao_alterado", grupo: "plantao", titulo: "Plantão alterado",
    detalhe: "Quando lançam um plantão na sua escala, ou mudam a data, o horário ou o hospital de um plantão seu." },
  { chave: "plantao_cancelado", grupo: "plantao", titulo: "Plantão cancelado",
    detalhe: "Quando um plantão seu é cancelado." },
  { chave: "plantao_trocado", grupo: "plantao", titulo: "Plantão repassado ou trocado",
    detalhe: "Ofertas, convites e respostas — quando um plantão muda de mãos." },
  { chave: "som", grupo: "geral", titulo: "Som",
    detalhe: "Desligado, a notificação aparece sem tocar." },
  { chave: "vibracao", grupo: "geral", titulo: "Vibração",
    detalhe: "Onde o aparelho permitir. O iPhone segue o modo do sistema." },
];
