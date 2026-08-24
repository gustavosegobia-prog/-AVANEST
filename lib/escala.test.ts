import test from "node:test";
import assert from "node:assert/strict";
import type { PlantaoImpresso } from "./escala.ts";
import {
  carimboICS, corpoDaFolha, filtroDeHospital, escaparHTML, faixa, folhaDeProducao, iniciais, montarICS,
  nomeCurto, periodoDoTurno, plural, rotuloSituacao, somarHoras, textoICS,
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

// ---------------------------------------------------------------------------
// A folha de produção
// ---------------------------------------------------------------------------
const producao = [
  { data: "2026-08-03", paciente: "Maria Aparecida", convenio: "Unimed",
    procedimento: "Colecistectomia", valor: 1240, situacao: "recebido" },
  { data: "2026-08-01", paciente: "João Batista", convenio: "Unimed",
    procedimento: "Hérnia inguinal", valor: 980, situacao: "a_cobrar" },
  { data: "2026-08-05", paciente: "Ana Lúcia", convenio: "Particular",
    procedimento: null, valor: 2000, situacao: "faturado" },
];

test("folhaDeProducao agrupa por convênio e ordena por data dentro do grupo", () => {
  const { corpo } = folhaDeProducao(producao, "agosto", 2026, new Date("2026-08-24T12:00:00"));
  // Particular vem antes de Unimed em ordem alfabética.
  assert.ok(corpo.indexOf("Particular") < corpo.indexOf("Unimed"));
  // Dentro da Unimed, dia 1 antes do dia 3 — a lista chegou fora de ordem.
  assert.ok(corpo.indexOf("João Batista") < corpo.indexOf("Maria Aparecida"));
});

test("folhaDeProducao soma por convênio e no rodapé", () => {
  const { corpo } = folhaDeProducao(producao, "agosto", 2026, new Date("2026-08-24T12:00:00"));
  assert.match(corpo, /2 pacientes/);                    // Unimed
  assert.match(corpo, /1 paciente\b/);                   // Particular, no singular
  assert.match(corpo, /3 pacientes/);                    // rodapé
  // 1240 + 980 + 2000 = 4220; recebido 1240; a receber 2980.
  assert.ok(corpo.includes("4.220,00"));
  assert.ok(corpo.includes("2.980,00"));
});

test("folhaDeProducao: procedimento em branco vira travessão, não vazio", () => {
  const { corpo } = folhaDeProducao(producao, "agosto", 2026, new Date("2026-08-24T12:00:00"));
  assert.match(corpo, /<td>—<\/td>/);
});

test("folhaDeProducao: convênio em branco cai em Particular", () => {
  const { corpo } = folhaDeProducao(
    [{ data: "2026-08-01", paciente: "X", convenio: "  ", procedimento: null,
       valor: 100, situacao: "a_cobrar" }],
    "agosto", 2026, new Date("2026-08-24T12:00:00"));
  assert.match(corpo, /Particular/);
});

test("folhaDeProducao: mês sem nada continua sendo uma folha válida", () => {
  const { titulo, corpo } = folhaDeProducao([], "agosto", 2026, new Date("2026-08-24T12:00:00"));
  assert.equal(titulo, "Produção — agosto de 2026");
  assert.match(corpo, /Nada anotado neste mês/);
  assert.match(corpo, /0 pacientes/);
});

test("folhaDeProducao escapa o nome do paciente", () => {
  const { corpo } = folhaDeProducao(
    [{ data: "2026-08-01", paciente: '<b>Ana</b> & "cia"', convenio: "Particular",
       procedimento: null, valor: 0, situacao: "a_cobrar" }],
    "agosto", 2026, new Date("2026-08-24T12:00:00"));
  assert.match(corpo, /&lt;b&gt;Ana&lt;\/b&gt; &amp; &quot;cia&quot;/);
});

test("plural: singular e plural", () => {
  assert.equal(plural(0, "paciente", "pacientes"), "0 pacientes");
  assert.equal(plural(1, "paciente", "pacientes"), "1 paciente");
  assert.equal(plural(2, "paciente", "pacientes"), "2 pacientes");
});

// ---------------------------------------------------------------------------
// Um grupo, vários hospitais
//
// Um grupo de anestesia cobre mais de uma instituição ao mesmo tempo. O turno
// das 07h da Santa Casa e o das 07h do Hospital da Unimed são escalas de
// serviços diferentes, com equipes diferentes — e caíam na mesma linha.
// ---------------------------------------------------------------------------

const turno = (local: string, profissional: string, hora_inicio = "07:00"): PlantaoImpresso => ({
  data: "2026-08-03", hora_inicio, hora_fim: "19:00", horas: 12,
  valor: 0, situacao: "escalado", local, profissional,
});

const folhaDoGrupo = (plantoes: PlantaoImpresso[]) => corpoDaFolha({
  doGrupo: true, mes: "2026-08", nomeMes: "agosto", ano: 2026,
  diasNoMes: 31, primeiroDiaSemana: 6, plantoes,
  impressoEm: new Date("2026-08-24T12:00:00"),
});

test("hospitais diferentes no mesmo horário não viram um turno só", () => {
  const { corpo } = folhaDoGrupo([
    turno("Santa Casa", "GUSTAVO SEGOBIA DA SILVA"),
    turno("Hospital da Unimed", "ANA PAULA DE SOUZA"),
  ]);
  // Duas etiquetas, e não uma com os dois nomes dentro.
  assert.equal(corpo.match(/<span class="t">/g)?.length, 2);
  assert.match(corpo, /07-19h · Santa Casa/);
  assert.match(corpo, /07-19h · Hospital da Unimed/);
  assert.doesNotMatch(corpo, /Gustavo Silva, Ana Souza/);
});

test("mesmo hospital e mesmo horário continuam juntos", () => {
  const { corpo } = folhaDoGrupo([
    turno("Santa Casa", "GUSTAVO SEGOBIA DA SILVA"),
    turno("Santa Casa", "ANA PAULA DE SOUZA"),
  ]);
  assert.equal(corpo.match(/<span class="t">/g)?.length, 1);
  assert.match(corpo, /Gustavo Silva, Ana Souza/);
});

test("folha de um hospital só leva o nome dele no título e não o repete nas células", () => {
  const { titulo, corpo } = folhaDoGrupo([
    turno("Santa Casa", "GUSTAVO SEGOBIA DA SILVA"),
    turno("Santa Casa", "ANA PAULA DE SOUZA", "19:00"),
  ]);
  assert.equal(titulo, "Escala da equipe — Santa Casa — agosto de 2026");
  // O nome não se repete em cada célula: numa folha de um hospital só, seria a
  // mesma palavra trinta e uma vezes.
  assert.doesNotMatch(corpo, /07-19h · Santa Casa/);
});

test("folha com vários hospitais não nomeia nenhum no título", () => {
  const { titulo } = folhaDoGrupo([
    turno("Santa Casa", "GUSTAVO SEGOBIA DA SILVA"),
    turno("Hospital da Unimed", "ANA PAULA DE SOUZA"),
  ]);
  assert.equal(titulo, "Escala da equipe — agosto de 2026");
});

// ---------------------------------------------------------------------------
// O filtro de hospital não pode esconder a escala
//
// Defeito real: a escala do grupo abria filtrada no hospital onde a pessoa
// estava atendendo, e a barra para trocar só aparecia havendo mais de um
// hospital com plantão. Quando o hospital ativo não tinha turno — ou os
// plantões estavam lançados sem local —, o calendário vinha vazio e não havia
// botão nenhum para desfazer.
// ---------------------------------------------------------------------------

test("filtro num hospital que tem plantão vale", () => {
  assert.equal(filtroDeHospital("sc", ["sc", "un"]), "sc");
});

test("filtro num hospital sem plantão nenhum não vale", () => {
  // Era este o caso: local ativo é a clínica, mas os plantões do mês são todos
  // no hospital. Filtrar esvaziaria a tela sem oferecer saída.
  assert.equal(filtroDeHospital("clinica", ["sc", "un"]), "todos");
});

test("plantões lançados sem local nenhum não somem", () => {
  // Nenhum hospital tem plantão porque nenhum plantão tem hospital. Filtrar
  // por qualquer coisa esconderia o mês inteiro.
  assert.equal(filtroDeHospital("sc", []), "todos");
});

test('"todos" continua sendo "todos"', () => {
  assert.equal(filtroDeHospital("todos", ["sc"]), "todos");
  assert.equal(filtroDeHospital("todos", []), "todos");
});
