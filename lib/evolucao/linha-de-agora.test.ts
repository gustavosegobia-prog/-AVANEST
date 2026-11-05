import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (c: string) => readFileSync(new URL(`../../${c}`, import.meta.url), "utf8");

test("a linha de agora passa por baixo dos números da coluna de agora (05/11/2026)", () => {
  // Desenhada por último, ela cortava ao meio o valor pronto da SpO₂ e da temperatura: "1|00" lido como "1000".
  const grafico = ler("components/evolucao/grafico-sinais.tsx");
  const linha = grafico.indexOf('<line className="evoAgora"');
  const pronta = grafico.indexOf('className={`evoLinhaPronta');
  const valores = grafico.indexOf('className={`evoValorLinha');
  assert.ok(linha > 0 && pronta > 0 && valores > 0, "sumiu um dos elementos do gráfico");
  assert.ok(linha < pronta && linha < valores, "a linha de agora voltou a ser desenhada por cima dos números");
  assert.equal(grafico.split('<line className="evoAgora"').length - 1, 1, "uma linha de agora só");
  // O contorno do pronto é opaco, e o número lançado tem contorno da cor do fundo: a linha some atrás deles.
  const css = ler("app/globals.css");
  assert.match(css, /\.evoLinhaProntaAlvo\{fill:color-mix\(in srgb,var\(--cor-marca\) 7%,var\(--cor-superficie\)\)/);
  assert.doesNotMatch(css, /\.evoLinhaProntaAlvo\{[^}]*fill-opacity/);
  assert.match(css, /\.evoValorLinha\{[^}]*paint-order:stroke;stroke:var\(--cor-superficie\)/);
});
