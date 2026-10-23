// Testa a migração 202610230014 (prova do aceite dos Termos) num Postgres
// local (PGlite), sem tocar no banco de verdade: o auth do Supabase é imitado
// aqui. Dados todos fictícios. Rodar: npm run test:banco
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const MIG = readFileSync(new URL("../migrations/202610230014_aceites_de_termos.sql", import.meta.url), "utf8");
const db = new PGlite();

const A = "00000000-0000-0000-0000-0000000000a1";
const B = "00000000-0000-0000-0000-0000000000b1";
const C = "00000000-0000-0000-0000-0000000000c1";

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
`);

// A migração roda duas vezes: reaplicar não quebra nem duplica.
await db.exec(MIG);
await db.exec(MIG);
console.log("ok  migração aplicada duas vezes");

let passou = 0;
const ok = (nome) => { passou++; console.log("ok ", nome); };
const como = async (uid, sql, params = []) => {
  await db.exec(`reset role; select set_config('app.uid', '${uid ?? ""}', false);`);
  if (uid) await db.exec("set role authenticated;");
  try { return (await db.query(sql, params)).rows; } finally { await db.exec("reset role;"); }
};
const falha = async (uid, sql, trecho, params = []) => {
  await assert.rejects(como(uid, sql, params), (e) => { assert.match(String(e.message), trecho); return true; });
};

// ── Cadastro: a conta nasce com a versão aceita no metadado ────────────────
await como(null, `insert into auth.users (id, email, raw_user_meta_data) values
  ($1, 'a@exemplo.test', '{"termos_versao":"2026-10-23","origem":"2meses"}'),
  ($2, 'b@exemplo.test', '{}'),
  ($3, 'c@exemplo.test', '{"termos_versao":"qualquer coisa"}')`, [A, B, C]);
const doCadastro = await como(null, `select user_id, email, versao, origem from aceites_de_termos order by email`);
assert.deepEqual(doCadastro, [{ user_id: A, email: "a@exemplo.test", versao: "2026-10-23", origem: "cadastro" }]);
assert.equal((await como(null, `select count(*)::int as n from auth.users`))[0].n, 3);
ok("Cadastro: grava o aceite de quem marcou a caixa; sem versão válida, a conta nasce e nada é gravado");

// Se a gravação da prova falhar, o cadastro não pode cair junto.
await como(null, `alter table aceites_de_termos rename to aceites_fora_do_lugar`);
await como(null, `insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000d1', 'd@exemplo.test', '{"termos_versao":"2026-10-23"}')`);
await como(null, `alter table aceites_fora_do_lugar rename to aceites_de_termos`);
assert.equal((await como(null, `select count(*)::int as n from auth.users`))[0].n, 4);
ok("Cadastro: se a gravação da prova falhar, a conta nasce mesmo assim (o painel pede depois)");

// ── Leitura: cada um vê só os seus ─────────────────────────────────────────
await como(null, `insert into aceites_de_termos (user_id, email, versao, origem, ip) values ($1, 'b@exemplo.test', '2026-10-23', 'painel', '177.10.20.30')`, [B]);
assert.equal((await como(A, `select * from aceites_de_termos`)).length, 1);
assert.equal((await como(B, `select ip from aceites_de_termos`))[0].ip, "177.10.20.30");
assert.equal((await como(C, `select * from aceites_de_termos`)).length, 0);
ok("Leitura: cada pessoa lê só os próprios aceites");

// ── Escrita: só o servidor, e nada se altera ───────────────────────────────
await falha(A, `insert into aceites_de_termos (user_id, versao, origem) values ($1, '2026-10-23', 'painel')`, /permission denied/, [A]);
await falha(C, `insert into aceites_de_termos (user_id, versao, origem) values ($1, '2026-10-23', 'painel')`, /permission denied/, [C]);
await falha(A, `update aceites_de_termos set versao = '2020-01-01'`, /permission denied/);
await falha(A, `delete from aceites_de_termos`, /permission denied/);
ok("Escrita: a sessão não grava, não muda e não apaga aceite (nem o próprio)");
await falha(null, `update aceites_de_termos set versao = '2020-01-01' where user_id = $1`, /não se altera/, [A]);
await falha(null, `delete from aceites_de_termos where user_id = $1`, /não se altera/, [A]);
await falha(null, `insert into aceites_de_termos (user_id, versao, origem) values ($1, '23/10/2026', 'painel')`, /check constraint/, [A]);
await falha(null, `insert into aceites_de_termos (user_id, versao, origem) values ($1, '2026-10-23', 'telefone')`, /check constraint/, [A]);
ok("Prova: nem o servidor altera ou apaga; versão e origem fora do padrão são recusadas");

// ── Excluir a conta não leva a prova junto ────────────────────────────────
await como(null, `delete from auth.users where id = $1`, [A]);
assert.equal((await como(null, `select count(*)::int as n from aceites_de_termos where user_id = $1`, [A]))[0].n, 1);
ok("Excluir a conta não apaga o aceite registrado");

for (const f of ["aceite_no_cadastro", "aceite_nao_muda"]) {
  await falha(B, `select public.${f}()`, /permission denied|trigger functions can only be called as triggers/);
}
ok("Funções de gatilho não ficam ao alcance da API");

console.log(`\n${passou} verificações passaram.`);
