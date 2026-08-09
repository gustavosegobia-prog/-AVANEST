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

export type Fonte = { obra: string; local: string };
export const citar = (f: Fonte) => `${f.obra} — ${f.local}`;

export const virgula = (v: number) => String(v).replace(".", ",");
const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
const ok = (v?: number): v is number => typeof v === "number" && Number.isFinite(v);

const SAESP = (contexto: string): Fonte => ({ obra: "SAESP, Tratado de Anestesiologia", local: contexto });

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

/** Como a dose é expressa: bolo, por hora, ou por minuto (bomba). */
export type Por = "kg" | "kg/h" | "kg/min";

export const ESCREVER_POR: Record<Por, string> = { kg: "/kg", "kg/h": "/kg/h", "kg/min": "/kg/min" };

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

  const bruta = dosePorKg * pesoKg;
  let doseTotal = bruta;
  let limitada = false;

  if (teto) {
    const tetoNaUnidade = converter(teto.valor, teto.unidade, dose.unidade);
    if (tetoNaUnidade !== undefined && bruta > tetoNaUnidade) {
      doseTotal = tetoNaUnidade;
      limitada = true;
    }
  }

  const porHora = dose.por === "kg/min" ? doseTotal * 60 : dose.por === "kg/h" ? doseTotal : undefined;

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
  | "antiemeticos" | "antibioticos" | "locais" | "bic" | "raqui" | "adjuvantes";

export const GRUPOS: Array<{ id: GrupoId; nome: string; icone: string }> = [
  { id: "inducao", nome: "Indução e hipnóticos", icone: "💉" },
  { id: "opioides", nome: "Opioides", icone: "🌙" },
  { id: "bloqueadores", nome: "Bloqueadores neuromusculares", icone: "💪" },
  { id: "reversao", nome: "Reversão", icone: "🔄" },
  { id: "bic", nome: "Infusão contínua", icone: "⏱️" },
  { id: "analgesia", nome: "Analgesia", icone: "💊" },
  { id: "adjuvantes", nome: "Adjuvantes e sedação", icone: "🌿" },
  { id: "locais", nome: "Anestésicos locais", icone: "🎯" },
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
  situacao: SituacaoDose;
  revisao?: string;
};

const REVISAO = "09/08/2026";
const mgml = (q: number, rotulo?: string): Apresentacao =>
  ({ rotulo: rotulo ?? `${virgula(q)} mg/mL`, quantidade: q, unidade: "mg", mL: 1 });
const mcgml = (q: number, rotulo?: string): Apresentacao =>
  ({ rotulo: rotulo ?? `${virgula(q)} mcg/mL`, quantidade: q, unidade: "mcg", mL: 1 });

const PED: Populacao[] = ["neonato", "lactente", "crianca"];

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
  },
  {
    id: "rocuronio-adulto-tecnica", nome: "Rocurônio — técnica específica", grupo: "bloqueadores",
    populacoes: ["adulto"], via: "IV",
    dose: { usual: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("técnica anestésica específica"),
    contextoFonte: "Valor descrito dentro de uma técnica específica",
    situacao: "validado", revisao: REVISAO,
    alerta: "Não substitui a dose padrão geral sem validação do protocolo do serviço.",
  },
  {
    id: "propofol-adulto-tecnica", nome: "Propofol — técnica específica", grupo: "inducao",
    populacoes: ["adulto"], via: "IV",
    dose: { min: 1, max: 1.5, unidade: "mg", por: "kg" }, apresentacoes: [mgml(10)],
    fonte: SAESP("técnica anestésica específica"),
    contextoFonte: "Valor descrito em técnica específica",
    situacao: "validado", revisao: REVISAO,
    alerta: "Não é dose universal de indução do adulto. É o valor descrito dentro de uma técnica específica.",
  },
  {
    id: "propofol-sedacao-bic", nome: "Propofol — sedação em bomba", grupo: "bic", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { min: 25, max: 75, unidade: "mcg", por: "kg/min" }, apresentacoes: [mgml(10)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "fentanil-sedacao-adulto", nome: "Fentanil — sedação e titulação", grupo: "opioides",
    populacoes: ["adulto"], via: "IV",
    dose: { min: 0.5, max: 1, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(50)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
    observacao: "Pode ser repetido conforme avaliação clínica.",
  },
  {
    id: "alfentanil-adulto", nome: "Alfentanil — sedação", grupo: "opioides", populacoes: ["adulto"], via: "IV",
    dose: { min: 5, max: 10, unidade: "mcg", por: "kg" }, apresentacoes: [mcgml(500)],
    fonte: SAESP("conteúdo adulto"), contextoFonte: "No contexto de sedação descrito",
    situacao: "validado", revisao: REVISAO,
  },
  {
    id: "cetamina-analgesia-bolus", nome: "Cetamina — analgesia multimodal", grupo: "analgesia",
    populacoes: ["adulto"], via: "IV", indicacao: "Analgesia multimodal",
    dose: { min: 0.1, max: 0.2, unidade: "mg", por: "kg" }, apresentacoes: [mgml(50), mgml(10)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "cetamina-analgesia-bic", nome: "Cetamina — analgesia em bomba", grupo: "bic", populacoes: ["adulto"],
    via: "IV, infusão contínua",
    dose: { usual: 0.1, unidade: "mg", por: "kg/h" }, apresentacoes: [mgml(50), mgml(10)],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
  },
  {
    id: "lidocaina-iv-adulto", nome: "Lidocaína IV — poupadora de opioide", grupo: "analgesia",
    populacoes: ["adulto"], via: "IV", indicacao: "Estratégia poupadora de opioide",
    dose: { min: 1, max: 2, unidade: "mg", por: "kg" }, apresentacoes: [dePercentual(2)!, dePercentual(1)!],
    fonte: SAESP("conteúdo adulto"), situacao: "validado", revisao: REVISAO,
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
  },
  {
    id: "dipirona-paracetamol-adulto", nome: "Dipirona ou paracetamol", grupo: "analgesia",
    populacoes: ["adulto"], via: "IV", indicacao: "Analgesia pós-operatória",
    dose: { min: 20, max: 30, unidade: "mg", por: "kg" }, apresentacoes: [mgml(500), mgml(10, "10 mg/mL (paracetamol)")],
    fonte: SAESP("conteúdo adulto"), contextoFonte: "No contexto de analgesia pós-operatória",
    situacao: "validado", revisao: REVISAO,
  },
];

/* ------------------------------------------------------------------ *
 * Pendentes de fonte.
 *
 * Estavam na tabela antiga e não foram confirmados no material do SAESP
 * disponível. Aparecem na tela, pelo nome, para que a ausência seja visível —
 * mas não calculam, e não recebem a etiqueta do SAESP.
 * ------------------------------------------------------------------ */

export const PENDENTES: Array<{ nome: string; nota?: string }> = [
  { nome: "Propofol — dose geral de indução do adulto", nota: "A tabela antiga trazia 1,5–3 mg/kg como valor universal." },
  { nome: "Fentanil — dose geral de indução do adulto", nota: "A tabela antiga trazia 3–5 mcg/kg." },
  { nome: "Sufentanil adulto" },
  { nome: "Etomidato adulto" },
  { nome: "Cetamina adulto para indução" },
  { nome: "Succinilcolina adulto" },
  { nome: "Cisatracúrio adulto" },
  { nome: "Vecurônio adulto" },
  { nome: "Pancurônio adulto" },
  { nome: "Neostigmina adulto" },
  { nome: "Atropina para reversão" },
  { nome: "Ondansetrona" },
  { nome: "Dexametasona antiemética" },
  { nome: "Cetorolaco" },
  { nome: "Cefazolina" },
  { nome: "Hidrocortisona" },
  { nome: "Tramadol" },
  { nome: "Nalbufina" },
];

export const AVISO_PENDENTES =
  "Estes estavam na tabela antiga e não foram confirmados no material do SAESP disponível. Não recebem a etiqueta da fonte nem calculam: entram quando a referência específica for incluída.";

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
    .filter((m) => m.populacoes.includes(populacao))
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
