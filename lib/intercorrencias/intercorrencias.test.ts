import test from "node:test";
import assert from "node:assert/strict";
import { acharProtocolo, buscar, itensDaCategoria, PREVISTOS, PROTOCOLOS } from "./catalogo.ts";
import {
  calcularDose, calcularVolume, conferirPaciente, doseServe, passosDe, populacaoDe, volumeServe, type PacienteDaConsulta,
} from "./calculo.ts";
import { acharReferencia, REFERENCIAS } from "./referencias.ts";
import { assinatura, resolverEstado, type RegistroDeRevisao } from "./situacao.ts";

const anafilaxia = acharProtocolo("anafilaxia")!;
const laringo = acharProtocolo("laringoespasmo")!;
const fvtv = acharProtocolo("pcr-fv-tv")!;
const aesp = acharProtocolo("pcr-aesp-assistolia")!;
const sav = acharProtocolo("sav-pediatrico")!;
const isquemia = acharProtocolo("isquemia-miocardica")!;
const hemorragia = acharProtocolo("hemorragia-macica")!;
const transfusional = acharProtocolo("reacao-hemolitica-transfusional")!;
const embolia = acharProtocolo("embolia-gasosa-venosa")!;
const bronco = acharProtocolo("broncoespasmo-grave")!;
const dose = (p: typeof anafilaxia, id: string) => p.medicamentos.find((m) => m.id === id)!;
const adulto: PacienteDaConsulta = { idadeAnos: 40, pesoKg: 70 };
const crianca: PacienteDaConsulta = { idadeAnos: 4, pesoKg: 16 };

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

test("adrenalina no adulto: mcg na seringa diluída, e a ampola pura só no IM", () => {
  // 50–100 mcg na solução de 100 mcg/mL: 0,5 a 1 mL.
  const grave = calcularDose(dose(anafilaxia, "adrenalina-iv-grave-adulto"), anafilaxia, adulto, 0);
  assert.deepEqual(grave.contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume, c.unidadeVolume]), [[50, "mcg", 0.5, "mL"], [100, "mcg", 1, "mL"]]);
  // A mesma dose na de 10 mcg/mL: 5 a 10 mL.
  assert.deepEqual(calcularDose(dose(anafilaxia, "adrenalina-iv-grave-adulto"), anafilaxia, adulto, 1).contas.map((c) => c.volume), [5, 10]);
  // IM: 500 mcg da ampola de 1 mg/mL = 0,5 mL (mcg convertido para mg uma vez só).
  const im = calcularDose(dose(anafilaxia, "adrenalina-im-adulto"), anafilaxia, adulto);
  assert.deepEqual(im.contas.map((c) => [c.doseTotal, c.volume]), [[500, 0.5]]);
  assert.ok(!im.alertas.some((a) => a.nivel === "perigo"));
  // Infusão: 3 a 40 mcg/min em 3 mg/50 mL (60 mcg/mL) = 3 a 40 mL/h, sem peso.
  const inf = calcularDose(dose(anafilaxia, "adrenalina-infusao-adulto"), anafilaxia, { idadeAnos: 40, pesoKg: null });
  assert.equal(inf.bloqueio, null);
  assert.deepEqual(inf.contas.map((c) => [c.volume, c.unidadeVolume]), [[3, "mL/h"], [40, "mL/h"]]);
});

test("criança: bolus por kg, infusão em mL/kg/h, PCR com teto de 1 mg", () => {
  // 2 mcg/kg × 16 kg = 32 mcg na solução de 20 mcg/mL = 1,6 mL.
  const mod = calcularDose(dose(anafilaxia, "adrenalina-iv-moderada-ped"), anafilaxia, crianca);
  assert.deepEqual(mod.contas.map((c) => [c.doseTotal, c.volume]), [[32, 1.6]]);
  // Infusão 0,1 mcg/kg/min = 0,3 mL/kg/h na de 20 mcg/mL: 4,8 mL/h para 16 kg.
  const inf = calcularDose(dose(anafilaxia, "adrenalina-infusao-ped"), anafilaxia, crianca);
  assert.deepEqual(inf.contas.map((c) => c.volume), [4.8, 96]);
  // PCR 10 mcg/kg na de 100 mcg/mL = 0,1 mL/kg; com 120 kg informado, o teto de 1 mg segura e avisa.
  const pcr = calcularDose(dose(anafilaxia, "adrenalina-pcr-ped"), anafilaxia, crianca);
  assert.deepEqual(pcr.contas.map((c) => [c.doseTotal, c.volume]), [[160, 1.6]]);
  const pesoErrado = calcularDose(dose(anafilaxia, "adrenalina-pcr-ped"), anafilaxia, { idadeAnos: 8, pesoKg: 120 });
  assert.deepEqual(pesoErrado.contas.map((c) => [c.doseTotal, c.unidadeDose, c.limitada]), [[1000, "mcg", true]]);
  assert.ok(pesoErrado.alertas.some((a) => a.nivel === "perigo" && /Limitada ao máximo de 1 mg/.test(a.texto)));
});

test("diluição por peso: noradrenalina 0,15 mg/kg em 50 mL dá 2 a 40 mL/h; vasopressina 1 UI/kg em 50 mL", () => {
  const nora = calcularDose(dose(anafilaxia, "noradrenalina-ped"), anafilaxia, crianca);
  assert.match(nora.apresentacao!.rotulo, /para 16 kg: 2,4 mg em 50 mL/);
  assert.deepEqual(nora.contas.map((c) => c.volume), [2, 40]);
  const vaso = calcularDose(dose(anafilaxia, "vasopressina-infusao-ped"), anafilaxia, crianca);
  assert.deepEqual(vaso.contas.map((c) => c.volume), [1, 3]);
  const bolus = calcularDose(dose(anafilaxia, "vasopressina-bolus-ped"), anafilaxia, crianca);
  assert.deepEqual(bolus.contas.map((c) => c.volume), [2]);
});

test("sem peso, sem conta: a dose por kg diz o que falta, a fixa calcula", () => {
  const sem: PacienteDaConsulta = { idadeAnos: 5, pesoKg: null };
  assert.equal(calcularDose(dose(anafilaxia, "adrenalina-iv-moderada-ped"), anafilaxia, sem).bloqueio, "Informe o peso para calcular.");
  assert.equal(calcularDose(dose(anafilaxia, "noradrenalina-ped"), anafilaxia, sem).contas.length, 0);
  assert.equal(calcularDose(dose(anafilaxia, "adrenalina-im-ped-menor-6"), anafilaxia, sem).contas[0].volume, 0.15);
  assert.equal(calcularVolume(anafilaxia.volumes.find((v) => v.id === "cristaloide-ped")!, sem).bloqueio, "Informe o peso para calcular.");
  assert.equal(calcularVolume(anafilaxia.volumes.find((v) => v.id === "cristaloide-ped")!, crianca).texto, "320 mL");
  assert.equal(calcularVolume(anafilaxia.volumes.find((v) => v.id === "cristaloide-refrataria-ped")!, crianca).texto, "320 a 640 mL");
});

test("unidade: magnésio em g convertido para a ampola em mg/mL; glucagon em mcg/kg com teto em mg", () => {
  const mg = calcularDose(dose(anafilaxia, "magnesio-adulto"), anafilaxia, adulto);
  assert.deepEqual(mg.contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[2, "g", 4]]);
  // 50 mg/kg × 50 kg = 2,5 g → teto de 2 g (4 mL).
  const mgPed = calcularDose(dose(anafilaxia, "magnesio-ped"), anafilaxia, { idadeAnos: 11, pesoKg: 50 });
  assert.deepEqual(mgPed.contas.map((c) => [c.doseTotal, c.limitada, c.volume]), [[2000, true, 4]]);
  // Glucagon 40 mcg/kg × 30 kg = 1.200 mcg → teto de 1 mg.
  const glu = calcularDose(dose(anafilaxia, "glucagon-ped"), anafilaxia, { idadeAnos: 9, pesoKg: 30 });
  assert.deepEqual(glu.contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[1000, "mcg", 1]]);
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

test("laringoespasmo: propofol e succinilcolina por kg, IM 4 mg/kg, atropina da criança com teto", () => {
  const prop = calcularDose(dose(laringo, "propofol-laringoespasmo"), laringo, crianca);
  assert.deepEqual(prop.contas.map((c) => [c.doseTotal, c.volume]), [[4, 0.4], [8, 0.8]]);
  const sux = calcularDose(dose(laringo, "succinilcolina-iv-laringoespasmo"), laringo, crianca);
  assert.deepEqual(sux.contas.map((c) => [c.doseTotal, c.volume]), [[4, 0.4], [8, 0.8]]);
  assert.ok(sux.dose.cuidados?.some((c) => /hipercalemia/.test(c)));
  const im = calcularDose(dose(laringo, "succinilcolina-im-laringoespasmo"), laringo, crianca);
  assert.deepEqual(im.contas.map((c) => [c.doseTotal, c.volume]), [[64, 1.28]]);
  // Atropina 0,02 mg/kg × 16 = 0,32 mg; com 40 kg, o teto de 0,5 mg.
  const atr = calcularDose(dose(laringo, "atropina-laringoespasmo-ped"), laringo, crianca);
  assert.deepEqual(atr.contas.map((c) => [c.doseTotal, c.volume]), [[0.32, 1.28]]);
  const atrGrande = calcularDose(dose(laringo, "atropina-laringoespasmo-ped"), laringo, { idadeAnos: 11, pesoKg: 40 });
  assert.equal(atrGrande.contas[0].doseTotal, 0.5);
  // Recém-nascido de 3 kg: a atropina dá 0,06 mg = 0,24 mL — mede; propofol 0,75 mg = 0,075 mL, avisa.
  const rn: PacienteDaConsulta = { idadeAnos: 0.02, pesoKg: 3 };
  const propRn = calcularDose(dose(laringo, "propofol-laringoespasmo"), laringo, rn);
  assert.ok(propRn.alertas.some((a) => /menor que 0,1 mL/.test(a.texto)));
});

test("passos da gestante só aparecem para ela; sem faixa, todos aparecem", () => {
  const gestante = passosDe(anafilaxia, "gestante").map((x) => x.texto).join(" ");
  assert.match(gestante, /deslocar o útero/);
  assert.doesNotMatch(passosDe(anafilaxia, "adulto").map((x) => x.texto).join(" "), /deslocar o útero/);
  assert.equal(passosDe(anafilaxia, null).length, anafilaxia.agirAgora.length);
  assert.match(passosDe(laringo, "pediatrico").map((x) => x.texto).join(" "), /Criança com bradicardia/);
});

test("busca pelo nome, pelo sinônimo e pelo sinal, sem acento; previstos aparecem como em preparação", () => {
  assert.equal((buscar("anafilaxia")[0] as { protocolo: { id: string } }).protocolo.id, "anafilaxia");
  assert.equal((buscar("choque anafilatico")[0] as { protocolo: { id: string } }).protocolo.id, "anafilaxia");
  const estridor = buscar("estridor");
  assert.equal(estridor[0].tipo === "protocolo" && estridor[0].protocolo.id, "laringoespasmo");
  assert.match(estridor[0].tipo === "protocolo" ? estridor[0].porque : "", /sinal|sinônimo/);
  assert.ok(buscar("urticaria").some((a) => a.tipo === "protocolo" && a.protocolo.id === "anafilaxia"));
  const fogo = buscar("incendio");
  assert.ok(fogo.some((a) => a.tipo === "previsto" && a.previsto.titulo === "Incêndio na sala cirúrgica"));
  assert.deepEqual(buscar("  "), []);
  // O laringoespasmo pediátrico previsto é coberto pelo protocolo único.
  assert.ok(itensDaCategoria("pediatria").prontos.some((p) => p.id === "laringoespasmo"));
  assert.ok(!itensDaCategoria("pediatria").previstos.some((p) => p.titulo === "Laringoespasmo pediátrico"));
  assert.ok(!itensDaCategoria("respiratorio").previstos.some((p) => p.titulo === "Laringoespasmo"));
  assert.equal(PREVISTOS.filter((p) => p.categoria === "cardiovascular").length, 10);
});

test("PCR do adulto: 1 mg de adrenalina, amiodarona 300 mg, choque fixo; a criança vai para o SAV pediátrico", () => {
  const adr = dose(fvtv, "adrenalina-pcr");
  assert.deepEqual(calcularDose(adr, fvtv, adulto, 0).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[1, "mg", 1]]);
  assert.deepEqual(calcularDose(adr, fvtv, adulto, 1).contas.map((c) => c.volume), [10]);
  assert.deepEqual(calcularDose(dose(fvtv, "amiodarona-pcr-300"), fvtv, adulto).contas.map((c) => c.volume), [6]);
  assert.deepEqual(calcularDose(dose(fvtv, "lidocaina-pcr"), fvtv, adulto).contas.map((c) => [c.doseTotal, c.volume]), [[70, 3.5]]);
  assert.deepEqual(calcularDose(dose(fvtv, "bicarbonato-pcr"), fvtv, adulto).contas.map((c) => c.volume), [70, 140]);
  assert.deepEqual(calcularDose(dose(fvtv, "magnesio-pcr"), fvtv, adulto).contas.map((c) => c.volume), [2, 4]);
  const choques = fvtv.volumes.map((v) => calcularVolume(v, { idadeAnos: 40, pesoKg: null }).texto);
  assert.deepEqual(choques, ["120 a 200 J", "360 J"]);
  // Criança no protocolo do adulto: nenhuma dose serve, e o atalho aponta o pediátrico.
  assert.equal(fvtv.medicamentos.filter((d) => doseServe(d, "pediatrico", 4)).length, 0);
  assert.ok(fvtv.veja?.some((v) => v.protocolo === "sav-pediatrico" && v.quando.includes("pediatrico")));
  assert.equal(calcularDose(dose(aesp, "atropina-pcr-vagal"), aesp, adulto).contas.length, 2);
  // Os ritmos: chocáveis na FV/TV, não chocáveis na AESP/assistolia; o pediátrico mostra os quatro.
  assert.deepEqual(fvtv.ritmos?.map((r) => [r.ritmo, r.chocavel]), [["fv", true], ["tv", true]]);
  assert.deepEqual(aesp.ritmos?.map((r) => [r.ritmo, r.chocavel]), [["aesp", false], ["assistolia", false]]);
  assert.equal(sav.ritmos?.length, 4);
});

test("SAV pediátrico: 10 mcg/kg, 4 J/kg, amiodarona com o teto do adulto, tubo dez vezes a dose da veia", () => {
  const adr = calcularDose(dose(sav, "adrenalina-sav-ped"), sav, crianca);
  assert.deepEqual(adr.contas.map((c) => [c.doseTotal, c.volume]), [[160, 1.6]]);
  const tubo = calcularDose(dose(sav, "adrenalina-tubo-ped"), sav, crianca);
  assert.deepEqual(tubo.contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[1600, "mcg", 1.6]]);
  assert.ok(!tubo.alertas.some((a) => a.nivel === "perigo"), "a ampola pura é a do tubo");
  assert.deepEqual(calcularDose(dose(sav, "amiodarona-sav-ped"), sav, crianca).contas.map((c) => [c.doseTotal, c.volume]), [[80, 1.6]]);
  const grande = calcularDose(dose(sav, "amiodarona-sav-ped"), sav, { idadeAnos: 11, pesoKg: 70 });
  assert.deepEqual(grande.contas.map((c) => [c.doseTotal, c.limitada]), [[300, true]]);
  // Lidocaína 20 a 50 mcg/kg/min × 16 kg na de 20 mg/mL: 0,96 a 2,4 mL/h.
  assert.deepEqual(calcularDose(dose(sav, "lidocaina-infusao-sav-ped"), sav, crianca).contas.map((c) => [c.volume, c.unidadeVolume]), [[0.96, "mL/h"], [2.4, "mL/h"]]);
  assert.deepEqual(calcularDose(dose(sav, "cloreto-de-calcio-sav-ped"), sav, crianca).contas.map((c) => c.volume), [3.2]);
  assert.equal(calcularDose(dose(sav, "atropina-sav-ped"), sav, { idadeAnos: 11, pesoKg: 40 }).contas[0].doseTotal, 0.5);
  const choque = sav.volumes.find((v) => v.id === "choque-ped")!;
  assert.equal(calcularVolume(choque, crianca).texto, "64 J");
  assert.equal(calcularVolume(choque, crianca).base, "4 J/kg");
  assert.ok(sav.divergencias.some((d) => d.posicoes.some((x) => x.referencia === "qrh-2-1") && /atropina/i.test(d.tema)));
});

test("isquemia: nitroglicerina 3 a 5 mL/h sem peso, esmolol por kg, só adulto", () => {
  const ntg = calcularDose(dose(isquemia, "nitroglicerina-isquemia"), isquemia, { idadeAnos: 60, pesoKg: null });
  assert.equal(ntg.bloqueio, null);
  assert.deepEqual(ntg.contas.map((c) => [c.volume, c.unidadeVolume]), [[3, "mL/h"], [5, "mL/h"]]);
  assert.deepEqual(calcularDose(dose(isquemia, "esmolol-bolus-isquemia"), isquemia, adulto).contas.map((c) => [c.doseTotal, c.volume]), [[35, 3.5]]);
  assert.deepEqual(calcularDose(dose(isquemia, "esmolol-infusao-isquemia"), isquemia, adulto).contas.map((c) => c.volume), [21, 84]);
  assert.deepEqual(calcularDose(dose(isquemia, "fenilefrina-isquemia"), isquemia, adulto).contas.map((c) => c.volume), [0.25, 0.5]);
  assert.equal(isquemia.medicamentos.filter((d) => doseServe(d, "pediatrico", 6)).length, 0);
  assert.ok(isquemia.divergencias.some((d) => d.posicoes.some((x) => x.referencia === "qrh-3-12")));
});

test("hemorragia: ácido tranexâmico 1 g (o “1 mg” do Manual fica registrado), cálcio, hemocomponentes e fibrinogênio sem frasco", () => {
  assert.deepEqual(calcularDose(dose(hemorragia, "tranexamico-hemorragia-adulto"), hemorragia, adulto).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[1, "g", 20]]);
  const txa = hemorragia.divergencias.find((d) => /tranexâmico/.test(d.tema))!;
  assert.ok(txa.posicoes.some((x) => x.referencia === "manual-05" && /1 mg/.test(x.texto)));
  assert.deepEqual(calcularDose(dose(hemorragia, "tranexamico-hemorragia-ped"), hemorragia, crianca).contas.map((c) => [c.doseTotal, c.volume]), [[240, 4.8]]);
  assert.deepEqual(calcularDose(dose(hemorragia, "tranexamico-infusao-ped"), hemorragia, crianca).contas.map((c) => [c.volume, c.unidadeVolume]), [[0.64, "mL/h"]]);
  // Gluconato 50 mg/kg × 50 kg = 2.500 mg passa dos 2 g do adulto: compara mesmo em unidades diferentes.
  const glu = calcularDose(dose(hemorragia, "gluconato-hemorragia-ped"), hemorragia, { idadeAnos: 11, pesoKg: 50 });
  assert.ok(glu.alertas.some((a) => /passa da dose do adulto \(2 g\)/.test(a.texto)));
  // Fibrinogênio: dose total, sem volume (o frasco varia); sem peso, pede o peso.
  const fib = calcularDose(dose(hemorragia, "fibrinogenio-hemorragia"), hemorragia, adulto);
  assert.equal(fib.bloqueio, null);
  assert.equal(fib.apresentacao, null);
  assert.deepEqual(fib.contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[1750, "mg", undefined], [3500, "mg", undefined]]);
  assert.equal(calcularDose(dose(hemorragia, "fibrinogenio-hemorragia"), hemorragia, { idadeAnos: 40, pesoKg: null }).bloqueio, "Informe o peso para calcular.");
  const vol = (id: string) => calcularVolume(hemorragia.volumes.find((v) => v.id === id)!, crianca).texto;
  assert.equal(vol("pfc"), "240 mL");
  assert.equal(vol("crio"), "2 a 3 unidades");
  assert.equal(vol("plaquetas"), "240 a 320 mL");
  assert.ok(hemorragia.volumes.every((v) => volumeServe(v, "gestante") && volumeServe(v, "pediatrico")));
});

test("reação hemolítica: manitol por kg nas duas concentrações, furosemida, infusões a 5 mL/h no adulto e por kg na criança", () => {
  // 0,5 a 1 g/kg × 70 kg = 35 a 70 g: 175 a 350 mL do 20%, 140 a 280 mL do 25%.
  const man = dose(transfusional, "manitol-rht");
  assert.deepEqual(calcularDose(man, transfusional, adulto, 0).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[35, "g", 175], [70, "g", 350]]);
  assert.deepEqual(calcularDose(man, transfusional, adulto, 1).contas.map((c) => c.volume), [140, 280]);
  assert.deepEqual(calcularDose(dose(transfusional, "furosemida-rht-05"), transfusional, adulto).contas.map((c) => [c.doseTotal, c.volume]), [[35, 3.5]]);
  assert.deepEqual(calcularDose(dose(transfusional, "furosemida-rht-1-3"), transfusional, crianca).contas.map((c) => c.doseTotal), [16, 48]);
  // Adulto: as três soluções do Manual começam em 5 mL/h, sem peso.
  const semPeso: PacienteDaConsulta = { idadeAnos: 50, pesoKg: null };
  for (const id of ["adrenalina-infusao-rht-adulto", "noradrenalina-infusao-rht-adulto", "dobutamina-infusao-rht-adulto"]) {
    assert.deepEqual(calcularDose(dose(transfusional, id), transfusional, semPeso).contas.map((c) => [c.volume, c.unidadeVolume]), [[5, "mL/h"]], id);
  }
  // Criança de 16 kg na mesma solução: adrenalina 0,05 a 0,5 mcg/kg/min = 0,8 a 8 mL/h; dobutamina 2 a 20 = 0,38 a 3,84 mL/h.
  assert.deepEqual(calcularDose(dose(transfusional, "adrenalina-infusao-rht-ped"), transfusional, crianca).contas.map((c) => c.volume), [0.8, 8]);
  assert.deepEqual(calcularDose(dose(transfusional, "dobutamina-infusao-rht-ped"), transfusional, crianca).contas.map((c) => c.volume), [0.38, 3.84]);
  assert.deepEqual(calcularDose(dose(transfusional, "noradrenalina-infusao-rht-ped"), transfusional, crianca).contas.map((c) => c.volume), [0.24, 12]);
  // As divergências com o MSD Manual ficam registradas, e a busca acha pela transfusão.
  assert.ok(["furosemida", "vasopressor", "diurese"].every((t) => transfusional.divergencias.some((d) => d.tema.toLowerCase().includes(t))));
  assert.ok(buscar("transfusao").some((a) => a.tipo === "protocolo" && a.protocolo.id === "reacao-hemolitica-transfusional"));
  assert.ok(!itensDaCategoria("medicamentos").previstos.some((p) => p.titulo === "Reação hemolítica transfusional"));
});

test("embolia gasosa: cristaloide do QRH (fixo no adulto, por kg na criança) e a adrenalina da tabela do Manual, dita como emprestada", () => {
  const vol = (id: string, p: PacienteDaConsulta) => calcularVolume(embolia.volumes.find((v) => v.id === id)!, p).texto;
  assert.equal(vol("cristaloide-embolia-adulto", adulto), "500 a 1000 mL");
  assert.equal(vol("cristaloide-embolia-ped", crianca), "320 mL");
  assert.deepEqual(calcularDose(dose(embolia, "adrenalina-infusao-embolia-adulto"), embolia, { idadeAnos: 50, pesoKg: null }).contas.map((c) => c.volume), [5]);
  assert.deepEqual(calcularDose(dose(embolia, "adrenalina-infusao-embolia-ped"), embolia, crianca).contas.map((c) => c.volume), [0.8, 8]);
  // A dose não está no protocolo 08: o cartão diz de onde veio, e a divergência mostra as três fontes.
  for (const m of embolia.medicamentos) assert.match(m.velocidade ?? "", /protocolo 08 do Manual não dá dose/);
  assert.equal(embolia.divergencias.find((d) => /adrenalina/i.test(d.tema))?.posicoes.length, 3);
  assert.equal(buscar("embolia gasosa")[0].tipo === "protocolo" && (buscar("embolia gasosa")[0] as { protocolo: { id: string } }).protocolo.id, "embolia-gasosa-venosa");
  assert.ok(!itensDaCategoria("cardiovascular").previstos.some((p) => p.titulo === "Embolia gasosa venosa"));
  assert.ok(passosDe(embolia, "adulto").some((x) => /óxido nitroso/.test(x.texto)));
});

test("via aérea difícil: a sequência máscara → intubação → não ventilo, não intubo, com sugamadex 16 mg/kg e a divergência da punção", () => {
  const mascara = acharProtocolo("ventilacao-mascara-dificil")!;
  const tubo = acharProtocolo("intubacao-dificil")!;
  const cico = acharProtocolo("nao-ventilo-nao-intubo")!;
  const sug = calcularDose(dose(tubo, "sugamadex-intubacao-dificil"), tubo, adulto);
  assert.deepEqual(sug.contas.map((c) => [c.doseTotal, c.volume]), [[1120, 11.2]]);
  assert.ok(sug.dose.cuidados?.some((c) => /não garante via aérea/.test(c)));
  assert.equal(cico.medicamentos.length, 0);
  assert.ok(mascara.relacionados?.some((r) => r.protocolo === "nao-ventilo-nao-intubo"));
  assert.ok(tubo.relacionados?.some((r) => r.protocolo === "nao-ventilo-nao-intubo"));
  assert.ok(cico.divergencias.some((d) => d.posicoes.some((x) => x.referencia === "das-2015") && /bisturi/.test(d.escolha)));
  assert.ok(cico.agirAgora.some((x) => /14 G/.test(x.texto) && /1 bar/.test(x.detalhe ?? "")));
  const ids = (q: string) => buscar(q).flatMap((a) => (a.tipo === "protocolo" ? [a.protocolo.id] : []));
  assert.equal(ids("CICO")[0], "nao-ventilo-nao-intubo");
  assert.equal(ids("nao intubo nao oxigeno")[0], "nao-ventilo-nao-intubo");
  const resp = itensDaCategoria("respiratorio");
  for (const t of ["Dificuldade de ventilação com máscara", "Intubação difícil não prevista", "Não ventilo, não intubo", "Pressão elevada das vias aéreas", "Broncoespasmo grave", "Broncoaspiração"]) {
    assert.ok(!resp.previstos.some((p) => p.titulo === t), t);
  }
  assert.equal(acharProtocolo("broncoaspiracao")!.medicamentos.length, 0);
  assert.equal(acharProtocolo("pressao-vias-aereas")!.medicamentos.length, 0);
});

test("broncoespasmo: adrenalina por kg, salbutamol IV com teto por minuto na criança, nebulização pela idade", () => {
  assert.deepEqual(calcularDose(dose(bronco, "adrenalina-bolus-bronco"), bronco, adulto).contas.map((c) => [c.doseTotal, c.volume]), [[7, 0.7], [70, 7]]);
  assert.deepEqual(calcularDose(dose(bronco, "adrenalina-infusao-bronco"), bronco, adulto).contas.map((c) => c.volume), [7]);
  assert.deepEqual(calcularDose(dose(bronco, "adrenalina-infusao-bronco"), bronco, crianca).contas.map((c) => c.volume), [1.6]);
  assert.deepEqual(calcularDose(dose(bronco, "salbutamol-bolus-bronco-adulto"), bronco, adulto).contas.map((c) => c.volume), [5]);
  assert.deepEqual(calcularDose(dose(bronco, "salbutamol-infusao-bronco-adulto"), bronco, { idadeAnos: 40, pesoKg: null }).contas.map((c) => c.volume), [3, 15]);
  // Criança de 16 kg: carga de 80 mcg/min = 48 mL/h na de 100 mcg/mL; com 50 kg, o teto de 200 mcg/min segura.
  assert.deepEqual(calcularDose(dose(bronco, "salbutamol-carga-bronco-ped"), bronco, crianca).contas.map((c) => [c.doseTotal, c.volume]), [[80, 48]]);
  const grande = calcularDose(dose(bronco, "salbutamol-carga-bronco-ped"), bronco, { idadeAnos: 11, pesoKg: 50 });
  assert.deepEqual(grande.contas.map((c) => [c.doseTotal, c.limitada]), [[200, true]]);
  assert.deepEqual(calcularDose(dose(bronco, "salbutamol-manutencao-bronco-ped"), bronco, { idadeAnos: 11, pesoKg: 50 }).contas.map((c) => c.doseTotal), [50, 80]);
  assert.deepEqual(calcularDose(dose(bronco, "salbutamol-bolus-bronco-ped"), bronco, { idadeAnos: 6, pesoKg: 20 }).contas.map((c) => c.doseTotal), [250]);
  // Nebulização: 2,5 mg abaixo de 5 anos, 5 mg a partir dos 5.
  assert.equal(doseServe(dose(bronco, "salbutamol-nebulizacao-bronco-menor-5"), "pediatrico", 4), true);
  assert.equal(doseServe(dose(bronco, "salbutamol-nebulizacao-bronco"), "pediatrico", 4), false);
  assert.equal(doseServe(dose(bronco, "salbutamol-nebulizacao-bronco"), "pediatrico", 8), true);
  assert.equal(doseServe(dose(bronco, "ipratropio-bronco-ped"), "pediatrico", 1), false);
  assert.ok(!calcularDose(dose(bronco, "salbutamol-nebulizacao-bronco"), bronco, adulto).alertas.some((a) => a.nivel === "perigo"));
  assert.ok(bronco.divergencias.some((d) => /criança/.test(d.tema) && d.posicoes.length === 2));
});

test("laringoespasmo conferido com o Manual (12): vias da succinilcolina e as faixas do Manual como divergência", () => {
  const im = dose(laringo, "succinilcolina-im-laringoespasmo");
  assert.match(im.via, /IO/);
  assert.ok(!calcularDose(im, laringo, crianca).alertas.some((a) => a.nivel === "perigo"));
  for (const tema of ["Dose IV de succinilcolina", "Succinilcolina sem acesso venoso", "Atropina na bradicardia"]) {
    assert.ok(laringo.divergencias.find((d) => d.tema === tema)?.posicoes.some((x) => x.referencia === "manual-12"), tema);
  }
  assert.ok(passosDe(laringo, "pediatrico").some((x) => /intubar já, mesmo sem relaxante/.test(x.texto)));
  assert.ok(!passosDe(laringo, "adulto").some((x) => /intubar já, mesmo sem relaxante/.test(x.texto)));
});

test("obstetrícia: raqui alta, HPP com uterotônicos, magnésio do Ministério da Saúde e reanimação neonatal da SBP", () => {
  const raqui = acharProtocolo("bloqueio-neuroaxial-alto")!;
  const hpp = acharProtocolo("hemorragia-pos-parto")!;
  const colapso = acharProtocolo("colapso-materno")!;
  const rn = acharProtocolo("reanimacao-neonatal")!;
  const gestante: PacienteDaConsulta = { idadeAnos: 30, pesoKg: 70, gestante: true };
  assert.deepEqual(calcularDose(dose(raqui, "efedrina-raqui"), raqui, gestante).contas.map((c) => c.volume), [1.2, 2.4]);
  assert.deepEqual(calcularDose(dose(raqui, "atropina-raqui"), raqui, gestante).contas.map((c) => c.doseTotal), [0.6, 1.2]);
  assert.ok(passosDe(raqui, "gestante").some((x) => /4º minuto/.test(x.texto)));
  // Ocitocina 10 UI/h: 250 mL/h na de 20 UI/500 mL, 125 mL/h na de 40 UI.
  assert.deepEqual(calcularDose(dose(hpp, "ocitocina-infusao-hpp"), hpp, gestante, 0).contas.map((c) => c.volume), [250]);
  assert.deepEqual(calcularDose(dose(hpp, "ocitocina-infusao-hpp"), hpp, gestante, 1).contas.map((c) => c.volume), [125]);
  assert.deepEqual(calcularDose(dose(hpp, "metilergometrina-hpp"), hpp, gestante).contas.map((c) => c.volume), [1]);
  const miso = calcularDose(dose(hpp, "misoprostol-hpp"), hpp, gestante);
  assert.equal(miso.bloqueio, null);
  assert.deepEqual(miso.contas.map((c) => [c.doseTotal, c.volume]), [[800, undefined]]);
  assert.ok(hpp.divergencias.some((d) => /ergot/i.test(d.tema)));
  assert.equal(calcularVolume(hpp.volumes.find((v) => v.id === "pfc-hpp")!, gestante).texto, "1050 mL");
  // Magnésio: 4 g = 20 mL da diluição do MS; 1 a 2 g/h = 50 a 100 mL/h.
  assert.deepEqual(calcularDose(dose(colapso, "magnesio-ataque-eclampsia"), colapso, gestante).contas.map((c) => c.volume), [20]);
  assert.deepEqual(calcularDose(dose(colapso, "magnesio-manutencao-eclampsia"), colapso, gestante).contas.map((c) => c.volume), [50, 100]);
  // RN de 3 kg: 20 mcg/kg = 0,6 mL; tubo 100 mcg/kg = 3 mL; SF 30 mL.
  const recem: PacienteDaConsulta = { idadeAnos: 0, pesoKg: 3 };
  assert.deepEqual(calcularDose(dose(rn, "adrenalina-rn-iv"), rn, recem).contas.map((c) => c.volume), [0.3, 0.6, 0.9]);
  const tubo = calcularDose(dose(rn, "adrenalina-rn-tubo"), rn, recem);
  assert.deepEqual(tubo.contas.map((c) => c.volume), [3]);
  assert.ok(!tubo.alertas.some((a) => a.nivel === "perigo"));
  assert.equal(calcularVolume(rn.volumes[0], recem).texto, "30 mL");
  assert.ok(itensDaCategoria("obstetricia").prontos.some((p) => p.id === "reanimacao-neonatal"));
  for (const t of ["Bloqueio raquidiano alto ou total", "Hemorragia pós-parto", "Colapso materno e PCR na gestante"]) {
    assert.ok(!itensDaCategoria("obstetricia").previstos.some((p) => p.titulo === t), t);
  }
});

test("anestésico local, hipercalemia e hipertermia maligna: emulsão em mL/kg, doses máximas pelo peso, dantroleno em frascos", () => {
  const last = acharProtocolo("toxicidade-anestesico-local")!;
  const hiperk = acharProtocolo("hipercalemia")!;
  const hm = acharProtocolo("hipertermia-maligna")!;
  // 0,3 g/kg na de 200 mg/mL = 1,5 mL/kg: 105 mL com 70 kg, segurado em 100 mL.
  const bolus = calcularDose(dose(last, "lipidica-bolus-last"), last, adulto);
  assert.deepEqual(bolus.contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume, c.limitada]), [[20, "g", 100, true]]);
  assert.deepEqual(calcularDose(dose(last, "lipidica-bolus-last"), last, crianca).contas.map((c) => c.volume), [24]);
  // Infusão 15 a 30 mL/kg/h.
  assert.deepEqual(calcularDose(dose(last, "lipidica-infusao-last"), last, crianca).contas.map((c) => [c.volume, c.unidadeVolume]), [[240, "mL/h"], [480, "mL/h"]]);
  const maximos = last.volumes.filter((v) => v.unidade === "mg").map((v) => calcularVolume(v, adulto).texto);
  assert.deepEqual(maximos, ["210 mg", "490 mg", "140 mg", "210 mg", "490 mg"]);
  assert.equal(calcularVolume(last.volumes.find((v) => v.id === "lipidica-maximo")!, adulto).texto, "840 mL");
  // Hipercalemia: insulina diluída 1 UI/mL; criança 16 kg = 1,6 UI = 1,6 mL; glicose 0,5 g/kg a 25% = 2 mL/kg.
  assert.deepEqual(calcularDose(dose(hiperk, "insulina-hiperk-ped"), hiperk, crianca).contas.map((c) => c.volume), [1.6]);
  assert.ok(calcularDose(dose(hiperk, "insulina-hiperk-ped"), hiperk, crianca, 1).alertas.some((a) => /menor que 0,1 mL/.test(a.texto)));
  assert.deepEqual(calcularDose(dose(hiperk, "glicose-hiperk-ped"), hiperk, crianca).contas.map((c) => c.volume), [32]);
  assert.deepEqual(calcularDose(dose(hiperk, "gluconato-hiperk-ped"), hiperk, crianca).contas.map((c) => c.volume), [16]);
  assert.deepEqual(calcularDose(dose(hiperk, "glicose-hiperk-adulto"), hiperk, adulto).contas.map((c) => c.volume), [25, 50]);
  // Dantroleno 2,5 mg/kg × 70 = 175 mg = 525 mL (quase 9 frascos de 20 mg).
  assert.deepEqual(calcularDose(dose(hm, "dantroleno-hm"), hm, adulto).contas.map((c) => [c.doseTotal, c.volume]), [[175, 525]]);
  assert.deepEqual(calcularDose(dose(hm, "dantroleno-hm"), hm, adulto, 1).contas.map((c) => c.volume), [3.5]);
  assert.ok(hm.divergencias.some((d) => d.posicoes.some((x) => x.referencia === "qrh-3-8")));
  assert.equal((buscar("dantroleno")[0] as { protocolo: { id: string } }).protocolo.id, "hipertermia-maligna");
});

test("vias de diagnóstico e listas: doses da aba 34 conferidas, amiodarona em mg/h, listas sem dose na categoria G", () => {
  const taqui = acharProtocolo("taquiarritmia")!;
  const bradi = acharProtocolo("bradicardia")!;
  const has = acharProtocolo("hipertensao")!;
  const hipo = acharProtocolo("hipotensao")!;
  assert.deepEqual(calcularDose(dose(taqui, "adenosina-taqui"), taqui, adulto).contas.map((c) => c.volume), [2]);
  // 60 e 30 mg/h na de 1,8 mg/mL: 16,67 e 33,33 mL/h (900 mg em 24 h).
  assert.deepEqual(calcularDose(dose(taqui, "amiodarona-infusao-taqui"), taqui, adulto).contas.map((c) => c.volume), [16.67, 33.33]);
  assert.ok(taqui.divergencias.some((d) => /Infusão de amiodarona/.test(d.tema)));
  assert.equal(calcularVolume(taqui.volumes.find((v) => v.id === "cardioversao-ped")!, crianca).texto, "16 J");
  // Atropina: criança 20 mcg/kg com teto; adulto 0,5 a 1 mg.
  assert.deepEqual(calcularDose(dose(bradi, "atropina-bradi-ped"), bradi, crianca).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[320, "mcg", 1.28]]);
  assert.deepEqual(calcularDose(dose(bradi, "atropina-bradi"), bradi, adulto).contas.map((c) => c.doseTotal), [0.5, 1]);
  assert.deepEqual(calcularDose(dose(bradi, "dopamina-bradi"), bradi, adulto).contas.map((c) => c.volume), [8.4, 84]);
  assert.deepEqual(calcularDose(dose(has, "esmolol-has"), has, adulto).contas.map((c) => c.volume), [3.5]);
  assert.deepEqual(calcularDose(dose(hipo, "noradrenalina-infusao-hipo"), hipo, adulto).contas.map((c) => c.volume), [5.25, 105]);
  for (const id of ["dessaturacao", "aumento-etco2", "diminuicao-etco2", "evento-sem-diagnostico", "depois-da-crise", "colega-afetado", "verificacao-aparelho", "verificacao-pre-inducao"]) {
    assert.equal(acharProtocolo(id)!.medicamentos.length, 0, id);
  }
  assert.equal(itensDaCategoria("apoio").prontos.length, 5);
  assert.equal(acharProtocolo("evento-sem-diagnostico")!.agirAgora.length, 10);
  const ids = (q: string) => buscar(q).flatMap((a) => (a.tipo === "protocolo" ? [a.protocolo.id] : []));
  assert.equal(ids("10 Ts")[0], "evento-sem-diagnostico");
  assert.ok(ids("EtCO2 caindo").includes("diminuicao-etco2"));
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

const registro = (r: Partial<RegistroDeRevisao> & Pick<RegistroDeRevisao, "situacao" | "assinatura" | "criadoEm">): RegistroDeRevisao => ({
  id: r.criadoEm, protocolo: "anafilaxia", versao: 1, conteudo: anafilaxia, observacao: null,
  autorNome: "Revisor Fictício", autorCrm: "CRM-SP 000000", autorPapel: "revisor", ...r,
});

test("situação: sem registro é pendente; aprovado põe em uso; versão nova não derruba a aprovada", () => {
  const atual = assinatura(anafilaxia);
  assert.equal(assinatura(anafilaxia), atual, "a assinatura é estável");
  assert.notEqual(assinatura({ ...anafilaxia, versao: 2 }), atual);

  const nada = resolverEstado(anafilaxia, []);
  assert.equal(nada.daVersaoAtual, "pendente");
  assert.equal(nada.emUso, null);

  const aprovado = resolverEstado(anafilaxia, [registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-10-20T10:00:00Z" })]);
  assert.equal(aprovado.daVersaoAtual, "aprovado");
  assert.equal(aprovado.emUso, anafilaxia);

  // O código mudou (versão 2): a 1 continua em uso, e a 2 espera revisão.
  const v2 = { ...anafilaxia, versao: 2, resumo: "outro texto" };
  const antigo = resolverEstado(v2, [registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-10-20T10:00:00Z" })]);
  assert.equal(antigo.daVersaoAtual, "pendente");
  assert.equal(antigo.versaoNovaEsperando, true);
  assert.equal((antigo.emUso as typeof anafilaxia).versao, 1);

  // Necessita atualização: continua em uso, com aviso.
  const atualizar = resolverEstado(anafilaxia, [
    registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-10-20T10:00:00Z" }),
    registro({ situacao: "necessita_atualizacao", assinatura: atual, criadoEm: "2026-11-01T10:00:00Z" }),
  ]);
  assert.equal(atualizar.daVersaoAtual, "necessita_atualizacao");
  assert.ok(atualizar.emUso && atualizar.precisaAtualizar);

  // Suspenso: sai de uso; uma nova aprovação (reversão) volta.
  const suspenso = resolverEstado(anafilaxia, [
    registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-10-20T10:00:00Z" }),
    registro({ situacao: "suspenso", assinatura: atual, criadoEm: "2026-11-02T10:00:00Z" }),
  ]);
  assert.equal(suspenso.daVersaoAtual, "suspenso");
  assert.equal(suspenso.emUso, null);
  const revertido = resolverEstado(anafilaxia, [
    ...suspenso.historico,
    registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-11-03T10:00:00Z" }),
  ]);
  assert.equal(revertido.daVersaoAtual, "aprovado");

  // Instantâneo inválido no banco não vira conteúdo em uso.
  const lixo = resolverEstado(anafilaxia, [registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-10-20T10:00:00Z", conteudo: { id: "anafilaxia" } })]);
  assert.equal(lixo.emUso, null);
  // Registro de outro protocolo não conta.
  assert.equal(resolverEstado(laringo, aprovado.historico).daVersaoAtual, "pendente");
});

test("o banco e a tela concordam sobre quem registra o quê, e o histórico não muda", async () => {
  const { readFileSync } = await import("node:fs");
  const { PODE_REGISTRAR } = await import("./situacao.ts");
  const sql = readFileSync(new URL("../../supabase/migrations/202610150001_intercorrencias_anestesicas.sql", import.meta.url), "utf8");
  // Editor: só rascunho e pendente; admin: mais suspender; aprovar exige revisor com CRM.
  assert.match(sql, /v_papel = 'editor' and p_situacao not in \('rascunho', 'pendente'\)/);
  assert.match(sql, /v_papel = 'admin' and p_situacao not in \('rascunho', 'pendente', 'suspenso'\)/);
  assert.deepEqual(PODE_REGISTRAR.editor, ["rascunho", "pendente"]);
  assert.deepEqual(PODE_REGISTRAR.admin, ["rascunho", "pendente", "suspenso"]);
  assert.match(sql, /autor_papel = 'revisor' and autor_crm is not null/);
  assert.match(sql, /REVISOR_SEM_CRM/);
  // Só cresce: gatilho contra update e delete; e as funções fora do alcance de anon.
  assert.match(sql, /before update or delete on public\.intercorrencias_revisoes/);
  for (const f of ["intercorrencias_meu_papel()", "intercorrencias_registrar(text, integer, text, text, jsonb, text)", "intercorrencias_definir_papel(text, text)", "intercorrencias_equipe_lista()"]) {
    assert.ok(sql.includes(`revoke all on function public.${f} from public, anon;`), f);
  }
});
