// A folha nasce da avaliação pré-anestésica.
//
// O que a avaliação já respondeu vem para o topo da folha — peso, ASA,
// alergias, medicamentos em uso, via aérea, jejum, exames — para o
// anestesiologista CONFERIR, e não redigitar. É uma cópia: mexer aqui não muda
// a avaliação original, e a folha guarda de qual avaliação veio e quando
// (`preanestesica_origem`). Cada alteração posterior do cabeçalho fica na
// auditoria com autor, data e o valor de antes.
//
// Campo vazio na avaliação continua vazio aqui. Nada é completado por
// suposição.

import { lerDecimal } from "../numero-clinico.ts";

type Dados = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const sim = (v: unknown) => texto(v) === "Sim";

export type CabecalhoDaFolha = {
  data_procedimento: string;
  hospital: string;
  sala: string;
  convenio: string;
  procedimento: string;
  diagnostico: string;
  cirurgiao: string;
  peso_kg: number | null;
  altura_cm: number | null;
  asa: string;
  asa_emergencia: boolean;
  alergias: string;
  nega_alergia: boolean;
  medicacao_uso: string;
  antecedentes: string;
  via_aerea: string;
  jejum: string;
  exames: string;
  sinais_pre: string;
  anestesia_anterior: string;
  observacoes_pre: string;
  preanestesica_origem: { avaliacao_id: string; importado_em: string } | null;
};

export type PacienteDaFolha = {
  nome: string;
  data_nascimento: string | null;
  idade_anos: number | null;
  sexo: string | null;
  convenio: string | null;
  hospital: string | null;
  cirurgia: string | null;
  procedimento: string | null;
};

function juntar(partes: Array<string | false | null | undefined>, sep = "; ") {
  return partes.filter((p): p is string => Boolean(p && p.trim())).join(sep);
}

function medicamentosEmUso(dados: Dados): string {
  try {
    const lista = JSON.parse(String(dados.medicamentos_json ?? "[]"));
    if (!Array.isArray(lista)) return "";
    return lista
      .map((m: Record<string, unknown>) => juntar([texto(m.nome), texto(m.dose), texto(m.frequencia)], " "))
      .filter(Boolean)
      .join("; ");
  } catch {
    return "";
  }
}

const EXAMES: Array<[string, string, string]> = [
  ["hemoglobina", "Hb", "g/dL"], ["hematocrito", "Ht", "%"], ["plaquetas", "Plaq.", ""],
  ["tap", "TAP", ""], ["inr", "INR", ""], ["ttpa", "TTPa", ""], ["creatinina", "Cr", "mg/dL"],
  ["ureia", "Ur", "mg/dL"], ["sodio", "Na", ""], ["potassio", "K", ""], ["glicemia", "Glic.", "mg/dL"],
  ["hba1c", "HbA1c", "%"],
];

export function cabecalhoInicial(
  paciente: PacienteDaFolha, avaliacao: { id: string; dados: Dados | null } | null, agora: Date,
): CabecalhoDaFolha {
  const d: Dados = avaliacao?.dados ?? {};
  const peso = lerDecimal(d.peso);
  const altura = lerDecimal(d.altura);
  const alergias = sim(d.alergias) ? texto(d.alergias_detalhes) || "Sim (sem detalhe na avaliação)" : "";
  const antecedentes = juntar([
    sim(d.cardiovascular) && `Cardiovascular: ${texto(d.cardiovascular_detalhes) || "sim"}`,
    sim(d.respiratoria) && `Respiratório: ${texto(d.respiratoria_detalhes) || "sim"}`,
    sim(d.diabetes) && `Diabetes: ${texto(d.diabetes_detalhes) || "sim"}`,
    sim(d.neurologica) && `Neurológico: ${texto(d.neurologica_detalhes) || "sim"}`,
    sim(d.outras_doencas) && texto(d.outras_doencas_detalhes),
    sim(d.habitos) && `Hábitos: ${texto(d.habitos_detalhes) || "sim"}`,
  ]);
  const via = juntar([
    texto(d.mallampati) && `Mallampati ${texto(d.mallampati)}`,
    texto(d.distancia_tireo) && `DTM ${texto(d.distancia_tireo)}`,
    texto(d.abertura_oral) && `abertura oral ${texto(d.abertura_oral)}`,
    texto(d.mobilidade) && `mobilidade cervical ${texto(d.mobilidade)}`,
    texto(d.denticao) && `dentição ${texto(d.denticao)}`,
    texto(d.circ_cervical) && `circ. cervical ${texto(d.circ_cervical)} cm`,
    sim(d.via_aerea_dificil) && "história de via aérea difícil",
    texto(d.observacoes_via_aerea),
  ]);
  const exames = juntar(EXAMES.map(([k, rot, un]) => {
    const v = texto(d[k]);
    return v && `${rot} ${v}${un ? ` ${un}` : ""}`;
  }));
  const sinais = juntar([
    texto(d.pa_sistolica) && texto(d.pa_diastolica) && `PA ${texto(d.pa_sistolica)}/${texto(d.pa_diastolica)}`,
    texto(d.fc) && `FC ${texto(d.fc)}`,
    texto(d.spo2) && `SpO₂ ${texto(d.spo2)}%`,
  ]);
  const anterior = juntar([
    sim(d.cirurgias_anteriores) && juntar([texto(d.cirurgias_anteriores_cirurgia), texto(d.cirurgias_anteriores_anestesia)], " — "),
    sim(d.reacao_anestesica) && `Reação: ${texto(d.reacao_anestesica_detalhes) || "sim"}`,
  ]);
  return {
    data_procedimento: texto(d.data_cirurgia) || agora.toISOString().slice(0, 10),
    hospital: texto(paciente.hospital),
    sala: "",
    convenio: texto(paciente.convenio),
    procedimento: texto(d.cirurgia) || texto(paciente.cirurgia) || texto(paciente.procedimento),
    diagnostico: "",
    cirurgiao: "",
    peso_kg: peso !== null && peso > 0 && peso <= 400 ? peso : null,
    altura_cm: altura !== null && altura >= 40 && altura <= 250 ? altura : null,
    asa: texto(d.asa),
    asa_emergencia: d.asa_emergencia === true,
    alergias,
    nega_alergia: texto(d.alergias) === "Não",
    medicacao_uso: medicamentosEmUso(d),
    antecedentes,
    via_aerea: via,
    jejum: juntar([texto(d.jejum_solidos) && `sólidos ${texto(d.jejum_solidos)}`,
      texto(d.jejum_liquidos) && `líquidos claros ${texto(d.jejum_liquidos)}`]),
    exames,
    sinais_pre: sinais,
    anestesia_anterior: anterior,
    observacoes_pre: "",
    preanestesica_origem: avaliacao ? { avaliacao_id: avaliacao.id, importado_em: agora.toISOString() } : null,
  };
}
