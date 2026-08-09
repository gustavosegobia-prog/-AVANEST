import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  acharMedicamento,
  buscar,
  calcular,
  calcularNivel,
  CATALOGO,
  converter,
  dePercentual,
  disponiveis,
  doseDe,
  escreverApresentacao,
  GRUPOS,
  IDADE_ADULTO_ANOS,
  populacaoPor,
  porMl,
  volumeMaximo,
  type Apresentacao,
  type DosePorKg,
} from "./doses.ts";

/* O que estes testes protegem é a unidade. Errar mg por mcg num cálculo de
   dose é o defeito que não dá para corrigir depois. */

const mg10 = (): Apresentacao => ({ rotulo: "10 mg/mL", quantidade: 10, unidade: "mg", mL: 1 });
const mcg50 = (): Apresentacao => ({ rotulo: "50 mcg/mL", quantidade: 50, unidade: "mcg", mL: 1 });

test("massa converte entre si, e o resto não converte de jeito nenhum", () => {
  assert.equal(converter(1, "mg", "mcg"), 1000);
  assert.equal(converter(500, "mcg", "mg"), 0.5);
  assert.equal(converter(1, "g", "mg"), 1000);
  assert.equal(converter(2, "mg", "mg"), 2);
  assert.equal(converter(10, "UI", "mg"), undefined);
  assert.equal(converter(10, "mEq", "mg"), undefined);
  assert.equal(converter(10, "UI", "UI"), 10, "mesma unidade sempre passa");
});

test("o exemplo do propofol: 70 kg, 2 mg/kg, 10 mg/mL, 14 mL", () => {
  const dose: DosePorKg = { usual: 2, unidade: "mg", por: "kg" };
  const c = calcularNivel("usual", 2, dose, 70, mg10())!;
  assert.equal(c.doseTotal, 140);
  assert.equal(c.unidadeDose, "mg");
  assert.equal(c.volumeMl, 14);
});

test("o exemplo do fentanil: 70 kg, 3 mcg/kg, 50 mcg/mL, 4,2 mL", () => {
  const dose: DosePorKg = { usual: 3, unidade: "mcg", por: "kg" };
  const c = calcularNivel("usual", 3, dose, 70, mcg50())!;
  assert.equal(c.doseTotal, 210);
  assert.equal(c.unidadeDose, "mcg", "mcg continua mcg até o fim");
  assert.equal(c.volumeMl, 4.2);
});

test("dose em mcg com apresentação em mg dá o mesmo volume, sem virar erro de mil vezes", () => {
  const dose: DosePorKg = { usual: 3, unidade: "mcg", por: "kg" };
  const emMg: Apresentacao = { rotulo: "0,05 mg/mL", quantidade: 0.05, unidade: "mg", mL: 1 };
  const c = calcularNivel("usual", 3, dose, 70, emMg)!;
  assert.equal(c.doseTotal, 210, "a dose continua em mcg");
  assert.equal(c.volumeMl, 4.2, "a conversão acontece só na divisão");
});

test("unidade incompatível não produz volume: produz a explicação", () => {
  const dose: DosePorKg = { usual: 10, unidade: "UI", por: "kg" };
  const c = calcularNivel("usual", 10, dose, 70, mg10())!;
  assert.equal(c.volumeMl, undefined);
  assert.match(c.incompatibilidade!, /sem equivalência/);
  assert.equal(c.doseTotal, 700, "a dose total continua saindo");
});

test("porcentagem vira mg/mL na conta certa, e não na errada", () => {
  const lido2 = dePercentual(2)!;
  assert.equal(porMl(lido2), 20, "2% é 20 mg/mL, não 2");
  assert.equal(dePercentual(0.5)!.quantidade, 5);
  assert.equal(dePercentual(0.75)!.quantidade, 7.5);
  assert.equal(dePercentual(0), undefined);
  assert.equal(escreverApresentacao(lido2), "20 mg/mL");
});

test("volume máximo de anestésico local sai do teto por quilo", () => {
  // 7 mg/kg em 70 kg = 490 mg; a 20 mg/mL, 24,5 mL.
  const dose: DosePorKg = { max: 7, unidade: "mg", por: "kg" };
  const c = volumeMaximo(dose, 70, dePercentual(2)!)!;
  assert.equal(c.doseTotal, 490);
  assert.equal(c.volumeMl, 24.5);
});

test("o teto absoluto corta a dose do peso, e diz que cortou", () => {
  const dose: DosePorKg = { usual: 0.02, unidade: "mg", por: "kg" };
  const c = calcularNivel("usual", 0.02, dose, 300, mg10(), { valor: 5, unidade: "mg" })!;
  assert.equal(c.doseTotal, 5);
  assert.equal(c.limitada, true);
  assert.equal(c.doseAntesDoTeto, 6);
  assert.equal(c.volumeMl, 0.5);
});

test("abaixo do teto, nada é cortado", () => {
  const dose: DosePorKg = { usual: 0.02, unidade: "mg", por: "kg" };
  const c = calcularNivel("usual", 0.02, dose, 70, mg10(), { valor: 5, unidade: "mg" })!;
  assert.equal(c.doseTotal, 1.4);
  assert.equal(c.limitada, undefined);
});

test("o teto vale mesmo quando vem em outra unidade de massa", () => {
  const dose: DosePorKg = { usual: 50, unidade: "mcg", por: "kg" };
  const c = calcularNivel("usual", 50, dose, 100, undefined, { valor: 1, unidade: "mg" })!;
  assert.equal(c.doseTotal, 1000, "1 mg vira 1000 mcg");
  assert.equal(c.limitada, true);
  assert.equal(c.doseAntesDoTeto, 5000);
});

test("faixa cadastrada devolve os três níveis, na ordem", () => {
  const dose: DosePorKg = { min: 1.5, usual: 2, max: 3, unidade: "mg", por: "kg" };
  const r = calcular(dose, 20, mg10());
  assert.deepEqual(r.map((c) => c.nivel), ["minima", "usual", "maxima"]);
  assert.deepEqual(r.map((c) => c.doseTotal), [30, 40, 60]);
  assert.deepEqual(r.map((c) => c.volumeMl), [3, 4, 6]);
});

test("dose com um valor só devolve um nível", () => {
  assert.equal(calcular({ usual: 2, unidade: "mg", por: "kg" }, 20, mg10()).length, 1);
  assert.equal(calcular({ min: 1, max: 2, unidade: "mg", por: "kg" }, 20, mg10()).length, 2);
});

test("peso ausente, zero ou negativo não calcula nada", () => {
  const dose: DosePorKg = { usual: 2, unidade: "mg", por: "kg" };
  assert.equal(calcularNivel("usual", 2, dose, 0, mg10()), undefined);
  assert.equal(calcularNivel("usual", 2, dose, -5, mg10()), undefined);
  assert.equal(calcularNivel("usual", 2, dose, Number.NaN, mg10()), undefined);
  assert.equal(calcular(dose, 0, mg10()).length, 0);
});

test("sem apresentação, sai a dose e não sai o volume", () => {
  const c = calcularNivel("usual", 2, { usual: 2, unidade: "mg", por: "kg" }, 70)!;
  assert.equal(c.doseTotal, 140);
  assert.equal(c.volumeMl, undefined);
});

test("infusão contínua carrega o por: kg/h até a tela", () => {
  const c = calcularNivel("usual", 0.05, { usual: 0.05, unidade: "mg", por: "kg/h" }, 70, mg10())!;
  assert.equal(c.por, "kg/h");
  assert.equal(c.doseTotal, 3.5);
});

test("a apresentação pode vir em frasco, não só em ampola de 1 mL", () => {
  const frasco: Apresentacao = { rotulo: "500 mg / 10 mL", quantidade: 500, unidade: "mg", mL: 10 };
  assert.equal(porMl(frasco), 50);
  const c = calcularNivel("usual", 30, { usual: 30, unidade: "mg", por: "kg" }, 17, frasco)!;
  assert.equal(c.doseTotal, 510);
  assert.equal(c.volumeMl, 10.2);
});

test("a idade decide a população, sem ninguém escolher", () => {
  assert.equal(populacaoPor(3), "pediatrico");
  assert.equal(populacaoPor(11), "pediatrico");
  assert.equal(populacaoPor(IDADE_ADULTO_ANOS), "adulto");
  assert.equal(populacaoPor(70), "adulto");
  assert.equal(populacaoPor(0), "pediatrico", "recém-nascido é pediátrico");
  assert.equal(populacaoPor(undefined), undefined);
  assert.equal(populacaoPor(-1), undefined);
});

test("adulto e pediátrico são registros separados: um não empresta do outro", () => {
  for (const m of CATALOGO) {
    const a = doseDe(m, "adulto");
    const p = doseDe(m, "pediatrico");
    assert.ok(a || p, `${m.nome} sem dose nenhuma`);
    if (a && p) assert.notEqual(a, p, `${m.nome}: adulto e pediátrico apontam para o mesmo objeto`);
  }
  // Nenhum dos cadastrados hoje tem dose pediátrica: a fonte só traz adulto.
  assert.equal(disponiveis("pediatrico").length, 0);
  assert.ok(disponiveis("adulto").length > 0);
});

test("toda entrada do catálogo tem fonte, via, apresentação e revisão", () => {
  for (const m of CATALOGO) {
    assert.ok(m.fonte?.obra, `${m.nome} sem obra`);
    assert.match(m.fonte!.local, /p\. \d+/, `${m.nome} sem página`);
    assert.ok(m.via.trim().length >= 2, `${m.nome} sem via`);
    assert.ok(m.apresentacoes.length > 0, `${m.nome} sem apresentação`);
    assert.match(m.revisao ?? "", /\d{2}\/\d{2}\/\d{4}/, `${m.nome} sem data de revisão`);
    assert.equal(m.situacao, "validado", `${m.nome} não validado`);
    assert.ok(GRUPOS.some((g) => g.id === m.grupo), `${m.nome} em grupo desconhecido`);
  }
});

test("a busca filtra sem exigir acerto de maiúscula", () => {
  const lista = disponiveis("adulto");
  assert.ok(buscar("fenta", lista).length >= 2);
  assert.ok(buscar("MORFINA", lista).length >= 2);
  assert.equal(buscar("propofol", lista).length, 0, "o que não está cadastrado não aparece");
  assert.equal(buscar("", lista).length, lista.length);
});

test("a morfina do catálogo reproduz a dose da fonte", () => {
  const m = acharMedicamento("morfina-bolo")!;
  const c = calcular(m.adulto!, 70, m.apresentacoes[0])!;
  assert.equal(c[0].doseTotal, 10.5, "0,15 mg/kg em 70 kg");
  assert.equal(c[0].volumeMl, 1.05);
});
