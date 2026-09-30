import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A ESCALA — as ligações que só existem na tela e no banco.
 *
 * As contas (plantões × turnos × horas, situações, pendências, filtros e
 * semana) são testadas em escala-painel.test.ts. Aqui fica preso quem usa o
 * quê, para o "18 × 14" não voltar.
 */
const ler = (c: string) => readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const tela = ler("components/plantoes.tsx");
const sql = ler("supabase/migrations/202609300015_valor_informado_do_plantao.sql");
const css = ler("app/globals.css");

test("resumo e lista saem do MESMO conjunto filtrado", () => {
  assert.match(tela, /const visiveis = filtrarEscala\(doPeriodo, filtrosEfetivos, agora, perfilId\);/);
  assert.match(tela, /const contagemVisivel = contagem\(visiveis\);/);
  assert.match(tela, /rotulo: "Turnos de 12h"/);
  assert.doesNotMatch(tela, /rotulo: "Plantões no mês"/, "voltou o cartão que chamava turnos de plantões");
  assert.match(tela, /\{contagemEscrita\(contagemVisivel\)\}/);
  assert.doesNotMatch(tela, /plantão\{[^}]*"es"/, "voltou o plural que escrevia \"plantãoes\"");
});

test("a grade do grupo e a do mês usam o conjunto filtrado", () => {
  assert.match(tela, /const turnosDoDia = \(dia: string\) => \{\n\s+const doDia = visiveis\.filter/);
  assert.match(tela, /const doDia = visiveis\.filter\(\(p\) => p\.data === dia\);/);
});

test("confirmação, execução e pagamento em selos separados", () => {
  for (const d of ["Confirmação", "Execução", "Pagamento"]) assert.match(tela, new RegExp(`dimensao="${d}"`));
  assert.doesNotMatch(tela, />\s*RECEBIDO\s*</, "voltou o chip único de recebido");
  assert.match(tela, /\{meu && <SeloDeSituacao s=\{situacaoDoPagamento\(p\)\}/, "pagamento do colega não pode aparecer");
});

test("valor: vazio não grava; gravar marca informado; repetir não atropela zero informado", () => {
  assert.match(tela, /if \(!texto\) return;/);
  assert.match(tela, /atualizar\(p\.id, \{ valor: v, valor_informado: true \}\)/);
  assert.match(tela, /\.eq\("valor", 0\)\.eq\("valor_informado", false\)/);
  assert.match(ler("lib/valor-do-hospital.ts"), /p\.valor_informado !== true/);
});

test("banco: valor informado mantido por gatilho, antigos positivos marcados, zeros antigos não", () => {
  assert.match(sql, /add column if not exists valor_informado boolean not null default false/);
  assert.match(sql, /update public\.plantoes set valor_informado = true where valor <> 0/);
  assert.match(sql, /elsif new\.valor is distinct from old\.valor then\s+new\.valor_informado := true;/);
});

test("Colorida/P&B e a dica da orientação moram no passo de imprimir", () => {
  assert.match(tela, /<Dialogo titulo="Imprimir a escala"/);
  const dialogo = tela.slice(tela.indexOf('<Dialogo titulo="Imprimir a escala"'));
  assert.match(dialogo.slice(0, 3000), /guardarModoDaFolha\(false\)/);
  assert.match(dialogo.slice(0, 3000), /troque para <strong>Horizontal<\/strong>/);
  assert.doesNotMatch(tela, /className="folhaModo"/, "o seletor voltou para a barra");
});

test("Hoje, Mês/Semana/Lista, lista no celular, e a semana busca o mês vizinho à parte", () => {
  assert.match(tela, /\[\["mes", "Mês"\], \["semana", "Semana"\], \["lista", "Lista"\]\]/);
  assert.match(tela, /visaoEscolhida \?\? \(celular \? "lista" : "mes"\)/);
  assert.match(tela, /onClick=\{irParaHoje\}>Hoje<\/button>/);
  assert.match(tela, /setForaDoMes\(/);
  assert.match(css, /\.escalaSelos\{grid-column:1\/-1/);
});

test("impressão, .ics e fechamento continuam sendo do mês inteiro", () => {
  assert.match(tela, /montarICS\(daEscala\.map/);
  assert.match(tela, /plantoes: daEscala\.map\(\(p\) => \(\{\n\s+data: p\.data/);
});
