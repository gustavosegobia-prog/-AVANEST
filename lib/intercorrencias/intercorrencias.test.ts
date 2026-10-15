import test from "node:test";
import assert from "node:assert/strict";
import { acharProtocolo, buscar, CATEGORIAS, itensDaCategoria, PREVISTOS, PROTOCOLOS } from "./catalogo.ts";
import {
  calcularDose, calcularVolume, conferirPaciente, doseServe, passosDe, populacaoDe, type PacienteDaConsulta,
} from "./calculo.ts";
import { acharReferencia, REFERENCIAS } from "./referencias.ts";
import { APROVACOES, aprovacaoDe, aprovado } from "./aprovacao.ts";

const anafilaxia = acharProtocolo("anafilaxia")!;
const laringo = acharProtocolo("laringoespasmo")!;
const fvtv = acharProtocolo("pcr-fv-tv")!;
const aesp = acharProtocolo("pcr-aesp-assistolia")!;
const sav = acharProtocolo("sav-pediatrico")!;
const isquemia = acharProtocolo("isquemia-miocardica")!;
const hemorragia = acharProtocolo("hemorragia-macica")!;
const bronco = acharProtocolo("broncoespasmo-grave")!;
const dose = (p: typeof anafilaxia, id: string) => p.medicamentos.find((m) => m.id === id)!;
const adulto: PacienteDaConsulta = { idadeAnos: 40, pesoKg: 70 };
const crianca: PacienteDaConsulta = { idadeAnos: 4, pesoKg: 16 };

/** Os 15 cartões da minuta preliminar de outubro de 2026, ainda sem aprovação. */
const NOVOS = [
  "hipoglicemia-grave", "hipotermia-perioperatoria", "crise-adrenal", "convulsao-perioperatoria", "incendio-sala-cirurgica",
  "falha-oxigenio-energia", "delirio-ao-despertar", "bradicardia-pediatrica", "eclampsia", "embolia-amniotica",
  "via-aerea-dificil-gestante", "depressao-respiratoria-opioides", "bloqueio-neuromuscular-residual", "pneumotorax-hipertensivo",
  "intubacao-esofagica-seletiva",
];

test("todo protocolo tem as seis partes, e toda dose aponta para uma referência que existe", () => {
  for (const p of PROTOCOLOS) {
    for (const parte of ["reconhecer", "agirAgora", "pensarEm", "depois", "referencias"] as const) {
      assert.ok(p[parte].length > 0, `${p.id}: ${parte} vazio`);
    }
    const ids = new Set<string>();
    for (const m of p.medicamentos) {
      assert.ok(!ids.has(m.id), `${p.id}: id repetido ${m.id}`);
      ids.add(m.id);
      assert.ok(m.referencias.length > 0, `${m.id}: dose sem referência`);
      for (const r of m.referencias) assert.ok(acharReferencia(r), `${m.id}: referência ${r} não existe`);
      // Sem concentração presumida: toda apresentação tem rótulo. Sem nenhuma (o frasco
      // varia com o fabricante), a tela dá só a dose total — e alto risco não pode ser assim.
      assert.ok(m.apresentacoes.every((a) => a.rotulo.trim()), `${m.id}: apresentação sem rótulo`);
      if (m.apresentacoes.length === 0) assert.ok(!m.altoRisco, `${m.id}: alto risco sem apresentação`);
      if (m.par) assert.ok(p.medicamentos.some((x) => x.id === m.par), `${m.id}: par ${m.par} não existe`);
    }
    for (const v of p.volumes) {
      for (const r of v.referencias) assert.ok(acharReferencia(r), `${v.id}: ${r}`);
      assert.ok(v.referencias.length > 0 && (v.porKg || v.fixo), `${v.id}: sem conta ou sem fonte`);
    }
    for (const rel of p.relacionados ?? []) {
      assert.ok(acharProtocolo(rel.protocolo), `${p.id}: relacionado ${rel.protocolo} não existe`);
      assert.notEqual(rel.protocolo, p.id, `${p.id}: relacionado a si mesmo`);
    }
    for (const v of p.veja ?? []) {
      const alvo = acharProtocolo(v.protocolo);
      assert.ok(alvo, `${p.id}: veja ${v.protocolo} não existe`);
      assert.ok(v.quando.some((q) => alvo!.populacoes.includes(q)), `${p.id}: ${v.protocolo} não atende ${v.quando}`);
    }
    for (const d of p.divergencias) {
      // Uma posição só é a leitura duvidosa de uma fonte (erro de impressão), com a decisão do protocolo.
      assert.ok(d.posicoes.length >= 1 && d.escolha.trim(), `${p.id}: divergência vazia`);
      for (const pos of d.posicoes) assert.ok(acharReferencia(pos.referencia), `${p.id}: ${pos.referencia}`);
    }
    for (const r of p.referencias) assert.ok(acharReferencia(r), `${p.id}: ${r}`);
  }
});

test("referência conferida tem onde está o número; sem localização, não está conferida", () => {
  for (const r of Object.values(REFERENCIAS)) {
    if (r.conferida) assert.ok(r.localizacao, `${r.id}: conferida sem localização`);
    if (r.doi) assert.match(r.doi, /^10\.\d{4,}\//, r.id);
  }
});

test("a faixa sai da idade: recém-nascido, criança até 12 anos, adulto ou gestante", () => {
  assert.equal(populacaoDe({ idadeAnos: 0.02, pesoKg: 3 }), "neonatal");
  assert.equal(populacaoDe({ idadeAnos: 11.9, pesoKg: 40 }), "pediatrico");
  assert.equal(populacaoDe({ idadeAnos: 12, pesoKg: 45 }), "adulto");
  assert.equal(populacaoDe({ idadeAnos: 28, pesoKg: 70, gestante: true }), "gestante");
  assert.equal(populacaoDe({ idadeAnos: null, pesoKg: 70 }), null);
  // Adrenalina IM da criança: por idade, com o corte dos 6 anos.
  const menor = dose(anafilaxia, "adrenalina-im-ped-menor-6");
  const maior = dose(anafilaxia, "adrenalina-im-ped-6-12");
  assert.equal(doseServe(menor, "pediatrico", 5.9), true);
  assert.equal(doseServe(menor, "pediatrico", 6), false);
  assert.equal(doseServe(maior, "pediatrico", 6), true);
  assert.equal(doseServe(dose(anafilaxia, "adrenalina-im-adulto"), "gestante", 30), true);
});

test("alertas: apresentação errada para a via, peso estranho para a idade, dose da criança acima da do adulto", () => {
  // Trocar a apresentação do IM por uma IV diluída de propósito: a tela avisa.
  const im = { ...dose(anafilaxia, "adrenalina-iv-grave-adulto"), apresentacoes: [dose(anafilaxia, "adrenalina-im-adulto").apresentacoes[0]] };
  const errada = calcularDose(im, anafilaxia, adulto);
  assert.equal(errada.alertas[0].nivel, "perigo");
  assert.match(errada.alertas[0].texto, /é para IM.*Confira antes de aspirar/);
  // 70 kg com 3 anos: digitação errada.
  assert.ok(conferirPaciente({ idadeAnos: 3, pesoKg: 70 }).some((a) => a.nivel === "perigo"));
  assert.deepEqual(conferirPaciente(adulto), []);
  assert.ok(conferirPaciente({ idadeAnos: 40, pesoKg: 70, alturaCm: 1.7 }).some((a) => /cm, não metros/.test(a.texto)));
  // Criança com peso de adulto: 10 mcg/kg × 45 kg = 450 mcg, acima dos 100 mcg do adulto.
  const grande = calcularDose(dose(anafilaxia, "adrenalina-iv-grave-ped"), anafilaxia, { idadeAnos: 11, pesoKg: 45 });
  assert.ok(grande.alertas.some((a) => /passa da dose do adulto \(100 mcg\)/.test(a.texto)));
  // Criança de 16 kg: 2 mcg/kg = 32 mcg passa os 20 mcg do adulto, e é o que a fonte manda — sem alarme falso.
  const pequena = calcularDose(dose(anafilaxia, "adrenalina-iv-moderada-ped"), anafilaxia, crianca);
  assert.ok(!pequena.alertas.some((a) => /dose do adulto/.test(a.texto)));
  // A diferença entre adulto e criança aparece no cartão.
  assert.ok(grande.alertas.some((a) => /No adulto: 50–100 mcg/.test(a.texto)));
  // Nome parecido.
  assert.ok(grande.alertas.some((a) => /noradrenalina/.test(a.texto)));
});

test("busca pelo nome, pelo sinônimo e pelo sinal, sem acento; previstos aparecem como em preparação", () => {
  assert.equal((buscar("anafilaxia")[0] as { protocolo: { id: string } }).protocolo.id, "anafilaxia");
  assert.equal((buscar("choque anafilatico")[0] as { protocolo: { id: string } }).protocolo.id, "anafilaxia");
  const estridor = buscar("estridor");
  assert.equal(estridor[0].tipo === "protocolo" && estridor[0].protocolo.id, "laringoespasmo");
  assert.match(estridor[0].tipo === "protocolo" ? estridor[0].porque : "", /sinal|sinônimo/);
  assert.ok(buscar("urticaria").some((a) => a.tipo === "protocolo" && a.protocolo.id === "anafilaxia"));
  const tep = buscar("embolia pulmonar");
  assert.ok(tep.some((a) => a.tipo === "previsto" && a.previsto.titulo === "Embolia pulmonar"));
  assert.deepEqual(buscar("  "), []);
  // O laringoespasmo pediátrico previsto é coberto pelo protocolo único, que fica só em Respiratório.
  assert.ok(!itensDaCategoria("pediatria").prontos.some((p) => p.id === "laringoespasmo"));
  assert.ok(!itensDaCategoria("pediatria").previstos.some((p) => p.titulo === "Laringoespasmo pediátrico"));
  assert.ok(!itensDaCategoria("respiratorio").previstos.some((p) => p.titulo === "Laringoespasmo"));
  assert.equal(PREVISTOS.filter((p) => p.categoria === "cardiovascular").length, 10);
});

const acha = (id: string) => acharProtocolo(id)!;
const contas = (p: ReturnType<typeof acha>, id: string, pac: PacienteDaConsulta, i = 0) =>
  calcularDose(dose(p, id), p, pac, i).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume, c.unidadeVolume]);
const vol = (p: ReturnType<typeof acha>, id: string, pac: PacienteDaConsulta) => calcularVolume(p.volumes.find((v) => v.id === id)!, pac);

test("minuta de 15/10/2026: os 34 protocolos na versão 2, e toda seção de doses tem número ou nota", () => {
  const minuta = Object.keys(APROVACOES[0].protocolos);
  assert.equal(minuta.length, 34);
  for (const id of minuta) {
    assert.ok(acharProtocolo(id), id);
    assert.equal(acha(id).versao, 2, id);
  }
  for (const p of PROTOCOLOS) {
    assert.equal(p.atualizadoEm, "2026-10-15", p.id);
    assert.ok(p.medicamentos.length + p.volumes.length + (p.notasDeDose?.length ?? 0) > 0 || p.id === "bloqueio-neuroaxial-alto", `${p.id}: seção de doses vazia`);
  }
  // A bibliografia geral é a da minuta: o Manual e o Tratado SAESP.
  assert.equal(acharReferencia("saesp-tratado")!.ano, 2025);
  assert.match(acharReferencia("qrh-3-4")!.edicao ?? "", /versão 3/);
});

test("anafilaxia: bolus IV nas seringas de 10 e 20 mcg/mL, IM na ampola pura, infusão de referência", () => {
  // 10–20 mcg a 10 mcg/mL: 1 a 2 mL; a 20 mcg/mL: 0,5 a 1 mL.
  assert.deepEqual(contas(anafilaxia, "adrenalina-iv-moderada-adulto", adulto), [[10, "mcg", 1, "mL"], [20, "mcg", 2, "mL"]]);
  assert.deepEqual(contas(anafilaxia, "adrenalina-iv-moderada-adulto", adulto, 1).map((c) => c[2]), [0.5, 1]);
  assert.deepEqual(contas(anafilaxia, "adrenalina-iv-grave-adulto", adulto).map((c) => c[2]), [5, 10]);
  // Nenhum bolus IV oferece a ampola de 1 mg/mL.
  for (const m of anafilaxia.medicamentos.filter((x) => x.via === "IV")) {
    assert.ok(m.apresentacoes.every((a) => !(a.unidade === "mg" && a.quantidade === 1 && a.mL === 1)), m.id);
  }
  const im = calcularDose(dose(anafilaxia, "adrenalina-im-adulto"), anafilaxia, adulto);
  assert.deepEqual(im.contas.map((c) => [c.doseTotal, c.volume]), [[500, 0.5]]);
  assert.ok(!im.alertas.some((a) => a.nivel === "perigo"));
  // Infusão de referência: 3 mcg/min na de 60 mcg/mL = 3 mL/h, sem peso.
  assert.deepEqual(contas(anafilaxia, "adrenalina-infusao-adulto", { idadeAnos: 40, pesoKg: null }), [[3, "mcg", 3, "mL/h"]]);
  // Criança de 16 kg: 2 mcg/kg = 32 mcg (3,2 mL a 10 mcg/mL); risco de vida 4 a 10 mcg/kg; infusão 0,1 mcg/kg/min a 20 mcg/mL = 4,8 mL/h.
  assert.deepEqual(contas(anafilaxia, "adrenalina-iv-moderada-ped", crianca), [[32, "mcg", 3.2, "mL"]]);
  assert.deepEqual(contas(anafilaxia, "adrenalina-iv-grave-ped", crianca).map((c) => c[0]), [64, 160]);
  assert.deepEqual(contas(anafilaxia, "adrenalina-infusao-ped", crianca).map((c) => c[2]), [4.8]);
  assert.equal(calcularDose(dose(anafilaxia, "adrenalina-im-ped-menor-6"), anafilaxia, { idadeAnos: 3, pesoKg: null }).contas[0].volume, 0.15);
  assert.equal(calcularDose(dose(anafilaxia, "adrenalina-im-ped-6-12"), anafilaxia, { idadeAnos: 8, pesoKg: null }).contas[0].volume, 0.3);
  assert.equal(vol(anafilaxia, "cristaloide-ped", crianca).texto, "320 mL");
  assert.equal(vol(anafilaxia, "cristaloide-ped", { idadeAnos: 5, pesoKg: null }).bloqueio, "Informe o peso para calcular.");
  // A gestante tem o passo dela; o adulto não.
  assert.match(passosDe(anafilaxia, "gestante").map((x) => x.texto).join(" "), /colapso materno/);
  assert.doesNotMatch(passosDe(anafilaxia, "adulto").map((x) => x.texto).join(" "), /colapso materno/);
  assert.equal(passosDe(anafilaxia, null).length, anafilaxia.agirAgora.length);
});

test("PCR do adulto: adrenalina depois do 2º choque, amiodarona ou lidocaína depois do 3º, cálcio e bicarbonato fora da rotina", () => {
  assert.deepEqual(contas(fvtv, "adrenalina-pcr", adulto), [[1, "mg", 10, "mL"]]);
  assert.deepEqual(contas(fvtv, "adrenalina-pcr", adulto, 1).map((c) => c[2]), [1]);
  assert.deepEqual(contas(fvtv, "amiodarona-pcr-300", adulto).map((c) => c[2]), [6]);
  assert.deepEqual(contas(fvtv, "amiodarona-pcr-150", adulto).map((c) => c[2]), [3]);
  assert.deepEqual(contas(fvtv, "lidocaina-pcr", adulto).map((c) => [c[0], c[2]]), [[70, 3.5], [105, 5.25]]);
  assert.deepEqual(contas(fvtv, "lidocaina-pcr-2", adulto).map((c) => c[0]), [35, 52.5]);
  assert.deepEqual(fvtv.volumes.map((v) => calcularVolume(v, { idadeAnos: 40, pesoKg: null }).texto), ["120 a 200 J", "360 J"]);
  assert.ok(!fvtv.medicamentos.some((m) => /cálcio|bicarbonato|magnésio/i.test(m.farmaco)));
  assert.match(fvtv.notasDeDose!.join(" "), /não são rotina/);
  // Criança: nenhuma dose do adulto serve, e o atalho aponta o SAV pediátrico.
  assert.equal(fvtv.medicamentos.filter((d) => doseServe(d, "pediatrico", 4)).length, 0);
  assert.ok(fvtv.veja?.some((v) => v.protocolo === "sav-pediatrico" && /2 J\/kg/.test(v.texto)));
  assert.match(passosDe(fvtv, "gestante").map((x) => x.texto).join(" "), /parto ressuscitativo/);
  // AESP/assistolia: só adrenalina; atropina e marca-passo não são rotina.
  assert.deepEqual(aesp.medicamentos.map((m) => m.id), ["adrenalina-pcr-aesp"]);
  assert.match(aesp.notasDeDose!.join(" "), /Não indicar atropina nem marca-passo/);
  assert.deepEqual(fvtv.ritmos?.map((r) => [r.ritmo, r.chocavel]), [["fv", true], ["tv", true]]);
  assert.deepEqual(aesp.ritmos?.map((r) => [r.ritmo, r.chocavel]), [["aesp", false], ["assistolia", false]]);
  assert.equal(sav.ritmos?.length, 4);
});

test("SAV pediátrico (AHA 2025): choque 2 J/kg, depois 4 J/kg; adrenalina 10 mcg/kg até 1 mg; amiodarona 5 mg/kg até 300 e depois 150", () => {
  assert.deepEqual(contas(sav, "adrenalina-sav-ped", crianca), [[160, "mcg", 1.6, "mL"]]);
  const pesoErrado = calcularDose(dose(sav, "adrenalina-sav-ped"), sav, { idadeAnos: 8, pesoKg: 120 });
  assert.deepEqual(pesoErrado.contas.map((c) => [c.doseTotal, c.unidadeDose, c.limitada]), [[1000, "mcg", true]]);
  assert.ok(pesoErrado.alertas.some((a) => a.nivel === "perigo" && /Limitada ao máximo de 1 mg/.test(a.texto)));
  assert.deepEqual(contas(sav, "amiodarona-sav-ped", crianca).map((c) => [c[0], c[2]]), [[80, 1.6]]);
  assert.equal(calcularDose(dose(sav, "amiodarona-sav-ped"), sav, { idadeAnos: 11, pesoKg: 70 }).contas[0].doseTotal, 300);
  assert.equal(calcularDose(dose(sav, "amiodarona-sav-ped-2"), sav, { idadeAnos: 11, pesoKg: 70 }).contas[0].doseTotal, 150);
  assert.deepEqual(contas(sav, "lidocaina-sav-ped", crianca).map((c) => [c[0], c[2]]), [[16, 0.8]]);
  assert.equal(vol(sav, "choque-ped-1", crianca).texto, "32 J");
  assert.equal(vol(sav, "choque-ped-2", crianca).texto, "64 J");
  assert.equal(vol(sav, "choque-ped-seguintes", crianca).texto, "64 a 160 J");
  assert.equal(vol(sav, "choque-ped-seguintes", { idadeAnos: 11, pesoKg: 40 }).texto, "160 a 200 J");
  assert.ok(sav.divergencias.some((d) => d.posicoes.some((x) => x.referencia === "manual-03") && /choque/i.test(d.tema)));
  assert.ok(!sav.medicamentos.some((m) => /Atropina|cálcio|Bicarbonato/i.test(m.farmaco)));
});

test("reanimação neonatal (SBP 2026): adrenalina 20 mcg/kg na veia e 100 mcg/kg no tubo, SF 10 mL/kg", () => {
  const rnP: PacienteDaConsulta = { idadeAnos: 0, pesoKg: 3 };
  const rn = acha("reanimacao-neonatal");
  assert.deepEqual(contas(rn, "adrenalina-rn-iv", rnP).map((c) => [c[0], c[2]]), [[60, 0.6]]);
  const tubo = calcularDose(dose(rn, "adrenalina-rn-traqueal"), rn, rnP);
  assert.deepEqual(tubo.contas.map((c) => [c.doseTotal, c.volume]), [[300, 3]]);
  assert.ok(!tubo.alertas.some((a) => a.nivel === "perigo"), "a seringa de 0,1 mg/mL serve ao tubo");
  assert.equal(vol(rn, "sf-rn", rnP).texto, "30 mL");
  assert.ok(rn.referencias.includes("sbp-2026-rn"));
});

test("isquemia e crise hipertensiva: metoprolol 2,5 mg, nitroglicerina 5 mcg/min a 200 mcg/mL, esmolol e hidralazina", () => {
  assert.deepEqual(contas(isquemia, "metoprolol-isquemia", adulto), [[2.5, "mg", 2.5, "mL"]]);
  const ntg = calcularDose(dose(isquemia, "nitroglicerina-isquemia"), isquemia, { idadeAnos: 60, pesoKg: null });
  assert.equal(ntg.bloqueio, null);
  assert.deepEqual(ntg.contas.map((c) => [c.volume, c.unidadeVolume]), [[1.5, "mL/h"]]);
  assert.equal(isquemia.medicamentos.filter((d) => doseServe(d, "pediatrico", 6)).length, 0);
  assert.ok(isquemia.divergencias.some((d) => /Metas/.test(d.tema)));
  const has = acha("hipertensao");
  assert.deepEqual(contas(has, "esmolol-bolus-hipertensao", adulto), [[35, "mg", 3.5, "mL"]]);
  // 50 mcg/kg/min = 0,3 mL/kg/h na de 10 mg/mL: 21 mL/h para 70 kg.
  assert.deepEqual(contas(has, "esmolol-infusao-hipertensao", adulto).map((c) => [c[2], c[3]]), [[21, "mL/h"]]);
  assert.deepEqual(contas(has, "hidralazina-hipertensao", adulto).map((c) => c[2]), [5]);
  assert.match(has.notasDeDose!.join(" "), /formulário específico do serviço/);
});

test("hipotensão: efedrina, fenilefrina, noradrenalina em base e adrenalina de resgate; criança vai à bradicardia", () => {
  const hipo = acha("hipotensao");
  assert.deepEqual(contas(hipo, "efedrina-hipotensao", adulto).map((c) => c[2]), [0.6, 1.2]);
  assert.deepEqual(contas(hipo, "fenilefrina-hipotensao", adulto).map((c) => c[2]), [0.5, 1]);
  // 0,05 mcg/kg/min a 80 mcg/mL = 0,0375 mL/kg/h: 2,63 mL/h para 70 kg.
  assert.deepEqual(contas(hipo, "noradrenalina-hipotensao", adulto).map((c) => [c[2], c[3]]), [[2.63, "mL/h"]]);
  assert.match(dose(hipo, "noradrenalina-hipotensao").apresentacoes[0].rotulo, /base/);
  assert.deepEqual(contas(hipo, "adrenalina-bolus-hipotensao", adulto).map((c) => c[2]), [1, 2]);
  assert.ok(hipo.veja?.some((v) => v.protocolo === "bradicardia" && v.quando.includes("pediatrico")));
});

test("taquiarritmia: adenosina 6 e 12 mg (criança por kg com teto), magnésio, cardioversão pela energia da AHA", () => {
  const taqui = acha("taquiarritmia");
  assert.deepEqual(contas(taqui, "adenosina-6", adulto).map((c) => c[2]), [2]);
  assert.deepEqual(contas(taqui, "adenosina-12", adulto).map((c) => c[2]), [4]);
  assert.deepEqual(contas(taqui, "adenosina-ped-1", crianca).map((c) => [c[0], c[2]]), [[1.6, 0.53]]);
  assert.equal(calcularDose(dose(taqui, "adenosina-ped-1"), taqui, { idadeAnos: 11, pesoKg: 70 }).contas[0].doseTotal, 6);
  assert.equal(calcularDose(dose(taqui, "adenosina-ped-2"), taqui, { idadeAnos: 11, pesoKg: 70 }).contas[0].doseTotal, 12);
  assert.deepEqual(contas(taqui, "magnesio-torsades", adulto).map((c) => c[2]), [10, 20]);
  assert.deepEqual(contas(taqui, "magnesio-torsades-ped", crianca).map((c) => [c[0], c[2]]), [[800, 8]]);
  assert.equal(vol(taqui, "cardioversao-fa", adulto).texto, "200 J");
  assert.equal(vol(taqui, "cardioversao-estreita", adulto).texto, "100 J");
  assert.equal(vol(taqui, "cardioversao-ped", crianca).texto, "8 a 16 J");
  assert.equal(vol(taqui, "cardioversao-ped-2", crianca).texto, "32 J");
  assert.match(taqui.agirAgora.map((x) => `${x.texto} ${x.detalhe ?? ""}`).join(" "), /pré-excitada: não administrar amiodarona/);
});

test("bradicardia: atropina 1 mg no adulto; na criança 0,02 mg/kg com mínimo de 0,1 e máximo de 0,5 mg; adrenalina 10 mcg/kg", () => {
  const bradi = acha("bradicardia");
  assert.deepEqual(contas(bradi, "atropina-bradicardia-adulto", adulto), [[1, "mg", 2, "mL"]]);
  assert.deepEqual(contas(bradi, "adrenalina-infusao-bradicardia", { idadeAnos: 50, pesoKg: null }).map((c) => c[2]), [2, 10]);
  const dopa = calcularDose(dose(bradi, "dopamina-bradicardia"), bradi, adulto);
  assert.deepEqual(dopa.contas.map((c) => [c.doseTotal, c.volume]), [[350, undefined], [1400, undefined]]);
  assert.deepEqual(contas(bradi, "adrenalina-bradicardia-ped", crianca).map((c) => [c[0], c[2]]), [[160, 1.6]]);
  assert.deepEqual(contas(bradi, "atropina-bradicardia-ped", crianca).map((c) => [c[0], c[2]]), [[0.32, 1.28]]);
  // Lactente de 3 kg: 0,06 mg pelo peso sobe ao mínimo de 0,1 mg (0,4 mL), com aviso.
  const pequeno = calcularDose(dose(bradi, "atropina-bradicardia-ped"), bradi, { idadeAnos: 0.3, pesoKg: 3 });
  assert.deepEqual(pequeno.contas.map((c) => [c.doseTotal, c.volume]), [[0.1, 0.4]]);
  assert.ok(pequeno.alertas.some((a) => /Elevada ao mínimo de 0,1 mg/.test(a.texto)));
  assert.equal(calcularDose(dose(bradi, "atropina-bradicardia-ped"), bradi, { idadeAnos: 11, pesoKg: 40 }).contas[0].doseTotal, 0.5);
  // O passo do adulto é do adulto; o da criança, da criança.
  assert.doesNotMatch(passosDe(bradi, "pediatrico").map((x) => x.texto).join(" "), /Adulto com pulso/);
  assert.match(passosDe(bradi, "pediatrico").map((x) => x.texto).join(" "), /Criança com FC abaixo de 60/);
  assert.match(bradi.notasDeDose!.join(" "), /Não usar 1 mcg\/kg/);
});

test("laringoespasmo e broncoespasmo: doses por kg, IM sem IO, salbutamol IV do QRH 2023 com tetos", () => {
  assert.deepEqual(contas(laringo, "propofol-laringoespasmo", crianca).map((c) => [c[0], c[2]]), [[4, 0.4], [8, 0.8]]);
  assert.deepEqual(contas(laringo, "succinilcolina-iv-laringoespasmo", crianca).map((c) => [c[0], c[2]]), [[4, 0.4], [8, 0.8]]);
  assert.deepEqual(contas(laringo, "succinilcolina-im-laringoespasmo", crianca).map((c) => [c[0], c[2]]), [[64, 1.28]]);
  assert.ok(dose(laringo, "succinilcolina-im-laringoespasmo").cuidados?.some((c) => /via IO/.test(c)));
  assert.ok(!laringo.medicamentos.some((m) => m.farmaco === "Atropina"));
  assert.ok(laringo.relacionados?.some((r) => r.protocolo === "bradicardia"));
  const rn: PacienteDaConsulta = { idadeAnos: 0.02, pesoKg: 3 };
  assert.ok(calcularDose(dose(laringo, "propofol-laringoespasmo"), laringo, rn).alertas.some((a) => /menor que 0,1 mL/.test(a.texto)));

  assert.deepEqual(contas(bronco, "salbutamol-neb-adulto", adulto).map((c) => c[2]), [1]);
  assert.equal(doseServe(dose(bronco, "salbutamol-neb-ped"), "pediatrico", 4), true);
  assert.equal(doseServe(dose(bronco, "salbutamol-neb-ped"), "pediatrico", 6), false);
  assert.equal(doseServe(dose(bronco, "ipratropio-ped"), "pediatrico", 1), false);
  assert.deepEqual(contas(bronco, "salbutamol-iv-adulto", adulto).map((c) => c[2]), [5]);
  assert.deepEqual(contas(bronco, "salbutamol-iv-lactente", { idadeAnos: 1, pesoKg: 10 }).map((c) => [c[0], c[2]]), [[50, 1]]);
  assert.deepEqual(contas(bronco, "salbutamol-iv-crianca", crianca).map((c) => [c[0], c[2]]), [[240, 4.8]]);
  assert.equal(calcularDose(dose(bronco, "salbutamol-iv-crianca"), bronco, { idadeAnos: 11, pesoKg: 30 }).contas[0].doseTotal, 250);
  assert.deepEqual(contas(bronco, "salbutamol-infusao-adulto", { idadeAnos: 40, pesoKg: null }).map((c) => [c[2], c[3]]), [[6, "mL/h"], [24, "mL/h"]]);
  // 0,5 a 1 mcg/kg/min: 30 kg daria 15 a 30 mcg/min; o máximo de 20 mcg/min segura (24 mL/h).
  assert.deepEqual(contas(bronco, "salbutamol-infusao-ped", { idadeAnos: 11, pesoKg: 30 }).map((c) => [c[0], c[2]]), [[15, 18], [20, 24]]);
  assert.deepEqual(contas(bronco, "magnesio-broncoespasmo-adulto", adulto).map((c) => c[2]), [20]);
  assert.deepEqual(contas(bronco, "magnesio-broncoespasmo-ped", { idadeAnos: 11, pesoKg: 50 }).map((c) => [c[0], c[2]]), [[2000, 20]]);
  const hc = calcularDose(dose(bronco, "hidrocortisona-ped"), bronco, crianca);
  assert.deepEqual(hc.contas.map((c) => [c.doseTotal, c.volume]), [[64, undefined]]);
  assert.ok(bronco.divergencias.some((d) => /criança/.test(d.tema) && d.posicoes.some((x) => x.referencia === "qrh-3-4")));
});

test("hemorragia maciça: cálcio, tranexâmico do trauma, plasma por kg; plaquetas e fibrinogênio nas notas", () => {
  assert.deepEqual(contas(hemorragia, "cloreto-de-calcio-hemorragia-adulto", adulto).map((c) => c[2]), [10]);
  assert.deepEqual(contas(hemorragia, "cloreto-de-calcio-hemorragia-ped", crianca).map((c) => [c[0], c[2]]), [[320, 3.2]]);
  assert.deepEqual(contas(hemorragia, "tranexamico-trauma-bolus", adulto).map((c) => [c[0], c[1], c[2]]), [[1, "g", 20]]);
  assert.equal(vol(hemorragia, "plasma", crianca).texto, "240 mL");
  assert.match(hemorragia.notasDeDose!.join(" "), /não usar 15 a 20 mL\/kg como padrão adulto/);
  assert.ok(hemorragia.divergencias.some((d) => /tranexâmico/.test(d.tema) && /1 mg/.test(d.posicoes[0].texto)));
  assert.ok(hemorragia.veja?.some((v) => v.protocolo === "hemorragia-pos-parto"));
});

test("anestésico local, hipercalemia e hipertermia maligna: lipídio em mL/kg com tetos, cálcio e insulina, dantroleno em frascos", () => {
  const last = acha("toxicidade-anestesico-local");
  assert.equal(vol(last, "lipidio-bolus", crianca).texto, "24 mL");
  assert.equal(vol(last, "lipidio-bolus", { idadeAnos: 40, pesoKg: 80 }).texto, "100 mL");
  assert.equal(vol(last, "lipidio-infusao", crianca).texto, "240 mL/h");
  assert.equal(vol(last, "lipidio-infusao", crianca).base, "15 mL/kg/h");
  assert.equal(vol(last, "lipidio-teto-ped", crianca).texto, "160 mL");
  assert.equal(vol(last, "lipidio-teto-adulto", adulto).texto, "840 mL");
  assert.deepEqual(contas(last, "adrenalina-last", adulto).map((c) => [c[0], c[2]]), [[70, 7]]);
  assert.deepEqual(contas(last, "midazolam-last", crianca).map((c) => [c[0], c[2]]), [[0.8, 0.8]]);
  assert.ok(last.divergencias.some((d) => /lipídica/.test(d.tema) && d.posicoes.some((x) => x.referencia === "saesp-tratado")));

  const hk = acha("hipercalemia");
  assert.deepEqual(contas(hk, "cloreto-de-calcio-hipercalemia", adulto).map((c) => c[2]), [10]);
  assert.deepEqual(contas(hk, "gluconato-hipercalemia", adulto).map((c) => c[2]), [30]);
  assert.deepEqual(contas(hk, "cloreto-de-calcio-hipercalemia-ped", crianca).map((c) => [c[0], c[2]]), [[320, 3.2]]);
  assert.equal(calcularDose(dose(hk, "cloreto-de-calcio-hipercalemia-ped"), hk, { idadeAnos: 11, pesoKg: 60 }).contas[0].doseTotal, 1000);
  assert.deepEqual(contas(hk, "gluconato-hipercalemia-ped", crianca).map((c) => c[2]), [16]);
  assert.deepEqual(contas(hk, "insulina-hipercalemia", adulto), [[10, "UI", 10, "mL"]]);
  assert.deepEqual(contas(hk, "insulina-hipercalemia-ped", crianca).map((c) => [c[0], c[2]]), [[1.6, 1.6]]);
  assert.deepEqual(contas(hk, "glicose-hipercalemia", adulto), [[25, "g", 50, "mL"]]);
  // Criança: 0,5 g/kg a 10% = 5 mL/kg; com 60 kg, o teto de 25 g.
  assert.deepEqual(contas(hk, "glicose-hipercalemia-ped", crianca).map((c) => [c[0], c[2]]), [[8, 80]]);
  assert.equal(calcularDose(dose(hk, "glicose-hipercalemia-ped"), hk, { idadeAnos: 11, pesoKg: 60 }).contas[0].doseTotal, 25);
  assert.deepEqual(contas(hk, "salbutamol-hipercalemia", adulto).map((c) => c[2]), [2, 4]);

  const hm = acha("hipertermia-maligna");
  const p72: PacienteDaConsulta = { idadeAnos: 45, pesoKg: 72 };
  assert.deepEqual(contas(hm, "dantroleno-inicial", p72).map((c) => [c[0], c[2]]), [[180, 540]]);
  assert.deepEqual(contas(hm, "dantroleno-inicial", p72, 1).map((c) => c[2]), [3.6]);
  assert.deepEqual(contas(hm, "dantroleno-manutencao", p72).map((c) => [c[0], c[2]]), [[72, 216]]);
});

test("obstetrícia: raqui alta, HPP sem bolus universal de ocitocina, magnésio da eclâmpsia em bomba", () => {
  const raqui = acha("bloqueio-neuroaxial-alto");
  assert.deepEqual(contas(raqui, "atropina-raqui", adulto).map((c) => c[2]), [2]);
  assert.deepEqual(contas(raqui, "efedrina-raqui", adulto).map((c) => c[2]), [1.2]);
  assert.deepEqual(contas(raqui, "adrenalina-raqui", adulto).map((c) => c[2]), [1, 2]);
  assert.match(passosDe(raqui, "gestante").map((x) => x.texto).join(" "), /compressão aortocava/);
  assert.doesNotMatch(passosDe(raqui, "adulto").map((x) => x.texto).join(" "), /compressão aortocava/);

  const hpp = acha("hemorragia-pos-parto");
  const gestante: PacienteDaConsulta = { idadeAnos: 30, pesoKg: 70, gestante: true };
  assert.deepEqual(contas(hpp, "metilergometrina-hpp", gestante).map((c) => c[2]), [1]);
  assert.deepEqual(contas(hpp, "tranexamico-hpp", gestante).map((c) => c[2]), [20]);
  assert.equal(dose(hpp, "misoprostol-hpp").semVolume, "Em comprimidos de 200 mcg: 4 comprimidos");
  assert.ok(!hpp.medicamentos.some((m) => m.farmaco === "Ocitocina"), "o regime de tratamento é do serviço");
  assert.match(hpp.notasDeDose!.join(" "), /homologar com a obstetrícia/);

  const colapso = acha("colapso-materno");
  assert.deepEqual(contas(colapso, "magnesio-ataque", gestante).map((c) => c[2]), [8]);
  // 1 a 2 g/h na de 20 mg/mL: 50 a 100 mL/h.
  assert.deepEqual(contas(colapso, "magnesio-manutencao", gestante).map((c) => [c[2], c[3]]), [[50, "mL/h"], [100, "mL/h"]]);
  assert.deepEqual(contas(colapso, "gluconato-intoxicacao-magnesio", gestante).map((c) => c[2]), [10]);
  assert.ok(colapso.divergencias.some((d) => /magnésio/.test(d.tema)));
});

test("listas e cartões sem fármaco: a seção de doses traz a nota, e os 10 Ts estão inteiros", () => {
  for (const id of ["dessaturacao", "aumento-etco2", "diminuicao-etco2", "evento-sem-diagnostico", "depois-da-crise", "colega-afetado",
    "verificacao-aparelho", "verificacao-pre-inducao", "intubacao-dificil", "nao-ventilo-nao-intubo", "pressao-vias-aereas",
    "broncoaspiracao", "embolia-gasosa-venosa", "reacao-hemolitica-transfusional"]) {
    const p = acha(id);
    assert.equal(p.medicamentos.length, 0, id);
    assert.ok((p.notasDeDose?.length ?? 0) > 0, `${id}: sem nota de dose`);
  }
  assert.equal(itensDaCategoria("apoio").prontos.length, 5);
  assert.equal(acha("evento-sem-diagnostico").agirAgora.length, 11);
  const ids = (q: string) => buscar(q).flatMap((a) => (a.tipo === "protocolo" ? [a.protocolo.id] : []));
  assert.equal(ids("10 Ts")[0], "evento-sem-diagnostico");
  assert.ok(ids("EtCO2 caindo").includes("diminuicao-etco2"));
  assert.ok(acha("verificacao-aparelho").divergencias.some((d) => /kPa/.test(d.posicoes[0].texto)));
  for (const t of ["Bradicardia grave", "Taquiarritmia instável", "Hipotensão grave", "Crise hipertensiva"]) {
    assert.ok(!itensDaCategoria("cardiovascular").previstos.some((p) => p.titulo === t), t);
  }
});

test("catálogo: os protocolos do Manual entram nas categorias e saem dos previstos; a busca acha pelo que se vê", () => {
  const cardio = itensDaCategoria("cardiovascular");
  for (const id of ["pcr-fv-tv", "pcr-aesp-assistolia", "isquemia-miocardica", "hemorragia-macica"]) {
    assert.ok(cardio.prontos.some((p) => p.id === id), id);
  }
  for (const t of ["PCR — FV/TV sem pulso", "PCR — AESP/assistolia", "Isquemia miocárdica intraoperatória", "Hemorragia maciça"]) {
    assert.ok(!cardio.previstos.some((p) => p.titulo === t), t);
  }
  assert.ok(itensDaCategoria("pediatria").prontos.some((p) => p.id === "sav-pediatrico"));
  assert.ok(!itensDaCategoria("pediatria").previstos.some((p) => p.titulo === "Suporte avançado de vida pediátrico"));
  const ids = (q: string) => buscar(q).flatMap((a) => (a.tipo === "protocolo" ? [a.protocolo.id] : []));
  assert.equal(ids("FV")[0], "pcr-fv-tv");
  for (const id of ["pcr-fv-tv", "pcr-aesp-assistolia", "sav-pediatrico"]) assert.ok(ids("parada").includes(id), id);
  assert.equal(ids("supra de ST")[0], "isquemia-miocardica");
  assert.ok(ids("sangramento").includes("hemorragia-macica"));
});

test("sem revisão científica: todo protocolo pronto abre para quem usa, e nada fala em revisor", async () => {
  const { existsSync, readFileSync } = await import("node:fs");
  const ler = (c: string) => readFileSync(new URL(`../../${c}`, import.meta.url), "utf8");
  const tela = ler("components/intercorrencias/intercorrencias.tsx");
  // Nenhum item do índice, da busca ou dos favoritos fica travado.
  assert.doesNotMatch(tela, /disabled=\{!disponivel/);
  assert.doesNotMatch(tela, /em revisão/i);
  assert.doesNotMatch(ler("components/intercorrencias/protocolo.tsx"), /Prévia para revisão/);
  // A migração do histórico de revisão nunca foi aplicada e saiu do repositório.
  assert.ok(!existsSync(new URL("../../supabase/migrations/202610150001_intercorrencias_anestesicas.sql", import.meta.url)));
  // As notas de divergência, que o médico lê, dizem o que o protocolo faz, sem "o revisor decide".
  for (const p of PROTOCOLOS) {
    for (const d of p.divergencias) assert.doesNotMatch(d.escolha, /revisor/i, `${p.id}: ${d.tema}`);
  }
});

test("aprovação médica registrada: nome, CRM e data, protocolo por protocolo e versão por versão", () => {
  const [primeira] = APROVACOES;
  assert.equal(primeira.responsavel, "Gustavo Segobia da Silva");
  assert.equal(primeira.crm, "CRM 49131");
  assert.equal(primeira.data, "2026-10-15");
  // Os 34 cartões da minuta de 15/10/2026 continuam aprovados na versão 2. Mudou o conteúdo de um deles?
  // Sobe a versão, e este teste lembra de registrar a nova aprovação.
  for (const id of Object.keys(primeira.protocolos)) {
    const p = acha(id);
    assert.equal(aprovacaoDe(p), primeira, `${p.id}: versão ${p.versao} de ${p.atualizadoEm} sem aprovação registrada`);
  }
  // A aprovação não se estende sozinha a uma versão nova nem a um protocolo novo.
  assert.equal(aprovado({ ...fvtv, versao: 3 }), false);
  assert.equal(aprovado({ ...fvtv, atualizadoEm: "2026-11-01" }), false);
  for (const id of NOVOS) assert.equal(aprovado(acha(id)), false, id);
  // A tela marca os sem aprovação na lista e diz quantos são no rodapé.
  assert.equal(PROTOCOLOS.filter((p) => !aprovado(p)).length, 15);
});


test("minuta preliminar de outubro de 2026: os 15 cartões entram na versão 1 e tiram os previstos do índice", () => {
  assert.equal(PROTOCOLOS.length, 49);
  for (const id of NOVOS) {
    const p = acha(id);
    assert.equal(p.versao, 1, id);
    assert.ok(p.referencias.includes("saesp-tratado"), `${id}: sem o Tratado SAESP`);
  }
  // Só a embolia pulmonar continua em preparação.
  const previstos = CATEGORIAS.flatMap((c) => itensDaCategoria(c.id).previstos.map((x) => x.titulo));
  assert.deepEqual(previstos, ["Embolia pulmonar"]);
  const ids = (q: string) => buscar(q).flatMap((a) => (a.tipo === "protocolo" ? [a.protocolo.id] : []));
  assert.equal(ids("naloxona")[0], "depressao-respiratoria-opioides");
  assert.equal(ids("TOF")[0], "bloqueio-neuromuscular-residual");
  assert.equal(ids("fogo")[0], "incendio-sala-cirurgica");
  assert.equal(ids("eclampsia")[0], "eclampsia");
  assert.equal(ids("tubo no esofago")[0], "intubacao-esofagica-seletiva");
  assert.ok(ids("hidrocortisona").includes("crise-adrenal"));
  assert.ok(ids("bradicardia").includes("bradicardia-pediatrica"));
});

test("hipoglicemia, crise adrenal e convulsão: glicose 10%, hidrocortisona por faixa de idade, benzodiazepínico e levetiracetam com teto", () => {
  const hipo = acha("hipoglicemia-grave");
  // 15 a 25 g de glicose 10%: 150 a 250 mL. Criança: 0,2 g/kg = 2 mL/kg.
  assert.deepEqual(contas(hipo, "glicose-hipoglicemia-adulto", adulto).map((c) => [c[0], c[2]]), [[15, 150], [25, 250]]);
  assert.deepEqual(contas(hipo, "glicose-hipoglicemia-ped", crianca).map((c) => [c[0], c[1], c[2]]), [[3.2, "g", 32]]);
  assert.ok(hipo.notasDeDose?.some((n) => /glucagon IM/.test(n)));

  const adrenal = acha("crise-adrenal");
  const inicial = (idade: number) => adrenal.medicamentos
    .filter((d) => d.populacao === "pediatrico" && doseServe(d, "pediatrico", idade)).map((d) => d.dose.usual);
  assert.deepEqual(inicial(0.5), [25]);
  assert.deepEqual(inicial(3), [50]);
  assert.deepEqual(inicial(5.9), [50]);
  assert.deepEqual(inicial(6), [100]);
  assert.deepEqual(contas(adrenal, "hidrocortisona-crise-adulto", adulto).map((c) => [c[0], c[1], c[2]]), [[100, "mg", undefined]]);
  assert.match(dose(adrenal, "hidrocortisona-crise-infusao").velocidade ?? "", /24 horas/);
  assert.ok(adrenal.notasDeDose?.some((n) => /estresse/.test(n)));

  const conv = acha("convulsao-perioperatoria");
  // Lorazepam 0,1 mg/kg até 4 mg; sem apresentação no Brasil, a caixa diz o que usar.
  assert.equal(calcularDose(dose(conv, "lorazepam-convulsao"), conv, crianca).contas[0].doseTotal, 1.6);
  assert.equal(calcularDose(dose(conv, "lorazepam-convulsao"), conv, adulto).contas[0].doseTotal, 4);
  assert.match(dose(conv, "lorazepam-convulsao").semVolume ?? "", /midazolam IM ou diazepam IV/);
  // Diazepam 0,15–0,2 mg/kg até 10 mg, a 5 mg/mL.
  assert.deepEqual(contas(conv, "diazepam-convulsao", crianca).map((c) => [c[0], c[2]]), [[2.4, 0.48], [3.2, 0.64]]);
  assert.deepEqual(contas(conv, "diazepam-convulsao", adulto).map((c) => [c[0], c[2]]), [[10, 2], [10, 2]]);
  assert.deepEqual(contas(conv, "midazolam-im-convulsao-adulto", adulto).map((c) => [c[0], c[2]]), [[10, 2]]);
  assert.deepEqual(contas(conv, "midazolam-im-convulsao-ped", crianca).map((c) => [c[0], c[2]]), [[5, 1]]);
  // Levetiracetam 60 mg/kg até 4.500 mg.
  assert.deepEqual(contas(conv, "levetiracetam-convulsao", adulto).map((c) => [c[0], c[2]]), [[4200, 42]]);
  assert.deepEqual(contas(conv, "levetiracetam-convulsao", { idadeAnos: 40, pesoKg: 90 }).map((c) => [c[0], c[2]]), [[4500, 45]]);
});

test("bradicardia pediátrica: adrenalina 0,1 mL/kg da solução a 0,1 mg/mL e atropina com mínimo de 0,1 e máximo de 0,5 mg", () => {
  const bradi = acha("bradicardia-pediatrica");
  assert.deepEqual(contas(bradi, "adrenalina-bradi-ped", crianca).map((c) => [c[0], c[1], c[2]]), [[160, "mcg", 1.6]]);
  assert.equal(calcularDose(dose(bradi, "adrenalina-bradi-ped"), bradi, { idadeAnos: 11, pesoKg: 120 }).contas[0].doseTotal, 1000);
  const pequeno = calcularDose(dose(bradi, "atropina-bradi-ped"), bradi, { idadeAnos: 0.3, pesoKg: 3 });
  assert.equal(pequeno.contas[0].doseTotal, 0.1);
  assert.equal(calcularDose(dose(bradi, "atropina-bradi-ped"), bradi, { idadeAnos: 11, pesoKg: 40 }).contas[0].doseTotal, 0.5);
  // Adulto ou recém-nascido na sala de parto: o protocolo certo para a faixa.
  assert.ok(bradi.veja?.some((v) => v.protocolo === "bradicardia" && v.quando.includes("adulto")));
  assert.ok(bradi.veja?.some((v) => v.protocolo === "reanimacao-neonatal" && v.quando.includes("neonatal")));
});

test("eclâmpsia: 4 g de ataque (8 mL a 50%), 1 g/h no preparo SAESP de 124 mL, cálcio na intoxicação e a divergência com o colapso materno", () => {
  const ecl = acha("eclampsia");
  const gestante: PacienteDaConsulta = { idadeAnos: 28, pesoKg: 70, gestante: true };
  assert.deepEqual(contas(ecl, "magnesio-eclampsia-ataque", gestante), [[4, "g", 8, "mL"]]);
  assert.match(dose(ecl, "magnesio-eclampsia-ataque").velocidade ?? "", /10 a 20 minutos/);
  // 12 g em 124 mL: 1 g/h = 10,33 mL/h.
  assert.deepEqual(contas(ecl, "magnesio-eclampsia-manutencao", gestante), [[1, "g", 10.33, "mL/h"]]);
  assert.deepEqual(contas(ecl, "magnesio-eclampsia-recorrencia", gestante), [[2, "g", 4, "mL"]]);
  assert.deepEqual(contas(ecl, "gluconato-eclampsia", gestante), [[1, "g", 10, "mL"]]);
  assert.ok(ecl.divergencias.some((d) => /Colapso materno/.test(d.escolha)));
});

test("opioides e bloqueio residual: naloxona 0,04 mg titulada, sugamadex 2, 4 e 16 mg/kg, neostigmina sem número", () => {
  const op = acha("depressao-respiratoria-opioides");
  // 0,04 mg: 1 mL da diluída a 0,04 mg/mL ou 0,1 mL da ampola de 0,4 mg/mL.
  assert.deepEqual(contas(op, "naloxona-opioides-adulto", adulto, 0), [[0.04, "mg", 1, "mL"]]);
  assert.deepEqual(contas(op, "naloxona-opioides-adulto", adulto, 1), [[0.04, "mg", 0.1, "mL"]]);
  assert.ok(dose(op, "naloxona-opioides-adulto").altoRisco);

  const bnm = acha("bloqueio-neuromuscular-residual");
  assert.deepEqual(contas(bnm, "sugamadex-bnm-t2", adulto).map((c) => [c[0], c[2]]), [[140, 1.4]]);
  assert.deepEqual(contas(bnm, "sugamadex-bnm-ptc", adulto).map((c) => [c[0], c[2]]), [[280, 2.8]]);
  assert.deepEqual(contas(bnm, "sugamadex-bnm-imediata", adulto).map((c) => [c[0], c[2]]), [[1120, 11.2]]);
  assert.equal(doseServe(dose(bnm, "sugamadex-bnm-imediata"), "pediatrico", 4), false);
  assert.ok(!bnm.medicamentos.some((d) => d.farmaco === "Neostigmina"));
  assert.ok(bnm.notasDeDose?.some((n) => /benzilisoquinol/.test(n)));
});
