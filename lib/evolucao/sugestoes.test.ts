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
  assert.deepEqual(doses(ond, "Ondansetrona"), [4]);
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

test("sedação mostra o cartão de sedação; neostigmina e bomba ficam de fora", () => {
  const sed = sugerirDoses("Fentanil", adulto, { unidade: "mcg", via: "EV", contexto: "sedacao" });
  assert.deepEqual(sed.cartoes.map((c) => c.titulo), ["Fentanil — sedação e titulação"]);
  assert.equal(sugerirDoses("Neostigmina", adulto, { unidade: "mg" }).cartoes.length, 0);
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
