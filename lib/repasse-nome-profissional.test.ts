import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * TODA LINHA DE REPASSE DIZIA "Profissional vinculado ao atendimento" —
 * SEMPRE, PARA TODO MUNDO.
 *
 * financeiro_atendimentos.medico_id existe desde a criação da tabela
 * (202607230003_modulo_financeiro.sql) e chega ao cliente dentro do tipo
 * Financeiro. A lista de perfis da organização (com .nome) também já
 * chegava pronta como prop de FinanceView, usada em outras telas. Nada
 * disso tinha sido ligado: o texto era fixo, igual em toda linha, e nunca
 * dizia qual anestesiologista era o dono daquele repasse.
 */
const tela = readFileSync(
  new URL("../app/dashboard/dashboard-client.tsx", import.meta.url),
  "utf8",
);

test("o painel de Repasses resolve o nome do profissional por medico_id, não mais um texto fixo", () => {
  const i = tela.indexOf('chave="fin-repasses"');
  assert.notEqual(i, -1, "não achei o painel de Repasses");
  const painel = tela.slice(i, i + 1200);
  assert.doesNotMatch(painel, /Profissional vinculado ao atendimento/,
    "o texto fixo de sempre ainda está na linha de repasse");
  assert.match(painel, /perfilMap\.get\(item\.medico_id\)\?\.nome/,
    "a linha de repasse deixou de resolver o nome pelo perfilMap");
  assert.match(painel, /"Profissional não identificado"/,
    "sumiu o texto para quando o atendimento não tem médico vinculado");
});

test("perfilMap existe e indexa perfis por id", () => {
  assert.match(tela, /const perfilMap=new Map\(perfis\.map\(p=>\[p\.id,p\]\)\)/,
    "sumiu o mapa de perfis por id");
});

test("o título de Repasses não leva mais emoji", () => {
  const i = tela.indexOf('chave="fin-repasses"');
  const painel = tela.slice(i, i + 200);
  assert.match(painel, /titulo="Repasses aos anestesiologistas"/,
    "o título de Repasses mudou de forma inesperada, ou o emoji voltou");
});
