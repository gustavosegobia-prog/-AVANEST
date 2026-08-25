import test from "node:test";
import assert from "node:assert/strict";
import { lembretesDoDinheiro, montarAvisos, quantosPedemResposta, type EntradaDeAvisos, type TrocaParaAviso } from "./avisos.ts";

const EU = "eu-1";
const LUCAS = "lucas-1";
const MATHEUS = "matheus-1";

// Já vem encurtado: quem monta o mapa é quem encurta, para o nome no aviso ser
// o mesmo nome que aparece no calendário.
const nomes = new Map([[EU, "Gustavo Segobia"], [LUCAS, "Lucas Queiroz"], [MATHEUS, "Matheus Gomes"]]);
const plantoes = new Map([
  ["p1", { data: "2026-09-12", hora_inicio: "07:00:00", hora_fim: "19:00:00" }],
  ["p2", { data: "2026-09-30", hora_inicio: "19:00:00", hora_fim: "07:30:00" }],
]);

const troca = (t: Partial<TrocaParaAviso>): TrocaParaAviso => ({
  id: "t1", plantao_id: "p1", solicitante_id: LUCAS, destinatario_id: null,
  status: "pendente", respondido_por: null, respondido_em: null,
  created_at: "2026-08-25T12:00:00Z", ...t,
});

const entrada = (e: Partial<EntradaDeAvisos> = {}): EntradaDeAvisos => ({
  perfilId: EU, trocas: [], plantoes, nomes,
  chat: { novas: 0, ultima: null }, chamados: [], vistoEm: null, ...e,
});

test("plantão oferecido ao grupo aparece, e diz que dia é", () => {
  const [a] = montarAvisos(entrada({ trocas: [troca({})] }));
  assert.equal(a.titulo, "Lucas Queiroz ofereceu um plantão ao grupo");
  // O dia é a informação que decide se você pode assumir. "Um plantão" não
  // decide nada, e obrigaria a abrir a escala só para descobrir qual.
  assert.equal(a.detalhe, "12/09, 07h–19h");
  assert.equal(a.acao, true);
});

test("convite dirigido a você é dito como convite, não como oferta ao grupo", () => {
  const [a] = montarAvisos(entrada({ trocas: [troca({ destinatario_id: EU })] }));
  assert.equal(a.titulo, "Lucas Queiroz quer passar um plantão para você");
});

test("o convite dirigido a OUTRA pessoa não é seu aviso", () => {
  // Sem esta regra, todo mundo do grupo receberia o convite que o Lucas
  // mandou só para o Matheus — e dois assumiriam o mesmo plantão.
  assert.deepEqual(montarAvisos(entrada({ trocas: [troca({ destinatario_id: MATHEUS })] })), []);
});

test("o seu próprio pedido não vira aviso para você", () => {
  // Ver o próprio anúncio na caixa é o contador pedindo uma ação que não é sua.
  assert.deepEqual(montarAvisos(entrada({ trocas: [troca({ solicitante_id: EU })] })), []);
});

test("quando alguém assume o seu plantão, você fica sabendo", () => {
  // Era o buraco: quem oferece e sai do sistema só descobria abrindo a escala.
  const [a] = montarAvisos(entrada({
    trocas: [troca({
      solicitante_id: EU, status: "aceita",
      respondido_por: MATHEUS, respondido_em: "2026-08-25T15:00:00Z",
    })],
  }));
  assert.equal(a.titulo, "Matheus Gomes assumiu seu plantão");
  // Notícia, não tarefa: não conta no número vermelho.
  assert.equal(a.acao, false);
});

test("recusa também avisa — o plantão volta a ser seu", () => {
  const [a] = montarAvisos(entrada({
    trocas: [troca({
      solicitante_id: EU, status: "recusada",
      respondido_por: MATHEUS, respondido_em: "2026-08-25T15:00:00Z",
    })],
  }));
  assert.equal(a.titulo, "Matheus Gomes não pôde assumir seu plantão");
});

test("notícia já vista some; tarefa pendente não some", () => {
  const resolvida = troca({
    id: "t-noticia", solicitante_id: EU, status: "aceita",
    respondido_por: MATHEUS, respondido_em: "2026-08-25T15:00:00Z",
  });
  const pendente = troca({ id: "t-tarefa", solicitante_id: LUCAS });

  const depoisDeVer = montarAvisos(entrada({
    trocas: [resolvida, pendente], vistoEm: "2026-08-25T16:00:00Z",
  }));
  // A notícia foi lida e saiu. A que espera resposta continua, porque abrir a
  // caixa não é responder — some quando você aceita ou recusa, e não antes.
  assert.deepEqual(depoisDeVer.map((a) => a.id), ["t-tarefa"]);
});

test("cancelada não avisa ninguém", () => {
  assert.deepEqual(montarAvisos(entrada({ trocas: [troca({ status: "cancelada" })] })), []);
  assert.deepEqual(montarAvisos(entrada({
    trocas: [troca({ solicitante_id: EU, status: "cancelada", respondido_em: "2026-08-25T15:00:00Z" })],
  })), []);
});

test("trinta mensagens novas são um aviso, não trinta", () => {
  const [a] = montarAvisos(entrada({ chat: { novas: 30, ultima: "2026-08-25T14:00:00Z" } }));
  assert.equal(a.titulo, "30 mensagens novas da equipe");
  assert.equal(a.acao, false);
  const [uma] = montarAvisos(entrada({ chat: { novas: 1, ultima: "2026-08-25T14:00:00Z" } }));
  assert.equal(uma.titulo, "Uma mensagem nova da equipe");
});

test("o suporte tem marcador próprio: abrir a caixa não é ler a resposta", () => {
  const chamado = {
    id: "c1", assunto: "Foto da ficha não lê", status: "respondido",
    ultima_em: "2026-08-25T10:00:00Z", visto_autor_em: null,
  };
  // Mesmo com a caixa já aberta depois da resposta, o chamado continua.
  const avisos = montarAvisos(entrada({ chamados: [chamado], vistoEm: "2026-08-25T23:00:00Z" }));
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].acao, true);

  // Some quando a CONVERSA é aberta, que é quando visto_autor_em é escrito.
  assert.deepEqual(montarAvisos(entrada({
    chamados: [{ ...chamado, visto_autor_em: "2026-08-25T11:00:00Z" }],
  })), []);
});

test("a ordem é do mais novo para o mais velho, misturando as origens", () => {
  const avisos = montarAvisos(entrada({
    trocas: [troca({ id: "velha", created_at: "2026-08-20T08:00:00Z" })],
    chat: { novas: 2, ultima: "2026-08-25T14:00:00Z" },
    chamados: [{
      id: "c1", assunto: "x", status: "respondido",
      ultima_em: "2026-08-23T09:00:00Z", visto_autor_em: null,
    }],
  }));
  assert.deepEqual(avisos.map((a) => a.id), ["chat", "c1", "velha"]);
});

test("o número vermelho conta só o que espera resposta sua", () => {
  const avisos = montarAvisos(entrada({
    trocas: [
      troca({ id: "pede" }),
      troca({
        id: "avisa", solicitante_id: EU, status: "aceita",
        respondido_por: MATHEUS, respondido_em: "2026-08-25T15:00:00Z",
      }),
    ],
    chat: { novas: 5, ultima: "2026-08-25T14:00:00Z" },
  }));
  assert.equal(avisos.length, 3);
  // Três coisas na lista, uma só pedindo resposta. Contar as três faria o
  // número não zerar depois de resolver o que dava para resolver.
  assert.equal(quantosPedemResposta(avisos), 1);
});

test("plantão que não veio junto não quebra o aviso", () => {
  // A escala carrega o mês aberto; uma troca de outubro aberta em agosto tem
  // id de plantão que não está no mapa. Sumir com o aviso seria pior.
  const [a] = montarAvisos(entrada({ trocas: [troca({ plantao_id: "nao-carregado" })] }));
  assert.equal(a.detalhe, "plantão");
});

test("meia-noite atravessada aparece com os minutos que existem", () => {
  const [a] = montarAvisos(entrada({ trocas: [troca({ plantao_id: "p2" })] }));
  assert.equal(a.detalhe, "30/09, 19h–07h30");
});

test("colega apagado do cadastro não vira aviso sem sujeito", () => {
  const [a] = montarAvisos(entrada({ trocas: [troca({ solicitante_id: "sumiu" })] }));
  assert.equal(a.titulo, "Um colega ofereceu um plantão ao grupo");
});

// ---------------------------------------------------------------------------
// Lembretes de dinheiro
// ---------------------------------------------------------------------------

const dinheiro = (data: string, situacao: string, valor: number) => ({ data, situacao, valor });
const so = (e: Partial<Parameters<typeof lembretesDoDinheiro>[0]>) =>
  lembretesDoDinheiro({ hoje: "2026-08-25", plantoes: [], producao: [], ...e });

test("paciente anotado e não cobrado em mês fechado vira lembrete", () => {
  // O caso que custa o valor inteiro: particular não deixa rastro no
  // faturamento do hospital, e ninguém nota que não entrou.
  const [a] = so({ producao: [
    dinheiro("2026-07-03", "a_cobrar", 800),
    dinheiro("2026-07-19", "a_cobrar", 450),
  ]});
  assert.equal(a.titulo, "2 pacientes de julho de 2026 sem cobrança");
  assert.match(a.detalhe, /1\.250,00/);
  assert.equal(a.acao, true);
  assert.equal(a.area, "producao");
});

test("o mês CORRENTE não é atraso — está acontecendo", () => {
  // Cobrar um paciente de anteontem não é dívida. Um lembrete que aparece no
  // dia seguinte ao ato ensina a pessoa a ignorar lembretes, e aí passa junto
  // o de julho, que era de verdade.
  assert.deepEqual(so({ producao: [dinheiro("2026-08-24", "a_cobrar", 800)] }), []);
  // Nem o futuro: plantão lançado para outubro não é conta atrasada.
  assert.deepEqual(so({ plantoes: [dinheiro("2026-10-10", "escalado", 1100)] }), []);
});

test("faturado e não recebido é outro lembrete, com outra frase", () => {
  // São ações diferentes: um pede emitir, o outro pede cobrar quem já recebeu
  // a guia. Juntar os dois num número só esconde qual é qual.
  const [a] = so({ producao: [dinheiro("2026-06-10", "faturado", 2000)] });
  assert.equal(a.tipo, "a_receber");
  assert.match(a.titulo, /faturados e não recebidos/);
  assert.match(a.detalhe, /1 paciente/);
});

test("glosado não vira lembrete de espera", () => {
  // Glosa não se espera, se recorre. Dizer "aguardando pagamento" sobre uma
  // glosa é mentir sobre o que está acontecendo.
  assert.deepEqual(so({ producao: [dinheiro("2026-06-10", "glosado", 2000)] }), []);
  assert.deepEqual(so({ producao: [dinheiro("2026-06-10", "recebido", 2000)] }), []);
});

test("plantão trabalhado e não pago aparece; cancelado não", () => {
  const [a] = so({ plantoes: [
    dinheiro("2026-07-05", "realizado", 1100),
    dinheiro("2026-07-06", "escalado", 1100),
    dinheiro("2026-07-07", "cancelado", 1100),
    dinheiro("2026-07-08", "pago", 1100),
  ]});
  assert.equal(a.titulo, "2 plantões de julho de 2026 sem receber");
  assert.match(a.detalhe, /2\.200,00/);
});

test("plantão sem valor combinado não é conta a receber", () => {
  // A escala do grupo é lançada pelo chefe com valor zero — quem recebe acerta
  // depois. Cobrar zero reais de alguém é lembrete que só atrapalha.
  assert.deepEqual(so({ plantoes: [dinheiro("2026-07-05", "realizado", 0)] }), []);
});

test("no máximo três meses, do mais recente para o mais antigo", () => {
  // Quem largou o faturamento por dois anos não precisa de vinte e quatro
  // linhas dizendo isso: precisa abrir a tela. Muro se ignora inteiro.
  const meses = ["2026-07","2026-06","2026-05","2026-04","2026-03","2025-12"];
  const avisos = so({ producao: meses.map((m) => dinheiro(`${m}-10`, "a_cobrar", 100)) });
  assert.equal(avisos.length, 3);
  assert.deepEqual(avisos.map((a) => a.id), ["faturar-2026-07", "faturar-2026-06", "faturar-2026-05"]);
});

test("um mês só, com as três coisas, dá três lembretes distintos", () => {
  const avisos = so({
    producao: [dinheiro("2026-07-01", "a_cobrar", 500), dinheiro("2026-07-02", "faturado", 900)],
    plantoes: [dinheiro("2026-07-03", "realizado", 1100)],
  });
  assert.deepEqual(avisos.map((a) => a.tipo).sort(),
    ["a_faturar", "a_receber", "plantao_a_receber"]);
  // Todos pedem ação: são três coisas para fazer, não três notícias.
  assert.equal(quantosPedemResposta(avisos), 3);
});

test("a virada do ano conta como mês fechado", () => {
  // Em janeiro, dezembro do ano passado é o mês fechado mais recente. Comparar
  // só o número do mês diria que 12 > 01 e esconderia o mês inteiro.
  const [a] = lembretesDoDinheiro({
    hoje: "2027-01-08", plantoes: [],
    producao: [dinheiro("2026-12-20", "a_cobrar", 700)],
  });
  assert.equal(a.titulo, "1 paciente de dezembro de 2026 sem cobrança");
});
