import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  achados,
  acharCenario,
  acharEnsaio,
  BARREIRA,
  CENARIOS,
  chave,
  COMPARACOES,
  CONDUTAS,
  condutasAplicaveis,
  ENSAIOS,
  NAO_DEFINIDO,
  PARAMETROS,
  PASSO_ZERO,
  quantosClassificados,
  SEM_CONSENSO,
  SEQUENCIA,
  tudoNormal,
  type Leitura,
} from "./rotem.ts";

/* Duas coisas em teste: que a leitura cruzada faz o que a fonte diz, e que a
   camada de conduta nunca escapa das duas travas — só com sangramento, e
   nunca com dose. */

test("os seis ensaios existem, com ativação e uso", () => {
  assert.equal(ENSAIOS.length, 6);
  for (const e of ENSAIOS) {
    assert.ok(e.ativacao.length > 10, `${e.sigla} sem ativação`);
    assert.ok(e.uso.length > 10, `${e.sigla} sem uso`);
    for (const p of e.parametros) assert.ok(PARAMETROS[p], `${e.sigla}: parâmetro ${p} desconhecido`);
  }
  assert.ok(acharEnsaio("natem"), "NATEM ausente");
  assert.deepEqual(acharEnsaio("heptem")!.parametros, ["ct"]);
  assert.equal(acharEnsaio("fibtem")!.parametros.includes("ct"), false);
});

test("cada parâmetro carrega fase e pergunta clínica", () => {
  for (const p of Object.values(PARAMETROS)) {
    assert.ok(p.fase.length > 3, `${p.sigla} sem fase`);
    assert.match(p.pergunta, /\?/, `${p.sigla} sem pergunta`);
  }
});

test("o passo zero pergunta contexto antes do traçado", () => {
  assert.equal(PASSO_ZERO.length, 3);
  assert.ok(PASSO_ZERO.some((p) => /sangramento clinicamente relevante/i.test(p.pergunta)));
  assert.ok(PASSO_ZERO.some((p) => /fonte do sangramento está controlada/i.test(p.pergunta)));
  assert.ok(PASSO_ZERO.some((p) => /cálcio iônico/i.test(p.pergunta)));
  for (const p of PASSO_ZERO) assert.ok(p.seNao.length > 20, `${p.chave} sem consequência`);
});

test("tela em branco não interpreta nada", () => {
  assert.equal(achados({}).length, 0);
  assert.equal(quantosClassificados({}), 0);
  assert.equal(tudoNormal({}), false);
});

test("INTEM prolongado com HEPTEM normal aponta heparina, e lembra da protamina já dada", () => {
  const l: Leitura = { [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "normal" };
  const r = achados(l);
  assert.equal(r.length, 1);
  assert.match(r[0].hipotese, /heparina/i);
  assert.equal(r[0].fenotipo, "heparina");
  assert.match(r[0].aSeguir!, /protamina já administrada/);
});

test("INTEM e HEPTEM prolongados tiram a heparina da explicação", () => {
  const l: Leitura = { [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "acima" };
  const r = achados(l);
  assert.match(r[0].hipotese, /sem explicação pela heparina/i);
  assert.equal(r[0].fenotipo, "iniciacao");
});

test("faltando o canal que confirma, o achado é indefinido e não tem fenótipo", () => {
  const semHeptem = achados({ [chave("intem", "ct")]: "acima" });
  assert.match(semHeptem[0].hipotese, /Indefinido/);
  assert.equal(semHeptem[0].fenotipo, undefined);
  assert.match(semHeptem[0].aSeguir!, /HEPTEM/);

  const semAptem = achados({ [chave("extem", "ml")]: "acima" });
  assert.match(semAptem[0].hipotese, /Indefinido/);
  assert.equal(semAptem[0].fenotipo, undefined);
});

test("EXTEM e FIBTEM baixos apontam fibrina e pedem o Clauss", () => {
  const l: Leitura = { [chave("extem", "a10")]: "abaixo", [chave("fibtem", "a10")]: "abaixo" };
  const r = achados(l);
  assert.equal(r.length, 1);
  assert.match(r[0].hipotese, /fibrínica|hipofibrinogenemia/i);
  assert.equal(r[0].fenotipo, "fibrina");
  assert.match(r[0].aSeguir!, /Clauss/);
});

test("EXTEM baixo com FIBTEM preservado aponta plaqueta, e diz o que o exame não enxerga", () => {
  const l: Leitura = { [chave("extem", "a10")]: "abaixo", [chave("fibtem", "a10")]: "normal" };
  const r = achados(l);
  assert.equal(r[0].fenotipo, "plaquetas");
  assert.match(r[0].aSeguir!, /von Willebrand/);
});

test("qualquer um dos três parâmetros de firmeza baixo já conta", () => {
  const porA5: Leitura = { [chave("extem", "a5")]: "abaixo", [chave("fibtem", "mcf")]: "abaixo" };
  assert.equal(achados(porA5)[0].fenotipo, "fibrina");
});

test("lise que o APTEM corrige é hiperfibrinólise, e o módulo avisa para não atrasar", () => {
  const corrige: Leitura = { [chave("extem", "ml")]: "acima", [chave("aptem", "ml")]: "normal" };
  const r = achados(corrige);
  assert.equal(r[0].fenotipo, "fibrinolise");
  assert.match(r[0].aSeguir!, /Não atrasar/);

  const naoCorrige: Leitura = { [chave("extem", "ml")]: "acima", [chave("aptem", "ml")]: "acima" };
  assert.match(achados(naoCorrige)[0].hipotese, /não explicada por fibrinólise/i);
  assert.equal(achados(naoCorrige)[0].fenotipo, undefined);
});

test("padrões independentes aparecem juntos", () => {
  const l: Leitura = {
    [chave("extem", "a10")]: "abaixo", [chave("fibtem", "a10")]: "abaixo",
    [chave("extem", "ml")]: "acima", [chave("aptem", "ml")]: "normal",
  };
  assert.equal(achados(l).length, 2);
  assert.equal(quantosClassificados(l), 4);
});

test("traçado normal com sangramento vira achado próprio: procurar a fonte", () => {
  const l: Leitura = {
    [chave("extem", "ct")]: "normal", [chave("extem", "a10")]: "normal",
    [chave("fibtem", "a10")]: "normal", [chave("extem", "ml")]: "normal",
  };
  assert.equal(achados(l).length, 0, "sem sangramento declarado, não conclui nada");

  const r = achados(l, { sangramentoAtivo: true });
  assert.equal(r.length, 1);
  assert.equal(r[0].fenotipo, "semCoagulopatia");
  assert.match(r[0].base, /não exclui causa anatômica/);
});

test("as classes de conduta só existem com sangramento ativo", () => {
  const l: Leitura = { [chave("extem", "a10")]: "abaixo", [chave("fibtem", "a10")]: "abaixo" };
  const lista = achados(l);

  assert.deepEqual(condutasAplicaveis(lista, {}), []);
  assert.deepEqual(condutasAplicaveis(lista, { sangramentoAtivo: false }), []);

  const com = condutasAplicaveis(lista, { sangramentoAtivo: true });
  assert.equal(com.length, 1);
  assert.equal(com[0].fenotipo, "fibrina");
  assert.match(com[0].verificar, /Clauss/);
});

test("achado indefinido não gera classe de conduta, nem com sangramento", () => {
  const lista = achados({ [chave("intem", "ct")]: "acima" });
  assert.deepEqual(condutasAplicaveis(lista, { sangramentoAtivo: true }), []);
});

test("cada fenótipo aparece uma vez só, mesmo com dois achados apontando para ele", () => {
  const l: Leitura = {
    [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "acima",
    [chave("extem", "ct")]: "acima", [chave("fibtem", "a10")]: "normal",
  };
  const lista = achados(l);
  assert.equal(lista.filter((a) => a.fenotipo === "iniciacao").length, 2);
  assert.equal(condutasAplicaveis(lista, { sangramentoAtivo: true }).length, 1);
});

test("toda classe de conduta vem grudada nas verificações obrigatórias", () => {
  for (const c of Object.values(CONDUTAS)) {
    assert.ok(c.considerar.length > 15, `${c.fenotipo} sem intervenção`);
    assert.ok(c.verificar.length > 15, `${c.fenotipo} sem verificação`);
  }
});

test("nenhuma classe de conduta traz dose, limiar ou número", () => {
  const numero = /\d/;
  for (const c of Object.values(CONDUTAS)) {
    assert.doesNotMatch(c.considerar, numero, `${c.fenotipo}: número na intervenção`);
    assert.doesNotMatch(c.considerar, /\b(g|mg|mL|UI|U)\b/, `${c.fenotipo}: unidade na intervenção`);
  }
});

test("nenhum achado indica produto ou manda administrar", () => {
  const tudo: Leitura = {
    [chave("extem", "ct")]: "acima", [chave("extem", "a10")]: "abaixo", [chave("extem", "ml")]: "acima",
    [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "acima",
    [chave("fibtem", "a10")]: "abaixo", [chave("aptem", "ml")]: "normal",
  };
  const proibido = /crioprecipitado|plasma fresco|complexo protrombínico|concentrado de plaquetas|administrar|infundir|repor|\d+\s*(g|mg|UI|mL)\b/i;
  for (const a of achados(tudo, { sangramentoAtivo: true })) {
    assert.doesNotMatch(a.titulo, proibido, a.titulo);
    assert.doesNotMatch(a.hipotese, proibido, a.titulo);
    assert.doesNotMatch(a.base, proibido, a.titulo);
    if (a.aSeguir) assert.doesNotMatch(a.aSeguir, proibido, a.titulo);
  }
});

test("as três comparações trazem inferência e cuidado", () => {
  assert.equal(COMPARACOES.length, 3);
  for (const c of COMPARACOES) assert.ok(c.cuidado.length > 20, `${c.par} sem cuidado`);
  assert.ok(COMPARACOES.some((c) => /Não atrasar o antifibrinolítico/.test(c.cuidado)));
});

test("a sequência de interpretação tem os seis passos, na ordem", () => {
  assert.equal(SEQUENCIA.length, 6);
  assert.match(SEQUENCIA[0].etapa, /Qualidade/);
  assert.match(SEQUENCIA[5].etapa, /Resposta/);
  assert.match(SEQUENCIA[5].decisao, /cumulativo cego/);
});

test("os seis cenários trazem utilidade e limite de generalização", () => {
  assert.equal(CENARIOS.length, 6);
  for (const c of CENARIOS) assert.ok(c.limite.length > 20, `${c.nome} sem limite`);
  assert.match(acharCenario("hepatico")!.limite, /rebalanceada/);
});

test("os sete campos não definidos pela fonte continuam listados", () => {
  assert.equal(NAO_DEFINIDO.length, 7);
  assert.ok(NAO_DEFINIDO.some((x) => /Faixas normais universais/.test(x.campo)));
  assert.ok(NAO_DEFINIDO.some((x) => /não converter valor em dose automática/i.test(x.conduta)));
});

test("a barreira e a falta de consenso ficam ditas, com as três fontes", () => {
  assert.match(BARREIRA, /apenas porque um campo está fora da referência/);
  assert.match(SEM_CONSENSO.texto, /ainda não há consenso/);
  assert.equal(SEM_CONSENSO.fontes.length, 3);
  for (const f of SEM_CONSENSO.fontes) assert.ok(f.obra && f.local, "fonte incompleta");
});
