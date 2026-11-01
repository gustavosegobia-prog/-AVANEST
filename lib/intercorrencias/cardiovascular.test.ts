import test from "node:test";
import assert from "node:assert/strict";
import { acharProtocolo, buscar, itensDaCategoria, PROTOCOLOS } from "./catalogo.ts";
import { aprovado } from "./aprovacao.ts";
import { calcularDose, calcularVolume, doseServe, passosDe, type PacienteDaConsulta } from "./calculo.ts";
import { acharReferencia } from "./referencias.ts";
import type { Protocolo } from "./tipos.ts";

// Os 10 protocolos cardiovasculares da minuta de 01/11/2026 ("AVANEST —
// Implementação dos 10 protocolos cardiovasculares"), aprovada pelo responsável
// médico no mesmo dia. Estes testes travam o que a minuta pede: as etapas
// numeradas na ordem dela, as doses com unidade e concentração conferidas, e as
// regras de segurança da calculadora.

const acha = (id: string) => acharProtocolo(id)!;
const adulto: PacienteDaConsulta = { idadeAnos: 40, pesoKg: 70 };
const semPeso: PacienteDaConsulta = { idadeAnos: 40, pesoKg: null };
const crianca: PacienteDaConsulta = { idadeAnos: 6, pesoKg: 20 };
const contas = (p: Protocolo, id: string, pac: PacienteDaConsulta, apresentacao = 0) => {
  const d = p.medicamentos.find((m) => m.id === id);
  assert.ok(d, `${p.id}: dose ${id}`);
  return calcularDose(d, p, pac, apresentacao);
};
const volumes = (p: Protocolo, id: string, pac: PacienteDaConsulta) =>
  calcularVolume(p.volumes.find((v) => v.id === id)!, pac).texto;

/** As etapas de "Agir agora" de cada protocolo, para o adulto, com a primeira e a última da minuta. */
const ETAPAS: Array<[string, number, RegExp, RegExp]> = [
  ["pcr-fv-tv", 11, /^Confirme a parada cardíaca/, /^Acione recursos avançados e cuidados pós-PCR/],
  ["pcr-aesp-assistolia", 9, /^Confirme ausência de pulso/, /^Acione suporte avançado conforme a causa/],
  ["isquemia-miocardica", 12, /^Solicite ajuda e comunique o cirurgião/, /^Planeje acompanhamento pós-operatório intensivo/],
  ["hemorragia-macica", 12, /^Solicite ajuda imediatamente/, /^Continue monitorização e reavaliação/],
  ["embolia-gasosa-venosa", 10, /^Solicite ajuda e comunique imediatamente a cirurgia/, /^Considere avaliação hiperbárica/],
  ["hipertensao", 10, /^Confirme a pressão arterial/, /^Reavalie resposta e complicações/],
  ["hipotensao", 11, /^Avalie pulso, pressão e ritmo cardíaco/, /^Identifique e trate a causa definitiva/],
  ["taquiarritmia", 11, /^Avalie pulso e instabilidade/, /^Investigue causas desencadeantes/],
  ["bradicardia", 11, /^Avalie pulso e perfusão/, /^Reavalie continuamente e organize transferência/],
  ["embolia-pulmonar", 12, /^Solicite ajuda imediatamente/, /^Acione equipe de resposta à embolia pulmonar/],
];

test("os 10 cardiovasculares, na ordem da minuta, todos aprovados na versão nova", () => {
  const cardio = itensDaCategoria("cardiovascular").prontos.map((p) => p.id);
  assert.deepEqual(cardio, ETAPAS.map(([id]) => id));
  for (const [id] of ETAPAS) {
    const p = acha(id);
    assert.equal(p.versao, id === "embolia-pulmonar" ? 1 : 3, id);
    assert.equal(p.atualizadoEm, "2026-11-01", id);
    assert.ok(aprovado(p), `${id}: sem aprovação`);
  }
  // A embolia pulmonar substitui o "em preparação", inclusive para quem usa.
  const liberados = PROTOCOLOS.filter((p) => aprovado(p));
  assert.ok(!itensDaCategoria("cardiovascular", liberados).previstos.some((x) => x.titulo === "Embolia pulmonar"));
  assert.ok(buscar("TEP", liberados).some((a) => a.tipo === "protocolo" && a.protocolo.id === "embolia-pulmonar"));
});

test("Agir agora: todas as etapas numeradas e na ordem clínica, sem agrupar nem omitir", () => {
  for (const [id, n, primeira, ultima] of ETAPAS) {
    const p = acha(id);
    const etapas = passosDe(p, "adulto");
    assert.equal(etapas.length, n, `${id}: ${etapas.length} etapas`);
    // Uma lista só, numerada de 1 a n: sem caminhos, que recomeçariam a numeração.
    assert.ok(etapas.every((x) => !x.caminho), `${id}: etapa em caminho`);
    assert.match(etapas[0].texto, primeira, id);
    assert.match(etapas[n - 1].texto, ultima, id);
    for (const x of etapas) assert.ok(x.texto.trim().endsWith("."), `${id}: "${x.texto}"`);
    for (const parte of ["reconhecer", "pensarEm", "depois", "referencias"] as const) assert.ok(p[parte].length > 0, `${id}: ${parte}`);
  }
  // Etapas da minuta que não podem sumir.
  const texto = (id: string) => acha(id).agirAgora.map((x) => `${x.texto} ${x.detalhe ?? ""}`).join(" ");
  assert.match(texto("pcr-fv-tv"), /Não há obrigatoriedade de administrar a segunda dose exatamente no quinto ciclo/);
  assert.match(texto("pcr-aesp-assistolia"), /Não aguardar o segundo ciclo para iniciar adrenalina/);
  assert.match(texto("embolia-gasosa-venosa"), /Não descartar a avaliação apenas porque se passaram mais de 6 horas/);
  assert.match(texto("taquiarritmia"), /Fibrilação atrial: 200 J sincronizados\. Flutter atrial: 200 J sincronizados\. Taquicardia regular de QRS estreito: 100 J sincronizados\. TV monomórfica com pulso: 100 J sincronizados\. TV polimórfica: choque não sincronizado de alta energia/);
  assert.match(texto("embolia-pulmonar"), /Categoria A: subclínica\/assintomática\..*Categoria E: falência cardiopulmonar, incluindo choque persistente ou PCR/);
  assert.match(texto("embolia-pulmonar"), /Não aplicar trombólise a todos os pacientes automaticamente/);
});

test("passos de uma população só vêm depois das etapas numeradas, e só para ela", () => {
  // Gestante na FV/TV e na hemorragia; criança na bradicardia (como na versão 2 aprovada).
  assert.equal(passosDe(acha("pcr-fv-tv"), "gestante").length, 12);
  assert.match(passosDe(acha("pcr-fv-tv"), "gestante")[11].texto, /parto ressuscitativo/);
  assert.equal(passosDe(acha("hemorragia-macica"), "gestante").length, 13);
  assert.match(passosDe(acha("hemorragia-macica"), "gestante")[12].texto, /hemorragia pós-parto/);
  assert.equal(passosDe(acha("bradicardia"), "pediatrico").length, 12);
  assert.match(passosDe(acha("bradicardia"), "pediatrico")[11].texto, /Criança com FC abaixo de 60/);
  assert.ok(acha("pcr-aesp-assistolia").veja?.some((v) => v.protocolo === "colapso-materno" && v.quando.includes("gestante")));
});

test("doses do adulto: a conta sai da concentração da apresentação, com a unidade certa", () => {
  const fvtv = acha("pcr-fv-tv");
  // Adrenalina 1 mg a 0,1 mg/mL: 10 mL.
  assert.deepEqual(contas(fvtv, "adrenalina-pcr", adulto).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume, c.unidadeVolume]), [[1, "mg", 10, "mL"]]);
  // Amiodarona a 50 mg/mL: 300 mg = 6 mL; 150 mg = 3 mL.
  assert.equal(contas(fvtv, "amiodarona-pcr-300", adulto).contas[0].volume, 6);
  assert.equal(contas(fvtv, "amiodarona-pcr-150", adulto).contas[0].volume, 3);
  // Lidocaína 2% (20 mg/mL), 70 kg: 70–105 mg = 3,5–5,25 mL; depois 35–52,5 mg.
  assert.deepEqual(contas(fvtv, "lidocaina-pcr", adulto).contas.map((c) => [c.doseTotal, c.volume]), [[70, 3.5], [105, 5.25]]);
  assert.deepEqual(contas(fvtv, "lidocaina-pcr-2", adulto).contas.map((c) => c.doseTotal), [35, 52.5]);
  assert.deepEqual(fvtv.volumes.map((v) => calcularVolume(v, adulto).texto), ["120 a 200 J", "360 J"]);

  const isquemia = acha("isquemia-miocardica");
  assert.equal(contas(isquemia, "metoprolol-isquemia", adulto).contas[0].volume, 2.5);
  // Nitroglicerina 5 mcg/min a 200 mcg/mL: 1,5 mL/h.
  assert.deepEqual(contas(isquemia, "nitroglicerina-isquemia", adulto).contas.map((c) => [c.volume, c.unidadeVolume]), [[1.5, "mL/h"]]);

  const has = acha("hipertensao");
  // Esmolol 0,5 mg/kg (35 mg) a 10 mg/mL: 3,5 mL; infusão 50 mcg/kg/min, 70 kg: 3.500 mcg/min = 21 mL/h.
  assert.equal(contas(has, "esmolol-bolus-hipertensao", adulto).contas[0].volume, 3.5);
  assert.deepEqual(contas(has, "esmolol-infusao-hipertensao", adulto).contas.map((c) => [c.volume, c.unidadeVolume]), [[21, "mL/h"]]);
  assert.equal(contas(has, "hidralazina-hipertensao", adulto).contas[0].volume, 5);

  const hipo = acha("hipotensao");
  assert.deepEqual(contas(hipo, "efedrina-hipotensao", adulto).contas.map((c) => c.volume), [0.6, 1.2]);
  assert.deepEqual(contas(hipo, "fenilefrina-hipotensao", adulto).contas.map((c) => c.volume), [0.5, 1]);
  // Noradrenalina 0,05 mcg/kg/min × 70 kg × 60 ÷ 80 mcg/mL = 2,625 mL/h (a tela arredonda).
  const nora = contas(hipo, "noradrenalina-hipotensao", adulto).contas[0];
  assert.equal(nora.unidadeVolume, "mL/h");
  assert.ok(Math.abs(nora.volume! - (0.05 * 70 * 60) / 80) < 0.01, String(nora.volume));
  assert.deepEqual(contas(hipo, "adrenalina-bolus-hipotensao", adulto).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[10, "mcg", 1], [20, "mcg", 2]]);

  const taqui = acha("taquiarritmia");
  assert.equal(contas(taqui, "adenosina-6", adulto).contas[0].volume, 2);
  assert.equal(contas(taqui, "adenosina-12", adulto).contas[0].volume, 4);
  assert.equal(volumes(taqui, "cardioversao-fa", adulto), "200 J");
  assert.equal(volumes(taqui, "cardioversao-estreita", adulto), "100 J");
  assert.equal(volumes(taqui, "desfibrilacao-tv-polimorfica", adulto), "120 a 200 J");

  const bradi = acha("bradicardia");
  assert.equal(contas(bradi, "atropina-bradicardia-adulto", adulto).contas[0].volume, 2);
  // Adrenalina 2–10 mcg/min a 60 mcg/mL: 2–10 mL/h.
  assert.deepEqual(contas(bradi, "adrenalina-infusao-bradicardia", adulto).contas.map((c) => [c.volume, c.unidadeVolume]), [[2, "mL/h"], [10, "mL/h"]]);

  const hemo = acha("hemorragia-macica");
  assert.equal(contas(hemo, "cloreto-de-calcio-hemorragia-adulto", adulto).contas[0].volume, 10);
  assert.deepEqual(contas(hemo, "tranexamico-trauma-bolus", adulto).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[1, "g", 20]]);
  assert.equal(volumes(hemo, "plasma", adulto), "1050 mL");
});

test("doses da criança: por kg, com mínimo e teto da fonte", () => {
  const taqui = acha("taquiarritmia");
  assert.equal(contas(taqui, "adenosina-ped-1", crianca).contas[0].doseTotal, 2);
  assert.equal(contas(taqui, "adenosina-ped-2", crianca).contas[0].doseTotal, 4);
  // Teto: 6 e 12 mg.
  assert.equal(contas(taqui, "adenosina-ped-1", { idadeAnos: 12, pesoKg: 80 }).contas[0].doseTotal, 6);
  assert.equal(contas(taqui, "adenosina-ped-2", { idadeAnos: 12, pesoKg: 80 }).contas[0].doseTotal, 12);
  assert.equal(volumes(taqui, "cardioversao-ped", crianca), "10 a 20 J");
  assert.equal(volumes(taqui, "cardioversao-ped-2", crianca), "40 J");

  const bradi = acha("bradicardia");
  assert.deepEqual(contas(bradi, "adrenalina-bradicardia-ped", crianca).contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[200, "mcg", 2]]);
  assert.equal(contas(bradi, "atropina-bradicardia-ped", { idadeAnos: 0.3, pesoKg: 3 }).contas[0].doseTotal, 0.1, "mínimo de 0,1 mg");
  assert.equal(contas(bradi, "atropina-bradicardia-ped", { idadeAnos: 11, pesoKg: 40 }).contas[0].doseTotal, 0.5, "máximo de 0,5 mg");
});

test("segurança: sem peso válido não há conta, e dose de adulto não vira dose de criança", () => {
  const fvtv = acha("pcr-fv-tv");
  const hipo = acha("hipotensao");
  for (const pac of [semPeso, { idadeAnos: 40, pesoKg: 0 }, { idadeAnos: 40, pesoKg: -70 }, { idadeAnos: 40, pesoKg: Number.NaN }]) {
    for (const [p, id] of [[fvtv, "lidocaina-pcr"], [hipo, "noradrenalina-hipotensao"], [acha("hipertensao"), "esmolol-bolus-hipertensao"]] as const) {
      const r = contas(p, id, pac);
      assert.equal(r.contas.length, 0, `${id} com peso ${pac.pesoKg}`);
      assert.match(r.bloqueio ?? "", /peso/i, id);
    }
  }
  // Dose fixa do adulto não depende do peso, e continua saindo sem ele.
  assert.equal(contas(fvtv, "adrenalina-pcr", semPeso).contas[0].volume, 10);
  // Nenhuma dose do adulto serve à criança; a da criança não serve ao adulto.
  for (const [id] of ETAPAS) {
    const p = acha(id);
    for (const d of p.medicamentos) {
      if (d.populacao === "adulto") assert.equal(doseServe(d, "pediatrico", 6, 20), false, `${id}: ${d.id}`);
      if (d.populacao === "pediatrico") assert.equal(doseServe(d, "adulto", 40, 70), false, `${id}: ${d.id}`);
    }
  }
  // Todo resultado é número finito e positivo.
  for (const [id] of ETAPAS) {
    const p = acha(id);
    for (const d of p.medicamentos) {
      const pac = d.populacao === "pediatrico" ? crianca : adulto;
      for (const c of calcularDose(d, p, pac).contas) {
        assert.ok(Number.isFinite(c.doseTotal) && c.doseTotal > 0, `${d.id}: dose ${c.doseTotal}`);
        if (c.volume !== undefined) assert.ok(Number.isFinite(c.volume) && c.volume > 0, `${d.id}: volume ${c.volume}`);
      }
    }
  }
});

test("adrenalina: PCR, resgate com pulso e infusão nunca se misturam", () => {
  const pcr = acha("pcr-fv-tv").medicamentos.find((m) => m.id === "adrenalina-pcr")!;
  const resgate = acha("hipotensao").medicamentos.find((m) => m.id === "adrenalina-bolus-hipotensao")!;
  const infusao = acha("bradicardia").medicamentos.find((m) => m.id === "adrenalina-infusao-bradicardia")!;
  assert.deepEqual([pcr.dose.unidade, pcr.dose.por], ["mg", "fixa"]);
  assert.deepEqual([resgate.dose.unidade, resgate.dose.por], ["mcg", "fixa"]);
  assert.deepEqual([infusao.dose.unidade, infusao.dose.por], ["mcg", "min"]);
  // Cada uso na sua seringa: a ampola pura de 1 mg/mL é só da PCR.
  assert.ok(pcr.apresentacoes.some((a) => /só na PCR/.test(a.rotulo)));
  assert.ok(resgate.apresentacoes.every((a) => a.quantidade === 10 && a.unidade === "mcg"), "resgate a 10 mcg/mL");
  assert.ok(infusao.apresentacoes.every((a) => /60 mcg\/mL/.test(a.rotulo)), "infusão a 60 mcg/mL");
  assert.ok(resgate.cuidados?.some((c) => /Não confundir com adrenalina 1 mg utilizada na PCR/.test(c)));
  for (const d of [pcr, resgate, infusao]) assert.ok(d.altoRisco, d.id);
});

test("sem calculadora onde a minuta não libera: embolia pulmonar, amiodarona com pulso, dobutamina, nitroprussiato", () => {
  const tep = acha("embolia-pulmonar");
  assert.equal(tep.medicamentos.length, 0);
  assert.equal(tep.volumes.length, 0);
  assert.match(tep.notasDeDose!.join(" "), /Não inserir uma única dose universal de heparina/);
  assert.match(tep.notasDeDose!.join(" "), /Não liberar cálculo automático sem confirmar elegibilidade/);
  assert.ok(!acha("taquiarritmia").medicamentos.some((m) => m.farmaco === "Amiodarona"));
  assert.ok(!acha("hipotensao").medicamentos.some((m) => m.farmaco === "Dobutamina"));
  assert.ok(!acha("hipertensao").medicamentos.some((m) => m.farmaco === "Nitroprussiato"));
  // Dopamina: dose pelo peso, mas sem concentração presumida — o volume não sai.
  const dopa = contas(acha("bradicardia"), "dopamina-bradicardia", adulto);
  assert.deepEqual(dopa.contas.map((c) => [c.doseTotal, c.volume]), [[350, undefined], [1400, undefined]]);
});

test("referências: as da minuta existem; a diretriz de TEP de 2026 fica marcada como não conferida", () => {
  for (const [id] of ETAPAS) {
    for (const r of acha(id).referencias) assert.ok(acharReferencia(r), `${id}: ${r}`);
  }
  const tep = acharReferencia("aha-acc-2026-tep")!;
  assert.equal(tep.conferida, false);
  assert.equal(tep.localizacao, null);
  assert.ok(acha("embolia-pulmonar").referencias.includes("aha-acc-2026-tep"));
  assert.equal(acha("embolia-pulmonar").bibliografiaGeral, false);
});
