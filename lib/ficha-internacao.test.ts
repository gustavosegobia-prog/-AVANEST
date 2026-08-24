import test from "node:test";
import assert from "node:assert/strict";
import { lerFichaDeInternacao, pareceNome } from "./ficha-internacao.ts";

// As fichas abaixo imitam o que o OCR devolve de fotos reais: caixa alta,
// acento perdido, rótulo às vezes ao lado do valor e às vezes acima dele.

test("ficha com rótulo e valor na mesma linha", () => {
  const { dados } = lerFichaDeInternacao(`
HOSPITAL SANTA CASA DE CAMPO MOURAO
FICHA DE INTERNACAO
Paciente: MARIA APARECIDA DOS SANTOS
Data de nascimento: 14/03/1958
Convenio: UNIMED
Procedimento: COLECISTECTOMIA VIDEOLAPAROSCOPICA
Leito: 214
`);
  assert.equal(dados.paciente, "MARIA APARECIDA DOS SANTOS");
  assert.equal(dados.convenio, "UNIMED");
  assert.equal(dados.procedimento, "COLECISTECTOMIA VIDEOLAPAROSCOPICA");
});

test("ficha com o rótulo acima do valor", () => {
  const { dados } = lerFichaDeInternacao(`
NOME DO PACIENTE
JOAO BATISTA DE OLIVEIRA
CONVENIO
BRADESCO SAUDE
CIRURGIA PROPOSTA
HERNIORRAFIA INGUINAL DIREITA
`);
  assert.equal(dados.paciente, "JOAO BATISTA DE OLIVEIRA");
  assert.equal(dados.convenio, "BRADESCO SAUDE");
  assert.equal(dados.procedimento, "HERNIORRAFIA INGUINAL DIREITA");
});

test("rótulo seguido de outro rótulo não vira valor", () => {
  // O erro que mais custa caro: campo em branco na ficha, e o OCR entrega o
  // rótulo seguinte como se fosse o nome do paciente.
  const { dados, naoEncontrados } = lerFichaDeInternacao(`
PACIENTE:
DATA DE NASCIMENTO: 02/05/1970
LEITO: 12
`);
  assert.equal(dados.paciente, undefined);
  assert.ok(naoEncontrados.includes("paciente"));
});

test("o nome do cirurgião não é confundido com o do paciente", () => {
  const { dados } = lerFichaDeInternacao(`
Paciente: ANA LUCIA FERREIRA
Cirurgiao: DR CARLOS EDUARDO NUNES
Anestesista: DR GUSTAVO SEGOBIA
Convenio: CASSI
`);
  assert.equal(dados.paciente, "ANA LUCIA FERREIRA");
});

test('"nome" só é usado quando não há "paciente"', () => {
  const { dados } = lerFichaDeInternacao(`
Nome: TEREZINHA DE JESUS ALVES
Convenio: PARTICULAR
`);
  assert.equal(dados.paciente, "TEREZINHA DE JESUS ALVES");
  assert.equal(dados.convenio, "PARTICULAR");
});

test("particular carimbado, sem rótulo de convênio", () => {
  const { dados } = lerFichaDeInternacao(`
Paciente: SEBASTIAO RODRIGUES FILHO
Procedimento: RINOPLASTIA
PARTICULAR
`);
  assert.equal(dados.convenio, "Particular");
});

test("registro colado no nome é descartado", () => {
  // OCR junta a coluna vizinha com frequência. Nome com número dentro não é
  // nome, e preencher "MARIA 4471" faria a cobrança sair com lixo.
  const { dados, naoEncontrados } = lerFichaDeInternacao("Paciente: MARIA APARECIDA 4471\n");
  assert.equal(dados.paciente, undefined);
  assert.ok(naoEncontrados.includes("paciente"));
});

test("primeiro nome sozinho não serve para cobrar", () => {
  const { dados } = lerFichaDeInternacao("Paciente: MARIA\n");
  assert.equal(dados.paciente, undefined);
});

test("linha colada com a seguinte não vira nome", () => {
  const longo = "Paciente: " + "PALAVRA ".repeat(20);
  const { dados } = lerFichaDeInternacao(longo);
  assert.equal(dados.paciente, undefined);
});

test("ficha ilegível não devolve nada — e diz o que faltou", () => {
  const { dados, naoEncontrados } = lerFichaDeInternacao("|||| ### ~~~ 8888\n");
  assert.deepEqual(dados, {});
  assert.deepEqual(naoEncontrados.sort(), ["convenio", "paciente", "procedimento"]);
});

test("texto vazio não quebra", () => {
  assert.deepEqual(lerFichaDeInternacao("").dados, {});
  assert.deepEqual(lerFichaDeInternacao("   \n\n  ").dados, {});
});

test("acento e caixa não atrapalham o rótulo", () => {
  const { dados } = lerFichaDeInternacao(`
convênio: Unimed Regional
Procedimento Proposto: Artroplastia total de joelho
`);
  assert.equal(dados.convenio, "Unimed Regional");
  assert.equal(dados.procedimento, "Artroplastia total de joelho");
});

test("o primeiro valor plausível vence a repetição do rodapé", () => {
  const { dados } = lerFichaDeInternacao(`
Paciente: RITA DE CASSIA LOPES
...
Paciente: SEGUNDA VIA DO DOCUMENTO
`);
  assert.equal(dados.paciente, "RITA DE CASSIA LOPES");
});

test("convênio longo demais é frase, não operadora", () => {
  const { dados } = lerFichaDeInternacao(
    "Convenio: o paciente declarou que possui plano de saude porem nao apresentou a carteirinha hoje\n");
  assert.equal(dados.convenio, undefined);
});

test("pareceNome aceita nome composto e recusa rótulo", () => {
  assert.equal(pareceNome("MARIA APARECIDA DOS SANTOS"), true);
  assert.equal(pareceNome("José D'Ávila Sá"), true);
  assert.equal(pareceNome("Ana-Clara Nogueira"), true);
  assert.equal(pareceNome("DATA DE NASCIMENTO"), false);
  assert.equal(pareceNome("Paciente"), false);
  assert.equal(pareceNome("LEITO 214"), false);
  assert.equal(pareceNome(""), false);
});
