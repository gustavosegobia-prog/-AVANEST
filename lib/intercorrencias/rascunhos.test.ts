import test from "node:test";
import assert from "node:assert/strict";
import { acharProtocolo, PROTOCOLOS_DA_PREVIA, PROTOCOLOS_LIBERADOS, rascunhoDe } from "./catalogo.ts";
import { APROVACOES, aprovado } from "./aprovacao.ts";
import { calcularDose, passosDe, type PacienteDaConsulta } from "./calculo.ts";
import { acharReferencia } from "./referencias.ts";
import { RASCUNHOS } from "./protocolos/rascunhos.ts";
import type { Protocolo } from "./tipos.ts";

// Correção das pendências científicas (01/11/2026): as propostas entram como
// rascunho. Quem usa continua com a versão publicada; só a prévia do
// responsável médico abre o rascunho. Nenhuma aprovação em lote.

const adulto: PacienteDaConsulta = { idadeAnos: 40, pesoKg: 70 };
const conta = (p: Protocolo, id: string, pac: PacienteDaConsulta, apresentacao = 0) =>
  calcularDose(p.medicamentos.find((m) => m.id === id)!, p, pac, apresentacao).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume, c.unidadeVolume]);

test("rascunho: aprovado em 05/11/2026 na versão dele, e é ele que vai para quem usa", () => {
  assert.deepEqual(RASCUNHOS.map((r) => `${r.id} v${r.versao}`),
    ["embolia-pulmonar v2", "depressao-respiratoria-opioides v3", "hipotermia-perioperatoria v3",
      "ventilacao-mascara-dificil v3", "intubacao-dificil v3", "nao-ventilo-nao-intubo v3", "laringoespasmo v3",
      "pressao-vias-aereas v3", "broncoespasmo-grave v3", "broncoaspiracao v3",
      "bloqueio-neuroaxial-alto v3", "hemorragia-pos-parto v3", "colapso-materno v3", "reanimacao-neonatal v3",
      "toxicidade-anestesico-local v3", "hipercalemia v3", "hipertermia-maligna v3", "evento-sem-diagnostico v3",
      "depois-da-crise v3", "colega-afetado v3", "pcr-fv-tv v4", "sav-pediatrico v3",
      "isquemia-miocardica v4", "hemorragia-macica v4", "anafilaxia v3", "embolia-gasosa-venosa v4", "bradicardia v4",
      "hipoglicemia-grave v3", "crise-adrenal v3", "convulsao-perioperatoria v3", "delirio-ao-despertar v3", "eclampsia v3",
      "eclampsia v4", "embolia-amniotica v3", "bloqueio-neuromuscular-residual v3"]);
  // A única versão em validação: a Eclâmpsia 4 (magnésio pelo MS e pela RBEHG, 05/11/2026). Quem usa fica com a 3.
  const pendentes = RASCUNHOS.filter((r) => !aprovado(r)).map((r) => `${r.id} v${r.versao}`);
  assert.deepEqual(pendentes, ["eclampsia v4"]);
  for (const r of RASCUNHOS.filter((x) => aprovado(x))) {
    const publicado = acharProtocolo(r.id)!;
    assert.ok(publicado, r.id);
    assert.notEqual(publicado, r, `${r.id}: o catálogo publicado não pode ser o rascunho`);
    assert.ok(r.versao > publicado.versao, r.id);
    assert.ok(aprovado(r), `${r.id}: rascunho sem a aprovação de 05/11/2026`);
    assert.equal(PROTOCOLOS_LIBERADOS.find((p) => p.id === r.id), r, `${r.id}: quem usa recebe a versão aprovada`);
    // A prévia abre o rascunho mais novo: este, ou a versão seguinte em validação.
    assert.equal(PROTOCOLOS_DA_PREVIA.find((p) => p.id === r.id), rascunhoDe(r.id), r.id);
  }
  assert.equal(rascunhoDe("eclampsia")!.versao, 4);
  assert.equal(PROTOCOLOS_DA_PREVIA.find((p) => p.id === "eclampsia")!.versao, 4);
  assert.equal(PROTOCOLOS_LIBERADOS.find((p) => p.id === "eclampsia")!.versao, 3);
  // A versão publicada não mudou: aprovada continua aprovada; a que nunca foi aprovada segue sem aprovação —
  // quem usa recebe o rascunho aprovado no lugar dela.
  assert.equal(acharProtocolo("embolia-pulmonar")!.versao, 1);
  assert.ok(aprovado(acharProtocolo("embolia-pulmonar")!));
  assert.equal(acharProtocolo("colapso-materno")!.versao, 2);
  assert.ok(aprovado(acharProtocolo("colapso-materno")!));
  for (const id of ["depressao-respiratoria-opioides", "hipotermia-perioperatoria"]) {
    assert.equal(acharProtocolo(id)!.versao, 2, id);
    assert.equal(acharProtocolo(id)!.revisadoEm, "2026-10-16", id);
    assert.equal(aprovado(acharProtocolo(id)!), false, id);
  }
  // Quem usa recebe só o aprovado: desde 05/11/2026, todo rascunho, que foi aprovado na versão dele.
  assert.ok(PROTOCOLOS_LIBERADOS.every((p) => aprovado(p)));
  assert.equal(APROVACOES.length, 3);
  const terceira = APROVACOES[2];
  for (const r of RASCUNHOS.filter((x) => aprovado(x))) {
    assert.equal(terceira.protocolos[r.id], r.versao, `${r.id}: a aprovação de 05/11/2026 não cobre a versão do rascunho`);
    for (const a of APROVACOES.slice(0, 2)) assert.notEqual(a.protocolos[r.id], r.versao, `${r.id}: aprovado antes de 05/11`);
  }
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
