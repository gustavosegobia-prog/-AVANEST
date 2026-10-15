/**
 * AS DOSES DO PROTOCOLO PARA ESTE PACIENTE.
 *
 * Nada de fórmula nova: a conta é `calcular` da calculadora de doses (dose
 * total = peso × dose/kg; volume = dose ÷ concentração, com a conversão de
 * unidade e o teto de lá), e o peso de cada fármaco é `pesoDaDose` (ideal,
 * ajustado ou magro no obeso). O que este arquivo acrescenta é o que a sala
 * de crise precisa e a calculadora não tinha:
 *
 * - escolher a faixa (adulto, gestante, criança, recém-nascido) pela idade;
 * - recusar a conta quando falta peso, idade ou concentração, dizendo o quê;
 * - os alertas: teto, peso estranho para a idade, apresentação errada para a
 *   via, dose da criança acima da do adulto, nomes que se confundem.
 */

import {
  calcular, converter, ESCREVER_POR, virgula, type Apresentacao, type Calculo, type DosePorKg, type Unidade,
} from "../calculos/doses.ts";
import { pesoDaDose, type PesoDaDose } from "../calculos/peso.ts";
import type { DoseDoProtocolo, Populacao, Protocolo, VolumeDoProtocolo } from "./tipos.ts";

export type PacienteDaConsulta = {
  /** Em anos, com fração (8 meses = 0,67). */
  idadeAnos: number | null;
  pesoKg: number | null;
  alturaCm?: number | null;
  sexo?: string | null;
  gestante?: boolean;
};

export type Alerta = { nivel: "perigo" | "atencao" | "info"; texto: string };

const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
/** 10 → "10"; 0,25 → "0,25"; 2,666 → "2,67". */
export const numero = (v: number, casas = 2) => virgula(arred(v, casas));

export const ROTULO_POPULACAO: Record<Populacao, string> = {
  adulto: "Adulto", gestante: "Gestante", pediatrico: "Criança", neonatal: "Recém-nascido",
};

/**
 * A faixa pela idade: recém-nascido no primeiro mês; criança até 12 anos (o
 * corte dos cartões de anafilaxia e da calculadora); depois, adulto — ou
 * gestante, quando marcado. Sem idade, sem faixa: a tela pede.
 */
export function populacaoDe(p: PacienteDaConsulta): Populacao | null {
  if (p.idadeAnos === null || !Number.isFinite(p.idadeAnos) || p.idadeAnos < 0) return null;
  if (p.idadeAnos < 1 / 12) return "neonatal";
  if (p.idadeAnos < 12) return "pediatrico";
  return p.gestante ? "gestante" : "adulto";
}

const FAIXA_DA_DOSE: Record<DoseDoProtocolo["populacao"], Populacao[]> = {
  adulto: ["adulto", "gestante"],
  pediatrico: ["pediatrico", "neonatal"],
  todas: ["adulto", "gestante", "pediatrico", "neonatal"],
};

/** A dose vale para este paciente? A faixa e, quando há, a idade (início incluso, fim não). */
export function doseServe(d: DoseDoProtocolo, populacao: Populacao, idadeAnos: number | null): boolean {
  if (!FAIXA_DA_DOSE[d.populacao].includes(populacao)) return false;
  if (!d.idadeAnos || idadeAnos === null) return true;
  return (d.idadeAnos.min === undefined || idadeAnos >= d.idadeAnos.min)
    && (d.idadeAnos.max === undefined || idadeAnos < d.idadeAnos.max);
}

/**
 * Peso que não combina com a idade. Os limites são largos de propósito: o
 * alerta existe para pegar o erro de digitação (libra no lugar de kg, meses no
 * lugar de anos), não para discutir o percentil.
 */
const PESO_PLAUSIVEL: Array<{ ate: number; min: number; max: number; rotulo: string }> = [
  { ate: 1 / 12, min: 0.4, max: 6, rotulo: "um recém-nascido" },
  { ate: 1, min: 2, max: 15, rotulo: "menos de 1 ano" },
  { ate: 6, min: 6, max: 40, rotulo: "1 a 5 anos" },
  { ate: 12, min: 12, max: 100, rotulo: "6 a 11 anos" },
  { ate: Infinity, min: 25, max: 300, rotulo: "a idade informada" },
];

export function conferirPaciente(p: PacienteDaConsulta): Alerta[] {
  const alertas: Alerta[] = [];
  if (p.idadeAnos === null) alertas.push({ nivel: "atencao", texto: "Sem idade: informe para escolher as doses de adulto ou de criança." });
  if (!ok(p.pesoKg)) {
    alertas.push({ nivel: "atencao", texto: "Sem peso: as doses por kg não são calculadas." });
  } else if (p.idadeAnos !== null) {
    const faixa = PESO_PLAUSIVEL.find((f) => p.idadeAnos! < f.ate)!;
    if (p.pesoKg < faixa.min || p.pesoKg > faixa.max) {
      alertas.push({
        nivel: "perigo",
        texto: `${numero(p.pesoKg, 1)} kg é incomum para ${faixa.rotulo}. Confira o peso (kg, não libra) e a idade (anos, não meses) antes de usar as doses.`,
      });
    }
  }
  if (ok(p.alturaCm) && (p.alturaCm < 30 || p.alturaCm > 230)) {
    alertas.push({ nivel: "atencao", texto: `Altura de ${numero(p.alturaCm, 0)} cm parece errada: confira (cm, não metros).` });
  }
  if (p.gestante && p.idadeAnos !== null && p.idadeAnos < 12) {
    alertas.push({ nivel: "atencao", texto: "Marcada como gestante com menos de 12 anos: confira a idade." });
  }
  return alertas;
}

/** "10–20 mcg (dose fixa)", "2 mcg/kg", "0,1–2 mcg/kg/min", "2 UI/h". */
export function escreverDose(d: DosePorKg): string {
  const faixa = [d.min, d.usual, d.max].filter((v): v is number => v !== undefined).map((v) => numero(v, 3)).join("–");
  return `${faixa} ${d.unidade}${ESCREVER_POR[d.por]}`;
}

/**
 * Nomes e rótulos que se confundem. É o alerta de "medicamentos com nomes ou
 * apresentações semelhantes": aparece no cartão do fármaco, sem bloquear.
 */
const SEMELHANTES: Record<string, string> = {
  Adrenalina: "Não confundir com noradrenalina. A ampola é 1 mg/mL (1:1.000); a solução 1:10.000 tem 100 mcg/mL e a 1:100.000, 10 mcg/mL.",
  Noradrenalina: "Não confundir com adrenalina: ampolas e seringas parecidas.",
  Vasopressina: "A dose é em unidades (UI), não em mg.",
  Succinilcolina: "Etiquetar a seringa: bloqueador neuromuscular.",
  Rocurônio: "Etiquetar a seringa: bloqueador neuromuscular.",
  "Sulfato de magnésio": "Confira a concentração: 10%, 20% e 50% existem, com o mesmo aspecto.",
};

export type DoseCalculada = {
  dose: DoseDoProtocolo;
  /** A dose de referência, como a fonte escreve. */
  referencia: string;
  /** A apresentação usada na conta (com a diluição por peso já resolvida). */
  apresentacao: Apresentacao | null;
  contas: Calculo[];
  peso: PesoDaDose | null;
  /** Por que não há número: falta peso, falta idade, unidade incompatível. */
  bloqueio: string | null;
  alertas: Alerta[];
};

/** A partir daqui, a criança tem peso de adulto para efeito de dose. */
export const PESO_DE_ADULTO = 40;

const porKg = (d: DosePorKg) => d.por === "kg" || d.por === "kg/h" || d.por === "kg/min";
const viaCombina = (vias: string[] | undefined, via: string) => !vias || vias.some((v) => via.startsWith(v));

/** A apresentação concreta: a diluição por peso vira concentração com o peso do paciente. */
function concretizar(d: DoseDoProtocolo, indice: number, pesoKg: number | null): Apresentacao | null {
  const a = d.apresentacoes[indice] ?? d.apresentacoes[0];
  if (!a) return null;
  if (!a.porPeso) return a;
  if (!ok(pesoKg)) return null;
  const total = a.quantidade * pesoKg;
  return {
    rotulo: `${a.rotulo} — para ${numero(pesoKg, 1)} kg: ${numero(total, 2)} ${a.unidade} em ${numero(a.mL, 0)} mL`,
    quantidade: total, unidade: a.unidade, mL: a.mL,
  };
}

/** A dose da outra faixa, para dizer a diferença ("na criança: 2 mcg/kg"). */
function textoDoPar(d: DoseDoProtocolo, protocolo: Protocolo): string | null {
  const par = d.par ? protocolo.medicamentos.find((m) => m.id === d.par) : undefined;
  if (!par) return null;
  const quem = par.populacao === "adulto" ? "No adulto" : par.populacao === "pediatrico" ? "Na criança" : "Em qualquer idade";
  return `${quem}: ${escreverDose(par.dose)}${par.tetoAbsoluto ? `, máximo de ${numero(par.tetoAbsoluto.valor)} ${par.tetoAbsoluto.unidade}` : ""}.`;
}

/** O maior número que a dose do adulto alcança, quando é fixa — para comparar com a da criança. */
function maximoDoAdulto(d: DoseDoProtocolo, protocolo: Protocolo): { valor: number; unidade: Unidade } | null {
  const par = d.par ? protocolo.medicamentos.find((m) => m.id === d.par) : undefined;
  if (!par || par.populacao !== "adulto" || (par.dose.por !== "fixa" && par.dose.por !== "min" && par.dose.por !== "h")) return null;
  const valor = Math.max(...[par.dose.min, par.dose.usual, par.dose.max].filter((v): v is number => v !== undefined));
  return { valor, unidade: par.dose.unidade };
}

export function calcularDose(
  d: DoseDoProtocolo, protocolo: Protocolo, p: PacienteDaConsulta, indiceApresentacao = 0,
): DoseCalculada {
  const alertas: Alerta[] = [];
  const base: Omit<DoseCalculada, "contas" | "bloqueio" | "apresentacao" | "peso"> = {
    dose: d, referencia: escreverDose(d.dose), alertas,
  };

  const corpo = { pesoKg: p.pesoKg, alturaCm: p.alturaCm ?? null, sexo: p.sexo ?? null, idadeAnos: p.idadeAnos };
  const peso = ok(p.pesoKg) ? pesoDaDose(d.pesoBase, corpo) : null;
  if (peso?.aviso) alertas.push({ nivel: "info", texto: peso.aviso });
  if (peso && peso.base !== "atual" && peso.kg !== null) {
    alertas.push({ nivel: "info", texto: `Calculado pelo ${peso.base === "ideal" ? "peso ideal" : peso.base === "ajustado" ? "peso ajustado" : "peso magro"}: ${numero(peso.kg, 1)} kg.` });
  }

  const par = textoDoPar(d, protocolo);
  if (par) alertas.push({ nivel: "info", texto: par });
  if (SEMELHANTES[d.farmaco]) alertas.push({ nivel: "info", texto: SEMELHANTES[d.farmaco] });
  // Os cuidados do fármaco (contraindicações, precauções) não são alarme deste
  // paciente: a tela os lista à parte, em `dose.cuidados`.

  const precisaPeso = porKg(d.dose) || Boolean(d.apresentacoes[indiceApresentacao]?.porPeso);
  if (precisaPeso && !ok(p.pesoKg)) {
    return { ...base, apresentacao: null, contas: [], peso, bloqueio: "Informe o peso para calcular." };
  }

  // Sem apresentação cadastrada (fibrinogênio, complexo protrombínico): o
  // frasco varia com o fabricante, então sai a dose total e o volume fica
  // para a bula. Com apresentação cadastrada que não se resolve, nada sai.
  const semFrasco = d.apresentacoes.length === 0;
  const apresentacao = semFrasco ? null : concretizar(d, indiceApresentacao, peso?.kg ?? p.pesoKg);
  if (!apresentacao && !semFrasco) {
    return { ...base, apresentacao: null, contas: [], peso, bloqueio: "Sem concentração cadastrada: o volume não é calculado." };
  }
  const original = d.apresentacoes[indiceApresentacao] ?? d.apresentacoes[0];
  if (original && !viaCombina(original.vias, d.via)) {
    alertas.unshift({
      nivel: "perigo",
      texto: `${original!.rotulo} é para ${original!.vias!.join(" ou ")}, e esta dose é ${d.via}. Confira antes de aspirar.`,
    });
  }

  const contas = calcular(d.dose, peso?.kg ?? 1, apresentacao ?? undefined, d.tetoAbsoluto);
  const incompativel = contas.find((c) => c.incompatibilidade);
  if (incompativel) {
    return { ...base, apresentacao, contas: [], peso, bloqueio: incompativel.incompatibilidade! };
  }

  const limitada = contas.find((c) => c.limitada);
  if (limitada && d.tetoAbsoluto) {
    alertas.unshift({
      nivel: "perigo",
      texto: `Limitada ao máximo de ${numero(d.tetoAbsoluto.valor)} ${d.tetoAbsoluto.unidade}: pelo peso seria ${numero(limitada.doseAntesDoTeto!)} ${limitada.unidadeDose}.`,
    });
  }

  // Criança com corpo de adulto: a conta por kg passa da dose do adulto. Só a
  // partir de 40 kg — abaixo disso a dose por kg maior que a do adulto é a
  // da fonte (a criança pequena recebe proporcionalmente mais), e avisar ali
  // seria alarme falso no meio da crise.
  const adulto = maximoDoAdulto(d, protocolo);
  const pesoConta = peso?.kg ?? null;
  if (adulto && d.dose.por === "kg" && pesoConta !== null && pesoConta >= PESO_DE_ADULTO) {
    const maior = Math.max(...contas.map((c) => c.doseTotal));
    // Mesma grandeza em unidades diferentes (2 g do adulto, 2.500 mg da criança) também compara.
    const doAdulto = converter(adulto.valor, adulto.unidade, d.dose.unidade);
    if (doAdulto !== undefined && maior > doAdulto) {
      alertas.unshift({
        nivel: "atencao",
        texto: `Com ${numero(pesoConta, 1)} kg, a conta por kg (${numero(maior)} ${d.dose.unidade}) passa da dose do adulto (${numero(adulto.valor)} ${adulto.unidade}). Considere a dose do adulto.`,
      });
    }
  }

  const pequeno = contas.find((c) => c.volume !== undefined && c.unidadeVolume === "mL" && c.volume < 0.1);
  if (pequeno && apresentacao) {
    const diluida = d.apresentacoes.findIndex((a, i) => i !== indiceApresentacao && !a.porPeso && a.quantidade / a.mL < apresentacao.quantidade / apresentacao.mL);
    alertas.unshift({
      nivel: "atencao",
      texto: `Volume menor que 0,1 mL não se mede com precisão${diluida >= 0 ? `: use ${d.apresentacoes[diluida].rotulo}` : ": dilua mais"}.`,
    });
  }

  // Perigo primeiro, depois atenção, depois informação — na ordem em que surgiram.
  const ordem = { perigo: 0, atencao: 1, info: 2 } as const;
  alertas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  return { ...base, apresentacao, contas, peso, bloqueio: null };
}

export type VolumeCalculado = { volume: VolumeDoProtocolo; texto: string; base: string; bloqueio: string | null };

export function calcularVolume(v: VolumeDoProtocolo, p: PacienteDaConsulta): VolumeCalculado {
  const u = v.unidade ?? "mL";
  const faixa = (f: { min?: number; max?: number }) => [f.min, f.max].filter((x): x is number => x !== undefined);
  if (v.fixo) {
    const t = faixa(v.fixo).map((x) => numero(x, 0)).join(" a ");
    return { volume: v, texto: `${t} ${u}`, base: "fixo", bloqueio: null };
  }
  const porKgV = faixa(v.porKg ?? {});
  const base = `${porKgV.map((x) => numero(x, 2)).join(" a ")} ${u}/kg${v.maximo ? `, máximo de ${numero(v.maximo, 0)} ${u}` : ""}`;
  if (!ok(p.pesoKg)) return { volume: v, texto: "", base, bloqueio: "Informe o peso para calcular." };
  const conta = porKgV.map((x) => Math.min(x * p.pesoKg!, v.maximo ?? Infinity));
  return { volume: v, texto: `${[...new Set(conta.map((x) => numero(x, 0)))].join(" a ")} ${u}`, base, bloqueio: null };
}

export function volumeServe(v: VolumeDoProtocolo, populacao: Populacao): boolean {
  return FAIXA_DA_DOSE[v.populacao].includes(populacao);
}

/** Os passos que valem para a faixa: o da gestante só para a gestante. Sem faixa, todos. */
export function passosDe(protocolo: Protocolo, populacao: Populacao | null) {
  return protocolo.agirAgora.filter((x) => !x.so || populacao === null || x.so.includes(populacao));
}
