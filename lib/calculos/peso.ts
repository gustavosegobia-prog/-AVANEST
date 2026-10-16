/**
 * O PESO QUE ENTRA NA CONTA.
 *
 * No obeso, a dose por quilo pelo peso atual erra para mais em quase tudo:
 * cada fármaco se distribui num compartimento diferente. A tabela de doses
 * diz, por fármaco, qual peso usar (`pesoBase` em doses.ts), e esta é a única
 * conta desses pesos no AVANEST — a avaliação pré-anestésica mostra os mesmos
 * números (peso ideal e ajustado), e a ficha os recebe de lá (peso e altura
 * da avaliação, sexo do cadastro).
 *
 * - Atual: o da balança. Succinilcolina, sugamadex, neostigmina, vasoativos.
 * - Ideal (Devine, o mesmo do peso predito da ventilação): bloqueadores
 *   adespolarizantes, morfina, cetamina, anestésico local.
 * - Ajustado: ideal + 0,4 × (atual − ideal). Dexmedetomidina, fenitoína.
 * - Magro (Janmahasatian, 2005): indução com propofol e etomidato, fentanil,
 *   sufentanil e remifentanil.
 *
 * Referências: Ingrande e Lemmens, Br J Anaesth 2010; SOBA 2015.
 *
 * Quem pesa menos que o ideal (ou o magro) recebe pelo peso atual: o peso
 * "corrigido" nunca aumenta a dose.
 *
 * SÓ NO OBESO (IMC de 30 ou mais). Antes a troca valia para todo adulto com
 * altura e sexo, e o peso magro é sempre bem menor que o da balança: uma
 * paciente de 54 kg e 1,54 m (IMC 22,8) recebia fentanil por 34,9 kg e
 * midazolam por 46,9 kg — doses que o anestesiologista via como baixas demais,
 * e com razão. Fora da obesidade, o peso da balança é o peso da dose.
 */

export type BaseDePeso = "atual" | "ideal" | "ajustado" | "magro";

export const ROTULO_BASE: Record<BaseDePeso, string> = {
  atual: "peso atual",
  ideal: "peso ideal",
  ajustado: "peso ajustado",
  magro: "peso magro",
};

export type Antropometria = {
  pesoKg?: number | null;
  alturaCm?: number | null;
  /** "Masculino", "Feminino", "M", "F". */
  sexo?: string | null;
  idadeAnos?: number | null;
};

const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const umaCasa = (v: number) => Math.round(v * 10) / 10;

function sexoDe(s?: string | null): "m" | "f" | null {
  const t = String(s ?? "").trim().toLowerCase();
  if (t.startsWith("m")) return "m";
  if (t.startsWith("f")) return "f";
  return null;
}

/** Adulto (18 anos ou mais, ou idade desconhecida), altura plausível e sexo informado. */
function adulto(a: Antropometria): boolean {
  return (a.idadeAnos === null || a.idadeAnos === undefined || a.idadeAnos >= 18)
    && ok(a.alturaCm) && a.alturaCm <= 250 && sexoDe(a.sexo) !== null;
}

/**
 * Peso ideal de Devine: 50 kg (homem) ou 45,5 kg (mulher) + 2,3 kg por
 * polegada acima de 5 pés. Só vale para adulto a partir de 152 cm — abaixo
 * disso a fórmula inventa um número.
 */
export function pesoIdeal(a: Antropometria): number | null {
  if (!adulto(a) || a.alturaCm! < 152) return null;
  return umaCasa((sexoDe(a.sexo) === "m" ? 50 : 45.5) + 2.3 * (a.alturaCm! / 2.54 - 60));
}

/** Peso ajustado: o ideal mais 40% do excesso. Sem excesso, o próprio peso atual. */
export function pesoAjustado(a: Antropometria): number | null {
  const ideal = pesoIdeal(a);
  if (ideal === null || !ok(a.pesoKg)) return null;
  return a.pesoKg > ideal ? umaCasa(ideal + 0.4 * (a.pesoKg - ideal)) : a.pesoKg;
}

/** Peso magro de Janmahasatian: pelo peso e pelo IMC, diferente para homem e mulher. */
export function pesoMagro(a: Antropometria): number | null {
  if (!adulto(a) || !ok(a.pesoKg) || a.alturaCm! < 100) return null;
  const imc = a.pesoKg / (a.alturaCm! / 100) ** 2;
  const magro = sexoDe(a.sexo) === "m"
    ? (9270 * a.pesoKg) / (6680 + 216 * imc)
    : (9270 * a.pesoKg) / (8780 + 244 * imc);
  return umaCasa(magro);
}

/** IMC a partir do qual o peso da dose deixa de ser o da balança (obesidade, OMS). */
export const IMC_OBESIDADE = 30;

/** IMC do adulto com altura plausível; nulo sem altura. */
export function imcDe(a: Antropometria): number | null {
  if (!ok(a.pesoKg) || !ok(a.alturaCm) || a.alturaCm < 100 || a.alturaCm > 250) return null;
  return a.pesoKg / (a.alturaCm / 100) ** 2;
}

export type PesoDaDose = {
  /** O peso que entra na conta (nulo: sem peso). */
  kg: number | null;
  /** O peso de fato usado — volta a "atual" quando o outro não dá ou não diminui. */
  base: BaseDePeso;
  /** Por que não foi o peso pedido pela tabela. */
  aviso: string | null;
};

/** O peso de um fármaco para este paciente. */
export function pesoDaDose(base: BaseDePeso | undefined, a: Antropometria): PesoDaDose {
  const atual = ok(a.pesoKg) ? a.pesoKg : null;
  if (!base || base === "atual" || atual === null) return { kg: atual, base: "atual", aviso: null };
  // Criança: a tabela pediátrica já é pelo peso da balança.
  if (ok(a.idadeAnos) && a.idadeAnos < 18) return { kg: atual, base: "atual", aviso: null };
  // Fora da obesidade, o peso da balança.
  const imc = imcDe(a);
  if (imc !== null && imc < IMC_OBESIDADE) return { kg: atual, base: "atual", aviso: null };
  const corrigido = base === "ideal" ? pesoIdeal(a) : base === "ajustado" ? pesoAjustado(a) : pesoMagro(a);
  if (corrigido === null) {
    return {
      kg: atual, base: "atual",
      aviso: `No obeso (IMC de 30 ou mais), este fármaco vai pelo ${ROTULO_BASE[base]}. Sem altura e sexo, a conta usou o peso atual.`,
    };
  }
  if (corrigido >= atual) return { kg: atual, base: "atual", aviso: null };
  return { kg: corrigido, base, aviso: null };
}
