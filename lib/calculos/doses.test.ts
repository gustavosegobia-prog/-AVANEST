import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  acharMedicamento,
  APRESENTACAO_BUPIVACAINA_PESADA,
  buscar,
  bupivacainaIntratecal,
  calcular,
  calcularNivel,
  CATALOGO,
  conferirAnestesicoLocal,
  conferirClonidina,
  converter,
  dePercentual,
  disponiveis,
  emMeses,
  escreverApresentacao,
  faixaEtaria,
  FAIXA_GERAL_BUPIVACAINA_IT,
  GRUPOS,
  MESES_ADULTO,
  MESES_LACTENTE,
  PENDENTES,
  porMl,
  RAQUI_REMOVIDA,
  virgula,
  type Apresentacao,
  type DosePorKg,
  type Populacao,
} from "./doses.ts";

/* O que estes testes protegem é a unidade e a faixa etária. Errar mg por mcg,
   ou dar dose de criança maior a um lactente, são os defeitos que não dão
   para corrigir depois. */

const mg10 = (): Apresentacao => ({ rotulo: "10 mg/mL", quantidade: 10, unidade: "mg", mL: 1 });
const mcg50 = (): Apresentacao => ({ rotulo: "50 mcg/mL", quantidade: 50, unidade: "mcg", mL: 1 });

/* ---------------- unidades ---------------- */

test("massa converte entre si, e o resto não converte de jeito nenhum", () => {
  assert.equal(converter(1, "mg", "mcg"), 1000);
  assert.equal(converter(500, "mcg", "mg"), 0.5);
  assert.equal(converter(1, "g", "mg"), 1000);
  assert.equal(converter(10, "UI", "mg"), undefined);
  assert.equal(converter(10, "mEq", "mg"), undefined);
  assert.equal(converter(10, "UI", "UI"), 10);
});

test("a tabela de porcentagens do material bate inteira", () => {
  const esperado: Array<[number, number]> = [
    [0.125, 1.25], [0.2, 2], [0.25, 2.5], [0.375, 3.75],
    [0.5, 5], [0.75, 7.5], [1, 10], [2, 20],
  ];
  for (const [pct, mgml] of esperado) {
    assert.equal(porMl(dePercentual(pct)!), mgml, `${pct}% deveria dar ${mgml} mg/mL`);
  }
  assert.equal(dePercentual(0), undefined);
});

test("unidade incompatível não produz volume: produz a explicação", () => {
  const c = calcularNivel("usual", 10, { usual: 10, unidade: "UI", por: "kg" }, 70, mg10())!;
  assert.equal(c.volume, undefined);
  assert.match(c.incompatibilidade!, /sem equivalência/);
  assert.equal(c.doseTotal, 700);
});

test("dose em mcg com apresentação em mg não vira erro de mil vezes", () => {
  const emMg: Apresentacao = { rotulo: "0,05 mg/mL", quantidade: 0.05, unidade: "mg", mL: 1 };
  const c = calcularNivel("usual", 3, { usual: 3, unidade: "mcg", por: "kg" }, 70, emMg)!;
  assert.equal(c.doseTotal, 210, "a dose continua em mcg");
  assert.equal(c.volume, 4.2);
});

/* ---------------- os exemplos do material ---------------- */

test("propofol pediátrico, 17 kg: 34 a 85 mg, 3,4 a 8,5 mL", () => {
  const m = acharMedicamento("propofol-ped")!;
  const r = calcular(m.dose!, 17, m.apresentacoes[0]);
  assert.deepEqual(r.map((c) => c.doseTotal), [34, 85]);
  assert.deepEqual(r.map((c) => c.volume), [3.4, 8.5]);
  assert.deepEqual(r.map((c) => c.unidadeVolume), ["mL", "mL"]);
});

test("fentanil pediátrico, 17 kg: 17 a 51 mcg, 0,34 a 1,02 mL", () => {
  const m = acharMedicamento("fentanil-ped")!;
  const r = calcular(m.dose!, 17, m.apresentacoes[0]);
  assert.deepEqual(r.map((c) => c.doseTotal), [17, 51]);
  assert.deepEqual(r.map((c) => c.volume), [0.34, 1.02]);
});

test("rocurônio na criança, 17 kg: 10,2 a 20,4 mg, 1,02 a 2,04 mL", () => {
  const m = acharMedicamento("rocuronio-crianca")!;
  const r = calcular(m.dose!, 17, m.apresentacoes[0]);
  assert.deepEqual(r.map((c) => c.doseTotal), [10.2, 20.4]);
  assert.deepEqual(r.map((c) => c.volume), [1.02, 2.04]);
});

test("remifentanil na bomba: 70 kg, 0,1 mcg/kg/min, 50 mcg/mL, 8,4 mL/h", () => {
  const m = acharMedicamento("remifentanil-ped")!;
  const c = calcularNivel("minima", 0.1, m.dose!, 70, m.apresentacoes[0])!;
  assert.equal(c.doseTotal, 7, "7 mcg por minuto");
  assert.equal(c.dosePorHora, 420, "420 mcg por hora");
  assert.equal(c.volume, 8.4);
  assert.equal(c.unidadeVolume, "mL/h");
});

test("bomba em mcg/kg/h não multiplica por 60 de novo", () => {
  const c = calcularNivel("usual", 0.5, { usual: 0.5, unidade: "mcg", por: "kg/h" }, 20, { rotulo: "4 mcg/mL", quantidade: 4, unidade: "mcg", mL: 1 })!;
  assert.equal(c.doseTotal, 10);
  assert.equal(c.dosePorHora, 10);
  assert.equal(c.volume, 2.5);
  assert.equal(c.unidadeVolume, "mL/h");
});

/* ---------------- teto absoluto ---------------- */

test("o midazolam oral respeita o teto de 20 mg e diz que cortou", () => {
  const m = acharMedicamento("midazolam-ped-vo")!;
  const r = calcular(m.dose!, 60, m.apresentacoes[0], m.tetoAbsoluto);
  const maxima = r.find((c) => c.nivel === "maxima")!;
  assert.equal(maxima.doseTotal, 20);
  assert.equal(maxima.limitada, true);
  assert.equal(maxima.doseAntesDoTeto, 30);
  assert.equal(maxima.volume, 4);
});

test("o midazolam intramuscular tem teto próprio, de 7,5 mg", () => {
  const m = acharMedicamento("midazolam-ped-im")!;
  assert.deepEqual(m.tetoAbsoluto, { valor: 7.5, unidade: "mg" });
  const r = calcular(m.dose!, 80, m.apresentacoes[0], m.tetoAbsoluto);
  assert.equal(r.at(-1)!.doseTotal, 7.5);
});

test("abaixo do teto nada é cortado", () => {
  const m = acharMedicamento("midazolam-ped-vo")!;
  const r = calcular(m.dose!, 17, m.apresentacoes[0], m.tetoAbsoluto);
  assert.equal(r.every((c) => c.limitada === undefined), true);
});

/* ---------------- faixa etária ---------------- */

test("a idade escolhe a faixa sozinha, nas quatro categorias", () => {
  assert.equal(faixaEtaria(0), "neonato");
  assert.equal(faixaEtaria(1), "lactente");
  assert.equal(faixaEtaria(MESES_LACTENTE), "lactente");
  assert.equal(faixaEtaria(MESES_LACTENTE + 1), "crianca");
  assert.equal(faixaEtaria(MESES_ADULTO - 1), "crianca");
  assert.equal(faixaEtaria(MESES_ADULTO), "adulto");
  assert.equal(faixaEtaria(undefined), undefined);
  assert.equal(faixaEtaria(-1), undefined);
});

test("anos e meses somam, e um sozinho já basta", () => {
  assert.equal(emMeses(3, 0), 36);
  assert.equal(emMeses(0, 8), 8);
  assert.equal(emMeses(1, 6), 18);
  assert.equal(emMeses(undefined, 8), 8);
  assert.equal(emMeses(undefined, undefined), undefined);
});

test("lactente e criança recebem doses diferentes de rocurônio", () => {
  const lactente = acharMedicamento("rocuronio-lact")!;
  const crianca = acharMedicamento("rocuronio-crianca")!;
  assert.deepEqual([lactente.dose!.min, lactente.dose!.max], [0.25, 0.5]);
  assert.deepEqual([crianca.dose!.min, crianca.dose!.max], [0.6, 1.2]);
  assert.equal(lactente.populacoes.includes("crianca"), false);
  assert.equal(crianca.populacoes.includes("lactente"), false);
});

test("succinilcolina e cisatracúrio também mudam com a faixa", () => {
  assert.equal(acharMedicamento("succinilcolina-lact")!.dose!.usual, 3);
  assert.deepEqual(
    [acharMedicamento("succinilcolina-crianca")!.dose!.min, acharMedicamento("succinilcolina-crianca")!.dose!.max],
    [1.5, 2],
  );
  assert.equal(acharMedicamento("cisatracurio-lact")!.dose!.usual, 0.1);
  assert.deepEqual(
    [acharMedicamento("cisatracurio-crianca")!.dose!.min, acharMedicamento("cisatracurio-crianca")!.dose!.max],
    [0.1, 0.2],
  );
});

test("cada faixa só recebe o que foi cadastrado para ela", () => {
  const faixas: Populacao[] = ["neonato", "lactente", "crianca", "adulto"];
  for (const f of faixas) {
    const lista = disponiveis(f);
    assert.ok(lista.length > 0, `${f} sem nenhum medicamento`);
    for (const m of lista) assert.ok(m.populacoes.includes(f), `${m.nome} não é de ${f}`);
  }
  // O rocurônio de sequência rápida do adulto não pode aparecer no lactente.
  assert.equal(disponiveis("lactente").some((m) => m.id === "rocuronio-rsi-adulto"), false);
});

/* ---------------- vias e indicações separadas ---------------- */

test("cetamina tem um cartão por via, e os números não se misturam", () => {
  assert.deepEqual([acharMedicamento("cetamina-ped-iv")!.dose!.min, acharMedicamento("cetamina-ped-iv")!.dose!.max], [1, 4]);
  assert.deepEqual([acharMedicamento("cetamina-ped-im")!.dose!.min, acharMedicamento("cetamina-ped-im")!.dose!.max], [6, 10]);
  assert.deepEqual([acharMedicamento("cetamina-ped-vo")!.dose!.min, acharMedicamento("cetamina-ped-vo")!.dose!.max], [3, 6]);
});

test("midazolam tem quatro vias cadastradas separadamente", () => {
  const vias = CATALOGO.filter((m) => m.id.startsWith("midazolam-ped")).map((m) => m.via);
  assert.deepEqual(vias.sort(), ["IM", "Retal", "Sublingual", "VO"]);
});

test("clonidina se separa por indicação, e nenhuma delas em miligrama", () => {
  const clonidinas = CATALOGO.filter((m) => /clonidina/i.test(m.nome));
  assert.ok(clonidinas.length >= 4);
  for (const c of clonidinas) {
    assert.equal(c.dose!.unidade, "mcg", `${c.nome} deveria ser mcg`);
    assert.equal(conferirClonidina(c.nome, c.dose!.unidade), undefined);
  }
  assert.match(conferirClonidina("Clonidina intratecal", "mg")!, /nunca em mg\/kg/);
});

/* ---------------- barreiras de concentração ---------------- */

test("bupivacaína pesada a 5% é barrada, e a 0,5% passa", () => {
  assert.equal(porMl(APRESENTACAO_BUPIVACAINA_PESADA), 5);
  assert.equal(conferirAnestesicoLocal("Bupivacaína pesada", APRESENTACAO_BUPIVACAINA_PESADA), undefined);
  const erro = conferirAnestesicoLocal("Bupivacaína pesada", dePercentual(5)!);
  assert.match(erro!, /5 mg\/mL/);
  assert.match(erro!, /0,5%/);
});

test("qualquer local acima de 2% é acusado como concentração implausível", () => {
  assert.match(conferirAnestesicoLocal("Lidocaína", dePercentual(5)!)!, /acima de qualquer apresentação usual/);
  assert.equal(conferirAnestesicoLocal("Lidocaína", dePercentual(2)!), undefined);
});

/* ---------------- anestésicos locais e raqui ---------------- */

test("dose máxima de lidocaína muda com o vasoconstritor", () => {
  assert.equal(acharMedicamento("lidocaina-sem-ped")!.dose!.max, 5);
  assert.equal(acharMedicamento("lidocaina-com-ped")!.dose!.max, 10);
  assert.equal(acharMedicamento("bupivacaina-sem-ped")!.dose!.max, 2);
  assert.equal(acharMedicamento("bupivacaina-com-ped")!.dose!.max, 3);
  assert.equal(acharMedicamento("ropivacaina-ped")!.dose!.max, 3);
  assert.equal(acharMedicamento("levobupivacaina-sem-ped")!.dose!.max, 3.5);
  assert.equal(acharMedicamento("levobupivacaina-com-ped")!.dose!.max, 4.5);
});

test("volume máximo de lidocaína 2% sai certo: 17 kg sem vaso", () => {
  const m = acharMedicamento("lidocaina-sem-ped")!;
  const dois = dePercentual(2)!;
  const c = calcular(m.dose!, 17, dois)[0];
  assert.equal(c.doseTotal, 85, "5 mg/kg × 17 kg");
  assert.equal(c.volume, 4.25, "85 mg ÷ 20 mg/mL");
});

test("a bupivacaína intratecal segue a referência por peso", () => {
  assert.equal(bupivacainaIntratecal(4)!.mgPorKg, 0.5);
  assert.equal(bupivacainaIntratecal(10)!.mgPorKg, 0.4);
  assert.equal(bupivacainaIntratecal(30)!.mgPorKg, 0.3);
  assert.equal(bupivacainaIntratecal(50), undefined, "fora das faixas descritas");
  assert.deepEqual([FAIXA_GERAL_BUPIVACAINA_IT.min, FAIXA_GERAL_BUPIVACAINA_IT.max], [0.3, 1]);
});

test("a regra antiga da raqui foi removida e está dita", () => {
  assert.match(RAQUI_REMOVIDA, /3 mg\/kg/);
  assert.match(RAQUI_REMOVIDA, /não deve ser usada/);
  const antiga = CATALOGO.find((m) => m.grupo === "raqui" && m.dose?.usual === 3);
  assert.equal(antiga, undefined, "nenhuma entrada de raqui com 3 mg/kg");
});

/* ---------------- governança ---------------- */

test("toda entrada validada tem fonte, via, apresentação, revisão e dose", () => {
  for (const m of CATALOGO) {
    assert.equal(m.situacao, "validado", `${m.nome} no catálogo sem estar validado`);
    assert.ok(m.fonte?.obra, `${m.nome} sem obra`);
    assert.ok(m.via.trim().length >= 2, `${m.nome} sem via`);
    assert.ok(m.apresentacoes.length > 0, `${m.nome} sem apresentação`);
    assert.ok(m.dose, `${m.nome} sem dose`);
    assert.match(m.revisao ?? "", /\d{2}\/\d{2}\/\d{4}/, `${m.nome} sem revisão`);
    assert.ok(m.populacoes.length > 0, `${m.nome} sem população`);
    assert.ok(GRUPOS.some((g) => g.id === m.grupo), `${m.nome} em grupo desconhecido`);
  }
});

test("nenhuma apresentação de anestésico local passa da barreira", () => {
  for (const m of CATALOGO.filter((x) => x.grupo === "locais")) {
    for (const a of m.apresentacoes) {
      assert.equal(conferirAnestesicoLocal(m.nome, a), undefined, `${m.nome} — ${a.rotulo}`);
    }
  }
});

test("os pendentes são só nomes, e dizem por que estão pendentes", () => {
  assert.equal(PENDENTES.length, 18);
  assert.ok(PENDENTES.some((p) => /Propofol/.test(p.nome)));
  assert.ok(PENDENTES.some((p) => /Cefazolina/.test(p.nome)));
  // Nenhum pendente entrou no catálogo por engano.
  for (const p of PENDENTES) {
    const igual = CATALOGO.find((m) => m.nome.toLowerCase() === p.nome.toLowerCase());
    assert.equal(igual, undefined, `${p.nome} está no catálogo e deveria estar pendente`);
  }
});

test("o valor da tabela antiga não virou dose do SAESP", () => {
  const propofolAdulto = CATALOGO.filter((m) => m.populacoes.includes("adulto") && /propofol/i.test(m.nome));
  for (const m of propofolAdulto) {
    const geral = m.dose!.unidade === "mg" && m.dose!.por === "kg" && m.dose!.max === 3;
    assert.equal(geral, false, "1,5–3 mg/kg é o valor pendente, não pode estar cadastrado");
  }
  // O único propofol de bolo do adulto é o de técnica específica, e ele leva contexto.
  const bolo = propofolAdulto.filter((m) => m.dose!.por === "kg");
  assert.equal(bolo.length, 1);
  assert.ok(bolo[0].contextoFonte);
});

test("o que a fonte descreve em técnica específica carrega o contexto e o alerta", () => {
  const especificos = CATALOGO.filter((m) => /técnica específica/i.test(m.nome));
  assert.ok(especificos.length >= 2);
  for (const m of especificos) {
    assert.ok(m.contextoFonte, `${m.nome} sem contexto`);
    assert.ok(m.alerta, `${m.nome} sem alerta`);
  }
});

test("sugamadex avisa que a dose depende da profundidade, e 16 não é rotina", () => {
  const moderado = acharMedicamento("sugamadex-moderado")!;
  const imediata = acharMedicamento("sugamadex-imediata")!;
  assert.equal(moderado.dose!.usual, 2);
  assert.equal(imediata.dose!.usual, 16);
  assert.match(moderado.alerta!, /profundidade do bloqueio/);
  assert.match(imediata.alerta!, /Não é dose de rotina/);
  assert.ok(imediata.contextoFonte);
});

test("o tiopental avisa sobre o neonato", () => {
  assert.match(acharMedicamento("tiopental-ped")!.alerta!, /neonato/i);
  assert.match(acharMedicamento("tiopental-ped")!.alerta!, /20 a 30/);
});

test("a morfina pediátrica avisa para não partir da máxima", () => {
  const m = acharMedicamento("morfina-ped")!;
  assert.match(m.alerta!, /Não partir da dose máxima/);
  assert.match(m.observacao!, /0,02 mg\/kg/);
});

test("a morfina intratecal mostra as duas faixas, sem escolher", () => {
  const a = acharMedicamento("morfina-it-ped")!;
  const b = acharMedicamento("morfina-it-ped-alta")!;
  assert.deepEqual([a.dose!.min, a.dose!.max], [4, 10]);
  assert.deepEqual([b.dose!.min, b.dose!.max], [10, 20]);
  assert.match(a.observacao!, /não escolhe entre elas/);
});

/* ---------------- busca e formatação ---------------- */

test("a busca acha por nome, via ou indicação", () => {
  const lista = disponiveis("crianca");
  assert.ok(buscar("midazolam", lista).length >= 4);
  assert.ok(buscar("MIDAZOLAM", lista).length >= 4);
  assert.ok(buscar("sequência", lista).length >= 1);
  assert.equal(buscar("", lista).length, lista.length);
});

test("número sai com vírgula, e a concentração vem escrita", () => {
  assert.equal(virgula(3.4), "3,4");
  assert.equal(escreverApresentacao(mcg50()), "50 mcg/mL");
  assert.equal(escreverApresentacao(dePercentual(0.125)!), "1,25 mg/mL");
});

test("peso ausente, zero ou negativo não calcula nada", () => {
  const dose: DosePorKg = { usual: 2, unidade: "mg", por: "kg" };
  assert.equal(calcularNivel("usual", 2, dose, 0, mg10()), undefined);
  assert.equal(calcularNivel("usual", 2, dose, -5, mg10()), undefined);
  assert.equal(calcular(dose, Number.NaN, mg10()).length, 0);
});
