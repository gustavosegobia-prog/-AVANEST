import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGO } from "./medicamentos.ts";
import { conferirAlergia, situacaoDaAlergia } from "./alergias.ts";
import { conferirEncerramento, imcDaFolha } from "./folha.ts";
import { motivoAoAbrirFolha } from "./fila.ts";
import type { Registro } from "./registros.ts";

const com = (alergias: string) => ({ alergias, nega_alergia: false });

test("Alergia — o nome do medicamento na alergia é encontrado, sem acento nem maiúscula", () => {
  assert.equal(conferirAlergia(com("Dipirona"), "Dipirona")?.termo, "Dipirona");
  assert.equal(conferirAlergia(com("CETOROLACO (urticária)"), "Cetorolaco")?.termo, "Cetorolaco");
  assert.equal(conferirAlergia(com("rocuronio"), "Rocurônio")?.termo, "Rocurônio");
});

test("Alergia — nome comercial cruza com o princípio ativo, nos dois sentidos", () => {
  assert.equal(conferirAlergia(com("Novalgina"), "Dipirona")?.termo, "Novalgina");
  assert.ok(conferirAlergia(com("dipirona"), "Novalgina"));
  assert.ok(conferirAlergia(com("Plasil — distonia"), "Metoclopramida"));
});

test("Alergia — variação de fim de palavra e nome dentro do outro", () => {
  assert.ok(conferirAlergia(com("fentanila"), "Fentanil"));
  assert.ok(conferirAlergia(com("bupivacaína"), "Levobupivacaína"));
});

test("Alergia — medicamento fora do catálogo é comparado pelo nome digitado", () => {
  assert.ok(conferirAlergia(com("contraste iodado"), "Contraste iodado"));
});

test("Alergia — nega alergia, alergia vazia ou sem detalhe não acusam nada", () => {
  assert.equal(conferirAlergia({ alergias: "dipirona", nega_alergia: true }, "Dipirona"), null);
  assert.equal(conferirAlergia(com(""), "Dipirona"), null);
  for (const item of CATALOGO) {
    assert.equal(conferirAlergia(com("Sim (sem detalhe na avaliação)"), item.nome), null, item.nome);
  }
});

test("Alergia — sem falso alarme para alergias que não são de nenhum fármaco do catálogo", () => {
  const texto = "Penicilina; látex; frutos do mar; esparadrapo; contraste iodado; AAS; sulfa";
  const acusados = CATALOGO.filter((i) => conferirAlergia(com(texto), i.nome)).map((i) => i.nome);
  // Penicilina × cefazolina é reação CRUZADA: julgamento clínico, fora desta comparação.
  assert.deepEqual(acusados, []);
});

test("Alergia — a janela sempre diz a situação da alergia", () => {
  assert.equal(situacaoDaAlergia({ nega_alergia: true }), "Nega alergia a medicamentos.");
  assert.equal(situacaoDaAlergia({ alergias: "dipirona" }), "Alergias registradas: dipirona.");
  assert.match(situacaoDaAlergia({}), /não informadas/);
});

test("IMC — do peso e da altura da folha, só com valores plausíveis", () => {
  assert.equal(imcDaFolha({ peso_kg: 70, altura_cm: 175 }), 22.9);
  assert.equal(imcDaFolha({ peso_kg: 21, altura_cm: 118 }), 15.1);
  assert.equal(imcDaFolha({ peso_kg: 70, altura_cm: 1.75 }), null);
  assert.equal(imcDaFolha({ peso_kg: 70 }), null);
  assert.equal(imcDaFolha({}), null);
});

const T0 = Date.parse("2026-10-10T10:00:00-03:00");
const reg = (id: string, dados: Record<string, unknown>): Registro => ({
  id, evolucao_id: "f1", tipo: "medicamento", momento: new Date(T0).toISOString(), dados, origem: "manual",
  substitui_id: null, anulado: false, motivo: null, created_by: "u1", created_at: new Date(T0).toISOString(),
});

test("Alergia — dado sem justificativa (alergia escrita depois) aparece na conferência de encerramento", () => {
  const cab = { alergias: "dipirona" };
  const semJustificativa = conferirEncerramento(cab, [reg("a", { nome: "Dipirona", status: "administrado", dose: 1, unidade: "g" })], 5);
  assert.ok(semJustificativa.some((p) => p.tipo === "aviso" && p.texto.includes("coincide com a alergia")));
  const justificado = conferirEncerramento(cab, [reg("b", { nome: "Dipirona", status: "administrado", dose: 1, unidade: "g",
    alerta_alergia: { termo: "Dipirona", alergias: "dipirona", justificativa: "Alergia descartada pela família" } })], 5);
  assert.ok(!justificado.some((p) => p.texto.includes("coincide com a alergia")));
});

test("Abrir folha — o erro diz a causa real, e não sempre 'confira a conexão'", () => {
  assert.match(motivoAoAbrirFolha({ code: "PGRST205", message: "Could not find the table 'public.evolucoes_anestesicas'" }), /não está instalado/);
  assert.match(motivoAoAbrirFolha({ code: "42501", message: "new row violates row-level security policy" }), /Sem permissão/);
  assert.match(motivoAoAbrirFolha({ message: "PACIENTE_DE_OUTRA_INSTITUICAO" }), /outro serviço/);
  assert.match(motivoAoAbrirFolha({ message: "TypeError: Failed to fetch" }), /conexão/);
});
