/**
 * Calculadora de doses: motor de cálculo e catálogo.
 *
 * Duas responsabilidades, separadas de propósito.
 *
 * O MOTOR faz a conta e protege a unidade. É ele que impede o erro que mata:
 * somar mcg com mg, dividir uma dose em mcg por uma concentração em mg/mL,
 * ler 0,5% como 5 mg/mL. Ele não sabe nada de medicamento — recebe números
 * com unidade e devolve números com unidade, ou se recusa a responder.
 *
 * O CATÁLOGO é a tabela clínica. Cada entrada carrega população, via,
 * indicação, apresentação, fonte, contexto da fonte e data de revisão. E
 * carrega uma situação: validado ou pendente. Pendente não calcula — aparece
 * na tela dizendo que falta fonte, em vez de devolver um número que parece
 * tão confiável quanto os outros.
 *
 * A idade escolhe a faixa etária sozinha, e as faixas não emprestam dose umas
 * das outras: rocurônio no lactente e na criança maior são registros
 * diferentes porque são doses diferentes.
 */

import type { BaseDePeso } from "./peso.ts";

export type Fonte = { obra: string; local: string };
export const citar = (f: Fonte) => `${f.obra} — ${f.local}`;

export const virgula = (v: number) => String(v).replace(".", ",");
const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
const ok = (v?: number): v is number => typeof v === "number" && Number.isFinite(v);

const SAESP = (contexto: string): Fonte => ({ obra: "SAESP, Tratado de Anestesiologia", local: contexto });

/**
 * A tabela do adulto veio do responsável técnico, não de um livro.
 *
 * Ela não é assinada como SAESP, e isso é de propósito: cadastrar como SAESP
 * um número que não foi localizado no SAESP é inventar uma referência. Quem
 * abrir o cartão vê de onde o valor veio e pode discordar dele.
 */
const SERVICO: Fonte = {
  obra: "Tabela de doses do adulto do serviço",
  local: "revisada pelo responsável técnico do AVANEST",
};

/**
 * A lista de doses do adulto que o responsável técnico mandou (43 fármacos),
 * conferida com Miller, Morgan & Mikhail e as bulas. Onde a lista divergia da
 * literatura (remifentanil, morfina, fenitoína, cisatracúrio, midazolam), vale
 * o número conferido, e o cartão diz o contexto.
 */
const LISTA: Fonte = {
  obra: "Lista de doses do adulto do serviço",
  local: "conferida com Miller, Morgan & Mikhail e as bulas",
};
const AES: Fonte = { obra: "American Epilepsy Society — estado de mal epiléptico", local: "Glauser et al., Epilepsy Currents, 2016" };
const AHA: Fonte = { obra: "American Heart Association — RCP e emergências cardiovasculares", local: "suporte avançado de vida, 2020" };
const NVPO: Fonte = { obra: "Quarto consenso de náusea e vômito pós-operatórios", local: "Gan et al., Anesthesia & Analgesia, 2020" };
const BULA: Fonte = { obra: "Bula do medicamento (ANVISA)", local: "posologia do adulto" };
/**
 * As diluições das bombas de vasoativo são as de uso corrente com as ampolas
 * brasileiras — sugestão do AVANEST, a conferir com o protocolo do serviço.
 */
const DILUICAO: Fonte = { obra: "Diluição padrão com as ampolas brasileiras", local: "sugestão do AVANEST, a conferir com o protocolo do serviço" };
const REVISAO_LISTA = "14/10/2026";
const MHAUS: Fonte = { obra: "MHAUS — protocolo de tratamento da hipertermia maligna", local: "Malignant Hyperthermia Association of the United States" };
const ASRA: Fonte = { obra: "ASRA — checklist da toxicidade sistêmica por anestésico local", local: "Neal et al., Reg Anesth Pain Med, 2018, revisão de 2020" };
const HEMORRAGIA: Fonte = { obra: "CRASH-2 (Lancet, 2010) e WOMAN (Lancet, 2017)", local: "recomendação da OMS para o ácido tranexâmico" };
const UTEROTONICOS: Fonte = { obra: "Consenso internacional de uterotônicos na cesariana", local: "Heesen et al., Anaesthesia, 2019" };
/** Os sete que faltavam na lista do serviço: crises, obstetrícia e analgesia. */
const REVISAO_INCLUIDOS = "15/10/2026";

/* ------------------------------------------------------------------ *
 * Unidades
 * ------------------------------------------------------------------ */

export type Unidade = "g" | "mg" | "mcg" | "UI" | "mEq";

/** Só massa converte. UI e mEq não têm equivalência: quem tentar, não recebe. */
const EM_MCG: Partial<Record<Unidade, number>> = { g: 1_000_000, mg: 1_000, mcg: 1 };

export function converter(valor: number, de: Unidade, para: Unidade): number | undefined {
  if (!ok(valor)) return undefined;
  if (de === para) return valor;
  const origem = EM_MCG[de];
  const destino = EM_MCG[para];
  if (origem === undefined || destino === undefined) return undefined;
  return (valor * origem) / destino;
}

/* ------------------------------------------------------------------ *
 * Apresentação
 * ------------------------------------------------------------------ */

export type Apresentacao = {
  rotulo: string;
  /** Quantidade de fármaco contida em `mL` mililitros. */
  quantidade: number;
  unidade: Unidade;
  mL: number;
};

/**
 * Porcentagem para mg/mL: 1% é 1 g em 100 mL, ou seja 10 mg/mL.
 *
 * É a conversão que mais se erra, e a que erra feio — ler "0,5%" como
 * "5 mg/mL" acerta por acaso; ler "2%" como "2 mg/mL" subestima o volume em
 * dez vezes.
 */
export function dePercentual(percentual: number, rotulo?: string): Apresentacao | undefined {
  if (!ok(percentual) || percentual <= 0) return undefined;
  return {
    rotulo: rotulo ?? `${virgula(percentual)}%`,
    quantidade: percentual * 10, unidade: "mg", mL: 1,
  };
}

/** Quanto de fármaco existe em 1 mL, na unidade da própria apresentação. */
export const porMl = (a: Apresentacao) => a.quantidade / a.mL;

export const escreverApresentacao = (a: Apresentacao) =>
  `${virgula(arred(porMl(a), 4))} ${a.unidade}/mL`;

/**
 * Bupivacaína pesada é 0,5%, ou seja 5 mg/mL.
 *
 * O erro que esta função existe para barrar é cadastrar "5%", que daria
 * 50 mg/mL — dez vezes a concentração real, num fármaco de uso intratecal.
 * O número 5 aparece nos dois jeitos de escrever, e é isso que torna a
 * confusão fácil e o resultado grave.
 */
export const CONCENTRACAO_MAXIMA_PLAUSIVEL_LOCAL = 20; // mg/mL, equivale a 2%

export function conferirAnestesicoLocal(nome: string, a: Apresentacao): string | undefined {
  if (a.unidade !== "mg") return undefined;
  const mgPorMl = porMl(a);
  const pesada = /pesada|hiperbá/i.test(nome);
  if (pesada && mgPorMl > 5) {
    return `Bupivacaína pesada é 0,5%, isto é 5 mg/mL. A apresentação informada dá ${virgula(arred(mgPorMl, 2))} mg/mL — confira se não foi lido “5%” no lugar de “0,5%”.`;
  }
  if (mgPorMl > CONCENTRACAO_MAXIMA_PLAUSIVEL_LOCAL) {
    return `${virgula(arred(mgPorMl, 2))} mg/mL é acima de qualquer apresentação usual de anestésico local. Confira a porcentagem.`;
  }
  return undefined;
}

/** Clonidina é sempre mcg/kg. Miligrama aqui é erro de mil vezes. */
export function conferirClonidina(nome: string, unidade: Unidade): string | undefined {
  if (/clonidina/i.test(nome) && unidade === "mg") {
    return "Clonidina se escreve em mcg/kg, nunca em mg/kg. Confira a unidade.";
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * O cálculo
 * ------------------------------------------------------------------ */

export type Nivel = "minima" | "usual" | "maxima";
export const ROTULO_NIVEL: Record<Nivel, string> = { minima: "Mínima", usual: "Usual", maxima: "Máxima" };

/**
 * Como a dose é expressa: bolo por quilo, bomba por quilo (hora ou minuto),
 * dose fixa, ou bomba sem peso por minuto (vasopressina em UI/min,
 * nitroglicerina em mcg/min, amiodarona em mg/min) ou por hora (ocitocina em
 * UI/h).
 */
export type Por = "kg" | "kg/h" | "kg/min" | "fixa" | "min" | "h";

export const ESCREVER_POR: Record<Por, string> = {
  kg: "/kg", "kg/h": "/kg/h", "kg/min": "/kg/min", fixa: " (dose fixa)", min: "/min", h: "/h",
};

/** Bomba sem peso: a dose é a mesma em qualquer paciente. */
export const semPeso = (por: Por) => por === "fixa" || por === "min" || por === "h";

export type DosePorKg = { min?: number; usual?: number; max?: number; unidade: Unidade; por: Por };

/** Teto absoluto, independente do peso. */
export type Teto = { valor: number; unidade: Unidade };

export type Calculo = {
  nivel: Nivel;
  dosePorKg: number;
  unidadeDose: Unidade;
  por: Por;
  /** Na unidade da dose, e no período dela: mg, mg/h ou mcg/min. */
  doseTotal: number;
  /** Só para bomba: a mesma dose levada para a hora. */
  dosePorHora?: number;
  volume?: number;
  unidadeVolume?: "mL" | "mL/h";
  limitada?: boolean;
  doseAntesDoTeto?: number;
  incompatibilidade?: string;
};

/**
 * Dose total = peso × dose/kg. Volume = dose total ÷ concentração.
 *
 * A dose permanece na unidade em que foi cadastrada até o fim — mcg continua
 * mcg. A conversão acontece uma vez só, na divisão pela apresentação, e só
 * entre unidades de massa.
 *
 * Bomba tem um passo a mais: dose em mcg/kg/min vira mcg/h multiplicando por
 * 60, e só então divide pela concentração. É a fórmula do remifentanil, e ela
 * está aqui em vez de na tela justamente para ser testável.
 */
export function calcularNivel(
  nivel: Nivel, dosePorKg: number, dose: DosePorKg, pesoKg: number,
  apresentacao?: Apresentacao, teto?: Teto,
): Calculo | undefined {
  if (!ok(dosePorKg) || !ok(pesoKg) || pesoKg <= 0 || dosePorKg <= 0) return undefined;

  // Dose fixa não vê o peso. Multiplicar 4 mg de ondansetrona por 70 kg
  // daria 280 mg, e é o tipo de erro que uma calculadora não pode oferecer.
  // A bomba sem peso (UI/min, mcg/min, UI/h) também não.
  const bruta = semPeso(dose.por) ? dosePorKg : dosePorKg * pesoKg;
  let doseTotal = bruta;
  let limitada = false;

  if (teto) {
    const tetoNaUnidade = converter(teto.valor, teto.unidade, dose.unidade);
    if (tetoNaUnidade !== undefined && bruta > tetoNaUnidade) {
      doseTotal = tetoNaUnidade;
      limitada = true;
    }
  }

  const porHora = dose.por === "kg/min" || dose.por === "min" ? doseTotal * 60
    : dose.por === "kg/h" || dose.por === "h" ? doseTotal : undefined;

  const base: Calculo = {
    nivel, dosePorKg, unidadeDose: dose.unidade, por: dose.por,
    doseTotal: arred(doseTotal, 3),
    ...(porHora !== undefined ? { dosePorHora: arred(porHora, 3) } : {}),
    ...(limitada ? { limitada, doseAntesDoTeto: arred(bruta, 3) } : {}),
  };

  if (!apresentacao) return base;

  // Para bomba o que se divide é a dose por hora; para bolo, a dose total.
  const paraDividir = porHora ?? doseTotal;
  const naUnidadeDaApresentacao = converter(paraDividir, dose.unidade, apresentacao.unidade);
  if (naUnidadeDaApresentacao === undefined) {
    return {
      ...base,
      incompatibilidade: `Dose em ${dose.unidade} e apresentação em ${apresentacao.unidade}: sem equivalência entre as duas. Confira a apresentação.`,
    };
  }

  const concentracao = porMl(apresentacao);
  if (!ok(concentracao) || concentracao <= 0) return base;

  return {
    ...base,
    volume: arred(naUnidadeDaApresentacao / concentracao, 2),
    unidadeVolume: porHora !== undefined ? "mL/h" : "mL",
  };
}

/** Os níveis que a dose cadastrada oferecer, na ordem mínima → máxima. */
export function calcular(dose: DosePorKg, pesoKg: number, apresentacao?: Apresentacao, teto?: Teto): Calculo[] {
  const niveis: Array<[Nivel, number | undefined]> = [
    ["minima", dose.min], ["usual", dose.usual], ["maxima", dose.max],
  ];
  return niveis
    .filter(([, v]) => ok(v))
    .map(([n, v]) => calcularNivel(n, v!, dose, pesoKg, apresentacao, teto))
    .filter((c): c is Calculo => c !== undefined);
}

/* ------------------------------------------------------------------ *
 * Faixa etária
 * ------------------------------------------------------------------ */

export type Populacao = "neonato" | "lactente" | "crianca" | "adulto";

export const ROTULO_POPULACAO: Record<Populacao, string> = {
  neonato: "Neonato", lactente: "Lactente (até 1 ano)",
  crianca: "Criança (acima de 1 ano)", adulto: "Adulto",
};

/**
 * Os cortes.
 *
 * "Lactente ≤ 1 ano" e "criança > 1 ano" vêm do material. O corte do neonato
 * e o do adulto são do AVANEST — o material não os define em número — e ficam
 * declarados aqui para o serviço trocar num lugar só. Com idade em meses, o
 * neonato é o primeiro mês.
 */
export const MESES_LACTENTE = 12;
export const MESES_ADULTO = 12 * 12;

export function faixaEtaria(idadeMeses?: number): Populacao | undefined {
  if (!ok(idadeMeses) || idadeMeses < 0) return undefined;
  if (idadeMeses < 1) return "neonato";
  if (idadeMeses <= MESES_LACTENTE) return "lactente";
  if (idadeMeses < MESES_ADULTO) return "crianca";
  return "adulto";
}

export const emMeses = (anos?: number, meses?: number): number | undefined => {
  if (!ok(anos) && !ok(meses)) return undefined;
  return (ok(anos) ? anos : 0) * 12 + (ok(meses) ? meses : 0);
};

/* ------------------------------------------------------------------ *
 * Catálogo
 * ------------------------------------------------------------------ */

export type GrupoId =
  | "inducao" | "opioides" | "bloqueadores" | "reversao" | "analgesia"
  | "antiemeticos" | "antibioticos" | "locais" | "bic" | "raqui" | "adjuvantes"
  | "cardiovascular" | "arritmias" | "anticonvulsivantes" | "crises" | "obstetricia";

export const GRUPOS: Array<{ id: GrupoId; nome: string; icone: string }> = [
  { id: "inducao", nome: "Indução e hipnóticos", icone: "💉" },
  { id: "opioides", nome: "Opioides", icone: "🌙" },
  { id: "bloqueadores", nome: "Bloqueadores neuromusculares", icone: "💪" },
  { id: "reversao", nome: "Reversão", icone: "🔄" },
  { id: "bic", nome: "Infusão contínua", icone: "⏱️" },
  { id: "analgesia", nome: "Analgesia", icone: "💊" },
  { id: "adjuvantes", nome: "Adjuvantes e sedação", icone: "🌿" },
  { id: "locais", nome: "Anestésicos locais", icone: "🎯" },
  { id: "cardiovascular", nome: "Cardiovascular: vasopressores e bombas", icone: "❤️" },
  { id: "arritmias", nome: "Arritmias e PCR", icone: "💓" },
  { id: "crises", nome: "Crises: hipertermia maligna e toxicidade por anestésico local", icone: "🚨" },
  { id: "anticonvulsivantes", nome: "Anticonvulsivantes", icone: "⚡" },
  { id: "obstetricia", nome: "Obstetrícia e sangramento", icone: "🤰" },
  { id: "raqui", nome: "Raquianestesia pediátrica", icone: "🩺" },
  { id: "antiemeticos", nome: "Antieméticos e profilaxia", icone: "🤢" },
  { id: "antibioticos", nome: "Antibióticos", icone: "🧫" },
];

/** Validado calcula. Pendente aparece, mas não calcula. */
export type SituacaoDose = "validado" | "pendente";

export type Medicamento = {
  id: string;
  nome: string;
  grupo: GrupoId;
  populacoes: Populacao[];
  via: string;
  indicacao?: string;
  dose?: DosePorKg;
  tetoAbsoluto?: Teto;
  apresentacoes: Apresentacao[];
  fonte?: Fonte;
  /** O trecho de onde veio, quando a fonte descreve um contexto estreito. */
  contextoFonte?: string;
  observacao?: string;
  /** Aviso forte, mostrado em destaque no cartão. */
  alerta?: string;
  /** Fármaco que se titula: a tela mostra a faixa e não um "fazer" único. */
  titulavel?: boolean;
  /** Regra condicional que a tela resolve com peso, idade e comorbidade. */
  regra?: "cefazolina" | "cetorolaco" | "neostigmina";
  /** Sai da lista principal: aparece dentro do cartão de outro. */
  oculto?: boolean;
  /**
   * No adulto, o peso da conta (lib/calculos/peso.ts): ideal, ajustado ou
   * magro no obeso. Sem ele, o peso atual.
   */
  pesoBase?: BaseDePeso;
  situacao: SituacaoDose;
  revisao?: string;
};

const REVISAO = "09/08/2026";
const mgml = (q: number, rotulo?: string): Apresentacao =>
  ({ rotulo: rotulo ?? `${virgula(q)} mg/mL`, quantidade: q, unidade: "mg", mL: 1 });
const mcgml = (q: number, rotulo?: string): Apresentacao =>
  ({ rotulo: rotulo ?? `${virgula(q)} mcg/mL`, quantidade: q, unidade: "mcg", mL: 1 });

const PED: Populacao[] = ["neonato", "lactente", "crianca"];
/** Dose por quilo igual em qualquer idade (dantroleno, emulsão lipídica). */
const TODAS: Populacao[] = [...PED, "adulto"];

/** Emulsão lipídica a 20%: 20 g em 100 mL, ou seja 0,2 g/mL. */
const LIPIDICA_20: Apresentacao = { rotulo: "Frasco a 20% (20 g em 100 mL)", quantidade: 0.2, unidade: "g", mL: 1 };

export const CATALOGO: Medicamento[] = [
  /* ---------------- Indução e hipnóticos — pediatria ---------------- */
  {
    id: "propofol-ped", nome: "Propofol — indução", grupo: "inducao", populacoes: PED, via: "IV",
    dose: { min: 2, max: 5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "etomidato-ped", nome: "Etomidato", grupo: "inducao", populacoes: PED, via: "IV",
    dose: { usual: 0.3, unidade: "mg", por: "kg" }, apresentacoes: [mgml(2)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "cetamina-ped-iv", nome: "Cetamina — IV", grupo: "inducao", populacoes: PED, via: "IV",
    dose: { min: 1, max: 4, unidade: "mg", por: "kg" }, apresentacoes: [mgml(50), mgml(10)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    observacao: "Via IV. As doses de IM e VO são outras — não se trocam entre si.",
  },
  {
    id: "cetamina-ped-im", nome: "Cetamina — IM", grupo: "inducao", populacoes: PED, via: "IM",
    dose: { min: 6, max: 10, unidade: "mg", por: "kg" }, apresentacoes: [mgml(50)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "cetamina-ped-vo", nome: "Cetamina — VO", grupo: "inducao", populacoes: PED, via: "VO",
    dose: { min: 3, max: 6, unidade: "mg", por: "kg" }, apresentacoes: [mgml(50)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "tiopental-ped", nome: "Tiopental", grupo: "inducao", populacoes: PED, via: "IV",
    dose: { min: 5, max: 6, unidade: "mg", por: "kg" }, apresentacoes: [mgml(25)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    alerta: "Em neonato, considerar redução de aproximadamente 20 a 30%.",
  },
  {
    id: "diazepam-ped", nome: "Diazepam", grupo: "inducao", populacoes: PED, via: "IV",
    dose: { min: 0.2, max: 0.4, unidade: "mg", por: "kg" }, apresentacoes: [mgml(5)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },

  /* ---------------- Midazolam pediátrico, por via ---------------- */
  {
    id: "midazolam-ped-vo", nome: "Midazolam — VO", grupo: "inducao", populacoes: PED, via: "VO",
    indicacao: "Pré-medicação",
    dose: { min: 0.25, max: 0.5, unidade: "mg", por: "kg" },
    tetoAbsoluto: { valor: 20, unidade: "mg" }, apresentacoes: [mgml(5)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    observacao: "O capítulo também descreve, para a via oral, a faixa de 0,25 a 1 mg/kg. Máximo de 20 mg.",
  },
  {
    id: "midazolam-ped-im", nome: "Midazolam — IM", grupo: "inducao", populacoes: PED, via: "IM",
    dose: { min: 0.1, max: 0.15, unidade: "mg", por: "kg" },
    tetoAbsoluto: { valor: 7.5, unidade: "mg" }, apresentacoes: [mgml(5)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "midazolam-ped-retal", nome: "Midazolam — retal", grupo: "inducao", populacoes: PED, via: "Retal",
    dose: { usual: 0.2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(5)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "midazolam-ped-sl", nome: "Midazolam — sublingual", grupo: "inducao", populacoes: PED, via: "Sublingual",
    dose: { usual: 0.2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(5)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },

  /* ---------------- Opioides pediátricos ---------------- */
  {
    id: "fentanil-ped", nome: "Fentanil", grupo: "opioides", populacoes: PED, via: "IV",
    dose: { min: 1, max: 3, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(50)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "morfina-ped", nome: "Morfina", grupo: "opioides", populacoes: PED, via: "IV",
    dose: { min: 0.05, max: 0.2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10), mgml(1)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    observacao: "Dose adicional titulada descrita: 0,02 mg/kg.",
    alerta: "Não partir da dose máxima em neonato, criança pequena, apneia do sono, paciente crítico ou associação com outros depressores.",
  },
  {
    id: "sufentanil-ped", nome: "Sufentanil — indução", grupo: "opioides", populacoes: PED, via: "IV",
    dose: { min: 0.3, max: 1, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(5)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "alfentanil-ped", nome: "Alfentanil — intubação", grupo: "opioides", populacoes: PED, via: "IV",
    dose: { usual: 10, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(500)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "remifentanil-ped", nome: "Remifentanil — bomba", grupo: "bic", populacoes: PED, via: "IV, infusão contínua",
    dose: { min: 0.1, max: 0.5, unidade: "mcg", por: "kg/min" },
    apresentacoes: [mcgml(50, "2 mg em 40 mL (50 mcg/mL)"), mcgml(20, "1 mg em 50 mL (20 mcg/mL)")],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    observacao: "A diluição é configurável: toque na apresentação para trocar.",
  },

  /* ---------------- Bloqueadores: lactente vs criança ---------------- */
  {
    id: "succinilcolina-lact", nome: "Succinilcolina", grupo: "bloqueadores",
    populacoes: ["neonato", "lactente"], via: "IV",
    dose: { usual: 3, unidade: "mg", por: "kg" }, apresentacoes: [mgml(50)],
    fonte: SAESP("capítulo pediátrico"), contextoFonte: "Lactentes até 1 ano",
    situacao: "validado", revisao: REVISAO,
  },
  {
    id: "succinilcolina-crianca", nome: "Succinilcolina", grupo: "bloqueadores",
    populacoes: ["crianca"], via: "IV",
    dose: { min: 1.5, max: 2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(50)],
    fonte: SAESP("capítulo pediátrico"), contextoFonte: "Crianças acima de 1 ano",
    situacao: "validado", revisao: REVISAO,
  },
  {
    id: "atracurio-ped", nome: "Atracúrio", grupo: "bloqueadores", populacoes: PED, via: "IV",
    dose: { usual: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "cisatracurio-lact", nome: "Cisatracúrio", grupo: "bloqueadores",
    populacoes: ["neonato", "lactente"], via: "IV",
    dose: { usual: 0.1, unidade: "mg", por: "kg" }, apresentacoes: [mgml(2)],
    fonte: SAESP("capítulo pediátrico"), contextoFonte: "Lactentes até 1 ano",
    situacao: "validado", revisao: REVISAO,
  },
  {
    id: "cisatracurio-crianca", nome: "Cisatracúrio", grupo: "bloqueadores",
    populacoes: ["crianca"], via: "IV",
    dose: { min: 0.1, max: 0.2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(2)],
    fonte: SAESP("capítulo pediátrico"), contextoFonte: "Crianças acima de 1 ano",
    situacao: "validado", revisao: REVISAO,
  },
  {
    id: "pancuronio-ped", nome: "Pancurônio", grupo: "bloqueadores", populacoes: PED, via: "IV",
    dose: { usual: 0.1, unidade: "mg", por: "kg" }, apresentacoes: [mgml(2)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "rocuronio-lact", nome: "Rocurônio — intubação", grupo: "bloqueadores",
    populacoes: ["neonato", "lactente"], via: "IV",
    dose: { min: 0.25, max: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("capítulo pediátrico"), contextoFonte: "Lactentes até 1 ano",
    situacao: "validado", revisao: REVISAO,
  },
  {
    id: "rocuronio-crianca", nome: "Rocurônio — intubação", grupo: "bloqueadores",
    populacoes: ["crianca"], via: "IV",
    dose: { min: 0.6, max: 1.2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("capítulo pediátrico"), contextoFonte: "Crianças acima de 1 ano",
    situacao: "validado", revisao: REVISAO,
  },
  {
    id: "rocuronio-rsi-ped", nome: "Rocurônio — sequência rápida", grupo: "bloqueadores",
    populacoes: ["crianca"], via: "IV", indicacao: "Sequência rápida",
    dose: { usual: 1.2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "rocuronio-rsi-adulto", nome: "Rocurônio — sequência rápida", grupo: "bloqueadores",
    populacoes: ["adulto"], via: "IV", indicacao: "Sequência rápida",
    dose: { min: 1.0, max: 1.2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
    pesoBase: "ideal",
  },

  /* ---------------- Reversão ---------------- */
  {
    id: "sugamadex-moderado", nome: "Sugamadex — bloqueio moderado", grupo: "reversao",
    populacoes: PED, via: "IV",
    dose: { usual: 2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(100)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    alerta: "Determinar a dose conforme a profundidade do bloqueio e a monitorização neuromuscular — não por idade e peso apenas.",
  },
  {
    id: "sugamadex-imediata", nome: "Sugamadex — reversão imediata", grupo: "reversao",
    populacoes: PED, via: "IV", indicacao: "Reversão imediata",
    dose: { usual: 16, unidade: "mg", por: "kg" }, apresentacoes: [mgml(100)],
    fonte: SAESP("capítulo pediátrico"),
    contextoFonte: "Reversão imediata após dose elevada de rocurônio, em situação específica",
    situacao: "validado", revisao: REVISAO,
    alerta: "Não é dose de rotina. A fonte descreve este valor para reversão imediata após dose elevada de rocurônio, em situação específica.",
  },

  /* ---------------- Anestésicos locais — dose máxima pediátrica ---------------- */
  {
    id: "lidocaina-sem-ped", nome: "Lidocaína — sem adrenalina", grupo: "locais", populacoes: PED,
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 5, unidade: "mg", por: "kg" },
    apresentacoes: [dePercentual(1)!, dePercentual(2)!, dePercentual(0.5)!],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "lidocaina-com-ped", nome: "Lidocaína — com adrenalina", grupo: "locais", populacoes: PED,
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 10, unidade: "mg", por: "kg" },
    apresentacoes: [dePercentual(1)!, dePercentual(2)!, dePercentual(0.5)!],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "bupivacaina-sem-ped", nome: "Bupivacaína — sem adrenalina", grupo: "locais", populacoes: PED,
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 2, unidade: "mg", por: "kg" },
    apresentacoes: [dePercentual(0.5)!, dePercentual(0.25)!, dePercentual(0.125)!],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "bupivacaina-com-ped", nome: "Bupivacaína — com adrenalina", grupo: "locais", populacoes: PED,
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 3, unidade: "mg", por: "kg" },
    apresentacoes: [dePercentual(0.5)!, dePercentual(0.25)!],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "ropivacaina-ped", nome: "Ropivacaína", grupo: "locais", populacoes: PED,
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 3, unidade: "mg", por: "kg" },
    apresentacoes: [dePercentual(0.2)!, dePercentual(0.375)!, dePercentual(0.75)!],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "levobupivacaina-sem-ped", nome: "Levobupivacaína — sem adrenalina", grupo: "locais", populacoes: PED,
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 3.5, unidade: "mg", por: "kg" },
    apresentacoes: [dePercentual(0.5)!, dePercentual(0.25)!],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "levobupivacaina-com-ped", nome: "Levobupivacaína — com adrenalina", grupo: "locais", populacoes: PED,
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 4.5, unidade: "mg", por: "kg" },
    apresentacoes: [dePercentual(0.5)!, dePercentual(0.25)!],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },

  /* ---------------- Adjuvantes intratecais e sedação ---------------- */
  {
    id: "morfina-it-ped", nome: "Morfina intratecal", grupo: "adjuvantes", populacoes: PED, via: "Intratecal",
    dose: { min: 4, max: 10, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(200, "0,2 mg/mL (200 mcg/mL)")],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    observacao: "O capítulo também cita recomendações de 10 a 20 mcg/kg. As duas faixas são mostradas separadamente, e o AVANEST não escolhe entre elas.",
  },
  {
    id: "morfina-it-ped-alta", nome: "Morfina intratecal — faixa alternativa", grupo: "adjuvantes",
    populacoes: PED, via: "Intratecal",
    dose: { min: 10, max: 20, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(200, "0,2 mg/mL (200 mcg/mL)")],
    fonte: SAESP("capítulo pediátrico"), contextoFonte: "Recomendações também citadas no capítulo",
    situacao: "validado", revisao: REVISAO,
  },
  {
    id: "fentanil-it-ped", nome: "Fentanil intratecal", grupo: "adjuvantes", populacoes: PED, via: "Intratecal",
    dose: { min: 0.25, max: 1, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(50)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "clonidina-it-ped", nome: "Clonidina intratecal", grupo: "adjuvantes", populacoes: PED, via: "Intratecal",
    dose: { min: 1, max: 2, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(150, "150 mcg/mL")],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "clonidina-pre-ped", nome: "Clonidina — pré-medicação", grupo: "adjuvantes", populacoes: PED,
    via: "VO ou intranasal",
    dose: { min: 3, max: 8, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(150)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    observacao: "Referência frequente: 4 mcg/kg.",
  },
  {
    id: "clonidina-iv-ped", nome: "Clonidina — adjuvante IV", grupo: "adjuvantes", populacoes: PED, via: "IV",
    dose: { min: 1, max: 3, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(150)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    observacao: "Administrada em 30 a 60 minutos.",
  },
  {
    id: "clonidina-bic-ped", nome: "Clonidina — bomba", grupo: "bic", populacoes: PED, via: "IV, infusão contínua",
    dose: { min: 0.1, max: 0.5, unidade: "mcg", por: "kg/h" }, apresentacoes: [mcgml(150)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "dexmedetomidina-ataque-ped", nome: "Dexmedetomidina — ataque", grupo: "adjuvantes", populacoes: PED, via: "IV",
    dose: { min: 0.5, max: 2, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(4, "4 mcg/mL")],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    observacao: "Em aproximadamente 20 minutos.",
  },
  {
    id: "dexmedetomidina-manut-ped", nome: "Dexmedetomidina — manutenção", grupo: "bic", populacoes: PED,
    via: "IV, infusão contínua",
    dose: { min: 0.3, max: 0.7, unidade: "mcg", por: "kg/h" }, apresentacoes: [mcgml(4, "4 mcg/mL")],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "dexmedetomidina-delirium-ped", nome: "Dexmedetomidina — prevenção de agitação", grupo: "adjuvantes",
    populacoes: PED, via: "IV", indicacao: "Prevenção de agitação e delirium",
    dose: { min: 0.5, max: 1, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(4, "4 mcg/mL")],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
    observacao: "Em 10 a 20 minutos.",
  },
  {
    id: "dexmedetomidina-bucal-ped", nome: "Dexmedetomidina — bucal", grupo: "adjuvantes", populacoes: PED, via: "Bucal",
    dose: { usual: 1, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(100, "100 mcg/mL")],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "dexmedetomidina-vo-in-ped", nome: "Dexmedetomidina — oral ou intranasal", grupo: "adjuvantes",
    populacoes: PED, via: "VO ou intranasal",
    dose: { min: 2, max: 4, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(100, "100 mcg/mL")],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "cafeina-prematuro", nome: "Cafeína — ex-prematuro", grupo: "adjuvantes",
    populacoes: ["neonato", "lactente"], via: "IV", indicacao: "Prevenção de apneia pós-operatória",
    dose: { usual: 10, unidade: "mg", por: "kg" }, apresentacoes: [mgml(20)],
    fonte: SAESP("capítulo pediátrico"), situacao: "validado", revisao: REVISAO,
  },

  /* ---------------- Adulto — confirmados ---------------- */
  {
    id: "atracurio-adulto", nome: "Atracúrio", grupo: "bloqueadores", populacoes: ["adulto"], via: "IV",
    dose: { usual: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
    pesoBase: "ideal",
  },
  {
    id: "rocuronio-adulto-tecnica", nome: "Rocurônio — técnica específica", grupo: "bloqueadores",
    populacoes: ["adulto"], via: "IV",
    dose: { usual: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("técnica anestésica específica"),
    contextoFonte: "Valor descrito dentro de uma técnica específica",
    situacao: "validado", revisao: REVISAO,
    alerta: "Não substitui a dose padrão geral sem validação do protocolo do serviço.",
    pesoBase: "ideal",
  },
  {
    id: "propofol-adulto-tecnica", nome: "Propofol — técnica específica", grupo: "inducao",
    populacoes: ["adulto"], via: "IV",
    dose: { min: 1, max: 1.5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("técnica anestésica específica"),
    contextoFonte: "Valor descrito em técnica específica",
    situacao: "validado", revisao: REVISAO,
    alerta: "Não é dose universal de indução do adulto. É o valor descrito dentro de uma técnica específica.",
    pesoBase: "magro",
  },
  {
    id: "propofol-sedacao-bic", nome: "Propofol — sedação em bomba", grupo: "bic", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 25, max: 75, unidade: "mcg", por: "kg/min" }, apresentacoes: [mgml(10)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
    pesoBase: "atual",
  },
  {
    id: "fentanil-sedacao-adulto", nome: "Fentanil — sedação e titulação", grupo: "opioides",
    populacoes: ["adulto"], via: "IV",
    dose: { min: 0.5, max: 1, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(50)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
    observacao: "Pode ser repetido conforme avaliação clínica.",
    pesoBase: "magro",
  },
  {
    id: "alfentanil-adulto", nome: "Alfentanil — sedação", grupo: "opioides", populacoes: ["adulto"], via: "IV",
    dose: { min: 5, max: 10, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(500)],
    fonte: SAESP("conteúdo adulto"), contextoFonte: "No contexto de sedação descrito",
    situacao: "validado", revisao: REVISAO,
    pesoBase: "magro",
  },
  {
    id: "cetamina-analgesia-bolus", nome: "Cetamina — analgesia multimodal", grupo: "analgesia",
    populacoes: ["adulto"], via: "IV", indicacao: "Analgesia multimodal",
    dose: { min: 0.1, max: 0.2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(50), mgml(10)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
    pesoBase: "ideal",
  },
  {
    id: "cetamina-analgesia-bic", nome: "Cetamina — analgesia em bomba", grupo: "bic", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { usual: 0.1, unidade: "mg", por: "kg/h" }, apresentacoes: [mgml(50), mgml(10)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
    pesoBase: "ideal",
  },
  {
    id: "lidocaina-iv-adulto", nome: "Lidocaína IV — poupadora de opioide", grupo: "analgesia",
    populacoes: ["adulto"], via: "IV", indicacao: "Estratégia poupadora de opioide",
    dose: { min: 1, max: 2, unidade: "mg", por: "kg" }, apresentacoes: [dePercentual(2)!, dePercentual(1)!],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
    pesoBase: "ideal",
  },
  {
    id: "clonidina-adulto", nome: "Clonidina", grupo: "adjuvantes", populacoes: ["adulto"], via: "IV",
    dose: { min: 1, max: 5, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(150)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "dexmedetomidina-adulto", nome: "Dexmedetomidina — manutenção", grupo: "bic", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 0.3, max: 0.9, unidade: "mcg", por: "kg/h" }, apresentacoes: [mcgml(4, "4 mcg/mL")],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
    pesoBase: "ajustado",
  },
  {
    id: "dipirona-paracetamol-adulto", nome: "Dipirona ou paracetamol", grupo: "analgesia",
    populacoes: ["adulto"], via: "IV", indicacao: "Analgesia pós-operatória",
    dose: { min: 20, max: 30, unidade: "mg", por: "kg" }, apresentacoes: [mgml(500), mgml(10, "10 mg/mL (paracetamol)")],
    fonte: SAESP("conteúdo adulto"), contextoFonte: "No contexto de analgesia pós-operatória",
    situacao: "validado", revisao: REVISAO,
  },

  /* ---------------- Adulto — indução ---------------- */
  {
    id: "propofol-adulto", nome: "Propofol — indução", grupo: "inducao", populacoes: ["adulto"], via: "IV",
    indicacao: "Adulto hígido",
    dose: { min: 2, max: 2.5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    pesoBase: "magro",
  },
  {
    id: "propofol-adulto-reduzido", nome: "Propofol — indução com dose reduzida", grupo: "inducao",
    populacoes: ["adulto"], via: "IV", indicacao: "Idoso, debilitado ou ASA III–IV",
    dose: { min: 1, max: 1.5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    alerta: "Faixa reduzida por condição do paciente, não por peso. Titular contra a resposta clínica.",
    pesoBase: "magro",
  },
  {
    id: "etomidato-adulto", nome: "Etomidato", grupo: "inducao", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.2, usual: 0.3, max: 0.6, unidade: "mg", por: "kg" }, apresentacoes: [mgml(2)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    observacao: "Dose habitual de 0,3 mg/kg dentro da faixa de 0,2 a 0,6 mg/kg.",
    pesoBase: "magro",
  },
  {
    id: "cetamina-adulto-inducao", nome: "Cetamina — indução", grupo: "inducao", populacoes: ["adulto"], via: "IV",
    dose: { min: 1, max: 2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(50), mgml(10)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    observacao: "Dose de indução. As doses de analgesia multimodal são muito menores e estão em cartão próprio.",
    pesoBase: "ideal",
  },

  /* ---------------- Adulto — opioides ---------------- */
  {
    id: "fentanil-adulto", nome: "Fentanil — indução", grupo: "opioides", populacoes: ["adulto"], via: "IV",
    dose: { min: 2, max: 5, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(50)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    pesoBase: "magro",
  },
  {
    id: "sufentanil-adulto", nome: "Sufentanil — indução", grupo: "opioides", populacoes: ["adulto"], via: "IV",
    dose: { min: 1, max: 2, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(5)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO, titulavel: true,
    alerta: "Dose total do procedimento, não um bolus único. Fracionar e titular contra a resposta.",
    pesoBase: "magro",
  },

  /* ---------------- Adulto — bloqueadores ---------------- */
  {
    id: "succinilcolina-adulto", nome: "Succinilcolina", grupo: "bloqueadores", populacoes: ["adulto"], via: "IV",
    indicacao: "Dose habitual",
    dose: { min: 0.3, usual: 0.6, max: 1.1, unidade: "mg", por: "kg" }, apresentacoes: [mgml(50)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    observacao: "Dose habitual de 0,6 mg/kg dentro da faixa de 0,3 a 1,1 mg/kg. A dose de sequência rápida é outra e está em cartão próprio.",
    pesoBase: "atual",
  },
  {
    id: "succinilcolina-adulto-rsi", nome: "Succinilcolina — sequência rápida", grupo: "bloqueadores",
    populacoes: ["adulto"], via: "IV", indicacao: "Sequência rápida",
    dose: { min: 1, max: 1.5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(50)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    pesoBase: "atual",
  },
  {
    id: "cisatracurio-adulto", nome: "Cisatracúrio", grupo: "bloqueadores", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.15, max: 0.2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(2)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    pesoBase: "ideal",
  },
  {
    id: "vecuronio-adulto", nome: "Vecurônio", grupo: "bloqueadores", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.08, max: 0.1, unidade: "mg", por: "kg" },
    apresentacoes: [mgml(2, "4 mg em 2 mL (2 mg/mL)"), mgml(1, "10 mg em 10 mL (1 mg/mL)")],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    observacao: "Pó liofilizado: a concentração depende do volume de reconstituição. Toque na apresentação para trocar.",
    pesoBase: "ideal",
  },
  {
    id: "pancuronio-adulto", nome: "Pancurônio", grupo: "bloqueadores", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.06, max: 0.1, unidade: "mg", por: "kg" }, apresentacoes: [mgml(2)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    pesoBase: "ideal",
  },

  /* ---------------- Adulto — reversão ---------------- */
  {
    id: "neostigmina-adulto", nome: "Neostigmina", grupo: "reversao", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.03, max: 0.07, unidade: "mg", por: "kg" },
    tetoAbsoluto: { valor: 5, unidade: "mg" }, apresentacoes: [mgml(0.5)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO, regra: "neostigmina",
    alerta: "A reversão se guia por monitorização neuromuscular. Peso e idade não escolhem a dose sozinhos — informe a profundidade do bloqueio.",
    observacao: "Máximo absoluto de 5 mg, independente do peso. A atropina de reversão é calculada junto, dentro deste cartão.",
    pesoBase: "atual",
  },
  {
    id: "atropina-reversao-adulto", nome: "Atropina — associada à neostigmina", grupo: "reversao",
    populacoes: ["adulto"], via: "IV", indicacao: "Associada à reversão",
    dose: { usual: 0.015, unidade: "mg", por: "kg" }, apresentacoes: [mgml(0.25)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO, oculto: true,
    observacao: "Calculada junto à neostigmina. Não é um reversor independente.",
    pesoBase: "atual",
  },

  /* ---------------- Adulto — antieméticos e profilaxia ---------------- */
  {
    id: "ondansetrona-adulto", nome: "Ondansetrona", grupo: "antiemeticos", populacoes: ["adulto"], via: "IV",
    dose: { usual: 4, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(2)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    observacao: "Dose fixa. Não se multiplica pelo peso.",
  },
  {
    id: "dexametasona-adulto", nome: "Dexametasona", grupo: "antiemeticos", populacoes: ["adulto"], via: "IV",
    dose: { min: 4, max: 8, unidade: "mg", por: "fixa" },
    apresentacoes: [mgml(4), mgml(2)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    observacao: "Dose fixa. Não se multiplica pelo peso.",
  },

  /* ---------------- Adulto — analgesia ---------------- */
  {
    id: "cetorolaco-adulto", nome: "Cetorolaco", grupo: "analgesia", populacoes: ["adulto"], via: "IV",
    dose: { usual: 30, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(30)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO, regra: "cetorolaco",
    alerta: "Confira função renal, sangramento, úlcera péptica e alergia a AINE antes de indicar. A dose cai para 15 mg em idoso, em baixo peso ou com comprometimento renal.",
  },
  {
    id: "tramadol-adulto", nome: "Tramadol", grupo: "analgesia", populacoes: ["adulto"], via: "IV",
    dose: { min: 50, max: 100, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(50)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO, titulavel: true,
    observacao: "Dose fixa, titulável dentro da faixa. Não se multiplica pelo peso.",
  },
  {
    id: "nalbufina-adulto", nome: "Nalbufina", grupo: "analgesia", populacoes: ["adulto"], via: "IV",
    dose: { usual: 10, max: 20, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(10)],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO, titulavel: true,
    observacao: "Dose fixa de 10 mg, máxima habitual de 20 mg. Titulável, não se multiplica pelo peso.",
  },

  /* ---------------- Adulto — antibiótico ---------------- */
  {
    id: "cefazolina-adulto", nome: "Cefazolina — profilaxia", grupo: "antibioticos", populacoes: ["adulto"], via: "IV",
    dose: { usual: 2, unidade: "g", por: "fixa" },
    apresentacoes: [{ rotulo: "1 g reconstituído em 10 mL", quantidade: 1, unidade: "g", mL: 10 }],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO, regra: "cefazolina",
    observacao: "Dose fixa de 2 g; 3 g acima de 120 kg. Não se multiplica pelo peso.",
  },

  /* ---------------- Adulto — corticoide de estresse ---------------- */
  {
    id: "hidrocortisona-inducao", nome: "Hidrocortisona — indução", grupo: "adjuvantes", populacoes: ["adulto"],
    via: "IV", indicacao: "Cobertura de estresse / corticoterapia crônica",
    dose: { usual: 100, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(50, "100 mg em 2 mL (50 mg/mL)")],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    alerta: "Não é profilaxia de rotina. Só entra em cobertura de estresse ou corticoterapia crônica.",
  },
  {
    id: "hidrocortisona-manutencao", nome: "Hidrocortisona — manutenção 24 h", grupo: "adjuvantes",
    populacoes: ["adulto"], via: "IV, infusão contínua",
    indicacao: "Cobertura de estresse / corticoterapia crônica",
    dose: { usual: 200, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(50, "100 mg em 2 mL (50 mg/mL)")],
    fonte: SERVICO, situacao: "validado", revisao: REVISAO,
    observacao: "200 mg em 24 h por bomba. Alternativa descrita: 50 mg IV a cada 6 horas.",
    alerta: "Não é profilaxia de rotina. Só entra em cobertura de estresse ou corticoterapia crônica.",
  },
  /* ================================================================ *
   * Adulto — a lista do serviço (14/10/2026)
   * ================================================================ */

  /* ---------------- Indução e sedação ---------------- */
  {
    id: "midazolam-adulto-inducao", nome: "Midazolam — indução", grupo: "inducao", populacoes: ["adulto"], via: "IV",
    indicacao: "Indução",
    dose: { min: 0.1, max: 0.3, unidade: "mg", por: "kg" }, apresentacoes: [mgml(5), mgml(1, "1 mg/mL (5 mg em 5 mL)")],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal",
    alerta: "Dose de indução. Para sedação a dose é cinco vezes menor, em cartão próprio.",
  },
  {
    id: "midazolam-adulto-sedacao", nome: "Midazolam — sedação", grupo: "adjuvantes", populacoes: ["adulto"], via: "IV",
    indicacao: "Sedação",
    dose: { min: 0.02, max: 0.05, unidade: "mg", por: "kg" }, apresentacoes: [mgml(1, "1 mg/mL (5 mg em 5 mL)"), mgml(5)],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal", titulavel: true,
    observacao: "Titular de 0,5 a 1 mg. Idoso, apneia do sono e associação com opioide pedem menos.",
  },
  {
    id: "dexmedetomidina-ataque-adulto", nome: "Dexmedetomidina — ataque", grupo: "adjuvantes", populacoes: ["adulto"],
    via: "IV", indicacao: "Dose de ataque",
    dose: { min: 0.5, max: 1, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(4, "4 mcg/mL (200 mcg em 50 mL)")],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ajustado",
    observacao: "Infundir em 10 minutos — em bolus dá hipertensão e bradicardia. Pode ser omitido; a manutenção está no cartão da bomba.",
  },

  /* ---------------- Opioides e analgesia ---------------- */
  {
    id: "remifentanil-adulto-bolus", nome: "Remifentanil — bolus", grupo: "opioides", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.5, max: 1, unidade: "mcg", por: "kg" },
    apresentacoes: [mcgml(50, "2 mg em 40 mL — 50 mcg/mL"), mcgml(20, "1 mg em 50 mL — 20 mcg/mL")],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "magro",
    observacao: "Em 30 a 60 segundos. Rápido demais dá rigidez torácica e bradicardia.",
  },
  {
    id: "remifentanil-adulto-bic", nome: "Remifentanil — bomba", grupo: "bic", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 0.05, max: 0.5, unidade: "mcg", por: "kg/min" },
    apresentacoes: [mcgml(50, "2 mg em 40 mL — 50 mcg/mL"), mcgml(20, "1 mg em 50 mL — 20 mcg/mL")],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "magro",
    observacao: "Manutenção de 0,05 a 0,5 mcg/kg/min. Até 1 mcg/kg/min só em estímulo intenso e por pouco tempo — 0,5 a 1 mcg/kg é dose de bolus, não de bomba.",
  },
  {
    id: "morfina-adulto", nome: "Morfina", grupo: "opioides", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.05, max: 0.1, unidade: "mg", por: "kg" },
    apresentacoes: [mgml(1, "1 mg/mL (10 mg em 10 mL)"), mgml(10)],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal", titulavel: true,
    observacao: "Titular de 2 a 3 mg. Idoso, insuficiência renal e apneia do sono pedem menos.",
  },
  {
    id: "metadona-adulto", nome: "Metadona", grupo: "opioides", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.1, max: 0.2, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 20, unidade: "mg" },
    apresentacoes: [mgml(10)],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal",
    observacao: "Dose única intraoperatória, até 20 mg. Meia-vida longa: não repetir sem reavaliar.",
  },
  {
    id: "dipirona-adulto", nome: "Dipirona", grupo: "analgesia", populacoes: ["adulto"], via: "IV",
    dose: { min: 1, max: 2, unidade: "g", por: "fixa" },
    apresentacoes: [{ rotulo: "500 mg/mL (1 g em 2 mL)", quantidade: 500, unidade: "mg", mL: 1 }],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Dose fixa no adulto, até 2 g por dose. A conta por quilo passava disso no obeso.",
  },
  {
    id: "paracetamol-adulto", nome: "Paracetamol", grupo: "analgesia", populacoes: ["adulto"], via: "IV",
    dose: { usual: 15, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "g" },
    apresentacoes: [mgml(10)],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "A partir de 50 kg, 1 g por dose; no máximo 4 g por dia.",
  },

  /* ---------------- Bloqueadores ---------------- */
  {
    id: "rocuronio-adulto-intubacao", nome: "Rocurônio — intubação", grupo: "bloqueadores", populacoes: ["adulto"],
    via: "IV", indicacao: "Intubação",
    dose: { usual: 0.6, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal",
    observacao: "A dose de sequência rápida (1 a 1,2 mg/kg) está em cartão próprio.",
  },

  /* ---------------- Reversão e antagonistas ---------------- */
  {
    id: "sugamadex-adulto-moderado", nome: "Sugamadex — bloqueio moderado", grupo: "reversao", populacoes: ["adulto"],
    via: "IV", indicacao: "TOF com 2 respostas ou mais",
    dose: { usual: 2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(100)],
    fonte: BULA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "atual",
    alerta: "A dose sai da profundidade do bloqueio, medida com monitorização neuromuscular.",
  },
  {
    id: "sugamadex-adulto-profundo", nome: "Sugamadex — bloqueio profundo", grupo: "reversao", populacoes: ["adulto"],
    via: "IV", indicacao: "PTC com 1 a 2 respostas",
    dose: { usual: 4, unidade: "mg", por: "kg" }, apresentacoes: [mgml(100)],
    fonte: BULA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "atual",
    alerta: "A dose sai da profundidade do bloqueio, medida com monitorização neuromuscular.",
  },
  {
    id: "sugamadex-adulto-imediata", nome: "Sugamadex — reversão imediata", grupo: "reversao", populacoes: ["adulto"],
    via: "IV", indicacao: "Reversão imediata",
    dose: { usual: 16, unidade: "mg", por: "kg" }, apresentacoes: [mgml(100)],
    fonte: BULA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "atual",
    alerta: "Não é dose de rotina: reversão imediata após 1,2 mg/kg de rocurônio (não intubo, não ventilo).",
  },
  {
    id: "atropina-bradicardia-adulto", nome: "Atropina — bradicardia", grupo: "reversao", populacoes: ["adulto"],
    via: "IV", indicacao: "Bradicardia",
    dose: { min: 0.5, max: 1, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(0.25), mgml(0.5)],
    fonte: AHA, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Repetir a cada 3 a 5 minutos, até 3 mg. Com neostigmina a dose é outra, calculada junto dela.",
  },
  {
    id: "flumazenil-adulto", nome: "Flumazenil", grupo: "reversao", populacoes: ["adulto"], via: "IV",
    dose: { usual: 0.2, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(0.1)],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, titulavel: true,
    observacao: "Repetir 0,1 a 0,2 mg a cada minuto, até 1 mg. Dura menos que o benzodiazepínico: observar a ressedação.",
  },
  {
    id: "naloxona-adulto", nome: "Naloxona", grupo: "reversao", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.04, usual: 0.1, max: 0.2, unidade: "mg", por: "fixa" },
    apresentacoes: [mgml(0.04, "0,04 mg/mL (0,4 mg em 10 mL)"), mgml(0.4)],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, titulavel: true,
    observacao: "No pós-operatório, titular 0,04 mg a cada 2 minutos: reverter tudo de uma vez traz dor, hipertensão e edema pulmonar.",
  },

  /* ---------------- Anestésicos locais — dose máxima do adulto ---------------- */
  {
    id: "bupivacaina-sem-adulto", nome: "Bupivacaína — sem adrenalina", grupo: "locais", populacoes: ["adulto"],
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 2, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 175, unidade: "mg" },
    apresentacoes: [dePercentual(0.25)!, dePercentual(0.5)!, dePercentual(0.75)!],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal",
    observacao: "É o máximo, não a dose a fazer. Até 175 mg.",
  },
  {
    id: "bupivacaina-com-adulto", nome: "Bupivacaína — com adrenalina", grupo: "locais", populacoes: ["adulto"],
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 3, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 225, unidade: "mg" },
    apresentacoes: [dePercentual(0.25)!, dePercentual(0.5)!],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal",
    observacao: "É o máximo, não a dose a fazer. Até 225 mg.",
  },
  {
    id: "levobupivacaina-adulto", nome: "Levobupivacaína", grupo: "locais", populacoes: ["adulto"],
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 3, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 150, unidade: "mg" },
    apresentacoes: [dePercentual(0.25)!, dePercentual(0.5)!, dePercentual(0.75)!],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal",
    observacao: "É o máximo, não a dose a fazer. Até 150 mg em dose única.",
  },
  {
    id: "lidocaina-sem-adulto", nome: "Lidocaína — sem adrenalina", grupo: "locais", populacoes: ["adulto"],
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 5, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 300, unidade: "mg" },
    apresentacoes: [dePercentual(1)!, dePercentual(2)!],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal",
    observacao: "É o máximo, não a dose a fazer. Até 300 mg.",
  },
  {
    id: "lidocaina-com-adulto", nome: "Lidocaína — com adrenalina", grupo: "locais", populacoes: ["adulto"],
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 7, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 500, unidade: "mg" },
    apresentacoes: [dePercentual(1)!, dePercentual(2)!],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal",
    observacao: "É o máximo, não a dose a fazer. Até 500 mg.",
  },
  {
    id: "ropivacaina-adulto", nome: "Ropivacaína", grupo: "locais", populacoes: ["adulto"],
    via: "Infiltração e bloqueios", indicacao: "Dose máxima",
    dose: { max: 3, unidade: "mg", por: "kg" },
    apresentacoes: [dePercentual(0.2)!, dePercentual(0.5)!, dePercentual(0.75)!, dePercentual(1)!],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ideal",
    observacao: "É o máximo, não a dose a fazer. Com peso alto, confira o teto absoluto do protocolo do serviço.",
  },

  /* ---------------- Cardiovascular — bolus ---------------- */
  {
    id: "efedrina-adulto", nome: "Efedrina", grupo: "cardiovascular", populacoes: ["adulto"], via: "IV",
    dose: { min: 5, max: 10, unidade: "mg", por: "fixa" },
    apresentacoes: [mgml(5, "50 mg (1 ampola) em 10 mL — 5 mg/mL"), mgml(50)],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, titulavel: true,
    observacao: "Repetir conforme a pressão. Perde efeito com doses repetidas (taquifilaxia).",
  },
  {
    id: "fenilefrina-bolus-adulto", nome: "Fenilefrina — bolus", grupo: "cardiovascular", populacoes: ["adulto"], via: "IV",
    dose: { min: 50, max: 100, unidade: "mcg", por: "fixa" },
    apresentacoes: [mcgml(100, "10 mg (1 ampola) em 100 mL — 100 mcg/mL")],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, titulavel: true,
    observacao: "Pode baixar a frequência cardíaca (reflexo).",
  },
  {
    id: "metaraminol-adulto", nome: "Metaraminol", grupo: "cardiovascular", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.5, max: 1, unidade: "mg", por: "fixa" },
    apresentacoes: [mgml(0.5, "10 mg (1 ampola) em 20 mL — 0,5 mg/mL")],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, titulavel: true,
  },
  {
    id: "adrenalina-bolus-adulto", nome: "Adrenalina — bolus", grupo: "cardiovascular", populacoes: ["adulto"], via: "IV",
    indicacao: "Hipotensão grave, anafilaxia",
    dose: { min: 10, max: 100, unidade: "mcg", por: "fixa" },
    apresentacoes: [mcgml(10, "1 mg (1 ampola) em 100 mL — 10 mcg/mL")],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, titulavel: true,
    alerta: "Na PCR a dose é 1 mg, no cartão de Arritmias e PCR.",
  },
  {
    id: "vasopressina-bolus-adulto", nome: "Vasopressina — bolus", grupo: "cardiovascular", populacoes: ["adulto"], via: "IV",
    indicacao: "Hipotensão refratária (vasoplegia, IECA/BRA)",
    dose: { min: 0.5, max: 1, unidade: "UI", por: "fixa" },
    apresentacoes: [{ rotulo: "20 UI (1 ampola) em 20 mL — 1 UI/mL", quantidade: 1, unidade: "UI", mL: 1 }],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA, titulavel: true,
  },
  {
    id: "esmolol-ataque-adulto", nome: "Esmolol — ataque", grupo: "cardiovascular", populacoes: ["adulto"], via: "IV",
    dose: { usual: 500, unidade: "mcg", por: "kg" }, apresentacoes: [mgml(10, "10 mg/mL (100 mg em 10 mL)")],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Em 1 minuto. A manutenção está no cartão da bomba.",
  },
  {
    id: "milrinona-ataque-adulto", nome: "Milrinona — ataque", grupo: "cardiovascular", populacoes: ["adulto"], via: "IV",
    dose: { usual: 50, unidade: "mcg", por: "kg" }, apresentacoes: [mgml(1, "1 mg/mL (20 mg em 20 mL)")],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Em 10 minutos. Costuma ser omitido pela hipotensão.",
  },

  /* ---------------- Cardiovascular — bombas e diluições ---------------- */
  {
    id: "noradrenalina-bic-adulto", nome: "Noradrenalina — bomba", grupo: "cardiovascular", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 0.02, max: 0.5, unidade: "mcg", por: "kg/min" },
    apresentacoes: [
      mcgml(16, "4 mg (1 ampola) em 250 mL — 16 mcg/mL"),
      mcgml(32, "8 mg (2 ampolas) em 250 mL — 32 mcg/mL"),
      mcgml(64, "16 mg (4 ampolas) em 250 mL — 64 mcg/mL"),
    ],
    fonte: DILUICAO, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "atual",
    alerta: "A ampola brasileira traz 8 mg de hemitartarato em 4 mL — 4 mg de noradrenalina base (1 mg/mL). As diluições estão em noradrenalina base.",
    observacao: "Titular pela PAM. Acesso central quando a dose sobe ou a infusão se prolonga.",
  },
  {
    id: "adrenalina-bic-adulto", nome: "Adrenalina — bomba", grupo: "cardiovascular", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 0.01, max: 0.5, unidade: "mcg", por: "kg/min" },
    apresentacoes: [mcgml(4, "1 mg (1 ampola) em 250 mL — 4 mcg/mL"), mcgml(16, "4 mg (4 ampolas) em 250 mL — 16 mcg/mL")],
    fonte: DILUICAO, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "atual",
    observacao: "Titular pelo efeito. Ampola de 1 mg/mL.",
  },
  {
    id: "vasopressina-bic-adulto", nome: "Vasopressina — bomba", grupo: "cardiovascular", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 0.01, max: 0.04, unidade: "UI", por: "min" },
    apresentacoes: [{ rotulo: "20 UI (1 ampola) em 100 mL — 0,2 UI/mL", quantidade: 0.2, unidade: "UI", mL: 1 }],
    fonte: DILUICAO, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Dose fixa por minuto, sem peso. 0,03 UI/min é a dose usual no choque vasoplégico.",
  },
  {
    id: "dobutamina-bic-adulto", nome: "Dobutamina — bomba", grupo: "cardiovascular", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 2.5, max: 20, unidade: "mcg", por: "kg/min" },
    apresentacoes: [
      mcgml(1000, "250 mg (1 ampola) em 250 mL — 1.000 mcg/mL"),
      mcgml(2000, "500 mg (2 ampolas) em 250 mL — 2.000 mcg/mL"),
    ],
    fonte: DILUICAO, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "atual",
    observacao: "Ampola de 250 mg em 20 mL (12,5 mg/mL).",
  },
  {
    id: "milrinona-bic-adulto", nome: "Milrinona — bomba", grupo: "cardiovascular", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 0.375, max: 0.75, unidade: "mcg", por: "kg/min" },
    apresentacoes: [mcgml(200, "20 mg (1 ampola) em 100 mL — 200 mcg/mL")],
    fonte: DILUICAO, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "atual",
    observacao: "Reduzir na insuficiência renal.",
  },
  {
    id: "nitroprussiato-bic-adulto", nome: "Nitroprussiato — bomba", grupo: "cardiovascular", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 0.3, max: 2, unidade: "mcg", por: "kg/min" },
    apresentacoes: [mcgml(200, "50 mg (1 ampola) em 250 mL de SG 5% — 200 mcg/mL")],
    fonte: DILUICAO, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "atual",
    alerta: "Proteger da luz. Acima de 2 mcg/kg/min, ou por muitas horas, risco de intoxicação por cianeto; até 10 mcg/kg/min só por no máximo 10 minutos.",
  },
  {
    id: "nitroglicerina-bic-adulto", nome: "Nitroglicerina — bomba", grupo: "cardiovascular", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 5, max: 200, unidade: "mcg", por: "min" },
    apresentacoes: [
      mcgml(200, "50 mg (ampola de 5 mg/mL, 10 mL) em 250 mL — 200 mcg/mL"),
      mcgml(100, "25 mg em 250 mL — 100 mcg/mL"),
    ],
    fonte: DILUICAO, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Dose por minuto, sem peso. Começar com 5 a 10 mcg/min e subir de 5 em 5. Frasco de vidro e equipo próprio (o PVC adsorve).",
  },
  {
    id: "fenilefrina-bic-adulto", nome: "Fenilefrina — bomba", grupo: "cardiovascular", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 10, max: 100, unidade: "mcg", por: "min" },
    apresentacoes: [mcgml(40, "10 mg (1 ampola) em 250 mL — 40 mcg/mL"), mcgml(100, "10 mg (1 ampola) em 100 mL — 100 mcg/mL")],
    fonte: DILUICAO, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Dose por minuto, sem peso. Titular pela PAM.",
  },
  {
    id: "esmolol-bic-adulto", nome: "Esmolol — bomba", grupo: "cardiovascular", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 50, max: 300, unidade: "mcg", por: "kg/min" },
    apresentacoes: [mgml(10, "10 mg/mL (frasco pronto, ou 2,5 g em 250 mL)")],
    fonte: DILUICAO, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "atual",
  },

  /* ---------------- Arritmias e PCR ---------------- */
  {
    id: "adrenalina-pcr-adulto", nome: "Adrenalina — PCR", grupo: "arritmias", populacoes: ["adulto"], via: "IV",
    indicacao: "Parada cardiorrespiratória",
    dose: { usual: 1, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(1)],
    fonte: AHA, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "A cada 3 a 5 minutos, seguida de 20 mL de SF.",
  },
  {
    id: "amiodarona-pcr-adulto", nome: "Amiodarona — PCR", grupo: "arritmias", populacoes: ["adulto"], via: "IV",
    indicacao: "FV ou TV sem pulso",
    dose: { usual: 300, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(50)],
    fonte: AHA, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Em bolus. Segunda dose: 150 mg.",
  },
  {
    id: "amiodarona-pulso-adulto", nome: "Amiodarona — arritmia com pulso", grupo: "arritmias", populacoes: ["adulto"],
    via: "IV", indicacao: "FA ou TV com pulso",
    dose: { usual: 150, unidade: "mg", por: "fixa" },
    apresentacoes: [mgml(1.5, "150 mg em 100 mL de SG 5% — 1,5 mg/mL"), mgml(50)],
    fonte: AHA, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Em 10 minutos, diluída. Depois, a manutenção em bomba.",
  },
  {
    id: "amiodarona-bic-adulto", nome: "Amiodarona — manutenção", grupo: "arritmias", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 0.5, max: 1, unidade: "mg", por: "min" },
    apresentacoes: [mgml(1.8, "900 mg em 500 mL de SG 5% — 1,8 mg/mL")],
    fonte: AHA, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "1 mg/min por 6 horas, depois 0,5 mg/min por 18 horas. Só em SG 5%.",
  },
  {
    id: "adenosina-adulto", nome: "Adenosina", grupo: "arritmias", populacoes: ["adulto"], via: "IV",
    indicacao: "Taquicardia supraventricular",
    dose: { min: 6, max: 12, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(3)],
    fonte: AHA, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Bolus rápido em veia calibrosa, seguido de 20 mL de SF. 6 mg; sem reversão, 12 mg.",
  },

  /* ---------------- Anticonvulsivantes ---------------- */
  {
    id: "diazepam-crise-adulto", nome: "Diazepam — crise convulsiva", grupo: "anticonvulsivantes", populacoes: ["adulto"],
    via: "IV",
    dose: { min: 0.15, max: 0.2, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 10, unidade: "mg" },
    apresentacoes: [mgml(5)],
    fonte: AES, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Até 10 mg por dose; pode repetir uma vez. Não diluir em soro.",
  },
  {
    id: "midazolam-crise-adulto", nome: "Midazolam — crise convulsiva", grupo: "anticonvulsivantes", populacoes: ["adulto"],
    via: "IM",
    dose: { usual: 10, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(5)],
    fonte: AES, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Sem acesso venoso. 10 mg acima de 40 kg; 5 mg entre 13 e 40 kg. Lorazepam IV, da lista, não tem apresentação injetável no Brasil.",
  },
  {
    id: "fenitoina-adulto", nome: "Fenitoína — ataque", grupo: "anticonvulsivantes", populacoes: ["adulto"], via: "IV",
    dose: { min: 15, max: 20, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 1500, unidade: "mg" },
    apresentacoes: [mgml(50)],
    fonte: AES, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ajustado",
    alerta: "No máximo 50 mg/min, só em SF (precipita em SG). Monitorar ECG e pressão.",
  },
  {
    id: "fenobarbital-adulto", nome: "Fenobarbital — ataque", grupo: "anticonvulsivantes", populacoes: ["adulto"], via: "IV",
    dose: { usual: 15, unidade: "mg", por: "kg" }, apresentacoes: [mgml(100, "100 mg/mL (200 mg em 2 mL)")],
    fonte: AES, situacao: "validado", revisao: REVISAO_LISTA, pesoBase: "ajustado",
    observacao: "De 50 a 100 mg/min. Depressão respiratória e hipotensão, principalmente depois de benzodiazepínico.",
  },
  {
    id: "levetiracetam-adulto", nome: "Levetiracetam — ataque", grupo: "anticonvulsivantes", populacoes: ["adulto"], via: "IV",
    dose: { usual: 60, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 4500, unidade: "mg" },
    apresentacoes: [mgml(100, "100 mg/mL (500 mg em 5 mL)")],
    fonte: AES, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Até 4.500 mg, em 10 a 15 minutos.",
  },

  /* ---------------- Antieméticos ---------------- */
  {
    id: "bromoprida-adulto", nome: "Bromoprida", grupo: "antiemeticos", populacoes: ["adulto"], via: "IV",
    dose: { min: 10, max: 20, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(5)],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA,
  },
  {
    id: "dimenidrinato-adulto", nome: "Dimenidrinato", grupo: "antiemeticos", populacoes: ["adulto"], via: "IV",
    dose: { usual: 1, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 50, unidade: "mg" },
    apresentacoes: [mgml(3, "3 mg/mL (30 mg em 10 mL, com piridoxina)")],
    fonte: NVPO, situacao: "validado", revisao: REVISAO_LISTA,
  },
  {
    id: "droperidol-adulto", nome: "Droperidol", grupo: "antiemeticos", populacoes: ["adulto"], via: "IV",
    dose: { min: 0.625, max: 1.25, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(2.5)],
    fonte: NVPO, situacao: "validado", revisao: REVISAO_LISTA,
    observacao: "Pode prolongar o QT.",
  },
  {
    id: "metoclopramida-adulto", nome: "Metoclopramida", grupo: "antiemeticos", populacoes: ["adulto"], via: "IV",
    dose: { usual: 10, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(5)],
    fonte: LISTA, situacao: "validado", revisao: REVISAO_LISTA,
  },

  /* ---------------- Crises: hipertermia maligna e toxicidade por anestésico local ---------------- */
  {
    id: "dantroleno", nome: "Dantroleno — hipertermia maligna", grupo: "crises", populacoes: TODAS, via: "IV",
    indicacao: "Crise de hipertermia maligna",
    dose: { usual: 2.5, unidade: "mg", por: "kg" },
    apresentacoes: [{ rotulo: "Frasco de 20 mg em 60 mL de água destilada", quantidade: 20, unidade: "mg", mL: 60 }],
    fonte: MHAUS, situacao: "validado", revisao: REVISAO_INCLUIDOS, pesoBase: "atual",
    alerta: "Cada frasco: 20 mg, reconstituído só com 60 mL de água destilada sem conservante, agitando até clarear. A dose em mg dividida por 20 dá o número de frascos.",
    observacao: "Repetir 2,5 mg/kg a cada 5 minutos até controlar a crise. O total costuma ficar em até 10 mg/kg, mas pode passar. Depois, 1 mg/kg a cada 4 a 6 horas por 24 horas. Peso da balança, também no obeso.",
  },
  {
    id: "lipidica-bolus", nome: "Emulsão lipídica 20% — bolus", grupo: "crises", populacoes: TODAS, via: "IV",
    indicacao: "Toxicidade sistêmica por anestésico local",
    dose: { usual: 0.3, unidade: "g", por: "kg" }, tetoAbsoluto: { valor: 20, unidade: "g" },
    apresentacoes: [LIPIDICA_20],
    fonte: ASRA, situacao: "validado", revisao: REVISAO_INCLUIDOS, pesoBase: "ideal",
    alerta: "Parar o anestésico local, chamar ajuda, oxigenar e tratar a convulsão com benzodiazepínico. Na PCR, adrenalina em doses pequenas (até 1 mcg/kg); evitar vasopressina, bloqueador de canal de cálcio, betabloqueador e outro anestésico local.",
    observacao: "1,5 mL/kg em 2 a 3 minutos (0,3 g/kg de lipídio); acima de 70 kg, 100 mL. Se continuar instável, repetir o bolus uma ou duas vezes. Teto de cerca de 12 mL/kg nos primeiros 30 minutos.",
  },
  {
    id: "lipidica-infusao", nome: "Emulsão lipídica 20% — infusão", grupo: "crises", populacoes: TODAS,
    via: "IV, infusão contínua", indicacao: "Toxicidade sistêmica por anestésico local",
    dose: { usual: 0.05, max: 0.1, unidade: "g", por: "kg/min" },
    apresentacoes: [LIPIDICA_20],
    fonte: ASRA, situacao: "validado", revisao: REVISAO_INCLUIDOS, pesoBase: "ideal",
    observacao: "0,25 mL/kg/min (0,05 g/kg/min) logo depois do bolus; se continuar instável, dobrar para 0,5 mL/kg/min. Manter até 10 minutos depois da estabilidade. Acima de 70 kg: 200 a 250 mL em 15 a 20 minutos. Teto de cerca de 12 mL/kg nos primeiros 30 minutos.",
  },

  /* ---------------- Obstetrícia e sangramento ---------------- */
  {
    id: "tranexamico-adulto", nome: "Ácido tranexâmico", grupo: "obstetricia", populacoes: ["adulto"], via: "IV",
    indicacao: "Sangramento: trauma, hemorragia pós-parto, cirurgia de grande porte",
    dose: { usual: 1, unidade: "g", por: "fixa" },
    apresentacoes: [mgml(50, "Ampola de 250 mg em 5 mL")],
    fonte: HEMORRAGIA, situacao: "validado", revisao: REVISAO_INCLUIDOS,
    alerta: "Reduzir na insuficiência renal. Em dose alta pode causar convulsão.",
    observacao: "Em 10 minutos: rápido derruba a pressão. Trauma: começar até 3 horas e seguir com mais 1 g em 8 horas. Hemorragia pós-parto: mais 1 g se o sangramento continuar depois de 30 minutos. Na cirurgia ortopédica também se usa 10 a 20 mg/kg na indução.",
  },
  {
    id: "ocitocina-bolus-adulto", nome: "Ocitocina — bolus na cesariana", grupo: "obstetricia", populacoes: ["adulto"], via: "IV",
    indicacao: "Depois do nascimento",
    dose: { min: 1, max: 3, unidade: "UI", por: "fixa" },
    apresentacoes: [
      { rotulo: "5 UI em 10 mL — 0,5 UI/mL", quantidade: 0.5, unidade: "UI", mL: 1 },
      { rotulo: "5 UI/mL (ampola de 1 mL)", quantidade: 5, unidade: "UI", mL: 1 },
    ],
    fonte: UTEROTONICOS, situacao: "validado", revisao: REVISAO_INCLUIDOS,
    alerta: "Bolus rápido derruba a pressão e acelera o coração, com isquemia no ECG. Fazer lento, em pelo menos 30 segundos.",
    observacao: "Cesariana eletiva: 1 UI. Em trabalho de parto: 3 UI. Sem tônus em 2 minutos, mais 3 UI; depois de duas doses de resgate, outro uterotônico. Junto, a infusão.",
  },
  {
    id: "ocitocina-bic-adulto", nome: "Ocitocina — infusão", grupo: "obstetricia", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 2.5, usual: 7.5, max: 15, unidade: "UI", por: "h" },
    apresentacoes: [
      { rotulo: "20 UI em 500 mL — 0,04 UI/mL", quantidade: 0.04, unidade: "UI", mL: 1 },
      { rotulo: "10 UI em 500 mL — 0,02 UI/mL", quantidade: 0.02, unidade: "UI", mL: 1 },
    ],
    fonte: UTEROTONICOS, situacao: "validado", revisao: REVISAO_INCLUIDOS,
    observacao: "Cesariana eletiva: 2,5 a 7,5 UI/h. Em trabalho de parto: 7,5 a 15 UI/h.",
  },
  {
    id: "metilergometrina-adulto", nome: "Metilergometrina", grupo: "obstetricia", populacoes: ["adulto"], via: "IM",
    indicacao: "Atonia uterina",
    dose: { usual: 0.2, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(0.2, "Ampola de 0,2 mg em 1 mL")],
    fonte: BULA, situacao: "validado", revisao: REVISAO_INCLUIDOS,
    alerta: "Contraindicada na hipertensão, na pré-eclâmpsia e na doença coronariana. IV só em exceção, diluída e lenta (pelo menos 1 minuto): crise hipertensiva e espasmo coronariano.",
    observacao: "Pode repetir a cada 2 a 4 horas, até 5 doses (1 mg).",
  },

  /* ---------------- Analgesia: antiespasmódico e AINE ---------------- */
  {
    id: "escopolamina-adulto", nome: "Escopolamina — antiespasmódico", grupo: "analgesia", populacoes: ["adulto"], via: "IV",
    indicacao: "Cólica e espasmo de víscera (butilbrometo de escopolamina)",
    dose: { min: 20, max: 40, unidade: "mg", por: "fixa" }, apresentacoes: [mgml(20, "Ampola de 20 mg em 1 mL")],
    fonte: BULA, situacao: "validado", revisao: REVISAO_INCLUIDOS,
    alerta: "Taquicardia. Evitar no glaucoma de ângulo fechado, na taquiarritmia e na retenção urinária.",
    observacao: "IV lento ou IM. Pode repetir; até 100 mg por dia. A ampola composta traz também 2,5 g de dipirona, que entra na conta da dipirona.",
  },
  {
    id: "tenoxicam-adulto", nome: "Tenoxicam", grupo: "analgesia", populacoes: ["adulto"], via: "IV",
    dose: { min: 20, max: 40, unidade: "mg", por: "fixa" },
    apresentacoes: [
      { rotulo: "20 mg em 2 mL de diluente — 10 mg/mL", quantidade: 20, unidade: "mg", mL: 2 },
      { rotulo: "40 mg em 2 mL de diluente — 20 mg/mL", quantidade: 40, unidade: "mg", mL: 2 },
    ],
    fonte: BULA, situacao: "validado", revisao: REVISAO_INCLUIDOS,
    alerta: "Anti-inflamatório: evitar na insuficiência renal, no sangramento, na úlcera, na asma sensível a AINE e no 3º trimestre da gravidez. Não somar a outro AINE.",
    observacao: "Uma vez ao dia: 20 mg; no quadro agudo, 40 mg por dia nos 2 primeiros dias.",
  },
];

/* ------------------------------------------------------------------ *
 * Regras condicionais do adulto
 *
 * Três fármacos não têm uma dose só: ela depende de peso, idade ou função
 * renal. A conta continua no motor — o que muda é qual dose entra nele. As
 * funções abaixo escolhem, e devolvem junto o motivo da escolha, para o
 * cartão poder dizer por que aquele número apareceu.
 * ------------------------------------------------------------------ */

export const PESO_CEFAZOLINA_MAIOR = 120;

export function doseCefazolina(pesoKg?: number): { dose: DosePorKg; motivo: string } {
  if (ok(pesoKg) && pesoKg > PESO_CEFAZOLINA_MAIOR) {
    return {
      dose: { usual: 3, unidade: "g", por: "fixa" },
      motivo: `Peso acima de ${PESO_CEFAZOLINA_MAIOR} kg: 3 g.`,
    };
  }
  return { dose: { usual: 2, unidade: "g", por: "fixa" }, motivo: "Dose padrão: 2 g." };
}

export const IDADE_CETOROLACO_REDUZIDO = 65;
export const PESO_CETOROLACO_REDUZIDO = 50;

export function doseCetorolaco(a: {
  idadeAnos?: number; pesoKg?: number; comprometimentoRenal?: boolean;
}): { dose: DosePorKg; motivo: string } {
  const razoes: string[] = [];
  if (ok(a.idadeAnos) && a.idadeAnos >= IDADE_CETOROLACO_REDUZIDO) razoes.push(`idade ≥ ${IDADE_CETOROLACO_REDUZIDO} anos`);
  if (ok(a.pesoKg) && a.pesoKg < PESO_CETOROLACO_REDUZIDO) razoes.push(`peso < ${PESO_CETOROLACO_REDUZIDO} kg`);
  if (a.comprometimentoRenal) razoes.push("comprometimento renal");

  if (razoes.length > 0) {
    return {
      dose: { usual: 15, unidade: "mg", por: "fixa" },
      motivo: `Dose reduzida para 15 mg por ${razoes.join(", ")}.`,
    };
  }
  return {
    dose: { usual: 30, unidade: "mg", por: "fixa" },
    motivo: `30 mg: menos de ${IDADE_CETOROLACO_REDUZIDO} anos, ${PESO_CETOROLACO_REDUZIDO} kg ou mais e sem comprometimento renal informado.`,
  };
}

/**
 * A atropina que acompanha a neostigmina.
 *
 * Ela não aparece na lista sozinha de propósito: fora da reversão, esta dose
 * não quer dizer nada.
 */
export const ID_ATROPINA_REVERSAO = "atropina-reversao-adulto";

export const AVISO_NEOSTIGMINA =
  "A dose de reversão se escolhe pela profundidade do bloqueio, medida com monitorização neuromuscular — não pelo peso isolado. O valor abaixo é a faixa por quilo, com o teto absoluto de 5 mg já aplicado.";

/**
 * A trava é do AVANEST, não da tabela.
 *
 * A tabela dá uma faixa por quilo e um teto. Ela não diz qual ponto da faixa
 * corresponde a qual grau de recuperação, e inventar esse mapeamento seria
 * criar uma referência que não existe. O que dá para fazer com honestidade é
 * exigir que a recuperação tenha sido avaliada antes de mostrar qualquer
 * número — e dizer que essa exigência é nossa.
 */
export const NEOSTIGMINA_SEM_MONITORIZACAO =
  "Sem monitorização neuromuscular, ou com bloqueio ainda profundo, o AVANEST não calcula a dose. Esta trava é do próprio AVANEST e não um número da tabela: a escolha dentro da faixa depende da recuperação do bloqueio, e o peso sozinho não a informa.";

export const AVISO_TITULAVEL =
  "Dose titulável: o número é o total previsto, para ser fracionado e ajustado contra a resposta — não um bolus único.";


/* ------------------------------------------------------------------ *
 * Raquianestesia pediátrica
 * ------------------------------------------------------------------ */

export const FAIXA_GERAL_BUPIVACAINA_IT: DosePorKg = { min: 0.3, max: 1, unidade: "mg", por: "kg" };

/** Referência prática por peso, do próprio capítulo. */
export const BUPIVACAINA_IT_POR_PESO: Array<{ pesoMin: number; pesoMax: number; mgPorKg: number }> = [
  { pesoMin: 3, pesoMax: 5, mgPorKg: 0.5 },
  { pesoMin: 6, pesoMax: 15, mgPorKg: 0.4 },
  { pesoMin: 16, pesoMax: 40, mgPorKg: 0.3 },
];

export function bupivacainaIntratecal(pesoKg?: number) {
  if (!ok(pesoKg)) return undefined;
  return BUPIVACAINA_IT_POR_PESO.find((f) => pesoKg >= f.pesoMin && pesoKg <= f.pesoMax);
}

export const APRESENTACAO_BUPIVACAINA_PESADA = dePercentual(0.5, "Bupivacaína pesada 0,5%")!;

export const RAQUI_REMOVIDA =
  "A regra antiga de “0 a 1 ano, bupivacaína 3 mg/kg” foi removida da base e não deve ser usada.";

/* ------------------------------------------------------------------ *
 * Consultas
 * ------------------------------------------------------------------ */

export const acharMedicamento = (id: string) => CATALOGO.find((m) => m.id === id);

export function disponiveis(populacao: Populacao): Medicamento[] {
  const ordem = GRUPOS.map((g) => g.id);
  return CATALOGO
    .filter((m) => m.populacoes.includes(populacao) && !m.oculto)
    .sort((a, b) => ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function buscar(termo: string, lista: Medicamento[]): Medicamento[] {
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return lista;
  return lista.filter((m) => `${m.nome} ${m.via} ${m.indicacao ?? ""}`.toLowerCase().includes(alvo));
}

/* ------------------------------------------------------------------ *
 * Avisos
 * ------------------------------------------------------------------ */

export const AVISO_MODULO =
  "Apoio ao cálculo, não prescrição. Confira apresentação, via e dose contra a ampola e o protocolo do serviço antes de administrar. Dupla checagem continua obrigatória.";

export const AVISO_AVULSO =
  "No cálculo avulso, a dose por quilo e a apresentação são suas. O AVANEST faz a regra de três e confere as unidades — não valida a dose.";

export const AVISO_VIA =
  "A via faz parte da dose. Cada via é um cartão separado, e os números de uma não valem para a outra.";
