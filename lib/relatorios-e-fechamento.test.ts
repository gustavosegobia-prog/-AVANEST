import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * PRIORIDADE 4 DO PEDIDO ORIGINAL: RELATÓRIOS E PROJEÇÕES.
 *
 * Duas coisas que a aba "Relatórios e fechamento" não tinha:
 *
 * 1) "Cobranças em atraso" só tinha o gatilho genérico de 90 dias — igual
 * para um convênio que sempre paga em 15 dias e outro que sempre paga em 70.
 * "Fora do padrão de cada convênio" (lib/financeiro-indicadores.ts,
 * projecaoPorPrazoHistorico) compara o saldo em aberto contra o PRÓPRIO
 * histórico de pagamento do convênio, não um número fixo.
 *
 * 2) O fechamento do mês não tinha nada para levar à conferência com o
 * contador além da lista de lançamentos (exportCsv). exportarFechamento
 * gera um resumo com os indicadores que já existem espalhados pela tela —
 * faturado, recebido, despesas, resultado, margem, repasses — num arquivo só.
 */
const tela = readFileSync(
  new URL("../app/dashboard/dashboard-client.tsx", import.meta.url),
  "utf8",
);

test("o painel de projeção por prazo histórico está na aba Cobranças em atraso", () => {
  const i = tela.indexOf('chave="fin-projecao"');
  assert.notEqual(i, -1, "sumiu o painel de projeção por prazo histórico");
  const painel = tela.slice(i, i + 1600);
  assert.match(painel, /projecao\.map\(l=>/, "o painel deixou de percorrer a projeção calculada");
  assert.match(painel, /l\.prazoMedio===null\?"—"/, "sumiu o tratamento de convênio sem histórico");
});

test("projecao é calculada com a mesma base (recebiveis) do envelhecimento ao lado", () => {
  assert.match(
    tela,
    /const projecao=projecaoPorPrazoHistorico\(recebiveis,prazos,hojeIso\);/,
    "a projeção deixou de usar recebiveis/prazos/hojeIso — a mesma base que envelhecimento(recebiveis,hojeIso) já usa nesta tela",
  );
});

test("exportarFechamento existe e reúne os indicadores do mês, não a lista de lançamentos", () => {
  const i = tela.indexOf("function exportarFechamento");
  assert.notEqual(i, -1, "sumiu a função de exportar o relatório de fechamento");
  const corpo = tela.slice(i, i + 1600);
  for (const trecho of [
    "receitaTotal.valor", "receitaTotal.recebido", "receitaTotal.aReceber",
    "despesaTotal", "resultado.resultado", "resultado.margem",
  ]) {
    assert.ok(corpo.includes(trecho), `exportarFechamento parou de incluir ${trecho}`);
  }
  assert.match(corpo, /avanest-fechamento-\$\{period\}\.csv/,
    "o nome do arquivo baixado mudou de forma inesperada");
});

test("o botão de baixar relatório está no painel de Fechamento", () => {
  const i = tela.indexOf('chave="fin-fechamento"');
  const painel = tela.slice(i, i + 3000);
  assert.match(painel, /onClick=\{exportarFechamento\}/,
    "sumiu o botão que chama exportarFechamento no painel de Fechamento");
});

test("o painel de Fechamento mostra Despesas e Resultado do mês, não só receita", () => {
  const i = tela.indexOf('chave="fin-fechamento"');
  const painel = tela.slice(i, i + 3000);
  assert.match(painel, /label="Despesas do mês"/, "sumiu Despesas do mês no fechamento");
  assert.match(painel, /label="Resultado do mês"/, "sumiu Resultado do mês no fechamento");
});
