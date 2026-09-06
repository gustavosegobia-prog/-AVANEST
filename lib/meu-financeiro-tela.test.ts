import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("o balão do mês fica escondido também onde não há ponteiro", () => {
  // ESTE FOI O DEFEITO. O `display:none` do balão morava dentro do
  // `@media (hover:hover)`, junto com o resto do estilo dele. Num aparelho de
  // toque a consulta inteira não vale, então o balão não era escondido: virava
  // texto comum dentro de cada uma das doze colunas. O cartão inchava e a
  // página ganhava 1.256px de rolagem lateral no iPhone e 890px no iPad, que
  // era o que jogava a barra de cima e as abas para fora da tela.
  //
  // A regra tem de estar FORA de qualquer `@media` — por isso a busca exige a
  // linha inteira colada na abertura da consulta, e não o texto solto, que
  // casaria também com uma cópia escondida dentro dela.
  assert.match(css, /\n\.mfBalao\{display:none\}\n@media \(hover:hover\) \{/,
    "o balão precisa nascer escondido, no nível de cima, antes do @media");
});

test("os cartões do financeiro usam os tokens do tema, e não branco cravado", () => {
  // Escritos à mão, os cartões continuavam brancos no tema escuro enquanto o
  // texto virava claro — "R$ 16.600,00" saía a 1,2:1 de contraste, que é o
  // mesmo que não estar escrito. Medido: no escuro, TODO texto destes cartões
  // estava abaixo de 4,5:1.
  for (const regra of [".mfResumo", ".mfLocal"]) {
    const m = css.match(new RegExp(`\\${regra}\\{background:([^;]+);border:1px solid ([^;]+);`));
    assert.ok(m, `não achei a regra de ${regra}`);
    assert.match(m![1], /^var\(--cor-/, `${regra} pinta o fundo com valor cru: ${m![1]}`);
    assert.match(m![2], /^var\(--cor-/, `${regra} pinta a borda com valor cru: ${m![2]}`);
  }
  assert.doesNotMatch(css, /\.despesaForm input,\.despesaForm select\{[^}]*background:#fff/,
    "o campo de despesa fica branco no tema escuro, com texto claro por cima");
});

test("o mês aberto tem contraste nos dois temas", () => {
  // `--cor-marca-contraste` existe exatamente para isto: no tema escuro a marca
  // clareia, e o branco cravado à mão caía para 2,8:1 em cima dela.
  assert.match(css,
    /\.mfColuna\.atual \.mfMes\{background:var\(--cor-marca\);color:var\(--cor-marca-contraste\)\}/);
});

test("a legenda e as colunas cabem num telefone estreito", () => {
  // Sem `wrap`, a quarta faixa da legenda saía pela borda do cartão a 320px; e
  // sem `min-width:0` a coluna não encolhia abaixo do rótulo do mês, e as doze
  // furavam o cartão.
  assert.match(css, /\.mfLegenda\{display:flex;flex-wrap:wrap/);
  assert.match(css, /\.mfColuna\{flex:1;min-width:0;/);
  assert.match(css, /\.mfMes\{[^}]*width:100%;max-width:22px/);
});
