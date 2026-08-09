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
  doseCefazolina,
  doseCetorolaco,
  emMeses,
  escreverApresentacao,
  faixaEtaria,
  FAIXA_GERAL_BUPIVACAINA_IT,
  GRUPOS,
  ID_ATROPINA_REVERSAO,
  MESES_ADULTO,
  MESES_LACTENTE,
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

test("nada do adulto foi assinado como SAESP sem estar no SAESP", () => {
  const doServico = CATALOGO.filter((m) => m.fonte?.obra === "Tabela de doses do adulto do serviço");
  assert.ok(doServico.length >= 18, `esperado ao menos 18, veio ${doServico.length}`);
  for (const m of doServico) {
    assert.equal(/SAESP/i.test(m.fonte!.obra), false, `${m.nome} assinado como SAESP`);
    assert.ok(m.revisao, `${m.nome} sem data de revisão`);
  }
});

test("o valor da tabela antiga não virou dose do adulto", () => {
  const propofolAdulto = CATALOGO.filter((m) => m.populacoes.includes("adulto") && /propofol/i.test(m.nome));
  for (const m of propofolAdulto) {
    const antigo = m.dose!.unidade === "mg" && m.dose!.por === "kg" && m.dose!.max === 3;
    assert.equal(antigo, false, "1,5–3 mg/kg é o valor da tabela antiga, não pode estar cadastrado");
  }
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

/* ---------------- dose fixa ---------------- */

test("dose fixa não enxerga o peso", () => {
  const fixa: DosePorKg = { usual: 4, unidade: "mg", por: "fixa" };
  const magro = calcularNivel("usual", 4, fixa, 45, mg10())!;
  const pesado = calcularNivel("usual", 4, fixa, 130, mg10())!;
  assert.equal(magro.doseTotal, 4);
  assert.equal(pesado.doseTotal, 4);
  assert.equal(magro.volume, pesado.volume);
});

test("dose por quilo continua enxergando o peso", () => {
  const porKg: DosePorKg = { usual: 4, unidade: "mg", por: "kg" };
  assert.equal(calcularNivel("usual", 4, porKg, 45, mg10())!.doseTotal, 180);
});

test("ondansetrona e dexametasona são fixas; nenhuma multiplica por quilo", () => {
  for (const id of ["ondansetrona-adulto", "dexametasona-adulto", "cetorolaco-adulto", "cefazolina-adulto", "tramadol-adulto", "nalbufina-adulto", "hidrocortisona-inducao", "hidrocortisona-manutencao"]) {
    assert.equal(acharMedicamento(id)!.dose!.por, "fixa", id);
  }
  const onda = acharMedicamento("ondansetrona-adulto")!;
  const c = calcular(onda.dose!, 70, onda.apresentacoes[0]);
  assert.equal(c.length, 1);
  assert.equal(c[0].doseTotal, 4);
  assert.equal(c[0].volume, 2); // 4 mg ÷ 2 mg/mL
});

/* ---------------- valores do adulto, conferidos a 70 kg ---------------- */

test("a 70 kg os números batem com a tabela do adulto", () => {
  const conta = (id: string) => {
    const m = acharMedicamento(id)!;
    return calcular(m.dose!, 70, m.apresentacoes[0]).map((c) => [c.nivel, c.doseTotal, c.volume]);
  };

  assert.deepEqual(conta("propofol-adulto"), [["minima", 140, 14], ["maxima", 175, 17.5]]);
  assert.deepEqual(conta("fentanil-adulto"), [["minima", 140, 2.8], ["maxima", 350, 7]]);
  assert.deepEqual(conta("cisatracurio-adulto"), [["minima", 10.5, 5.25], ["maxima", 14, 7]]);

  const etomidato = conta("etomidato-adulto");
  assert.deepEqual(etomidato[1], ["usual", 21, 10.5]);

  const cetamina = conta("cetamina-adulto-inducao");
  assert.deepEqual([cetamina[0][1], cetamina[1][1]], [70, 140]);
});

test("succinilcolina mostra habitual e sequência rápida em cartões separados", () => {
  const habitual = acharMedicamento("succinilcolina-adulto")!;
  const rsi = acharMedicamento("succinilcolina-adulto-rsi")!;
  assert.deepEqual([habitual.dose!.min, habitual.dose!.usual, habitual.dose!.max], [0.3, 0.6, 1.1]);
  assert.deepEqual([rsi.dose!.min, rsi.dose!.max], [1, 1.5]);
});

test("sufentanil do adulto é titulável e avisa que não é bolus único", () => {
  const m = acharMedicamento("sufentanil-adulto")!;
  assert.equal(m.titulavel, true);
  assert.match(m.alerta!, /não um bolus único/i);
});

/* ---------------- regras condicionais ---------------- */

test("cefazolina sobe para 3 g acima de 120 kg", () => {
  assert.equal(doseCefazolina(70).dose.usual, 2);
  assert.equal(doseCefazolina(120).dose.usual, 2);
  assert.equal(doseCefazolina(121).dose.usual, 3);
  assert.match(doseCefazolina(130).motivo, /120 kg/);
  assert.equal(doseCefazolina(undefined).dose.usual, 2);
});

test("cetorolaco cai para 15 mg por idade, por peso ou por rim", () => {
  assert.equal(doseCetorolaco({ idadeAnos: 40, pesoKg: 70 }).dose.usual, 30);
  assert.equal(doseCetorolaco({ idadeAnos: 65, pesoKg: 70 }).dose.usual, 15);
  assert.equal(doseCetorolaco({ idadeAnos: 40, pesoKg: 49 }).dose.usual, 15);
  assert.equal(doseCetorolaco({ idadeAnos: 40, pesoKg: 70, comprometimentoRenal: true }).dose.usual, 15);
  assert.match(doseCetorolaco({ idadeAnos: 70, pesoKg: 45 }).motivo, /idade.*peso|peso.*idade/);
  assert.match(acharMedicamento("cetorolaco-adulto")!.alerta!, /renal/i);
});

test("neostigmina tem teto de 5 mg e exige monitorização", () => {
  const m = acharMedicamento("neostigmina-adulto")!;
  assert.deepEqual(m.tetoAbsoluto, { valor: 5, unidade: "mg" });
  assert.equal(m.regra, "neostigmina");
  assert.match(m.alerta!, /monitoriza/i);

  // 100 kg × 0,07 daria 7 mg; o teto corta em 5 mg.
  const maxima = calcular(m.dose!, 100, m.apresentacoes[0], m.tetoAbsoluto)
    .find((c) => c.nivel === "maxima")!;
  assert.equal(maxima.doseTotal, 5);
  assert.equal(maxima.limitada, true);
  assert.equal(maxima.doseAntesDoTeto, 7);
});

test("a atropina de reversão não aparece sozinha na lista", () => {
  const atropina = acharMedicamento(ID_ATROPINA_REVERSAO)!;
  assert.equal(atropina.oculto, true);
  assert.equal(atropina.dose!.usual, 0.015);
  assert.equal(disponiveis("adulto").some((m) => m.id === ID_ATROPINA_REVERSAO), false);
});

test("hidrocortisona não é rotina", () => {
  for (const id of ["hidrocortisona-inducao", "hidrocortisona-manutencao"]) {
    assert.match(acharMedicamento(id)!.alerta!, /não é profilaxia de rotina/i);
  }
  assert.match(acharMedicamento("hidrocortisona-manutencao")!.observacao!, /6 horas/);
});

test("cefazolina em grama converte certo para volume", () => {
  const m = acharMedicamento("cefazolina-adulto")!;
  const c = calcular(m.dose!, 70, m.apresentacoes[0])[0];
  assert.equal(c.doseTotal, 2);        // 2 g
  assert.equal(c.volume, 20);          // 2 g ÷ 0,1 g/mL
});
