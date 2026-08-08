/**
 * Osmolalidade calculada e gap osmolar.
 *
 * O ponto que este módulo existe para não deixar passar: ureia e BUN não são o
 * mesmo número. Ureia (mg/dL) = BUN (mg/dL) × 2,14, porque a molécula de ureia
 * pesa mais que os dois nitrogênios que ela carrega. Dividir ureia por 2,8 —
 * o divisor do BUN — infla a osmolalidade calculada em torno de 6 mOsm/kg e
 * some com um gap osmolar que era real.
 *
 * Por isso quem usa escolhe explicitamente o que digitou, e cada escolha tem
 * seu divisor. Não há "detecção automática": a faixa dos dois se sobrepõe, e
 * adivinhar aqui seria trocar um erro visível por um invisível.
 */

export type TipoNitrogenio = "ureia" | "bun";

export type EntradaOsmolar = {
  osmolalidadeMedida?: number;
  sodio?: number;
  glicoseMgDl?: number;
  /** Ureia OU BUN, conforme `tipo`. Sempre em mg/dL. */
  nitrogenioMgDl?: number;
  tipo: TipoNitrogenio;
  etanolMgDl?: number;
};

/** Divisores que levam mg/dL a mOsm/kg. */
export const DIVISORES = {
  glicose: 18,
  bun: 2.8,
  ureia: 6,
  etanol: 4.6,
} as const;

const informado = (v?: number): v is number => typeof v === "number" && Number.isFinite(v);

export type ResultadoOsmolar = {
  calculada: number;
  gap?: number;
  formula: string;
  interpretacao?: string;
  faltando: string[];
};

/** Gap osmolar considerado dentro do esperado. Configurável. */
export const GAP_MAXIMO = 10;

/**
 * Osmolalidade calculada = 2 × Na + glicose/18 + nitrogênio/divisor
 * (+ etanol/4,6 quando informado).
 *
 * O sódio entra dobrado porque acompanha um ânion para cada cátion.
 */
export function calcularOsmolar(e: EntradaOsmolar): ResultadoOsmolar | undefined {
  const faltando: string[] = [];
  if (!informado(e.sodio)) faltando.push("sódio");
  if (!informado(e.glicoseMgDl)) faltando.push("glicose");
  if (!informado(e.nitrogenioMgDl)) faltando.push(e.tipo === "bun" ? "BUN" : "ureia");
  if (!informado(e.sodio) || !informado(e.glicoseMgDl) || !informado(e.nitrogenioMgDl)) return undefined;

  const divisorN = e.tipo === "bun" ? DIVISORES.bun : DIVISORES.ureia;
  let calculada = 2 * e.sodio + e.glicoseMgDl / DIVISORES.glicose + e.nitrogenioMgDl / divisorN;

  const partes = [
    "2 × Na",
    `glicose ÷ ${DIVISORES.glicose}`,
    `${e.tipo === "bun" ? "BUN" : "ureia"} ÷ ${divisorN}`,
  ];

  if (informado(e.etanolMgDl)) {
    calculada += e.etanolMgDl / DIVISORES.etanol;
    partes.push(`etanol ÷ ${DIVISORES.etanol}`);
  }

  calculada = Math.round(calculada * 10) / 10;
  const formula = `Osmolalidade calculada = ${partes.join(" + ")}`;

  if (!informado(e.osmolalidadeMedida)) {
    faltando.push("osmolalidade medida, para o gap");
    return { calculada, formula, faltando };
  }

  const gap = Math.round((e.osmolalidadeMedida - calculada) * 10) / 10;
  const interpretacao =
    gap > GAP_MAXIMO
      ? "Gap osmolar aumentado — interpretar no contexto clínico."
      : "Dentro da faixa esperada.";

  return { calculada, gap, formula, interpretacao, faltando };
}
