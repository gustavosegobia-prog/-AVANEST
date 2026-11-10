import test from "node:test";
import assert from "node:assert/strict";
import { chaveDaNovidade, NOVIDADES, novidadeDaArea } from "./novidades.ts";

const nada = () => false;

test("novidades: o questionário aparece na recepção e no médico, cada um com o seu texto", () => {
  const rec = novidadeDaArea("recepcao", "2026-11-10", nada);
  const med = novidadeDaArea("medico", "2026-11-10", nada);
  assert.equal(rec?.id, "questionario-whatsapp");
  assert.match(rec!.textoDaArea, /Mais ▾/);
  assert.match(med!.textoDaArea, /Trazer as respostas/);
});

test("novidades: não aparece em outra área, depois de vista, nem depois do prazo", () => {
  assert.equal(novidadeDaArea("financeiro", "2026-11-10", nada), null);
  assert.equal(novidadeDaArea("plantoes", "2026-11-10", nada), null);
  assert.equal(novidadeDaArea("recepcao", "2026-11-10", (id) => id === "questionario-whatsapp"), null);
  assert.equal(novidadeDaArea("recepcao", "2026-12-11", nada), null, "o prazo é exclusive");
  assert.ok(novidadeDaArea("recepcao", "2026-12-10", nada));
});

test("novidades: a mais recente primeiro, e a vista dá lugar à seguinte", () => {
  const lista = [
    { id: "b", ate: "2027-01-01", titulo: "B", texto: { medico: "nova" } },
    { id: "a", ate: "2027-01-01", titulo: "A", texto: { medico: "antiga" } },
  ];
  assert.equal(novidadeDaArea("medico", "2026-11-10", nada, lista)?.id, "b");
  assert.equal(novidadeDaArea("medico", "2026-11-10", (id) => id === "b", lista)?.id, "a");
});

test("novidades: o visto é de cada pessoa, e cada novidade tem id único", () => {
  assert.notEqual(chaveDaNovidade("u1", "x"), chaveDaNovidade("u2", "x"));
  assert.equal(new Set(NOVIDADES.map((n) => n.id)).size, NOVIDADES.length);
});
