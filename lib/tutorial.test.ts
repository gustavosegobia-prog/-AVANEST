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
  //
  // O teste afirma o CONJUNTO de áreas, e não quantas etapas cada uma tem: o
  // número de etapas é conteúdo, e vai mudar de novo. A regra é qual porta se
  // abre para quem.
  const areas = passosDoTutorial(recepcao).map((e) => e.area).filter(Boolean);
  assert.deepEqual([...new Set(areas)], ["recepcao"]);
});

test("o anestesiologista aprende avaliação e escala, nesta ordem", () => {
  // A ordem segue o DIA de trabalho, e não o menu: a avaliação vem antes do
  // paciente entrar. Quem organiza pelo menu ensina o menu.
  const areas = passosDoTutorial(medico).map((e) => e.area).filter(Boolean);
  assert.deepEqual([...new Set(areas)], ["medico", "plantoes"]);
});

test("o preparo vem antes do trabalho, e só para quem administra", () => {
  // Um serviço que entra sem valor de consulta cadastrado vê o Financeiro em
  // R$ 0,00 e conclui que a conta está quebrada. Ensinar depois custa mais.
  const doAdmin = passosDoTutorial(tudo);
  const valores = doAdmin.findIndex((e) => /valores/i.test(e.titulo));
  const trabalho = doAdmin.findIndex((e) => e.area === "medico");
  assert.ok(valores > 0, "o passo dos valores precisa existir para quem administra");
  assert.ok(valores < trabalho, "preparar a casa vem antes de usá-la");

  // E o anestesiologista sem Admin não recebe: ele clicaria e seria recusado.
  assert.equal(passosDoTutorial(medico).some((e) => /valores/i.test(e.titulo)), false);
});

test("ensina o que mais gerou dúvida: baixa, planilha e troca", () => {
  // Cada uma destas foi pergunta de quem ACHOU a área e não soube o que fazer
  // dentro dela. Saber onde fica a Escala não ensina a passar um plantão.
  const textos = passosDoTutorial(tudo).map((e) => `${e.titulo} ${e.texto}`).join(" ");
  assert.match(textos, /Recebido/, "a baixa da produção");
  assert.match(textos, /Planilha|Excel/, "a planilha para o contador");
  assert.match(textos, /Trocar|troca/i, "passar plantão a um colega");
  assert.match(textos, /Tela de Início/, "o iPhone precisa do app instalado");
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

test("o fecho é comum a todo mundo, e não pertence a área nenhuma", () => {
  // As últimas etapas — sino, notificações e como rever — valem para qualquer
  // papel, e por isso não têm área. O teste afirma isso, e não qual delas é a
  // última: a ordem do fecho é conteúdo.
  for (const p of [medico, recepcao, tudo]) {
    const etapas = passosDoTutorial(p);
    assert.equal(etapas.at(-1)!.area, undefined);
    assert.ok(etapas.some((e) => /sino/i.test(e.titulo)), "o sino é ensinado a todos");
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
  assert.ok(nada.length >= 2, "abertura e fecho sempre existem");
  assert.equal(nada[0].titulo, "Bem-vindo, Ana");
  assert.equal(nada.some((e) => e.area), false, "sem área, nenhuma etapa de área");
});

test("todo alvo é um seletor plausível, e não uma classe inventada", () => {
  // O `[data-secao="producao"]` da primeira versão nunca existiu no código: o
  // destaque simplesmente não acontecia, em silêncio, e a etapa perdia metade
  // do que ela é. Isto não confere o DOM, mas pega o alvo malformado.
  for (const etapa of passosDoTutorial(tudo)) {
    if (!etapa.alvo) continue;
    assert.match(etapa.alvo, /^[.[]/, `alvo estranho em "${etapa.titulo}": ${etapa.alvo}`);
  }
});
