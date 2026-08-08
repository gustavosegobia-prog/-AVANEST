import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  achados,
  acharEnsaio,
  chave,
  ENSAIOS,
  NAO_CONCLUI,
  PARAMETROS,
  quantosClassificados,
  type Leitura,
} from "./rotem.ts";

/* O que estes testes protegem: o módulo aponta componente e para aí. Se um dia
   alguém colar um produto ou uma dose num achado, o último teste quebra. */

test("os cinco ensaios existem e dizem como são montados", () => {
  assert.equal(ENSAIOS.length, 5);
  for (const e of ENSAIOS) {
    assert.ok(e.montagem.length > 10, `${e.sigla} sem montagem`);
    assert.ok(e.parametros.length > 0, `${e.sigla} sem parâmetro`);
    for (const p of e.parametros) assert.ok(PARAMETROS[p], `${e.sigla}: parâmetro ${p} desconhecido`);
  }
  assert.equal(acharEnsaio("fibtem")!.parametros.includes("ct"), false);
  assert.deepEqual(acharEnsaio("heptem")!.parametros, ["ct"]);
});

test("tela em branco não interpreta nada", () => {
  assert.equal(achados({}).length, 0);
  assert.equal(quantosClassificados({}), 0);
});

test("INTEM prolongado com HEPTEM normal aponta heparina", () => {
  const l: Leitura = { [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "normal" };
  const r = achados(l);
  assert.equal(r.length, 1);
  assert.match(r[0].componente, /heparínico/i);
  assert.match(r[0].base, /heparinase/);
});

test("INTEM e HEPTEM prolongados tiram a heparina da explicação", () => {
  const l: Leitura = { [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "acima" };
  const r = achados(l);
  assert.match(r[0].componente, /sem explicação pela heparina/i);
  assert.ok(r[0].aSeguir);
});

test("INTEM prolongado sem HEPTEM assume indefinição em vez de chutar", () => {
  const r = achados({ [chave("intem", "ct")]: "acima" });
  assert.equal(r.length, 1);
  assert.match(r[0].componente, /Indefinido/);
  assert.match(r[0].aSeguir!, /HEPTEM/);
});

test("EXTEM e FIBTEM baixos apontam fibrinogênio", () => {
  const l: Leitura = { [chave("extem", "a10")]: "abaixo", [chave("fibtem", "a10")]: "abaixo" };
  const r = achados(l);
  assert.equal(r.length, 1);
  assert.match(r[0].componente, /fibrinogênio/i);
});

test("EXTEM baixo com FIBTEM preservado aponta plaqueta, e avisa o que o exame não separa", () => {
  const l: Leitura = { [chave("extem", "a10")]: "abaixo", [chave("fibtem", "a10")]: "normal" };
  const r = achados(l);
  assert.equal(r.length, 1);
  assert.match(r[0].componente, /plaquetária/i);
  assert.match(r[0].aSeguir!, /não separa os dois/);
});

test("qualquer um dos três parâmetros de firmeza baixo já conta", () => {
  const porA5: Leitura = { [chave("extem", "a5")]: "abaixo", [chave("fibtem", "mcf")]: "abaixo" };
  assert.match(achados(porA5)[0].componente, /fibrinogênio/i);
});

test("lise que o APTEM corrige é hiperfibrinólise; que não corrige, não é", () => {
  const corrige: Leitura = { [chave("extem", "ml")]: "acima", [chave("aptem", "ml")]: "normal" };
  assert.match(achados(corrige)[0].componente, /Hiperfibrinólise/i);

  const naoCorrige: Leitura = { [chave("extem", "ml")]: "acima", [chave("aptem", "ml")]: "acima" };
  assert.match(achados(naoCorrige)[0].componente, /não explicada por fibrinólise/i);

  const semAptem: Leitura = { [chave("extem", "ml")]: "acima" };
  assert.match(achados(semAptem)[0].componente, /Indefinido/);
});

test("padrões independentes aparecem juntos", () => {
  const l: Leitura = {
    [chave("extem", "a10")]: "abaixo",
    [chave("fibtem", "a10")]: "abaixo",
    [chave("extem", "ml")]: "acima",
    [chave("aptem", "ml")]: "normal",
  };
  const r = achados(l);
  assert.equal(r.length, 2);
  assert.equal(quantosClassificados(l), 4);
});

test("tudo normal não inventa achado", () => {
  const l: Leitura = {
    [chave("extem", "ct")]: "normal", [chave("extem", "a10")]: "normal",
    [chave("intem", "ct")]: "normal", [chave("fibtem", "a10")]: "normal",
    [chave("extem", "ml")]: "normal",
  };
  assert.equal(achados(l).length, 0);
});

test("nenhum achado indica produto, dose ou transfusão", () => {
  const tudo: Leitura = {
    [chave("extem", "ct")]: "acima", [chave("extem", "a10")]: "abaixo", [chave("extem", "ml")]: "acima",
    [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "acima",
    [chave("fibtem", "a10")]: "abaixo", [chave("aptem", "ml")]: "normal",
  };
  const proibido = /fibrinogênio concentrado|crioprecipitado|transfun|transfus|plasma fresco|complexo protrombínico|ácido tranexâmico|administrar|repor|infundir|\d+\s*(g|mg|UI|mL)\b/i;
  for (const a of achados(tudo)) {
    assert.doesNotMatch(a.titulo, proibido, a.titulo);
    assert.doesNotMatch(a.componente, proibido, a.titulo);
    assert.doesNotMatch(a.base, proibido, a.titulo);
    if (a.aSeguir) assert.doesNotMatch(a.aSeguir, proibido, a.titulo);
  }
});

test("os limites do módulo estão declarados, inclusive o algoritmo que falta", () => {
  assert.ok(NAO_CONCLUI.some((x) => x.item.includes("normalidade")));
  assert.ok(NAO_CONCLUI.some((x) => /Algoritmo/i.test(x.item) && /não implementado/i.test(x.motivo)));
  assert.ok(NAO_CONCLUI.some((x) => x.item.includes("Produto")));
});
