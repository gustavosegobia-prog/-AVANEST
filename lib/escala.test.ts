import test from "node:test";
import assert from "node:assert/strict";
import type { PlantaoDoFechamento, PlantaoImpresso } from "./escala.ts";
import {
  apelidosDaEquipe, carimboICS, TURNOS_RAPIDOS, corpoDaFolha, timbreDaFolha, folhaDeFechamento, money, podeConfirmar, filtroDeHospital, plantaoNaEscala, escaparHTML, faixa, folhaDeProducao, iniciais, montarICS,
  nomeCurto, nomeDoPeriodo, ondeFica, plural, rotuloSituacao, somarHoras, textoICS, turnosCobertos,
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

test("turnosCobertos: o plantão aparece em todo turno em que ele está", () => {
  // O 12h de dia cobre manhã e tarde. Se ele só constasse na manhã, a tarde
  // apareceria descoberta numa escala que existe para achar buraco.
  assert.deepEqual(turnosCobertos("07:00", "19:00"), ["manha", "tarde"]);
  assert.deepEqual(turnosCobertos("07:00", "13:00"), ["manha"]);
  assert.deepEqual(turnosCobertos("13:00", "19:00"), ["tarde"]);
  assert.deepEqual(turnosCobertos("19:00", "07:00"), ["noite"]);
  // 24h: fim igual ao início, e cobre os três.
  assert.deepEqual(turnosCobertos("07:00", "07:00"), ["manha", "tarde", "noite"]);
  assert.deepEqual(turnosCobertos("20:00", "20:00"), ["manha", "tarde", "noite"]);
  // Madrugada é noite, mesmo terminando de manhã cedo.
  assert.deepEqual(turnosCobertos("01:00", "07:00"), ["noite"]);
  assert.deepEqual(turnosCobertos("05:00", "08:00"), ["manha", "noite"]);
  // Segundos no horário não mudam o turno.
  assert.deepEqual(turnosCobertos("13:00:00", "19:00:00"), ["tarde"]);
  // A virada é exata: quem sai às 13h não conta na tarde.
  assert.deepEqual(turnosCobertos("12:00", "13:00"), ["manha"]);
  assert.deepEqual(turnosCobertos("18:30", "19:00"), ["tarde"]);
});

test("nomeDoPeriodo: o turno dito por extenso", () => {
  assert.equal(nomeDoPeriodo("07:00", "19:00"), "Manhã e tarde");
  assert.equal(nomeDoPeriodo("19:00", "07:00"), "Noite");
  assert.equal(nomeDoPeriodo("07:00", "13:00"), "Manhã");
  assert.equal(nomeDoPeriodo("07:00", "07:00"), "24 horas");
  assert.equal(nomeDoPeriodo("13:00", "23:00"), "Tarde e noite");
});

// ---------------------------------------------------------------------------
// Nomes
// ---------------------------------------------------------------------------
test("ondeFica: o cadastro, o escrito à mão, ou nada", () => {
  const nomes = new Map([["h1", "Hospital da Unimed"]]);
  assert.equal(ondeFica({ local_id: "h1" }, nomes), "Hospital da Unimed");
  // Plantão de fora: o lugar é texto, e não passa pelo cadastro do grupo.
  assert.equal(ondeFica({ local_id: null, local_texto: "Clínica de endoscopia" }, nomes),
    "Clínica de endoscopia");
  assert.equal(ondeFica({ local_id: null, local_texto: null }, nomes), "Sem local");
  // Só espaços é o mesmo que vazio: senão a linha da escala fica sem lugar
  // nenhum e parece erro de carregamento.
  assert.equal(ondeFica({ local_id: null, local_texto: "   " }, nomes), "Sem local");
  // Local que saiu do cadastro devolve "—", não string vazia.
  assert.equal(ondeFica({ local_id: "sumiu" }, nomes), "—");
  assert.equal(ondeFica({ local_id: null }, nomes, ""), "");
});

test("apelidosDaEquipe: curto por padrão, cresce só quando colide", () => {
  const a = apelidosDaEquipe([
    { id: "1", nome: "Dr. Gustavo Segobia da Silva" },
    { id: "2", nome: "Bruna Alencar" },
    { id: "3", nome: "Ana" },
  ]);
  assert.equal(a.get("1"), "Gustavo");
  assert.equal(a.get("2"), "Bruna");
  assert.equal(a.get("3"), "Ana");
});

test("apelidosDaEquipe: dois de primeiro nome igual não podem virar o mesmo botão", () => {
  // O caso que o corte de três letras da planilha erra: MAR e MAR. Um clique
  // errado aqui escala outro anestesista para o plantão.
  const a = apelidosDaEquipe([
    { id: "1", nome: "Marcos Andrade" },
    { id: "2", nome: "Marcos Silva" },
    { id: "3", nome: "Marcelo Prado" },
  ]);
  assert.equal(a.get("1"), "Marcos A.");
  assert.equal(a.get("2"), "Marcos S.");
  assert.equal(a.get("3"), "Marcelo");
  assert.equal(new Set(a.values()).size, 3);
});

test("apelidosDaEquipe: sobrenome por extenso quando a inicial ainda colide", () => {
  const a = apelidosDaEquipe([
    { id: "1", nome: "Marcos Silva" },
    { id: "2", nome: "Marcos Souza" },
  ]);
  assert.equal(a.get("1"), "Marcos Silva");
  assert.equal(a.get("2"), "Marcos Souza");
});

test("apelidosDaEquipe: nome idêntico não deixa botão sem texto", () => {
  const a = apelidosDaEquipe([
    { id: "1", nome: "Ana Lima" },
    { id: "2", nome: "Ana Lima" },
  ]);
  assert.equal(a.get("1"), "Ana Lima");
  assert.equal(a.get("2"), "Ana Lima");
});

test("apelidosDaEquipe: partícula e título não entram no apelido", () => {
  const a = apelidosDaEquipe([
    { id: "1", nome: "Dra. Flávia de Oliveira" },
    { id: "2", nome: "Flávia dos Santos" },
  ]);
  assert.equal(a.get("1"), "Flávia O.");
  assert.equal(a.get("2"), "Flávia S.");
});

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
// Uma escala por hospital
//
// O grupo não tem uma escala: tem a da Santa Casa, a do Hospital da Unimed, a
// do Instituto. Serviços diferentes, equipes diferentes, e cada uma se lê
// inteira sem a outra atravessada no meio.
// ---------------------------------------------------------------------------

test("a escala de um hospital cadastrado é ela mesma", () => {
  assert.equal(filtroDeHospital("sc", ["sc", "un"]), "sc");
});

test("hospital que saiu do cadastro cai em todos, e não sem nada", () => {
  // Local arquivado, ou cadastro que mudou. Sem esta regra a tela esvaziava em
  // silêncio, mostrando a escala de um hospital que não existe mais.
  assert.equal(filtroDeHospital("arquivado", ["sc", "un"]), "todos");
  assert.equal(filtroDeHospital("sc", []), "todos");
});

test('"todos" e "sem" são escalas legítimas, não ids', () => {
  assert.equal(filtroDeHospital("todos", ["sc"]), "todos");
  assert.equal(filtroDeHospital("todos", []), "todos");
  // "Sem hospital" vale mesmo sem local cadastrado nenhum: é justamente onde
  // estão os plantões lançados antes de existir cadastro.
  assert.equal(filtroDeHospital("sem", []), "sem");
  assert.equal(filtroDeHospital("sem", ["sc"]), "sem");
});

test("cada plantão entra na escala do seu hospital, e só nela", () => {
  assert.equal(plantaoNaEscala("sc", "sc"), true);
  assert.equal(plantaoNaEscala("sc", "un"), false);
  assert.equal(plantaoNaEscala("un", "un"), true);
});

test("plantão sem hospital não some: tem escala própria", () => {
  // Se ele não aparecesse em lugar nenhum, sumiria da escala e ninguém
  // descobriria por quê.
  assert.equal(plantaoNaEscala(null, "sem"), true);
  assert.equal(plantaoNaEscala(null, "sc"), false);
  assert.equal(plantaoNaEscala("sc", "sem"), false);
});

test("a visão de conjunto mostra tudo, inclusive o que não tem hospital", () => {
  assert.equal(plantaoNaEscala("sc", "todos"), true);
  assert.equal(plantaoNaEscala(null, "todos"), true);
});

test("TURNOS_RAPIDOS saem das faixas do dia, e não de horário escrito à mão", () => {
  const [dia, noite] = TURNOS_RAPIDOS;
  assert.equal(dia.inicio, "07:00");
  assert.equal(dia.fim, "19:00");
  assert.equal(noite.inicio, "19:00");
  assert.equal(noite.fim, "07:00");
  // A garantia que importa: o que o botão lança é exatamente o que o
  // calendário desenha. Sol cobre manhã e tarde; lua cobre a noite inteira.
  assert.deepEqual(turnosCobertos(dia.inicio, dia.fim), ["manha", "tarde"]);
  assert.deepEqual(turnosCobertos(noite.inicio, noite.fim), ["noite"]);
});

// ---------------------------------------------------------------------------
// O timbre da instituição
// ---------------------------------------------------------------------------

test("timbre com logo e nome: a imagem primeiro, o nome depois", () => {
  const t = timbreDaFolha({ nome: "Santa Casa de Campo Mourão", logo: "https://cdn/logo.png" });
  assert.match(t, /<img src="https:\/\/cdn\/logo\.png" alt="">/);
  assert.match(t, /<b>Santa Casa de Campo Mourão<\/b>/);
});

test("sem logo cadastrado, o nome sozinho é o timbre — e não fica buraco", () => {
  // A regra é a mesma da ficha do paciente: o que não está cadastrado não
  // ocupa espaço. Um <img> vazio reservaria a altura dele no alto da folha.
  const t = timbreDaFolha({ nome: "Instituto Bom Jesus", logo: null });
  assert.doesNotMatch(t, /<img/);
  assert.match(t, /<b>Instituto Bom Jesus<\/b>/);
});

test("sem instituição nenhuma, não existe faixa", () => {
  assert.equal(timbreDaFolha(null), "");
  assert.equal(timbreDaFolha(undefined), "");
  assert.equal(timbreDaFolha({ nome: "   ", logo: "  " }), "");
});

test("logo que não é http(s) não vira src", () => {
  // O endereço vem do cadastro do local, atravessa o banco e termina dentro de
  // um atributo src numa janela que nós escrevemos. Um javascript: guardado
  // ali rodaria na hora de imprimir a escala.
  const t = timbreDaFolha({ nome: "Clínica X", logo: "javascript:alert(1)" });
  assert.doesNotMatch(t, /<img/);
  assert.match(t, /<b>Clínica X<\/b>/);
  assert.doesNotMatch(timbreDaFolha({ nome: "", logo: "data:image/svg+xml,<svg/>" }), /<img/);
});

test("o nome da instituição é escapado antes de ir para a folha", () => {
  const t = timbreDaFolha({ nome: 'Hospital "A" & <b>B</b>', logo: null });
  assert.match(t, /Hospital &quot;A&quot; &amp; &lt;b&gt;B&lt;\/b&gt;/);
  assert.doesNotMatch(t, /<b>B<\/b>/);
});

test("a folha da escala sai timbrada, e sem instituição sai como sempre saiu", () => {
  const comMarca = corpoDaFolha({
    doGrupo: true, mes: "2026-08", nomeMes: "agosto", ano: 2026,
    diasNoMes: 31, primeiroDiaSemana: 6, plantoes: [turno("Santa Casa", "ANA PAULA DE SOUZA")],
    impressoEm: new Date("2026-08-24T12:00:00"),
    instituicao: { nome: "Santa Casa", logo: "https://cdn/sc.png" },
  });
  // O timbre vem ANTES do título: é cabeçalho, não legenda.
  assert.ok(comMarca.corpo.indexOf('class="marca"') < comMarca.corpo.indexOf("<h1>"));
  assert.doesNotMatch(folhaDoGrupo([turno("Santa Casa", "ANA PAULA DE SOUZA")]).corpo, /class="marca"/);
});

test("a folha de produção sai timbrada pela instituição escolhida", () => {
  const { corpo } = folhaDeProducao(
    producao, "agosto", 2026, new Date("2026-08-24T12:00:00"),
    { nome: "Hospital da Unimed", logo: "https://cdn/u.png" },
  );
  assert.ok(corpo.indexOf('class="marca"') < corpo.indexOf("<h1>"));
  assert.match(corpo, /<b>Hospital da Unimed<\/b>/);
  // Sem instituição, a folha continua igual à de antes — nada de faixa vazia.
  assert.doesNotMatch(
    folhaDeProducao(producao, "agosto", 2026, new Date("2026-08-24T12:00:00")).corpo,
    /class="marca"/,
  );
});

// ---------------------------------------------------------------------------
// Fechamento do mês — a folha que vai para o financeiro
// ---------------------------------------------------------------------------

const turnoDe = (
  perfilId: string, profissional: string, data: string,
  { horas = 12, valor = 1100, confirmado = true } = {},
): PlantaoDoFechamento => ({
  perfilId, profissional, data, hora_inicio: "07:00", hora_fim: "19:00",
  horas, valor, situacao: "escalado", local: "Santa Casa",
  confirmadoEm: confirmado ? `${data}T19:30:00Z` : null,
});

const fechamento = (ps: PlantaoDoFechamento[]) =>
  folhaDeFechamento(ps, "agosto", 2026, new Date("2026-08-31T12:00:00"));

test("o fechamento soma horas e valor por profissional", () => {
  const { corpo } = fechamento([
    turnoDe("a", "LUCAS QUEIROZ", "2026-08-03"),
    turnoDe("a", "LUCAS QUEIROZ", "2026-08-10"),
    turnoDe("b", "MATHEUS GOMES", "2026-08-05", { horas: 6, valor: 600 }),
  ]);
  // O valor é comparado com money(), e não com um texto escrito à mão: o
  // separador do "R$" é espaço INQUEBRÁVEL, e um teste que digita o espaço
  // comum falha sem que nada esteja errado.
  assert.ok(corpo.includes(`Lucas Queiroz</td><td>2</td><td>2</td><td class="num">24h</td>`
    + `<td class="num">${money(2200)}</td>`));
  assert.ok(corpo.includes(`Matheus Gomes</td><td>1</td><td>1</td><td class="num">6h</td>`
    + `<td class="num">${money(600)}</td>`));
});

test("só o CONFIRMADO entra no total a pagar", () => {
  // É o ponto inteiro do relatório. A escala é um plano: o plantão trocado na
  // véspera continua lá. Pagar pelo plano é pagar por trabalho que não houve.
  const { corpo } = fechamento([
    turnoDe("a", "LUCAS QUEIROZ", "2026-08-03"),
    turnoDe("a", "LUCAS QUEIROZ", "2026-08-10", { confirmado: false }),
  ]);
  // Dois turnos, um confirmado, e o total é de um só.
  assert.match(corpo, /<td>2<\/td><td>1 <b>de 2<\/b><\/td>/);
  assert.ok(corpo.includes(`<td class="num">12h</td><td class="num">${money(1100)}</td>`));
});

test("o turno não confirmado aparece marcado, e não some", () => {
  // Sumir seria pior do que aparecer: um plantão que a pessoa esqueceu de
  // confirmar desapareceria da conta dela sem ninguém ver.
  const { corpo } = fechamento([
    turnoDe("a", "LUCAS QUEIROZ", "2026-08-10", { confirmado: false }),
  ]);
  assert.match(corpo, /class="pendente"/);
  assert.match(corpo, /Aguardando confirmação/);
  assert.match(corpo, /10\/08/);
});

test("a folha avisa em cima quando há turno por confirmar", () => {
  // O aviso muda o que se faz com o papel: pagar um fechamento com pendências
  // é pagar um plano. Por isso é a primeira frase, e não uma nota de rodapé.
  const comPendencia = fechamento([
    turnoDe("a", "LUCAS QUEIROZ", "2026-08-03"),
    turnoDe("b", "MATHEUS GOMES", "2026-08-04", { confirmado: false }),
    turnoDe("b", "MATHEUS GOMES", "2026-08-05", { confirmado: false }),
  ]);
  assert.match(comPendencia.corpo, /2 turnos ainda não foram confirmados/);
  const limpa = fechamento([turnoDe("a", "LUCAS QUEIROZ", "2026-08-03")]);
  assert.match(limpa.corpo, /Todos os turnos foram confirmados/);
});

test("a ordem é por NOME, nunca por valor", () => {
  // Ordenar por dinheiro transforma um documento de pagamento em ranking, e
  // ranking circula por motivo errado.
  const { corpo } = fechamento([
    turnoDe("a", "ANA PAULA DE SOUZA", "2026-08-03", { valor: 100 }),
    turnoDe("z", "ZELIA MARTINS", "2026-08-04", { valor: 9000 }),
    turnoDe("m", "MATHEUS GOMES", "2026-08-05", { valor: 5000 }),
  ]);
  const ordem = [...corpo.matchAll(/<h2>([^<]+)/g)].map((m) => m[1].trim()).slice(1);
  assert.deepEqual(ordem, ["Ana Souza", "Matheus Gomes", "Zelia Martins"]);
});

test("mês sem plantão continua sendo uma folha válida", () => {
  const { titulo, corpo } = fechamento([]);
  assert.equal(titulo, "Fechamento de plantões — agosto de 2026");
  assert.match(corpo, /Nenhum plantão neste mês/);
});

test("o fechamento sai timbrado pela instituição", () => {
  const { corpo } = folhaDeFechamento(
    [turnoDe("a", "LUCAS QUEIROZ", "2026-08-03")], "agosto", 2026,
    new Date("2026-08-31T12:00:00"), { nome: "Santa Casa", logo: "https://cdn/sc.png" },
  );
  assert.ok(corpo.indexOf('class="marca"') < corpo.indexOf("<h1>"));
});

test("o nome do profissional é escapado", () => {
  const { corpo } = fechamento([turnoDe("a", "<script>alert(1)</script>", "2026-08-03")]);
  assert.doesNotMatch(corpo, /<script>/);
});

// ---------------------------------------------------------------------------
// A janela de confirmar
// ---------------------------------------------------------------------------

const diurno = { data: "2026-08-25", hora_inicio: "07:00", hora_fim: "19:00" };
const noturno = { data: "2026-08-25", hora_inicio: "19:00", hora_fim: "07:00" };
const em = (s: string) => new Date(s);

test("o plantão do dia confirma durante o dia", () => {
  assert.equal(podeConfirmar(diurno, em("2026-08-25T08:00:00")), true);
  assert.equal(podeConfirmar(diurno, em("2026-08-25T19:00:00")), true);
});

test("antes do dia não confirma — não aconteceu ainda", () => {
  assert.equal(podeConfirmar(diurno, em("2026-08-24T23:59:00")), false);
});

test("passou a janela, não confirma mais", () => {
  // É o ponto da regra: sem fechar a janela, no fim do mês a pessoa confirma
  // trinta de uma vez sem lembrar de nenhum — e o que ela assina não é o que
  // aconteceu, é o que estava escalado.
  assert.equal(podeConfirmar(diurno, em("2026-08-26T09:00:00")), false);
});

test("o noturno confirma na manhã seguinte, que é quando ele termina", () => {
  // Cortar à meia-noite tornaria impossível confirmar o turno da noite —
  // justamente aquele em que a pessoa está mais cansada.
  assert.equal(podeConfirmar(noturno, em("2026-08-25T23:00:00")), true);
  assert.equal(podeConfirmar(noturno, em("2026-08-26T07:00:00")), true);
  assert.equal(podeConfirmar(noturno, em("2026-08-26T07:25:00")), true);
  assert.equal(podeConfirmar(noturno, em("2026-08-26T08:00:00")), false);
});

test("meia hora de folga depois do fim: tirar a luva e pegar o telefone", () => {
  assert.equal(podeConfirmar(diurno, em("2026-08-25T19:29:00")), true);
  assert.equal(podeConfirmar(diurno, em("2026-08-25T19:31:00")), false);
});

test("plantão de 24 horas confirma até o dia seguinte no mesmo horário", () => {
  const vinteQuatro = { data: "2026-08-25", hora_inicio: "07:00", hora_fim: "07:00" };
  assert.equal(podeConfirmar(vinteQuatro, em("2026-08-26T07:00:00")), true);
  assert.equal(podeConfirmar(vinteQuatro, em("2026-08-26T08:00:00")), false);
});

test("a virada do mês não fecha a janela do noturno", () => {
  // 31/08 às 19h termina em 01/09 às 7h. Somar um dia sem trocar de mês daria
  // "32 de agosto", e o noturno do último dia do mês nunca confirmaria.
  const ultimoDia = { data: "2026-08-31", hora_inicio: "19:00", hora_fim: "07:00" };
  assert.equal(podeConfirmar(ultimoDia, em("2026-09-01T06:00:00")), true);
});
