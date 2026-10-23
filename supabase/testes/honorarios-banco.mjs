// Testa a migração 202610230001 (tabelas e honorários) num Postgres local
// (PGlite), sem tocar no banco de verdade: as tabelas e funções do Supabase
// que ela usa são imitadas aqui. Dados todos fictícios. Rodar: npm run test:banco
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const MIG = readFileSync(new URL("../migrations/202610230001_tabelas_e_honorarios.sql", import.meta.url), "utf8");
const db = new PGlite({ extensions: { pg_trgm } });

const U = {
  finA: "00000000-0000-0000-0000-00000000000a", medA: "00000000-0000-0000-0000-0000000000a1",
  medA2: "00000000-0000-0000-0000-0000000000a2", finB: "00000000-0000-0000-0000-00000000000b",
  sa: "00000000-0000-0000-0000-0000000000ff",
};
const INST = { A: "10000000-0000-0000-0000-00000000000a", B: "10000000-0000-0000-0000-00000000000b", S: "10000000-0000-0000-0000-0000000000ff" };

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema extensions; create schema auth; create schema storage;
grant usage on schema public, auth, storage, extensions to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated;

create table public.instituicoes (id uuid primary key, nome text, modulos text[]);
create table public.perfis (id uuid primary key, institution_id uuid references public.instituicoes, nome text, role text,
  status text default 'ativo', super_admin boolean default false, permissoes text[] default '{}');
create table public.locais_atendimento (id uuid primary key default gen_random_uuid(), institution_id uuid, nome text);
create table public.plantoes (id uuid primary key default gen_random_uuid());
create table public.evolucoes_anestesicas (id uuid primary key default gen_random_uuid());
create table public.auditoria (id uuid primary key default gen_random_uuid(), institution_id uuid, actor_id uuid, user_id uuid,
  tabela text not null default 'sistema', entidade text, entidade_id uuid, registro_id uuid, acao text not null,
  detalhes jsonb not null default '{}', dados_anteriores jsonb, dados_novos jsonb, ip text, created_at timestamptz not null default now());
alter table public.auditoria enable row level security;

create function public.current_institution_id() returns uuid language sql stable security definer set search_path = public
  as $$ select institution_id from public.perfis where id = auth.uid() $$;
create function public.current_app_role() returns text language sql stable security definer set search_path = public
  as $$ select role from public.perfis where id = auth.uid() $$;
create function public.current_has_permission(p_permission text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis p where p.id = auth.uid() and p.status = 'ativo'
    and (p.role in ('admin','owner') or p.role = p_permission or 'todos' = any(coalesce(p.permissoes,'{}')) or p_permission = any(coalesce(p.permissoes,'{}')))) $$;
create function public.modulo_liberado(p_modulo text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select i.modulos is null or cardinality(i.modulos) = 0 or p_modulo = any(i.modulos)
    from public.instituicoes i join public.perfis p on p.institution_id = i.id where p.id = auth.uid() and p.status = 'ativo'), false) $$;
create function public.e_super_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis sa where sa.id = auth.uid() and sa.super_admin and sa.status = 'ativo') $$;

create table public.producao_do_dia (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.instituicoes on delete cascade,
  perfil_id uuid not null references public.perfis on delete cascade, plantao_id uuid, data date not null, paciente text not null,
  convenio text not null default 'Particular', procedimento text, valor numeric(12,2) not null default 0 check (valor >= 0),
  situacao text not null default 'a_cobrar' check (situacao in ('a_cobrar','faturado','recebido','glosado')),
  observacoes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  enviado_em timestamptz, local_id uuid, pagador text, recebido_em date, faturado_em date, evolucao_id uuid);
alter table public.producao_do_dia enable row level security;
create policy "so_a_minha_producao" on public.producao_do_dia for all to authenticated
  using (institution_id = public.current_institution_id() and perfil_id = auth.uid())
  with check (institution_id = public.current_institution_id() and perfil_id = auth.uid());
create policy "financeiro_le_o_que_foi_enviado" on public.producao_do_dia for select to authenticated
  using (institution_id = public.current_institution_id() and enviado_em is not null and public.current_has_permission('financeiro'));
grant all on all tables in schema public to anon, authenticated;

insert into public.instituicoes values ('${INST.A}','Clínica A',null),('${INST.B}','Clínica B',null),('${INST.S}','Plataforma',null);
insert into public.perfis (id, institution_id, nome, role, super_admin) values
  ('${U.finA}','${INST.A}','Fin A','financeiro',false), ('${U.medA}','${INST.A}','Med A','medico',false),
  ('${U.medA2}','${INST.A}','Med A2','medico',false), ('${U.finB}','${INST.B}','Fin B','financeiro',false),
  ('${U.sa}','${INST.S}','Super','owner',true);
`);

// A migração roda duas vezes: reaplicar não quebra nem duplica.
await db.exec(MIG);
await db.exec(MIG);
console.log("ok  migração aplicada duas vezes");

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

// ── TUSS: versões, duplicidade, publicação, imutabilidade ─────────────────
const [v1] = await como(U.sa, `insert into tuss_versoes (versao, origem, publicada_em) values ('202601','https://www.gov.br/ans (teste)','2026-01-15') returning id`);
await como(U.sa, `insert into tuss_codigos (versao_id, codigo, descricao) values ($1,'90000001','PROCEDIMENTO FICTICIO UM'),($1,'90000002','PROCEDIMENTO FICTICIO DOIS')`, [v1.id]);
await falha(U.sa, `insert into tuss_codigos (versao_id, codigo, descricao) values ($1,'90000001','DE NOVO')`, /duplicate key|unique/, [v1.id]);
ok("TUSS: o mesmo código duas vezes na mesma versão é recusado");
await falha(U.finA, `insert into tuss_versoes (versao, origem) values ('x','y')`, /row-level security/);
ok("TUSS: clínica não importa TUSS (só a plataforma)");
await como(U.sa, `select publicar_versao_tuss($1)`, [v1.id]);
await falha(U.sa, `update tuss_codigos set descricao = 'MUDEI' where versao_id = $1`, /não mudam/, [v1.id]);
await falha(U.sa, `delete from tuss_versoes where id = $1`, /não se apaga/, [v1.id]);
ok("TUSS: versão publicada não muda nem se apaga");
const [v2] = await como(U.sa, `insert into tuss_versoes (versao, origem) values ('202603','https://www.gov.br/ans (teste)') returning id`);
await como(U.sa, `insert into tuss_codigos (versao_id, codigo, descricao, situacao) values ($1,'90000001','PROCEDIMENTO FICTICIO UM','ativo'),($1,'90000002','PROCEDIMENTO FICTICIO DOIS','inativo')`, [v2.id]);
await como(U.sa, `select publicar_versao_tuss($1)`, [v2.id]);
const versoes = await como(U.finA, `select versao, situacao from tuss_versoes order by versao`);
assert.deepEqual(versoes, [{ versao: "202601", situacao: "substituida" }, { versao: "202603", situacao: "vigente" }]);
ok("TUSS: a versão nova vale e a antiga fica guardada como substituída");
const busca = await como(U.medA, `select codigo from tuss_codigos t join tuss_versoes v on v.id = t.versao_id where v.situacao = 'vigente' and t.descricao ilike '%ficticio%' order by codigo`);
assert.equal(busca.length, 2);
ok("TUSS: qualquer usuário consulta os códigos (busca por descrição)");

// ── CBHPM e contrato da clínica A ──────────────────────────────────────────
const [ed] = await como(U.finA, `insert into cbhpm_edicoes (institution_id, nome, edicao, ano, fonte) values ($1,'CBHPM de teste','T1',2026,'cadastro manual de teste') returning id`, [INST.A]);
await como(U.finA, `insert into cbhpm_procedimentos (edicao_id, institution_id, codigo, descricao, porte_anestesico) values ($1,$2,'C001','CIRURGIA FICTICIA',3)`, [ed.id, INST.A]);
await como(U.finA, `insert into cbhpm_portes (edicao_id, institution_id, porte, valor_referencia, vigencia_inicio, fonte) values ($1,$2,3,500,'2026-01-01','teste')`, [ed.id, INST.A]);
await como(U.finA, `update cbhpm_edicoes set situacao = 'vigente' where id = $1`, [ed.id]);
await falha(U.finA, `update cbhpm_procedimentos set porte_anestesico = 4 where edicao_id = $1`, /não muda/, [ed.id]);
ok("CBHPM: edição publicada não muda");
await falha(U.finB, `insert into cbhpm_procedimentos (edicao_id, institution_id, codigo, descricao) values ($1,$2,'X','X')`, /não muda|row-level security/, [ed.id, INST.B]);
assert.equal((await como(U.finB, `select * from cbhpm_edicoes`)).length, 0);
assert.equal((await como(U.medA, `select * from cbhpm_edicoes`)).length, 0);
ok("CBHPM: outra clínica e o médico não leem nem escrevem a CBHPM da clínica A");

const [cor] = await como(U.finA, `insert into tuss_cbhpm_correspondencias (institution_id, tuss_codigo, cbhpm_edicao_id, cbhpm_codigo, origem) values ($1,'90000001',$2,'C001','teste') returning id, situacao`, [INST.A, ed.id]);
await como(U.finA, `update tuss_cbhpm_correspondencias set situacao = 'validada' where id = $1`, [cor.id]);
const [corV] = await como(U.finA, `select validada_por, validada_em is not null as tem_data from tuss_cbhpm_correspondencias where id = $1`, [cor.id]);
assert.deepEqual(corV, { validada_por: U.finA, tem_data: true });
await falha(U.finA, `insert into tuss_cbhpm_correspondencias (institution_id, tuss_codigo, cbhpm_edicao_id, cbhpm_codigo, origem, situacao) values ($1,'90000001',$2,'C002','teste','validada')`, /duplicate key|unique/, [INST.A, ed.id]);
await falha(U.finA, `update tuss_cbhpm_correspondencias set cbhpm_codigo = 'C009' where id = $1`, /só pode ser revogada|não mudam/, [cor.id]);
ok("Correspondência: validada carimba quem e quando, uma por código, e não se troca");

const [op] = await como(U.finA, `insert into operadoras (institution_id, nome) values ($1,'Unimed Teste') returning id, nome_chave`, [INST.A]);
assert.equal(op.nome_chave, "unimed teste");
await falha(U.finA, `insert into operadoras (institution_id, nome) values ($1,'UNIMED  teste')`, /duplicate key|unique/, [INST.A]);
ok("Operadora: o mesmo convênio com outra grafia não duplica");
const [ct] = await como(U.finA, `insert into contratos (institution_id, operadora_id, identificacao) values ($1,$2,'Contrato 1') returning id`, [INST.A, op.id]);
const [cv1] = await como(U.finA, `insert into contrato_versoes (contrato_id, institution_id, versao, vigencia_inicio, vigencia_fim, referencia, cbhpm_edicao_id, multiplos_percentuais, urgencia_percentual)
  values ($1,$2,1,'2026-01-01','2026-06-30','cbhpm',$3,'{100,50}',30) returning id`, [ct.id, INST.A, ed.id]);
await como(U.finA, `insert into contrato_valores_porte (versao_id, institution_id, porte, valor) values ($1,$2,3,600)`, [cv1.id, INST.A]);
await como(U.finA, `update contrato_versoes set situacao = 'vigente' where id = $1`, [cv1.id]);
const [pub] = await como(U.finA, `select publicada_por from contrato_versoes where id = $1`, [cv1.id]);
assert.equal(pub.publicada_por, U.finA);
await falha(U.finA, `update contrato_valores_porte set valor = 700 where versao_id = $1`, /não mudam/, [cv1.id]);
await falha(U.finA, `update contrato_versoes set reajuste_percentual = 10 where id = $1`, /não muda/, [cv1.id]);
ok("Contrato: versão publicada registra quem publicou e não muda (nem valores nem reajuste)");
const [cv2] = await como(U.finA, `insert into contrato_versoes (contrato_id, institution_id, versao, vigencia_inicio, referencia, cbhpm_edicao_id, reajuste_percentual)
  values ($1,$2,2,'2026-06-01','cbhpm',$3,8) returning id`, [ct.id, INST.A, ed.id]);
await falha(U.finA, `update contrato_versoes set situacao = 'vigente' where id = $1`, /Já há uma versão vigente/, [cv2.id]);
await como(U.finA, `update contrato_versoes set vigencia_inicio = '2026-07-01' where id = $1`, [cv2.id]);
await como(U.finA, `update contrato_versoes set situacao = 'vigente' where id = $1`, [cv2.id]);
ok("Contrato: duas versões vigentes no mesmo período são recusadas; reajuste vira versão nova");
await como(U.finA, `update contrato_versoes set situacao = 'encerrada' where id = $1`, [cv1.id]);
await falha(U.finA, `update contrato_versoes set situacao = 'vigente' where id = $1`, /encerrada não muda/, [cv1.id]);
await falha(U.finA, `delete from contrato_versoes where id = $1`, /não se apaga/, [cv1.id]);
ok("Contrato: versão encerrada fica no banco, sem voltar nem sumir");

assert.equal((await como(U.finB, `select * from contratos`)).length, 0);
assert.equal((await como(U.finB, `select * from contrato_valores_porte`)).length, 0);
assert.equal((await como(U.medA, `select * from contrato_versoes`)).length, 0);
await falha(U.finB, `insert into contratos (institution_id, operadora_id, identificacao) values ($1,$2,'invasão')`, /row-level security|mesma organização/, [INST.A, op.id]);
ok("Segregação: a clínica B e o médico da A não veem nem escrevem os contratos da A");

const aud = await como(null, `select tabela, acao, dados_anteriores->>'situacao' as antes, dados_novos->>'situacao' as depois from auditoria where tabela = 'contrato_versoes' and acao = 'update' order by created_at`);
assert.ok(aud.some((a) => a.antes === "rascunho" && a.depois === "vigente"));
assert.ok(aud.some((a) => a.antes === "vigente" && a.depois === "encerrada"));
ok("Auditoria: cada mudança de contrato guarda quem, quando, antes e depois");

// ── Produção: o fluxo atual continua; o honorário não se escreve à mão ─────
const [pr] = await como(U.medA, `insert into producao_do_dia (institution_id, perfil_id, data, paciente, convenio, procedimento)
  values ($1,$2,'2026-03-10','PACIENTE FICTICIO','Unimed Teste','cirurgia ficticia') returning id, honorario_situacao`, [INST.A, U.medA]);
assert.equal(pr.honorario_situacao, "nao_calculado");
await como(U.medA, `update producao_do_dia set valor = 450, situacao = 'faturado', observacoes = 'ok' where id = $1`, [pr.id]);
ok("Produção: o médico continua anotando valor, situação e observação como antes");
await falha(U.medA, `update producao_do_dia set honorario_valor_previsto = 999 where id = $1`, /muda pelo cálculo/, [pr.id]);
await falha(U.medA, `update producao_do_dia set valor_recebido = 999 where id = $1`, /muda pelo cálculo/, [pr.id]);
ok("Produção: honorário previsto e valores do Financeiro não se escrevem à mão");
await como(null, `update producao_do_dia set honorario_situacao = 'calculado', honorario_valor_previsto = 600, honorario_calculo = '{"regra":"teste"}' where id = $1`, [pr.id]);
await como(U.medA, `insert into producao_procedimentos (producao_id, institution_id, perfil_id, ordem, tuss_codigo) values ($1,$2,$3,1,'90000001')`, [pr.id, INST.A, U.medA]);
const [depois] = await como(U.medA, `select honorario_situacao, honorario_valor_previsto, honorario_calculo->>'regra' as regra from producao_do_dia where id = $1`, [pr.id]);
assert.deepEqual(depois, { honorario_situacao: "nao_calculado", honorario_valor_previsto: "600.00", regra: "teste" });
ok("Produção: mexer nos procedimentos pede novo cálculo, e o cálculo anterior fica guardado");
await como(null, `update producao_do_dia set honorario_situacao = 'calculado' where id = $1`, [pr.id]);
await como(U.medA, `update producao_do_dia set convenio = 'Particular' where id = $1`, [pr.id]);
assert.equal((await como(U.medA, `select honorario_situacao from producao_do_dia where id = $1`, [pr.id]))[0].honorario_situacao, "nao_calculado");
ok("Produção: trocar o convênio desfaz o cálculo anterior");

assert.equal((await como(U.medA2, `select * from producao_procedimentos`)).length, 0);
assert.equal((await como(U.finA, `select * from producao_procedimentos`)).length, 0);
ok("Privacidade: colega e Financeiro não veem os procedimentos antes do envio");
await como(U.medA, `update producao_do_dia set enviado_em = now() where id = $1`, [pr.id]);
assert.equal((await como(U.finA, `select * from producao_procedimentos`)).length, 1);
assert.equal((await como(U.finB, `select * from producao_procedimentos`)).length, 0);
ok("Privacidade: depois do envio o Financeiro da clínica vê; o de outra clínica, não");

await como(U.finA, `insert into producao_movimentos (producao_id, institution_id, tipo, valor) values ($1,$2,'pagamento',300)`, [pr.id, INST.A]);
await como(U.finA, `update producao_movimentos set valor = 1 where producao_id = $1`, [pr.id]);
assert.equal((await como(U.finA, `select valor from producao_movimentos where producao_id = $1`, [pr.id]))[0].valor, "300.00");
await falha(null, `update producao_movimentos set valor = 1 where producao_id = $1`, /não se edita/, [pr.id]);
await falha(U.medA, `insert into producao_movimentos (producao_id, institution_id, tipo, valor) values ($1,$2,'pagamento',300)`, /row-level security/, [pr.id, INST.A]);
assert.equal((await como(U.medA, `select * from producao_movimentos`)).length, 1);
ok("Movimentos: o Financeiro lança pagamento parcial; não se edita; o médico só lê o seu");
await falha(U.medA, `delete from producao_do_dia where id = $1`, /violates foreign key|restrict/, [pr.id]);
ok("Movimentos: anestesia com histórico financeiro não some");

await como(U.medA, `update producao_do_dia set valor = 480 where id = $1`, [pr.id]);
const audProd = await como(null, `select dados_anteriores, dados_novos from auditoria where tabela = 'producao_do_dia' order by created_at desc limit 1`);
assert.deepEqual(audProd[0], { dados_anteriores: { valor: 450 }, dados_novos: { valor: 480 } });
assert.equal(JSON.stringify(audProd).includes("PACIENTE"), false);
ok("Auditoria da Produção: só depois do envio, com antes e depois, sem o nome do paciente");

console.log(`\n${passou} verificações passaram.`);
