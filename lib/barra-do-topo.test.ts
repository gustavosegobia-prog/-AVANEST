import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// A barra do topo (31/10/2026): o local ao lado da marca, numa faixa só, em
// vez de uma linha inteira embaixo — num monitor de 1366 a barra tinha 88 px.
// As faixas de largura foram medidas com cinco abas, sino e menu do usuário.

const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const bloco = (cabeca: string) => {
  const i = css.indexOf(cabeca);
  assert.ok(i >= 0, cabeca);
  return css.slice(i, css.indexOf("\n}\n", i));
};

test("de 1101 a 1400 px o local fica na mesma linha da marca", () => {
  const b = bloco("@media(min-width:1101px) and (max-width:1400px){");
  assert.doesNotMatch(b, /grid-template-areas/, "sem linha de baixo nessa faixa");
  assert.match(b, /\.clinicalTopbar>\.orgBadge\{display:flex/);
  // A linha de baixo inteira para o local não volta a valer até 1400 px.
  assert.doesNotMatch(css, /@media\(max-width:1400px\)\{\s*\.clinicalTopbar\{height:auto/);
});

test("de 861 a 1100 px o local sobe para baixo do AVANEST, sem engrossar a barra", () => {
  const b = bloco("@media(min-width:861px) and (max-width:1100px){");
  assert.match(b, /grid-template-areas:"marca abas canto" "local abas canto"/);
  assert.match(b, /margin:-16px 0 0 calc\(38px \+ 12px - 7px\)/);
  assert.match(b, /\.clinicalTopbar>\.orgBadge strong\{max-width:200px\}/, "o teto que deixa 466 px para as abas em 901 px");
  assert.match(bloco("@media(min-width:861px) and (max-width:900px){"), /strong\{max-width:160px\}/);
});

test("abaixo de 861 px e no celular, a linha de baixo de antes", () => {
  const b = bloco("@media(max-width:1100px){\n  /* A base de antes");
  assert.match(b, /grid-template-areas:"marca abas canto" "local local local"/);
  assert.match(css, /grid-template-areas:"marca local canto" "abas abas abas"/, "o bloco do celular continua");
});
