import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * O QUE O PRINT DA VISÃO GERAL MOSTROU, EM PRODUÇÃO.
 *
 * 1) "PARTICULAR" e "Particular" em duas barras no gráfico por convênio — a
 *    Produção do dia aceita o convênio digitado à mão, e o agrupamento era
 *    pelo texto cru. A chave normalizada mora em lib/financeiro-indicadores
 *    (chaveDoPagador), testada lá; aqui se prende que o gráfico usa ela.
 * 2) "O mês ainda não foi fechado" comparava com o estado "conferido", que a
 *    conferência deixou de gravar em 202609300002 — o aviso não apagaria
 *    nunca, nem com o mês fechado.
 * 3) O cartão-manchete tinha um número e um cartão inteiro vazio ao lado.
 * 4) A auditoria mostrava fechar e reabrir período como "financeiro_periodo",
 *    sem a competência e sem o motivo da reabertura.
 */
const ler = (caminho: string) =>
  readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const tela = ler("app/dashboard/dashboard-client.tsx");
const grafico = ler("components/graficos-financeiro.tsx");
const css = ler("app/globals.css");

test("o gráfico por convênio agrupa pela chave normalizada, não pelo texto cru", () => {
  assert.match(grafico, /const chave = chaveDoPagador\(r\.pagador\);/,
    "o gráfico voltou a agrupar pelo texto do pagador");
  assert.match(grafico, /rotulosDePagador\(doMes\.map\(\(r\) => r\.pagador\)\)/,
    "o gráfico deixou de escolher uma grafia só para cada pagador");
  assert.doesNotMatch(grafico, /const nome = r\.pagador \|\| "Particular";/,
    "voltou o agrupamento pelo nome cru");
});

test("o aviso de fechamento pendente olha para 'fechado', o estado que a conferência grava", () => {
  assert.match(tela, /fechamentoPendente=\{Boolean\(receitaTotal\.valor>0&&periodState\?\.status!=="fechado"\)\}/,
    "o aviso de mês não fechado voltou a comparar com outro estado");
  assert.doesNotMatch(tela, /periodState\?\.status!=="conferido"/,
    "ainda há comparação com o estado 'conferido', que não é mais gravado");
});

test("o cartão-manchete tem o medidor, com a largura pela fração exata", () => {
  assert.match(grafico, /className="grafMedidorTrilha"/, "sumiu o medidor do cartão-manchete");
  assert.match(grafico, /Math\.min\(100, \(dados\.recebido \/ dados\.faturado\) \* 100\)/,
    "o medidor deixou de usar a fração exata (ou de limitar a 100%)");
  assert.match(grafico, /ainda a receber/, "sumiu a linha do que falta receber");
});

test("marcas seguem a especificação: ponta de 4px, coluna de no máximo 24px, sem brilho", () => {
  assert.match(css, /\.grafBarra\{height:14px;border-radius:0 4px 4px 0;/, "a ponta da barra mudou");
  assert.match(css, /\.grafColuna\{width:46%;max-width:24px;border-radius:4px 4px 0 0;/,
    "a coluna mudou de largura máxima ou de raio");
  const i = css.indexOf(".grafBarra{");
  const j = css.indexOf(".grafColuna{");
  assert.doesNotMatch(css.slice(i, i + 200), /inset/, "o brilho interno voltou na barra");
  assert.doesNotMatch(css.slice(j, j + 200), /inset/, "o brilho interno voltou na coluna");
});

test("a navegação do Financeiro rola por dentro quando não cabe na tela", () => {
  assert.match(css, /max-height:calc\(100vh - 36px\);overflow-y:auto;/,
    "a coluna de navegação voltou a poder ficar maior que a tela");
});

test("a auditoria nomeia fechar e reabrir período, com a competência e o motivo", () => {
  assert.match(tela, /periodo_fechado:"Período fechado"/, "sumiu o rótulo de período fechado");
  assert.match(tela, /periodo_reaberto:"Período reaberto"/, "sumiu o rótulo de período reaberto");
  assert.match(tela, /detalhes\.motivo\?` — motivo: \$\{detalhes\.motivo\}`/,
    "a auditoria deixou de mostrar o motivo da reabertura");
});
