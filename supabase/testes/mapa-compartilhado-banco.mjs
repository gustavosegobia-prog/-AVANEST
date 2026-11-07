// Testa a migração 202611070001 (o mapa do hospital lido pela ficha do serviço
// de anestesia) num Postgres local (PGlite), sem tocar no banco de verdade: as
// tabelas e funções do Supabase que ela usa são imitadas aqui. Dados todos
// fictícios. Rodar: npm run test:banco
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const MIG = readFileSync(new URL("../migrations/202611070001_mapa_do_hospital_compartilhado.sql", import.meta.url), "utf8");
const db = new PGlite();

// H = a organização do hospital (o centro cirúrgico monta o mapa); S = o
// serviço de anestesia; X = outro serviço, sem ligação.
const INST = { H: "10000000-0000-0000-0000-0000000000a1", S: "10000000-0000-0000-0000-0000000000b1", X: "10000000-0000-0000-0000-0000000000c1" };
const U = {
  centro: "00000000-0000-0000-0000-0000000000a1", // do hospital
  med: "00000000-0000-0000-0000-0000000000b1", // anestesista do serviço
  med2: "00000000-0000-0000-0000-0000000000b2", // outro anestesista do serviço
  recep: "00000000-0000-0000-0000-0000000000b3", // recepção do serviço: não abre ficha
  inativo: "00000000-0000-0000-0000-0000000000b4",
  outro: "00000000-0000-0000-0000-0000000000c1", // anestesista de outro serviço
};
const L = {
  hospital: "20000000-0000-0000-0000-0000000000a1", // o local do hospital, na organização dele
  outraCasa: "20000000-0000-0000-0000-0000000000a2", // outro hospital do mesmo grupo de origem
  noServico: "20000000-0000-0000-0000-0000000000b1", // o mesmo hospital, na lista do serviço
  clinica: "20000000-0000-0000-0000-0000000000b2", // outro local do serviço
  particular: "20000000-0000-0000-0000-0000000000b3", // local particular de med2
  doOutro: "20000000-0000-0000-0000-0000000000c1",
};

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;

create table public.instituicoes (id uuid primary key, nome text);
create table public.perfis (id uuid primary key, institution_id uuid references public.instituicoes, nome text, role text,
  status text default 'ativo', permissoes text[] default '{}');
create table public.locais_atendimento (id uuid primary key, institution_id uuid not null references public.instituicoes,
  owner_id uuid references public.perfis, nome text not null, nome_fantasia text);
create table public.centro_salas (id uuid primary key default gen_random_uuid(), institution_id uuid not null, nome text not null);
create table public.centro_casos (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, data date not null, sala_id uuid,
  ordem integer, horario time, paciente text not null, idade smallint, prontuario text, procedimento text not null,
  cirurgiao text, convenio text, anestesista_id uuid, etapa text not null default 'agendado', leito text, observacoes text,
  cancelado_motivo text, patient_id uuid, evolucao_id uuid, local_atendimento_id uuid, data_nascimento date, tipo_anestesia text);

create function public.current_institution_id() returns uuid language sql stable security definer set search_path = public
  as $$ select institution_id from public.perfis where id = auth.uid() and status = 'ativo' $$;
create function public.current_has_permission(p_permission text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'ativo'
    and (p.role in ('admin','owner') or p.role = p_permission or p_permission = any(coalesce(p.permissoes,'{}')))) $$;
create function public.evolucao_liberada() returns boolean language sql stable as $$ select true $$;
-- Como em 202610100004.
create function public.pode_evolucao(p_institution_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_institution_id is not null and p_institution_id = public.current_institution_id()
     and public.current_has_permission('medico') and public.evolucao_liberada() $$;

insert into public.instituicoes values
  ('${INST.H}', 'HOSPITAL FICTICIO — Centro Cirúrgico'), ('${INST.S}', 'Serviço Fictício de Anestesia'), ('${INST.X}', 'Outro Serviço Fictício');
insert into public.perfis (id, institution_id, nome, role, status) values
  ('${U.centro}', '${INST.H}', 'Centro Fictício', 'centro', 'ativo'),
  ('${U.med}', '${INST.S}', 'Dra. Fictícia', 'medico', 'ativo'),
  ('${U.med2}', '${INST.S}', 'Dr. Fictício', 'medico', 'ativo'),
  ('${U.recep}', '${INST.S}', 'Recepção Fictícia', 'recepcao', 'ativo'),
  ('${U.inativo}', '${INST.S}', 'Ex-membro Fictício', 'medico', 'inativo'),
  ('${U.outro}', '${INST.X}', 'Dr. De Fora', 'medico', 'ativo');
insert into public.locais_atendimento (id, institution_id, owner_id, nome, nome_fantasia) values
  ('${L.hospital}', '${INST.H}', null, 'HOSPITAL FICTICIO', 'Hospital Fictício'),
  ('${L.outraCasa}', '${INST.H}', null, 'OUTRA CASA FICTICIA', null),
  ('${L.noServico}', '${INST.S}', null, 'Hospital Fictício', null),
  ('${L.clinica}', '${INST.S}', null, 'Clínica Fictícia', null),
  ('${L.particular}', '${INST.S}', '${U.med2}', 'Consultório Fictício', null),
  ('${L.doOutro}', '${INST.X}', null, 'Hospital Fictício', null);
insert into public.centro_salas (id, institution_id, nome) values ('30000000-0000-0000-0000-000000000001', '${INST.H}', ' Sala 1 ');

-- O mapa do hospital: hoje (no fuso do serviço), ontem, cancelado, e o de outra casa do mesmo grupo.
insert into public.centro_casos (institution_id, data, sala_id, ordem, horario, paciente, idade, prontuario, procedimento,
  cirurgiao, convenio, anestesista_id, etapa, leito, observacoes, local_atendimento_id, data_nascimento) values
  ('${INST.H}', (now() at time zone 'America/Sao_Paulo')::date, '30000000-0000-0000-0000-000000000001', 1, '07:00',
   'PACIENTE UM FICTICIO', 61, 'PRONT-123', 'COLECISTECTOMIA', 'DR. CIRURGIAO FICTICIO', 'SUS', '${U.centro}', 'agendado',
   '9/3', 'alergia a dipirona (fictício)', '${L.hospital}', '1965-03-01'),
  ('${INST.H}', (now() at time zone 'America/Sao_Paulo')::date, null, 2, null,
   'PACIENTE DOIS FICTICIO', 40, null, 'HERNIORRAFIA', null, 'Unimed', null, 'em_sala', null, null, '${L.hospital}', null),
  ('${INST.H}', (now() at time zone 'America/Sao_Paulo')::date, null, 3, null,
   'PACIENTE CANCELADO FICTICIO', 30, null, 'RTU', null, null, null, 'cancelado', null, null, '${L.hospital}', null),
  ('${INST.H}', (now() at time zone 'America/Sao_Paulo')::date - 1, null, 1, '07:00',
   'PACIENTE DE ONTEM FICTICIO', 50, null, 'RTU', null, null, null, 'concluido', null, null, '${L.hospital}', null),
  ('${INST.H}', (now() at time zone 'America/Sao_Paulo')::date, null, 1, '08:00',
   'PACIENTE DA OUTRA CASA FICTICIO', 70, null, 'ARTROPLASTIA', null, null, null, 'agendado', null, null, '${L.outraCasa}', null);
`);
// A migração roda duas vezes: reaplicar não quebra nem duplica.
await db.exec(MIG);
await db.exec(MIG);
// Como no Supabase: as tabelas novas ganhariam as permissões padrão; a migração as tira.
await db.exec(MIG);
console.log("ok  migração aplicada três vezes");

let passou = 0;
const como = async (uid, sql, params = []) => {
  await db.exec(`reset role; select set_config('app.uid', '${uid ?? ""}', false);`);
  if (uid) await db.exec("set role authenticated;");
  try { return (await db.query(sql, params)).rows; } finally { await db.exec("reset role;"); }
};
const falha = async (uid, sql, trecho, params = []) => {
  await assert.rejects(como(uid, sql, params), (e) => { assert.match(String(e.message), trecho); return true; });
};
const ok = (nome) => { passou++; console.log("ok ", nome); };
const mapa = (uid, local) => como(uid, `select * from public.mapa_compartilhado_do_dia($1)`, [local]);
const leituras = () => como(null, `select perfil_id, vezes, pacientes from public.centro_compartilhamento_leituras order by perfil_id`);

// ── Sem ligação, nada ─────────────────────────────────────────────────────
assert.equal((await mapa(U.med, L.noServico)).length, 0);
assert.equal((await leituras()).length, 0, "sem ligação, nem leitura registrada");
ok("Sem ligação autorizada, o mapa do hospital não aparece");

// ── A API não chega às tabelas ────────────────────────────────────────────
for (const t of ["centro_compartilhamentos", "centro_compartilhamento_leituras"]) {
  await falha(U.med, `select * from public.${t}`, /permission denied/);
  await falha(U.centro, `select * from public.${t}`, /permission denied/);
}
await falha(U.med, `insert into public.centro_compartilhamentos (origem_institution_id, destino_institution_id, destino_local_id,
  autorizado_por, autorizado_em, documento) values ('${INST.H}', '${INST.S}', '${L.noServico}', 'Eu mesmo', current_date, 'nenhum')`, /permission denied/);
ok("Ninguém lê nem cria ligação pela API (nem o médico, nem o centro)");

// ── A ligação confere as organizações e a autorização ─────────────────────
const ligar = (extra = {}) => {
  const v = { origem: INST.H, origemLocal: L.hospital, destino: INST.S, destinoLocal: L.noServico, por: "Diretoria Fictícia do Hospital",
    doc: "Termo fictício nº 1", validoAte: null, ...extra };
  return como(null, `insert into public.centro_compartilhamentos (origem_institution_id, origem_local_id, destino_institution_id,
    destino_local_id, autorizado_por, autorizado_em, documento, valido_ate) values ($1, $2, $3, $4, $5, current_date, $6, $7) returning id`,
  [v.origem, v.origemLocal, v.destino, v.destinoLocal, v.por, v.doc, v.validoAte]);
};
await falha(null, `insert into public.centro_compartilhamentos (origem_institution_id, destino_institution_id, destino_local_id,
  autorizado_em, documento) values ('${INST.H}', '${INST.S}', '${L.noServico}', current_date, 'x')`, /null value|not-null/);
await assert.rejects(ligar({ por: " " }), /check constraint/);
await assert.rejects(ligar({ doc: "" }), /check constraint/);
await assert.rejects(ligar({ destinoLocal: L.hospital }), /destino não é da organização/);
await assert.rejects(ligar({ origemLocal: L.noServico }), /origem não é da organização/);
await assert.rejects(ligar({ destino: INST.H, destinoLocal: L.hospital }), /outra_casa/);
ok("Ligação sem quem autorizou ou sem documento, ou com locais trocados, é recusada");

const [lig] = await ligar();
await assert.rejects(ligar(), /duplicate key|unique/);
ok("Uma ligação viva por hospital de origem e de destino");

// ── Com a ligação: o mínimo, só hoje, só para quem abre ficha ─────────────
const linhas = await mapa(U.med, L.noServico);
assert.deepEqual(linhas.map((l) => l.paciente), ["PACIENTE UM FICTICIO", "PACIENTE DOIS FICTICIO"],
  "sem o cancelado, sem o de ontem, sem o da outra casa do grupo");
assert.deepEqual(Object.keys(linhas[0]).sort(),
  ["cirurgiao", "convenio", "data", "data_nascimento", "etapa", "horario", "hospital", "id", "idade", "ordem", "paciente", "procedimento", "sala",
    "tipo_anestesia"]);
assert.equal(linhas[0].sala, "Sala 1");
assert.equal(linhas[0].hospital, "Hospital Fictício");
assert.equal(linhas[1].sala, "");
const texto = JSON.stringify(linhas);
for (const segredo of ["PRONT-123", "9/3", "dipirona", U.centro]) assert.ok(!texto.includes(segredo), `${segredo} fica no hospital`);
ok("Com a ligação: os pacientes de hoje, sem prontuário, leito, observações nem anestesista");

assert.equal((await mapa(U.med2, L.noServico)).length, 2, "qualquer anestesista do serviço, no hospital da ligação");
assert.equal((await mapa(U.med, L.clinica)).length, 0, "outro local do serviço: nada");
assert.equal((await mapa(U.med, L.particular)).length, 0, "o local particular de outro médico: nada");
assert.equal((await mapa(U.med, L.hospital)).length, 0, "o local do hospital não é da casa de quem pede");
assert.equal((await mapa(U.med, null)).length, 0);
assert.equal((await mapa(U.recep, L.noServico)).length, 0, "quem não abre ficha anestésica não vê");
assert.equal((await mapa(U.inativo, L.noServico)).length, 0, "quem saiu do serviço não vê");
assert.equal((await mapa(U.outro, L.noServico)).length, 0, "outro serviço, nem com o id do local");
assert.equal((await mapa(U.outro, L.doOutro)).length, 0, "outro serviço, no seu próprio local do mesmo hospital");
assert.equal((await mapa(U.centro, L.noServico)).length, 0);
ok("Só quem abre ficha no serviço, e só no hospital da ligação");

// ── Só leitura ────────────────────────────────────────────────────────────
const antes = await como(null, `select * from public.centro_casos order by id`);
await mapa(U.med, L.noServico);
assert.deepEqual(await como(null, `select * from public.centro_casos order by id`), antes);
ok("Ler não muda nada no mapa do hospital");

// ── Cada leitura fica registrada ──────────────────────────────────────────
const lidas = await leituras();
assert.deepEqual(lidas, [{ perfil_id: U.med, vezes: 2, pacientes: 2 }, { perfil_id: U.med2, vezes: 1, pacientes: 2 }]);
ok("Quem leu, quantas vezes e quantos pacientes, por dia; quem não pode não deixa registro");

// ── A ligação não se edita; revogada some e não volta ─────────────────────
await assert.rejects(como(null, `update public.centro_compartilhamentos set destino_local_id = $1 where id = $2`, [L.clinica, lig.id]), /não se edita/);
await assert.rejects(como(null, `update public.centro_compartilhamentos set autorizado_por = 'Outro' where id = $1`, [lig.id]), /não se edita/);
await como(null, `update public.centro_compartilhamentos set revogado_em = now(), revogado_motivo = 'Fim do contrato (fictício)' where id = $1`, [lig.id]);
assert.equal((await mapa(U.med, L.noServico)).length, 0);
await assert.rejects(como(null, `update public.centro_compartilhamentos set revogado_em = null where id = $1`, [lig.id]), /revogada não volta/);
ok("Revogada, a lista some na hora; a ligação não se edita e revogada não volta");

// ── Prazo: vencida não vale ───────────────────────────────────────────────
await assert.rejects(ligar({ validoAte: "2000-01-01" }), /validade/);
const [nova] = await como(null, `insert into public.centro_compartilhamentos (origem_institution_id, origem_local_id, destino_institution_id,
  destino_local_id, autorizado_por, autorizado_em, documento, valido_ate) values ($1, $2, $3, $4, 'Diretoria Fictícia', current_date - 30, 'Termo fictício nº 2', current_date - 1) returning id`,
[INST.H, L.hospital, INST.S, L.noServico]);
assert.ok(nova.id);
assert.equal((await mapa(U.med, L.noServico)).length, 0, "vencida ontem: nada");
await como(null, `update public.centro_compartilhamentos set revogado_em = now() where id = $1`, [nova.id]);
ok("A ligação vencida não mostra nada");

// ── Sem local de origem: a organização inteira é o hospital ───────────────
await ligar({ origemLocal: null, doc: "Termo fictício nº 3" });
assert.equal((await mapa(U.med, L.noServico)).length, 3, "com a outra casa do grupo, que a ligação inteira cobre");
ok("Ligação da organização inteira cobre todos os locais dela");

// ── A função de gatilho não fica ao alcance da API ────────────────────────
await falha(U.med, `select public.centro_compartilhamento_antes_de_gravar()`, /permission denied|trigger functions can only be called as triggers/);
ok("Funções de gatilho fora da API");

console.log(`\n${passou} verificações passaram.`);
