import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 22/11/2026: as 146 chaves estrangeiras sem índice apontadas pelo Supabase.
const sql = fs.readFileSync(new URL("../supabase/migrations/202611220002_indices_das_chaves_estrangeiras.sql", import.meta.url), "utf8");

test("índices: um para cada chave estrangeira sem índice, sem duplicar ao rodar de novo", () => {
  assert.match(sql, /where c\.contype = 'f' and c\.connamespace = 'public'::regnamespace/);
  // Só cria onde nenhum índice começa pelas colunas da chave.
  assert.match(sql, /\(i\.indkey::int2\[\]\)\[0:array_length\(f\.conkey, 1\) - 1\] @> f\.conkey/);
  assert.match(sql, /execute format\('create index if not exists %I on %s \(%s\)'/);
  assert.match(sql, /left\(c\.relname \|\| '_' \|\| array_to_string\(f\.colunas, '_'\) \|\| '_fk_idx', 63\)/);
});
