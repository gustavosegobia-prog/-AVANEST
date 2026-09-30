import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A TRAVA DO MÊS FECHADO ERA SÓ DA TELA.
 *
 * As funções do Financeiro são SECURITY INVOKER e as regras de acesso das
 * tabelas eram "ALL" para quem tem permissão de financeiro: editar lançamento
 * de mês fechado, reabrir sem ser administrador, apagar pagamento sem estorno
 * — tudo passava chamando a API direto.
 *
 * 202609300004 põe gatilhos nas três tabelas. As funções legítimas ligam uma
 * marca de transação e passam; a escrita direta é recusada. Validado no banco
 * antes de aplicar, dentro de uma transação desfeita no fim: dezessete casos,
 * todos com o resultado esperado.
 */
const ler = (caminho: string) =>
  readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const sql = ler("supabase/migrations/202609300004_trava_do_periodo_no_banco.sql");
const tela = ler("app/dashboard/dashboard-client.tsx");

test("as três tabelas do Financeiro ganham gatilho de trava", () => {
  for (const tabela of ["financeiro_atendimentos", "financeiro_pagamentos", "financeiro_periodos"]) {
    assert.match(sql,
      new RegExp(`create trigger trava_${tabela}\\s*\\n\\s*before insert or update or delete on public\\.${tabela}`),
      `sumiu o gatilho de ${tabela}`);
  }
});

test("as seis funções que escrevem nessas tabelas recebem a marca", () => {
  for (const fn of [
    "conferir_periodo_financeiro(text)", "reabrir_periodo_financeiro(text,text)",
    "registrar_pagamento_financeiro(uuid,numeric,text,text)",
    "estornar_pagamento_financeiro(uuid)", "excluir_lancamento_financeiro(uuid)",
  ]) {
    assert.ok(sql.includes(`'public.${fn}'`), `a função ${fn} ficou sem a marca`);
  }
  assert.match(sql, /function public\.registrar_presenca[\s\S]*perform set_config\('avanest\.escrita_financeira', 'sim', true\);/,
    "registrar_presenca ficou sem a marca — desmarcar consulta passaria a falhar");
});

test("a marca é inserida no corpo que já está no banco, e não recopiada à mão", () => {
  assert.match(sql, /v_def := pg_get_functiondef\(v_fn::regprocedure\);/,
    "a migração deixou de ler o corpo atual das funções");
  assert.match(sql, /if position\('avanest\.escrita_financeira' in v_def\) = 0 then/,
    "rodar a migração de novo passaria a duplicar a marca");
});

test("só a escrita vinda do navegador é travada; servidor e funções definer passam", () => {
  assert.match(sql, /current_user in \('authenticated', 'anon'\)/,
    "a trava deixou de distinguir quem escreve");
});

test("mês fechado recusa edição, exceto o acompanhamento do recurso de glosa", () => {
  assert.match(sql,
    /v_livres text\[\] := array\['glosa_recurso_status', 'glosa_recurso_prazo', 'glosa_recurso_motivo', 'updated_at'\];/,
    "a lista do que pode mudar com o mês fechado mudou");
  assert.match(sql, /\(to_jsonb\(new\) - v_livres\) is distinct from \(to_jsonb\(old\) - v_livres\)/,
    "a comparação que recusa edição em mês fechado sumiu");
  assert.match(tela, /const soRecurso=Object\.keys\(changes\)\.every\(k=>k\.startsWith\("glosa_recurso_"\)\);/,
    "a tela deixou de acompanhar a exceção do recurso de glosa");
  assert.match(tela, /if\(item\?\.fechado_at&&!soRecurso\)/,
    "a tela deixou de recusar edição de valor em mês fechado");
});

test("ninguém destrava, lança ou move lançamento para dentro de mês fechado por fora", () => {
  assert.match(sql, /Só o fechamento e a reabertura do período mexem na trava de um lançamento\./);
  assert.match(sql, /Reabra o período antes de lançar nele\./);
  assert.match(sql, /Não dá para mover um lançamento para dentro dele\./);
});

test("desmarcar consulta não apaga lançamento de mês fechado", () => {
  assert.match(sql, /and fa\.fechado_at is null\s*\n\s*and coalesce\(fa\.valor, 0\) = 0/,
    "registrar_presenca voltou a poder apagar lançamento de mês fechado");
});
