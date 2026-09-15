import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CORTE_DO_DIA, chaveDoLembrete, destinoDoLembrete, deveAvisar, diaEscrito,
  horaFalada, momentoDoLembrete, textoDoLembrete, type PlantaoParaLembrar,
} from "./lembrete-de-plantao.ts";

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const plantao = (extra: Partial<PlantaoParaLembrar> = {}): PlantaoParaLembrar => ({
  id: "p1", data: "2026-09-17", hora_inicio: "19:00", hora_fim: "07:00",
  situacao: "escalado", local: "Santa Casa", ...extra,
});

test("o plantão da noite avisa às 7h do mesmo dia", () => {
  assert.equal(momentoDoLembrete(plantao({ hora_inicio: "19:00" })), "2026-09-17T07:00");
});

test("o plantão da manhã avisa às 19h da véspera", () => {
  // A tempo de dormir cedo e deixar o alarme pronto. Avisar o plantão da manhã
  // às 7h da manhã seria avisar com a pessoa já atrasada.
  assert.equal(momentoDoLembrete(plantao({ hora_inicio: "07:00" })), "2026-09-16T19:00");
});

test("o corte é ao meio-dia, e não às 19h exatas", () => {
  // A escala real tem plantão de 13h, de 18h e de 22h, e todos são turno da
  // tarde ou da noite para quem vai trabalhar. Fixar a regra em "19:00" deixaria
  // o plantão das 22h sem lembrete nenhum.
  assert.equal(CORTE_DO_DIA, 12);
  for (const hora of ["13:00", "18:00", "22:00"]) {
    assert.equal(momentoDoLembrete(plantao({ hora_inicio: hora })), "2026-09-17T07:00",
      `${hora} devia ser avisado na manhã do próprio dia`);
  }
  for (const hora of ["06:00", "08:00", "11:30"]) {
    assert.equal(momentoDoLembrete(plantao({ hora_inicio: hora })), "2026-09-16T19:00",
      `${hora} devia ser avisado na véspera`);
  }
});

test("o meio-dia em ponto conta como tarde", () => {
  assert.equal(momentoDoLembrete(plantao({ hora_inicio: "12:00" })), "2026-09-17T07:00");
  assert.equal(momentoDoLembrete(plantao({ hora_inicio: "11:59" })), "2026-09-16T19:00");
});

test("a véspera atravessa a virada do mês e do ano", () => {
  // `somarDias` monta a data ao meio-dia em UTC justamente para isso. Um "-1"
  // feito na mão em cima de string devolveria "2026-09-00".
  assert.equal(momentoDoLembrete(plantao({ data: "2026-09-01", hora_inicio: "07:00" })),
    "2026-08-31T19:00");
  assert.equal(momentoDoLembrete(plantao({ data: "2027-01-01", hora_inicio: "07:00" })),
    "2026-12-31T19:00");
  assert.equal(momentoDoLembrete(plantao({ data: "2028-03-01", hora_inicio: "07:00" })),
    "2028-02-29T19:00");
});

test("sem data ou sem hora, não se inventa um horário", () => {
  // Chutar produziria um telefone tocando na hora errada por um cadastro
  // incompleto — e ninguém ligaria uma coisa à outra.
  assert.equal(momentoDoLembrete(plantao({ hora_inicio: null })), "");
  assert.equal(momentoDoLembrete(plantao({ data: "" })), "");
  assert.equal(deveAvisar(plantao({ hora_inicio: null }), "2026-09-17T07:00"), false);
});

test("avisa a partir da hora marcada, e não só nela", () => {
  // É uma JANELA de propósito: se a execução das 7h falhar ou atrasar — e ela
  // vai falhar algum dia —, a das 8h ainda entrega. Lembrete que chega uma hora
  // atrasado serve; lembrete que não chega, não.
  const p = plantao({ hora_inicio: "19:00" });
  assert.equal(deveAvisar(p, "2026-09-17T06:59"), false, "antes da hora, não");
  assert.equal(deveAvisar(p, "2026-09-17T07:00"), true);
  assert.equal(deveAvisar(p, "2026-09-17T11:00"), true, "a execução das 11h ainda salva o aviso");
});

test("a janela fecha quando o plantão começa", () => {
  // "Você tem plantão hoje às 19h" chegando às 20h é pior do que silêncio: quem
  // está lá dentro trabalhando não precisa ser lembrado, e quem não está já
  // perdeu.
  const p = plantao({ hora_inicio: "19:00" });
  assert.equal(deveAvisar(p, "2026-09-17T18:59"), true);
  assert.equal(deveAvisar(p, "2026-09-17T19:00"), false);
  assert.equal(deveAvisar(p, "2026-09-18T03:00"), false);
});

test("plantão cancelado não avisa", () => {
  // E é o CANCELAMENTO que apaga o lembrete, sem precisar cancelar nada: o
  // lembrete é calculado na hora do envio, a partir da escala como ela está.
  assert.equal(deveAvisar(plantao({ situacao: "cancelado" }), "2026-09-17T07:00"), false);
});

test("plantão lançado depois da hora do aviso ainda avisa", () => {
  // Alguém entra na escala às 10h para cobrir a noite de hoje. A hora marcada
  // (7h) já passou, mas o plantão ainda não começou — e essa é exatamente a
  // pessoa que mais precisa do aviso.
  assert.equal(deveAvisar(plantao({ hora_inicio: "19:00" }), "2026-09-17T10:30"), true);
});

test("plantão de semana que vem fica quieto", () => {
  assert.equal(deveAvisar(plantao({ data: "2026-09-25" }), "2026-09-17T07:00"), false);
});

test("o hospital vai no título, porque é a linha que não some", () => {
  // Quem cobre três casas na mesma semana precisa saber QUAL antes de qualquer
  // outra coisa. E o corpo não repete o nome: gastaria metade da segunda linha
  // dizendo de novo o que a primeira já disse.
  const { titulo, corpo } = textoDoLembrete(plantao(), "2026-09-17");
  assert.equal(titulo, "🏥 Plantão hoje — Santa Casa");
  assert.equal(corpo, "Quinta, 17/09, às 19h. Toque para ver os detalhes.");
  assert.doesNotMatch(corpo, /Santa Casa/);
});

test("o aviso da véspera diz amanhã", () => {
  const { titulo, corpo } = textoDoLembrete(
    plantao({ data: "2026-09-18", hora_inicio: "07:00" }), "2026-09-17");
  assert.equal(titulo, "🏥 Plantão amanhã — Santa Casa");
  assert.match(corpo, /Sexta, 18\/09, às 7h/);
});

test("hoje e amanhã saem da data de hoje, não da hora marcada", () => {
  // Com a janela de atraso, o aviso do plantão da manhã pode sair às 6h do
  // próprio dia — e ali "amanhã" seria mentira na tela de quem está acordando
  // para trabalhar.
  const p = plantao({ data: "2026-09-18", hora_inicio: "07:00" });
  assert.match(textoDoLembrete(p, "2026-09-18").titulo, /Plantão hoje/);
  assert.match(textoDoLembrete(p, "2026-09-17").titulo, /Plantão amanhã/);
});

test("sem hospital cadastrado, o aviso sai mesmo assim", () => {
  // Plantão com local em branco existe, e um lembrete a menos é pior do que um
  // lembrete sem o nome da casa.
  const { titulo } = textoDoLembrete(plantao({ local: null }), "2026-09-17");
  assert.equal(titulo, "🏥 Plantão hoje");
});

test("hospital e data e horário: os três aparecem", () => {
  // É a exigência escrita do pedido, e ela é conferida junta de propósito.
  const { titulo, corpo } = textoDoLembrete(
    plantao({ local: "Hospital Memorial", hora_inicio: "19:30" }), "2026-09-17");
  const tudo = `${titulo} ${corpo}`;
  assert.match(tudo, /Hospital Memorial/);
  assert.match(tudo, /17\/09/);
  assert.match(tudo, /19h30/);
});

test("a hora é dita como se fala", () => {
  assert.equal(horaFalada("19:00"), "19h");
  assert.equal(horaFalada("07:00"), "7h");
  assert.equal(horaFalada("07:30"), "7h30");
  assert.equal(horaFalada(null), "");
});

test("o dia da semana não escorrega um para trás", () => {
  // `new Date("2026-09-17")` já é meia-noite UTC; lida no fuso de São Paulo, ela
  // é 21h do dia 16 — e a notificação diria "Terça" num plantão de quarta.
  assert.equal(diaEscrito("2026-09-17"), "Quinta, 17/09");
  assert.equal(diaEscrito("2026-01-01"), "Quinta, 01/01");
});

test("cada plantão tem a sua chave, e é ela que impede a repetição", () => {
  // Dois plantões no mesmo dia em hospitais diferentes são dois avisos, cada um
  // com o seu nome — e nenhum substitui o outro na tela.
  assert.equal(chaveDoLembrete(plantao({ id: "abc" })), "plantao-lembrete-abc");
  assert.notEqual(chaveDoLembrete(plantao({ id: "a" })), chaveDoLembrete(plantao({ id: "b" })));
});

test("o toque abre o plantão, e não a escala do mês", () => {
  assert.equal(destinoDoLembrete(plantao({ id: "abc" })),
    "/dashboard?area=plantoes&plantao=abc");
});

test("nada é agendado, e é isso que dispensa cancelar", () => {
  // O caminho óbvio — criar um lembrete agendado e cancelá-lo a cada mudança —
  // transforma cada alteração numa chance de o cancelamento falhar, e a falha
  // aparece como um telefone tocando às 7h por um plantão repassado há duas
  // semanas. Aqui o lembrete é calculado na hora do envio a partir da escala
  // viva: não existe lembrete velho para cancelar.
  const fonte = ler("lib/lembrete-de-plantao.ts");
  assert.match(fonte, /CALCULADO NA HORA DO ENVIO/);
  // A prova de que é assim: a decisão inteira cabe numa função pura que recebe
  // o plantão e o relógio, e não consulta nem grava nada.
  assert.equal(deveAvisar(plantao({ situacao: "cancelado" }), "2026-09-17T08:00"), false);
  assert.equal(deveAvisar(plantao(), "2026-09-17T08:00"), true);
});
