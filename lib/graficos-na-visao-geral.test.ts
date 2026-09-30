import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * OS GRÁFICOS FICAVAM ATRÁS DE TRÊS CLIQUES — E DEPOIS FICARAM DUPLICADOS.
 *
 * "Visão geral" virou a aba padrão do Financeiro nesta sessão, mas ela só
 * mostrava a fila de texto "Atenção hoje" — nenhum gráfico. Para ver
 * qualquer coisa visual era preciso abrir o grupo "Relatórios e fechamento"
 * e escolher "Gráficos", uma aba à parte.
 *
 * A primeira correção pôs GraficosFinanceiro também dentro de
 * tarefa==="visao-geral" — mas manteve a aba "Gráficos" separada ao lado,
 * renderizando exatamente o mesmo componente, com os mesmos dados. Quem
 * abria o Financeiro via os gráficos duas vezes: uma na Visão geral, outra
 * clicando em "Gráficos" — a mesma tela, atrás de um clique a mais que não
 * mudava nada. A aba separada foi removida: GraficosFinanceiro renderiza só
 * dentro de Visão geral agora, logo abaixo da fila — mas só quando já existe
 * alguma configuração ou movimento, a mesma condição que VisaoGeral já usa
 * para decidir entre o convite de primeira vez e a fila. Sem essa guarda,
 * uma organização nova veria cinco cartões "sem dados nesta competência"
 * empilhados sob o convite de configurar valores — ruído, não gráfico.
 */
const tela = readFileSync(
  new URL("../app/dashboard/dashboard-client.tsx", import.meta.url),
  "utf8",
);

test("GraficosFinanceiro aparece dentro de Visão geral", () => {
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

test("GraficosFinanceiro renderiza uma única vez — sem a aba separada duplicando a mesma tela", () => {
  const ocorrencias = [...tela.matchAll(/<GraficosFinanceiro receitas=\{receitas\}/g)];
  assert.equal(ocorrencias.length, 1,
    "GraficosFinanceiro voltou a aparecer em mais de um lugar do Financeiro");
  assert.doesNotMatch(tela, /\["graficos","Gráficos"\]/,
    "a aba Gráficos separada voltou à navegação, e com ela a duplicação");
  assert.doesNotMatch(tela, /tarefa==="graficos"/,
    "ainda existe um bloco que só renderiza sob tarefa===\"graficos\"");
});
