import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deConsulta, deProducao, glosasDe } from "./receitas.ts";

/**
 * O NÚMERO QUE NÃO BATIA.
 *
 * Setembro de 2026: "Resultado do mês" mostrava R$ 2.850,00 de receita
 * faturada. A lista de lançamentos, os gráficos e o fechamento do mesmo mês,
 * na mesma tela, diziam "sem movimento" ou "R$ 0,00". Não era erro de conta —
 * era escopo diferente atrás do mesmo rótulo.
 *
 * "Resultado do mês" e "Origem da receita" já somavam DUAS fontes: a consulta
 * pré-anestésica (tabela `financeiro`) e a produção anestésica enviada ao
 * financeiro (`producao_do_dia`) — via `lib/receitas.ts`, que existe
 * justamente para unificar as duas. Os R$ 2.850,00 eram onze linhas de
 * produção de setembro; a tabela `financeiro` estava vazia naquele mês.
 *
 * "Lançamentos", "Gráficos" e "Fechamento" nunca sabiam da produção: liam só
 * `financeiro`/`periodItems`, porque a lista de lançamentos tem colunas que a
 * produção genuinamente não tem — nota fiscal, lote, glosa por valor. Dado
 * de formato diferente, com razão, para não fingir campos que não existem.
 *
 * O DEFEITO NÃO ERA A DIFERENÇA DE ESCOPO — é ter DUAS TELAS NA MESMA PÁGINA,
 * sobre o MESMO MÊS, com nomes iguais ("Total", "Faturado") e populações
 * diferentes, sem dizer isso em lugar nenhum. Estes testes travam que os
 * números que PODEM reconciliar reconciliam, e que os que ficam com escopo
 * mais estreito dizem por quê.
 */
const ler = (caminho: string) =>
  readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("Fechamento do período lê a mesma soma unificada que Resultado do mês", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf('chave="fin-fechamento"');
  assert.notEqual(i, -1, "não achei o painel de Fechamento");
  const painel = tela.slice(i, i + 1600);
  // Total, Recebido e Pendente precisam vir de `receitaTotal` — a soma de
  // `receitasDoMes`, a mesma fonte que "Resultado do mês" usa. Voltar a somar
  // só `periodItems` (consulta) reabriria exatamente o R$ 2.850,00 sumido.
  assert.match(painel, /value=\{receitaTotal\.valor\}/,
    "Total cobrado voltou a ler só a consulta");
  assert.match(painel, /value=\{receitaTotal\.recebido\}/,
    "Recebido voltou a ler só a consulta");
  assert.match(painel, /value=\{receitaTotal\.aReceber\}/,
    "Pendente voltou a ler só a consulta");
  // Glosas passa pela função compartilhada — hoje só a consulta responde
  // "quanto foi glosado" (ver o comentário de `glosaValor` em receitas.ts),
  // mas com `glosasDe` a conta fica certa sozinha no dia em que a produção
  // também passar a registrar isso.
  assert.match(painel, /value=\{glosasDe\(receitasDoMes\)\}/,
    "Glosas deixou de usar a soma compartilhada");
  // Repasses e Ticket médio CONTINUAM só de consulta, e isso é dito na tela —
  // não é um esquecimento, é um limite real: repasse e nota fiscal não
  // existem para produção neste sistema ainda.
  assert.match(painel, /Repasses realizados \(consultas\)/,
    "o rótulo parou de avisar que Repasses é só de consultas");
  assert.match(painel, /Ticket médio \(consultas\)/,
    "o rótulo parou de avisar que Ticket médio é só de consultas");
});

test("a legenda de Resultado do mês não promete caixa e entrega competência", () => {
  // A legenda dizia "o que entrou menos o que saiu" — linguagem de CAIXA —
  // sobre um card rotulado "Receita faturada" — competência. As duas contas
  // são legítimas (ver lib/despesas.ts:resultadoDoMes), o que estava errado
  // era só o texto contradizendo o número ao lado dele.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  assert.ok(!/legenda="o que entrou menos o que saiu"/.test(tela),
    "a legenda de caixa voltou a descrever um resultado por competência");
  const i = tela.indexOf('chave="fin-resultado"');
  assert.notEqual(i, -1, "não achei o painel de Resultado do mês");
  assert.match(tela.slice(i, i + 400), /faturado|competência/i,
    "a legenda de Resultado do mês deixou de falar em faturado/competência");
});

test("os gráficos leem a mesma receita unificada, não uma cópia à parte", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  assert.match(tela, /<GraficosFinanceiro receitas=\{receitas\}/,
    "os gráficos voltaram a receber só as consultas");
  const grafico = ler("components/graficos-financeiro.tsx");
  // O `;` distingue a DECLARAÇÃO de tipo (`financeiro: Lancamento[];`) da
  // prosa deste próprio comentário, que cita o tipo antigo entre crases para
  // explicar a mudança — sem o `;`, o regex casava com a própria explicação.
  assert.ok(!/financeiro:\s*Lancamento\[\];/.test(grafico),
    "os gráficos voltaram a um tipo Lancamento[] só de consulta");
  assert.match(grafico, /receitas: Receita\[\]/,
    "os gráficos deixaram de tipar a entrada como Receita[] unificada");
  // Forma de recebimento continua só de consulta, DE PROPÓSITO — produção não
  // registra método de pagamento. Isso precisa continuar sendo dito no
  // código, não só lembrado.
  assert.match(grafico, /CONSULTA-ONLY/,
    "sumiu a explicação de por que \"Formas de recebimento\" não usa produção");
});

test("todo MoneySmall do Financeiro respeita o olho de esconder valores", () => {
  // Onze cartões (3 em Resultado, 8 em Fechamento — os 6 de sempre mais
  // Despesas do mês e Resultado do mês, que passaram a aparecer também no
  // fechamento) chamavam `value.toLocaleString(...)` direto, ignorando o
  // interruptor de esconder valores — os cartões de cima ficavam com "•••"
  // e estes continuavam mostrando o número, na mesma tela, ao mesmo tempo.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const chamadas = [...tela.matchAll(/<MoneySmall value=\{[^}]*\}[^/]*\/>/g)];
  assert.equal(chamadas.length, 11, "o número de cartões MoneySmall no Financeiro mudou");
  const semOculto = chamadas.filter((m) => !m[0].includes("oculto={oculto}"));
  assert.deepEqual(semOculto.map((m) => m[0]), [],
    "algum cartão de dinheiro do Financeiro não respeita mais o olho de esconder");
  // E o próprio componente precisa saber esconder, não só receber a prop.
  // Linha inteira: a definição é escrita numa linha só (o padrão deste
  // arquivo para componentes pequenos), e o JSX tem chaves aninhadas que um
  // recorte por `[^}]*` cortaria no primeiro `}` — bem antes de chegar no
  // "•••".
  const linhaDaFuncao = tela.split("\n").find((l) => l.startsWith("function MoneySmall"));
  assert.ok(linhaDaFuncao, "não achei a definição de MoneySmall");
  assert.match(linhaDaFuncao!, /oculto\?"•••"/,
    "MoneySmall parou de trocar o valor por \"•••\" quando oculto");
});

test("convênio ativo com preço zero avisa \"preço pendente\", não \"ativo\"", () => {
  // Doze convênios da INOVANEST estavam ativos com valor R$ 0,00 — não porque
  // alguém decidiu que são gratuitos, mas porque ninguém preencheu o preço
  // ainda. O selo dizia "ATIVO" para os dois casos, igual ao que cobra de
  // verdade, e a pessoa só descobria o problema quando um lançamento saía a
  // zero.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf("function ConvenioValoresPanel");
  assert.notEqual(i, -1, "não achei o painel de valores por convênio");
  const painel = tela.slice(i, i + 6000);
  // A regra ganhou um terceiro caso — gratuito, por decisão, que NÃO conta
  // como pendente — mas o núcleo continua o mesmo: zero é suspeito até
  // provar o contrário.
  assert.match(painel, /const semPreco=item\.ativo&&zerado&&!item\.gratuito;/,
    "sumiu a regra que distingue preço pendente de preço zero por decisão");
  assert.match(painel, /"PREÇO PENDENTE"/, "sumiu o selo de preço pendente");
  // O quarto estado chegou: gratuito por decisão (SUS/cortesia), distinto de
  // "ninguém preencheu ainda" — migração 202609300001_convenio_gratuito.sql.
  assert.match(painel, /"GRATUITO"/, "sumiu o selo de convênio gratuito");
  assert.match(painel, /toggleGratuito/, "sumiu a ação de marcar/desmarcar gratuito");
});

test("criar lançamento sem preço configurado avisa, e não finge que está tudo certo", () => {
  // `createBilling` inseria o lançamento com `Number(price?.valor||0)` e a
  // mesma mensagem de sempre — "Lançamento criado" —, tanto para um convênio
  // precificado quanto para um sem preço nenhum. R$ 0,00 nascia em silêncio.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf("async function createBilling");
  assert.notEqual(i, -1, "não achei createBilling");
  const funcao = tela.slice(i, i + 2000);
  // Preço zero DE PROPÓSITO (gratuito) não dispara o aviso — só a ausência
  // de decisão dispara.
  assert.match(funcao, /semPreco=!price\|\|\(Number\(price\.valor\)===0&&!price\.gratuito\)/,
    "createBilling deixou de detectar a ausência de preço");
  assert.match(funcao, /Lançamento criado sem preço/,
    "sumiu o aviso de lançamento sem preço");
  // E continua criando o lançamento mesmo sem preço — travar empurraria o
  // atendimento para fora do sistema, que é o hábito que ele existe para
  // substituir.
  assert.ok(!/if\(semPreco\)\{setBusy\(""\);return\}/.test(funcao),
    "createBilling passou a bloquear o lançamento sem preço, em vez de avisar");
});

test("a soma de glosa é a mesma função nos dois lugares que hoje a usam", () => {
  // Não é um detalhe de estilo: DUAS cópias da mesma soma («periodItems
  // .filter(status==='glosa').reduce(...)» e outra em graficos-financeiro.tsx)
  // foi como a fonte do R$ 2.850,00 divergiu da lista em primeiro lugar — cada
  // tela decidindo sozinha "o que conta" para a mesma pergunta.
  const consulta = deConsulta({
    id: "c1", convenio: "Unimed", valor: 300, recebido: 0,
    status: "glosa", medico_id: "m1", created_at: "2026-09-05T10:00:00Z",
    glosa_valor: 90,
  })!;
  const producao = deProducao({
    id: "p1", perfil_id: "m1", data: "2026-09-05", paciente: "Fulana",
    convenio: "Unimed", valor: 500, situacao: "glosado",
  })!;
  assert.equal(glosasDe([consulta, producao]), 90,
    "a soma unificada de glosa não bate mais com o que cada fonte sabe responder");
});
