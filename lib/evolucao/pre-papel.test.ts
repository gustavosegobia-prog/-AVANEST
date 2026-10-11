import test from "node:test";
import assert from "node:assert/strict";
import { asaRomana, camposDoPapel, chaveDoCampo, sexoAbreviado } from "./pre-papel.ts";
import { cabecalhoInicial } from "./importar.ts";

const ANTIGA = {
  convenio: "Particular", sinais_pre: "PA 100/60; FC 98; SpO₂ 99%",
  exames: "Hb 12,8 g/dL; Ht 38 %; Plaq. 250000; TAP 90; INR 1,1; Cr 0,8 mg/dL; Glic. 92 mg/dL; K 4,1",
  antecedentes: "Cardiovascular: HAS; Respiratório: asma leve; Diabetes: DM2; Neurológico: sem déficit; Hábitos: tabagismo",
  via_aerea: "Mallampati II", jejum: "sólidos 8 h", medicacao_uso: "Losartana", anestesia_anterior: "Raqui 2019",
  diagnostico: "Colelitíase", observacoes_pre: "",
};

test("Papel — a folha antiga é separada campo a campo, sem mexer no gravado", () => {
  const c = camposDoPapel(ANTIGA);
  assert.equal(c.pa, "100/60");
  assert.equal(c.pulso, "98");
  assert.equal(c.hemoglobina, "12,8 g/dL");
  assert.equal(c.hematocrito, "38 %");
  assert.equal(c.plaquetas, "250000");
  assert.equal(c.tap_inr, "90 / 1,1");
  assert.equal(c.creatinina, "0,8 mg/dL");
  assert.equal(c.glicemia, "92 mg/dL");
  assert.equal(c.exames_outros, "K 4,1; SpO₂ 99%");
  assert.equal(c.ap_circulatorio, "HAS");
  // O exame da via aérea fica na avaliação: na célula, só a via aérea difícil.
  assert.equal(c.ap_respiratorio, "asma leve");
  assert.equal(c.ap_endocrino, "Diabetes: DM2");
  assert.equal(c.estado_mental, "sem déficit");
  assert.equal(c.jejum_horas, "8");
  assert.equal(c.ap_digestivo, "");
  assert.equal(c.observacoes_pre, "Hábitos: tabagismo");
  assert.equal(c.convenio, "Particular");
  assert.equal(c.cor, "");
  assert.equal(c.tipo_sanguineo, "");
});

test("Papel — a célula editada vence o texto antigo, mesmo apagada", () => {
  const c = camposDoPapel({ ...ANTIGA, [chaveDoCampo("pa")]: "130/85", [chaveDoCampo("hemoglobina")]: "" });
  assert.equal(c.pa, "130/85");
  assert.equal(c.hemoglobina, "");
  assert.equal(c.pulso, "98");
});

test("Papel — a folha nova já nasce com as células separadas", () => {
  const c = cabecalhoInicial(
    { nome: "Paciente Teste", data_nascimento: null, idade_anos: 40, sexo: "F", convenio: "SUS", hospital: null, cirurgia: null, procedimento: null },
    { id: "a1", dados: { pa_sistolica: "120", pa_diastolica: "80", fc: "70", hemoglobina: "13", respiratoria: "Sim", respiratoria_detalhes: "DPOC" } },
    new Date("2026-10-10T09:00:00-03:00"),
  );
  assert.equal(c.papel_pa, "120/80");
  assert.equal(c.papel_pulso, "70");
  assert.equal(c.papel_hemoglobina, "13 g/dL");
  assert.equal(c.papel_ap_respiratorio, "DPOC");
  assert.equal(c.papel_convenio, "SUS");
  assert.equal(c.papel_cor, "");
});

test("Papel — o jejum da avaliação: horas dos sólidos no \"jejum > __ h\", o resto na célula", () => {
  const c = camposDoPapel({ jejum: "sólidos 8 horas antes; líquidos claros Jejum absoluto" });
  assert.equal(c.jejum_horas, "8");
  assert.equal(c.ap_digestivo, "Líquidos claros: jejum absoluto");
  const d = camposDoPapel({ jejum: "sólidos Protocolo especial; líquidos claros Líquidos claros até 2 h antes" });
  assert.equal(d.jejum_horas, "");
  assert.equal(d.ap_digestivo, "Jejum: sólidos Protocolo especial; Líquidos claros até 2 h antes");
});

test("Papel — via aérea difícil é a única coisa da via aérea que vai para a célula", () => {
  const c = camposDoPapel({ via_aerea: "Mallampati III; DTM < 6 cm; história de via aérea difícil" });
  assert.equal(c.ap_respiratorio, "Via aérea difícil");
  assert.equal(camposDoPapel({ via_aerea: "Mallampati I; DTM > 6,5 cm" }).ap_respiratorio, "");
});

test("Papel — o ASA da avaliação (\"ASA II\") é circulado na ficha", () => {
  assert.equal(asaRomana("ASA II"), "II");
  assert.equal(asaRomana("II"), "II");
  assert.equal(asaRomana("asa iv e"), "IV");
  assert.equal(asaRomana("3"), "III");
  assert.equal(asaRomana("ASA VII"), "");
  assert.equal(asaRomana(""), "");
});

test("Papel — a ficha nasce com ASA, diagnóstico e cirurgião da avaliação", () => {
  const c = cabecalhoInicial(
    { nome: "Paciente Teste", data_nascimento: null, idade_anos: 40, sexo: "F", convenio: "SUS", hospital: null, cirurgia: null, procedimento: null },
    { id: "a1", dados: { asa: "ASA II", diagnostico: "Colelitíase", cirurgia: "Colecistectomia", cirurgiao: "Dr. Fictício" } },
    new Date("2026-10-10T09:00:00-03:00"),
  );
  assert.equal(c.asa, "II");
  assert.equal(c.diagnostico, "Colelitíase");
  assert.equal(c.papel_diagnostico, "Colelitíase");
  assert.equal(c.procedimento, "Colecistectomia");
  assert.equal(c.cirurgiao, "Dr. Fictício");
});

test("Papel — a célula do aparelho respiratório gravada sozinha pela regra antiga segue a nova", () => {
  const via = "Mallampati Classe I; DTM > 6,5 cm; abertura oral > 4 cm";
  const antiga = camposDoPapel({ via_aerea: via, [chaveDoCampo("ap_respiratorio")]: `Via aérea: ${via}` });
  assert.equal(antiga.ap_respiratorio, "");
  // Escrita à mão, fica como está.
  const editada = camposDoPapel({ via_aerea: via, [chaveDoCampo("ap_respiratorio")]: "Asma controlada" });
  assert.equal(editada.ap_respiratorio, "Asma controlada");
});

test("sexo abreviado como no papel", () => {
  assert.equal(sexoAbreviado("Feminino"), "FEM");
  assert.equal(sexoAbreviado("Masculino"), "MASC");
  assert.equal(sexoAbreviado("masculino"), "MASC");
  assert.equal(sexoAbreviado("Outro"), "Outro");
  assert.equal(sexoAbreviado("Não informado"), "");
  assert.equal(sexoAbreviado(null), "");
});
