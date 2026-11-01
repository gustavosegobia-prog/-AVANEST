import test from "node:test";
import assert from "node:assert/strict";
import { acharProtocolo, PROTOCOLOS, PROTOCOLOS_DA_PREVIA, rascunhoDe } from "./catalogo.ts";
import { APROVACOES, aprovado } from "./aprovacao.ts";
import { calcularDose, passosDe, type PacienteDaConsulta } from "./calculo.ts";
import { acharReferencia } from "./referencias.ts";
import { RASCUNHOS } from "./protocolos/rascunhos.ts";
import type { Protocolo } from "./tipos.ts";

// Correção das pendências científicas (01/11/2026): as propostas entram como
// rascunho. Quem usa continua com a versão publicada; só a prévia do
// responsável médico abre o rascunho. Nenhuma aprovação em lote.

const gestante: PacienteDaConsulta = { idadeAnos: 30, pesoKg: 70, gestante: true } as PacienteDaConsulta;
const adulto: PacienteDaConsulta = { idadeAnos: 40, pesoKg: 70 };
const conta = (p: Protocolo, id: string, pac: PacienteDaConsulta, apresentacao = 0) =>
  calcularDose(p.medicamentos.find((m) => m.id === id)!, p, pac, apresentacao).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume, c.unidadeVolume]);

test("rascunho: só na prévia do responsável, nunca para quem usa, e sem aprovação", () => {
  assert.deepEqual(RASCUNHOS.map((r) => `${r.id} v${r.versao}`),
    ["embolia-pulmonar v2", "colapso-materno v3", "depressao-respiratoria-opioides v3", "hipotermia-perioperatoria v3"]);
  for (const r of RASCUNHOS) {
    const publicado = acharProtocolo(r.id)!;
    assert.ok(publicado, r.id);
    assert.notEqual(publicado, r, `${r.id}: o catálogo publicado não pode ser o rascunho`);
    assert.ok(r.versao > publicado.versao, r.id);
    assert.equal(aprovado(r), false, `${r.id}: rascunho aprovado`);
    assert.equal(PROTOCOLOS_DA_PREVIA.find((p) => p.id === r.id), r, `${r.id}: a prévia abre o rascunho`);
    assert.equal(rascunhoDe(r.id), r);
  }
  // A versão publicada não mudou: aprovada continua aprovada, em validação continua em validação.
  assert.equal(acharProtocolo("embolia-pulmonar")!.versao, 1);
  assert.ok(aprovado(acharProtocolo("embolia-pulmonar")!));
  assert.equal(acharProtocolo("colapso-materno")!.versao, 2);
  assert.ok(aprovado(acharProtocolo("colapso-materno")!));
  for (const id of ["depressao-respiratoria-opioides", "hipotermia-perioperatoria"]) {
    assert.equal(acharProtocolo(id)!.versao, 2, id);
    assert.equal(acharProtocolo(id)!.revisadoEm, "2026-10-16", id);
    assert.equal(aprovado(acharProtocolo(id)!), false, id);
  }
  // Quem usa recebe só o aprovado, que nunca é rascunho.
  const liberados = PROTOCOLOS.filter((p) => aprovado(p));
  assert.ok(!liberados.some((p) => RASCUNHOS.includes(p)));
  // Nenhuma aprovação nova: as duas de antes, sem rascunho nelas.
  assert.equal(APROVACOES.length, 2);
  for (const r of RASCUNHOS) for (const a of APROVACOES) assert.notEqual(a.protocolos[r.id], r.versao, r.id);
});

test("embolia pulmonar (rascunho): classificação completa da diretriz e terapias avançadas por categoria", () => {
  const tep = rascunhoDe("embolia-pulmonar")!;
  const etapas = passosDe(tep, "adulto");
  assert.equal(etapas.length, 12);
  const classificacao = etapas[6];
  assert.match(classificacao.texto, /^Classifique a gravidade conforme a diretriz AHA\/ACC 2026/);
  for (const c of ["A: embolia pulmonar incidental e assintomática", "B1: sintomática, baixa gravidade clínica, subsegmentar",
    "B2: sintomática, baixa gravidade clínica, não subsegmentar", "C1: gravidade clínica elevada, ventrículo direito e biomarcadores normais",
    "C2: gravidade elevada, disfunção ventricular direita ou pelo menos um biomarcador anormal",
    "C3: gravidade elevada, disfunção ventricular direita e pelo menos um biomarcador anormal",
    "D1: falência cardiopulmonar incipiente com hipotensão transitória", "D2: falência incipiente com choque normotensivo",
    "E1: hipotensão recorrente ou persistente com choque cardiogênico", "E2: choque cardiogênico refratário ou parada cardíaca"]) {
    assert.ok(classificacao.detalhe!.includes(c), c);
  }
  assert.match(classificacao.detalhe!, /modificador respiratório/);
  assert.match(etapas[8].detalhe!, /razoáveis em E1 e podem ser consideradas em D1–D2.*em E2, seguir também as recomendações específicas para PCR/);
  assert.equal(tep.medicamentos.length, 0, "anticoagulação e trombólise seguem sem calculadora");
  assert.ok(acharReferencia("aha-acc-2026-tep")!.conferida);
});

test("colapso materno (rascunho): o mesmo magnésio da Eclâmpsia — 4 g em 15 min e 1 g/h, a 80 mg/mL", () => {
  const colapso = rascunhoDe("colapso-materno")!;
  // Ataque: 4 g a 80 mg/mL = 50 mL (200 mL/h por 15 minutos); a 50%, 8 mL.
  assert.deepEqual(conta(colapso, "magnesio-ataque", gestante), [[4, "g", 50, "mL"]]);
  assert.deepEqual(conta(colapso, "magnesio-ataque", gestante, 1), [[4, "g", 8, "mL"]]);
  assert.match(colapso.medicamentos.find((m) => m.id === "magnesio-ataque")!.velocidade!, /15 minutos.*200 mL\/h/);
  // Manutenção: 1 g/h a 80 mg/mL = 12,5 mL/h (a versão 2 tinha 1 a 2 g/h a 20 mg/mL).
  assert.deepEqual(conta(colapso, "magnesio-manutencao", gestante), [[1, "g", 12.5, "mL/h"]]);
  // Recorrência 2–4 g: 25–50 mL a 80 mg/mL.
  assert.deepEqual(conta(colapso, "magnesio-recorrencia", gestante).map((c) => c[2]), [25, 50]);
  assert.deepEqual(conta(colapso, "gluconato-intoxicacao-magnesio", gestante).map((c) => c[2]), [10]);
  for (const id of ["magnesio-ataque", "magnesio-manutencao", "magnesio-recorrencia"]) {
    assert.ok(colapso.medicamentos.find((m) => m.id === id)!.altoRisco, id);
  }
  // O mesmo esquema do cartão Eclâmpsia: dose, unidade e preparo.
  const eclampsia = acharProtocolo("eclampsia")!;
  const par = (p: Protocolo, id: string) => { const d = p.medicamentos.find((m) => m.id === id)!; return [d.dose, d.apresentacoes[0].rotulo]; };
  assert.deepEqual(par(colapso, "magnesio-ataque"), par(eclampsia, "magnesio-eclampsia-ataque"));
  assert.deepEqual(par(colapso, "magnesio-manutencao"), par(eclampsia, "magnesio-eclampsia-manutencao"));
  assert.ok(colapso.divergencias.some((d) => /magnésio/.test(d.tema) && /mesmo esquema do cartão Eclâmpsia/.test(d.escolha)));
});

test("naloxona (rascunho): pós-operatório do adulto começa em 0,04 mg, e o resto da tabela não muda", () => {
  const atual = acharProtocolo("depressao-respiratoria-opioides")!;
  const rascunho = rascunhoDe("depressao-respiratoria-opioides")!;
  // 0,04 mg: 1 mL da diluição de 0,04 mg/mL; 0,1 mL da ampola de 0,4 mg/mL.
  assert.deepEqual(conta(rascunho, "naloxona-posop-adulto", adulto), [[0.04, "mg", 1, "mL"]]);
  assert.deepEqual(conta(rascunho, "naloxona-posop-adulto", adulto, 1), [[0.04, "mg", 0.1, "mL"]]);
  assert.match(rascunho.medicamentos.find((m) => m.id === "naloxona-posop-adulto")!.cuidados!.join(" "), /A bula traz 0,1 a 0,2 mg/);
  for (const id of ["naloxona-grave-adulto", "naloxona-posop-ped", "naloxona-grave-ped", "naloxona-rn"]) {
    assert.deepEqual(rascunho.medicamentos.find((m) => m.id === id), atual.medicamentos.find((m) => m.id === id), id);
  }
  assert.match(rascunho.agirAgora.map((x) => x.texto).join(" "), /\(0,04 mg\) a cada 2 a 3 minutos/);
});

test("hipotermia (rascunho): as duas posições sobre choques abaixo de 30 °C, lado a lado", () => {
  const h = rascunhoDe("hipotermia-perioperatoria")!;
  const d = h.divergencias.find((x) => /30 °C/.test(x.tema))!;
  assert.deepEqual(d.posicoes.map((x) => x.referencia), ["wms-2019-hipotermia", "erc-2021-circunstancias"]);
  assert.match(d.posicoes[1].texto, /até 3 choques/);
  assert.equal(acharReferencia("erc-2021-circunstancias")!.conferida, false);
  // O passo continua com a WMS até a decisão.
  assert.deepEqual(h.agirAgora, acharProtocolo("hipotermia-perioperatoria")!.agirAgora);
});
