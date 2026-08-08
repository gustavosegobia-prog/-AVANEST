/**
 * ROTEM — estrutura dos ensaios e leitura cruzada entre canais.
 *
 * Escopo deliberado: este módulo não fecha algoritmo terapêutico. Ele diz qual
 * componente da hemostasia o traçado implica, e para aí. Produto, dose e
 * gatilho de transfusão são do protocolo do serviço, e protocolo não está aqui.
 *
 * Também não traz faixa de normalidade. Os valores de referência do ROTEM
 * dependem do analisador (delta, sigma) e do reagente, e variam entre
 * laboratórios — cravar número aqui seria inventar fonte. Quem classifica cada
 * parâmetro é quem está lendo o exame, com a referência do próprio laudo; o
 * módulo trabalha em cima dessa classificação.
 *
 * O que o módulo sabe de verdade, e por isso pode afirmar, é como cada ensaio
 * é montado: FIBTEM é EXTEM com a plaqueta bloqueada, APTEM é EXTEM com a
 * fibrinólise bloqueada, HEPTEM é INTEM com a heparina degradada. A leitura
 * cruzada sai dessa construção, não de opinião clínica.
 */

export type EnsaioId = "extem" | "intem" | "fibtem" | "aptem" | "heptem";
export type ParametroId = "ct" | "cft" | "alfa" | "a5" | "a10" | "mcf" | "ml";

/** Como o parâmetro está, em relação à referência do laudo de quem está lendo. */
export type Situacao = "abaixo" | "normal" | "acima";

export type Parametro = {
  id: ParametroId;
  sigla: string;
  nome: string;
  unidade: string;
  mede: string;
  /** Rótulos de "abaixo" e "acima" que fazem sentido para este parâmetro. */
  rotulos: { abaixo: string; acima: string };
};

export const PARAMETROS: Record<ParametroId, Parametro> = {
  ct: {
    id: "ct", sigla: "CT", nome: "Tempo de coagulação", unidade: "s",
    mede: "Do início até o coágulo atingir 2 mm de amplitude. É a fase de iniciação — geração de trombina.",
    rotulos: { abaixo: "Encurtado", acima: "Prolongado" },
  },
  cft: {
    id: "cft", sigla: "CFT", nome: "Tempo de formação do coágulo", unidade: "s",
    mede: "De 2 mm até 20 mm de amplitude. É a velocidade de propagação.",
    rotulos: { abaixo: "Encurtado", acima: "Prolongado" },
  },
  alfa: {
    id: "alfa", sigla: "α", nome: "Ângulo alfa", unidade: "°",
    mede: "Inclinação da curva na subida. Mesma informação cinética do CFT, vista pelo outro lado.",
    rotulos: { abaixo: "Reduzido", acima: "Aumentado" },
  },
  a5: {
    id: "a5", sigla: "A5", nome: "Amplitude aos 5 min", unidade: "mm",
    mede: "Firmeza precoce do coágulo. É o que permite decidir sem esperar a MCF.",
    rotulos: { abaixo: "Reduzida", acima: "Aumentada" },
  },
  a10: {
    id: "a10", sigla: "A10", nome: "Amplitude aos 10 min", unidade: "mm",
    mede: "Firmeza aos 10 minutos. Antecipa bem a MCF e é o parâmetro mais usado à beira do leito.",
    rotulos: { abaixo: "Reduzida", acima: "Aumentada" },
  },
  mcf: {
    id: "mcf", sigla: "MCF", nome: "Firmeza máxima do coágulo", unidade: "mm",
    mede: "Pico de firmeza. Soma plaqueta, fibrinogênio e fator XIII.",
    rotulos: { abaixo: "Reduzida", acima: "Aumentada" },
  },
  ml: {
    id: "ml", sigla: "ML", nome: "Lise máxima", unidade: "%",
    mede: "Quanto o coágulo perdeu de firmeza depois do pico. É a leitura da fibrinólise.",
    rotulos: { abaixo: "Reduzida", acima: "Aumentada" },
  },
};

export type Ensaio = {
  id: EnsaioId;
  sigla: string;
  montagem: string;
  isola: string;
  parametros: ParametroId[];
};

/**
 * A ordem importa na tela: EXTEM e INTEM primeiro porque são os dois traçados
 * de base; os outros três só significam alguma coisa comparados a eles.
 */
export const ENSAIOS: Ensaio[] = [
  {
    id: "extem", sigla: "EXTEM",
    montagem: "Ativado por fator tecidual.",
    isola: "Via extrínseca e comum. É o traçado de base da maior parte das decisões.",
    parametros: ["ct", "cft", "alfa", "a5", "a10", "mcf", "ml"],
  },
  {
    id: "intem", sigla: "INTEM",
    montagem: "Ativado por ácido elágico.",
    isola: "Via intrínseca e comum.",
    parametros: ["ct", "cft", "alfa", "a5", "a10", "mcf", "ml"],
  },
  {
    id: "fibtem", sigla: "FIBTEM",
    montagem: "EXTEM com a plaqueta bloqueada (citocalasina D).",
    isola: "A contribuição do fibrinogênio e da fibrina para a firmeza, sem a plaqueta.",
    parametros: ["a5", "a10", "mcf"],
  },
  {
    id: "aptem", sigla: "APTEM",
    montagem: "EXTEM com a fibrinólise bloqueada (aprotinina).",
    isola: "Serve para comparar com o EXTEM: se o traçado melhora, a lise era fibrinólise.",
    parametros: ["a10", "mcf", "ml"],
  },
  {
    id: "heptem", sigla: "HEPTEM",
    montagem: "INTEM com a heparina degradada (heparinase).",
    isola: "Serve para comparar com o INTEM: se o CT normaliza, o prolongamento era heparina.",
    parametros: ["ct"],
  },
];

export const acharEnsaio = (id: EnsaioId) => ENSAIOS.find((e) => e.id === id);

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */

/** Chave "extem.ct", "fibtem.a10". Só entra o que foi classificado. */
export type Leitura = Record<string, Situacao | undefined>;

export const chave = (ensaio: EnsaioId, parametro: ParametroId) => `${ensaio}.${parametro}`;

const ler = (l: Leitura, e: EnsaioId, p: ParametroId) => l[chave(e, p)];

/** Amplitude reduzida em qualquer um dos três parâmetros de firmeza. */
function firmezaBaixa(l: Leitura, e: EnsaioId): boolean {
  return (["a5", "a10", "mcf"] as ParametroId[]).some((p) => ler(l, e, p) === "abaixo");
}

/** Firmeza classificada e não reduzida — normal ou alta, mas classificada. */
function firmezaPreservada(l: Leitura, e: EnsaioId): boolean {
  const vistos = (["a5", "a10", "mcf"] as ParametroId[]).map((p) => ler(l, e, p)).filter(Boolean);
  return vistos.length > 0 && vistos.every((s) => s !== "abaixo");
}

export type Achado = {
  titulo: string;
  /** O componente implicado. Nunca um produto, nunca uma dose. */
  componente: string;
  /** Por que a construção do ensaio permite dizer isso. */
  base: string;
  /** O que ainda falta olhar, quando o padrão não fecha sozinho. */
  aSeguir?: string;
};

/**
 * Leitura cruzada entre canais.
 *
 * Cada achado abaixo sai de como o ensaio é montado, e não de julgamento
 * clínico: FIBTEM baixo com EXTEM baixo aponta fibrinogênio porque o FIBTEM é
 * justamente o EXTEM sem a plaqueta. Nenhum achado indica produto ou dose.
 */
export function achados(l: Leitura): Achado[] {
  const saida: Achado[] = [];

  const intemCt = ler(l, "intem", "ct");
  const heptemCt = ler(l, "heptem", "ct");
  const extemCt = ler(l, "extem", "ct");
  const extemMl = ler(l, "extem", "ml");
  const aptemMl = ler(l, "aptem", "ml");

  if (intemCt === "acima" && heptemCt === "normal") {
    saida.push({
      titulo: "CT do INTEM prolongado, HEPTEM normal",
      componente: "Efeito heparínico",
      base: "O HEPTEM é o INTEM com heparinase. Se o CT normaliza quando a heparina é degradada, o prolongamento vinha dela.",
    });
  }

  if (intemCt === "acima" && heptemCt === "acima") {
    saida.push({
      titulo: "CT prolongado no INTEM e no HEPTEM",
      componente: "Iniciação pela via intrínseca, sem explicação pela heparina",
      base: "Degradar a heparina não corrigiu o CT, então o prolongamento não é atribuível a ela.",
      aSeguir: "Comparar com o CT do EXTEM para separar deficit restrito à via intrínseca de deficit da via comum.",
    });
  }

  if (intemCt === "acima" && heptemCt === undefined) {
    saida.push({
      titulo: "CT do INTEM prolongado, sem HEPTEM",
      componente: "Indefinido — falta o canal que separa heparina do resto",
      base: "Sem o HEPTEM não dá para dizer se o prolongamento é heparina ou deficit de fatores.",
      aSeguir: "Classificar o CT do HEPTEM.",
    });
  }

  if (extemCt === "acima" && firmezaPreservada(l, "fibtem")) {
    saida.push({
      titulo: "CT do EXTEM prolongado com FIBTEM preservado",
      componente: "Fase de iniciação — geração de trombina pela via extrínseca e comum",
      base: "A firmeza sustentada pelo fibrinogênio está preservada, então o achado está na iniciação, não no substrato do coágulo.",
      aSeguir: "Considerar anticoagulação oral, deficit de fatores e hepatopatia no contexto do caso.",
    });
  }

  if (firmezaBaixa(l, "extem") && firmezaBaixa(l, "fibtem")) {
    saida.push({
      titulo: "Firmeza reduzida no EXTEM e no FIBTEM",
      componente: "Contribuição do fibrinogênio e da fibrina",
      base: "O FIBTEM mede a firmeza com a plaqueta bloqueada. Cair nos dois canais aponta o componente que sobra: fibrinogênio.",
    });
  }

  if (firmezaBaixa(l, "extem") && firmezaPreservada(l, "fibtem")) {
    saida.push({
      titulo: "Firmeza reduzida no EXTEM com FIBTEM preservado",
      componente: "Contribuição plaquetária",
      base: "A parte da firmeza que vem do fibrinogênio está preservada, e a queda aparece só onde a plaqueta entra.",
      aSeguir: "A contagem de plaquetas distingue número de função. O ROTEM sozinho não separa os dois: contagem baixa e função ruim deixam o mesmo traçado.",
    });
  }

  if (extemMl === "acima" && aptemMl === "normal") {
    saida.push({
      titulo: "Lise no EXTEM que o APTEM corrige",
      componente: "Hiperfibrinólise",
      base: "O APTEM é o EXTEM com a fibrinólise bloqueada. A lise sumir quando ela é bloqueada é o que confirma a origem fibrinolítica.",
    });
  }

  if (extemMl === "acima" && aptemMl === "acima") {
    saida.push({
      titulo: "Lise no EXTEM que o APTEM não corrige",
      componente: "Perda de firmeza não explicada por fibrinólise",
      base: "Bloquear a fibrinólise não mudou o traçado, então a queda de amplitude tem outra origem.",
      aSeguir: "Rever a qualidade da amostra e a firmeza de base antes de tratar como fibrinólise.",
    });
  }

  if (extemMl === "acima" && aptemMl === undefined) {
    saida.push({
      titulo: "Lise no EXTEM, sem APTEM",
      componente: "Indefinido — falta o canal que confirma fibrinólise",
      base: "Sem o APTEM não dá para dizer se a lise observada é fibrinolítica.",
      aSeguir: "Classificar o ML do APTEM.",
    });
  }

  return saida;
}

/** Quantos parâmetros a pessoa já classificou. Zero = nada a interpretar. */
export const quantosClassificados = (l: Leitura) =>
  Object.values(l).filter((s) => s !== undefined).length;

/* ------------------------------------------------------------------ *
 * Limites declarados
 * ------------------------------------------------------------------ */

export const NAO_CONCLUI: Array<{ item: string; motivo: string }> = [
  {
    item: "Faixa de normalidade",
    motivo: "Depende do analisador (delta, sigma) e do reagente, e varia entre laboratórios. Use a referência impressa no seu laudo.",
  },
  {
    item: "Gatilho de transfusão",
    motivo: "É decisão de protocolo institucional, ligada ao contexto cirúrgico e ao sangramento observado — não sai do traçado sozinho.",
  },
  {
    item: "Produto e dose",
    motivo: "Concentrado de fibrinogênio, crioprecipitado, plaquetas, complexo protrombínico e antifibrinolítico não são indicados aqui. Este módulo aponta componente, não terapia.",
  },
  {
    item: "Algoritmo terapêutico fechado",
    motivo: "Ainda não implementado, de propósito. Entra quando houver protocolo do serviço para ancorá-lo.",
  },
  {
    item: "Número de plaquetas",
    motivo: "O ROTEM mede a contribuição da plaqueta para a firmeza, não a contagem. Contagem baixa e função ruim aparecem iguais no traçado.",
  },
];

export const AVISO_MODULO =
  "Estrutura de leitura do ROTEM. Aponta qual componente da hemostasia o traçado implica e para aí: não indica produto, dose nem gatilho de transfusão. A conduta é do protocolo do serviço, junto com o sangramento observado e o contexto cirúrgico.";

export const AVISO_REFERENCIA =
  "Classifique cada parâmetro pela referência do seu próprio laudo. O AVANEST não cadastra faixa de normalidade porque ela muda com o analisador e o reagente.";
