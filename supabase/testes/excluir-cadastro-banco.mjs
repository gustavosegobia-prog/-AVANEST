// Testa a migração 202611080001 (excluir o médico sem conta junto com os
// plantões dele) num Postgres local (PGlite), sem tocar no banco de verdade.
// Dados todos fictícios. Rodar: npm run test:banco
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const MIG = readFileSync(new URL("../migrations/202611080001_excluir_cadastro_sem_conta.sql", import.meta.url), "utf8");
const db = new PGlite();

const INST = { A: "10000000-0000-0000-0000-0000000000a1", B: "10000000-0000-0000-0000-0000000000b1" };
const U = {
  dono: "00000000-0000-0000-0000-0000000000a1",
  medico: "00000000-0000-0000-0000-0000000000a2", // médico com login: não exclui ninguém
  soPlantoes: "00000000-0000-0000-0000-0000000000a3", // sem conta, só plantões e mapa
  comProducao: "00000000-0000-0000-0000-0000000000a4", // sem conta, com produção
  comLogin: "00000000-0000-0000-0000-0000000000a5", // tem conta e plantões
  vazio: "00000000-0000-0000-0000-0000000000a6", // sem conta, sem nada
  donoB: "00000000-0000-0000-0000-0000000000b1",
};

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;

create table public.instituicoes (id uuid primary key, nome text);
create table public.perfis (id uuid primary key, institution_id uuid references public.instituicoes, nome text, role text,
  status text default 'ativo', sem_acesso boolean default false, escalista boolean default false, super_admin boolean default false);
create table public.plantoes (id uuid primary key default gen_random_uuid(), institution_id uuid, perfil_id uuid not null references public.perfis on delete cascade,
  data date not null, hora_inicio time not null, hora_fim time not null, situacao text default 'escalado', local_id uuid, local_texto text,
  privado boolean default false);
create table public.producao_do_dia (id uuid primary key default gen_random_uuid(), perfil_id uuid references public.perfis on delete cascade);
create table public.trocas_plantao (id uuid primary key default gen_random_uuid(), solicitante_id uuid, destinatario_id uuid);
create table public.financeiro_atendimentos (id uuid primary key default gen_random_uuid(), medico_id uuid);
create table public.prontuario_ficticio (perfil_id uuid);
create table public.centro_casos (id uuid primary key default gen_random_uuid(), paciente text,
  anestesista_id uuid references public.perfis(id) on delete set null);
create table public.convites (id uuid primary key default gen_random_uuid(), invited_by uuid, status text default 'pendente');
create table public.auditoria (id uuid primary key default gen_random_uuid(), institution_id uuid not null, actor_id uuid,
  entidade text, entidade_id uuid, acao text not null, detalhes jsonb not null default '{}', created_at timestamptz default now());

-- Como no banco (202608260003 e 202608300001), simplificadas.
create function public.perfil_tem_escala(p uuid) returns integer language sql stable security definer set search_path = public as $$
  select ((select count(*) from public.producao_do_dia where perfil_id = p)
    + (select count(*) from public.plantoes where perfil_id = p)
    + (select count(*) from public.trocas_plantao where solicitante_id = p or destinatario_id = p)
    + (select count(*) from public.financeiro_atendimentos where medico_id = p))::integer $$;
create function public.perfil_tem_clinico(p uuid) returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.prontuario_ficticio where perfil_id = p $$;
create function public.pode_montar_escala() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.role = 'owner' or p.escalista or p.super_admin
    or (p.role = 'admin' and not exists (select 1 from public.perfis e where e.institution_id = p.institution_id and e.escalista))
    from public.perfis p where p.id = auth.uid() and p.status = 'ativo'), false) $$;
-- O gatilho que protege o plantão do grupo: só quem monta a escala apaga.
create function public.plantao_do_grupo_protegido() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.pode_montar_escala() then return OLD; end if;
  if OLD.privado then return OLD; end if;
  raise exception 'Este plantão está na escala do grupo.' using errcode = 'check_violation';
end $$;
create trigger plantao_do_grupo_protegido before delete on public.plantoes for each row execute function public.plantao_do_grupo_protegido();

insert into public.instituicoes values ('${INST.A}', 'Hospital Fictício'), ('${INST.B}', 'Outro Fictício');
insert into public.perfis (id, institution_id, nome, role, sem_acesso) values
  ('${U.dono}', '${INST.A}', 'Dono Fictício', 'owner', false),
  ('${U.medico}', '${INST.A}', 'Dr. Com Login Fictício', 'medico', false),
  ('${U.soPlantoes}', '${INST.A}', 'DR SO PLANTOES', 'medico', true),
  ('${U.comProducao}', '${INST.A}', 'DR COM PRODUCAO', 'medico', true),
  ('${U.comLogin}', '${INST.A}', 'Dra. Com Conta Fictícia', 'medico', false),
  ('${U.vazio}', '${INST.A}', 'DRA VAZIA', 'medico', true),
  ('${U.donoB}', '${INST.B}', 'Dono De Fora', 'owner', false);
insert into public.plantoes (institution_id, perfil_id, data, hora_inicio, hora_fim, local_texto) values
  ('${INST.A}', '${U.soPlantoes}', '2026-11-10', '07:00', '07:00', 'Centro cirúrgico'),
  ('${INST.A}', '${U.soPlantoes}', '2026-11-03', '19:00', '07:00', null),
  ('${INST.A}', '${U.comProducao}', '2026-11-04', '07:00', '19:00', null),
  ('${INST.A}', '${U.comLogin}', '2026-11-05', '07:00', '19:00', null);
insert into public.producao_do_dia (perfil_id) values ('${U.comProducao}');
insert into public.centro_casos (paciente, anestesista_id) values
  ('Paciente Um Fictício', '${U.soPlantoes}'), ('Paciente Dois Fictício', '${U.soPlantoes}'), ('Paciente Três Fictício', '${U.medico}');
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
const previa = (uid, alvo) => como(uid, `select * from public.o_que_sai_com_o_cadastro($1)`, [alvo]);
const excluir = (uid, alvo) => como(uid, `select public.excluir_cadastro_com_plantoes($1) as r`, [alvo]);

// ── O que sai, antes do toque ─────────────────────────────────────────────
assert.deepEqual(await previa(U.dono, U.soPlantoes), [{ plantoes: 2, pacientes_no_mapa: 2, outros: 0, clinico: 0, sem_conta: true }]);
assert.deepEqual(await previa(U.dono, U.comProducao), [{ plantoes: 1, pacientes_no_mapa: 0, outros: 1, clinico: 0, sem_conta: true }]);
assert.equal((await previa(U.dono, U.comLogin))[0].sem_conta, false);
await assert.rejects(previa(U.medico, U.soPlantoes), /Sem permissão/);
await assert.rejects(previa(U.donoB, U.soPlantoes), /Sem permissão/);
ok("A prévia diz quantos plantões saem e quantos pacientes do mapa ficam sem anestesista");

// ── Quem não pode, não apaga ──────────────────────────────────────────────
await assert.rejects(excluir(U.medico, U.soPlantoes), /Sem permissão/);
await assert.rejects(excluir(U.donoB, U.soPlantoes), /Sem permissão/);
await assert.rejects(excluir(null, U.soPlantoes, [], "anon"), /permission denied|Sem permissão/);
await assert.rejects(excluir(U.dono, U.dono), /próprio cadastro/);
ok("Só proprietário ou administrador da mesma organização");

// ── O que tem mais do que plantões, ou tem login, continua protegido ──────
await assert.rejects(excluir(U.dono, U.comProducao), /produção, trocas ou atendimentos faturados/);
await assert.rejects(excluir(U.dono, U.comLogin), /Só o cadastro sem conta/);
await db.exec(`insert into public.prontuario_ficticio values ('${U.vazio}')`);
await assert.rejects(excluir(U.dono, U.vazio), /prontuário/);
await db.exec(`delete from public.prontuario_ficticio`);
assert.equal((await como(null, `select count(*)::int as n from public.plantoes where perfil_id in ($1, $2)`, [U.comProducao, U.comLogin]))[0].n, 2);
ok("Com produção, com login ou com prontuário: nada sai");

// ── Administrador que não monta a escala não apaga plantão ────────────────
await db.exec(`insert into public.perfis (id, institution_id, nome, role) values
  ('00000000-0000-0000-0000-0000000000a7', '${INST.A}', 'Admin Fictício', 'admin'),
  ('00000000-0000-0000-0000-0000000000a8', '${INST.A}', 'Escalista Fictícia', 'medico')`);
await db.exec(`update public.perfis set escalista = true where id = '00000000-0000-0000-0000-0000000000a8'`);
await assert.rejects(excluir("00000000-0000-0000-0000-0000000000a7", U.soPlantoes), /Só quem monta a escala/);
ok("Com escalista eleito, o administrador comum não apaga plantões");

// ── O caso pedido: sai com os plantões, e fica tudo registrado ────────────
assert.deepEqual(await excluir(U.dono, U.soPlantoes), [{ r: { plantoes: 2, pacientes_no_mapa: 2 } }]);
assert.equal((await como(null, `select count(*)::int as n from public.perfis where id = $1`, [U.soPlantoes]))[0].n, 0);
assert.equal((await como(null, `select count(*)::int as n from public.plantoes where perfil_id = $1`, [U.soPlantoes]))[0].n, 0);
assert.deepEqual((await como(null, `select paciente, anestesista_id from public.centro_casos order by paciente`)).map((c) => c.anestesista_id),
  [null, U.medico, null], "os do mapa ficam sem anestesista; o dos outros, não");
const [reg] = await como(null, `select actor_id, acao, detalhes from public.auditoria where entidade_id = $1`, [U.soPlantoes]);
assert.equal(reg.actor_id, U.dono);
assert.equal(reg.acao, "cadastro_excluido_com_plantoes");
assert.equal(reg.detalhes.nome, "DR SO PLANTOES");
assert.equal(reg.detalhes.pacientes_do_mapa_sem_anestesista, 2);
assert.deepEqual(reg.detalhes.plantoes.map((p) => [p.data, p.inicio, p.fim, p.local_texto]),
  [["2026-11-03", "19:00:00", "07:00:00", null], ["2026-11-10", "07:00:00", "07:00:00", "Centro cirúrgico"]]);
ok("O cadastro sai com os plantões; o histórico guarda cada plantão e quantos do mapa ficaram sem anestesista");

// ── Sem conta e sem nada: também sai por aqui ─────────────────────────────
assert.deepEqual(await excluir(U.dono, U.vazio), [{ r: { plantoes: 0, pacientes_no_mapa: 0 } }]);
ok("O cadastro sem conta e sem nada também sai");

console.log(`\n${passou} verificações passaram.`);
