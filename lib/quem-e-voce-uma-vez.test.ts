import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * "QUEM É VOCÊ?" UMA VEZ POR CONSULTA.
 *
 * 202609300013 embrulha auth.uid() e as auxiliares das regras de acesso em
 * `(select ...)`. Medido numa transação desfeita: 111 regras reescritas; nas
 * 1.247 combinações de perfil e tabela, as linhas visíveis foram as mesmas
 * antes e depois; a escala do proprietário caiu de 6,4 ms para 1,0 ms.
 */
const sql = readFileSync(
  new URL("../supabase/migrations/202609300013_quem_e_voce_uma_vez_por_consulta.sql", import.meta.url), "utf8");

test("a lista da escala continua sendo lista", () => {
  // Sem o cast, `local_id = ANY ((select f()))` compara uuid com uuid[] e a
  // migração inteira falha — foi o que o teste desfeito pegou.
  assert.match(sql, /'\(select public\.meus_locais_de_plantao\(\)\)::uuid\[\]'/);
  assert.doesNotMatch(sql, /\(current_institution_id\|current_app_role\|pode_montar_escala\|e_suporte\|meus_locais_de_plantao\)/,
    "meus_locais_de_plantao voltou para a troca genérica, sem o cast");
});

test("só entra o que não depende da linha", () => {
  // modulo_liberado(role), em convites, olha a coluna da linha: só a forma
  // com texto fixo pode virar initplan.
  assert.match(sql, /\(current_has_permission\|modulo_liberado\)\\\(''\(\[a-z_\]\+\)''::text\\\)/);
});

test("rodar de novo não embrulha duas vezes", () => {
  assert.match(sql, /!~\s*'\\\( SELECT \(auth\\\.uid\|current_institution_id/);
});

test("mexe com ALTER POLICY: nome, papel e comando continuam os mesmos", () => {
  assert.match(sql, /format\('alter policy %I on public\.%I', r\.policyname, r\.tablename\)/);
  assert.doesNotMatch(sql, /drop policy/i);
});
