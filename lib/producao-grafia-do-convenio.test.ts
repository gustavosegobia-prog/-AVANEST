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
  assert.match(tela, /convenio: grafiaConhecida\(novo\.convenio, conveniosConhecidos\),/,
    "a anotação nova voltou a gravar o convênio como foi digitado");
});

test("corrigir o convênio de uma anotação também grava a grafia do cadastro", () => {
  assert.match(tela, /const v = grafiaConhecida\(e\.target\.value, conveniosConhecidos\);/,
    "a edição do convênio voltou a gravar o texto cru");
});

test("os dois totais por convênio agrupam pela chave, não pelo texto", () => {
  const usos = [...tela.matchAll(/chaveDoPagador\((i|l)\.convenio\)/g)];
  assert.equal(usos.length, 2, "algum total por convênio da Produção voltou a agrupar pelo texto cru");
  assert.doesNotMatch(tela, /const k = (i|l)\.convenio \|\| "Particular";/,
    "voltou um agrupamento pelo texto cru");
});
