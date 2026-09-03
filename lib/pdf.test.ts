import test from "node:test";
import assert from "node:assert/strict";
import {
  Pagina, byteDoCaractere, corDeHex, cortarTexto, escaparPdf,
  larguraDoTexto, montarPdf, textoUtf16,
} from "./pdf.ts";

test("a largura sai das métricas oficiais da Helvetica", () => {
  // "AVANEST" em 10pt: 667+667+667+722+667+667+611 = 4668 milésimos.
  assert.equal(larguraDoTexto("AVANEST", 10), 46.68);
  // O negrito é MAIS largo, e não a mesma medida com traço grosso: escrever a
  // pastilha com a conta do normal a deixaria estourando pela direita.
  assert.ok(larguraDoTexto("Matheus", 8, true) > larguraDoTexto("Matheus", 8));
});

test("o acento não alarga a letra", () => {
  // Na Helvetica o "á" ocupa o mesmo que o "a". Se a tabela não soubesse disso,
  // todo nome com acento seria medido errado.
  assert.equal(larguraDoTexto("ao", 10), larguraDoTexto("ão", 10));
  assert.equal(larguraDoTexto("Sao", 10), larguraDoTexto("São", 10));
  assert.equal(larguraDoTexto("caca", 10), larguraDoTexto("caça", 10));
});

test("o travessão existe, e não vira interrogação", () => {
  // É ele que marca a faixa vazia em toda célula da escala. Sem o mapa da
  // pontuação do CP1252 sairia um losango no lugar.
  assert.equal(byteDoCaractere("—"), 151);
  assert.equal(byteDoCaractere("…"), 133);
  assert.equal(escaparPdf("—"), "\\227");
  assert.ok(larguraDoTexto("—", 10) > 0);
});

test("parêntese é escapado, porque sem isso o arquivo não abre", () => {
  // Um parêntese solto ENCERRA a string do PDF no meio e o resto vira lixo.
  // "Sedação (consultório)" é um local de plantão de verdade.
  const saida = escaparPdf("Sedação (consultório)");
  assert.ok(saida.includes("\\("));
  assert.ok(saida.includes("\\)"));
  assert.ok(!/[^\\]\(/.test(saida));
  assert.equal(escaparPdf("a\\b"), "a\\\\b");
});

test("caractere fora do WinAnsi sai como ? — e mede como ?", () => {
  assert.equal(escaparPdf("お"), "?");
  assert.equal(larguraDoTexto("お", 10), larguraDoTexto("?", 10));
});

test("cortarTexto só corta quando não cabe", () => {
  assert.equal(cortarTexto("Ana", 100, 8, true), "Ana");
  const cortado = cortarTexto("Maria Fernanda Albuquerque", 30, 8, true);
  assert.ok(cortado.endsWith("…"));
  assert.ok(larguraDoTexto(cortado, 8, true) <= 30);
});

test("corDeHex aceita as duas formas", () => {
  assert.deepEqual(corDeHex("#000000"), [0, 0, 0]);
  assert.deepEqual(corDeHex("#fff"), [1, 1, 1]);
});

test("o título vai em UTF-16 com marca de ordem de bytes", () => {
  // Em WinAnsi cada leitor adivinhava a codificação, e o travessão do título
  // saía como "Š" no Chrome.
  assert.equal(textoUtf16("A—"), "<FEFF00412014>");
});

/**
 * A ÁRVORE DE PÁGINAS, e por que existe um teste só para ela.
 *
 * A primeira versão tinha um "1 +" a mais nesta conta. O catálogo apontava
 * /Pages para a fonte Helvetica, o leitor não achava página nenhuma e abria uma
 * FOLHA EM BRANCO, EM PÉ — exatamente o defeito que este código veio consertar.
 * Passou por compilador e por tipo; só apareceu quando o PDF foi aberto.
 */
test("o catálogo aponta para a árvore de páginas de verdade", () => {
  const p = new Pagina(841.89, 595.28);
  p.texto(10, 10, "oi");
  const pdf = montarPdf([p], "Teste");

  const idDaRaiz = Number(pdf.match(/\/Root (\d+) 0 R/)![1]);
  const catalogo = pdf.match(new RegExp(`\\n${idDaRaiz} 0 obj\\n([^]*?)\\nendobj`))![1];
  assert.ok(catalogo.includes("/Type /Catalog"));

  const idDasPaginas = Number(catalogo.match(/\/Pages (\d+) 0 R/)![1]);
  const arvore = pdf.match(new RegExp(`\\n${idDasPaginas} 0 obj\\n([^]*?)\\nendobj`))![1];
  assert.ok(arvore.includes("/Type /Pages"), "o /Pages do catálogo tem de ser a árvore");
  assert.match(arvore, /\/Count 1/);

  const idDaPagina = Number(arvore.match(/\/Kids \[(\d+) 0 R/)![1]);
  const pagina = pdf.match(new RegExp(`\\n${idDaPagina} 0 obj\\n([^]*?)\\nendobj`))![1];
  assert.ok(pagina.includes("/Type /Page"));
  assert.equal(Number(pagina.match(/\/Parent (\d+) 0 R/)![1]), idDasPaginas,
    "a página tem de apontar de volta para a árvore");

  // E as fontes precisam ser as fontes, e não o catálogo ou a árvore.
  const idF1 = Number(pagina.match(/\/F1 (\d+) 0 R/)![1]);
  const idF2 = Number(pagina.match(/\/F2 (\d+) 0 R/)![1]);
  assert.match(pdf.match(new RegExp(`\\n${idF1} 0 obj\\n([^]*?)\\nendobj`))![1], /BaseFont \/Helvetica[ /]/);
  assert.match(pdf.match(new RegExp(`\\n${idF2} 0 obj\\n([^]*?)\\nendobj`))![1], /BaseFont \/Helvetica-Bold/);
});

test("a tabela xref aponta para o começo de cada objeto", () => {
  // A xref guarda POSIÇÃO EM BYTES. Um desencontro aqui e o leitor abre o
  // arquivo como corrompido — sem aviso nenhum de onde está o erro.
  const p = new Pagina(841.89, 595.28);
  p.retangulo(0, 0, 10, 10, [1, 0, 0]);
  const pdf = montarPdf([p], "Teste");
  // `lastIndexOf` acharia o "xref" de dentro de "startxref".
  const tabela = pdf.slice(pdf.indexOf("\nxref\n"));
  const posicoes = [...tabela.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  assert.ok(posicoes.length >= 6);
  posicoes.forEach((pos, i) => {
    assert.equal(pdf.slice(pos, pos + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`);
  });
  // E o startxref tem de cair na palavra "xref".
  const inicio = Number(pdf.match(/startxref\n(\d+)/)![1]);
  assert.equal(pdf.slice(inicio, inicio + 4), "xref");
});

test("o arquivo cabe num byte por caractere", () => {
  // A xref só vale se posição de caractere e posição de byte forem a mesma
  // coisa. Um caractere acima de 255 quebraria toda a tabela.
  const p = new Pagina(841.89, 595.28);
  p.texto(10, 10, "Sedação — Mourão", { negrito: true });
  const pdf = montarPdf([p], "Escala — setembro");
  for (const c of pdf) assert.ok(c.charCodeAt(0) <= 255, `byte largo: ${c}`);
});

test("o Y do desenho é o de cima, e o do PDF é o de baixo", () => {
  const p = new Pagina(800, 600);
  p.retangulo(10, 0, 100, 20, [0, 0, 0]);
  // Encostado no topo da folha: no PDF isso é y = 600 - 0 - 20 = 580.
  assert.match(p.conteudo, /10 580 100 20 re f/);
});

test("o alinhamento move o texto pela largura medida", () => {
  const p = new Pagina(800, 600);
  p.texto(400, 0, "AVANEST", { tamanho: 10, alinhamento: "centro" });
  const x = Number(p.conteudo.match(/Tf ([\d.]+) /)![1]);
  assert.ok(Math.abs(x - (400 - larguraDoTexto("AVANEST", 10) / 2)) < 0.01, `x = ${x}`);
});
