/**
 * Calculadora de doses: motor de cálculo e catálogo.
 *
 * Duas responsabilidades, separadas de propósito.
 *
 * O MOTOR faz a conta e protege a unidade. É ele que impede o erro que mata:
 * somar mcg com mg, dividir uma dose em mcg por uma concentração em mg/mL,
 * ler 2% como 2 mg/mL. Ele não sabe nada de medicamento — recebe números com
 * unidade e devolve números com unidade, ou se recusa a responder.
 *
 * O CATÁLOGO é a tabela do serviço. Cada entrada carrega fonte, população,
 * via, apresentação e data de revisão, e uma dose só fica disponível para uso
 * clínico depois de validada. O que não tem fonte não entra: uma calculadora
 * de dose com número inventado é pior do que calculadora nenhuma, porque
 * parece confiável.
 *
 * Por isso o motor funciona sozinho. Enquanto o catálogo não estiver
 * preenchido, a tela oferece o cálculo avulso: quem digita a dose/kg e a
 * apresentação é o anestesiologista, e a máquina só faz a regra de três — que
 * é justamente a parte que erra às três da manhã.
 */

export type Fonte = { obra: string; local: string };
export const citar = (f: Fonte) => `${f.obra} — ${f.local}`;

export const virgula = (v: number) => String(v).replace(".", ",");
const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
const ok = (v?: number): v is number => typeof v === "number" && Number.isFinite(v);

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

export const convertem = (de: Unidade, para: Unidade) => converter(1, de, para) !== undefined;

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
 * É a conversão que a fonte manda não errar, e a que mais se erra — ler "2%"
 * como "2 mg/mL" subestima o volume em dez vezes.
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

/* ------------------------------------------------------------------ *
 * O cálculo
 * ------------------------------------------------------------------ */

export type Nivel = "minima" | "usual" | "maxima";

export const ROTULO_NIVEL: Record<Nivel, string> = {
  minima: "Mínima", usual: "Usual", maxima: "Máxima",
};

export type DosePorKg = {
  min?: number;
  usual?: number;
  max?: number;
  unidade: Unidade;
  /** "kg" para bolo; "kg/h" para infusão contínua. */
  por: "kg" | "kg/h";
};

/** Teto absoluto, independente do peso. */
export type Teto = { valor: number; unidade: Unidade };

export type Calculo = {
  nivel: Nivel;
  dosePorKg: number;
  unidadeDose: Unidade;
  por: "kg" | "kg/h";
  doseTotal: number;
  /** Volume só existe quando a unidade da dose e a da apresentação conversam. */
  volumeMl?: number;
  /** Verdadeiro quando o teto absoluto cortou a dose calculada pelo peso. */
  limitada?: boolean;
  doseAntesDoTeto?: number;
  /** Preenchido quando a apresentação não permite calcular volume. */
  incompatibilidade?: string;
};

/**
 * Dose total = peso × dose/kg. Volume = dose total ÷ concentração.
 *
 * A dose permanece na unidade em que foi cadastrada até o fim — mcg continua
 * mcg. A conversão acontece uma vez só, na divisão pela apresentação, e só
 * entre unidades de massa. Se a dose é em UI e a apresentação em mg, não sai
 * volume: sai a incompatibilidade escrita, que é o que evita o acidente.
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

  const base: Calculo = {
    nivel, dosePorKg, unidadeDose: dose.unidade, por: dose.por,
    doseTotal: arred(doseTotal, 3),
    ...(limitada ? { limitada, doseAntesDoTeto: arred(bruta, 3) } : {}),
  };

  if (!apresentacao) return base;

  const naUnidadeDaApresentacao = converter(doseTotal, dose.unidade, apresentacao.unidade);
  if (naUnidadeDaApresentacao === undefined) {
    return {
      ...base,
      incompatibilidade: `Dose em ${dose.unidade} e apresentação em ${apresentacao.unidade}: sem equivalência entre as duas. Confira a apresentação.`,
    };
  }

  const concentracao = porMl(apresentacao);
  if (!ok(concentracao) || concentracao <= 0) return base;

  return { ...base, volumeMl: arred(naUnidadeDaApresentacao / concentracao, 2) };
}

/** Os três níveis que a dose cadastrada oferecer, na ordem mínima → máxima. */
export function calcular(dose: DosePorKg, pesoKg: number, apresentacao?: Apresentacao, teto?: Teto): Calculo[] {
  const niveis: Array<[Nivel, number | undefined]> = [
    ["minima", dose.min], ["usual", dose.usual], ["maxima", dose.max],
  ];
  return niveis
    .filter(([, v]) => ok(v))
    .map(([n, v]) => calcularNivel(n, v!, dose, pesoKg, apresentacao, teto))
    .filter((c): c is Calculo => c !== undefined);
}

/** Volume máximo de um anestésico local, a partir do teto por quilo. */
export function volumeMaximo(dose: DosePorKg, pesoKg: number, apresentacao: Apresentacao, teto?: Teto) {
  const maior = dose.max ?? dose.usual ?? dose.min;
  if (maior === undefined) return undefined;
  return calcularNivel("maxima", maior, dose, pesoKg, apresentacao, teto);
}

/* ------------------------------------------------------------------ *
 * Catálogo
 * ------------------------------------------------------------------ */

export type GrupoId =
  | "inducao" | "opioides" | "bloqueadores" | "reversao" | "analgesia"
  | "antiemeticos" | "antibioticos" | "cardiovascular" | "locais" | "eletrolitos";

export const GRUPOS: Array<{ id: GrupoId; nome: string; icone: string }> = [
  { id: "inducao", nome: "Indução", icone: "💉" },
  { id: "opioides", nome: "Opioides", icone: "🌙" },
  { id: "bloqueadores", nome: "Bloqueadores neuromusculares", icone: "💪" },
  { id: "reversao", nome: "Reversão", icone: "🔄" },
  { id: "analgesia", nome: "Analgesia", icone: "💊" },
  { id: "antiemeticos", nome: "Antieméticos e profilaxia", icone: "🤢" },
  { id: "antibioticos", nome: "Antibióticos", icone: "🧫" },
  { id: "cardiovascular", nome: "Cardiovasculares", icone: "❤️" },
  { id: "locais", nome: "Anestésicos locais", icone: "🎯" },
  { id: "eletrolitos", nome: "Eletrólitos e emergência", icone: "⚡" },
];

/**
 * Estado de uma entrada do catálogo.
 *
 * "validado" é o único que a tela mostra como pronto para uso. Os outros
 * aparecem marcados, porque uma dose sem validação circulando com cara de
 * validada é exatamente o erro que não se corrige depois.
 */
export type Situacao = "validado" | "aguardando-validacao" | "sem-fonte";

export type Medicamento = {
  id: string;
  nome: string;
  grupo: GrupoId;
  via: string;
  apresentacoes: Apresentacao[];
  adulto?: DosePorKg;
  pediatrico?: DosePorKg;
  tetoAbsoluto?: Teto;
  fonte?: Fonte;
  /** Quando a droga pede titulação, o módulo mostra a faixa e não escolhe. */
  titulavel?: boolean;
  observacao?: string;
  revisao?: string;
  situacao: Situacao;
};

/**
 * O corte entre adulto e pediátrico.
 *
 * Este 12 é do AVANEST, não de fonte, igual ao do tubo e ao do lembrete de
 * idoso no PCA. Fica isolado e declarado.
 */
export const IDADE_ADULTO_ANOS = 12;

export type Populacao = "adulto" | "pediatrico";

export const populacaoPor = (idadeAnos?: number): Populacao | undefined =>
  ok(idadeAnos) && idadeAnos >= 0 ? (idadeAnos >= IDADE_ADULTO_ANOS ? "adulto" : "pediatrico") : undefined;

export const doseDe = (m: Medicamento, p: Populacao) => (p === "adulto" ? m.adulto : m.pediatrico);

/**
 * Catálogo inicial.
 *
 * Só entra aqui o que já tem fonte citada dentro do próprio AVANEST — as
 * doses que os guias do PCA e dos eletrólitos sustentam. O resto da tabela
 * (indução, bloqueadores, antibióticos, anestésicos locais) fica de fora até
 * chegar a fonte: inventar um número de indução para preencher tela seria o
 * pior erro possível neste módulo.
 *
 * O motor não depende disto. A tela calcula qualquer fármaco no modo avulso.
 */
const SAESP = (p: string): Fonte => ({ obra: "SAESP, Tratado de Anestesiologia", local: p });

export const CATALOGO: Medicamento[] = [
  {
    id: "morfina-bolo", nome: "Morfina — bolo", grupo: "opioides", via: "EV, bolo",
    apresentacoes: [{ rotulo: "10 mg/mL", quantidade: 10, unidade: "mg", mL: 1 }],
    adulto: { usual: 0.15, unidade: "mg", por: "kg" },
    fonte: SAESP("PDF p. 3077"), observacao: "A cada 3 a 4 h.",
    situacao: "validado", revisao: "08/08/2026",
  },
  {
    id: "morfina-infusao", nome: "Morfina — infusão contínua", grupo: "opioides", via: "EV, infusão contínua",
    apresentacoes: [{ rotulo: "10 mg/mL", quantidade: 10, unidade: "mg", mL: 1 }],
    adulto: { min: 0.03, max: 0.1, unidade: "mg", por: "kg/h" },
    fonte: SAESP("PDF p. 3077"), situacao: "validado", revisao: "08/08/2026",
  },
  {
    id: "fentanil-inicial", nome: "Fentanil — dose inicial", grupo: "opioides", via: "EV",
    apresentacoes: [{ rotulo: "50 mcg/mL", quantidade: 50, unidade: "mcg", mL: 1 }],
    adulto: { min: 0.8, max: 1.6, unidade: "mcg", por: "kg" },
    fonte: SAESP("PDF p. 3077"),
    observacao: "A tabela do SAESP rotula esta linha como infusão contínua. Mantido como a fonte escreve.",
    situacao: "validado", revisao: "08/08/2026",
  },
  {
    id: "fentanil-infusao", nome: "Fentanil — infusão contínua", grupo: "opioides", via: "EV, infusão contínua",
    apresentacoes: [{ rotulo: "50 mcg/mL", quantidade: 50, unidade: "mcg", mL: 1 }],
    adulto: { min: 0.3, max: 1.6, unidade: "mcg", por: "kg/h" },
    fonte: SAESP("PDF p. 3077"), situacao: "validado", revisao: "08/08/2026",
  },
  {
    id: "sufentanil-peridural", nome: "Sufentanil — peridural", grupo: "opioides", via: "Peridural, infusão contínua",
    apresentacoes: [{ rotulo: "5 mcg/mL", quantidade: 5, unidade: "mcg", mL: 1 }],
    adulto: { min: 0.15, max: 0.3, unidade: "mcg", por: "kg/h" },
    fonte: SAESP("PDF p. 3077"), situacao: "validado", revisao: "08/08/2026",
  },
];

export const acharMedicamento = (id: string) => CATALOGO.find((m) => m.id === id);

/** Os que têm dose cadastrada para aquela população, na ordem dos grupos. */
export function disponiveis(populacao: Populacao): Medicamento[] {
  const ordem = GRUPOS.map((g) => g.id);
  return CATALOGO
    .filter((m) => doseDe(m, populacao) !== undefined)
    .sort((a, b) => ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function buscar(termo: string, lista: Medicamento[]): Medicamento[] {
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return lista;
  return lista.filter((m) => m.nome.toLowerCase().includes(alvo));
}

/* ------------------------------------------------------------------ *
 * Avisos
 * ------------------------------------------------------------------ */

export const AVISO_MODULO =
  "Apoio ao cálculo, não prescrição. Confira apresentação, via e dose contra a ampola e o protocolo do serviço antes de administrar. Dupla checagem continua obrigatória.";

export const CATALOGO_INCOMPLETO =
  "O catálogo ainda não tem a tabela completa do serviço. Só aparecem aqui as doses com fonte citada dentro do AVANEST; as demais entram quando a tabela validada for cadastrada. Para qualquer fármaco fora da lista, use o cálculo avulso — o motor é o mesmo.";

export const AVISO_AVULSO =
  "No cálculo avulso, a dose por quilo e a apresentação são suas. O AVANEST faz a regra de três e confere as unidades — não valida a dose.";

export const AVISO_TITULAVEL =
  "Fármaco de titulação clínica: o módulo mostra a faixa calculada para este peso e não escolhe um valor.";
