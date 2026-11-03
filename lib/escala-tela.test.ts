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
  assert.match(tela, /rotulo: contagemVisivel\.plantoes === 1 \? "Plantão de 12h" : "Plantões de 12h"/);
  assert.doesNotMatch(tela, /"Turnos de 12h"/, "plantão é 12h: não existe outra unidade chamada turno no resumo");
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

test("valor e execução se mudam no painel do dia; a lista do mês só lê, abre fechada e imprime (03/11/2026)", async () => {
  // O painel do dia: campo de valor e seletor de execução, só no SEU plantão.
  const painel = tela.slice(tela.indexOf("function DiaDetalhe("));
  assert.match(painel, /\{p\.perfil_id === perfilId && \(\s*<span className="plantaoDiaCampos">/);
  assert.match(painel, /<CampoDoValor p=\{p\} onGravar=\{\(texto\) => onValor\(p, texto\)\} \/>/);
  assert.match(painel, /<SeletorDaExecucao p=\{p\} ehAdmin=\{ehAdmin\}/);
  assert.match(tela, /onValor=\{gravarValor\} onExecucao=\{mudarExecucao\}/);
  // A lista: sem campo, sem seletor, sem gaveta de apagar; um botão para abrir o dia.
  const lista = tela.slice(tela.indexOf('<div className="plantaoLinha escalaLinha escalaLinhaLeitura"'),
    tela.indexOf("</PainelRecolhivel>", tela.indexOf("escalaLinhaLeitura")));
  assert.ok(lista.length > 200, "sumiu a linha do relatório");
  assert.doesNotMatch(lista, /<input|<select|onBlur|LinhaComGaveta/);
  assert.match(lista, /onClick=\{\(\) => setDiaAberto\(p\.data\)\}/);
  assert.doesNotMatch(tela, /function LinhaComGaveta/);
  // Fechada ao entrar, com chave nova (a escolha antiga de "aberta" não vale), e com o botão de imprimir.
  assert.match(tela, /chave=\{`escala-relatorio-\$\{escopo\}`\}\n\s+abrePadrao=\{false\}/);
  assert.match(tela, /onClick=\{imprimirRelatorio\}>Imprimir lista<\/button>/);
  // A oferta de repetir o valor aparece no painel do dia quando nasceu nele.
  assert.match(tela, /repetir=\{ofertaNoDiaAberto \? ofertaDeRepetir : null\}/);
  assert.match(tela, /\{ofertaValida && !ofertaNoDiaAberto && ofertaDeRepetir\}/);

  // A folha: o valor e o pagamento do colega não saem; o total soma só os seus informados.
  const { folhaDoRelatorioDaEscala } = await import("./escala.ts");
  const base = { horario: "07h–19h · 12h", horas: 12, execucao: "Escalado", confirmacao: "Aguardando o dia" };
  const { corpo } = folhaDoRelatorioDaEscala("Escala da equipe — NOVEMBRO de 2026", [
    { ...base, dia: "seg 02/11", quem: "Ana", onde: "Hospital A", valor: 1200, valorAusente: false, pagamento: "A receber" },
    { ...base, dia: "ter 03/11", quem: "Bruno", onde: "Hospital A", valor: null, valorAusente: false, pagamento: null },
    { ...base, dia: "qua 04/11", quem: "Ana", onde: "Hospital B", valor: 0, valorAusente: true, pagamento: "Valor não preenchido" },
  ], new Date("2026-11-03T12:00:00Z"));
  assert.match(corpo, /<th>Quem<\/th>/);
  assert.match(corpo, /R\$\s1\.200,00/);
  assert.match(corpo, /<td class="num">—<\/td>/, "o valor do colega sai como travessão");
  assert.match(corpo, /não preenchido/);
  assert.match(corpo, /Seus valores informados<\/td><td class="num">R\$\s1\.200,00/);
  assert.doesNotMatch(corpo, /Bruno<\/td><td>Hospital A<\/td><td class="num">R\$/);
});
