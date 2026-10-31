import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { faturamentoEmLista, folhaDeFaturamento } from "./escala.ts";
import { A4_EM_PE, listaEmPdf, quebrarTexto } from "./lista-pdf.ts";
import { escaparPdf, larguraDoTexto } from "./pdf.ts";

// A folha de faturamento saiu do iPhone sem estilo nenhum (30/10/2026), com as
// colunas coladas — "PARTICULARR$ 0,00". No iPhone ela passou a sair em PDF
// desenhado, como a escala. Estes testes travam o desenho e, principalmente,
// que o PDF e a folha do computador digam os mesmos números.

const item = (data: string, paciente: string, local: string, valor: number,
              pagador: string | null, convenio = "Particular", procedimento: string | null = null) =>
  ({ data, paciente, convenio, procedimento, valor, situacao: "a_cobrar", local, pagador });
const quando = new Date("2026-10-31T13:32:00");
const paginas = (pdf: string) => [...pdf.matchAll(/\/Type \/Page\b(?!s)/g)].length;
/** O texto como ele fica escrito dentro do PDF (acentos em octal). */
const noPdf = (t: string) => escaparPdf(t);

test("o texto quebra nas palavras, e cada linha cabe na coluna", () => {
  const largura = 90;
  const linhas = quebrarTexto("Fixador externo no membro inferior direito", largura, 8.5);
  assert.ok(linhas.length > 1);
  assert.equal(linhas.join(" "), "Fixador externo no membro inferior direito", "nenhuma palavra some");
  for (const l of linhas) assert.ok(larguraDoTexto(l, 8.5) <= largura, l);
});

test("palavra que sozinha não cabe é partida com hífen, sem esconder letra", () => {
  const linhas = quebrarTexto("APENDICECTOMIAVIDEOLAPAROSCOPICA", 50, 8.5);
  assert.ok(linhas.length > 1);
  assert.equal(linhas.map((l) => l.replace(/-$/, "")).join(""), "APENDICECTOMIAVIDEOLAPAROSCOPICA");
  for (const l of linhas) assert.ok(larguraDoTexto(l, 8.5) <= 50, l);
});

test("o PDF do faturamento tem os mesmos blocos e totais da folha do computador", () => {
  const itens = [
    item("2026-09-12", "Ana", "Hospital A", 1500, "direto", "PARTICULAR", "Hérnia VLP"),
    item("2026-09-05", "Bia", "Hospital A", 0, "direto"),
    item("2026-09-03", "Caio", "Hospital A", 0, "hospital", "UNIMED", "Apendicectomia"),
    item("2026-09-20", "Dora", "Hospital A", 400, null),
    item("2026-09-01", "Eva", "", 300, "convenio", "Unimed"),
  ];
  const lista = faturamentoEmLista(itens, "setembro", 2026, quando);
  const { titulo, corpo } = folhaDeFaturamento(itens, "setembro", 2026, quando);
  assert.equal(lista.titulo, titulo);

  const secoes = lista.blocos.filter((b) => b.tipo === "secao").map((b) => b.texto);
  assert.deepEqual(secoes, ["Hospital A", "Sem hospital"]);
  const subsecoes = lista.blocos.filter((b) => b.tipo === "subsecao").map((b) => b.texto);
  assert.deepEqual(subsecoes, ["Pago pelo paciente", "Pago pelo hospital",
    "Sem pagador definido — decida antes de emitir", "Pago pelo convênio"]);

  // Cada total do PDF aparece na folha do computador, com o mesmo rótulo.
  const totais = lista.blocos.flatMap((b) => (b.tipo === "tabela" && b.total ? [b.total] : []));
  assert.deepEqual(totais.map((t) => t.rotulo),
    ["Total a faturar", "Total a faturar", "Total sem pagador definido", "Total a faturar"]);
  for (const t of totais) assert.ok(corpo.includes(`${t.rotulo}</td><td class="num">${t.valores[0]}`), t.rotulo);

  // O que não tem pagador é avisado no topo e nunca somado a um bloco decidido.
  assert.equal(lista.blocos[0].tipo, "aviso");
  assert.equal(totais[2].pendente, true);
  assert.match(lista.rodape ?? "", /^5 pacientes · R\$\s2\.200,00$/);

  // As linhas saem em ordem de data dentro do bloco, como na folha.
  const primeira = lista.blocos.find((b) => b.tipo === "tabela");
  assert.ok(primeira && primeira.tipo === "tabela");
  assert.deepEqual(primeira.linhas.map((l) => l[0]), ["5/09", "12/09"]);
  assert.equal(primeira.colunas.reduce((s, c) => s + c.largura, 0).toFixed(6), "1.000000");
});

test("um mês longo vira várias páginas, com cabeçalho e número em cada uma", () => {
  const itens = Array.from({ length: 70 }, (_, k) =>
    item(`2026-09-${String(1 + (k % 28)).padStart(2, "0")}`, `Paciente ${k + 1} da Silva Exemplo`,
      "Clínica Modelo", 350, "convenio", "Unimed", "Artroplastia total de quadril esquerdo com revisão"));
  const pdf = listaEmPdf(faturamentoEmLista(itens, "setembro", 2026, quando));
  const n = paginas(pdf);
  assert.ok(n >= 3, `${n} páginas`);
  for (let i = 1; i <= n; i++) assert.ok(pdf.includes(noPdf(`página ${i} de ${n}`)), `página ${i}`);
  // O cabeçalho da tabela se repete em toda página que a tabela ocupa.
  assert.equal([...pdf.matchAll(/\(PROCEDIMENTO\)/g)].length, n);
  // Em pé: A4 de 595 × 842 pontos.
  assert.match(pdf, new RegExp(`/MediaBox \\[0 0 ${A4_EM_PE.largura} ${A4_EM_PE.altura}\\]`));
  for (const c of pdf) assert.ok(c.charCodeAt(0) <= 255);
});

test("mês sem nada sai numa página que explica", () => {
  const pdf = listaEmPdf(faturamentoEmLista([], "setembro", 2026, quando));
  assert.equal(paginas(pdf), 1);
  assert.ok(pdf.includes(noPdf("Nada anotado neste mês.")));
});

test("no iPhone e no iPad o faturamento sai em PDF; no computador, como antes", () => {
  const tela = fs.readFileSync(new URL("../components/plantoes.tsx", import.meta.url), "utf8");
  const funcao = tela.slice(tela.indexOf("function imprimirFaturamento("), tela.indexOf("function imprimirFechamento("));
  assert.match(funcao, /if \(aparelhoDaApple\(\)\) \{[\s\S]*?entregarPdf\(`faturamento-\$\{mes\}\.pdf`, lista\.titulo, listaEmPdf\(lista\)\)[\s\S]*?return;/);
  assert.match(funcao, /imprimirFolha\(titulo, corpo, "portrait"\)/);
  // O iPad se diz Mac: o toque é o que o separa.
  assert.match(tela, /navigator\.platform === "MacIntel" && navigator\.maxTouchPoints > 1/);
});
