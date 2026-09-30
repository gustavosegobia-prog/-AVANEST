import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * "CONFIRMAR CONFERÊNCIA" NUNCA FECHOU NADA — E O DEFEITO FICOU ESCONDIDO
 * PORQUE A TRAVA QUE ELE DEVERIA LIGAR EXISTIA DO OUTRO LADO, JÁ PRONTA.
 *
 * Três funções — registrar_pagamento_financeiro, estornar_pagamento_financeiro,
 * excluir_lancamento_financeiro — checam `fechado_at is not null` antes de
 * mexer num lançamento, desde a migração 202607230004. `conferir_periodo_
 * financeiro`, porém, só gravava `financeiro_periodos.status = 'conferido'`
 * — nunca tocava em `financeiro_atendimentos.fechado_at`. Resultado: a
 * proteção de mês fechado nunca disparou uma vez sequer, em nenhuma
 * organização, porque nada nunca chegou a fechar de verdade um período.
 *
 * Confirmado no banco antes de mexer em qualquer coisa: `grep "fechado_at\s*="`
 * em todas as migrações não achava UMA linha que escrevesse a coluna.
 */
const ler = (caminho: string) =>
  readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const sql = ler("supabase/migrations/202609300002_fechamento_de_verdade.sql");

test("conferir_periodo_financeiro passa a propagar o fechamento para cada lançamento", () => {
  // A LINHA QUE FALTAVA. Sem ela, `fechado_at` nunca sai de nulo, e as três
  // funções de guarda continuam protegendo um período que ninguém fechou.
  assert.match(sql,
    /update public\.financeiro_atendimentos\s*\n\s*set fechado_at = v_agora, fechado_by = auth\.uid\(\)/,
    "sumiu a propagação do fechamento para financeiro_atendimentos");
  // E o status pula direto para 'fechado' — não fica em 'conferido', que não
  // tinha uso distinto em lugar nenhum da tela.
  assert.match(sql, /status = 'fechado'/, "o status parou de ir direto para fechado");
});

test("reabrir_periodo_financeiro existe, exige motivo, e só admin/owner", () => {
  const i = sql.indexOf("function public.reabrir_periodo_financeiro");
  assert.notEqual(i, -1, "sumiu a função de reabertura");
  const corpo = sql.slice(i, i + 2200);
  // MOTIVO OBRIGATÓRIO. Reabrir sem dizer por quê transformaria "por que este
  // mês fechado mudou de novo" numa investigação meses depois.
  assert.match(corpo, /length\(trim\(p_motivo\)\) < 5/,
    "sumiu a exigência de motivo na reabertura");
  // SÓ ADMIN/OWNER — a régua sobe em relação a fechar, que 'financeiro'
  // também pode fazer.
  assert.match(corpo, /role in \('admin','owner'\)/,
    "a reabertura deixou de exigir admin/owner");
  // VOLTA PARA 'aberto', não 'conferido': o que mudar precisa de conferência
  // nova antes de fechar de novo.
  assert.match(corpo, /status = 'aberto'/,
    "a reabertura deixou de devolver o período para 'aberto'");
  // E LIMPA O LOCK DE CADA LANÇAMENTO — sem isso o período volta a aparecer
  // "aberto" na tela, mas os lançamentos continuam recusando edição.
  assert.match(corpo, /update public\.financeiro_atendimentos\s*\n\s*set fechado_at = null, fechado_by = null/,
    "a reabertura deixou de destravar os lançamentos do período");
});

test("as duas funções ficam fora do alcance de anon", () => {
  assert.match(sql, /revoke all on function public\.reabrir_periodo_financeiro\(text,text\) from public, anon;/,
    "reabrir_periodo_financeiro ficou aberta para anon");
});

test("a tela mostra FECHADO, não CONFERIDO, e o botão muda de nome com o estado", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf('chave="fin-fechamento"');
  const painel = tela.slice(i, i + 4300);
  assert.match(painel, /status==="fechado"\?"present":"waiting"/,
    "o selo do painel deixou de reconhecer o estado 'fechado'");
  assert.match(painel, /"FECHADO":"EM PREPARAÇÃO"/,
    "sumiu o texto FECHADO / EM PREPARAÇÃO do selo");
  assert.match(painel, /Reabrir período/, "sumiu o botão de reabrir no painel");
});

test("o formulário de reabertura trava o botão até o motivo ter pelo menos 5 caracteres", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  assert.match(tela, /motivoReabertura\.trim\(\)\.length<5/,
    "o botão de reabrir parou de travar sem motivo suficiente");
  // E só quem administra vê o botão — mesma checagem que já protege excluir
  // lançamento, reaproveitada de propósito: é a mesma régua de permissão.
  const i = tela.indexOf('chave="fin-fechamento"');
  const painel = tela.slice(i, i + 3500);
  assert.match(painel, /podeExcluirLancamento&&!reabrindo&&/,
    "o botão de reabrir deixou de ser restrito a quem administra");
});

test("reabrirPeriodo chama a função nova, com período e motivo", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf("async function reabrirPeriodo");
  assert.notEqual(i, -1, "sumiu a função reabrirPeriodo");
  const corpo = tela.slice(i, i + 500);
  assert.match(corpo, /rpc\("reabrir_periodo_financeiro",\{p_periodo:period,p_motivo:motivo\}\)/,
    "reabrirPeriodo deixou de chamar a RPC certa com os parâmetros certos");
});

test("confirmPeriod continua exigindo nota fiscal antes de fechar", () => {
  // A checagem já existia e não devia mudar com esta correção — ela é a
  // única pendência que a tela já sabia listar antes de fechar.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf("async function confirmPeriod");
  const corpo = tela.slice(i, i + 400);
  assert.match(corpo, /!item\.nota_fiscal&&item\.status!=="cancelado"/,
    "confirmPeriod deixou de exigir nota fiscal antes de fechar");
});
