import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chaveDoAviso, type Aviso } from "./avisos.ts";
import {
  DIAS_DE_SILENCIO, TETO_POR_PESSOA, dentroDoHorario, destinoDoAviso,
  horaEmSaoPaulo, notificacaoDoAviso, paraNotificar,
} from "./aviso-no-telefone.ts";

const aviso = (extra: Partial<Aviso> = {}): Aviso => ({
  id: "plantao-2026-07", tipo: "plantao_a_receber", area: "plantoes", acao: true,
  quando: "2026-07-26T12:00:00Z",
  titulo: "9 plantões de julho de 2026 sem receber",
  detalhe: "R$ 15.300,00 combinados",
  ...extra,
});

const AGORA = new Date("2026-09-09T22:00:00Z"); // 19h em São Paulo
const dias = (n: number) => new Date(AGORA.getTime() - n * 86400_000).toISOString();

test("o que já tem caminho próprio até o telefone não sai no lembrete", () => {
  // Troca de plantão e escala publicada saem no instante em que acontecem,
  // pela rota `avisar`. Repetir aqui faria a mesma notícia tocar duas vezes —
  // uma na hora e outra à noite. Chat é pior ainda: mensagem de equipe que
  // chega doze horas depois não é aviso, é arqueologia.
  const escolhidos = paraNotificar({
    avisos: [
      aviso({ tipo: "troca_pedida", id: "t1" }),
      aviso({ tipo: "troca_resolvida", id: "t2" }),
      aviso({ tipo: "escala_publicada", id: "e1" }),
      aviso({ tipo: "chat", id: "chat" }),
      aviso(),
    ],
    enviados: new Map(), agora: AGORA,
  });
  assert.deepEqual(escolhidos.map((a) => a.tipo), ["plantao_a_receber"]);
});

test("o mesmo lembrete não toca todo dia", () => {
  // A pendência não some sozinha: "9 plantões de julho sem receber" continua
  // verdade amanhã. Sem esta trava o telefone repetiria a frase até a pessoa
  // desligar as notificações — e aí perderia junto o pedido de troca.
  const a = aviso();
  const recente = new Map([[chaveDoAviso(a), dias(DIAS_DE_SILENCIO - 1)]]);
  assert.equal(paraNotificar({ avisos: [a], enviados: recente, agora: AGORA }).length, 0);

  const vencido = new Map([[chaveDoAviso(a), dias(DIAS_DE_SILENCIO + 1)]]);
  assert.equal(paraNotificar({ avisos: [a], enviados: vencido, agora: AGORA }).length, 1);
});

test("o que nunca tocou toca", () => {
  assert.equal(paraNotificar({ avisos: [aviso()], enviados: new Map(), agora: AGORA }).length, 1);
});

test("no máximo três de uma vez, e o que pede resposta na frente", () => {
  // Cinco notificações ao mesmo tempo não são cinco avisos: são uma parede, e
  // parede se ignora inteira.
  const escolhidos = paraNotificar({
    avisos: [
      aviso({ id: "f1", tipo: "a_faturar", area: "producao", acao: true, quando: "2026-06-28T12:00:00Z" }),
      aviso({ id: "f2", tipo: "a_faturar", area: "producao", acao: true, quando: "2026-07-28T12:00:00Z" }),
      aviso({ id: "r1", tipo: "a_receber", area: "producao", acao: true, quando: "2026-08-27T12:00:00Z" }),
      aviso({ id: "s1", tipo: "suporte", area: "suporte", acao: true, quando: "2026-09-09T10:00:00Z" }),
    ],
    enviados: new Map(), agora: AGORA,
  });
  assert.equal(escolhidos.length, TETO_POR_PESSOA);
  // Do mais recente para o mais antigo, dentro dos que pedem resposta.
  assert.deepEqual(escolhidos.map((a) => a.id), ["s1", "r1", "f2"]);
});

test("o que ficou de fora do teto não é marcado, e desce na próxima", () => {
  // É o que transforma um balde de uma vez num pingo por dia: as três de hoje
  // ficam caladas por sete dias, e amanhã sobem as que não couberam.
  const todos = [
    aviso({ id: "a", quando: "2026-09-01T12:00:00Z" }),
    aviso({ id: "b", quando: "2026-08-01T12:00:00Z" }),
    aviso({ id: "c", quando: "2026-07-01T12:00:00Z" }),
    aviso({ id: "d", quando: "2026-06-01T12:00:00Z" }),
  ];
  const hoje = paraNotificar({ avisos: todos, enviados: new Map(), agora: AGORA });
  const recibos = new Map(hoje.map((a) => [chaveDoAviso(a), AGORA.toISOString()]));
  const amanha = paraNotificar({
    avisos: todos, enviados: recibos,
    agora: new Date(AGORA.getTime() + 86400_000),
  });
  assert.deepEqual(amanha.map((a) => a.id), ["d"]);
});

test("o texto do telefone é o mesmo do sino, palavra por palavra", () => {
  // Quem recebe "9 plantões de julho de 2026 sem receber" e abre o sistema tem
  // de encontrar aquela frase. Reescrever aqui criaria duas versões do mesmo
  // aviso, e a pessoa procuraria no sino um aviso que não existe com aquele nome.
  const a = aviso();
  const n = notificacaoDoAviso(a);
  assert.equal(n.titulo, a.titulo);
  assert.equal(n.corpo, a.detalhe);
});

test("a etiqueta da notificação é a chave do adiar", () => {
  // Duas coisas de uma vez: a notificação de hoje SUBSTITUI a da semana
  // passada em vez de empilhar, e o recibo guardado casa com o adiamento —
  // adiar no sino cala o telefone também.
  const a = aviso();
  assert.equal(notificacaoDoAviso(a).tag, chaveDoAviso(a));
  assert.equal(notificacaoDoAviso(a).tag, "plantao_a_receber:plantao-2026-07");
});

test("o lembrete de dinheiro abre direto na aba Produção", () => {
  // É onde se marca faturado e recebido. Cair no calendário obrigaria a
  // procurar a aba — e aviso que dá trabalho fica para depois.
  assert.equal(destinoDoAviso(aviso({ area: "producao" })),
    "/dashboard?area=plantoes&aba=producao");
  assert.equal(destinoDoAviso(aviso({ area: "plantoes" })), "/dashboard?area=plantoes");
});

test("o telefone não toca de madrugada", () => {
  // Nenhum destes lembretes vale uma tela acesa às três da manhã.
  assert.equal(horaEmSaoPaulo(new Date("2026-09-09T22:00:00Z")), 19);
  assert.equal(dentroDoHorario(new Date("2026-09-09T22:00:00Z")), true);
  assert.equal(dentroDoHorario(new Date("2026-09-09T06:00:00Z")), false); // 03h
  assert.equal(dentroDoHorario(new Date("2026-09-10T01:00:00Z")), false); // 22h
  assert.equal(dentroDoHorario(new Date("2026-09-09T11:00:00Z")), true);  // 08h
});

// ---------------------------------------------------------------------------
// A rota e o agendador
// ---------------------------------------------------------------------------

const rota = fs.readFileSync(new URL("../app/api/push/lembretes/route.ts", import.meta.url), "utf8");

test("a rota do lembrete não roda sem segredo", () => {
  // Ela lê o plantão e a produção de todo mundo com a chave de serviço, fora do
  // RLS. Aberta, seria um botão para tocar o telefone de toda a base.
  assert.match(rota, /process\.env\.CRON_SECRET/);
  assert.match(rota, /if \(!segredo\)/, "sem segredo configurado, tem de recusar");
  assert.match(rota, /Bearer \$\{segredo\}/);
});

test("o adiar do sino vale para o telefone", () => {
  // Um adiar que silencia a tela e não silencia o telefone é um botão que mente.
  assert.match(rota, /semOsAdiados\(/);
});

test("o recibo só é gravado quando algum aparelho aceitou", () => {
  // Carimbar um envio que falhou calaria o aviso por sete dias sem ele nunca
  // ter tocado — e o defeito seria invisível, porque a tabela diria entregue.
  assert.match(rota, /if \(idas\.some\(Boolean\)\) \{/);
});

test("o agendador aponta para a rota que existe", () => {
  const vercel = JSON.parse(
    fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  ) as { crons: { path: string; schedule: string }[] };
  const cron = vercel.crons.find((c) => c.path === "/api/push/lembretes");
  assert.ok(cron, "o cron do lembrete sumiu do vercel.json");
  // A hora do agendador é UTC. 22:00 UTC são 19:00 em São Paulo — dentro da
  // janela que a própria rota confere, e no fim do dia de trabalho, quando
  // "confirme o plantão de hoje" ainda dá tempo de ser atendido.
  const [minuto, hora] = cron!.schedule.split(" ");
  const emSaoPaulo = horaEmSaoPaulo(new Date(`2026-09-09T${hora.padStart(2, "0")}:${minuto.padStart(2, "0")}:00Z`));
  assert.ok(emSaoPaulo >= 8 && emSaoPaulo < 21,
    `o cron dispara às ${emSaoPaulo}h em São Paulo, fora da janela da rota`);
});
