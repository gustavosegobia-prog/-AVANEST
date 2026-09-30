import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * QUEM MANDA NA ESCALA, NO BANCO, É QUEM MONTA A ESCALA.
 *
 * lib/escalista.ts diz: eleito o escalista, só ele e o proprietário mexem.
 * O gatilho e três políticas dos plantões ainda perguntavam "é
 * administrador?". Medido numa transação desfeita: médico eleito escalista
 * era RECUSADO ao remarcar e apagar plantão de colega; administrador não
 * escalista, com escalista eleito, CONSEGUIA. Depois de 202609300010: o
 * escalista consegue, o administrador não, organização sem escalista segue
 * como antes, e o médico continua sem apagar o próprio plantão da escala.
 */
const sql = readFileSync(
  new URL("../supabase/migrations/202609300010_escala_segue_o_escalista.sql", import.meta.url), "utf8");

test("as três políticas de escrita perguntam pode_montar_escala, não o papel", () => {
  for (const politica of ["lanca_o_seu_plantao", "altera_o_seu_plantao", "apaga_o_que_e_so_seu"]) {
    const i = sql.indexOf(`create policy "${politica}"`);
    assert.notEqual(i, -1, `sumiu a política ${politica}`);
    const corpo = sql.slice(i, sql.indexOf(");", i));
    assert.match(corpo, /public\.pode_montar_escala\(\)/, `${politica} deixou de seguir o escalista`);
    assert.doesNotMatch(corpo, /current_app_role\(\)/, `${politica} voltou a olhar só o papel`);
  }
});

test("privado continua só de quem anotou", () => {
  assert.match(sql, /and \(privado = false or perfil_id = auth\.uid\(\)\)/);
  assert.match(sql, /public\.pode_montar_escala\(\) or \(perfil_id = auth\.uid\(\) and privado\)/);
});

test("o gatilho da escala do grupo segue o escalista", () => {
  assert.match(sql, /v_novo text := \$v\$v_manda boolean := public\.pode_montar_escala\(\);\$v\$;/);
  assert.match(sql, /raise exception 'plantao_do_grupo_protegido mudou de forma inesperada/,
    "a troca do gatilho deixou de recusar um corpo diferente do esperado");
});
