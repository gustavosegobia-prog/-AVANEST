import test from "node:test";
import assert from "node:assert/strict";
import { arredondarDose, farmacosDoCartao, idadeEmMesesDaFicha, sugerirDoses, tuboDaFicha } from "./sugestoes.ts";
import { CATALOGO } from "../calculos/doses.ts";

const adulto = { idadeMeses: 40 * 12, pesoKg: 70 };
const doses = (r: ReturnType<typeof sugerirDoses>, titulo: string) =>
  r.cartoes.find((c) => c.titulo === titulo)?.doses.map((d) => d.dose);

test("adulto: as doses padrão do propofol já calculadas pelo peso", () => {
  const r = sugerirDoses("Propofol", adulto, { unidade: "mg", via: "EV" });
  assert.equal(r.populacao, "adulto");
  assert.deepEqual(doses(r, "Propofol — indução"), [140, 175]);
  // A dose reduzida (idoso, ASA III–IV) aparece como outro cartão, com a indicação.
  const reduzida = r.cartoes.find((c) => c.titulo === "Propofol — indução com dose reduzida");
  assert.deepEqual(reduzida?.doses.map((d) => d.dose), [70, 105]);
  assert.match(reduzida!.indicacao!, /Idoso/);
  assert.ok(r.cartoes[0].titulo.includes("indução"), "indução na frente");
});

test("criança: a dose sai do peso e da faixa etária, na unidade da ficha", () => {
  const r = sugerirDoses("Fentanil", { idadeMeses: 36, pesoKg: 15 }, { unidade: "mcg", via: "EV" });
  assert.equal(r.populacao, "crianca");
  assert.deepEqual(doses(r, "Fentanil"), [15, 45]);
  // Lactente: outro cartão de rocurônio, outra faixa.
  const lact = sugerirDoses("Rocurônio", { idadeMeses: 6, pesoKg: 8 }, { unidade: "mg", via: "EV" });
  assert.equal(lact.populacao, "lactente");
  assert.deepEqual(doses(lact, "Rocurônio — intubação"), [2, 4]);
});

test("dose fixa não vê o peso, e a regra da cefazolina segue o peso", () => {
  const ond = sugerirDoses("Ondansetrona", { idadeMeses: 600, pesoKg: null }, { unidade: "mg" });
  // A do serviço é 8 mg (14/11/2026), com os 4 mg à vista; a dexametasona, 10 mg.
  assert.deepEqual(doses(ond, "Ondansetrona"), [4, 8]);
  assert.deepEqual(doses(sugerirDoses("Dexametasona", { idadeMeses: 600, pesoKg: null }, { unidade: "mg" }), "Dexametasona"), [4, 10]);
  assert.equal(doses(sugerirDoses("Cefazolina", adulto, { unidade: "g" }), "Cefazolina — profilaxia")?.[0], 2);
  const pesado = sugerirDoses("Kefazol", { idadeMeses: 600, pesoKg: 130 }, { unidade: "g" });
  assert.equal(doses(pesado, "Cefazolina — profilaxia")?.[0], 3);
  assert.match(pesado.cartoes[0].observacao!, /120 kg/);
});

test("converte para a unidade da ficha: dipirona em g", () => {
  const r = sugerirDoses("Dipirona", adulto, { unidade: "g" });
  assert.deepEqual(doses(r, "Dipirona ou paracetamol"), [1.4, 2.1]);
  assert.equal(r.cartoes[0].doses[0].unidade, "g");
});

test("sem peso: só o que é dose fixa, e o aviso diz o que falta", () => {
  const r = sugerirDoses("Propofol", { idadeMeses: 480, pesoKg: null }, { unidade: "mg" });
  assert.equal(r.cartoes.length, 0);
  assert.match(r.aviso!, /peso/);
  const semIdade = sugerirDoses("Propofol", { idadeMeses: null, pesoKg: 70 }, { unidade: "mg" });
  assert.equal(semIdade.cartoes.length, 0);
  assert.match(semIdade.aviso!, /idade/);
});

test("a via da linha filtra: raqui pediátrica e anestésico local como teto", () => {
  const raqui = sugerirDoses("Bupivacaína", { idadeMeses: 18, pesoKg: 10 }, { unidade: "mg", via: "intratecal" });
  assert.deepEqual(doses(raqui, "Bupivacaína — raquianestesia pediátrica"), [4]);
  const bloqueio = sugerirDoses("Lidocaína", { idadeMeses: 60, pesoKg: 20 }, { unidade: "mg", via: "perineural" });
  assert.equal(bloqueio.cartoes.length, 0, "máximo não é dose a aplicar");
  assert.deepEqual(bloqueio.tetos.map((t) => t.dose).sort((a, b) => a - b), [100, 200]);
  // Midazolam pediátrico só existe por VO, IM, retal: na linha EV não sugere nada.
  assert.equal(sugerirDoses("Midazolam", { idadeMeses: 48, pesoKg: 16 }, { unidade: "mg", via: "EV" }).cartoes.length, 0);
});

test("sedação mostra o cartão de sedação; a bomba fica de fora", () => {
  const sed = sugerirDoses("Fentanil", adulto, { unidade: "mcg", via: "EV", contexto: "sedacao" });
  assert.deepEqual(sed.cartoes.map((c) => c.titulo), ["Fentanil — sedação e titulação"]);
  const remi = sugerirDoses("Remifentanil", { idadeMeses: 60, pesoKg: 20 }, { unidade: "mcg" });
  assert.equal(remi.cartoes.length, 0, "remifentanil é bomba, não bolus");
});

test("o nome do cartão leva ao fármaco, e a idade da ficha vira meses", () => {
  const dip = CATALOGO.find((m) => m.id === "dipirona-paracetamol-adulto")!;
  assert.deepEqual(farmacosDoCartao(dip), ["Dipirona", "Paracetamol"]);
  assert.deepEqual(farmacosDoCartao(CATALOGO.find((m) => m.id === "lidocaina-iv-adulto")!), ["Lidocaína"]);
  assert.equal(idadeEmMesesDaFicha(365, null), 11);
  assert.equal(idadeEmMesesDaFicha(null, 5), 60);
  assert.equal(arredondarDose(182.5), 183);
  assert.equal(arredondarDose(10.55), 10.6);
  assert.equal(arredondarDose(0.4567), 0.457);
});

test("TOT na criança: fórmula da idade acima de 1 ano, tabela por peso abaixo; nada no adulto", () => {
  const seis = tuboDaFicha({ idadeMeses: 78, pesoKg: 21 })!;
  assert.equal(seis.origem, "fórmula da idade");
  // 6,5 anos: 6,5/4 + 3,5 = 5,125 → 5,0 com balonete; 6,5/4 + 4 = 5,625 → 5,5 sem.
  assert.deepEqual(seis.opcoes.map((o) => o.numero), ["5,0 com balonete", "5,5 sem balonete"]);
  assert.match(seis.opcoes[0].profundidade!, /cm$/);
  const bebe = tuboDaFicha({ idadeMeses: 0, pesoKg: 2.5 })!;
  assert.equal(bebe.origem, "tabela por peso");
  assert.deepEqual(bebe.opcoes.map((o) => o.numero), ["3,0 sem balonete"]);
  assert.match(tuboDaFicha({ idadeMeses: 6, pesoKg: null })!.aviso!, /peso/);
  assert.equal(tuboDaFicha({ idadeMeses: 30 * 12, pesoKg: 70 }), null);
  assert.equal(tuboDaFicha({ idadeMeses: null, pesoKg: 20 }), null);
});

test("bomba: a faixa da tabela e, com peso e concentração, a mesma faixa em mL/h", async () => {
  const { sugerirVelocidades } = await import("./sugestoes.ts");
  // Remifentanil pediátrico 0,1–0,5 mcg/kg/min, 20 kg, seringa a 20 mcg/mL:
  // 0,1 × 20 × 60 = 120 mcg/h ÷ 20 = 6 mL/h; 0,5 → 30 mL/h.
  const r = sugerirVelocidades("Remifentanil", { idadeMeses: 60, pesoKg: 20 }, { valor: 20, unidade: "mcg/mL" });
  assert.equal(r.cartoes[0].base, "0,1–0,5 mcg/kg/min");
  assert.deepEqual(r.cartoes[0].opcoes.map((o) => [o.valor, o.unidade, o.mlPorHora]), [[0.1, "mcg/kg/min", 6], [0.5, "mcg/kg/min", 30]]);
  // Dexmedetomidina no adulto, mcg/kg/h, seringa a 4 mcg/mL, 70 kg: 0,3 × 70 ÷ 4 = 5,3 mL/h.
  const dex = sugerirVelocidades("Precedex", adulto, { valor: 4, unidade: "mcg/mL" });
  assert.deepEqual(dex.cartoes[0].opcoes.map((o) => o.mlPorHora), [5.3, 15.8]);
  // Sem concentração: a faixa aparece, o mL/h não, e o aviso diz o que falta.
  const sem = sugerirVelocidades("Remifentanil", { idadeMeses: 60, pesoKg: 20 }, null);
  assert.equal(sem.cartoes[0].opcoes[0].mlPorHora, null);
  assert.match(sem.aviso!, /concentração/);
  // Noradrenalina, 70 kg, 4 mg em 250 mL (16 mcg/mL): 0,02 × 70 × 60 ÷ 16 = 5,3 mL/h; 0,5 → 131,3 mL/h.
  const nora = sugerirVelocidades("Noradrenalina", adulto, { valor: 16, unidade: "mcg/mL" });
  assert.deepEqual(nora.cartoes[0].opcoes.map((o) => o.mlPorHora), [5.3, 131.3]);
  assert.deepEqual(nora.cartoes[0].diluicoes.map((d) => [d.valor, d.unidade]), [[16, "mcg/mL"], [32, "mcg/mL"], [64, "mcg/mL"]]);
  assert.match(nora.cartoes[0].observacao!, /hemitartarato/);
});

test("bomba por minuto sem peso: vasopressina em UI/min, nitroglicerina em mcg/min", async () => {
  const { sugerirVelocidades } = await import("./sugestoes.ts");
  // 20 UI em 100 mL (0,2 UI/mL): 0,03 UI/min × 60 ÷ 0,2 = 9 mL/h — sem peso nenhum.
  const vaso = sugerirVelocidades("Vasopressina", { idadeMeses: 600, pesoKg: null }, { valor: 0.2, unidade: "UI/mL" });
  assert.deepEqual(vaso.cartoes[0].opcoes.map((o) => [o.valor, o.unidade, o.mlPorHora]), [[0.01, "UI/min", 3], [0.04, "UI/min", 12]]);
  const ntg = sugerirVelocidades("Nitroglicerina", { idadeMeses: 600, pesoKg: null }, { valor: 200, unidade: "mcg/mL" });
  assert.deepEqual(ntg.cartoes[0].opcoes.map((o) => o.mlPorHora), [1.5, 60]);
});

test("obeso: o fármaco do peso magro sai multiplicado por ele, em mcg/min", async () => {
  const { sugerirVelocidades } = await import("./sugestoes.ts");
  const { pesoMagro } = await import("../calculos/peso.ts");
  // Homem, 170 cm, 130 kg (IMC 45): peso magro de Janmahasatian 73,5 kg.
  const obeso = { idadeMeses: 480, pesoKg: 130, alturaCm: 170, sexo: "Masculino" };
  const magro = pesoMagro({ pesoKg: 130, alturaCm: 170, sexo: "Masculino", idadeAnos: 40 })!;
  assert.equal(magro, 73.5);
  const remi = sugerirVelocidades("Remifentanil", obeso, { valor: 50, unidade: "mcg/mL" });
  const c = remi.cartoes.find((x) => /bomba/.test(x.titulo))!;
  assert.match(c.base, /peso magro 73,5 kg/);
  // 0,05 × 73,5 = 3,68 mcg/min (pelo peso da balança seriam 6,5); × 60 ÷ 50 = 4,4 mL/h.
  assert.deepEqual(c.opcoes.map((o) => [o.unidade, o.mlPorHora]), [["mcg/min", 4.4], ["mcg/min", 44.1]]);
  assert.ok(Math.abs(c.opcoes[0].valor - 0.05 * magro) < 0.01);
  // A noradrenalina vai pelo peso atual: continua em mcg/kg/min.
  const nora = sugerirVelocidades("Noradrenalina", obeso, null);
  assert.equal(nora.cartoes[0].opcoes[0].unidade, "mcg/kg/min");
});

test("obeso: o rocurônio da ficha sai pelo peso ideal, e a succinilcolina pelo atual", async () => {
  const { sugerirDoses } = await import("./sugestoes.ts");
  const obeso = { idadeMeses: 480, pesoKg: 130, alturaCm: 170, sexo: "Masculino" };
  const roc = sugerirDoses("Rocurônio", obeso, { unidade: "mg", via: "EV" });
  const intub = roc.cartoes.find((c) => c.titulo === "Rocurônio — intubação")!;
  // Peso ideal (Devine) 65,9 kg × 0,6 = 39,5 mg — e não 78 mg pelo peso da balança.
  assert.match(intub.base, /peso ideal 65,9 kg/);
  assert.deepEqual(intub.doses.map((d) => d.dose), [39.5]);
  const sux = sugerirDoses("Succinilcolina", obeso, { unidade: "mg", via: "EV" });
  assert.ok(sux.cartoes.every((c) => !/peso ideal|peso magro/.test(c.base)));
  // Sem altura: a conta usa o peso atual e diz por quê.
  const semAltura = sugerirDoses("Rocurônio", { idadeMeses: 480, pesoKg: 130 }, { unidade: "mg", via: "EV" });
  assert.match(semAltura.cartoes.find((c) => c.titulo === "Rocurônio — intubação")!.observacao!, /Sem altura e sexo/);
});

test("emulsão lipídica na ficha em mL, dantroleno pelo peso da balança, ocitocina na bomba em UI/h", async () => {
  const { sugerirVelocidades } = await import("./sugestoes.ts");
  // A ficha escreve a emulsão em mL: 1,5 mL/kg, 60 kg → 90 mL; com 90 kg, o teto de 100 mL.
  const lip = sugerirDoses("Emulsão lipídica 20%", { idadeMeses: 480, pesoKg: 60 }, { unidade: "mL", via: "EV" });
  assert.deepEqual(lip.cartoes.map((c) => [c.titulo, c.doses.map((d) => [d.dose, d.unidade])]),
    [["Emulsão lipídica 20% — bolus", [[90, "mL"]]]]);
  const grande = sugerirDoses("Intralipid", { idadeMeses: 480, pesoKg: 90 }, { unidade: "mL", via: "EV" });
  assert.equal(grande.cartoes[0].doses[0].dose, 100);
  // Dantroleno: 2,5 × 80 = 200 mg.
  const dan = sugerirDoses("Dantrolen", { idadeMeses: 480, pesoKg: 80 }, { unidade: "mg", via: "EV" });
  assert.equal(dan.cartoes[0].doses[0].dose, 200);
  // Ocitocina: bomba sem peso, 20 UI em 500 mL (0,04 UI/mL): 2,5 UI/h = 62,5 mL/h.
  const oci = sugerirVelocidades("Ocitocina", { idadeMeses: 360, pesoKg: null }, { valor: 0.04, unidade: "UI/mL" });
  assert.deepEqual(oci.cartoes[0].opcoes.map((o) => [o.valor, o.unidade, o.mlPorHora]),
    [[2.5, "UI/h", 62.5], [7.5, "UI/h", 187.5], [15, "UI/h", 375]]);
});

test("antibiótico na criança (17/11/2026): ceftriaxona 50–80 mg/kg/dia em g, metronidazol 7,5 mg/kg/dose, com o teto do adulto", () => {
  const crianca = { idadeMeses: 72, pesoKg: 20 };
  const cef = sugerirDoses("Ceftriaxona", crianca, { unidade: "g", via: "EV" });
  assert.equal(cef.populacao, "crianca");
  assert.deepEqual(doses(cef, "Ceftriaxona"), [1, 1.6]);
  assert.equal(cef.cartoes[0].doses[0].unidade, "g");
  assert.match(cef.cartoes[0].observacao!, /24\/24 h/);
  const met = sugerirDoses("Metronidazol", crianca, { unidade: "mg", via: "EV" });
  assert.deepEqual(doses(met, "Metronidazol"), [150]);
  assert.match(met.cartoes[0].observacao!, /8\/8 h/);
  // Lactente também.
  assert.deepEqual(doses(sugerirDoses("Rocefin", { idadeMeses: 8, pesoKg: 8 }, { unidade: "g", via: "EV" }), "Ceftriaxona"), [0.4, 0.64]);
  // A criança grande não passa da dose do adulto: 4 g por dia, 500 mg por dose.
  const grande = { idadeMeses: 132, pesoKg: 70 };
  const cefGrande = sugerirDoses("Ceftriaxona", grande, { unidade: "g", via: "EV" });
  assert.deepEqual(doses(cefGrande, "Ceftriaxona"), [3.5, 4]);
  assert.equal(cefGrande.cartoes[0].doses[1].limitada, true);
  assert.deepEqual(doses(sugerirDoses("Flagyl", grande, { unidade: "mg", via: "EV" }), "Metronidazol"), [500]);
  // Neonato fica de fora (contraindicações próprias da ceftriaxona).
  assert.equal(sugerirDoses("Ceftriaxona", { idadeMeses: 0.5, pesoKg: 3.2 }, { unidade: "g", via: "EV" }).cartoes.length, 0);
});

test("a tabela pediátrica do serviço (17/11/2026): dose por quilo, teto do adulto ou o da criança, e o limite de idade da bula", () => {
  const seis = { idadeMeses: 72, pesoKg: 20 };
  const d = (nome: string, unidade: "mg" | "g", p = seis) => {
    const r = sugerirDoses(nome, p, { unidade, via: "EV" });
    return r.cartoes.flatMap((c) => c.doses.map((x) => x.dose));
  };
  assert.deepEqual(d("Kefazol", "g"), [0.6]);
  assert.deepEqual(d("Ondansetrona", "mg"), [1, 2, 3]);
  assert.deepEqual(d("Dexametasona", "mg"), [2, 3]);
  assert.deepEqual(d("Dipirona", "g"), [0.4, 0.6]);
  assert.deepEqual(d("Atropina", "mg"), [0.4]);
  // A neostigmina da criança tem número na ficha (0,04 mg/kg, a pedido do serviço).
  assert.deepEqual(d("Neostigmina", "mg"), [0.8]);
  assert.deepEqual(d("Transamin", "g"), [0.2, 0.3]);
  assert.deepEqual(d("Hidrocortisona", "mg"), [30, 40]);
  assert.deepEqual(d("Plasil", "mg"), [3]);
  // Os tetos: ondansetrona 4 mg e dexametasona 5 mg da criança; dipirona 1 g; atropina 0,5 mg.
  const grande = { idadeMeses: 132, pesoKg: 45 };
  assert.deepEqual(d("Ondansetrona", "mg", grande), [2.25, 4]);
  assert.deepEqual(d("Dexametasona", "mg", grande), [4.5, 5]);
  assert.deepEqual(d("Dipirona", "g", grande), [0.9, 1]);
  assert.deepEqual(d("Atropina", "mg", grande), [0.5]);
  // Abaixo de 1 ano: sem dipirona na veia e sem metoclopramida.
  const lactente = { idadeMeses: 8, pesoKg: 8 };
  assert.deepEqual(d("Dipirona", "g", lactente), []);
  assert.deepEqual(d("Metoclopramida", "mg", lactente), []);
  assert.deepEqual(d("Atropina", "mg", lactente), [0.16]);
  // O adulto: neostigmina 0,04 mg/kg desde 17/11/2026 (70 kg → 2,8 mg); ondansetrona 8 mg.
  assert.deepEqual(d("Neostigmina", "mg", adulto), [2.8]);
  assert.deepEqual(d("Ondansetrona", "mg", adulto), [4, 8]);
});

test("antibiótico no adulto (17/11/2026): ceftriaxona ataque 2 g e manutenção 1 g, metronidazol 500 mg, sem olhar o peso", () => {
  for (const p of [adulto, { idadeMeses: 600, pesoKg: 130 }, { idadeMeses: 600, pesoKg: null }]) {
    const cef = sugerirDoses("Rocefin", p, { unidade: "g", via: "EV" });
    assert.deepEqual(cef.cartoes.map((c) => [c.titulo, c.doses.map((d) => d.dose)]),
      [["Ceftriaxona — ataque", [2]], ["Ceftriaxona — manutenção", [1]]]);
    assert.equal(cef.cartoes[0].doses[0].unidade, "g");
    assert.deepEqual(doses(sugerirDoses("Flagyl", p, { unidade: "mg", via: "EV" }), "Metronidazol"), [500]);
  }
  // A criança continua com a dose por quilo.
  assert.deepEqual(doses(sugerirDoses("Ceftriaxona", { idadeMeses: 72, pesoKg: 20 }, { unidade: "g", via: "EV" }), "Ceftriaxona"), [1, 1.6]);
});

test("descurarização no adulto (17/11/2026): neostigmina 0,04 e atropina 0,02 mg/kg, com o aviso da monitorização", () => {
  // A ficha não dava número de neostigmina no adulto, e a atropina só a de bradicardia (0,5–1 mg).
  const p72 = { idadeMeses: 59 * 12, pesoKg: 72 };
  const neo = sugerirDoses("Neostigmina", p72, { unidade: "mg", via: "EV" });
  assert.deepEqual(neo.cartoes.map((c) => [c.titulo, c.doses.map((x) => x.dose)]), [["Neostigmina — descurarização", [2.88]]]);
  // O nome que o serviço usa (17/11/2026: "Descurarizar").
  assert.ok(neo.cartoes.every((c) => /descurarização/.test(c.titulo)));
  assert.match(neo.cartoes[0].observacao!, /monitorização neuromuscular[\s\S]*atropina 0,02 mg\/kg/);
  const atr = sugerirDoses("Atropina", p72, { unidade: "mg", via: "EV" });
  assert.deepEqual(atr.cartoes.map((c) => [c.titulo, c.doses.map((x) => x.dose)]),
    [["Atropina — descurarização", [1.44]], ["Atropina — bradicardia", [0.5, 1]]]);
  // O teto de 5 mg da neostigmina continua (150 kg daria 6 mg).
  const pesado = sugerirDoses("Prostigmine", { idadeMeses: 480, pesoKg: 150 }, { unidade: "mg", via: "EV" });
  assert.equal(pesado.cartoes[0].doses[0].dose, 5);
  assert.equal(pesado.cartoes[0].doses[0].limitada, true);
  // A atropina é a metade, na dose e no teto (18/11/2026): 150 kg daria 3 mg; para em 2,5 mg.
  const atrPesado = sugerirDoses("Atropina", { idadeMeses: 480, pesoKg: 150 }, { unidade: "mg", via: "EV" });
  const desc = atrPesado.cartoes.find((c) => c.titulo === "Atropina — descurarização")!;
  assert.equal(desc.doses[0].dose, 2.5);
  assert.equal(desc.doses[0].limitada, true);
  assert.match(desc.observacao!, /Máximo de 2,5 mg, a metade dos 5 mg da neostigmina/);
});

test("criança (18/11/2026): o que o adulto escreve em grama vai em mg, e cada dose diz o volume em mL", async () => {
  const { unidadeDaLinha } = await import("./sugestoes.ts");
  const fs = await import("node:fs");
  // 3 anos, 14 kg: dipirona 280–420 mg, e não 0,28–0,42 g; 500 mg/mL → 0,56–0,84 mL.
  assert.equal(unidadeDaLinha("g", 36), "mg");
  assert.equal(unidadeDaLinha("g", 8), "mg");
  assert.equal(unidadeDaLinha("g", 480), "g", "no adulto continua em grama");
  assert.equal(unidadeDaLinha("g", null), "g", "sem idade, a da lista");
  assert.equal(unidadeDaLinha("mcg", 36), "mcg");
  const dip = sugerirDoses("Dipirona", { idadeMeses: 36, pesoKg: 14 }, { unidade: unidadeDaLinha("g", 36), via: "EV" });
  assert.deepEqual(dip.cartoes[0].doses.map((d) => [d.dose, d.unidade, d.volumeMl]), [[280, "mg", 0.56], [420, "mg", 0.84]]);
  assert.equal(dip.cartoes[0].apresentacao, "500 mg/mL (1 g em 2 mL)");
  // A fonte diz que a tabela é a pediátrica, e não "do adulto".
  assert.match(dip.cartoes[0].fonte, /Tabela de doses pediátricas do serviço/);
  // No adulto também: 1 g de dipirona = 2 mL; a emulsão lipídica, que a ficha já escreve em mL, não ganha volume.
  const adulto = sugerirDoses("Dipirona", { idadeMeses: 480, pesoKg: 70 }, { unidade: "g", via: "EV" });
  assert.equal(adulto.cartoes.find((c) => c.titulo === "Dipirona")!.doses[0].volumeMl, 2);
  const lip = sugerirDoses("Emulsão lipídica 20%", { idadeMeses: 480, pesoKg: 60 }, { unidade: "mL", via: "EV" });
  assert.equal(lip.cartoes[0].doses[0].volumeMl, undefined);
  // A ficha e a janela usam a unidade do paciente; o botão mostra o volume.
  const ler = (c: string) => fs.readFileSync(new URL(`../../${c}`, import.meta.url), "utf8");
  assert.match(ler("components/evolucao/folha-anestesica.tsx"), /const it = \{ \.\.\.daLista, unidade: unidadeDaLinha\(daLista\.unidade, pacienteDaDose\.idadeMeses\) \};/);
  assert.match(ler("components/evolucao/janela-medicamento.tsx"), /setUnidade\(unidadeDaLinha\(i\.unidade, paciente\?\.idadeMeses \?\? null\)\);/);
  assert.match(ler("components/evolucao/sugestoes-de-dose.tsx"), /<span className="evoSugMl">\{fmt\(d\.volumeMl\)\} mL<\/span>/);
});

test("criança (18/11/2026): o máximo do anestésico local e a raqui também em mL", async () => {
  const fs = await import("node:fs");
  const c = { idadeMeses: 36, pesoKg: 14 };
  // Bupivacaína sem vasoconstritor, 2 mg/kg × 14 = 28 mg: 5,6 mL a 0,5%, 11,2 mL a 0,25%.
  const bupi = sugerirDoses("Bupivacaína", c, { unidade: "mg", via: "perineural" });
  const sem = bupi.tetos.find((t) => t.dose === 28)!;
  assert.deepEqual(sem.volumes?.slice(0, 2), [{ mL: 5.6, rotulo: "0,5%" }, { mL: 11.2, rotulo: "0,25%" }]);
  // Raqui: 5,6 mg de bupivacaína pesada 0,5% = 1,12 mL.
  const raqui = sugerirDoses("Bupivacaína", c, { unidade: "mg", via: "intratecal" });
  assert.equal(raqui.cartoes[0].doses[0].volumeMl, 1.12);
  assert.equal(raqui.cartoes[0].apresentacao, "Bupivacaína pesada 0,5%");
  const tela = fs.readFileSync(new URL("../../components/evolucao/sugestoes-de-dose.tsx", import.meta.url), "utf8");
  assert.match(tela, /t\.volumes\.map\(\(v\) => `\$\{fmt\(v\.mL\)\} mL a \$\{v\.rotulo\}`\)\.join\(" · "\)/);
});
