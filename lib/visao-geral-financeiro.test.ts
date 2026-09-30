import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A PORTA DE ENTRADA DO FINANCEIRO ERA "LANÇAMENTOS", SEMPRE.
 *
 * Quem abria o Financeiro pela primeira vez — org nova, nenhum convênio
 * precificado, nenhum atendimento lançado — caía direto numa lista vazia
 * ("Nenhum lançamento financeiro cadastrado") ao lado de um menu com quatorze
 * opções, sem nada dizendo por onde começar. E quem reabria depois de um mês
 * inteiro tinha a mesma experiência de quem está no meio do trabalho: sem
 * resumo, sem fila do que precisa de atenção.
 *
 * A NAVEGAÇÃO TAMBÉM ERA TRÊS GRUPOS SOLTOS ("Operação", "Análise",
 * "Configuração") sem relação clara com o que cada seção responde. Virou
 * sete, cada um nomeado pela pergunta que responde — e os IDS de cada aba
 * continuam os mesmos: o resto do arquivo salta para elas por id
 * (`setTarefa("recebimentos")`, o botão "Dar baixa" de Notas fiscais, etc.),
 * e trocar um id quebraria esses saltos sem nenhum aviso do TypeScript.
 */
const ler = (caminho: string) =>
  readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const IDS_DE_SEMPRE = [
  "lancamentos", "recebimentos", "notas", "despesas", "lotes", "producao",
  "repasses", "resultado", "origem", "idade", "faturamento",
  "fechamento", "extrato", "valores",
];

test("a navegação ganhou sete grupos, sem perder nenhuma aba antiga", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf('aria-label="Seções do Financeiro"');
  assert.notEqual(i, -1, "não achei a navegação do Financeiro");
  const nav = tela.slice(i, i + 2600);
  for (const grupo of [
    "Visão geral", "Produção e faturamento", "Contas a receber",
    "Contas a pagar", "Repasses", "Relatórios e fechamento", "Configurações",
  ]) {
    assert.match(nav, new RegExp(`\\["grupo","${grupo}"\\]`),
      `sumiu o grupo "${grupo}" da navegação`);
  }
  for (const id of IDS_DE_SEMPRE) {
    assert.match(nav, new RegExp(`\\["${id}",`),
      `a aba "${id}" sumiu da navegação — algo que apontava para ela quebrou`);
  }
  assert.match(nav, /\["visao-geral","Resumo"\]/, "sumiu a aba de Resumo");
});

test("o Financeiro abre em Visão geral, não mais em Lançamentos", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  assert.match(tela, /const \[tarefa,setTarefa\]=useState\("visao-geral"\);/,
    "o Financeiro voltou a abrir direto em Lançamentos");
});

test("VisaoGeral não inventa dado — todo item da fila vem de uma prop contada em FinanceView", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf("function VisaoGeral(");
  assert.notEqual(i, -1, "não achei o componente VisaoGeral");
  const fim = tela.indexOf("\nfunction ", i + 10);
  const componente = tela.slice(i, fim > i ? fim : i + 6000);
  // O estado de PRIMEIRA VEZ é distinto de "tudo em dia": um é "nada existe
  // ainda", o outro é "existe e está tudo certo". Confundir os dois faria uma
  // org recém-criada ler "Tudo em dia", que é mentira.
  assert.match(componente, /!temAlgumaConfiguracao&&!temAlgumMovimento/,
    "sumiu a distinção entre primeira vez e tudo em dia");
  assert.match(componente, /Comece configurando os valores por convênio/,
    "sumiu o convite de primeira vez");
  assert.match(componente, /Tudo em dia\. Nenhuma pendência/,
    "sumiu a mensagem de fila vazia");
  // Nenhum número literal (além de zero, no teste de contagem) dentro do
  // componente: cada item da fila precisa vir de uma prop recebida, não de um
  // valor chutado dentro do próprio componente.
  assert.ok(!/fila\.push\(\{[^}]*:\s*\d+/.test(componente),
    "algum item da fila ganhou um número fixo em vez de vir de uma prop");
});

test("cada item da fila vai para uma aba que existe de verdade", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf("function VisaoGeral(");
  const fim = tela.indexOf("\nfunction ", i + 10);
  const componente = tela.slice(i, fim > i ? fim : i + 6000);
  const destinos = [...componente.matchAll(/tarefa:"([a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(destinos.length >= 6, "a fila de Atenção hoje perdeu itens");
  for (const destino of destinos) {
    assert.ok(IDS_DE_SEMPRE.includes(destino) || destino === "visao-geral",
      `a fila manda para "${destino}", que não é uma aba conhecida`);
  }
});

test("o contador de convênio sem preço é UMA conta só, não duas", () => {
  // A mesma pergunta ("quantos convênios ativos estão a R$ 0,00?") era
  // respondida dentro de ConvenioValoresPanel. Agora ela também precisa
  // aparecer na fila de Atenção hoje — e DUAS cópias da mesma conta é
  // exatamente como o R$ 2.850,00 divergiu da primeira vez (glosasDe).
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const ocorrencias = [...tela.matchAll(
    /convenioValores\.filter\(item=>item\.ativo&&Number\(item\.valor\)===0&&!item\.gratuito\)\.length/g,
  )];
  assert.equal(ocorrencias.length, 1,
    "a contagem de convênio sem preço voltou a existir em mais de um lugar");
  // E ela precisa excluir gratuito — senão um convênio marcado deliberadamente
  // como cortesia voltaria a inflar a fila de "Atenção hoje" como se fosse
  // uma pendência.
  assert.match(tela, /&&!item\.gratuito\)\.length/,
    "a contagem de convênio pendente parou de excluir os marcados como gratuito");
  assert.match(tela, /pendentes:number/,
    "ConvenioValoresPanel deixou de receber a contagem por prop");
});

test("Recebimentos nunca fica em branco — todo filtro sem resultado explica por quê", () => {
  // A lista era `financeiro.filter(...).sort(...).map(...)` direto na JSX, sem
  // checar o tamanho antes: escolher "Em aberto" com tudo quitado, ou
  // "Quitados" antes do primeiro recebimento, deixava a tela em branco sob os
  // chips de filtro — nem mensagem, nem ação. Exatamente o "muito espaço
  // vazio, nenhuma ação clara" da observação original.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf('chave="fin-recebimentos"');
  assert.notEqual(i, -1, "não achei o painel de Recebimentos");
  const painel = tela.slice(i, i + 2400);
  assert.match(painel, /if\(listaFiltrada\.length===0\) return/,
    "Recebimentos voltou a não checar se a lista filtrada está vazia");
  // DUAS mensagens diferentes, e a diferença é a mesma de sempre: nunca
  // existiu nada (primeiro uso) contra este filtro específico não tem nada
  // agora (período/recorte sem movimento).
  assert.match(painel, /financeiro\.length===0/,
    "sumiu a distinção entre nunca ter lançamento e só não ter neste filtro");
  assert.match(painel, /Nada em aberto agora/, "sumiu a mensagem do filtro \"Em aberto\" vazio");
  assert.match(painel, /Nada quitado ainda/, "sumiu a mensagem do filtro \"Quitados\" vazio");
});
