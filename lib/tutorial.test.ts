import test from "node:test";
import assert from "node:assert/strict";
import { passosDoTutorial } from "./tutorial.ts";

const medico = { role: "medico", nome: "Dr. GUSTAVO SEGOBIA DA SILVA",
                 areas: ["medico", "plantoes"] };
const recepcao = { role: "recepcao", nome: "LETICIA BARBARA", areas: ["recepcao"] };
const tudo = { role: "admin", nome: "GUSTAVO",
               areas: ["medico", "recepcao", "financeiro", "admin", "plantoes"] };

test("o tutorial só ensina áreas que a pessoa tem", () => {
  // Ensinar a clicar num botão que não está lá é pior que não ensinar nada:
  // ensina que o sistema está quebrado.
  const areas = passosDoTutorial(recepcao).map((e) => e.area).filter(Boolean);
  assert.deepEqual(areas, ["recepcao"]);
  assert.ok(!areas.includes("plantoes"));
  assert.ok(!areas.includes("financeiro"));
});

test("o anestesiologista aprende avaliação e escala, nesta ordem", () => {
  // A ordem segue o DIA de trabalho, e não o menu: a avaliação vem antes do
  // paciente entrar. Quem organiza pelo menu ensina o menu.
  const areas = passosDoTutorial(medico).map((e) => e.area).filter(Boolean);
  assert.deepEqual(areas, ["medico", "plantoes", "plantoes", "plantoes"]);
});

test("o primeiro nome abre o tutorial, sem o título e sem gritar", () => {
  // O cadastro guarda "Dr. GUSTAVO SEGOBIA DA SILVA". Um "Bem-vindo, DR." seria
  // pior do que não cumprimentar.
  assert.equal(passosDoTutorial(medico)[0].titulo, "Bem-vindo, Gustavo");
  assert.equal(passosDoTutorial(recepcao)[0].titulo, "Bem-vindo, Leticia");
});

test("sem nome no cadastro, a abertura continua de pé", () => {
  const semNome = passosDoTutorial({ role: "medico", nome: "   ", areas: ["medico"] });
  assert.equal(semNome[0].titulo, "Bem-vindo ao AVANEST");
});

test("a abertura diz que dá para sair e que dá para voltar", () => {
  // A primeira reação a um tutorial é procurar o X. Quem fecha achando que
  // perdeu o conteúdo não volta.
  const [abertura] = passosDoTutorial(medico);
  assert.match(abertura.texto, /sair a qualquer momento/);
  assert.match(abertura.texto, /reabrir/);
});

test("a regra da confirmação no dia é ensinada, e não descoberta no fim do mês", () => {
  // Surpresa sobre pagamento é a pior de todas.
  const passo = passosDoTutorial(medico).find((e) => e.titulo.includes("Confirmar"));
  assert.ok(passo, "o passo da confirmação precisa existir para quem tem escala");
  assert.match(passo!.texto, /no dia do plantão/);
  assert.match(passo!.texto, /fechamento do mês/);
});

test("o sino fecha o tutorial para todo mundo", () => {
  for (const p of [medico, recepcao, tudo]) {
    const ultimo = passosDoTutorial(p).at(-1)!;
    assert.match(ultimo.titulo, /sino/i);
    assert.equal(ultimo.area, undefined);
  }
});

test("quem tem tudo recebe todas as áreas, uma vez cada", () => {
  const areas = passosDoTutorial(tudo).map((e) => e.area).filter(Boolean);
  assert.deepEqual([...new Set(areas)].sort(),
    ["admin", "financeiro", "medico", "plantoes", "recepcao"]);
});

test("ninguém fica com um tutorial de uma etapa só", () => {
  // Alguém sem área nenhuma reconhecida ainda recebe abertura e sino: um modal
  // com um botão "Pronto" e nada dentro parece defeito.
  const nada = passosDoTutorial({ role: "?", nome: "Ana", areas: [] });
  assert.equal(nada.length, 2);
  assert.equal(nada[0].titulo, "Bem-vindo, Ana");
});
