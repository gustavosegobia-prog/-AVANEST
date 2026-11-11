// Testa a migração 202611110002 (pagamento da consulta na agenda e o Pix do
// grupo) num Postgres local (PGlite), sem tocar no banco de verdade. Dados
// todos fictícios. Rodar: npm run test:banco
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const MIG = readFileSync(new URL("../migrations/202611110002_pagamento_na_agenda_e_pix.sql", import.meta.url), "utf8");
const db = new PGlite();

const INST = { A: "10000000-0000-0000-0000-0000000000a1", B: "10000000-0000-0000-0000-0000000000b1", SEM: "10000000-0000-0000-0000-0000000000c1" };
const U = {
  dono: "00000000-0000-0000-0000-0000000000a1",
  recepcao: "00000000-0000-0000-0000-0000000000a2",
  centro: "00000000-0000-0000-0000-0000000000a3",
  recepcaoB: "00000000-0000-0000-0000-0000000000b1",
  recepcaoSem: "00000000-0000-0000-0000-0000000000c1",
};
const P = { ana: "20000000-0000-0000-0000-0000000000a1", sem: "20000000-0000-0000-0000-0000000000c1" };
const AG = { ana: "30000000-0000-0000-0000-0000000000a1", sem: "30000000-0000-0000-0000-0000000000c1" };

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;

create table public.instituicoes (id uuid primary key, nome text, modulos text[]);
create table public.perfis (id uuid primary key, institution_id uuid references public.instituicoes, nome text, role text,
  status text default 'ativo', permissoes text[] default '{}');
create table public.pacientes (id uuid primary key, institution_id uuid, nome text, hospital text);
create table public.agendamentos (id uuid primary key, institution_id uuid, patient_id uuid, data date, status text default 'agendado');
create table public.financeiro_atendimentos (id uuid primary key default gen_random_uuid(), institution_id uuid, patient_id uuid,
  avaliacao_id uuid, medico_id uuid, convenio text, hospital text, valor numeric, recebido numeric, status text,
  data_recebimento date, periodo text, observacoes text);
create table public.financeiro_pagamentos (id uuid primary key default gen_random_uuid(), institution_id uuid, atendimento_id uuid,
  valor numeric, metodo text, referencia text, created_by uuid);
create table public.auditoria (id uuid primary key default gen_random_uuid(), institution_id uuid not null, actor_id uuid,
  entidade text, entidade_id uuid, acao text not null, detalhes jsonb not null default '{}');

-- Como no banco.
create function public.current_institution_id() returns uuid language sql stable security definer set search_path = public as $$
  select institution_id from public.perfis where id = auth.uid() and status = 'ativo' $$;
create function public.current_has_permission(p_permission text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'ativo'
    and (p.role in ('admin', 'owner') or p.role = p_permission or 'todos' = any(coalesce(p.permissoes, '{}'))
         or p_permission = any(coalesce(p.permissoes, '{}')))) $$;
create function public.modulo_liberado(p_modulo text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select i.modulos is null or cardinality(i.modulos) = 0 or p_modulo = any(i.modulos)
    from public.instituicoes i join public.perfis p on p.institution_id = i.id where p.id = auth.uid() and p.status = 'ativo'), false) $$;
-- receber_particular como no banco (o recibo do balcão), resumido.
create function public.receber_particular(p_patient_id uuid, p_valor numeric, p_metodo text, p_referencia text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ator public.perfis; v_pac public.pacientes; v_id uuid;
begin
  select * into v_ator from public.perfis where id = auth.uid() and status = 'ativo';
  if v_ator.id is null then raise exception 'Sessão inválida'; end if;
  if not (public.current_has_permission('recepcao') or public.current_has_permission('medico')) then
    raise exception 'Sem permissão para registrar recebimento'; end if;
  if not public.modulo_liberado('financeiro') then raise exception 'Esta organização não contratou o módulo financeiro'; end if;
  select * into v_pac from public.pacientes where id = p_patient_id and institution_id = v_ator.institution_id;
  if v_pac.id is null then raise exception 'Paciente não encontrado nesta organização'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Informe o valor recebido'; end if;
  if p_metodo not in ('PIX','Dinheiro','Cartão','Transferência','Outro') then raise exception 'Forma de pagamento inválida'; end if;
  insert into public.financeiro_atendimentos (institution_id, patient_id, convenio, valor, recebido, status, observacoes)
  values (v_ator.institution_id, p_patient_id, 'Particular', p_valor, p_valor, 'pago', 'Recebido na recepção, no cadastro do paciente.')
  returning id into v_id;
  insert into public.financeiro_pagamentos (institution_id, atendimento_id, valor, metodo, referencia, created_by)
  values (v_ator.institution_id, v_id, p_valor, p_metodo, nullif(trim(coalesce(p_referencia, '')), ''), v_ator.id);
  return v_id;
end $$;

insert into public.instituicoes values ('${INST.A}', 'Grupo Fictício', null), ('${INST.B}', 'Outro Fictício', null),
  ('${INST.SEM}', 'Sem Financeiro', array['medico','recepcao']);
insert into public.perfis (id, institution_id, nome, role) values
  ('${U.dono}', '${INST.A}', 'Dono Fictício', 'owner'),
  ('${U.recepcao}', '${INST.A}', 'Recepção Fictícia', 'recepcao'),
  ('${U.centro}', '${INST.A}', 'Enf. Fictícia', 'centro'),
  ('${U.recepcaoB}', '${INST.B}', 'Recepção De Fora', 'recepcao'),
  ('${U.recepcaoSem}', '${INST.SEM}', 'Recepção Sem Financeiro', 'recepcao');
insert into public.pacientes values ('${P.ana}', '${INST.A}', 'ANA FICTÍCIA', null), ('${P.sem}', '${INST.SEM}', 'BETO FICTÍCIO', null);
insert into public.agendamentos values ('${AG.ana}', '${INST.A}', '${P.ana}', '2026-11-20'), ('${AG.sem}', '${INST.SEM}', '${P.sem}', '2026-11-20');
`);
await db.exec(MIG);
await db.exec(MIG);
console.log("ok  migração aplicada duas vezes");

let passou = 0;
const como = async (uid, sql, params = [], papel = "authenticated") => {
  await db.exec(`reset role; select set_config('app.uid', '${uid ?? ""}', false);`);
  await db.exec(`set role ${papel};`);
  try { return (await db.query(sql, params)).rows; } finally { await db.exec("reset role;"); }
};
const ok = (nome) => { passou++; console.log("ok ", nome); };
const receber = (uid, ag, valor, metodo, ref = null) =>
  como(uid, `select public.receber_consulta($1, $2, $3, $4) as id`, [ag, valor, metodo, ref]);
const pix = (uid) => como(uid, `select * from public.pix_da_organizacao()`);
const definir = (uid, tipo, chave, nome, cidade) =>
  como(uid, `select public.definir_pix_da_organizacao($1, $2, $3, $4)`, [tipo, chave, nome, cidade]);

// ── Registrar o pagamento da consulta ─────────────────────────────────────
await assert.rejects(receber(U.centro, AG.ana, 250, "PIX"), /Sem permissão/);
await assert.rejects(receber(U.recepcaoB, AG.ana, 250, "PIX"), /Consulta não encontrada/);
await assert.rejects(receber(U.recepcao, AG.ana, 0, "PIX"), /Informe o valor/);
await assert.rejects(receber(U.recepcao, AG.ana, 250, "Cheque"), /Forma de pagamento inválida/);
await assert.rejects(receber(null, AG.ana, 250, "PIX", null), /Sem permissão|permission denied/);
await assert.rejects(como(null, `select public.receber_consulta($1, 1, 'PIX', null)`, [AG.ana], "anon"), /permission denied/);
await assert.rejects(receber(U.recepcaoSem, AG.sem, 250, "PIX"), /não contratou o módulo financeiro/);
ok("Só a recepção ou o médico da organização, com valor e forma válidos, e com o Financeiro contratado");

const [{ id: fin }] = await receber(U.recepcao, AG.ana, 250, "Cartão", "Débito");
const [ag] = await como(null, `select pago_valor::float as valor, pago_metodo, pago_referencia, financeiro_atendimento_id, pago_em is not null as pago
  from public.agendamentos where id = $1`, [AG.ana], "postgres");
assert.deepEqual(ag, { valor: 250, pago_metodo: "Cartão", pago_referencia: "Débito", financeiro_atendimento_id: fin, pago: true });
const [f] = await como(null, `select a.valor::float as valor, a.status, a.observacoes, p.metodo, p.referencia
  from public.financeiro_atendimentos a join public.financeiro_pagamentos p on p.atendimento_id = a.id where a.id = $1`, [fin], "postgres");
assert.deepEqual(f, { valor: 250, status: "pago", observacoes: "Recebido na recepção, consulta de 20/11/2026.", metodo: "Cartão", referencia: "Débito" });
await assert.rejects(receber(U.recepcao, AG.ana, 250, "PIX"), /já tem pagamento registrado/);
const [{ n }] = await como(null, `select count(*)::int as n from public.financeiro_atendimentos`, [], "postgres");
assert.equal(n, 1, "não lança duas vezes");
ok("O pagamento fica na consulta e entra no Financeiro uma vez só");

// ── O Pix do grupo ────────────────────────────────────────────────────────
assert.deepEqual(await pix(U.recepcao), [], "sem Pix cadastrado, nada");
await assert.rejects(definir(U.recepcao, "cnpj", "12345678000199", "GRUPO FICTICIO", "CAMPO MOURAO"), /Só o administrador/);
await assert.rejects(definir(U.dono, "banco", "x", "GRUPO", "CIDADE"), /Tipo de chave inválido/);
await assert.rejects(definir(U.dono, "cnpj", "12345678000199", "X".repeat(26), "CIDADE"), /até 25/);
await assert.rejects(definir(U.dono, "cnpj", "12345678000199", "GRUPO", "C".repeat(16)), /até 15/);
await definir(U.dono, "cnpj", "12345678000199", "GRUPO FICTICIO", "CAMPO MOURAO");
assert.deepEqual(await pix(U.recepcao), [{ tipo: "cnpj", chave: "12345678000199", nome: "GRUPO FICTICIO", cidade: "CAMPO MOURAO", organizacao: "Grupo Fictício" }]);
assert.deepEqual(await pix(U.recepcaoB), [], "a outra organização não vê");
assert.deepEqual(await pix(U.centro), [], "o centro cirúrgico não cobra");
await assert.rejects(como(null, `select * from public.pix_da_organizacao()`, [], "anon"), /permission denied/);
const [reg] = await como(null, `select acao, detalhes->>'chave' as chave from public.auditoria where acao like 'pix_%'`, [], "postgres");
assert.deepEqual(reg, { acao: "pix_definido", chave: "12345678000199" });
await definir(U.dono, null, "", null, null);
assert.deepEqual(await pix(U.recepcao), [], "chave vazia remove");
ok("Só o administrador cadastra o Pix; a equipe da organização lê; a troca fica registrada");

console.log(`\n${passou} verificações passaram.`);
