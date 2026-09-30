import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * O RESUMO DO FINANCEIRO COMO PAINEL DE GESTÃO — as decisões de tela.
 *
 * As contas estão em lib/painel-financeiro.ts e são testadas de verdade em
 * painel-financeiro.test.ts. Aqui ficam presas as decisões que só existem na
 * tela e que uma edição distraída desfaria sem nenhum teste de conta falhar.
 */
const ler = (caminho: string) => readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const tela = ler("app/dashboard/dashboard-client.tsx");
const painel = ler("components/painel-financeiro.tsx");
const css = ler("app/globals.css");

test("os quatro números, nesta ordem: Recebido, A receber, Vencido, Faturado", () => {
  const ordem = [...tela.matchAll(/\{tipo:"(recebido|aReceber|vencido|faturado)",rotulo:/g)].map((m) => m[1]);
  assert.deepEqual(ordem, ["recebido", "aReceber", "vencido", "faturado"]);
});

test("A receber e Vencido dizem que são de todos os meses; Vencido não promete 'nenhum atraso'", () => {
  assert.match(tela, /· todos os meses`/, "o A receber deixou de dizer que olha todos os meses");
  assert.match(tela, /"Nenhuma nota vencida"/,
    "o vencido só conta vencimento declarado — 'nenhum atraso' seria mais do que ele sabe");
});

test("Faturado e Situação dos atendimentos contam do mesmo jeito", () => {
  // "20 atendimentos" num e "8 faturados" no outro era a mesma tela se contradizendo.
  assert.match(tela, /const situacaoDoMes=situacaoDosAtendimentos\(receitasDoMes,aguardandoNoMes\);/);
  assert.match(tela, /plural\(situacaoDoMes\.faturados,"atendimento","atendimentos"\)/);
  assert.match(tela, /aguardandoLancamento=\{aguardandoNoMes\}/);
});

test("todo número clicável abre a composição calculada pela lib", () => {
  assert.match(tela, /<IndicadoresPrincipais indicadores=\{indicadores\} valor=\{valorVisivel\} onAbrir=\{setComposicaoAberta\}\/>/);
  assert.match(tela, /composicaoAberta\?composicao\(composicaoAberta,receitas,period,hojeIso\):null/);
});

test("todo valor do painel passa pelo olho de esconder números", () => {
  assert.match(tela, /const valorVisivel=\(n:number\)=>mascara\(money\(n\)\);/);
  // Nenhum toLocaleString de dinheiro direto nos componentes do painel.
  assert.doesNotMatch(painel, /currency: "BRL"/, "o painel voltou a formatar dinheiro por fora do olho");
});

test("o cabeçalho diz o escopo verdadeiro — todos os hospitais", () => {
  // O Financeiro soma a organização inteira; escrever o hospital do local
  // ativo poria um rótulo de hospital em números que não são dele.
  assert.match(painel, /<small>Hospitais<\/small><b>Todos<\/b>/);
});

test("a gaveta não usa <footer>: a regra global de footer é o rodapé preto do site", () => {
  assert.doesNotMatch(painel, /^\s*<footer/m);
  assert.match(css, /\.pfGavetaRodape\{/);
});

test("Atenção hoje não tem botão genérico", () => {
  assert.doesNotMatch(painel, />Ver<\/button>/);
  assert.match(painel, /onClick=\{\(\) => onIr\(p\.tarefa, p\.periodo\)\}>\{p\.acao\}<\/button>/);
});

test("grupos do menu recolhem, mas a aba aberta nunca some", () => {
  assert.match(tela, /const escondido=gruposRecolhidos\.has\(grupo\)&&tarefa!==id;/);
  assert.match(tela, /aria-expanded=\{aberto\} onClick=\{\(\)=>alternarGrupo\(rotulo\)\}/);
  assert.match(css, /\.financeTarefas button\.recolhido\{display:none\}/);
});

test("responsividade: 4 números no desktop, 2 no tablet, 1 no celular", () => {
  assert.match(css, /\.pfKpis\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:1050px\)\{\n  \.pfKpis\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css, /@media\(max-width:600px\)\{\n  \.pfKpis\{grid-template-columns:1fr\}/);
});
