import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A PRODUÇÃO DO DIA É ONDE AS GRAFIAS NASCIAM.
 *
 * O cadastro de pacientes escolhe o convênio numa lista fechada, e no banco
 * todas as grafias batem com a tabela de preços. A Produção do dia aceita
 * texto livre — digitado, ou lido da foto da guia, que vem em caixa-alta —, e
 * foi de lá que vieram "UNIMED" e "PARTICULAR" ao lado de "Unimed" e
 * "Particular". Dois consertos: gravar com a grafia do cadastro quando o nome
 * é um convênio conhecido (grafiaConhecida, testada em
 * financeiro-indicadores.test.ts), e agrupar os totais pela chave, porque o
 * que já foi gravado continua gravado.
 */
const tela = readFileSync(new URL("../components/producao-do-dia.tsx", import.meta.url), "utf8");

test("anotação nova grava a grafia do cadastro", () => {
  // Com o convênio de antes quando o campo foi esvaziado para mostrar a lista inteira.
  assert.match(tela, /convenio: grafiaConhecida\(novo\.convenio\.trim\(\) \|\| convenioAntes, conveniosConhecidos\),/,
    "a anotação nova voltou a gravar o convênio como foi digitado");
});

test("corrigir o convênio de uma anotação também grava a grafia do cadastro", () => {
  assert.match(tela, /const v = grafiaConhecida\(e\.target\.value\.trim\(\) \|\| e\.target\.dataset\.antes \|\| "", conveniosConhecidos\);/,
    "a edição do convênio voltou a gravar o texto cru");
});

test("os dois totais por convênio agrupam pela chave, não pelo texto", () => {
  const usos = [...tela.matchAll(/chaveDoPagador\((i|l)\.convenio\)/g)];
  assert.equal(usos.length, 2, "algum total por convênio da Produção voltou a agrupar pelo texto cru");
  assert.doesNotMatch(tela, /const k = (i|l)\.convenio \|\| "Particular";/,
    "voltou um agrupamento pelo texto cru");
});

test("a seta do convênio mostra a lista inteira, e o Anotar sem nome avisa (06/11/2026)", () => {
  // "Não está respondendo quando aperta": o campo começava com "Particular" e o
  // navegador só mostrava as opções que combinavam com ele.
  assert.match(tela, /setConvenioAntes\(novo\.convenio\);\s*setNovo\(\(n\) => \(\{ \.\.\.n, convenio: "" \}\)\)/);
  assert.match(tela, /onFocus=\{\(e\) => mostrarListaInteira\(e\.currentTarget\)\}/);
  // Com qualquer convênio escrito, também o digitado à mão fora da lista
  // (07/11/2026: a seta parada em "UNIMED INTERCAMBIO", que não é da lista).
  assert.match(tela, /function mostrarListaInteira\(campo: HTMLInputElement\) \{\s*if \(!campo\.value\.trim\(\)\) return;/);
  assert.match(tela, /if \(!novo\.convenio\.trim\(\)\) return;\s*setConvenioAntes\(novo\.convenio\);/);
  assert.doesNotMatch(tela, /ehConhecido\(/, "não depende mais de o convênio estar na lista");
  // O botão não fica travado em silêncio: sem nome, ele diz o que falta.
  assert.match(tela, /<button className="primaryClinical compact" disabled=\{salvando\}>/);
  assert.match(tela, /setErro\("Escreva o nome do paciente para anotar\."\)/);
});
