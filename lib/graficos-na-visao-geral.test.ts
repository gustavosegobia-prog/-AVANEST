import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * OS GRÁFICOS FICAVAM ATRÁS DE TRÊS CLIQUES.
 *
 * "Visão geral" virou a aba padrão do Financeiro nesta sessão, mas ela só
 * mostrava a fila de texto "Atenção hoje" — nenhum gráfico. Para ver
 * qualquer coisa visual era preciso abrir o grupo "Relatórios e fechamento"
 * e escolher "Gráficos", uma aba à parte. Quem abria o Financeiro pela
 * primeira vez no dia não via nenhum gráfico sem esse desvio.
 *
 * A correção: GraficosFinanceiro passa a renderizar também dentro de
 * tarefa==="visao-geral", logo abaixo da fila — mas só quando já existe
 * alguma configuração ou movimento, a mesma condição que VisaoGeral já usa
 * para decidir entre o convite de primeira vez e a fila. Sem essa guarda,
 * uma organização nova veria cinco cartões "sem dados nesta competência"
 * empilhados sob o convite de configurar valores — ruído, não gráfico.
 *
 * A aba "Gráficos" (tarefa==="graficos") continua existindo à parte, para
 * quem quer a visão cheia sem a fila de pendências ao lado.
 */
const tela = readFileSync(
  new URL("../app/dashboard/dashboard-client.tsx", import.meta.url),
  "utf8",
);

test("GraficosFinanceiro aparece dentro de Visão geral, não só na aba Gráficos", () => {
  const i = tela.indexOf('tarefa==="visao-geral"&&<>');
  assert.notEqual(i, -1, "sumiu o bloco de Visão geral");
  const fim = tela.indexOf('{tarefa==="lancamentos"', i);
  const bloco = tela.slice(i, fim > i ? fim : i + 2500);
  assert.match(bloco, /<VisaoGeral/, "VisaoGeral sumiu do bloco de visão geral");
  assert.match(
    bloco,
    /<GraficosFinanceiro receitas=\{receitas\} pagamentos=\{pagamentos\} periodo=\{period\}\/>/,
    "os gráficos não aparecem mais dentro de Visão geral",
  );
  // GraficosFinanceiro vem DEPOIS de VisaoGeral no bloco — a fila de
  // pendências é a primeira coisa lida, os gráficos vêm de contexto.
  assert.ok(bloco.indexOf("<VisaoGeral") < bloco.indexOf("<GraficosFinanceiro"),
    "os gráficos passaram a vir antes da fila de Atenção hoje");
});

test("os gráficos na Visão geral só aparecem com alguma configuração ou movimento", () => {
  const i = tela.indexOf('tarefa==="visao-geral"&&<>');
  const fim = tela.indexOf('{tarefa==="lancamentos"', i);
  const bloco = tela.slice(i, fim > i ? fim : i + 2500);
  assert.match(
    bloco,
    /\(convenioValores\.length>0\|\|financeiro\.length>0\|\|despesas\.length>0\|\|\(producaoDaReceita\?\.length\?\?0\)>0\)&&\s*\n\s*<GraficosFinanceiro/,
    "os gráficos deixaram de checar se há configuração ou movimento antes de aparecer",
  );
});

test("a aba Gráficos separada continua existindo", () => {
  assert.match(
    tela,
    /\{tarefa==="graficos"&&<GraficosFinanceiro receitas=\{receitas\} pagamentos=\{pagamentos\} periodo=\{period\}\/>\}/,
    "a aba Gráficos à parte sumiu",
  );
});
