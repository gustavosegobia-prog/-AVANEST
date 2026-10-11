// A avaliação pré-anestésica no desenho da ficha de papel.
//
// O papel tem um campo para cada coisa: PA, pulso, respiração, temperatura,
// tipo sanguíneo, TAP/INR, plaquetas, Hb, Ht, glicemia, creatinina, outros;
// e à direita os aparelhos (respiratório, digestivo, circulatório,
// endócrino), estado mental, anestesia anterior e alergias.
//
// A folha nova já nasce com esses campos separados (importar.ts). A folha
// antiga guardava alguns deles juntos num texto só ("PA 120/80; FC 72",
// "Hb 12,8 g/dL; Ht 38 %"…), escrito por nós num formato conhecido — então
// dá para separar na leitura, sem mexer no que está gravado. Campo separado,
// quando existe, sempre vence o texto antigo. Nada é inventado: o que não
// estava em lugar nenhum fica em branco, como no papel.

type Dados = Record<string, unknown>;

export const CAMPOS_DO_PAPEL = [
  "convenio", "cor", "pa", "pulso", "respiracao", "temperatura", "tipo_sanguineo",
  "tap_inr", "plaquetas", "hemoglobina", "hematocrito", "glicemia", "creatinina", "exames_outros",
  "ap_respiratorio", "ap_digestivo", "jejum_horas", "ap_circulatorio", "ap_endocrino", "estado_mental",
  "medicacao_uso", "observacoes_pre", "anestesia_anterior", "diagnostico",
] as const;
export type CampoDoPapel = (typeof CAMPOS_DO_PAPEL)[number];

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const partes = (v: unknown) => texto(v).split(/;\s*/).map((p) => p.trim()).filter(Boolean);

/** Tira o rótulo conhecido do começo de um pedaço: "Hb 12,8 g/dL" → "12,8 g/dL". */
function semRotulo(pedaco: string, rotulo: string) {
  return pedaco.slice(rotulo.length).replace(/^[:\s]+/, "").trim();
}

/**
 * Os valores de cada campo do papel. Para cada campo: o separado, se a folha
 * já o tem; senão, o que der para tirar do texto antigo agrupado.
 */
export function camposDoPapel(d: Dados): Record<CampoDoPapel, string> {
  const saida = Object.fromEntries(CAMPOS_DO_PAPEL.map((c) => [c, ""])) as Record<CampoDoPapel, string>;

  // Sinais: "PA 100/60; FC 98; SpO₂ 99%"
  const sobraSinais: string[] = [];
  for (const p of partes(d.sinais_pre)) {
    if (p.startsWith("PA ")) saida.pa = semRotulo(p, "PA");
    else if (p.startsWith("FC ")) saida.pulso = semRotulo(p, "FC");
    else sobraSinais.push(p);
  }

  // Exames: "Hb 12,8 g/dL; Ht 38 %; Plaq. 250000; TAP 90; INR 1,1; Cr 0,8 mg/dL; Glic. 90 mg/dL; …"
  const sobraExames: string[] = [];
  let tap = "", inr = "";
  for (const p of partes(d.exames)) {
    if (p.startsWith("Hb ")) saida.hemoglobina = semRotulo(p, "Hb");
    else if (p.startsWith("Ht ")) saida.hematocrito = semRotulo(p, "Ht");
    else if (p.startsWith("Plaq. ")) saida.plaquetas = semRotulo(p, "Plaq.");
    else if (p.startsWith("TAP ")) tap = semRotulo(p, "TAP");
    else if (p.startsWith("INR ")) inr = semRotulo(p, "INR");
    else if (p.startsWith("Cr ")) saida.creatinina = semRotulo(p, "Cr");
    else if (p.startsWith("Glic. ")) saida.glicemia = semRotulo(p, "Glic.");
    else sobraExames.push(p);
  }
  saida.tap_inr = [tap, inr].filter(Boolean).join(" / ");
  saida.exames_outros = [...sobraExames, ...sobraSinais].join("; ");

  // Antecedentes: "Cardiovascular: …; Respiratório: …; Diabetes: …; Neurológico: …; Hábitos: …; outras"
  const sobraAntecedentes: string[] = [];
  let respiratorio = "";
  for (const p of partes(d.antecedentes)) {
    if (p.startsWith("Cardiovascular:")) saida.ap_circulatorio = semRotulo(p, "Cardiovascular");
    else if (p.startsWith("Respiratório:")) respiratorio = semRotulo(p, "Respiratório");
    else if (p.startsWith("Diabetes:")) saida.ap_endocrino = `Diabetes: ${semRotulo(p, "Diabetes")}`;
    else if (p.startsWith("Neurológico:")) saida.estado_mental = semRotulo(p, "Neurológico");
    else sobraAntecedentes.push(p);
  }
  // A via aérea não tem campo próprio no papel. O exame inteiro (Mallampati,
  // DTM, abertura oral…) fica na avaliação; na célula do aparelho respiratório
  // só entra o que muda a conduta na sala: via aérea difícil, quando houver.
  const dificil = /via a[ée]rea dif[ií]cil/i.test(texto(d.via_aerea));
  saida.ap_respiratorio = [respiratorio, dificil && "Via aérea difícil"].filter(Boolean).join(" · ");
  // O que a ficha aberta antes desta regra gravou sozinha na célula, com o
  // exame inteiro. Se ninguém mexeu nela, vale a regra nova; se mexeu, fica.
  const respiratorioAntigo = [respiratorio, texto(d.via_aerea) && `Via aérea: ${texto(d.via_aerea)}`].filter(Boolean).join(" · ");
  // Jejum: "sólidos 8 horas antes; líquidos claros Jejum absoluto". O papel
  // tem "jejum > __ h" dentro do aparelho digestivo: as horas dos sólidos vão
  // para lá, e o que não for número de horas fica escrito na célula.
  const sobraJejum: string[] = [];
  for (const p of partes(d.jejum)) {
    const horas = /^sólidos\s+(\d+(?:[.,]\d+)?)\s*h/i.exec(p);
    if (horas && !saida.jejum_horas) saida.jejum_horas = horas[1];
    else if (p.startsWith("líquidos claros ")) {
      const v = semRotulo(p, "líquidos claros");
      sobraJejum.push(/líquido/i.test(v) ? v : `Líquidos claros: ${v.charAt(0).toLowerCase()}${v.slice(1)}`);
    } else sobraJejum.push(`Jejum: ${p}`);
  }
  saida.ap_digestivo = sobraJejum.join("; ");
  saida.observacoes_pre = [texto(d.observacoes_pre), ...sobraAntecedentes].filter(Boolean).join("; ");

  saida.convenio = texto(d.convenio);
  saida.medicacao_uso = texto(d.medicacao_uso);
  saida.anestesia_anterior = texto(d.anestesia_anterior);
  saida.diagnostico = texto(d.diagnostico);

  // O campo separado, quando a folha já o tem, vence o texto antigo — mesmo
  // vazio: apagar a célula é uma escolha, e o texto antigo não volta.
  for (const c of CAMPOS_DO_PAPEL) {
    const v = d[chaveDoCampo(c)];
    if (typeof v !== "string") continue;
    if (c === "ap_respiratorio" && respiratorioAntigo && v.trim() === respiratorioAntigo) continue;
    saida[c] = v.trim();
  }
  return saida;
}

/**
 * A classe ASA como o papel circula: "I" a "VI". A avaliação grava "ASA II";
 * fichas antigas, "II"; à mão pode vir "2". Qualquer outra coisa: vazio.
 */
export function asaRomana(v: unknown): string {
  const s = texto(v).toUpperCase().replace(/^ASA\s*/, "").replace(/\s*E$/, "").trim();
  const romanos = ["I", "II", "III", "IV", "V", "VI"];
  if (romanos.includes(s)) return s;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 6 ? romanos[n - 1] : "";
}

/** O sexo como cabe na célula do papel: FEM, MASC; "Não informado" fica em branco. */
export function sexoAbreviado(v: unknown): string {
  const s = texto(v);
  if (/^f(em|eminino)?\.?$/i.test(s)) return "FEM";
  if (/^m(asc|asculino)?\.?$/i.test(s)) return "MASC";
  return /^n[ãa]o informado$/i.test(s) ? "" : s;
}

/**
 * A chave em que cada célula do papel grava no cabeçalho. Sempre uma chave
 * própria: editar a célula nunca mexe no texto antigo agrupado, e a leitura
 * não junta os dois.
 */
export const chaveDoCampo = (c: CampoDoPapel) => `papel_${c}`;
