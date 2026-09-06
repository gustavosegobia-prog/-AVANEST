import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { AUTOR, autorEmSchema, dataPorExtenso, nomeCompleto, registro } from "./autoria.ts";

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

/**
 * AS QUATRO CALCULADORAS SÃO CONTEÚDO YMYL, e o Google aplica a elas uma régua
 * mais dura: página que influencia decisão de saúde é avaliada por quem
 * escreveu, com que credencial e quando foi revisada. O site dizia "de
 * anestesiologista para anestesiologista" em prosa e não sinalizava isso a
 * máquina nenhuma.
 */
test("o autor sai com nome, título e registro conferível", () => {
  assert.equal(nomeCompleto(), "Dr. Gustavo Segobia da Silva");
  assert.equal(registro(), "CRM 49131-PR");
  const p = autorEmSchema();
  assert.equal(p["@type"], "Person");
  assert.equal(p.jobTitle, "Médico anestesiologista");
  // `identifier` com `PropertyValue` é o jeito de declarar registro
  // profissional: uma string solta não diria de que cadastro ela é.
  assert.equal(p.identifier["@type"], "PropertyValue");
  assert.equal(p.identifier.propertyID, "CRM");
  assert.equal(p.identifier.value, "49131-PR");
});

test("o RQE não é inventado enquanto não existir", () => {
  // Registro de especialista é conferível no portal do CFM. Publicar um número
  // aproximado é pior do que omitir o campo: um dado errado desmente
  // justamente a credencial que ele deveria sustentar.
  assert.ok(!("rqe" in AUTOR), "apareceu um RQE — ele não foi informado");
  const json = JSON.stringify(autorEmSchema());
  assert.ok(!/RQE/i.test(json), "o schema está declarando um RQE que não existe");
});

test("a data de revisão sai por extenso, sem ambiguidade", () => {
  // Não 27/08/2026: a data de revisão é lida por quem quer saber se o conteúdo
  // está velho, e o formato por extenso não se confunde com o americano de mês
  // na frente.
  assert.equal(dataPorExtenso("2026-08-27"), "27 de agosto de 2026");
  assert.equal(dataPorExtenso("2026-01-05"), "5 de janeiro de 2026");
});

test("o schema do escore declara autor E revisor", () => {
  // Os dois campos respondem a perguntas diferentes: `author` diz quem
  // escreveu, `reviewedBy` diz quem se responsabiliza. Num texto clínico o
  // segundo é o que pesa. Omitir um deixa metade da pergunta sem resposta.
  const comp = ler("components/pagina-de-escore.tsx");
  const i = comp.indexOf("export function dadosDeEscore(");
  assert.notEqual(i, -1, "não achei o schema do escore");
  const bloco = comp.slice(i);
  assert.match(bloco, /author: autorEmSchema\(\)/);
  assert.match(bloco, /reviewedBy: autorEmSchema\(\)/);
  assert.match(bloco, /lastReviewed: a\.revisadoEm/);
});

test("a assinatura aparece na TELA, e não só no JSON-LD", () => {
  // Declarar autor só na marcação invisível é o que o Google chama de sinal
  // não corroborado — a orientação dele é explícita em querer a assinatura
  // visível na página.
  const comp = ler("components/pagina-de-escore.tsx");
  assert.match(comp, /className="escAutoria"/, "sumiu a assinatura visível");
  assert.match(comp, /nomeCompleto\(\)/);
  assert.match(comp, /registro\(\)/);
  assert.match(comp, /dataPorExtenso\(revisadoEm\)/);
});

test("as quatro páginas de escore assinam", () => {
  // Uma delas sem a data não mostra assinatura nenhuma, e ninguém percebe:
  // a página continua compilando e o texto continua lá.
  for (const escore of ["apfel", "classificacao-asa", "indice-de-lee", "stop-bang"]) {
    const pagina = ler(`app/escores/${escore}/page.tsx`);
    assert.match(pagina, /const REVISADO_EM = "\d{4}-\d{2}-\d{2}"/,
      `${escore} está sem data de revisão`);
    assert.match(pagina, /revisadoEm=\{REVISADO_EM\}/,
      `${escore} não passa a data para a moldura — a assinatura não aparece`);
  }
});

test("o CRM está escrito num lugar só", () => {
  // Um número de registro repetido em quatro páginas sai errado numa delas e
  // ninguém confere — e registro trocado em página de saúde é pior do que
  // registro nenhum.
  for (const escore of ["apfel", "classificacao-asa", "indice-de-lee", "stop-bang"]) {
    const pagina = ler(`app/escores/${escore}/page.tsx`);
    assert.ok(!pagina.includes(AUTOR.crm), `${escore} tem o CRM escrito à mão`);
  }
});
