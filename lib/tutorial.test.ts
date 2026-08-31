import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

test("a ordem é a do dia de trabalho: recepção, médico, escala, financeiro, admin", () => {
  // A ordem foi ditada por quem usa: o paciente entra pela recepção, passa
  // pelo médico, o plantão vira escala, o dinheiro cai no financeiro, e o
  // Admin fica por último porque é ajuste de casa e não rotina de quem entra
  // pela primeira vez.
  const blocos = passosDoTutorial(tudo).map((e) => e.area).filter(Boolean)
    .filter((a, i, arr) => a !== arr[i - 1]);
  assert.deepEqual(blocos, ["recepcao", "medico", "plantoes", "financeiro", "admin"]);
});

test("os valores por convênio são ensinados, com o aviso do R$ 0,00", () => {
  // Sem essa tabela todo atendimento entra valendo zero e o Financeiro parece
  // quebrado. É a pegadinha de setup que mais custa caro descobrir depois.
  const texto = passosDoTutorial(tudo).map((e) => e.texto).join(" ");
  assert.match(texto, /Valores por convênio/);
  assert.match(texto, /R\$ 0,00/);
});

test("ensina o que mais gerou dúvida: baixa, planilha e troca", () => {
  // Cada uma destas foi pergunta de quem ACHOU a área e não soube o que fazer
  // dentro dela. Saber onde fica a Escala não ensina a passar um plantão.
  const textos = passosDoTutorial(tudo).map((e) => `${e.titulo} ${e.texto}`).join(" ");
  assert.match(textos, /Recebido/, "a baixa da produção");
  assert.match(textos, /Planilha|Excel/, "a planilha para o contador");
  assert.match(textos, /Trocar|troca/i, "passar plantão a um colega");
  assert.match(textos, /Tela de Início/, "o iPhone precisa do app instalado");
  assert.match(textos, /Central Operacional/, "o que ficou para trás");
  assert.match(textos, /sem passar pela Recepção/, "o paciente do hospital");
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

test("o painel de fundo não vai e volta entre áreas", () => {
  // Foi o defeito relatado: a etapa dos valores dizia "cadastre em Financeiro"
  // com o Admin ao fundo, e a sequência era Admin → Financeiro → Admin. A
  // pessoa lê o texto e vê a tela piscar, e passa a olhar para o pisca.
  //
  // A regra: cada área aparece num bloco contínuo. Voltar a uma área já
  // visitada significa que a ordem foi montada por assunto e não por tela.
  for (const p of [tudo, medico, recepcao]) {
    const areas = passosDoTutorial(p).map((e) => e.area).filter(Boolean) as string[];
    const blocos = areas.filter((a, i) => a !== areas[i - 1]);
    assert.equal(blocos.length, new Set(blocos).size,
      `o fundo volta a uma área já visitada: ${blocos.join(" → ")}`);
  }
});

test("etapa que manda ir a outro lugar diz o CAMINHO", () => {
  // Um alvo escondido atrás de sub-aba nunca é encontrado: o destaque some em
  // silêncio e a etapa vira um texto solto. Quando não dá para apontar, o
  // texto tem de escrever o caminho — "Financeiro → Valores por convênio" —
  // em vez de só nomear a área.
  const comCaminho = ["Convites", "Locais de atendimento",
    "Trocas de plantão", "Produção do dia", "Meu financeiro"];
  const etapas = passosDoTutorial(tudo);
  for (const titulo of comCaminho) {
    const etapa = etapas.find((e) => e.titulo === titulo);
    assert.ok(etapa, `sumiu a etapa "${titulo}"`);
    assert.match(etapa!.texto, /→/, `"${titulo}" precisa dizer o caminho com →`);
  }
});

test("todo alvo existe no código da interface", () => {
  // O defeito que já apareceu DUAS vezes: um alvo que não existe não quebra
  // nada — o destaque simplesmente não acontece, em silêncio, e a etapa vira
  // um texto solto no meio da tela. Foi assim com `[data-secao="producao"]`
  // antes de a marca existir de verdade.
  //
  // Este teste lê o código-fonte e procura cada alvo. Não é o DOM, então não
  // garante que o elemento esteja VISÍVEL naquele passo — garante que ele
  // exista em algum lugar, que é o erro que se comete ao renomear uma seção
  // e esquecer do tutorial.
  const fonte = ["app", "components"]
    .flatMap((dir) => execSync(`find ${dir} -name '*.tsx'`, { encoding: "utf8" }).trim().split("\n"))
    .map((f) => readFileSync(f, "utf8")).join("\n");

  for (const etapa of passosDoTutorial(tudo)) {
    if (!etapa.alvo) continue;
    const porDado = etapa.alvo.match(/^\[data-(secao|area|acao)="(.+)"\]$/);
    // As seções são declaradas como ["id","Rótulo"] e viram data-secao={id};
    // procurar `data-secao="usuarios"` no fonte não acharia nada.
    const procura = porDado
      ? (porDado[1] === "secao" ? `["${porDado[2]}"` : `data-${porDado[1]}="${porDado[2]}"`)
      : etapa.alvo.slice(1);
    assert.ok(fonte.includes(procura),
      `o alvo ${etapa.alvo} da etapa "${etapa.titulo}" não existe na interface`);
  }
});

// ===========================================================================
// Ligar a notificação no telefone
// ===========================================================================
// Estas etapas nasceram de um caso real: o usuário via o sino funcionando,
// concluía que a notificação estava ligada, e não recebia nada no aparelho. E
// no iPhone a opção de ligar NEM APARECE enquanto o site não estiver na Tela de
// Início — some sem explicar, o que a pessoa lê como sistema quebrado.
//
// O texto anterior dizia tudo isso numa frase só, com o passo do iPhone
// espremido numa oração subordinada. Estes testes existem para que a próxima
// pessoa a "enxugar" o tutorial não devolva o problema.

test("todo papel aprende a ligar a notificação no telefone", () => {
  for (const [nome, papel] of [["médico", medico], ["recepção", recepcao], ["admin", tudo]] as const) {
    const texto = passosDoTutorial(papel).map((e) => `${e.titulo} ${e.texto}`).join(" ");
    assert.match(texto, /Tela de In[íi]cio/,
      `${nome}: sem o passo da Tela de Início, o iPhone não liga e parece defeito`);
    assert.match(texto, /Safari/, `${nome}: precisa dizer que é no Safari, não no Chrome`);
    assert.match(texto, /Permitir/, `${nome}: precisa dizer o que responder ao navegador`);
  }
});

test("o tutorial separa o sino da notificação do aparelho", () => {
  // Confundir os dois foi a origem do chamado: sino funcionando não significa
  // notificação ligada, e quem acha que significa nunca vai ligar.
  const etapas = passosDoTutorial(tudo);
  const doSino = etapas.findIndex((e) => /sino/i.test(e.titulo));
  const doTelefone = etapas.findIndex((e) => /telefone/i.test(e.titulo));
  assert.ok(doSino >= 0 && doTelefone >= 0, "as duas etapas precisam existir");
  assert.ok(doTelefone > doSino,
    "a do telefone vem DEPOIS da do sino, para poder dizer que não é a mesma coisa");
  assert.match(etapas[doTelefone].texto, /fechado/,
    "o que distingue as duas é o aplicativo estar fechado — precisa estar escrito");
});

test("o passo do iPhone tem etapa própria, e não uma observação no meio", () => {
  // Passo que aparece como oração subordinada não é executado por quem lê
  // corrido — e este é obrigatório.
  const iphone = passosDoTutorial(tudo).filter((e) => /iPhone/i.test(e.titulo));
  assert.equal(iphone.length, 1, "o iPhone precisa de uma etapa só dele");
  assert.match(iphone[0].texto, /compartilhar/, "o caminho inteiro, não o resumo");
});
