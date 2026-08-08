/**
 * Débito cardíaco pelo princípio de Fick.
 *
 * Fick estima o débito a partir do consumo de oxigênio e da diferença
 * arteriovenosa. É estimativa, e o módulo faz questão de dizer de onde veio o
 * VO2: medido, o resultado vale bem mais do que quando o VO2 foi presumido por
 * superfície corporal. Apresentar os dois com a mesma cara transformaria uma
 * conta de bolso em medida hemodinâmica, que ela não é.
 */

export type EntradaFick = {
  hemoglobina?: number;
  sao2?: number;
  svo2?: number;
  pao2?: number;
  pvo2?: number;
  pesoKg?: number;
  alturaCm?: number;
  /** Informado em mL/min. Tem precedência sobre a estimativa. */
  vo2Informado?: number;
};

const informado = (v?: number): v is number => typeof v === "number" && Number.isFinite(v);
const arredonda = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;

/** Capacidade de transporte da hemoglobina, em mL de O2 por grama. */
export const CONSTANTE_HUFNER = 1.34;
/** O2 dissolvido no plasma, por mmHg de pressão parcial. */
export const COEFICIENTE_DISSOLVIDO = 0.0031;
/** VO2 presumido por metro quadrado, quando não há medida. */
export const VO2_POR_M2 = 125;

/**
 * A saturação entra como fração. Aceita 98 e 0,98, como os campos de FiO2 —
 * quem digita em sala não deve ter de lembrar qual formato a tela quer.
 */
function fracao(saturacao: number): number {
  return saturacao > 1 ? saturacao / 100 : saturacao;
}

/**
 * Conteúdo de O2 = 1,34 × Hb × saturação + 0,0031 × pressão parcial.
 *
 * O termo dissolvido é pequeno em ar ambiente e deixa de ser desprezível em
 * FiO2 alta, então entra quando a pressão parcial for informada.
 */
export function conteudoOxigenio(hb: number, saturacao: number, pressaoParcial?: number): number {
  const ligado = CONSTANTE_HUFNER * hb * fracao(saturacao);
  const dissolvido = informado(pressaoParcial) ? COEFICIENTE_DISSOLVIDO * pressaoParcial : 0;
  return arredonda(ligado + dissolvido);
}

/** Superfície corporal por Mosteller: √(altura × peso ÷ 3600). */
export function superficieCorporal(pesoKg: number, alturaCm: number): number | undefined {
  if (!informado(pesoKg) || !informado(alturaCm) || pesoKg <= 0 || alturaCm <= 0) return undefined;
  return arredonda(Math.sqrt((alturaCm * pesoKg) / 3600));
}

export type ResultadoFick = {
  cao2: number;
  cvo2: number;
  diferenca: number;
  vo2: number;
  origemVo2: "informado" | "estimado";
  debito: number;
  superficie?: number;
  indice?: number;
  faltando: string[];
  aviso: string;
};

/**
 * DC = VO2 ÷ (CaO2 − CvO2) × 10.
 *
 * O fator 10 acerta as unidades: os conteúdos vêm em mL de O2 por 100 mL de
 * sangue, e o débito sai em litros por minuto.
 *
 * Diferença arteriovenosa nula ou negativa não gera resultado. Ela não existe
 * fisiologicamente, e deixar passar produziria um débito infinito ou negativo
 * com cara de número válido.
 */
export function calcularFick(e: EntradaFick): ResultadoFick | undefined {
  const faltando: string[] = [];
  if (!informado(e.hemoglobina)) faltando.push("hemoglobina");
  if (!informado(e.sao2)) faltando.push("SaO2");
  if (!informado(e.svo2)) faltando.push("SvO2");
  if (!informado(e.hemoglobina) || !informado(e.sao2) || !informado(e.svo2)) return undefined;

  const cao2 = conteudoOxigenio(e.hemoglobina, e.sao2, e.pao2);
  const cvo2 = conteudoOxigenio(e.hemoglobina, e.svo2, e.pvo2);
  const diferenca = arredonda(cao2 - cvo2);
  if (diferenca <= 0) return undefined;

  const superficie = informado(e.pesoKg) && informado(e.alturaCm)
    ? superficieCorporal(e.pesoKg, e.alturaCm)
    : undefined;

  let vo2: number;
  let origemVo2: ResultadoFick["origemVo2"];
  if (informado(e.vo2Informado) && e.vo2Informado > 0) {
    vo2 = e.vo2Informado;
    origemVo2 = "informado";
  } else if (superficie) {
    vo2 = Math.round(VO2_POR_M2 * superficie);
    origemVo2 = "estimado";
  } else {
    faltando.push("VO2, ou peso e altura para estimá-lo");
    return undefined;
  }

  const debito = arredonda((vo2 / diferenca) * 10 / 100, 2);
  const indice = superficie ? arredonda(debito / superficie, 2) : undefined;

  const aviso = origemVo2 === "informado"
    ? "Resultado baseado em VO2 informado."
    : `Resultado baseado em VO2 estimado (${VO2_POR_M2} mL/min/m²). Estimativa indireta — não equivale a medida direta do débito cardíaco.`;

  return { cao2, cvo2, diferenca, vo2, origemVo2, debito, superficie, indice, faltando, aviso };
}

export const FORMULA_FICK = "DC = VO2 ÷ (CaO2 − CvO2) × 10   |   CaO2 = 1,34 × Hb × SaO2 + 0,0031 × PaO2";
