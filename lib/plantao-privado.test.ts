import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * "SÓ VOCÊ VÊ" TAMBÉM PARA QUEM MONTA A ESCALA.
 *
 * A tela promete que o plantão privado é só de quem anotou, e o código da
 * escala conta com isso ("o banco já não devolve os dos outros"). A política
 * FOR ALL do escalista liberava para quem monta a escala ler e ALTERAR os
 * privados dos colegas. Medido: 13 privados de outros visíveis ao
 * proprietário; um deles alterável. Depois de 202609300011: 0 visíveis, 0
 * alteráveis; a escala do grupo inteira continua, e o próprio privado também.
 */
const sql = readFileSync(
  new URL("../supabase/migrations/202609300011_plantao_privado_so_de_quem_anotou.sql", import.meta.url), "utf8");
const tela = readFileSync(new URL("../components/plantoes.tsx", import.meta.url), "utf8");

test("quem monta a escala só alcança o que não é privado", () => {
  const usos = [...sql.matchAll(/perfil_id = auth\.uid\(\) or \(public\.pode_montar_escala\(\) and privado = false\)/g)];
  assert.equal(usos.length, 2, "using ou with check voltaram a liberar privado de colega para quem monta a escala");
});

test("a tela continua prometendo o que o banco agora cumpre", () => {
  assert.match(tela, /" · só você vê"/, "a promessa sumiu da tela — rever se a regra ainda faz sentido");
});
