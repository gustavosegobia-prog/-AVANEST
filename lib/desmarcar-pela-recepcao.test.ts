import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * DESMARCAR PELA RECEPÇÃO NÃO LIMPAVA O LANÇAMENTO VAZIO.
 *
 * registrar_presenca roda com a permissão de quem chama, e a recepção não
 * enxerga financeiro_atendimentos: o DELETE não achava nada, a consulta
 * ficava cancelada e o lançamento de R$ 0 ficava para trás. Conferido no
 * banco numa transação desfeita, com o papel de recepção. A exclusão foi
 * para apagar_lancamento_vazio_ao_desmarcar (SECURITY DEFINER), com os
 * mesmos filtros de antes — nada que a regra antiga não apagaria.
 */
const sql = readFileSync(
  new URL("../supabase/migrations/202609300006_desmarcar_limpa_pela_recepcao.sql", import.meta.url), "utf8");

test("a limpeza roda com a permissão do sistema, só para agendamento desmarcado da própria organização", () => {
  const i = sql.indexOf("function public.apagar_lancamento_vazio_ao_desmarcar");
  const corpo = sql.slice(i, sql.indexOf("$$;", i));
  assert.match(corpo, /security definer/, "a limpeza voltou a depender da permissão de quem desmarca");
  assert.match(corpo, /and institution_id = public\.current_institution_id\(\);/,
    "a limpeza deixou de se limitar à organização de quem chama");
  assert.match(corpo, /v_ag\.status not in \('cancelado', 'reagendado'\)/,
    "a limpeza passou a valer para agendamento que não foi desmarcado");
});

test("os filtros continuam os mesmos: R$ 0, sem recebido, sem nota, sem pagamento, mês aberto", () => {
  for (const filtro of [
    "and fa.fechado_at is null", "and coalesce(fa.valor, 0) = 0", "and coalesce(fa.recebido, 0) = 0",
    "and fa.nota_fiscal is null", "select 1 from public.financeiro_pagamentos fp",
  ]) {
    assert.ok(sql.includes(filtro), `sumiu o filtro: ${filtro}`);
  }
});

test("registrar_presenca chama a limpeza e mantém a marca da trava e a auditoria", () => {
  const i = sql.indexOf("function public.registrar_presenca");
  const corpo = sql.slice(i);
  assert.match(corpo, /v_apagados := public\.apagar_lancamento_vazio_ao_desmarcar\(v_row\.id\);/);
  assert.match(corpo, /perform set_config\('avanest\.escrita_financeira', 'sim', true\);/);
  assert.match(corpo, /'lancamento_vazio_removido_ao_desmarcar'/);
  assert.doesNotMatch(corpo, /delete from public\.financeiro_atendimentos/,
    "registrar_presenca voltou a apagar direto, com a permissão de quem desmarca");
});

test("a função de limpeza não fica aberta para quem não está logado", () => {
  assert.match(sql, /revoke all on function public\.apagar_lancamento_vazio_ao_desmarcar\(uuid\) from public, anon;/);
});
