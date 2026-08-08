/**
 * Gasometria arterial: fórmulas e interpretação.
 *
 * Tudo aqui é função pura — entra número, sai número ou classificação. Nada
 * de React, nada de estado. É o que permite testar as fórmulas de verdade e
 * mudar a interface sem encostar na conta, que é o que importa quando o
 * resultado orienta conduta em sala.
 *
 * As faixas de referência e os limites de interpretação ficam em REFERENCIAS,
 * fora das funções, para serem ajustados sem reescrever a lógica.
 */

export type Gasometria = {
  ph?: number;
  paco2?: number;
  pao2?: number;
  hco3?: number;
  be?: number;
  na?: number;
  k?: number;
  cl?: number;
  lactato?: number;
  /** Aceita 40 ou 0,40 — normalizado internamente para fração. */
  fio2?: number;
  sao2?: number;
  albumina?: number;
};

export type Referencias = {
  phMin: number;
  phMax: number;
  paco2Min: number;
  paco2Max: number;
  hco3Min: number;
  hco3Max: number;
  /** Ânion gap considerado normal — base do delta ratio. */
  anionGapNormal: number;
  anionGapMax: number;
  albuminaNormal: number;
  /** Bicarbonato de referência usado no denominador do delta ratio. */
  hco3Referencia: number;
  lactatoMax: number;
  /** Limites das faixas de interpretação do delta ratio. */
  deltaRatio: { hipercloremica: number; mista: number; agAumentado: number };
  /** Constantes do gradiente alvéolo-arterial. Patm muda com a altitude. */
  gradiente: { patm: number; ph2o: number; r: number };
};

export const REFERENCIAS: Referencias = {
  phMin: 7.35,
  phMax: 7.45,
  paco2Min: 35,
  paco2Max: 45,
  hco3Min: 22,
  hco3Max: 26,
  anionGapNormal: 12,
  anionGapMax: 12,
  albuminaNormal: 4,
  hco3Referencia: 24,
  lactatoMax: 2,
  deltaRatio: { hipercloremica: 0.4, mista: 0.8, agAumentado: 2 },
  gradiente: { patm: 760, ph2o: 47, r: 0.8 },
};

const arredonda = (valor: number, casas = 1) => {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
};

const informado = (valor?: number): valor is number =>
  typeof valor === "number" && Number.isFinite(valor);

/**
 * A FiO2 é digitada tanto como 40 quanto como 0,40, e as duas formas são
 * legítimas. Acima de 1 só pode ser porcentagem, então a conversão é segura.
 */
export function fracaoFio2(fio2?: number): number | undefined {
  if (!informado(fio2) || fio2 <= 0) return undefined;
  return fio2 > 1 ? fio2 / 100 : fio2;
}

export type DisturbioPrincipal =
  | "acidose metabólica"
  | "alcalose metabólica"
  | "acidose respiratória"
  | "alcalose respiratória"
  | "sem distúrbio ácido-base significativo"
  | "indeterminado";

/**
 * O distúrbio principal é o que explica o pH. Com pH dentro da faixa mas
 * bicarbonato e PaCO2 alterados, o quadro é de distúrbio compensado ou misto —
 * devolvido como indeterminado, e a análise completa mostra por quê.
 */
export function disturbioPrincipal(g: Gasometria, ref = REFERENCIAS): DisturbioPrincipal {
  const { ph, paco2, hco3 } = g;
  if (!informado(ph)) return "indeterminado";

  const acidemia = ph < ref.phMin;
  const alcalemia = ph > ref.phMax;

  if (!acidemia && !alcalemia) {
    const hco3Alterado = informado(hco3) && (hco3 < ref.hco3Min || hco3 > ref.hco3Max);
    const paco2Alterado = informado(paco2) && (paco2 < ref.paco2Min || paco2 > ref.paco2Max);
    if (hco3Alterado || paco2Alterado) return "indeterminado";
    return "sem distúrbio ácido-base significativo";
  }

  if (acidemia) {
    if (informado(hco3) && hco3 < ref.hco3Min) return "acidose metabólica";
    if (informado(paco2) && paco2 > ref.paco2Max) return "acidose respiratória";
    return "indeterminado";
  }

  if (informado(hco3) && hco3 > ref.hco3Max) return "alcalose metabólica";
  if (informado(paco2) && paco2 < ref.paco2Min) return "alcalose respiratória";
  return "indeterminado";
}

export type FaixaEsperada = { esperada: number; min: number; max: number };

/** Winter: PaCO2 esperada = 1,5 × HCO3 + 8 ± 2 mmHg. */
export function winter(hco3: number): FaixaEsperada {
  const esperada = 1.5 * hco3 + 8;
  return { esperada: arredonda(esperada), min: arredonda(esperada - 2), max: arredonda(esperada + 2) };
}

/** Compensação da alcalose metabólica: PaCO2 esperada ≈ 0,7 × HCO3 + 21 ± 2. */
export function compensacaoAlcaloseMetabolica(hco3: number): FaixaEsperada {
  const esperada = 0.7 * hco3 + 21;
  return { esperada: arredonda(esperada), min: arredonda(esperada - 2), max: arredonda(esperada + 2) };
}

export type LeituraCompensacao = {
  medida: number;
  esperada: FaixaEsperada;
  situacao: "adequada" | "abaixo" | "acima";
  texto: string;
};

/**
 * Compara a PaCO2 medida com a esperada e nomeia o achado. "Abaixo" e "acima"
 * significam coisas opostas conforme o distúrbio de base, então o texto é
 * montado aqui e não deixado para a interface adivinhar.
 */
export function lerCompensacaoMetabolica(
  disturbio: "acidose metabólica" | "alcalose metabólica",
  paco2: number,
  hco3: number,
): LeituraCompensacao {
  const esperada = disturbio === "acidose metabólica" ? winter(hco3) : compensacaoAlcaloseMetabolica(hco3);
  const situacao = paco2 < esperada.min ? "abaixo" : paco2 > esperada.max ? "acima" : "adequada";

  let texto = "Compensação respiratória adequada";
  if (disturbio === "acidose metabólica") {
    if (situacao === "acima") texto = "Acidose metabólica + acidose respiratória associada";
    if (situacao === "abaixo") texto = "Acidose metabólica + alcalose respiratória associada";
  } else {
    if (situacao === "acima") texto = "Alcalose metabólica + acidose respiratória associada";
    if (situacao === "abaixo") texto = "Alcalose metabólica + alcalose respiratória associada";
  }

  return { medida: paco2, esperada, situacao, texto };
}

export type HipoteseTemporal = { agudo: number; cronico: number; compativel: "agudo" | "crônico" | "intermediário" };

/**
 * Distúrbio respiratório: o bicarbonato esperado depende de há quanto tempo a
 * PaCO2 está alterada. Em vez de escolher por conta própria, devolve os dois
 * cenários e diz de qual o valor medido está mais perto — quem sabe o tempo de
 * evolução é quem está à beira do leito.
 */
export function hco3EsperadoRespiratorio(
  disturbio: "acidose respiratória" | "alcalose respiratória",
  paco2: number,
  hco3Medido: number,
  ref = REFERENCIAS,
): HipoteseTemporal {
  const variacao = (paco2 - 40) / 10;
  const base = ref.hco3Referencia;

  // Acidose: +1 por 10 mmHg no agudo, +3,75 no crônico.
  // Alcalose: −2 por 10 mmHg no agudo, −4,5 no crônico.
  const [fatorAgudo, fatorCronico] =
    disturbio === "acidose respiratória" ? [1, 3.75] : [2, 4.5];

  const agudo = arredonda(base + variacao * fatorAgudo);
  const cronico = arredonda(base + variacao * fatorCronico);

  const distanciaAgudo = Math.abs(hco3Medido - agudo);
  const distanciaCronico = Math.abs(hco3Medido - cronico);
  const margem = 1.5;

  let compativel: HipoteseTemporal["compativel"] = "intermediário";
  if (distanciaAgudo + margem < distanciaCronico) compativel = "agudo";
  else if (distanciaCronico + margem < distanciaAgudo) compativel = "crônico";

  return { agudo, cronico, compativel };
}

/** AG = Na − (Cl + HCO3). */
export function anionGap(na: number, cl: number, hco3: number): number {
  return arredonda(na - (cl + hco3));
}

/** AG corrigido = AG + 2,5 × (albumina normal − albumina medida). */
export function anionGapCorrigido(ag: number, albumina: number, ref = REFERENCIAS): number {
  return arredonda(ag + 2.5 * (ref.albuminaNormal - albumina));
}

export type LeituraDeltaRatio = { valor: number; texto: string };

/**
 * Delta ratio = (AG − AG normal) / (HCO3 de referência − HCO3 medido).
 * Sem sentido quando o bicarbonato está no valor de referência: o denominador
 * vai a zero e o resultado explodiria.
 */
export function deltaRatio(ag: number, hco3: number, ref = REFERENCIAS): LeituraDeltaRatio | undefined {
  const denominador = ref.hco3Referencia - hco3;
  if (Math.abs(denominador) < 0.1) return undefined;

  const valor = arredonda((ag - ref.anionGapNormal) / denominador, 2);
  const { hipercloremica, mista, agAumentado } = ref.deltaRatio;

  let texto = "Compatível com acidose metabólica com ânion gap aumentado predominante";
  if (valor < hipercloremica) texto = "Acidose metabólica hiperclorêmica predominante";
  else if (valor < mista) texto = "Possível acidose com AG aumentado somada a acidose hiperclorêmica";
  else if (valor > agAumentado) texto = "Considerar alcalose metabólica associada ou acidose respiratória crônica";

  return { valor, texto };
}

/** P/F = PaO2 ÷ FiO2 em fração. */
export function relacaoPF(pao2: number, fio2: number): number | undefined {
  const fracao = fracaoFio2(fio2);
  if (!fracao) return undefined;
  return Math.round(pao2 / fracao);
}

/**
 * Gradiente alvéolo-arterial.
 * PAO2 = FiO2 × (Patm − PH2O) − PaCO2 / R, e o gradiente é PAO2 − PaO2.
 */
export function gradienteAlveoloArterial(
  pao2: number,
  paco2: number,
  fio2: number,
  ref = REFERENCIAS,
): { pao2Alveolar: number; gradiente: number } | undefined {
  const fracao = fracaoFio2(fio2);
  if (!fracao) return undefined;
  const { patm, ph2o, r } = ref.gradiente;
  const alveolar = fracao * (patm - ph2o) - paco2 / r;
  return { pao2Alveolar: arredonda(alveolar), gradiente: arredonda(alveolar - pao2) };
}

export type Interpretacao = {
  disturbio: DisturbioPrincipal;
  misto: boolean;
  compensacao?: LeituraCompensacao;
  respiratorio?: { medido: number; hipotese: HipoteseTemporal; alertaMetabolico: boolean };
  anionGap?: number;
  anionGapCorrigido?: number;
  deltaRatio?: LeituraDeltaRatio;
  relacaoPF?: number;
  gradienteAa?: { pao2Alveolar: number; gradiente: number };
  lactato?: { valor: number; acimaDoNormal: boolean };
  faltando: string[];
};

/**
 * Junta tudo o que os dados disponíveis permitem calcular. O que faltar é
 * listado em `faltando`, para a tela dizer o que preencher em vez de mostrar
 * um campo vazio sem explicação.
 */
export function interpretar(g: Gasometria, ref = REFERENCIAS): Interpretacao {
  const disturbio = disturbioPrincipal(g, ref);
  const faltando: string[] = [];
  const resultado: Interpretacao = { disturbio, misto: false, faltando };

  if (!informado(g.ph)) faltando.push("pH");
  if (!informado(g.paco2)) faltando.push("PaCO2");
  if (!informado(g.hco3)) faltando.push("HCO3");

  if (
    (disturbio === "acidose metabólica" || disturbio === "alcalose metabólica") &&
    informado(g.paco2) && informado(g.hco3)
  ) {
    resultado.compensacao = lerCompensacaoMetabolica(disturbio, g.paco2, g.hco3);
    resultado.misto = resultado.compensacao.situacao !== "adequada";
  }

  if (
    (disturbio === "acidose respiratória" || disturbio === "alcalose respiratória") &&
    informado(g.paco2) && informado(g.hco3)
  ) {
    const hipotese = hco3EsperadoRespiratorio(disturbio, g.paco2, g.hco3, ref);
    const foraDosDois =
      g.hco3 < Math.min(hipotese.agudo, hipotese.cronico) - 2 ||
      g.hco3 > Math.max(hipotese.agudo, hipotese.cronico) + 2;
    resultado.respiratorio = { medido: g.hco3, hipotese, alertaMetabolico: foraDosDois };
    resultado.misto = foraDosDois;
  }

  if (informado(g.na) && informado(g.cl) && informado(g.hco3)) {
    const ag = anionGap(g.na, g.cl, g.hco3);
    resultado.anionGap = ag;

    const agParaDelta = informado(g.albumina) ? anionGapCorrigido(ag, g.albumina, ref) : ag;
    if (informado(g.albumina)) resultado.anionGapCorrigido = agParaDelta;

    if (disturbio === "acidose metabólica" && agParaDelta > ref.anionGapMax) {
      resultado.deltaRatio = deltaRatio(agParaDelta, g.hco3, ref);
    }
  } else if (disturbio === "acidose metabólica") {
    faltando.push("Na e Cl, para o ânion gap");
  }

  if (informado(g.pao2) && informado(g.fio2)) {
    resultado.relacaoPF = relacaoPF(g.pao2, g.fio2);
    if (informado(g.paco2)) {
      resultado.gradienteAa = gradienteAlveoloArterial(g.pao2, g.paco2, g.fio2, ref);
    }
  }

  if (informado(g.lactato)) {
    resultado.lactato = { valor: g.lactato, acimaDoNormal: g.lactato > ref.lactatoMax };
  }

  return resultado;
}
