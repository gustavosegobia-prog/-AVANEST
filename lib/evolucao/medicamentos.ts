// Medicamentos: o catálogo, as unidades e as contas de dose.
//
// O CATÁLOGO TEM NOME, CATEGORIA E SINÔNIMOS — E NENHUMA DOSE. Nem dose
// habitual, nem apresentação comercial, nem concentração "padrão". O médico
// digita a concentração da ampola que tem na mão; dose de referência só existe
// em regras_de_dose, com fonte e revisor (lib/evolucao/doses.ts). A unidade
// sugerida (mcg para fentanil, mg para propofol) é convenção de escrita, não
// valor clínico, e pode ser trocada.

import { num, type Registro } from "./registros.ts";

export type Categoria =
  | "antibiotico" | "inducao" | "opioide" | "bloqueador" | "sedativo" | "vasoativo"
  | "anestesico_local" | "neuroeixo" | "analgesico" | "antiemetico" | "reversor" | "outros";

export const CATEGORIAS: Record<Categoria, string> = {
  antibiotico: "Antibioticoprofilaxia",
  inducao: "Indutores",
  opioide: "Opioides",
  bloqueador: "Bloqueadores neuromusculares",
  sedativo: "Sedativos",
  vasoativo: "Vasopressores e inotrópicos",
  anestesico_local: "Anestésicos locais",
  neuroeixo: "Adjuvantes do neuroeixo",
  analgesico: "Analgésicos e anti-inflamatórios",
  antiemetico: "Antieméticos",
  reversor: "Reversores e anticolinérgicos",
  outros: "Outros",
};

export type ItemDoCatalogo = {
  id: string;
  nome: string;
  categoria: Categoria;
  /** Nomes comerciais e grafias comuns, para a busca. */
  sinonimos: string[];
  unidade: "mg" | "mcg" | "g" | "UI";
  /** Entra na soma de exposição a anestésico local. */
  anestesicoLocal?: boolean;
};

export const CATALOGO: ItemDoCatalogo[] = [
  { id: "cefazolina", nome: "Cefazolina", categoria: "antibiotico", sinonimos: ["Kefazol"], unidade: "g" },
  { id: "propofol", nome: "Propofol", categoria: "inducao", sinonimos: ["Diprivan"], unidade: "mg" },
  { id: "etomidato", nome: "Etomidato", categoria: "inducao", sinonimos: ["Hypnomidate"], unidade: "mg" },
  { id: "cetamina", nome: "Cetamina", categoria: "inducao", sinonimos: ["Ketamina", "Ketalar"], unidade: "mg" },
  { id: "fentanil", nome: "Fentanil", categoria: "opioide", sinonimos: ["Fentanila", "Fentanest"], unidade: "mcg" },
  { id: "remifentanil", nome: "Remifentanil", categoria: "opioide", sinonimos: ["Remifentanila", "Ultiva"], unidade: "mcg" },
  { id: "sufentanil", nome: "Sufentanil", categoria: "opioide", sinonimos: ["Sufentanila"], unidade: "mcg" },
  { id: "morfina", nome: "Morfina", categoria: "opioide", sinonimos: ["Dimorf"], unidade: "mg" },
  { id: "metadona", nome: "Metadona", categoria: "opioide", sinonimos: ["Mytedom"], unidade: "mg" },
  { id: "tramadol", nome: "Tramadol", categoria: "opioide", sinonimos: ["Tramal"], unidade: "mg" },
  { id: "rocuronio", nome: "Rocurônio", categoria: "bloqueador", sinonimos: ["Rocuronio", "Esmeron"], unidade: "mg" },
  { id: "succinilcolina", nome: "Succinilcolina", categoria: "bloqueador", sinonimos: ["Suxametônio", "Quelicin"], unidade: "mg" },
  { id: "atracurio", nome: "Atracúrio", categoria: "bloqueador", sinonimos: ["Atracurio", "Tracrium"], unidade: "mg" },
  { id: "cisatracurio", nome: "Cisatracúrio", categoria: "bloqueador", sinonimos: ["Cisatracurio", "Nimbium"], unidade: "mg" },
  { id: "midazolam", nome: "Midazolam", categoria: "sedativo", sinonimos: ["Dormonid"], unidade: "mg" },
  { id: "dexmedetomidina", nome: "Dexmedetomidina", categoria: "sedativo", sinonimos: ["Precedex"], unidade: "mcg" },
  { id: "noradrenalina", nome: "Noradrenalina", categoria: "vasoativo", sinonimos: ["Norepinefrina"], unidade: "mcg" },
  { id: "adrenalina", nome: "Adrenalina", categoria: "vasoativo", sinonimos: ["Epinefrina"], unidade: "mcg" },
  { id: "efedrina", nome: "Efedrina", categoria: "vasoativo", sinonimos: [], unidade: "mg" },
  { id: "metaraminol", nome: "Metaraminol", categoria: "vasoativo", sinonimos: ["Aramin"], unidade: "mg" },
  { id: "fenilefrina", nome: "Fenilefrina", categoria: "vasoativo", sinonimos: [], unidade: "mcg" },
  { id: "bupivacaina", nome: "Bupivacaína", categoria: "anestesico_local", sinonimos: ["Bupivacaina", "Neocaína", "Marcaína"], unidade: "mg", anestesicoLocal: true },
  { id: "levobupivacaina", nome: "Levobupivacaína", categoria: "anestesico_local", sinonimos: ["Levobupivacaina", "Novabupi"], unidade: "mg", anestesicoLocal: true },
  { id: "ropivacaina", nome: "Ropivacaína", categoria: "anestesico_local", sinonimos: ["Ropivacaina", "Naropin"], unidade: "mg", anestesicoLocal: true },
  { id: "lidocaina", nome: "Lidocaína", categoria: "anestesico_local", sinonimos: ["Lidocaina", "Xylocaína"], unidade: "mg", anestesicoLocal: true },
  { id: "clonidina", nome: "Clonidina", categoria: "neuroeixo", sinonimos: ["Clonidin"], unidade: "mcg" },
  { id: "dipirona", nome: "Dipirona", categoria: "analgesico", sinonimos: ["Metamizol", "Novalgina"], unidade: "g" },
  { id: "cetorolaco", nome: "Cetorolaco", categoria: "analgesico", sinonimos: ["Toradol"], unidade: "mg" },
  { id: "tenoxicam", nome: "Tenoxicam", categoria: "analgesico", sinonimos: ["Tilatil"], unidade: "mg" },
  { id: "paracetamol", nome: "Paracetamol", categoria: "analgesico", sinonimos: ["Acetaminofeno"], unidade: "mg" },
  { id: "ondansetrona", nome: "Ondansetrona", categoria: "antiemetico", sinonimos: ["Vonau", "Zofran"], unidade: "mg" },
  { id: "dexametasona", nome: "Dexametasona", categoria: "antiemetico", sinonimos: ["Decadron"], unidade: "mg" },
  { id: "metoclopramida", nome: "Metoclopramida", categoria: "antiemetico", sinonimos: ["Plasil"], unidade: "mg" },
  { id: "bromoprida", nome: "Bromoprida", categoria: "antiemetico", sinonimos: ["Digesan"], unidade: "mg" },
  { id: "droperidol", nome: "Droperidol", categoria: "antiemetico", sinonimos: ["Droperdal"], unidade: "mg" },
  { id: "neostigmina", nome: "Neostigmina", categoria: "reversor", sinonimos: ["Prostigmine"], unidade: "mg" },
  { id: "sugamadex", nome: "Sugamadex", categoria: "reversor", sinonimos: ["Bridion"], unidade: "mg" },
  { id: "atropina", nome: "Atropina", categoria: "reversor", sinonimos: [], unidade: "mg" },
  { id: "flumazenil", nome: "Flumazenil", categoria: "reversor", sinonimos: ["Lanexat"], unidade: "mg" },
  { id: "naloxona", nome: "Naloxona", categoria: "reversor", sinonimos: ["Narcan"], unidade: "mg" },
  { id: "acido_tranexamico", nome: "Ácido tranexâmico", categoria: "outros", sinonimos: ["Transamin"], unidade: "g" },
  { id: "ocitocina", nome: "Ocitocina", categoria: "outros", sinonimos: ["Syntocinon"], unidade: "UI" },
  { id: "metilergometrina", nome: "Metilergometrina", categoria: "outros", sinonimos: ["Methergin"], unidade: "mg" },
  { id: "escopolamina", nome: "Escopolamina", categoria: "outros", sinonimos: ["Buscopan"], unidade: "mg" },
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Busca por princípio ativo ou nome comercial, sem se importar com acento. */
export function buscarNoCatalogo(texto: string, lista: readonly ItemDoCatalogo[] = CATALOGO): ItemDoCatalogo[] {
  const q = semAcento(texto);
  if (!q) return [...lista];
  const pontua = (i: ItemDoCatalogo) => {
    const nomes = [i.nome, ...i.sinonimos].map(semAcento);
    if (nomes.some((n) => n === q)) return 0;
    if (nomes.some((n) => n.startsWith(q))) return 1;
    if (nomes.some((n) => n.includes(q))) return 2;
    return 9;
  };
  return lista.map((i) => [pontua(i), i] as const).filter(([p]) => p < 9)
    .sort((a, b) => a[0] - b[0] || a[1].nome.localeCompare(b[1].nome)).map(([, i]) => i);
}

export const mesmoMedicamento = (a: string, b: string) => semAcento(a) === semAcento(b);

// ---------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------
export type UnidadeDeDose = "g" | "mg" | "mcg" | "UI" | "mEq" | "mL";
export type UnidadeDeConcentracao = "g/mL" | "mg/mL" | "mcg/mL" | "UI/mL" | "mEq/mL" | "%";

const PARA_MCG: Partial<Record<string, number>> = { g: 1_000_000, mg: 1_000, mcg: 1 };

/** Converte entre g, mg e mcg. Nulo se alguma das unidades não for massa. */
export function converterMassa(valor: number, de: string, para: string): number | null {
  const a = PARA_MCG[de], b = PARA_MCG[para];
  if (a === undefined || b === undefined) return null;
  return (valor * a) / b;
}

/**
 * A concentração na unidade da dose, por mL. "%" é g/100 mL: 1% = 10 mg/mL —
 * a lidocaína a 2% tem 20 mg em cada mL. Nulo quando as unidades não
 * conversam (UI com mg, por exemplo).
 */
export function concentracaoNaUnidade(
  c: { valor: number; unidade: UnidadeDeConcentracao }, unidadeDaDose: UnidadeDeDose,
): number | null {
  if (!(c.valor > 0)) return null;
  if (c.unidade === "%") return converterMassa(c.valor * 10, "mg", unidadeDaDose);
  const [massa] = c.unidade.split("/");
  if (massa === unidadeDaDose) return c.valor;
  return converterMassa(c.valor, massa, unidadeDaDose);
}

/** Volume (mL) de uma dose, pela concentração. Arredondado a 0,001 mL. */
export function volumeDaDose(
  dose: number, unidade: UnidadeDeDose, c: { valor: number; unidade: UnidadeDeConcentracao },
): number | null {
  if (unidade === "mL") return dose;
  const porMl = concentracaoNaUnidade(c, unidade);
  if (!porMl) return null;
  return Math.round((dose / porMl) * 1000) / 1000;
}

/** Dose de um volume, pela concentração. */
export function doseDoVolume(
  volumeMl: number, unidade: UnidadeDeDose, c: { valor: number; unidade: UnidadeDeConcentracao },
): number | null {
  const porMl = concentracaoNaUnidade(c, unidade);
  if (porMl === null) return null;
  return Math.round(volumeMl * porMl * 10000) / 10000;
}

/** Dose por kg na mesma unidade da dose (mg/kg, mcg/kg…). */
export function dosePorKg(dose: number, pesoKg: number | null | undefined): number | null {
  if (!(dose > 0) || !pesoKg || !(pesoKg > 0)) return null;
  return Math.round((dose / pesoKg) * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// O que foi dado
// ---------------------------------------------------------------------------
export type Administracao = {
  id: string;
  momento: string;
  nome: string;
  dose: number;
  unidade: UnidadeDeDose;
  via: string;
  forma: string;
  volumeMl: number | null;
  observacao: string;
};

export function lerAdministracao(r: Registro): Administracao | null {
  if (r.tipo !== "medicamento" || r.dados.status !== "administrado") return null;
  const dose = num(r.dados.dose);
  if (dose === null) return null;
  const calc = (r.dados.calc ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    momento: r.momento,
    nome: String(r.dados.nome ?? ""),
    dose,
    unidade: r.dados.unidade as UnidadeDeDose,
    via: String(r.dados.via ?? ""),
    forma: String(r.dados.forma ?? ""),
    volumeMl: num(r.dados.volume_ml) ?? num(calc.volume_ml),
    observacao: String(r.dados.observacao ?? ""),
  };
}

/**
 * Só o que foi ADMINISTRADO. Planejado, preparado e cancelado ficam fora — é
 * a regra da coluna da direita da folha impressa.
 */
export function administrados(vigentes: readonly Registro[]): Administracao[] {
  return vigentes.map(lerAdministracao).filter((a): a is Administracao => a !== null);
}

export type Agrupado = {
  nome: string;
  vezes: Administracao[];
  /** Soma na unidade da primeira administração; nulo se as unidades não somam. */
  total: number | null;
  unidade: UnidadeDeDose;
};

/**
 * Por medicamento, com cada administração e o total acumulado. Repetição não
 * se esconde: o papel mostra as vezes e o total.
 */
export function agruparPorMedicamento(lista: readonly Administracao[]): Agrupado[] {
  const grupos: Agrupado[] = [];
  for (const a of lista) {
    let g = grupos.find((x) => mesmoMedicamento(x.nome, a.nome));
    if (!g) { g = { nome: a.nome, vezes: [], total: 0, unidade: a.unidade }; grupos.push(g); }
    g.vezes.push(a);
    if (g.total !== null) {
      const v = a.unidade === g.unidade ? a.dose : converterMassa(a.dose, a.unidade, g.unidade);
      g.total = v === null ? null : Math.round((g.total + v) * 10000) / 10000;
    }
  }
  return grupos;
}

/** Dose acumulada de um medicamento até um horário, na unidade pedida. */
export function doseAcumulada(
  lista: readonly Administracao[], nome: string, unidade: UnidadeDeDose, ate?: string,
): number | null {
  let total = 0;
  for (const a of lista) {
    if (!mesmoMedicamento(a.nome, nome)) continue;
    if (ate && Date.parse(a.momento) > Date.parse(ate)) continue;
    const v = a.unidade === unidade ? a.dose : converterMassa(a.dose, a.unidade, unidade);
    if (v === null) return null;
    total += v;
  }
  return Math.round(total * 10000) / 10000;
}

/**
 * A exposição a anestésico local: total em mg de cada agente e em mg/kg.
 * Só soma e mostra — não diz se é seguro. O julgamento da exposição combinada
 * depende de regra clínica validada, que entra por regras_de_dose.
 */
export function exposicaoAnestesicoLocal(lista: readonly Administracao[], pesoKg: number | null) {
  const locais = CATALOGO.filter((c) => c.anestesicoLocal);
  return locais.map((c) => {
    const mg = doseAcumulada(lista, c.nome, "mg");
    const algum = lista.some((a) => mesmoMedicamento(a.nome, c.nome)
      || c.sinonimos.some((s) => mesmoMedicamento(a.nome, s)));
    return { nome: c.nome, mg: algum ? mg : 0, mgPorKg: algum && mg !== null ? dosePorKg(mg, pesoKg) : null };
  }).filter((x) => (x.mg ?? 1) > 0);
}
