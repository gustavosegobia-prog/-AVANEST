import test from "node:test";
import assert from "node:assert/strict";
import {
  carimboICS, faixa, iniciais, montarICS, nomeCurto, periodoDoTurno,
  rotuloSituacao, somarHoras, textoICS, escaparHTML,
} from "./escala.ts";

// ---------------------------------------------------------------------------
// Como o plantão é falado
// ---------------------------------------------------------------------------
test("faixa: o horário como o plantonista fala", () => {
  assert.equal(faixa("07:00", "19:00"), "07-19h");
  assert.equal(faixa("19:00", "07:00"), "19-07h");
  assert.equal(faixa("07:00:00", "13:00:00"), "07-13h");
  assert.equal(faixa("13:00", "19:00"), "13-19h");
});

test("periodoDoTurno: 24h ganha do horário de início", () => {
  assert.equal(periodoDoTurno("07:00", 24), "24h");
  assert.equal(periodoDoTurno("07:00", 12), "Diurno");
  assert.equal(periodoDoTurno("13:00", 6), "Diurno");
  assert.equal(periodoDoTurno("19:00", 12), "Noturno");
  // Turno que começa de madrugada é noturno, e não diurno: quem entra às 01:00
  // está cobrindo a noite.
  assert.equal(periodoDoTurno("01:00", 6), "Noturno");
  assert.equal(periodoDoTurno("05:00", 6), "Diurno");
});

// ---------------------------------------------------------------------------
// Nomes
// ---------------------------------------------------------------------------
test("iniciais: partícula não vira inicial", () => {
  assert.equal(iniciais("GUSTAVO SEGOBIA DA SILVA"), "GS");
  assert.equal(iniciais("Ana de Souza"), "AS");
  assert.equal(iniciais("Maria Aparecida dos Santos"), "MS");
  assert.equal(iniciais("Marcos"), "M");
  assert.equal(iniciais(""), "?");
});

test("iniciais: o tratamento não é nome", () => {
  // O caso que apareceu em produção: "Dr. Gustavo Segobia" saía "DS", e todo
  // médico cadastrado com Dr. na frente começava pela mesma letra — a cor e a
  // sigla deixavam de distinguir quem estava de plantão.
  assert.equal(iniciais("Dr. Gustavo Segobia"), "GS");
  assert.equal(iniciais("DR GUSTAVO SEGOBIA DA SILVA"), "GS");
  assert.equal(iniciais("Dra. Ana Paula de Souza"), "AS");
  assert.equal(iniciais("Profa. Carla Nogueira"), "CN");
  // Só na frente: "Souza Dias" é sobrenome, não tratamento.
  assert.equal(iniciais("Fernando Souza Dias"), "FD");
});

test("iniciais: sobrenome de duas letras continua contando", () => {
  // Um filtro por comprimento derrubava "Sá" junto com "de" e devolvia "JJ".
  assert.equal(iniciais("José de Sá"), "JS");
  assert.equal(iniciais("Ana Ré"), "AR");
});

test("iniciais: cadastro só com o tratamento não deixa a célula vazia", () => {
  assert.equal(iniciais("Dr."), "D");
  assert.equal(iniciais("   "), "?");
});

test("nomeCurto: primeiro nome e último sobrenome, capitalizados", () => {
  assert.equal(nomeCurto("GUSTAVO SEGOBIA DA SILVA"), "Gustavo Silva");
  assert.equal(nomeCurto("ana de souza"), "Ana Souza");
  assert.equal(nomeCurto("Dr. Gustavo Segobia"), "Gustavo Segobia");
  assert.equal(nomeCurto("José de Sá"), "José Sá");
  assert.equal(nomeCurto("Marcos"), "Marcos");
  assert.equal(nomeCurto("   "), "—");
});

test("rotuloSituacao devolve o código quando não conhece", () => {
  assert.equal(rotuloSituacao("pago"), "Pago");
  assert.equal(rotuloSituacao("inventado"), "inventado");
});

// ---------------------------------------------------------------------------
// Horas
// ---------------------------------------------------------------------------
test("somarHoras vira a meia-noite", () => {
  assert.equal(somarHoras("07:00", 12), "19:00");
  assert.equal(somarHoras("19:00", 12), "07:00");
  assert.equal(somarHoras("19:00", 24), "19:00");
  assert.equal(somarHoras("07:30", 6), "13:30");
});

// ---------------------------------------------------------------------------
// O arquivo que vai para o celular
// ---------------------------------------------------------------------------
test("carimboICS não escorrega de dia", () => {
  // O erro clássico é montar por toISOString: no fuso do Brasil a meia-noite
  // local do dia 24 é 03:00Z do dia 24, mas a de 01/01 às 00:00 vira 31/12 —
  // e o plantão de ano novo apareceria no ano anterior.
  assert.equal(carimboICS("2026-08-24", "07:00"), "20260824T070000");
  assert.equal(carimboICS("2026-01-01", "07:00"), "20260101T070000");
  assert.equal(carimboICS("2026-12-31", "19:00"), "20261231T190000");
});

test("carimboICS soma o dia quando o turno vira a noite", () => {
  assert.equal(carimboICS("2026-08-24", "07:00", true), "20260825T070000");
  // Virada de mês e de ano.
  assert.equal(carimboICS("2026-08-31", "07:00", true), "20260901T070000");
  assert.equal(carimboICS("2026-12-31", "07:00", true), "20270101T070000");
  // Ano bissexto: 28/02/2028 + 1 é 29, e não 01/03.
  assert.equal(carimboICS("2028-02-28", "07:00", true), "20280229T070000");
});

test("textoICS escapa os separadores do formato", () => {
  assert.equal(textoICS("Plantão, diurno"), "Plantão\\, diurno");
  assert.equal(textoICS("Hospital; Bloco A"), "Hospital\\; Bloco A");
  assert.equal(textoICS("a\\b"), "a\\\\b");
  assert.equal(textoICS("linha1\nlinha2"), "linha1\\nlinha2");
});

const agora = new Date("2026-08-24T12:00:00Z");

test("montarICS: plantão diurno começa e termina no mesmo dia", () => {
  const ics = montarICS([{
    id: "abc", data: "2026-08-24", hora_inicio: "07:00", hora_fim: "19:00",
    titulo: "Plantão", onde: "Santa Casa",
  }], agora);
  assert.match(ics, /DTSTART:20260824T070000\r\n/);
  assert.match(ics, /DTEND:20260824T190000\r\n/);
  assert.match(ics, /LOCATION:Santa Casa\r\n/);
  assert.match(ics, /UID:abc@avanest\r\n/);
});

test("montarICS: plantão noturno termina no dia seguinte", () => {
  const ics = montarICS([{
    id: "n1", data: "2026-08-24", hora_inicio: "19:00", hora_fim: "07:00",
    titulo: "Plantão", onde: "",
  }], agora);
  assert.match(ics, /DTSTART:20260824T190000/);
  assert.match(ics, /DTEND:20260825T070000/);
  // Sem local, a linha não existe — LOCATION vazio faz o Google mostrar um
  // endereço em branco no evento.
  assert.doesNotMatch(ics, /LOCATION:/);
});

test("montarICS: plantão de 24h termina no dia seguinte, e não em duração zero", () => {
  const ics = montarICS([{
    id: "d1", data: "2026-08-24", hora_inicio: "07:00", hora_fim: "07:00",
    titulo: "Plantão", onde: "",
  }], agora);
  assert.match(ics, /DTSTART:20260824T070000/);
  assert.match(ics, /DTEND:20260825T070000/);
});

test("montarICS: quebra de linha é CRLF em todas as linhas", () => {
  const ics = montarICS([{
    id: "x", data: "2026-08-24", hora_inicio: "07:00", hora_fim: "19:00",
    titulo: "Plantão", onde: "A",
  }], agora);
  // Nenhum \n solto: o Calendário do iOS recusa o arquivo inteiro.
  assert.equal(ics.replace(/\r\n/g, "").includes("\n"), false);
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("montarICS: calendário vazio continua sendo um arquivo válido", () => {
  const ics = montarICS([], agora);
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.doesNotMatch(ics, /BEGIN:VEVENT/);
});

test("montarICS: um VEVENT por plantão", () => {
  const ics = montarICS([
    { id: "1", data: "2026-08-24", hora_inicio: "07:00", hora_fim: "19:00", titulo: "A", onde: "" },
    { id: "2", data: "2026-08-25", hora_inicio: "07:00", hora_fim: "19:00", titulo: "B", onde: "" },
    { id: "3", data: "2026-08-26", hora_inicio: "19:00", hora_fim: "07:00", titulo: "C", onde: "" },
  ], agora);
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 3);
  assert.equal(ics.match(/END:VEVENT/g)?.length, 3);
});

test("montarICS: nome com vírgula não parte o SUMMARY em dois campos", () => {
  const ics = montarICS([{
    id: "v", data: "2026-08-24", hora_inicio: "07:00", hora_fim: "19:00",
    titulo: "Plantão · Silva, Gustavo", onde: "Hospital; Central",
  }], agora);
  assert.match(ics, /SUMMARY:Plantão · Silva\\, Gustavo\r\n/);
  assert.match(ics, /LOCATION:Hospital\\; Central\r\n/);
});

// ---------------------------------------------------------------------------
// A folha impressa
// ---------------------------------------------------------------------------
test("escaparHTML fecha a porta de injeção na folha impressa", () => {
  // O nome do local vem do cadastro e é digitado por gente: sem escapar, um
  // "<script>" salvo como nome de hospital rodaria na janela de impressão.
  assert.equal(escaparHTML('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert.equal(escaparHTML("Santa Casa & Maternidade"), "Santa Casa &amp; Maternidade");
  assert.equal(escaparHTML(""), "");
});
