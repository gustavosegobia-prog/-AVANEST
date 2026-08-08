/**
 * Eletrólitos, glicose e hemoglobina.
 *
 * Duas decisões estruturam este arquivo.
 *
 * A primeira: tudo é convertido para uma unidade interna assim que entra, e as
 * contas só existem nessa unidade. Calculadora que aceita mg/dL e mmol/L e sai
 * espalhando conversão pelo meio das fórmulas é onde os erros de unidade
 * nascem — e erro de unidade em cálcio ou glicose não parece errado, só está.
 *
 * A segunda: as faixas de referência ficam aqui, num lugar só, e não dentro da
 * tela. Serviço que revisa uma faixa muda um número neste arquivo.
 */

export type Unidade = "mmol/L" | "mEq/L" | "mg/dL" | "g/dL";

/** Fatores para converter mg/dL em mmol/L, por analito. */
const PARA_MMOL: Record<string, number> = {
  calcio: 1 / 4.008, // massa molar 40,08, valência 2
  glicose: 1 / 18.016,
  ureia: 1 / 6.006,
  creatinina: 1 / 11.312,
  magnesio: 1 / 2.431,
};

/**
 * Converte para a unidade interna do analito.
 * Na e K: mmol/L e mEq/L são numericamente iguais (valência 1), então a
 * "conversão" é identidade — mas passa por aqui na mesma, para a tela não ter
 * de saber disso.
 */
export function paraInterno(analito: string, valor: number, unidade: Unidade): number {
  if (analito === "sodio" || analito === "potassio" || analito === "cloro") return valor;
  if (unidade === "mg/dL" && PARA_MMOL[analito]) return valor * PARA_MMOL[analito];
  return valor;
}

/** Volta da unidade interna para a que a pessoa escolheu ver. */
export function paraExibicao(analito: string, valor: number, unidade: Unidade): number {
  if (unidade === "mg/dL" && PARA_MMOL[analito]) return valor / PARA_MMOL[analito];
  return valor;
}

export type Faixa = { min: number; max: number; unidade: Unidade; rotulo: string };

/** Faixas de referência do adulto. Um lugar só, para revisar sem caçar. */
export const FAIXAS: Record<string, Faixa> = {
  sodio: { min: 135, max: 145, unidade: "mmol/L", rotulo: "Sódio" },
  potassio: { min: 3.5, max: 5.1, unidade: "mmol/L", rotulo: "Potássio" },
  cloro: { min: 98, max: 107, unidade: "mmol/L", rotulo: "Cloro" },
  calcioTotal: { min: 8.6, max: 10.2, unidade: "mg/dL", rotulo: "Cálcio total" },
  calcioIonizado: { min: 1.12, max: 1.32, unidade: "mmol/L", rotulo: "Cálcio iônico" },
  magnesio: { min: 1.7, max: 2.4, unidade: "mg/dL", rotulo: "Magnésio" },
  glicose: { min: 70, max: 99, unidade: "mg/dL", rotulo: "Glicose" },
  hemoglobina: { min: 12, max: 17, unidade: "g/dL", rotulo: "Hemoglobina" },
  albumina: { min: 3.5, max: 5.2, unidade: "g/dL", rotulo: "Albumina" },
  creatinina: { min: 0.6, max: 1.3, unidade: "mg/dL", rotulo: "Creatinina" },
  ureia: { min: 15, max: 45, unidade: "mg/dL", rotulo: "Ureia" },
};

export type Situacao = "normal" | "baixo" | "alto";

export function situacao(analito: string, valor: number): Situacao | undefined {
  const faixa = FAIXAS[analito];
  if (!faixa || !Number.isFinite(valor)) return undefined;
  if (valor < faixa.min) return "baixo";
  if (valor > faixa.max) return "alto";
  return "normal";
}

/**
 * Sódio corrigido pela hiperglicemia, por Hillier: some 2,4 mmol/L ao sódio a
 * cada 100 mg/dL de glicose acima de 100.
 *
 * Hillier e não o fator clássico de 1,6: o de 1,6 vem de um trabalho antigo e
 * subestima a correção nas glicemias altas, que é justamente onde a conta
 * importa. O fator fica exposto em FATOR_SODIO_GLICOSE para ser trocado se o
 * serviço preferir outro.
 */
export const FATOR_SODIO_GLICOSE = 2.4;

export function sodioCorrigido(sodio: number, glicoseMgDl: number): number | undefined {
  if (!Number.isFinite(sodio) || !Number.isFinite(glicoseMgDl)) return undefined;
  if (glicoseMgDl <= 100) return Math.round(sodio * 10) / 10;
  const correcao = (FATOR_SODIO_GLICOSE * (glicoseMgDl - 100)) / 100;
  return Math.round((sodio + correcao) * 10) / 10;
}

/**
 * Cálcio corrigido pela albumina: soma 0,8 mg/dL por g/dL de albumina abaixo
 * de 4.
 *
 * Vale como estimativa grosseira, e só faz sentido quando não há cálcio
 * iônico. Havendo iônico, é ele que se interpreta — a correção pela albumina
 * erra em doença crítica, que é onde ela mais é usada.
 */
export const FATOR_CALCIO_ALBUMINA = 0.8;
export const ALBUMINA_REFERENCIA = 4;

export function calcioCorrigido(calcioTotalMgDl: number, albuminaGdl: number): number | undefined {
  if (!Number.isFinite(calcioTotalMgDl) || !Number.isFinite(albuminaGdl)) return undefined;
  const valor = calcioTotalMgDl + FATOR_CALCIO_ALBUMINA * (ALBUMINA_REFERENCIA - albuminaGdl);
  return Math.round(valor * 100) / 100;
}

export const AVISO_CALCIO =
  "Havendo cálcio iônico, interprete-o diretamente: ele não deve ser substituído pelo cálcio total corrigido.";

export const FORMULA_SODIO = `Na corrigido = Na medido + ${FATOR_SODIO_GLICOSE} × (glicose − 100) ÷ 100  (Hillier)`;
export const FORMULA_CALCIO = `Ca corrigido = Ca total + ${FATOR_CALCIO_ALBUMINA} × (${ALBUMINA_REFERENCIA} − albumina)`;
