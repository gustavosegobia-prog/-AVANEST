import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// AS MEDIDAS QUE ESTES TESTES GUARDAM.
//
// Um `input[type=date]` corta o conteúdo EM SILÊNCIO: `scrollWidth` não acusa
// nada nele, então o defeito só aparece olhando a tela — e foi assim que ele
// sobreviveu a várias correções. Os números abaixo saíram de medir o campo
// dentro do próprio rótulo, num navegador de verdade, varrendo de 320px a
// 2000px de largura.
//
// A primeira medição foi ERRADA e vale registrar por quê: o campo era clonado
// para dentro de <body> para medir a largura natural, e ali as regras
// `.evalField input{...}` deixavam de casar — o clone perdia o preenchimento e
// o `display:flex` do campo real, e a conta saía 20px menor. Foi de onde veio
// o "126px" que ficou escrito no CSS por um tempo. O clone tem de nascer
// dentro do mesmo pai.
const PRECISA = {
  /** Fonte de 16px, preenchimento de 14px: "16/08/1954" mais o calendário. */
  formulario: 172,
  /** Fonte de 12px nos filtros do histórico. */
  filtro: 154,
  /** Fonte de 16px com preenchimento menor, no lançamento de despesa. */
  despesa: 167,
} as const;

const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("o campo de data ocupa duas colunas nas grades de formulário", () => {
  // 16px é obrigatório — abaixo disso o iPhone dá zoom sozinho ao tocar no
  // campo —, e com 16px o controle pede 172px. A coluna entrega 139px na
  // faixa de 9 colunas e 121px num telefone de 320px. Não existe
  // preenchimento pequeno o bastante para caber: só sobra ocupar duas.
  assert.match(css, /\.evalFormGrid \.evalField:has\(input\[type="date"\]\)/);
  assert.match(css, /\.patientFormGrid \.clinicalField:has\(input\[type="date"\]\)\{grid-column:span 2\}/);
  // Onde a grade já é de uma coluna só, `span 2` criaria uma coluna
  // implícita e a linha da data ficaria com metade da largura das outras.
  assert.match(css, /\.patientFormGrid \.clinicalField:has\(input\[type="date"\]\)\{grid-column:1\/-1\}/);
});

test("os filtros do histórico não espremem a data abaixo do que ela precisa", () => {
  const largo = css.match(/\.historyFilters label:has\(input\[type=date\]\)\{flex:0 1 (\d+)px;min-width:(\d+)px\}/);
  assert.ok(largo, "a regra de tela larga sumiu");
  for (const n of [Number(largo![1]), Number(largo![2])]) {
    assert.ok(n >= PRECISA.filtro, `${n}px é menos que os ${PRECISA.filtro}px medidos`);
  }
  const estreito = css.match(/\.historyFilters label:has\(input\[type=date\]\)\{flex:1 1 calc\(50% - 7px\);min-width:(\d+)px\}/);
  assert.ok(estreito, "a regra de telefone sumiu");
  // No telefone o preenchimento do campo cai para 10px, e aí ele pede 146px.
  assert.ok(Number(estreito![1]) >= 146, `${estreito![1]}px é pouco no telefone`);
});

test("a data do lançamento de despesa tem a largura medida, e não estimada", () => {
  const m = css.match(/\.despesaForm input\[type=date\]\{width:(\d+)px\}/);
  assert.ok(m, "a regra sumiu");
  assert.ok(Number(m![1]) >= PRECISA.despesa,
    `${m![1]}px corta o ícone: o controle pede ${PRECISA.despesa}px`);
});

test("CPF e telefone também ocupam duas colunas na identificação", () => {
  // Mesma causa da data: "000.000.000-00" pede 176px com a fonte de 16px, e a
  // coluna de 9 entrega 139px. Cortavam o "-00" e o fim do número sem avisar.
  const form = fs.readFileSync(
    new URL("../app/avaliacoes/[id]/assessment-form.tsx", import.meta.url), "utf8");
  for (const rotulo of ["CPF", "Telefone / WhatsApp"]) {
    const re = new RegExp(`<label className="evalField span2"><span>${rotulo.replace("/", "\\/")}</span>`);
    assert.match(form, re, `${rotulo} voltou a caber numa coluna só`);
  }
});
