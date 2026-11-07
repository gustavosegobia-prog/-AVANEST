import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// O teste das impressões de 07/11/2026 ("testa todas as impressões"): cada
// documento foi gerado em PDF A4 numa prévia com dados fictícios, no build de
// produção, e conferido página a página. Quatro defeitos apareceram; estes
// testes guardam as correções. O desenho em si não roda aqui (precisa de um
// navegador) — o que se confere é a regra que o produz.

const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const semComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

test("impressão: o CSS do protocolo de crise não apaga as outras impressões", () => {
  // O React não tira o CSS de uma tela já aberta, e o painel de crises também
  // vem dentro da ficha anestésica. Com `body *` sozinho, a avaliação, a escala
  // ou o relatório impressos depois, sem recarregar, saíam em branco.
  const css = semComentarios(ler("components/intercorrencias/intercorrencias.module.css"));
  const impressao = css.slice(css.indexOf("@media print"));
  assert.doesNotMatch(impressao, /:global\(body \*\)/, "esconder tudo só quando há protocolo aberto");
  // E com o peso do `body *` antigo: com o :has() contando, a regra vencia o
  // `.impressao` e escondia o próprio protocolo.
  assert.match(impressao, /:global\(body\):where\(:has\(\.impressao\)\) \* \{ visibility: hidden; \}/);
  assert.match(impressao, /\.impressao, \.impressao \* \{ visibility: visible; \}/);
});

test("impressão: a avaliação não sai com uma folha em branco no fim", () => {
  const css = semComentarios(ler("app/globals.css"));
  // A folha de orientações saiu da impressão (display:none) e é o último filho:
  // a quebra DEPOIS de cada documento deixava o termo pedindo uma página a mais.
  assert.match(css, /\.guidancePaper\{display:none!important\}/);
  assert.doesNotMatch(css, /\.printPaper:last-child\{break-after:auto/);
  assert.doesNotMatch(css, /\.printPaper\{[^}]*break-after:page/);
  assert.match(css,
    /\.printPaper:not\(\.notSelected\):not\(\.guidancePaper\)~\.printPaper:not\(\.notSelected\):not\(\.guidancePaper\)\{break-before:page;page-break-before:always\}/);
});

test("impressão: a ficha anestésica longa continua numa folha só", () => {
  const codigo = ler("components/evolucao/registro-que-enche.tsx");
  // Lista de medicação longa: nem o gráfico no mínimo nem a letra compacta
  // bastavam, e o pé da folha ia sozinho para a página 2. A última conferência
  // diminui a folha inteira (zoom, largura compensada)…
  assert.match(codigo, /folha\.style\.zoom = String\(escala\);/);
  assert.match(codigo, /folha\.style\.width = `calc\(\$\{LARGURA_DA_FOLHA_MM\}mm \/ \$\{escala\}\)`;/);
  // …e só depois marca a folha como pronta: quem manda imprimir espera essa marca.
  const conferencia = codigo.slice(codigo.indexOf("folha.style.removeProperty(\"zoom\")"));
  assert.ok(conferencia.indexOf("folha.style.zoom") < conferencia.indexOf("data-ajustada"));
  assert.match(ler("app/globals.css"), /\.imprFolha\{box-sizing:content-box;width:196mm;/, "a largura que a conta compensa");
  // O PDF do iPhone desenha a folha sem o zoom: o desenhista colava as palavras.
  assert.match(ler("components/evolucao/pdf-da-ficha.ts"), /el\.style\.removeProperty\("zoom"\); el\.style\.removeProperty\("width"\);/);
});

test("impressão: a assinatura do AVANEST não cobre a última linha do relatório do centro", () => {
  const tela = ler("components/centro/relatorio.tsx");
  const tabelas = tela.match(/<table className=\{estilos\.lista\}>/g) ?? [];
  const vaos = tela.match(/<VaoDaAssinatura \/>/g) ?? [];
  assert.equal(vaos.length, tabelas.length, "toda lista que pode atravessar páginas guarda o pé de cada página");
  const css = ler("components/centro/relatorio.module.css");
  assert.match(css, /^\.vaoDaAssinatura \{ display: none; \}/m, "na tela, sem vão");
  const impressao = css.slice(css.indexOf("@media print"));
  assert.match(impressao, /\.vaoDaAssinatura \{ display: table-footer-group; \}/);
  assert.match(impressao, /\.vaoDaAssinatura td \{ height: 15mm;/);
});
