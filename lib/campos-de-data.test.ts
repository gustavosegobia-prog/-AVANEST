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

test("o campo de data tem largura própria e não é espremido pela linha", () => {
  // 16px é obrigatório — abaixo disso o iPhone dá zoom sozinho ao tocar no
  // campo —, e com 16px o controle pede 172px. Na avaliação o campo não
  // cresce nem encolhe: a caixa tem o tamanho do controle, que é o que
  // mantém o ícone do calendário no canto direito.
  const avaliacao = css.match(
    /\.evalFormGrid>\.evalField:has\(input\[type="date"\]\)\{flex:0 0 (\d+)px;max-width:(\d+)px\}/);
  assert.ok(avaliacao, "a regra da avaliação sumiu");
  assert.ok(Number(avaliacao![1]) >= PRECISA.formulario,
    `${avaliacao![1]}px é menos que os ${PRECISA.formulario}px medidos`);
  assert.equal(avaliacao![1], avaliacao![2], "a base e o máximo têm de ser o mesmo número");
  // O cadastro do paciente continua sendo uma grade, e ali a saída é a coluna
  // dupla: a coluna simples entrega 146px onde o controle pede 172px.
  assert.match(css, /\.patientFormGrid \.clinicalField:has\(input\[type="date"\]\)\{grid-column:span 2\}/);
  // Onde a grade já é de uma coluna só, `span 2` criaria uma coluna
  // implícita e a linha da data ficaria com metade da largura das outras.
  assert.match(css, /\.patientFormGrid \.clinicalField:has\(input\[type="date"\]\)\{grid-column:1\/-1\}/);
});

test("a identificação é uma linha que fecha, e não colunas iguais", () => {
  // Colunas iguais num formulário de campos muito diferentes davam os dois
  // defeitos ao mesmo tempo: o CPF com 350px para catorze caracteres, e a
  // última linha terminando no meio da tela.
  assert.match(css, /\.evalFormGrid\{display:flex;flex-wrap:wrap/);
  assert.doesNotMatch(css, /\.evalFormGrid\{grid-template-columns/,
    "sobrou uma regra de colunas iguais, que não faz mais nada");
  // `flex-grow` reparte TODA a sobra: sem um máximo, um campo sozinho na
  // última linha estica para a largura inteira da seção.
  const base = css.match(/\.evalFormGrid>\.evalField\{flex:1 1 (\d+)px;min-width:0;max-width:(\d+)px\}/);
  assert.ok(base, "a regra de base dos campos sumiu");
  assert.ok(Number(base![1]) >= PRECISA.formulario,
    "a base tem de caber o campo mais exigente da seção, que é o de data");
  assert.ok(Number(base![2]) > Number(base![1]), "o máximo tem de ser maior que a base");
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

test("CPF e telefone são campos de código, e não encolhem", () => {
  // Comprimento fixo e conhecido: "000.000.000-00" pede 176px com a fonte de
  // 16px. Metade da linha de um telefone são 155px — cortavam o "-00" e o fim
  // do número sem avisar. Também não crescem: não há o que mostrar além do
  // número, e com 350px o campo só ficava desproporcional.
  const form = fs.readFileSync(
    new URL("../app/avaliacoes/[id]/assessment-form.tsx", import.meta.url), "utf8");
  for (const rotulo of ["CPF", "Telefone / WhatsApp"]) {
    const re = new RegExp(`<label className="evalField codigo"><span>${rotulo.replace("/", "\\/")}</span>`);
    assert.match(form, re, `${rotulo} deixou de ser campo de código`);
  }
  const regra = css.match(/\.evalFormGrid>\.evalField\.codigo\{flex:1 1 (\d+)px/);
  assert.ok(regra, "a regra do campo de código sumiu");
  assert.ok(Number(regra![1]) >= PRECISA.formulario, `${regra![1]}px espreme o CPF`);
});

test("a caixa da data tem o tamanho do conteúdo, para o ícone ficar à direita", () => {
  // Com o campo ocupando duas colunas, a caixa ficava muito mais larga que o
  // conteúdo e o ícone do calendário boiava no meio dela. Empurrar o ícone com
  // CSS não funciona: o Chrome posiciona as partes internas do seletor de data
  // com o layout dele e ignora `margin-inline-start:auto`,
  // `justify-content:space-between` e `flex-grow` no `::-webkit-datetime-edit`
  // — todos testados. Só sobra dar à caixa o tamanho certo.
  const m = css.match(/\.conditionalDetails input\[type="date"\]\{width:(\d+)px;max-width:100%\}/);
  assert.ok(m, "a regra de largura da caixa sumiu");
  const largura = Number(m![1]);
  assert.ok(largura >= PRECISA.formulario,
    `${largura}px corta o ícone: o controle pede ${PRECISA.formulario}px`);
  // Sem `max-width:100%` a caixa fixa fura a coluna em vez de encolher.
  assert.ok(largura <= 200, `${largura}px é largo demais — a caixa volta a sobrar`);
});

test("a identificação não pede o hospital nem a unidade de internação", () => {
  // O hospital já está no papel: o cabeçalho de todo documento sai com o nome
  // e o logo do local do atendimento. Digitá-lo de novo era pedir a mesma
  // informação duas vezes, e pela via que erra — texto livre não casa com o
  // cadastro do local na hora de escolher a tabela de valores. A unidade de
  // internação não era lida em lugar nenhum.
  const form = fs.readFileSync(
    new URL("../app/avaliacoes/[id]/assessment-form.tsx", import.meta.url), "utf8");
  for (const campo of ['input("hospital"', 'input("unidade"']) {
    assert.ok(!form.includes(campo), `${campo} voltou para o formulário`);
  }
});

test("o hospital impresso vem do local quando não foi digitado", () => {
  // Tirar o campo não pode deixar a linha "Hospital" vazia no papel: quem lê a
  // ficha depois precisa saber onde o paciente foi atendido. O nome digitado
  // segue na frente para as avaliações antigas.
  const doc = fs.readFileSync(
    new URL("../app/avaliacoes/[id]/documentos/print-documents.tsx", import.meta.url), "utf8");
  assert.match(doc,
    /\["Hospital",dados\.hospital\|\|paciente\.hospital\|\|\(local\?\.nome_fantasia\|\|local\?\.nome\|\|""\)/);
});
