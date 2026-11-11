// Testa a migração 202611100001 (questionário pré-anestésico pelo link) num
// Postgres local (PGlite), sem tocar no banco de verdade. Dados todos
// fictícios. Rodar: npm run test:banco
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const MIG = readFileSync(new URL("../migrations/202611100001_questionario_pre_anestesico.sql", import.meta.url), "utf8");
const MIG_PARTES = readFileSync(new URL("../migrations/202611110001_questionario_salva_cada_parte.sql", import.meta.url), "utf8");
const db = new PGlite();

const INST = { A: "10000000-0000-0000-0000-0000000000a1", B: "10000000-0000-0000-0000-0000000000b1" };
const U = {
  recepcao: "00000000-0000-0000-0000-0000000000a1",
  medico: "00000000-0000-0000-0000-0000000000a2",
  centro: "00000000-0000-0000-0000-0000000000a3", // enfermagem do mapa: não manda nem lê
  recepcaoB: "00000000-0000-0000-0000-0000000000b1",
  medicoB: "00000000-0000-0000-0000-0000000000b2",
};
const P = { ana: "20000000-0000-0000-0000-0000000000a1", beto: "20000000-0000-0000-0000-0000000000a2", fora: "20000000-0000-0000-0000-0000000000b1" };
const AG = "30000000-0000-0000-0000-0000000000a1";

await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth; create schema storage;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;

create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant select on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;

create table public.instituicoes (id uuid primary key, nome text);
create table public.perfis (id uuid primary key, institution_id uuid references public.instituicoes, nome text, role text,
  status text default 'ativo', permissoes text[] default '{}');
create table public.pacientes (id uuid primary key, institution_id uuid, nome text, sexo text);
create table public.agendamentos (id uuid primary key, institution_id uuid, patient_id uuid);
create table public.auditoria (id uuid primary key default gen_random_uuid(), institution_id uuid not null, actor_id uuid,
  entidade text, entidade_id uuid, acao text not null, detalhes jsonb not null default '{}', created_at timestamptz default now());

-- Como no banco.
create function public.current_institution_id() returns uuid language sql stable security definer set search_path = public as $$
  select institution_id from public.perfis where id = auth.uid() and status = 'ativo' $$;
create function public.current_has_permission(p_permission text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'ativo'
    and (p.role in ('admin', 'owner') or p.role = p_permission or 'todos' = any(coalesce(p.permissoes, '{}'))
         or p_permission = any(coalesce(p.permissoes, '{}')))) $$;

insert into public.instituicoes values ('${INST.A}', 'Grupo Fictício'), ('${INST.B}', 'Outro Fictício');
insert into public.perfis (id, institution_id, nome, role) values
  ('${U.recepcao}', '${INST.A}', 'Recepção Fictícia', 'recepcao'),
  ('${U.medico}', '${INST.A}', 'Dr. Fictício', 'medico'),
  ('${U.centro}', '${INST.A}', 'Enf. Fictícia', 'centro'),
  ('${U.recepcaoB}', '${INST.B}', 'Recepção De Fora', 'recepcao'),
  ('${U.medicoB}', '${INST.B}', 'Dr. De Fora', 'medico');
insert into public.pacientes values
  ('${P.ana}', '${INST.A}', '  ANA MARIA FICTÍCIA', 'Feminino'),
  ('${P.beto}', '${INST.A}', 'Beto Fictício', 'Masculino'),
  ('${P.fora}', '${INST.B}', 'Paciente De Fora', null);
insert into public.agendamentos values ('${AG}', '${INST.A}', '${P.ana}');
`);
await db.exec(MIG);
await db.exec(MIG);
await db.exec(MIG_PARTES);
await db.exec(MIG_PARTES);
console.log("ok  migrações aplicadas duas vezes");

let passou = 0;
const como = async (uid, sql, params = [], papel = "authenticated") => {
  await db.exec(`reset role; select set_config('app.uid', '${uid ?? ""}', false);`);
  await db.exec(`set role ${papel};`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec("reset role;"); }
};
const ok = (nome) => { passou++; console.log("ok ", nome); };
const criar = (uid, paciente, agendamento = null) =>
  como(uid, `select * from public.criar_questionario($1, $2)`, [paciente, agendamento]);
const situacao = (uid, ids) => como(uid, `select patient_id, situacao from public.situacao_dos_questionarios($1)`, [ids]);
const publico = (token) => como(null, `select * from public.questionario_publico($1)`, [token], "anon");
const responder = (token, respostas, consentimento = true) =>
  como(null, `select public.responder_questionario($1, $2, $3) as r`, [token, respostas, consentimento], "anon");

// ── A recepção manda o link ───────────────────────────────────────────────
const [q1] = await criar(U.recepcao, P.ana, AG);
assert.match(q1.token, /^[0-9a-f]{64}$/);
assert.equal(q1.organizacao, "Grupo Fictício");
const [q1b] = await criar(U.recepcao, P.ana);
assert.equal(q1b.id, q1.id, "mandar de novo reaproveita o link aberto");
assert.equal(q1b.token, q1.token);
assert.deepEqual(await situacao(U.recepcao, [P.ana]), [], "só preparado, sem envio, não aparece na agenda");
await como(U.recepcao, `select public.registrar_envio_do_questionario($1)`, [q1.id]);
await como(U.recepcao, `select public.registrar_envio_do_questionario($1)`, [q1.id]);
const [{ n: enviados }] = await como(null, `select count(*)::int as n from public.auditoria where acao = 'questionario_enviado'`, [], "postgres");
assert.equal(enviados, 2, "cada envio fica registrado");
await assert.rejects(como(U.recepcaoB, `select public.registrar_envio_do_questionario($1)`, [q1.id]), /não encontrado/);
await assert.rejects(como(U.centro, `select public.registrar_envio_do_questionario($1)`, [q1.id]), /Sem permissão/);
ok("A recepção prepara o link (64 caracteres), mandar de novo reaproveita o mesmo, e o envio fica registrado");

await assert.rejects(criar(U.recepcaoB, P.ana), /Paciente não encontrado/);
await assert.rejects(criar(U.centro, P.ana), /Sem permissão/);
await assert.rejects(criar(U.recepcao, P.beto, AG), /Consulta não encontrada/, "a consulta tem de ser do paciente");
await assert.rejects(como(null, `select * from public.criar_questionario($1, null)`, [P.ana], "anon"), /permission denied/);
ok("Outra organização, o centro cirúrgico e quem não tem login não mandam");

// ── A recepção vê a situação, e não o conteúdo ────────────────────────────
assert.deepEqual(await situacao(U.recepcao, [P.ana, P.beto]), [{ patient_id: P.ana, situacao: "enviado" }]);
assert.deepEqual(await como(U.recepcao, `select * from public.questionarios_pre`), [], "a recepção não lê a tabela");
assert.deepEqual(await situacao(U.recepcaoB, [P.ana]), [], "a outra organização não vê");
assert.deepEqual(await situacao(U.centro, [P.ana]), []);
await assert.rejects(como(null, `select * from public.questionarios_pre`, [], "anon"), /permission denied/);
ok("A recepção vê só a situação; ninguém sem permissão lê a tabela");

// ── O paciente, pelo link ─────────────────────────────────────────────────
const [pub] = await publico(q1.token);
assert.equal(pub.situacao, "aberto");
assert.equal(pub.primeiro_nome, "Ana", "só o primeiro nome");
assert.equal(pub.organizacao, "Grupo Fictício");
assert.equal(pub.sexo, "Feminino");
assert.deepEqual(Object.keys(pub).sort(), ["expires_at", "organizacao", "primeiro_nome", "sexo", "situacao"], "nada mais do cadastro");
assert.deepEqual(await publico("f".repeat(64)), []);
assert.deepEqual(await situacao(U.recepcao, [P.ana]), [{ patient_id: P.ana, situacao: "enviado" }],
  "ler não marca: a prévia do WhatsApp também lê");
await como(null, `select public.marcar_questionario_aberto($1)`, [q1.token], "anon");
assert.deepEqual(await situacao(U.recepcao, [P.ana]), [{ patient_id: P.ana, situacao: "aberto" }]);
ok("O link mostra só o primeiro nome e o grupo; a recepção vê quando a página abriu no celular");

// ── As fotos, pela rota do servidor ───────────────────────────────────────
const pasta = `${INST.A}/${q1.id}`;
const anexar = (caminho, papel = "service_role") =>
  como(null, `select public.anexar_foto_do_questionario($1, $2) as n`, [q1.id, caminho], papel);
for (let i = 1; i <= 4; i++) assert.deepEqual(await anexar(`${pasta}/${i}.jpg`), [{ n: i }]);
await assert.rejects(anexar(`${pasta}/5.jpg`), /Não foi possível/, "no máximo 4");
assert.deepEqual(await como(null, `select public.tirar_foto_do_questionario($1, $2) as n`, [q1.id, `${pasta}/4.jpg`], "service_role"), [{ n: 3 }]);
await assert.rejects(anexar(`${INST.B}/${q1.id}/x.jpg`), /Não foi possível/, "a pasta é a do questionário");
await assert.rejects(anexar(`${pasta}/6.jpg`, "anon"), /permission denied/);
await assert.rejects(anexar(`${pasta}/6.jpg`, "authenticated"), /permission denied/);
ok("Até 4 fotos, na pasta do questionário, e só pela rota do servidor");

// ── Cada parte vai para o banco ───────────────────────────────────────────
const parte = (token, respostas, n, consentimento = true) =>
  como(null, `select public.salvar_parte_do_questionario($1, $2, $3, $4) as n`, [token, respostas, n, consentimento], "anon");
await assert.rejects(parte(q1.token, { quem: "paciente" }, 1, false), /consentimento/);
assert.deepEqual(await parte(q1.token, { quem: "paciente", peso: "70" }, 1), [{ n: 1 }]);
assert.deepEqual(await parte(q1.token, { cirurgias: "nao" }, 2), [{ n: 2 }]);
assert.deepEqual(await parte(q1.token, { quem: "familiar" }, 1), [{ n: 2 }], "voltar uma parte não apaga o avanço");
const [salvo] = await como(U.medico, `select respostas, parte, status from public.questionarios_pre where id = $1`, [q1.id]);
assert.deepEqual(salvo.respostas, { quem: "familiar", peso: "70", cirurgias: "nao" }, "as partes se somam");
assert.equal(salvo.status, "enviado", "continua aberto: o paciente ainda pode terminar");
assert.deepEqual(await situacao(U.recepcao, [P.ana]), [{ patient_id: P.ana, situacao: "incompleto" }]);
await assert.rejects(parte(q1.token, { x: "y" }, 0), /Parte inválida/);
await assert.rejects(parte("f".repeat(64), { x: "y" }, 1), /não encontrado/);
await assert.rejects(como(null, `select public.salvar_parte_do_questionario($1, $2, 1, true)`, [q1.token, { mais: "x".repeat(70000) }], "anon"), /Respostas inválidas/);
ok("Cada parte vai para o banco, se soma às outras, e a recepção vê \"incompleto\"");

// ── Responder ─────────────────────────────────────────────────────────────
await assert.rejects(responder(q1.token, { quem: "paciente" }, false), /consentimento/);
await assert.rejects(responder(q1.token, ["lista"]), /Respostas inválidas/);
await assert.rejects(responder(q1.token, { mais: "x".repeat(70000) }), /Respostas inválidas/);
assert.deepEqual(await responder(q1.token, { quem: "paciente", alergia: "sim", "alergia.texto": "Dipirona" }), [{ r: "respondido" }]);
await assert.rejects(responder(q1.token, { quem: "paciente" }), /já foi respondido/);
await assert.rejects(anexar(`${pasta}/9.jpg`), /Não foi possível/, "depois de enviado, não entra foto");
await assert.rejects(parte(q1.token, { mais: "depois" }, 3), /venceu ou já foi respondido/, "depois de enviado, não entra parte");
assert.equal((await publico(q1.token))[0].situacao, "respondido");
assert.deepEqual(await situacao(U.recepcao, [P.ana]), [{ patient_id: P.ana, situacao: "respondido" }]);
ok("Responde uma vez, com consentimento; depois disso não muda mais");

// ── O médico lê e traz para a avaliação ───────────────────────────────────
const [lido] = await como(U.medico, `select respostas, fotos, status from public.questionarios_pre where patient_id = $1`, [P.ana]);
assert.equal(lido.respostas.alergia, "sim");
assert.equal(lido.fotos.length, 3);
assert.deepEqual(await como(U.medicoB, `select id from public.questionarios_pre`), [], "o médico de fora não vê");
await assert.rejects(como(U.recepcao, `select public.marcar_questionario_usado($1, $2)`, [q1.id, q1.id]), /Sem permissão/);
await como(U.medico, `select public.marcar_questionario_usado($1, $2)`, [q1.id, "40000000-0000-0000-0000-000000000001"]);
const [usado] = await como(U.medico, `select usado_por, avaliacao_id from public.questionarios_pre where id = $1`, [q1.id]);
assert.equal(usado.usado_por, U.medico);
assert.equal(usado.avaliacao_id, "40000000-0000-0000-0000-000000000001");
const [reg] = await como(null, `select actor_id from public.auditoria where acao = 'questionario_trazido_para_avaliacao'`, [], "postgres");
assert.equal(reg.actor_id, U.medico);
ok("O médico da organização lê as respostas e as fotos, e o uso fica registrado");

// ── As fotos no Storage: só o médico da mesma organização ─────────────────
await db.exec(`insert into storage.objects (bucket_id, name) values
  ('questionarios', '${pasta}/1.jpg'), ('questionarios', '${INST.B}/outro/1.jpg'), ('outro-bucket', '${INST.A}/x.jpg')`);
const visiveis = async (uid) => (await como(uid, `select name from storage.objects order by name`)).map((o) => o.name);
assert.deepEqual(await visiveis(U.medico), [`${pasta}/1.jpg`]);
assert.deepEqual(await visiveis(U.recepcao), [], "a recepção não abre a receita");
assert.deepEqual(await visiveis(U.medicoB), [`${INST.B}/outro/1.jpg`]);
ok("A foto da receita abre só para o médico da organização");

// ── Link vencido ──────────────────────────────────────────────────────────
const [q2] = await criar(U.recepcao, P.beto);
await como(U.recepcao, `select public.registrar_envio_do_questionario($1)`, [q2.id]);
await db.exec(`update public.questionarios_pre set expires_at = now() - interval '1 minute' where id = '${q2.id}'`);
assert.equal((await publico(q2.token))[0].situacao, "vencido");
await assert.rejects(responder(q2.token, { quem: "paciente" }), /venceu/);
await assert.rejects(parte(q2.token, { quem: "paciente" }, 1), /venceu/);
assert.deepEqual(await situacao(U.recepcao, [P.beto]), [{ patient_id: P.beto, situacao: "vencido" }]);
const [q3] = await criar(U.recepcao, P.beto);
assert.notEqual(q3.id, q2.id, "vencido, mandar de novo cria outro link");
assert.equal((await publico(q3.token))[0].situacao, "aberto");
ok("Vencido em 7 dias: não aceita resposta, e mandar de novo gera link novo");

// ── O incompleto que venceu: fica para o médico ───────────────────────────
const [q4] = await criar(U.recepcao, P.ana);
await como(U.recepcao, `select public.registrar_envio_do_questionario($1)`, [q4.id]);
await parte(q4.token, { alergia: "sim", "alergia.texto": "Dipirona" }, 6);
await db.exec(`update public.questionarios_pre set expires_at = now() - interval '1 minute' where id = '${q4.id}'`);
const [inc] = await como(U.medico, `select respostas->>'alergia' as alergia, parte, status from public.questionarios_pre where id = $1`, [q4.id]);
assert.deepEqual(inc, { alergia: "sim", parte: 6, status: "enviado" });
assert.deepEqual(await situacao(U.recepcao, [P.ana]), [{ patient_id: P.ana, situacao: "incompleto" }]);
await como(U.medico, `select public.marcar_questionario_usado($1, $2)`, [q4.id, "40000000-0000-0000-0000-000000000002"]);
assert.equal((await como(U.medico, `select usado_por from public.questionarios_pre where id = $1`, [q4.id]))[0].usado_por, U.medico);
assert.deepEqual(await como(U.medicoB, `select id from public.questionarios_pre where id = $1`, [q4.id]), []);
ok("O incompleto fica para o médico mesmo depois de o link vencer, e ele pode trazer para a ficha");

console.log(`\n${passou} verificações passaram.`);
