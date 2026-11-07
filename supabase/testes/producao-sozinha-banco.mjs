// Testa a migração 202611070003 (a produção que vai sozinha ao financeiro, por
// pessoa) num Postgres local (PGlite), sem tocar no banco de verdade. Dados
// todos fictícios. Rodar: npm run test:banco
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const MIG = readFileSync(new URL("../migrations/202611070003_producao_vai_sozinha.sql", import.meta.url), "utf8");
const db = new PGlite();

const INST = { A: "10000000-0000-0000-0000-0000000000a1", B: "10000000-0000-0000-0000-0000000000b1" };
const U = {
  liga: "00000000-0000-0000-0000-0000000000a1", // liga o envio automático
  naoLiga: "00000000-0000-0000-0000-0000000000a2", // não liga: a lista continua só dele
  saiu: "00000000-0000-0000-0000-0000000000a3", // ligou e saiu do grupo
  outraCasa: "00000000-0000-0000-0000-0000000000b1",
};

await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;

create table public.instituicoes (id uuid primary key, nome text);
create table public.perfis (id uuid primary key, institution_id uuid references public.instituicoes, nome text, role text,
  status text default 'ativo');
create table public.producao_do_dia (id uuid primary key default gen_random_uuid(), institution_id uuid not null, perfil_id uuid not null,
  data date not null, paciente text not null, enviado_em timestamptz);
create table public.auditoria (id uuid primary key default gen_random_uuid(), institution_id uuid not null, actor_id uuid,
  entidade text, entidade_id uuid, acao text not null, detalhes jsonb not null default '{}', created_at timestamptz not null default now());
alter table public.perfis enable row level security;
create policy "le_o_proprio" on public.perfis for select to authenticated using (id = auth.uid());

insert into public.instituicoes values ('${INST.A}', 'Grupo Fictício A'), ('${INST.B}', 'Grupo Fictício B');
insert into public.perfis (id, institution_id, nome, role, status) values
  ('${U.liga}', '${INST.A}', 'Dra. Liga Fictícia', 'medico', 'ativo'),
  ('${U.naoLiga}', '${INST.A}', 'Dr. Não Liga Fictício', 'medico', 'ativo'),
  ('${U.saiu}', '${INST.A}', 'Dr. Saiu Fictício', 'medico', 'ativo'),
  ('${U.outraCasa}', '${INST.B}', 'Dra. Outra Casa Fictícia', 'medico', 'ativo');

-- A produção: de anteontem, de ontem e de hoje (no fuso do serviço), e uma já enviada.
insert into public.producao_do_dia (institution_id, perfil_id, data, paciente, enviado_em) values
  ('${INST.A}', '${U.liga}', (now() at time zone 'America/Sao_Paulo')::date - 2, 'Paciente Anteontem', null),
  ('${INST.A}', '${U.liga}', (now() at time zone 'America/Sao_Paulo')::date - 1, 'Paciente Ontem', null),
  ('${INST.A}', '${U.liga}', (now() at time zone 'America/Sao_Paulo')::date, 'Paciente Hoje', null),
  ('${INST.A}', '${U.liga}', (now() at time zone 'America/Sao_Paulo')::date - 3, 'Paciente Já Enviado', '2026-01-01T12:00:00Z'),
  ('${INST.A}', '${U.naoLiga}', (now() at time zone 'America/Sao_Paulo')::date - 1, 'Paciente De Quem Não Ligou', null),
  ('${INST.A}', '${U.saiu}', (now() at time zone 'America/Sao_Paulo')::date - 1, 'Paciente De Quem Saiu', null),
  ('${INST.B}', '${U.outraCasa}', (now() at time zone 'America/Sao_Paulo')::date - 1, 'Paciente Da Outra Casa', null);
`);
await db.exec(MIG);
await db.exec(MIG);
console.log("ok  migração aplicada duas vezes");

let passou = 0;
const como = async (uid, sql, params = [], papel = "authenticated") => {
  await db.exec(`reset role; select set_config('app.uid', '${uid ?? ""}', false);`);
  if (uid || papel !== "authenticated") await db.exec(`set role ${papel};`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec("reset role;"); }
};
const ok = (nome) => { passou++; console.log("ok ", nome); };
const ontem = `(now() at time zone 'America/Sao_Paulo')::date - 1`;
const enviar = (ate = ontem) => como(null, `select public.enviar_producao_sozinha(${ate}) as n`, [], "service_role");
const enviados = async () => (await como(null, `select paciente from public.producao_do_dia where enviado_em is not null order by paciente`))
  .map((r) => r.paciente);

// ── Desligado para todos: a rotina não manda nada ─────────────────────────
assert.equal((await enviar())[0].n, 0);
assert.deepEqual(await enviados(), ["Paciente Já Enviado"]);
ok("Começa desligado para todos: a lista continua de quem anota");

// ── Cada um liga o seu ────────────────────────────────────────────────────
assert.deepEqual(await como(U.liga, `select public.definir_producao_vai_sozinha(true) as r`), [{ r: true }]);
await como(U.saiu, `select public.definir_producao_vai_sozinha(true)`);
await como(null, `update public.perfis set status = 'inativo' where id = $1`, [U.saiu]);
assert.deepEqual(await como(U.liga, `select producao_vai_sozinha from public.perfis where id = auth.uid()`), [{ producao_vai_sozinha: true }]);
await assert.rejects(como(null, `select public.definir_producao_vai_sozinha(true)`, [], "anon"), /permission denied|Não autorizado/);
await assert.rejects(como(U.liga, `select public.definir_producao_vai_sozinha(null)`), /Não autorizado/);
await assert.rejects(como(U.saiu, `select public.definir_producao_vai_sozinha(false)`), /Não autorizado/, "quem saiu não mexe mais");
const escolhas = await como(null, `select actor_id, detalhes from public.auditoria where acao = 'producao_vai_sozinha' order by created_at`);
assert.equal(escolhas.length, 2);
assert.deepEqual(escolhas[0], { actor_id: U.liga, detalhes: { ligado: true } });
ok("Cada um liga o próprio, e a escolha fica na auditoria");

// ── A rotina: só de quem ligou, até ontem, uma vez ────────────────────────
assert.equal((await enviar())[0].n, 2);
assert.deepEqual(await enviados(), ["Paciente Anteontem", "Paciente Já Enviado", "Paciente Ontem"],
  "nem o de hoje, nem o de quem não ligou, nem o de quem saiu, nem o da outra casa");
const ja = await como(null, `select enviado_em from public.producao_do_dia where paciente = 'Paciente Já Enviado'`);
assert.equal(new Date(ja[0].enviado_em).toISOString(), "2026-01-01T12:00:00.000Z", "o já enviado não muda de data");
const registro = await como(null, `select institution_id, actor_id, entidade, acao, detalhes from public.auditoria where acao = 'producao_enviada'`);
assert.equal(registro.length, 1);
assert.equal(registro[0].actor_id, U.liga);
assert.equal(registro[0].detalhes.automatico, true);
assert.equal(registro[0].detalhes.itens, 2);
assert.equal((await enviar())[0].n, 0, "rodar de novo não manda nada");
ok("A rotina manda só o de quem ligou, de ontem para trás, e registra por pessoa");

// ── Nunca o dia que está correndo ─────────────────────────────────────────
await assert.rejects(enviar(`(now() at time zone 'America/Sao_Paulo')::date`), /só até ontem/);
await assert.rejects(enviar("null::date"), /só até ontem/);
ok("A rotina recusa o dia de hoje e data vazia");

// ── Só o agendador chama a rotina ─────────────────────────────────────────
await assert.rejects(como(U.liga, `select public.enviar_producao_sozinha(${ontem})`), /permission denied/);
await assert.rejects(como(null, `select public.enviar_producao_sozinha(${ontem})`, [], "anon"), /permission denied/);
ok("Médico e visitante não disparam o envio de ninguém");

// ── Desligar volta ao botão ───────────────────────────────────────────────
await como(U.liga, `select public.definir_producao_vai_sozinha(false)`);
await como(null, `insert into public.producao_do_dia (institution_id, perfil_id, data, paciente) values ($1, $2, ${ontem}, 'Paciente Depois')`,
  [INST.A, U.liga]);
assert.equal((await enviar())[0].n, 0);
ok("Desligado, só o botão manda");

console.log(`\n${passou} verificações passaram.`);
