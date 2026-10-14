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
