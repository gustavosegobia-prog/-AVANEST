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

const lib = ler("lib/painel-financeiro.ts");
const painel = ler("components/painel-financeiro.tsx");

test("o gráfico por convênio agrupa pela chave normalizada, não pelo texto cru", () => {
  // A conta saiu do componente para lib/painel-financeiro.ts:recebimentosPorConvenio
  // (testada em painel-financeiro.test.ts); o gráfico só a desenha.
  assert.match(grafico, /recebimentosPorConvenio\(receitasDoMes\)/,
    "o gráfico deixou de usar a conta por pagador da lib");
  const i = lib.indexOf("export function recebimentosPorConvenio(");
  const conta = lib.slice(i, lib.indexOf("\n}\n", i));
  assert.match(conta, /const chave = chaveDoPagador\(r\.pagador\);/,
    "o gráfico voltou a agrupar pelo texto do pagador");
  assert.match(conta, /rotulosDePagador\(receitasDoMes\.map\(\(r\) => r\.pagador\)\)/,
    "o gráfico deixou de escolher uma grafia só para cada pagador");
  assert.doesNotMatch(grafico, /const nome = r\.pagador \|\| "Particular";/,
    "voltou o agrupamento pelo nome cru");
});

test("o fechamento olha para 'fechado', o estado que a conferência grava — e mês correndo não é pendência", () => {
  assert.match(tela, /const estadoFechamento=estadoDoFechamento\(period,hojeIso,periodState\?\.status,receitasDoMes\.length>0\);/,
    "o estado do fechamento deixou de vir de estadoDoFechamento");
  assert.match(lib, /if \(status === "fechado"\) return \{ tipo: "fechado" \};/,
    "o fechamento voltou a comparar com outro estado");
  assert.doesNotMatch(tela, /periodState\?\.status!=="conferido"/,
    "ainda há comparação com o estado 'conferido', que não é mais gravado");
});

test("o recebimento da competência tem o medidor, com a largura pela fração exata", () => {
  assert.match(painel, /className="pfMedidor"/, "sumiu o medidor do recebimento");
  assert.match(painel, /const fracao = faturado > 0 \? Math\.min\(1, recebido \/ faturado\) : 0;/,
    "o medidor deixou de usar a fração exata (ou de limitar a 100%)");
  assert.match(painel, /`\$\{valor\(falta\)\} pendente`/, "sumiu a linha do que falta receber");
  assert.match(painel, /"Nada pendente"/, "sumiu o 'Nada pendente'");
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
  // Os rótulos e a descrição saíram da tela para lib/auditoria.ts, usados
  // pelo histórico de atividades e pelo histórico de cada pessoa.
  const aud = ler("lib/auditoria.ts");
  assert.match(aud, /periodo_fechado: "Período fechado"/, "sumiu o rótulo de período fechado");
  assert.match(aud, /periodo_reaberto: "Período reaberto"/, "sumiu o rótulo de período reaberto");
  assert.match(aud, /return `competência \$\{periodo\}\$\{texto\(d\.motivo\) \? ` — motivo: \$\{texto\(d\.motivo\)\}` : ""\}`;/,
    "a linha deixou de mostrar a competência e o motivo da reabertura");
});
