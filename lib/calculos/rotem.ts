/**
 * ROTEM — interpretação estruturada e classes de conduta.
 *
 * Transcrição do guia clínico AVANEST de hemostasia viscoelástica, que se
 * apoia em SAESP, Miller, na diretriz europeia de trauma de 2023 e nas fontes
 * de referência de cada plataforma. Como no módulo de PCA, o que a fonte não
 * afirma fica ausente: nenhum gatilho numérico foi inventado.
 *
 * Há intervalos de referência, e eles são por plataforma. Delta e sigma têm
 * ensaios, cartuchos e faixas diferentes, e o guia proíbe transportar um
 * intervalo de uma para a outra — por isso a plataforma é o primeiro campo, e
 * sem ela nenhum número é classificado. Onde a fonte não publicou intervalo,
 * não há classificação automática, e a faixa validada pelo laboratório local
 * prevalece sempre sobre a publicada.
 *
 * Intervalo de referência não é gatilho de transfusão. São camadas
 * diferentes, e o módulo nunca deixa uma virar a outra.
 *
 * Duas separações que o módulo mantém de pé:
 *   1. interpretação do traçado  ×  protocolo terapêutico aprovado;
 *   2. classe de intervenção a considerar  ×  produto, dose e limiar.
 * A segunda camada de cada par não está aqui, e é de propósito.
 *
 * Fontes:
 *   SAESP, Tratado de Anestesiologia — PDF pp. 5430-5431, 5791.
 *   Miller, Bases da Anestesia, 7ª ed. (2019) — PDF pp. 629-633.
 *   Rossaint R et al. The European guideline on management of major bleeding
 *   and coagulopathy following trauma: sixth edition. Crit Care 2023;27:80.
 */

export type Fonte = { obra: string; local: string };

export const SAESP = (p: string): Fonte => ({ obra: "SAESP, Tratado de Anestesiologia", local: p });
export const MILLER = (p: string): Fonte => ({ obra: "Miller, Bases da Anestesia, 7ª ed.", local: p });
export const EUROPEIA: Fonte = {
  obra: "Diretriz europeia de trauma, 6ª edição",
  local: "Rossaint R et al., Crit Care 2023;27:80",
};

export const citar = (f: Fonte) => `${f.obra} — ${f.local}`;

/* ------------------------------------------------------------------ *
 * Passo 0 — o contexto vem antes do traçado.
 *
 * O guia é explícito: a interface mostra primeiro se há sangramento e se a
 * fonte está controlada. Um ROTEM alterado sem sangramento não indica
 * hemocomponente, e ler o traçado antes disso inverte a ordem da decisão.
 * ------------------------------------------------------------------ */

export type Contexto = {
  sangramentoAtivo?: boolean;
  fonteControlada?: boolean;
  fisiologiaCorrigida?: boolean;
  cenario?: CenarioId;
};

export const PASSO_ZERO: Array<{ chave: keyof Contexto & string; pergunta: string; seNao: string }> = [
  {
    chave: "sangramentoAtivo",
    pergunta: "Há sangramento clinicamente relevante?",
    seNao: "Resultado alterado sem sangramento não é indicação automática de hemocomponente ou concentrado de fator.",
  },
  {
    chave: "fonteControlada",
    pergunta: "A fonte do sangramento está controlada?",
    seNao: "O ROTEM não localiza sangramento cirúrgico. Controle da fonte corre em paralelo, não depois do exame.",
  },
  {
    chave: "fisiologiaCorrigida",
    pergunta: "Temperatura, pH, cálcio iônico e perfusão estão aceitáveis?",
    seNao: "Corrigir junto com a hemostasia. Hipotermia, acidose e hipocalcemia alteram a coagulação e podem não aparecer no ensaio.",
  },
];

export const AVISO_PASSO_ZERO =
  "Interpretar somente diante do contexto: sangramento ativo, fase da cirurgia, anticoagulantes, transfusões e tratamento já realizado.";

/* ------------------------------------------------------------------ *
 * Cenários
 * ------------------------------------------------------------------ */

export type CenarioId = "trauma" | "cardiaca" | "hepatico" | "obstetricia" | "sepse" | "queimado";

export const CENARIOS: Array<{ id: CenarioId; nome: string; utilidade: string; limite: string }> = [
  {
    id: "trauma", nome: "Trauma ou hemorragia maciça",
    utilidade: "Monitorização precoce e repetida, com estratégia dirigida por metas.",
    limite: "Algoritmos e limiares são locais. Controlar sangramento e ressuscitação ao mesmo tempo.",
  },
  {
    id: "cardiaca", nome: "Cirurgia cardíaca e CEC",
    utilidade: "Diagnóstico rápido de coagulopatia, efeito de heparina e orientação da terapia após a CEC.",
    limite: "Temperatura, hemodiluição, protamina e disfunção plaquetária alteram a interpretação.",
  },
  {
    id: "hepatico", nome: "Transplante hepático",
    utilidade: "Avalia força do coágulo, fibrinólise e resposta; ajuda a reduzir hemocomponentes.",
    limite: "Hemostasia rebalanceada: resultado anormal sem sangramento não exige correção.",
  },
  {
    id: "obstetricia", nome: "Obstetrícia",
    utilidade: "Pode identificar queda do fibrinogênio funcional e orientar a hemorragia pós-parto.",
    limite: "Valores e decisões diferem de trauma e de cardiopatia. Usar protocolo obstétrico.",
  },
  {
    id: "sepse", nome: "Sepse e CIVD",
    utilidade: "Fornece panorama global e tendência.",
    limite: "Pode haver transição entre hipo e hipercoagulabilidade. Não substitui critérios diagnósticos.",
  },
  {
    id: "queimado", nome: "Queimados",
    utilidade: "Pode apoiar a detecção de fibrinólise e a decisão sobre antifibrinolítico.",
    limite: "Evidência e momento clínico específicos.",
  },
];

export const acharCenario = (id: CenarioId) => CENARIOS.find((c) => c.id === id);

/* ------------------------------------------------------------------ *
 * Parâmetros e ensaios
 * ------------------------------------------------------------------ */

export type ParametroId = "ct" | "cft" | "alfa" | "a5" | "a10" | "a20" | "mcf" | "li60" | "ml";
export type EnsaioId = "extem" | "intem" | "fibtem" | "aptem" | "heptem" | "natem";

export type Parametro = {
  id: ParametroId;
  sigla: string;
  nome: string;
  unidade: string;
  fase: string;
  pergunta: string;
  rotulos: { abaixo: string; acima: string };
};

/** Fase e pergunta clínica vêm da tabela do guia. [Miller, PDF pp. 629-633] */
export const PARAMETROS: Record<ParametroId, Parametro> = {
  ct: {
    id: "ct", sigla: "CT", nome: "Tempo de coagulação", unidade: "s", fase: "Iniciação",
    pergunta: "Quanto tempo até o início mensurável do coágulo? Há deficiência de fatores, anticoagulante ou heparina?",
    rotulos: { abaixo: "Encurtado", acima: "Prolongado" },
  },
  cft: {
    id: "cft", sigla: "CFT", nome: "Tempo de formação do coágulo", unidade: "s", fase: "Propagação",
    pergunta: "Com que velocidade o coágulo ganha firmeza?",
    rotulos: { abaixo: "Encurtado", acima: "Prolongado" },
  },
  alfa: {
    id: "alfa", sigla: "α", nome: "Ângulo alfa", unidade: "°", fase: "Propagação",
    pergunta: "Com que velocidade o coágulo ganha firmeza?",
    rotulos: { abaixo: "Reduzido", acima: "Aumentado" },
  },
  a5: {
    id: "a5", sigla: "A5", nome: "Amplitude aos 5 min", unidade: "mm", fase: "Firmeza precoce",
    pergunta: "Qual a amplitude aos 5 minutos? Permite decisão precoce conforme protocolo validado.",
    rotulos: { abaixo: "Reduzida", acima: "Aumentada" },
  },
  a10: {
    id: "a10", sigla: "A10", nome: "Amplitude aos 10 min", unidade: "mm", fase: "Firmeza precoce",
    pergunta: "Qual a amplitude aos 10 minutos? Permite decisão precoce conforme protocolo validado.",
    rotulos: { abaixo: "Reduzida", acima: "Aumentada" },
  },
  a20: {
    id: "a20", sigla: "A20", nome: "Amplitude aos 20 min", unidade: "mm", fase: "Firmeza precoce",
    pergunta: "Qual a amplitude aos 20 minutos?",
    rotulos: { abaixo: "Reduzida", acima: "Aumentada" },
  },
  mcf: {
    id: "mcf", sigla: "MCF", nome: "Firmeza máxima do coágulo", unidade: "mm", fase: "Firmeza máxima",
    pergunta: "Qual a resistência máxima do coágulo, resultado de fibrina, plaquetas e outros componentes?",
    rotulos: { abaixo: "Reduzida", acima: "Aumentada" },
  },
  li60: {
    id: "li60", sigla: "LI60", nome: "Índice de lise aos 60 min", unidade: "%", fase: "Lise",
    pergunta: "Quanto da firmeza permanece 60 minutos depois? Valor baixo é mais lise.",
    rotulos: { abaixo: "Reduzido", acima: "Aumentado" },
  },
  ml: {
    id: "ml", sigla: "ML", nome: "Lise máxima", unidade: "%", fase: "Lise",
    pergunta: "O coágulo permanece estável ou ocorre fibrinólise?",
    rotulos: { abaixo: "Reduzida", acima: "Aumentada" },
  },
};

export type Ensaio = {
  id: EnsaioId;
  sigla: string;
  ativacao: string;
  uso: string;
  parametros: ParametroId[];
};

export const ENSAIOS: Ensaio[] = [
  {
    id: "extem", sigla: "EXTEM",
    ativacao: "Ativação pela via do fator tecidual.",
    uso: "Visão global extrínseca: iniciação, propagação, firmeza e lise. Base para comparação com FIBTEM e APTEM.",
    parametros: ["ct", "cft", "alfa", "a5", "a10", "mcf", "ml"],
  },
  {
    id: "intem", sigla: "INTEM",
    ativacao: "Ativação de contato.",
    uso: "Visão global intrínseca, sensível à heparina entre outros determinantes. Comparar com HEPTEM.",
    parametros: ["ct", "cft", "alfa", "a5", "a10", "mcf", "ml"],
  },
  {
    id: "fibtem", sigla: "FIBTEM",
    ativacao: "EXTEM com inibição da contribuição plaquetária.",
    uso: "Estima o componente fibrínico da firmeza do coágulo.",
    parametros: ["a5", "a10", "mcf"],
  },
  {
    id: "aptem", sigla: "APTEM",
    ativacao: "Semelhante ao EXTEM, com inibição da fibrinólise.",
    uso: "Se a curva melhora em relação ao EXTEM, sustenta participação de hiperfibrinólise.",
    parametros: ["a10", "mcf", "ml"],
  },
  {
    id: "heptem", sigla: "HEPTEM",
    ativacao: "Semelhante ao INTEM, com heparinase.",
    uso: "Correção do CT em relação ao INTEM sustenta efeito de heparina.",
    parametros: ["ct"],
  },
  {
    id: "natem", sigla: "NATEM",
    ativacao: "Ensaio não ativado ou minimamente ativado.",
    uso: "Uso depende da plataforma e do protocolo. Leva mais tempo até o resultado.",
    parametros: ["ct", "cft", "a10", "mcf", "ml"],
  },
];

export const acharEnsaio = (id: EnsaioId) => ENSAIOS.find((e) => e.id === id);

/* ------------------------------------------------------------------ *
 * Plataforma: delta ou sigma.
 *
 * Primeiro passo, e obrigatório. As duas plataformas têm ensaios, cartuchos e
 * intervalos diferentes, e o guia é taxativo: não transportar automaticamente
 * um intervalo de uma para a outra. Sem plataforma escolhida, o módulo não
 * classifica número nenhum — fica só a classificação manual.
 * ------------------------------------------------------------------ */

export type Plataforma = "delta" | "sigma";

export const PLATAFORMAS: Array<{
  id: Plataforma; nome: string; operacao: string; cartuchos: string;
  valoresPrecoces: string; referencia: string; regraLocal: string;
}> = [
  {
    id: "delta", nome: "ROTEM delta",
    operacao: "Pipetagem manual e reagentes líquidos, com maior dependência do operador.",
    cartuchos: "INTEM, EXTEM, FIBTEM, APTEM e HEPTEM.",
    valoresPrecoces: "Muitos protocolos históricos usam A10.",
    referencia: "Estudo multicêntrico em adultos saudáveis (Lang et al.).",
    regraLocal: "Validar laboratório, reagente e lote.",
  },
  {
    id: "sigma", nome: "ROTEM sigma",
    operacao: "Cartuchos automatizados.",
    cartuchos: "complete, ou complete + hep. INTEM C, EXTEM C, FIBTEM C e APTEM C ou HEPTEM C.",
    valoresPrecoces: "A5 é disponibilizado. Não converter diretamente os gatilhos do delta.",
    referencia: "Manual do fabricante, com 120 doadores saudáveis.",
    regraLocal: "Validar laboratório, cartucho e lote.",
  },
];

export const acharPlataforma = (id?: Plataforma) => PLATAFORMAS.find((p) => p.id === id);

export const FONTE_DELTA: Fonte = {
  obra: "Lang T et al., Multi-centre investigation on reference ranges for ROTEM thromboelastometry",
  local: "Blood Coagul Fibrinolysis. 2005;16(4):301-310",
};

export const FONTE_SIGMA: Fonte = {
  obra: "ROTEM sigma User Manual (Tem Innovations / Werfen)",
  local: "P/N 000600370 Rev 00, Appendix — Expected values, pp. 119 e 127",
};

export const fonteDaPlataforma = (p: Plataforma) => (p === "delta" ? FONTE_DELTA : FONTE_SIGMA);

/** Intervalo publicado, ou "local" quando a fonte manda usar a faixa do laboratório. */
export type Faixa = { min: number; max: number };
export type Referencia = Faixa | "local";

/**
 * Intervalos de referência por plataforma.
 *
 * São intervalos de normalidade, e não gatilhos de transfusão — o guia separa
 * as duas coisas em letras garrafais, e o módulo separa também. O que não está
 * aqui não foi publicado na fonte: fica sem classificação automática em vez de
 * herdar o número da outra plataforma.
 */
export const REFERENCIAS: Record<Plataforma, Partial<Record<EnsaioId, Partial<Record<ParametroId, Referencia>>>>> = {
  delta: {
    extem: { ct: { min: 42, max: 74 }, cft: { min: 46, max: 148 }, mcf: { min: 49, max: 71 } },
    intem: { ct: { min: 137, max: 246 }, cft: { min: 40, max: 100 }, mcf: { min: 52, max: 72 } },
    fibtem: { mcf: { min: 9, max: 25 } },
    aptem: { ct: "local", cft: "local", mcf: "local" },
    heptem: { ct: "local", cft: "local", mcf: "local" },
  },
  sigma: {
    intem: {
      ct: { min: 139, max: 202 }, a5: { min: 37, max: 55 }, a10: { min: 47, max: 64 },
      a20: { min: 54, max: 70 }, mcf: { min: 55, max: 71 }, li60: { min: 93, max: 100 }, ml: { min: 0, max: 7 },
    },
    extem: {
      ct: { min: 48, max: 72 }, a5: { min: 33, max: 51 }, a10: { min: 44, max: 61 },
      a20: { min: 53, max: 68 }, mcf: { min: 54, max: 70 }, li60: { min: 94, max: 100 }, ml: { min: 0, max: 6 },
    },
    fibtem: {
      a5: { min: 5, max: 14 }, a10: { min: 5, max: 15 },
      a20: { min: 5, max: 16 }, mcf: { min: 5, max: 17 }, li60: { min: 100, max: 100 }, ml: { min: 0, max: 0 },
    },
    aptem: {
      ct: { min: 50, max: 73 }, a5: { min: 30, max: 49 }, a10: { min: 41, max: 59 },
      a20: { min: 49, max: 66 }, mcf: { min: 52, max: 68 }, li60: { min: 95, max: 100 }, ml: { min: 0, max: 5 },
    },
    heptem: {
      ct: { min: 141, max: 215 }, a5: { min: 33, max: 51 }, a10: { min: 44, max: 61 },
      a20: { min: 52, max: 67 }, mcf: { min: 54, max: 69 }, li60: { min: 94, max: 100 }, ml: { min: 0, max: 6 },
    },
  },
};

/** Quais parâmetros cada ensaio expõe, por plataforma. */
const PARAMETROS_POR_PLATAFORMA: Record<Plataforma, Partial<Record<EnsaioId, ParametroId[]>>> = {
  delta: {
    extem: ["ct", "cft", "alfa", "a5", "a10", "mcf", "ml"],
    intem: ["ct", "cft", "alfa", "a5", "a10", "mcf", "ml"],
    fibtem: ["a5", "a10", "mcf"],
    aptem: ["a10", "mcf", "ml"],
    heptem: ["ct"],
    natem: ["ct", "cft", "a10", "mcf", "ml"],
  },
  sigma: {
    // FIBTEM C não traz CT: o manual marca N/A.
    extem: ["ct", "a5", "a10", "a20", "mcf", "li60", "ml"],
    intem: ["ct", "a5", "a10", "a20", "mcf", "li60", "ml"],
    fibtem: ["a5", "a10", "a20", "mcf", "li60", "ml"],
    aptem: ["ct", "a5", "a10", "a20", "mcf", "li60", "ml"],
    heptem: ["ct", "a5", "a10", "a20", "mcf", "li60", "ml"],
  },
};

/** Os ensaios daquela plataforma, com a sigla e os parâmetros que ela usa. */
export function ensaiosDa(plataforma: Plataforma): Ensaio[] {
  const mapa = PARAMETROS_POR_PLATAFORMA[plataforma];
  return ENSAIOS.filter((e) => mapa[e.id]).map((e) => ({
    ...e,
    sigla: plataforma === "sigma" ? `${e.sigla} C` : e.sigla,
    parametros: mapa[e.id]!,
  }));
}

export const faixaDe = (plataforma: Plataforma, ensaio: EnsaioId, parametro: ParametroId): Referencia | undefined =>
  REFERENCIAS[plataforma]?.[ensaio]?.[parametro];

export function escreverFaixa(f: Referencia | undefined, unidade: string): string | undefined {
  if (!f) return undefined;
  if (f === "local") return "faixa do laboratório";
  return f.min === f.max ? `${f.min} ${unidade}` : `${f.min}–${f.max} ${unidade}`;
}

/**
 * Classifica um valor digitado contra o intervalo publicado.
 *
 * Devolve undefined quando não há intervalo — sem plataforma, sem faixa
 * publicada, ou quando a fonte manda usar a do laboratório. Nesses casos a
 * classificação continua sendo de quem lê o exame.
 */
export function classificar(
  plataforma: Plataforma | undefined, ensaio: EnsaioId, parametro: ParametroId, valor?: number,
): Situacao | undefined {
  if (!plataforma || valor === undefined || !Number.isFinite(valor)) return undefined;
  const faixa = faixaDe(plataforma, ensaio, parametro);
  if (!faixa || faixa === "local") return undefined;
  if (valor < faixa.min) return "abaixo";
  if (valor > faixa.max) return "acima";
  return "normal";
}

export const SEM_PLATAFORMA =
  "Escolha a plataforma antes de interpretar qualquer número. Sem ela, o AVANEST não classifica valor nenhum — as duas têm ensaios, cartuchos e intervalos diferentes, e transportar um intervalo de uma para a outra é erro.";

export const REFERENCIA_NAO_E_GATILHO =
  "Intervalo de referência não é sinônimo de gatilho transfusional. A decisão terapêutica exige sangramento, cenário e algoritmo institucional validado. E o limite da faixa normal nunca vira dose.";

export const CARTUCHOS_DIFERENTES =
  "No sigma, APTEM C e HEPTEM C pertencem a cartuchos diferentes — complete e complete + hep. Os dois não saem da mesma corrida.";

export const ML_SIGMA = "No sigma, a ML é calculada 60 minutos após o CT.";


/** As três comparações que geram informação, com o cuidado que cada uma pede. */
export const COMPARACOES: Array<{ par: string; inferencia: string; cuidado: string }> = [
  {
    par: "EXTEM × FIBTEM",
    inferencia: "Firmeza baixa nos dois: componente fibrínico pode estar reduzido. EXTEM baixo com FIBTEM preservado: a contribuição plaquetária ganha importância.",
    cuidado: "Não separa contagem de função plaquetária. Conferir hemograma e contexto.",
  },
  {
    par: "INTEM × HEPTEM",
    inferencia: "Melhora ou correção no HEPTEM sugere efeito de heparina.",
    cuidado: "Confirmar exposição, fase da CEC e dose de protamina já administrada.",
  },
  {
    par: "EXTEM × APTEM",
    inferencia: "Melhora da lise ou da estabilidade no APTEM sugere hiperfibrinólise.",
    cuidado: "Não atrasar o antifibrinolítico quando há indicação clínica independente e o tempo é crítico.",
  },
];

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */

/** Como o parâmetro está, em relação à referência do laudo de quem lê. */
export type Situacao = "abaixo" | "normal" | "acima";

/** Chave "extem.ct", "fibtem.a10". Só entra o que foi classificado. */
export type Leitura = Record<string, Situacao | undefined>;

export const chave = (ensaio: EnsaioId, parametro: ParametroId) => `${ensaio}.${parametro}`;

const ler = (l: Leitura, e: EnsaioId, p: ParametroId) => l[chave(e, p)];

const FIRMEZA: ParametroId[] = ["a5", "a10", "mcf"];

function firmezaBaixa(l: Leitura, e: EnsaioId): boolean {
  return FIRMEZA.some((p) => ler(l, e, p) === "abaixo");
}

function firmezaPreservada(l: Leitura, e: EnsaioId): boolean {
  const vistos = FIRMEZA.map((p) => ler(l, e, p)).filter(Boolean);
  return vistos.length > 0 && vistos.every((s) => s !== "abaixo");
}

export type FenotipoId = "iniciacao" | "fibrina" | "plaquetas" | "fibrinolise" | "heparina" | "semCoagulopatia";

export type Achado = {
  titulo: string;
  /** A hipótese prioritária. Nunca um produto, nunca uma dose. */
  hipotese: string;
  /** Por que a construção do ensaio permite dizer isso. */
  base: string;
  /** Liga o achado às classes de conduta, quando o guia mapeia o fenótipo. */
  fenotipo?: FenotipoId;
  /** O que ainda falta olhar, quando o padrão não fecha sozinho. */
  aSeguir?: string;
};

/**
 * Leitura cruzada entre canais.
 *
 * Os padrões abaixo são os "padrões resumidos" do guia. Saem de como cada
 * ensaio é montado — o FIBTEM é o EXTEM sem a plaqueta, o APTEM é o EXTEM sem
 * a fibrinólise, o HEPTEM é o INTEM sem a heparina — e não de julgamento
 * clínico. Nenhum indica produto ou dose.
 */
export function achados(l: Leitura, contexto: Contexto = {}): Achado[] {
  const saida: Achado[] = [];

  const intemCt = ler(l, "intem", "ct");
  const heptemCt = ler(l, "heptem", "ct");
  const extemCt = ler(l, "extem", "ct");
  const extemMl = ler(l, "extem", "ml");
  const aptemMl = ler(l, "aptem", "ml");

  if (intemCt === "acima" && heptemCt === "normal") {
    saida.push({
      titulo: "CT do INTEM prolongado, HEPTEM normal",
      hipotese: "Efeito de heparina",
      base: "O HEPTEM é o INTEM com heparinase. A correção do CT quando a heparina é degradada é o que sustenta a inferência.",
      fenotipo: "heparina",
      aSeguir: "Confirmar exposição, fase da CEC e dose de protamina já administrada.",
    });
  }

  if (intemCt === "acima" && heptemCt === "acima") {
    saida.push({
      titulo: "CT prolongado no INTEM e no HEPTEM",
      hipotese: "Iniciação pela via intrínseca, sem explicação pela heparina",
      base: "Degradar a heparina não corrigiu o CT, então o prolongamento não é atribuível a ela.",
      fenotipo: "iniciacao",
      aSeguir: "Comparar com o CT do EXTEM. O traçado não identifica sozinho qual fator está deficiente.",
    });
  }

  if (intemCt === "acima" && heptemCt === undefined) {
    saida.push({
      titulo: "CT do INTEM prolongado, sem HEPTEM",
      hipotese: "Indefinido — falta o canal que separa heparina do resto",
      base: "Sem o HEPTEM não dá para dizer se o prolongamento é heparina ou deficit de fatores.",
      aSeguir: "Classificar o CT do HEPTEM.",
    });
  }

  if (extemCt === "acima" && firmezaPreservada(l, "fibtem")) {
    saida.push({
      titulo: "CT do EXTEM prolongado com FIBTEM preservado",
      hipotese: "Iniciação lenta: deficit de fatores ou anticoagulante, conforme o contexto",
      base: "A firmeza sustentada pela fibrina está preservada, então o achado está na iniciação, não no substrato do coágulo.",
      fenotipo: "iniciacao",
      aSeguir: "O CT prolongado não identifica automaticamente qual fator está deficiente. Rever anticoagulante, INR e função hepática.",
    });
  }

  if (firmezaBaixa(l, "extem") && firmezaBaixa(l, "fibtem")) {
    saida.push({
      titulo: "Firmeza reduzida no EXTEM e no FIBTEM",
      hipotese: "Baixa contribuição fibrínica — hipofibrinogenemia funcional",
      base: "O FIBTEM mede a firmeza com a plaqueta inibida. Cair nos dois canais aponta o componente que sobra.",
      fenotipo: "fibrina",
      aSeguir: "Confirmar com fibrinogênio de Clauss e com o contexto.",
    });
  }

  if (firmezaBaixa(l, "extem") && firmezaPreservada(l, "fibtem")) {
    saida.push({
      titulo: "Firmeza reduzida no EXTEM com FIBTEM preservado",
      hipotese: "Baixa contribuição plaquetária",
      base: "A parte da firmeza que vem da fibrina está preservada, e a queda aparece só onde a plaqueta entra.",
      fenotipo: "plaquetas",
      aSeguir: "Correlacionar com contagem e função. O ROTEM não separa os dois, e pode não detectar disfunção por antiagregantes ou doença de von Willebrand.",
    });
  }

  if (extemMl === "acima" && aptemMl === "normal") {
    saida.push({
      titulo: "Lise no EXTEM que o APTEM corrige",
      hipotese: "Hiperfibrinólise",
      base: "O APTEM é o EXTEM com a fibrinólise inibida. A lise sumir quando ela é inibida é o que sustenta a inferência.",
      fenotipo: "fibrinolise",
      aSeguir: "Não atrasar o antifibrinolítico quando há indicação clínica independente e o tempo é crítico.",
    });
  }

  if (extemMl === "acima" && aptemMl === "acima") {
    saida.push({
      titulo: "Lise no EXTEM que o APTEM não corrige",
      hipotese: "Perda de firmeza não explicada por fibrinólise",
      base: "Inibir a fibrinólise não mudou o traçado, então a queda de amplitude tem outra origem.",
      aSeguir: "Rever qualidade da amostra e condições pré-analíticas antes de tratar como fibrinólise.",
    });
  }

  if (extemMl === "acima" && aptemMl === undefined) {
    saida.push({
      titulo: "Lise no EXTEM, sem APTEM",
      hipotese: "Indefinido — falta o canal que confirma fibrinólise",
      base: "Sem o APTEM não dá para dizer se a lise observada é fibrinolítica.",
      aSeguir: "Classificar o ML do APTEM.",
    });
  }

  /**
   * Traçado sem defeito e sangramento que continua é um padrão da tabela, não
   * a ausência de padrão — e é dos mais importantes, porque manda parar de
   * procurar coagulopatia e ir atrás da fonte.
   */
  if (saida.length === 0 && contexto.sangramentoAtivo === true && tudoNormal(l)) {
    saida.push({
      titulo: "ROTEM sem defeito relevante, sangramento persistente",
      hipotese: "Procurar fonte cirúrgica, fármacos ou defeitos não captados pelo ensaio",
      base: "Resultado normal não exclui causa anatômica. O ensaio também não detecta bem disfunção plaquetária por antiagregantes nem o efeito do fator de von Willebrand.",
      fenotipo: "semCoagulopatia",
      aSeguir: "Rever campo operatório, antiagregantes, von Willebrand e erro pré-analítico.",
    });
  }

  return saida;
}

/** Tudo que foi classificado está normal, e algo foi classificado. */
export function tudoNormal(l: Leitura): boolean {
  const vistos = Object.values(l).filter(Boolean);
  return vistos.length > 0 && vistos.every((s) => s === "normal");
}

export const quantosClassificados = (l: Leitura) =>
  Object.values(l).filter((s) => s !== undefined).length;

/* ------------------------------------------------------------------ *
 * Da interpretação à conduta.
 *
 * Classes de intervenção, e nada além disso: o guia diz, com todas as letras,
 * que esta tabela não prescreve produto, dose ou limiar. Por isso cada classe
 * vem grudada nas verificações obrigatórias, e a tela só a mostra quando há
 * sangramento — que é a condição que a própria fonte exige.
 * ------------------------------------------------------------------ */

export type Conduta = {
  fenotipo: FenotipoId;
  nome: string;
  considerar: string;
  verificar: string;
};

export const CONDUTAS: Record<FenotipoId, Conduta> = {
  iniciacao: {
    fenotipo: "iniciacao", nome: "Iniciação lenta / fatores",
    considerar: "Plasma ou concentrado de complexo protrombínico, conforme a causa e o protocolo.",
    verificar: "Anticoagulante, INR e TP, heparina, risco de trombose, função hepática e reposição prévia.",
  },
  fibrina: {
    fenotipo: "fibrina", nome: "Fibrina insuficiente",
    considerar: "Concentrado de fibrinogênio ou crioprecipitado, conforme disponibilidade e protocolo.",
    verificar: "FIBTEM, fibrinogênio de Clauss, dose prévia e alvo específico do cenário.",
  },
  plaquetas: {
    fenotipo: "plaquetas", nome: "Contribuição plaquetária baixa",
    considerar: "Concentrado de plaquetas quando houver sangramento e indicação.",
    verificar: "Contagem, antiagregantes, CEC, função plaquetária e FIBTEM.",
  },
  fibrinolise: {
    fenotipo: "fibrinolise", nome: "Hiperfibrinólise",
    considerar: "Antifibrinolítico quando indicado.",
    verificar: "Tempo desde o trauma ou a cirurgia, contraindicações, dose já recebida e padrão do APTEM.",
  },
  heparina: {
    fenotipo: "heparina", nome: "Efeito de heparina",
    considerar: "Protamina conforme a exposição e o protocolo.",
    verificar: "Dose cumulativa de heparina, tempo, CEC, INTEM e HEPTEM, e risco de excesso de protamina.",
  },
  semCoagulopatia: {
    fenotipo: "semCoagulopatia", nome: "Sem coagulopatia mensurável",
    considerar: "Controle cirúrgico e busca de causas não captadas pelo ensaio.",
    verificar: "Campo operatório, fármacos, von Willebrand, antiagregação e erro pré-analítico.",
  },
};

export const BARREIRA =
  "Não sugerir plasma, plaquetas, fibrinogênio, complexo protrombínico, protamina ou antifibrinolítico apenas porque um campo está fora da referência. Exigir sangramento e contexto, padrão coerente e ausência de contraindicação.";

export const AVISO_CONDUTA =
  "Classes de intervenção a considerar, não prescrição. Produto, dose e limiar exigem protocolo institucional por população e cenário.";

/** As classes só aparecem quando a própria fonte permite: com sangramento. */
export function condutasAplicaveis(lista: Achado[], contexto: Contexto): Conduta[] {
  if (contexto.sangramentoAtivo !== true) return [];
  const vistos = new Set<FenotipoId>();
  const saida: Conduta[] = [];
  for (const a of lista) {
    if (a.fenotipo && !vistos.has(a.fenotipo)) {
      vistos.add(a.fenotipo);
      saida.push(CONDUTAS[a.fenotipo]);
    }
  }
  return saida;
}

/* ------------------------------------------------------------------ *
 * Sequência, pré-analítico e limites declarados
 * ------------------------------------------------------------------ */

export const SEQUENCIA: Array<{ etapa: string; pergunta: string; decisao: string }> = [
  {
    etapa: "1. Qualidade",
    pergunta: "Amostra, horário, cartucho, temperatura e identificação estão corretos?",
    decisao: "Repetir se houver erro pré-analítico ou curva incompatível.",
  },
  {
    etapa: "2. Iniciação",
    pergunta: "O CT está prolongado no ensaio pertinente?",
    decisao: "Rever anticoagulante e heparina; comparar INTEM com HEPTEM; considerar deficiência global só dentro do protocolo.",
  },
  {
    etapa: "3. Fibrina",
    pergunta: "O FIBTEM A5, A10 ou MCF está reduzido?",
    decisao: "Considerar deficiência funcional de fibrinogênio e confirmar contexto e laboratório.",
  },
  {
    etapa: "4. Plaquetas",
    pergunta: "O EXTEM está fraco com o FIBTEM relativamente preservado?",
    decisao: "Avaliar contagem e função plaquetária. Não inferir dose automaticamente.",
  },
  {
    etapa: "5. Lise",
    pergunta: "Há perda acelerada da firmeza? O APTEM corrige?",
    decisao: "Sustenta hiperfibrinólise. Avaliar antifibrinolítico e contraindicações.",
  },
  {
    etapa: "6. Resposta",
    pergunta: "O sangramento e o traçado melhoraram depois da intervenção?",
    decisao: "Repetir ROTEM e laboratório. Evitar tratamento cumulativo cego.",
  },
];

export const PRE_ANALITICO: string[] = [
  "Tempo entre coleta e início, proporção citrato-sangue, contaminação por heparina, transporte e identificação.",
  "Hipotermia: documentar a temperatura real e a configuração do analisador.",
  "Acidose, hipocalcemia, hemodiluição e anemia alteram a hemostasia e podem não ser reproduzidas no ensaio.",
  "Tratamento administrado enquanto o teste corre pode deixar o traçado antigo em relação ao paciente.",
];

export const NAO_DEFINIDO: Array<{ campo: string; situacao: string; conduta: string }> = [
  {
    campo: "Faixas normais universais",
    situacao: "Não há uma única faixa válida para toda plataforma, reagente e população.",
    conduta: "Importar o intervalo validado pelo laboratório local e guardar a versão.",
  },
  {
    campo: "Gatilho de CT no EXTEM",
    situacao: "Não explicitado como regra geral única nos trechos revistos.",
    conduta: "Nulo até haver protocolo institucional por cenário.",
  },
  {
    campo: "Gatilho de A5, A10 ou MCF no FIBTEM",
    situacao: "Não explicitado como regra universal nos livros.",
    conduta: "Não converter valor em dose automática de fibrinogênio.",
  },
  {
    campo: "Gatilho de plaquetas",
    situacao: "O ROTEM não separa contagem de função, e o limiar depende do cenário.",
    conduta: "Exigir hemograma, sangramento e protocolo.",
  },
  {
    campo: "Critério numérico de hiperfibrinólise",
    situacao: "As fontes sustentam a detecção de lise, sem limiar geral único.",
    conduta: "Usar referência local e a comparação entre EXTEM e APTEM.",
  },
  {
    campo: "Dose de produto ou fator",
    situacao: "Não deve ser derivada apenas do traçado.",
    conduta: "Cadastrar em módulo separado, com fonte e governança.",
  },
  {
    campo: "Momento universal de repetição",
    situacao: "Depende da intervenção, do sangramento e da logística.",
    conduta: "Registrar o evento gatilho e o horário, não um intervalo fixo global.",
  },
];

export const AVISO_MODULO =
  "O ROTEM identifica fenótipos, mas não localiza sangramento cirúrgico e não mede adequadamente todas as disfunções plaquetárias, o efeito do fator de von Willebrand ou todos os anticoagulantes. Terapia pró-hemostática inadequada pode causar trombose.";

export const AVISO_REFERENCIA =
  "Os intervalos exibidos são os publicados para a plataforma escolhida, e valem como orientação. A faixa validada pelo seu laboratório prevalece sempre: onde ela divergir, marque a situação à mão — a marcação manual vence a automática.";

export const SEM_CONSENSO = {
  texto: "Protocolos orientados por testes viscoelásticos podem reduzir sangramento, transfusões e morbimortalidade, mas ainda não há consenso entre os algoritmos transfusionais — muitos deles foram desenvolvidos em centros individuais.",
  fontes: [SAESP("PDF pp. 5430-5431"), MILLER("PDF pp. 629-632"), EUROPEIA],
};
