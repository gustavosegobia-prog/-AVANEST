import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * GLOSA ERA SÓ STATUS E VALOR — NADA SOBRE O QUE ACONTECE DEPOIS.
 *
 * Marcar um lançamento como "glosa" dizia QUE o convênio recusou pagar e
 * QUANTO — mas recorrer de uma glosa tem prazo, motivo e desfecho, e nenhum
 * dos três tinha onde morar. A migração 202609300003_glosa_recurso.sql
 * acrescenta glosa_recurso_status/prazo/motivo em financeiro_atendimentos.
 *
 * Checado antes de construir: zero linhas com status='glosa' ou
 * glosa_valor>0 em toda a plataforma. Por isso o desenho é deliberadamente
 * enxuto — status do recurso, prazo, motivo — e não um fluxo de reenvio ao
 * convênio ou histórico de tentativas: sem um caso real para observar,
 * inventar mais do que isso seria assumir como o processo funciona.
 */
const ler = (caminho: string) =>
  readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const sql = ler("supabase/migrations/202609300003_glosa_recurso.sql");
const tela = ler("app/dashboard/dashboard-client.tsx");

test("a migração acrescenta status, prazo e motivo do recurso, com o status nascendo sem_recurso", () => {
  assert.match(sql,
    /add column if not exists glosa_recurso_status text not null default 'sem_recurso'/,
    "sumiu ou mudou a coluna de status do recurso");
  assert.match(sql,
    /check \(glosa_recurso_status in \('sem_recurso','em_recurso','aceito','negado'\)\)/,
    "os quatro estados do recurso mudaram");
  assert.match(sql, /add column if not exists glosa_recurso_prazo date/,
    "sumiu a coluna de prazo do recurso");
  assert.match(sql, /add column if not exists glosa_recurso_motivo text/,
    "sumiu a coluna de motivo do recurso");
});

test("o tipo Financeiro no cliente conhece os três campos novos", () => {
  assert.match(tela,
    /glosa_recurso_status\?:string; glosa_recurso_prazo\?:string\|null; glosa_recurso_motivo\?:string\|null;/,
    "o tipo Financeiro não foi atualizado com os campos de recurso");
});

test("glosasParaRecurso conta glosa sem desfecho — nem aceita, nem negada", () => {
  assert.match(tela,
    /const glosasParaRecurso=financeiro\.filter\(item=>\s*\n\s*item\.status==="glosa"&&!\["aceito","negado"\]\.includes\(item\.glosa_recurso_status\|\|"sem_recurso"\)\);/,
    "a contagem de glosas pendentes de recurso mudou de critério");
});

test("a aba Glosas existe na navegação, com o contador de glosas em aberto", () => {
  const i = tela.indexOf('aria-label="Seções do Financeiro"');
  const nav = tela.slice(i, i + 2700);
  assert.match(nav, /\["glosas","Glosas",glosasParaRecurso\.length\]/,
    "a aba Glosas sumiu da navegação, ou parou de mostrar o contador certo");
});

test("o painel de Glosas resolve recurso, prazo e motivo por lançamento", () => {
  const i = tela.indexOf('chave="fin-glosas"');
  assert.notEqual(i, -1, "não achei o painel de Glosas em recurso");
  const painel = tela.slice(i, i + 3000);
  assert.match(painel, /updateItem\(item\.id,\{glosa_recurso_status:e\.target\.value\}\)/,
    "o select de status do recurso deixou de gravar via updateItem");
  assert.match(painel, /updateItem\(item\.id,\{glosa_recurso_prazo:e\.target\.value\|\|null\}\)/,
    "o campo de prazo deixou de gravar via updateItem");
  assert.match(painel, /updateItem\(item\.id,\{glosa_recurso_motivo:e\.target\.value\|\|null\}\)/,
    "o campo de motivo deixou de gravar via updateItem");
  assert.match(painel, /aceito","negado"\]\.includes\(a\.glosa_recurso_status/,
    "a lista deixou de separar recurso resolvido de recurso em aberto");
});

test("glosa com prazo vencido ou vencendo em 7 dias soa o alerta", () => {
  assert.match(tela,
    /const prazoRecursoLimite=somarDias\(todayIso,7\);/,
    "sumiu o cálculo do limite de 7 dias para o alerta de prazo");
  const i = tela.indexOf('chave="fin-glosas"');
  const painel = tela.slice(i, i + 800);
  assert.match(painel, /glosasPrazoVencendo\.length>0&&/,
    "o painel de Glosas deixou de checar prazo vencendo antes de mostrar o alerta");
});
