import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("os filtros do histórico são flexíveis, e não uma grade de colunas fixas", () => {
  // Eram quatro colunas para cinco campos: o "Até" caía sozinho na linha de
  // baixo, esticado pela largura da busca. E o número de campos não é fixo —
  // o filtro de local só existe em quem tem mais de um local —, então colunas
  // fixas não dão conta.
  const css = ler("app/globals.css");
  const regra = css.match(/\.historyFilters\{([^}]*)\}/);
  assert.ok(regra, "sumiu a regra dos filtros");
  assert.match(regra![1], /display:flex/, "voltou a ser grade de colunas fixas");
  assert.ok(!/grid-template-columns/.test(regra![1]));
});

test("todos os cinco filtros têm rótulo", () => {
  // Antes, busca, situação e local vinham nus e as duas datas com rótulo em
  // cima: alturas diferentes, linha desalinhada. E dois `dd/mm/aaaa` iguais sem
  // rótulo não dizem qual é o começo e qual é o fim.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const bloco = tela.match(/<div className="historyFilters">([^]*?)<\/div>/);
  assert.ok(bloco, "não achei o bloco de filtros");
  const rotulos = [...bloco![1].matchAll(/<label[^>]*>([A-ZÀ-Ú][^<{]*)/g)].map((m) => m[1].trim());
  assert.deepEqual(rotulos, ["Buscar", "Situação", "Local", "De", "Até"]);
});

/**
 * A LARGURA MÍNIMA DA DATA É MEDIDA, e este teste existe porque o defeito é
 * invisível para as ferramentas de sempre.
 *
 * Um `<input type="date">` estreito demais corta "dd/mm/aaaa" em silêncio — e
 * `scrollWidth`, que denuncia corte em qualquer campo de texto, MENTE aqui:
 * numa caixa de 90px ele devolve scrollWidth 86 e clientWidth 86, dizendo que
 * cabe, com o texto visivelmente cortado na tela. Foi preciso medir a largura
 * natural do campo no navegador: 126px com a fonte deste sistema.
 *
 * Os 130px de mínimo deixam as duas datas dividirem a linha enquanto couberem e
 * quebrarem sozinhas quando não couberem — sem adivinhar em que largura de
 * aparelho isso acontece.
 */
test("o campo de data nunca fica abaixo dos 126px medidos", () => {
  const css = ler("app/globals.css");
  const regras = [...css.matchAll(
    /\.historyFilters label:has\(input\[type=date\]\)\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(regras.length > 0, "sumiu a regra das datas");
  for (const regra of regras) {
    const fixa = regra.match(/flex:[^;]*?(\d+)px/);
    const minimo = regra.match(/min-width:(\d+)px/);
    if (fixa && !/calc|%/.test(regra)) {
      // Base fixa em pixels: ela já é o piso.
      assert.ok(Number(fixa[1]) >= 126, `base de ${fixa[1]}px corta a data`);
      continue;
    }
    // Base em porcentagem pode encolher até sumir. Aí o piso tem de ser dito.
    assert.ok(minimo, `a regra "${regra.trim()}" deixa a data encolher sem piso`);
    assert.ok(Number(minimo[1]) >= 126,
      `${minimo[1]}px é menos que os 126px medidos: o texto da data corta`);
  }
});
