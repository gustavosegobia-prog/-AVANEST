import test from "node:test";
import assert from "node:assert/strict";
import type { PlantaoDoFechamento, PlantaoImpresso } from "./escala.ts";
import {
  apelidosDaEquipe, carimboICS, TURNOS_RAPIDOS, corpoDaFolha, timbreDaFolha, folhaDeFechamento, money, podeConfirmar, filtroDeHospital, plantaoNaEscala, escaparHTML, faixa, folhaDeProducao, folhaDePlantoesPorLocal, folhaDeFaturamento, iniciais, montarICS, partesDoPlantao,
  nomeCurto, nomeDoPeriodo, ondeFica, plural, rotuloSituacao, somarHoras, textoICS, turnosCobertos,
  coresDaFolha, cssDasCores, legendaDaFolha, PALETA_DA_FOLHA, emTurnos, turnosEscrito,
  plantoesEscrito, assinaturaDaFolha, SLOGAN, ordemDentroDoDia, mesEmMaiusculas,
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

test("apelidosDaEquipe: o primeiro nome, e só ele, quando não colide", () => {
  // O sobrenome custa três caracteres em cada pastilha, e três caracteres numa
  // coluna que é um sétimo da página decidem se dois nomes cabem lado a lado.
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

test("iniciais: a equipe real, do jeito que está cadastrada", () => {
  // Os nomes como o Gustavo os cadastrou, com o tratamento na frente e em
  // maiúsculas. A tela do Admin tinha uma cópia própria da função que pegava
  // as duas primeiras palavras: metade da equipe virava "D" alguma coisa.
  assert.equal(iniciais("Dr MATHEUS FANTIM GOMES"), "MG");
  assert.equal(iniciais("Dr. IGOR MORAIS MONTEIRO"), "IM");
  assert.equal(iniciais("Dr. GUSTAVO SEGOBIA DA SILVA"), "GS");
  assert.equal(iniciais("DR. LUCAS SOUZA QUIJO"), "LQ");
  assert.equal(iniciais("Dr. EDER SAMORANO FORTES DE OLIVEIRA"), "EO");
  // Sem tratamento, e com sobrenome composto: primeiro nome e último
  // sobrenome continuam sendo a regra.
  assert.equal(iniciais("Crislaitiane Dal Ponte Pulido"), "CP");
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
  assert.equal(titulo, "Produção — AGOSTO de 2026");
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

const folhaDoGrupo = (plantoes: PlantaoImpresso[], apelidos?: Map<string, string>) => corpoDaFolha({
  doGrupo: true, mes: "2026-08", nomeMes: "agosto", ano: 2026,
  diasNoMes: 31, primeiroDiaSemana: 6, plantoes, apelidos,
  impressoEm: new Date("2026-08-24T12:00:00"),
});

test("hospitais diferentes no mesmo horário não viram um turno só", () => {
  const { corpo } = folhaDoGrupo([
    turno("Santa Casa", "GUSTAVO SEGOBIA DA SILVA"),
    turno("Hospital da Unimed", "ANA PAULA DE SOUZA"),
  ]);
  // Dois blocos dentro da faixa da manhã, cada um com o nome do seu hospital
  // em cima — e não uma fileira de nomes que junta as duas equipes.
  assert.match(corpo, /<u>Santa Casa<\/u><i class="p c\d+">Gustavo Silva<\/i>/);
  assert.match(corpo, /<u>Hospital da Unimed<\/u><i class="p c\d+">Ana Souza<\/i>/);
});

test("mesmo hospital e mesmo horário continuam juntos", () => {
  const { corpo } = folhaDoGrupo([
    turno("Santa Casa", "GUSTAVO SEGOBIA DA SILVA"),
    turno("Santa Casa", "ANA PAULA DE SOUZA"),
  ]);
  // Um bloco só, com as duas pastilhas coladas: mesmo hospital, mesmo turno.
  assert.match(corpo, /<i class="p c\d+">Ana Souza<\/i><i class="p c\d+">Gustavo Silva<\/i>/);
  // Um hospital só na folha: o nome não se repete em cada célula.
  assert.doesNotMatch(corpo, /<u>Santa Casa<\/u>/);
});

test("a célula do grupo sai em faixas M, T e N, como na tela", () => {
  // Quem para na frente da folha na parede quer saber quem está de manhã, de
  // tarde e de noite — e não decorar que "07-19h" cobre as duas primeiras.
  // As três faixas ficam sempre na mesma altura da célula: é isso que deixa
  // ler "quem faz as noites desta semana" correndo o olho na horizontal.
  const { corpo } = folhaDoGrupo([turno("Santa Casa", "ANA PAULA DE SOUZA")]);
  assert.match(corpo, /<span class="fx"><b>M<\/b>.*Ana Souza/);
  assert.match(corpo, /<span class="fx"><b>T<\/b>.*Ana Souza/);
  // O turno das 07h às 19h não cobre a noite: a faixa existe, e vazia.
  assert.match(corpo, /<span class="fx"><b>N<\/b><span class="q"><em class="vago">/);
  assert.doesNotMatch(corpo, /07-19h/);
});

test("dia sem plantão nenhum não desenha faixa vazia", () => {
  // Três traços num dia vago é ruído, não informação: o alinhamento das faixas
  // só serve onde há o que alinhar.
  const { corpo } = folhaDoGrupo([turno("Santa Casa", "ANA PAULA DE SOUZA")]);
  // O plantão está no dia 1; o dia 2 fica limpo.
  assert.match(corpo, /<span class="d">2<\/span><\/td>/);
});

test("folha de um hospital só leva o nome dele no título e não o repete nas células", () => {
  const { titulo, corpo } = folhaDoGrupo([
    turno("Santa Casa", "GUSTAVO SEGOBIA DA SILVA"),
    turno("Santa Casa", "ANA PAULA DE SOUZA", "19:00"),
  ]);
  assert.equal(titulo, "Escala da equipe — Santa Casa — AGOSTO de 2026");
  // O nome não se repete em cada célula: numa folha de um hospital só, seria a
  // mesma palavra trinta e uma vezes.
  assert.doesNotMatch(corpo, /07-19h · Santa Casa/);
});

test("folha com vários hospitais não nomeia nenhum no título", () => {
  const { titulo } = folhaDoGrupo([
    turno("Santa Casa", "GUSTAVO SEGOBIA DA SILVA"),
    turno("Hospital da Unimed", "ANA PAULA DE SOUZA"),
  ]);
  assert.equal(titulo, "Escala da equipe — AGOSTO de 2026");
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
  // Seis horas é MEIO turno, e não um. A coluna conta turnos de 12 horas, e
  // não linhas da tabela — arredondar para 1 seria a folha inventando meio
  // plantão que ninguém trabalhou, num papel que serve para pagar.
  assert.ok(corpo.includes(`Matheus Gomes</td><td>0,5</td><td>0,5</td><td class="num">6h</td>`
    + `<td class="num">${money(600)}</td>`));
});

test("um turno é 12 horas: o de 24 conta por dois, dois de 6 contam por um", () => {
  // Contar LINHAS media outra coisa: o plantão de 24 horas aparecia como "1
  // turno" e era pago como dois; dois de 6 horas apareciam como "2 turnos" e
  // juntos valiam um. Quem conferia somava horas de cabeça para descobrir que
  // a coluna estava errada — e quem não conferia pagava errado.
  const { corpo } = fechamento([
    turnoDe("a", "ANA SOUZA", "2026-08-03", { horas: 24, valor: 3600 }),
    turnoDe("b", "GUSTAVO SILVA", "2026-08-04", { horas: 6, valor: 900 }),
    turnoDe("b", "GUSTAVO SILVA", "2026-08-05", { horas: 6, valor: 900 }),
  ]);
  assert.ok(corpo.includes("Ana Souza</td><td>2</td>"), "24h tinham de ser 2 turnos");
  assert.ok(corpo.includes("Gustavo Silva</td><td>1</td>"), "6h + 6h tinham de ser 1 turno");
  // E o total do rodapé fala a mesma língua: 36 horas são três turnos.
  assert.match(corpo, /<span>3 turnos · /);
});

test("emTurnos e turnosEscrito: a conta e como ela se lê", () => {
  assert.equal(emTurnos(24), 2);
  assert.equal(emTurnos(6), 0.5);
  assert.equal(emTurnos(0), 0);
  // Vírgula, e não ponto: a folha é lida no Brasil.
  assert.equal(turnosEscrito(6), "0,5");
  assert.equal(turnosEscrito(24), "2");
  assert.equal(turnosEscrito(948), "79");
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
  assert.equal(titulo, "Fechamento de plantões — AGOSTO de 2026");
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

// ---------------------------------------------------------------------------
// As duas notas do mês
// ---------------------------------------------------------------------------

const plantaoNota = (data: string, local: string, valor: number, horas = 12) =>
  ({ data, hora_inicio: "07:00:00", hora_fim: "19:00:00", horas, valor, local });

test("os plantões saem separados por hospital, com um total em cada", () => {
  // É esse total que a pessoa copia no campo do valor da nota. Uma folha que
  // mistura hospitais obriga a somar na calculadora antes de emitir.
  const { corpo } = folhaDePlantoesPorLocal([
    plantaoNota("2026-08-03", "Hospital A", 1100),
    plantaoNota("2026-08-10", "Hospital A", 1100),
    plantaoNota("2026-08-15", "Hospital B", 900),
  ], "agosto", 2026, new Date("2026-09-01T12:00:00"));
  assert.match(corpo, /Hospital A[\s\S]*?2 plantões[\s\S]*?2\.200,00/);
  assert.match(corpo, /Hospital B[\s\S]*?1 plantão[\s\S]*?900,00/);
});

const item = (data: string, paciente: string, local: string, valor: number,
              pagador: string | null, convenio = "Particular") =>
  ({ data, paciente, convenio, procedimento: null, valor,
     situacao: "a_cobrar", local, pagador });

test("o faturamento quebra por hospital e, dentro dele, por quem paga", () => {
  const { corpo } = folhaDeFaturamento([
    item("2026-08-03", "Ana", "Hospital A", 500, "direto"),
    item("2026-08-04", "Bruno", "Hospital A", 700, "hospital"),
    item("2026-08-05", "Célia", "Hospital B", 300, "convenio", "Unimed"),
  ], "agosto", 2026, new Date("2026-09-01T12:00:00"));
  assert.match(corpo, /Hospital A[\s\S]*?Pago pelo paciente[\s\S]*?Ana/);
  assert.match(corpo, /Hospital A[\s\S]*?Pago pelo hospital[\s\S]*?Bruno/);
  assert.match(corpo, /Hospital B[\s\S]*?Pago pelo convênio[\s\S]*?Célia/);
});

test("paciente sem pagador definido não entra em nota nenhuma", () => {
  // A regra que mais importa desta folha. Somar uma linha indecisa a qualquer
  // um dos três blocos é emitir nota contra quem não deve — e escolher o
  // tomador é a única coisa que o sistema não pode fazer por quem assina.
  const { corpo } = folhaDeFaturamento([
    item("2026-08-03", "Ana", "Hospital A", 500, "direto"),
    item("2026-08-06", "Dora", "Hospital A", 400, null),
  ], "agosto", 2026, new Date("2026-09-01T12:00:00"));

  assert.match(corpo, /Sem pagador definido/);
  assert.match(corpo, /1 paciente está sem pagador definido, somando[\s\S]*?400,00/);
  // O bloco do recebimento direto soma 500, e não 900.
  // O espaço depois do R$ é o não separável que o toLocaleString produz, e
  // não a entidade &nbsp;: \s cobre os dois sem depender de qual é.
  assert.match(corpo, /Pago pelo paciente <small>1 paciente · R\$\s500,00/);
});

test("o hospital em branco vira 'Sem hospital' em vez de sumir", () => {
  // Linha sem hospital é linha que alguém precisa consertar. Escondê-la faria
  // o valor desaparecer da nota sem ninguém notar.
  const { corpo } = folhaDeFaturamento(
    [item("2026-08-03", "Ana", "", 500, "direto")],
    "agosto", 2026, new Date("2026-09-01T12:00:00"));
  assert.match(corpo, /Sem hospital/);
});

test("o papel diz o mesmo que a tela sobre o plantão de 24 horas", () => {
  // A folha é conferida ao lado do calendário aberto no celular. Quando a tela
  // dizia "Diurno / Noturno" e o papel dizia "07-07h", as duas leituras do
  // mesmo dia se contradiziam — e aí não se confia em nenhuma.
  const { corpo } = corpoDaFolha({
    doGrupo: false, mes: "2026-08", nomeMes: "agosto", ano: 2026,
    diasNoMes: 31, primeiroDiaSemana: 6, impressoEm: new Date("2026-09-01T12:00:00"),
    plantoes: [{
      data: "2026-08-01", hora_inicio: "07:00", hora_fim: "07:00",
      horas: 24, valor: 2000, situacao: "realizado",
      local: "FUNDHOSPAR", profissional: "Gustavo Segobia",
    }],
  });
  assert.match(corpo, /<b>Diurno<\/b><span><i class="p c\d+">FUNDHOSPAR<\/i><\/span>/);
  assert.match(corpo, /<b>Noturno<\/b><span><i class="p c\d+">FUNDHOSPAR<\/i><\/span>/);
  assert.doesNotMatch(corpo, /<b>07-07h<\/b>/);
});

test("o plantão de 24 horas vira duas etiquetas: Diurno e Noturno", () => {
  // Quem faz o plantão inteiro está lá de dia e de noite. Numa etiqueta só,
  // "07-07h" não se distingue de um diurno no calendário — e é justamente a
  // diferença que se procura num mês que mistura os dois.
  const p = partesDoPlantao("07:00", "07:00");
  assert.deepEqual(p.map((x) => x.rotulo), ["Diurno", "Noturno"]);
});

test("o que não é de 24 horas continua saindo pelo horário", () => {
  // Um 13-07h cobre tarde e noite, mas chamá-lo de Diurno diria que a pessoa
  // esteve lá de manhã. O horário é exato; o rótulo de turno, não.
  assert.deepEqual(partesDoPlantao("07:00", "19:00").map((x) => x.rotulo), ["07-19h"]);
  assert.deepEqual(partesDoPlantao("19:00", "07:00").map((x) => x.rotulo), ["19-07h"]);
  assert.deepEqual(partesDoPlantao("13:00", "07:00").map((x) => x.rotulo), ["13-07h"]);
  assert.deepEqual(partesDoPlantao("07:00", "13:00").map((x) => x.rotulo), ["07-13h"]);
});

test("o total fecha a coluna de valores, e não só o título", () => {
  // Quem preenche nota corre o dedo pela coluna até o fim. Com o total só no
  // cabeçalho, em cinza, a pessoa soma na calculadora do lado — que é o
  // trabalho que esta folha existe para tirar dela.
  const { corpo } = folhaDePlantoesPorLocal([
    plantaoNota("2026-08-03", "Hospital A", 1100),
    plantaoNota("2026-08-10", "Hospital A", 1100),
  ], "agosto", 2026, new Date("2026-09-01T12:00:00"));
  assert.match(corpo, /<tfoot>[\s\S]*?Total a faturar[\s\S]*?2\.200,00[\s\S]*?<\/tfoot>/);
});

test("o total do bloco sem pagador não se chama 'a faturar'", () => {
  // O rótulo é parte da regra: chamar de "a faturar" o que ninguém decidiu
  // convida a somar na nota justamente o que não pode entrar em nota nenhuma.
  const { corpo } = folhaDeFaturamento([
    item("2026-08-03", "Ana", "Hospital A", 500, "direto"),
    item("2026-08-06", "Dora", "Hospital A", 400, null),
  ], "agosto", 2026, new Date("2026-09-01T12:00:00"));
  assert.match(corpo, /Total a faturar[\s\S]*?500,00/);
  assert.match(corpo, /Total sem pagador definido[\s\S]*?400,00/);
  // E o total do bloco decidido continua sendo 500, nunca 900.
  assert.doesNotMatch(corpo, /Total a faturar<\/td><td class="num">R\$\s900,00/);
});

test("mês sem nada não imprime folha em branco sem explicação", () => {
  const p = folhaDePlantoesPorLocal([], "agosto", 2026, new Date("2026-09-01T12:00:00"));
  assert.match(p.corpo, /Nenhum plantão neste mês/);
  const f = folhaDeFaturamento([], "agosto", 2026, new Date("2026-09-01T12:00:00"));
  assert.match(f.corpo, /Nada anotado neste mês/);
});

// ---------------------------------------------------------------------------
// As cores da folha impressa
// ---------------------------------------------------------------------------
// O que se protege aqui não é a aparência: é que duas pessoas na mesma folha
// nunca saiam com a mesma cor, e que a cor de cada uma seja a mesma no mês que
// vem. Uma folha em que a cor muda todo mês é pior do que uma folha sem cor —
// ela ensina um atalho e depois mente sobre ele.

test("coresDaFolha: cada pessoa da folha com a sua cor", () => {
  const equipe = ["Matheus Gomes", "Lucas Quijo", "Thais Staniszewski",
                  "Eder Oliveira", "Luana Zanettin", "Gerusa Sampaio", "Ana Souza"];
  const cores = coresDaFolha(equipe);
  assert.equal(cores.size, equipe.length);
  assert.equal(new Set(cores.values()).size, equipe.length, "duas pessoas com a mesma cor");
});

test("coresDaFolha: a mesma equipe sai com as mesmas cores todo mês", () => {
  // "eu sou o verde" só vira atalho se continuar verdadeiro no mês seguinte.
  // A garantia é esta, e não mais que esta: enquanto a equipe for a mesma, a
  // folha de outubro repete as cores da de setembro. Entrando gente nova, quem
  // esbarrar numa cor já tomada anda para a próxima — não repetir cor na mesma
  // folha vale mais do que congelar a cor de todo mundo para sempre.
  const setembro = coresDaFolha(["Matheus Gomes", "Lucas Quijo", "Thais Staniszewski"]);
  const outubro = coresDaFolha(["Lucas Quijo", "Thais Staniszewski", "Matheus Gomes"]);
  assert.deepEqual([...setembro.entries()].sort(), [...outubro.entries()].sort());
});

test("coresDaFolha: não depende da ordem em que os plantões vieram do banco", () => {
  const a = coresDaFolha(["Lucas Quijo", "Matheus Gomes", "Lucas Quijo", "Ana Souza"]);
  const b = coresDaFolha(["Ana Souza", "Lucas Quijo", "Matheus Gomes"]);
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
});

test("coresDaFolha: repete cor em vez de deixar alguém de fora", () => {
  const dez = Array.from({ length: 10 }, (_, i) => `Pessoa ${i}`);
  const cores = coresDaFolha(dez);
  assert.equal(cores.size, 10, "ninguém pode ficar sem cor");
  for (const c of cores.values()) {
    assert.ok(c >= 0 && c < PALETA_DA_FOLHA.length, `cor ${c} fora da paleta`);
  }
});

test("coresDaFolha: ignora nome em branco", () => {
  assert.equal(coresDaFolha(["", "   ", "Ana Souza"]).size, 1);
});

// ---------------------------------------------------------------------------
// A cor escolhida a dedo
// ---------------------------------------------------------------------------

test("cor fixada: quem escolheu fica com a que escolheu", () => {
  const equipe = ["Ana", "Bruno", "Carla"];
  const cores = coresDaFolha(equipe, new Map([["Bruno", 5]]));
  assert.equal(cores.get("Bruno"), 5);
});

test("cor fixada: o sorteado sai da frente de quem escolheu", () => {
  // O caso que motivou tudo: a cor pedida ja e a de outra pessoa. Quem cede e
  // o sorteio, que nao tem motivo nenhum para estar naquela cor.
  const equipe = ["Ana", "Bruno", "Carla", "Dan", "Eva"];
  const semFixar = coresDaFolha(equipe);
  const dono = [...semFixar.entries()].find(([n]) => n !== "Ana")!;
  const cores = coresDaFolha(equipe, new Map([["Ana", dono[1]]]));
  assert.equal(cores.get("Ana"), dono[1], "quem fixou tem de ficar com a cor");
  assert.notEqual(cores.get(dono[0]), dono[1], "o sorteado tinha de sair de la");
  assert.equal(new Set(cores.values()).size, equipe.length, "e ninguem pode repetir");
});

test("cor fixada: duas pessoas na mesma cor — a segunda volta ao sorteio", () => {
  // Nao repetir cor vale mais do que respeitar a escolha: duas pastilhas iguais
  // na parede e uma folha que mente. A ordem alfabetica decide quem fica.
  const cores = coresDaFolha(["Ana", "Bruno"], new Map([["Ana", 3], ["Bruno", 3]]));
  assert.equal(cores.get("Ana"), 3, "alfabeticamente a primeira fica com a cor pedida");
  assert.notEqual(cores.get("Bruno"), 3);
});

test("cor fixada: indice que a paleta nao tem e ignorado, e ninguem fica sem cor", () => {
  // Acontece quando a paleta encolhe e o banco guarda um numero de antes.
  // Quebrar a folha por causa disso seria pior do que sair numa cor diferente.
  for (const invalida of [-1, 99, PALETA_DA_FOLHA.length, 1.5, Number.NaN]) {
    const cores = coresDaFolha(["Ana", "Bruno"], new Map([["Ana", invalida]]));
    assert.equal(cores.size, 2, `indice ${invalida} nao pode tirar ninguem da folha`);
    const cor = cores.get("Ana")!;
    assert.ok(Number.isInteger(cor) && cor >= 0 && cor < PALETA_DA_FOLHA.length,
      `indice ${invalida} devolveu ${cor}, que nao esta na paleta`);
  }
});

test("cor fixada: nome que nao esta na folha nao ocupa cor de ninguem", () => {
  // O mapa vem da equipe inteira; a folha do mes tem so quem plantao.
  const so = coresDaFolha(["Ana"], new Map([["Ana", 2], ["Fantasma", 3]]));
  assert.equal(so.size, 1);
  assert.equal(so.get("Ana"), 2);
});

test("cor fixada: sem mapa nenhum, nada muda em relacao ao que ja saia", () => {
  const equipe = ["Ana Souza", "Lucas Quijo", "Matheus Gomes", "Thais Staniszewski"];
  assert.deepEqual([...coresDaFolha(equipe, new Map()).entries()],
                   [...coresDaFolha(equipe).entries()]);
});

test("cor fixada: com a paleta cheia de fixadas, ninguem fica sem cor", () => {
  const equipe = Array.from({ length: PALETA_DA_FOLHA.length + 2 }, (_, i) => `P${i}`);
  const todas = new Map(equipe.slice(0, PALETA_DA_FOLHA.length).map((n, i) => [n, i]));
  const cores = coresDaFolha(equipe, todas);
  assert.equal(cores.size, equipe.length, "ninguem pode ficar de fora");
  for (const c of cores.values()) {
    assert.ok(c >= 0 && c < PALETA_DA_FOLHA.length, `cor ${c} fora da paleta`);
  }
});

test("cssDasCores: uma classe para cada cor da paleta", () => {
  const css = cssDasCores(true);
  PALETA_DA_FOLHA.forEach((cor, i) => {
    assert.ok(css.includes(`.c${i}{background:${cor}}`), `faltou .c${i}`);
  });
});

test("cssDasCores: manda o navegador imprimir os fundos, nas duas versões", () => {
  // Sem isto o navegador descarta TODO fundo na hora de imprimir: a folha sai
  // colorida na pré-visualização e branca no papel, que é exatamente o
  // problema que este código existe para resolver. Vale também para a preto e
  // branco, cujos cinzas de fim de semana também são fundo.
  assert.match(cssDasCores(true), /print-color-adjust:\s*exact/);
  assert.match(cssDasCores(false), /print-color-adjust:\s*exact/);
});

test("cssDasCores: em preto e branco nenhuma cor da paleta sobra na folha", () => {
  // O modo P&B não é a folha colorida passada num filtro: as pastilhas
  // invertem para fundo branco com letra preta, porque letra branca sobre
  // cinza médio é justamente o nome — a informação — saindo pior.
  const css = cssDasCores(false);
  for (const cor of PALETA_DA_FOLHA) {
    assert.ok(!css.includes(cor), `a cor ${cor} vazou para a folha preto e branco`);
  }
  assert.match(css, /\.p\{background:#fff;color:#111/);
});

test("cssDasCores: a legenda some na folha preto e branco", () => {
  // Sete pastilhas idênticas embaixo do título não explicam código nenhum —
  // seria tinta gasta para ensinar um atalho que não existe nessa versão.
  assert.match(cssDasCores(false), /\.legenda\{display:none\}/);
  assert.doesNotMatch(cssDasCores(true), /\.legenda\{display:none\}/);
});

test("legendaDaFolha: os nomes em ordem, com a cor de cada um", () => {
  const legenda = legendaDaFolha(new Map([["Matheus Gomes", 3], ["Ana Souza", 1]]));
  assert.ok(legenda.indexOf("Ana Souza") < legenda.indexOf("Matheus Gomes"));
  assert.match(legenda, /class="p c1">Ana Souza/);
  assert.match(legenda, /class="p c3">Matheus Gomes/);
});

test("legendaDaFolha: uma pessoa só não tem o que legendar", () => {
  // Uma pastilha sozinha embaixo do título não distingue coisa alguma de
  // coisa nenhuma — é tinta gasta.
  assert.equal(legendaDaFolha(new Map([["Ana Souza", 0]])), "");
});

test("legendaDaFolha: escapa o nome", () => {
  assert.ok(!legendaDaFolha(new Map([["<b>x</b>", 0], ["Ana", 1]])).includes("<b>x</b>"));
});

test("a legenda traz só quem está na escala do mês", () => {
  // A equipe tem treze pessoas; o mês em que oito não pegaram plantão nenhum
  // não é um mês com treze nomes na parede. O mapa de cores vem da tela e
  // cobre o cadastro inteiro — quem manda na legenda é a folha, não o cadastro.
  const equipe = ["Ana Souza", "Bruna Miyamoto", "Gustavo Silva", "Taylor Salomon"];
  const { corpo } = corpoDaFolha({
    doGrupo: true, mes: "2026-08", nomeMes: "agosto", ano: 2026,
    diasNoMes: 31, primeiroDiaSemana: 6,
    impressoEm: new Date("2026-08-24T12:00:00"),
    cores: new Map(equipe.map((n, i) => [n, i])),
    plantoes: [
      turno("Santa Casa", "ANA PAULA DE SOUZA"),
      turno("Santa Casa", "GUSTAVO SEGOBIA DA SILVA"),
    ],
  });
  const legenda = corpo.slice(corpo.indexOf('<div class="legenda">'), corpo.indexOf("<table"));
  assert.match(legenda, /Ana Souza/);
  assert.match(legenda, /Gustavo Silva/);
  assert.doesNotMatch(legenda, /Bruna Miyamoto/);
  assert.doesNotMatch(legenda, /Taylor Salomon/);
});

test("a pastilha usa o apelido da tela, e não o nome com sobrenome", () => {
  // O sobrenome custava caro no papel: duas pastilhas não cabiam lado a lado na
  // coluna de um dia, cada turno com dois plantonistas virava duas linhas, e a
  // célula dobrava de altura. Como o zoom da folha é calculado pela altura, o
  // sobrenome de cada um encolhia o nome de TODO MUNDO na folha inteira.
  const { corpo } = folhaDoGrupo([
    turno("Santa Casa", "GUSTAVO SEGOBIA DA SILVA"),
    turno("Santa Casa", "ANA PAULA DE SOUZA"),
  ], new Map([["GUSTAVO SEGOBIA DA SILVA", "Gustavo"], ["ANA PAULA DE SOUZA", "Ana"]]));
  assert.match(corpo, /<i class="p c\d+">Gustavo<\/i>/);
  assert.doesNotMatch(corpo, /Gustavo Silva/);
  // A legenda fala a mesma língua da célula: nomes diferentes nos dois lugares
  // fariam a tira do topo deixar de explicar o calendário embaixo dela.
  const legenda = corpo.slice(corpo.indexOf('<div class="legenda">'), corpo.indexOf("<table"));
  assert.match(legenda, /Ana<\/i>/);
});

test("sem apelido combinado, a pastilha cai no nome curto", () => {
  const { corpo } = folhaDoGrupo([turno("Santa Casa", "ANA PAULA DE SOUZA")]);
  assert.match(corpo, /<i class="p c\d+">Ana Souza<\/i>/);
});

test("plantoesEscrito: a contagem sai das horas, e não das linhas", () => {
  // Seis lançamentos que somam 120 horas são dez plantões, e é assim que eles
  // são pagos. Dizer "6 plantões · 120,0 h" ao lado de um valor obriga quem
  // confere a dividir de cabeça para descobrir qual dos dois números conversa
  // com o dinheiro.
  assert.equal(plantoesEscrito(120), "10 plantões");
  assert.equal(plantoesEscrito(24), "2 plantões");
  assert.equal(plantoesEscrito(36), "3 plantões");
  assert.equal(plantoesEscrito(12), "1 plantão");
  // 6h + 6h = 1 plantão; 6h sozinho é meio.
  assert.equal(plantoesEscrito(6), "0,5 plantões");
  assert.equal(plantoesEscrito(0), "0 plantões");
});

test("a folha de plantões para nota conta por 12 horas", () => {
  // O caso do print: seis lançamentos, dois deles de 12h e quatro de 24h,
  // somando 120 horas. A folha dizia "6 plantões" ao lado de R$ 10.000,00.
  const doDia = (data: string, ini: string, fim: string, horas: number, valor: number) => ({
    data, hora_inicio: ini, hora_fim: fim, horas, valor,
    situacao: "realizado", local: "FUNDHOSPAR", profissional: "Gustavo Segobia",
  });
  const { corpo } = folhaDePlantoesPorLocal([
    doDia("2026-08-01", "07:00", "07:00", 24, 2000),
    doDia("2026-08-02", "07:00", "07:00", 24, 2000),
    doDia("2026-08-28", "07:00", "19:00", 12, 1000),
    doDia("2026-08-28", "19:00", "07:00", 12, 1000),
    doDia("2026-08-29", "07:00", "07:00", 24, 2000),
    doDia("2026-08-30", "07:00", "07:00", 24, 2000),
  ], "agosto", 2026, new Date("2026-09-01T12:00:00"));
  assert.match(corpo, /FUNDHOSPAR <small>10 plantões · 120,0 h/);
  // A tabela continua listando os seis lançamentos como foram feitos: o de 24
  // horas é uma linha só, porque foi um plantão de trabalho corrido.
  assert.equal(corpo.match(/<tr><td>\d+\/08<\/td>/g)?.length, 6);
});

test("a assinatura traz a marca, o slogan e a data", () => {
  // Ela não mora mais no corpo das folhas: quem a coloca é a janela de
  // impressão, uma vez, fora do papel ampliado — só assim ela se repete em
  // TODA página de um documento de várias.
  const assinatura = assinaturaDaFolha(new Date("2026-09-01T12:00:00"));
  assert.match(assinatura, /class="assinatura"/);
  assert.match(assinatura, /<b>AVANEST<\/b>/);
  assert.match(assinatura, new RegExp(SLOGAN));
  assert.match(assinatura, /impresso em 01\/09\/2026/);
});

test("o corpo da folha não repete a assinatura", () => {
  // Repetida no corpo, ela sairia duas vezes na última página — a do rodapé
  // fixo e a do texto.
  const impressoEm = new Date("2026-09-01T12:00:00");
  const folhas = [
    folhaDoGrupo([turno("Santa Casa", "ANA PAULA DE SOUZA")]).corpo,
    folhaDeFechamento([], "agosto", 2026, impressoEm).corpo,
    folhaDePlantoesPorLocal([], "agosto", 2026, impressoEm).corpo,
    folhaDeProducao([], "agosto", 2026, impressoEm).corpo,
    folhaDeFaturamento([], "agosto", 2026, impressoEm).corpo,
  ];
  for (const corpo of folhas) assert.doesNotMatch(corpo, /class="assinatura"/);
});

test("o desenho da marca vai embutido, e não como imagem de rede", () => {
  // A janela de impressão abre e fecha em segundos: uma imagem que ainda está
  // chegando sai como um quadrado vazio no papel.
  const assinatura = assinaturaDaFolha(new Date("2026-09-01T12:00:00"));
  assert.match(assinatura, /<svg viewBox="0 0 128 128"/);
  assert.ok(!assinatura.includes("<img"), "a marca não pode depender da rede");
});

test("quem cobre mais turnos do dia vem primeiro em todas as faixas", () => {
  // O caso do dia 7: Matheus faz manhã e tarde. Antes ele saía em segundo na
  // manhã e em primeiro na tarde, e para ver que era o mesmo Matheus emendando
  // doze horas o olho tinha de ler os quatro nomes e comparar.
  const ordem = ordemDentroDoDia([
    ["Luana", "Matheus"],   // manhã
    ["Matheus", "Lucas"],   // tarde
    ["Eder"],               // noite
  ]);
  assert.deepEqual(["Luana", "Matheus"].sort(ordem), ["Matheus", "Luana"]);
  assert.deepEqual(["Matheus", "Lucas"].sort(ordem), ["Matheus", "Lucas"]);
  // Encostado na esquerda das duas faixas: a emenda se lê na vertical.
});

test("o empate é desfeito pelo nome, e não pela ordem do banco", () => {
  // Sem isso, duas impressões do mesmo mês sairiam com as pastilhas trocadas
  // de lugar, e a folha da parede deixaria de bater com a da gaveta.
  const ordem = ordemDentroDoDia([["Bruna", "Ana", "Carla"]]);
  assert.deepEqual(["Carla", "Ana", "Bruna"].sort(ordem), ["Ana", "Bruna", "Carla"]);
});

test("a folha do grupo alinha quem emenda dois turnos", () => {
  const dia = (ini: string, fim: string, quem: string) => ({
    data: "2026-08-01", hora_inicio: ini, hora_fim: fim, horas: 6, valor: 900,
    situacao: "escalado", local: "Santa Casa", profissional: quem,
  });
  const { corpo } = folhaDoGrupo([
    dia("07:00", "13:00", "LUANA ZANETTIN"),
    dia("07:00", "13:00", "MATHEUS GOMES"),
    dia("13:00", "19:00", "MATHEUS GOMES"),
    dia("13:00", "19:00", "LUCAS QUIJO"),
  ], new Map([["LUANA ZANETTIN", "Luana"], ["MATHEUS GOMES", "Matheus"], ["LUCAS QUIJO", "Lucas"]]));
  // Matheus é a primeira pastilha da manhã E da tarde.
  assert.match(corpo, /<b>M<\/b><span class="q">(<u>[^<]*<\/u>)?<i class="p c\d+">Matheus<\/i>/);
  assert.match(corpo, /<b>T<\/b><span class="q">(<u>[^<]*<\/u>)?<i class="p c\d+">Matheus<\/i>/);
});

test("o mês do título sai em maiúsculas, com o resto da frase intacto", () => {
  // MAIÚSCULAS porque o título é lido de longe e é o que separa uma folha da
  // outra numa pilha. Só o mês sobe: "de 2026" é ligação, não nome.
  assert.equal(mesEmMaiusculas("setembro"), "SETEMBRO");
  assert.equal(mesEmMaiusculas("outubro"), "OUTUBRO");
  const { titulo } = folhaDoGrupo([turno("Santa Casa", "ANA PAULA DE SOUZA")]);
  assert.match(titulo, / — AGOSTO de 2026$/);
});

test("março vira MARÇO, e não MARCO", () => {
  // `toUpperCase()` genérico erra o ç em algumas implementações; a versão com
  // "pt-BR" é a que segue a nossa regra.
  assert.equal(mesEmMaiusculas("março"), "MARÇO");
});

test("a paleta tem cor para toda a equipe, sem repetir", () => {
  // Com oito cores, a equipe de treze punha duas pessoas em cada uma: cinco
  // pares no total. Duas manchas iguais na mesma folha é pior do que folha sem
  // cor, porque quem confere de longe lê a mancha e não o nome.
  const equipe = ["Ana", "Bruna", "Eder", "Flavio", "Gerusa", "Gustavo", "Igor",
                  "Lucas", "Luana", "Matheus", "Paulo", "Taylor", "Thais"];
  const cores = coresDaFolha(equipe);
  assert.equal(cores.size, equipe.length);
  assert.equal(new Set(cores.values()).size, equipe.length, "duas pessoas na mesma cor");
  assert.ok(PALETA_DA_FOLHA.length >= equipe.length,
    "a paleta precisa ter pelo menos uma cor por pessoa da equipe");
});
