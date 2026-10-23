import test from "node:test";
import assert from "node:assert/strict";
import {
  anestesistaDoTitulo, campoDoTitulo, casarAnestesista, casarSala, convenioLimpo, dataDoTexto, gradeDoCsv, gradeDePalavras,
  horaDaCelula, idadeDaCelula, juntarLeituras, lerMapa, nomeDaSala, nomeProprio, type Palavra,
} from "./centro-importar.ts";
import { gradeDaAba, gradeDoXlsx, posicaoDaCelula, textosCompartilhados } from "./xlsx-leitura.ts";
import { zip } from "./zip-de-teste.ts";

// O formato do mapa que o centro cirúrgico manda no grupo. Pacientes, médicos e
// a anestesista são fictícios.
const MAPA: string[][] = [
  ["21/10/2026  Quarta-Feira   ANESTESISTA DR: Fernanda"],
  ["0", "HORA", "PACIENTE", "IDADE", "CONVENIO", "MEDICO", "SALA", "PROCEDIMENTO", "OBSERVAÇÃO"],
  ["1", "07:30", "MARIA APARECIDA DA SILVA", "34", "UNIMED", "DR. PAULO M", "SALA 4", "RETIRADA DE CATETER DJ", "UNIMED"],
  ["2", "A/S", "JOAO DOS SANTOS", "76", "SUS", "DR. PAULO M", "SALA 1", "RTU DE PROSTATA", "9/3"],
  ["3", "A/S", "ANA LUIZA COSTA", "28", "SUS", "DR. PAULO M", "SALA 1", "URETERORRENO FLEXIVEL", "_"],
  ["4", "10:00", "CLARA PEREIRA", "54", "PARTICULAR", "DR. JOSE R", "SALA 3", "HTV", "109/1"],
  ["5", "", "", "", "", "", "", "", ""],
  ["6", "A/S", "PEDRO SEM CIRURGIA", "40", "SUS", "", "SALA 2", "", ""],
];

test("os títulos das colunas em qualquer grafia", () => {
  assert.equal(campoDoTitulo("CONVENIO"), "convenio");
  assert.equal(campoDoTitulo("Convênio"), "convenio");
  assert.equal(campoDoTitulo("MÉDICO"), "cirurgiao");
  assert.equal(campoDoTitulo("OBSERVAÇÃO"), "leito");
  assert.equal(campoDoTitulo("Horário"), "hora");
  assert.equal(campoDoTitulo("Procedimento"), "procedimento");
  assert.equal(campoDoTitulo("Nome do paciente"), "paciente");
  assert.equal(campoDoTitulo("qualquer coisa"), null);
  // A leitura de foto troca letra: "CONVENTO" é o CONVÊNIO; "C0NVENIO" também.
  assert.equal(campoDoTitulo("CONVENTO"), "convenio");
  assert.equal(campoDoTitulo("C0NVENIO"), "convenio");
  assert.equal(campoDoTitulo("PROCEDIMENT0"), "procedimento");
  assert.equal(campoDoTitulo("PACIENTF"), "paciente");
  // Palavra curta não tem tolerância: "SALE" não é SALA, "MORA" não é HORA.
  assert.equal(campoDoTitulo("SALE"), null);
  assert.equal(campoDoTitulo("MORA"), null);
  assert.equal(campoDoTitulo("UNIMED"), null);
});

test("hora, data e anestesista do jeito que o mapa escreve", () => {
  assert.equal(horaDaCelula("07:30"), "07:30");
  assert.equal(horaDaCelula("7h30"), "07:30");
  assert.equal(horaDaCelula("14h"), "14:00");
  assert.equal(horaDaCelula("14:00:00"), "14:00");
  assert.equal(horaDaCelula("0.3125"), "07:30");   // a fração de dia do Excel
  assert.equal(horaDaCelula("0,75"), "18:00");
  assert.equal(horaDaCelula("A/S"), null);
  assert.equal(horaDaCelula("a / s"), null);
  assert.equal(horaDaCelula(""), null);
  assert.equal(horaDaCelula("25:00"), null);
  assert.equal(dataDoTexto("21/10/2026  Quarta-Feira"), "2026-10-21");
  assert.equal(dataDoTexto("mapa de 5/3/26"), "2026-03-05");
  assert.equal(dataDoTexto("46316"), "2026-10-21");  // a data do Excel
  assert.equal(dataDoTexto("sem data"), null);
  assert.equal(anestesistaDoTitulo("21/10/2026 Quarta-Feira ANESTESISTA DR: Fernanda"), "Fernanda");
  assert.equal(anestesistaDoTitulo("Anestesista: Dra. Ana Lima"), "Ana Lima");
  assert.equal(anestesistaDoTitulo("21/10/2026"), null);
});

test("o convênio na grafia do sistema, e a letra dobrada da foto desfeita", () => {
  assert.equal(convenioLimpo("UNIMED"), "Unimed");
  assert.equal(convenioLimpo("unimed"), "Unimed");
  assert.equal(convenioLimpo("PARTICULAR"), "Particular");
  assert.equal(convenioLimpo("sus"), "SUS");
  assert.equal(convenioLimpo("sus Cc"), "SUS C");
  assert.equal(convenioLimpo("SUS  C"), "SUS C");
  assert.equal(convenioLimpo("Bradesco saúde"), "Bradesco Saúde");
  assert.equal(convenioLimpo("Cassems"), "CASSEMS");
});

test("nomes e salas arrumados", () => {
  assert.equal(nomeProprio("MARIA APARECIDA DA SILVA"), "Maria Aparecida da Silva");
  assert.equal(nomeProprio("joão dos santos"), "João dos Santos");
  assert.equal(nomeDaSala("SALA 4"), "Sala 4");
  assert.equal(nomeDaSala("4"), "Sala 4");
  assert.equal(nomeDaSala("_"), null);
  assert.equal(nomeDaSala("SALA"), null);
});

test("da grade do mapa saem os pacientes, na ordem, com A/S e leito", () => {
  const m = lerMapa(MAPA)!;
  assert.equal(m.data, "2026-10-21");
  assert.equal(m.anestesista, "Fernanda");
  assert.equal(m.ignoradas, 1);
  assert.deepEqual(m.linhas.map((l) => l.paciente), ["Maria Aparecida da Silva", "Joao dos Santos", "Ana Luiza Costa", "Clara Pereira"]);
  assert.deepEqual(m.linhas[0], {
    linha: 1, horario: "07:30", paciente: "Maria Aparecida da Silva", idade: 34, convenio: "Unimed",
    cirurgiao: "DR. PAULO M", sala: "Sala 4", procedimento: "RETIRADA DE CATETER DJ", leito: "UNIMED",
  });
  assert.equal(m.linhas[1].horario, null);
  assert.equal(m.linhas[1].leito, "9/3");
  assert.equal(m.linhas[2].leito, null);
  assert.equal(lerMapa([["sem", "títulos"], ["a", "b"]]), null);
});

test("sala e anestesista do arquivo casam com as cadastradas", () => {
  const salas = [{ nome: "Sala 1" }, { nome: "Sala 4" }];
  assert.equal(casarSala("SALA 4", salas)?.nome, "Sala 4");
  assert.equal(casarSala("4", salas)?.nome, "Sala 4");
  assert.equal(casarSala("Sala 9", salas), null);
  const equipe = [{ nome: "DRA FERNANDA" }, { nome: "DR PAULO" }, { nome: "DRA ANA" }, { nome: "DRA ANA PAULA" }];
  assert.equal(casarAnestesista("Fernanda", equipe)?.nome, "DRA FERNANDA");
  assert.equal(casarAnestesista("Dra. Fernanda", equipe)?.nome, "DRA FERNANDA");
  // Duas Anas: não adivinha.
  assert.equal(casarAnestesista("Ana", equipe), null);
  assert.equal(casarAnestesista(null, equipe), null);
});

test("o CSV do Excel em português (ponto e vírgula e aspas)", () => {
  const g = gradeDoCsv('HORA;PACIENTE;PROCEDIMENTO;SALA\r\n07:30;"SILVA; MARIA";"HERNIA ""UMBILICAL""";SALA 1\r\n');
  assert.deepEqual(g[1], ["07:30", "SILVA; MARIA", 'HERNIA "UMBILICAL"', "SALA 1"]);
  const m = lerMapa(g)!;
  assert.equal(m.linhas[0].procedimento, 'HERNIA "UMBILICAL"');
});

// Palavras com posição, como o PDF e a foto entregam: x e y em pixels.
const palavra = (t: string, x: number, y: number, largura = t.length * 8): Palavra =>
  ({ t, x0: x, x1: x + largura, y0: y, y1: y + 14 });

test("das palavras soltas do PDF ou da foto, a tabela de volta — com a cirurgia quebrada em duas linhas", () => {
  const p: Palavra[] = [
    palavra("21/10/2026", 300, 10), palavra("ANESTESISTA", 500, 10), palavra("DR:", 600, 10), palavra("Fernanda", 640, 10),
    palavra("0", 5, 40), palavra("HORA", 40, 40), palavra("PACIENTE", 160, 40), palavra("IDADE", 420, 40),
    palavra("CONVENIO", 490, 40), palavra("MEDICO", 620, 40), palavra("SALA", 760, 40), palavra("PROCEDIMENTO", 880, 40),
    palavra("OBSERVAÇÃO", 1100, 40),
    // Linha 1, numa linha só.
    palavra("1", 8, 80), palavra("07:30", 40, 80), palavra("MARIA", 130, 80), palavra("SILVA", 180, 80), palavra("34", 425, 80),
    palavra("UNIMED", 495, 80), palavra("DR.", 610, 80), palavra("PAULO", 635, 80), palavra("SALA", 755, 80), palavra("4", 795, 80),
    palavra("RETIRADA", 860, 80), palavra("DE", 935, 80), palavra("CATETER", 955, 80), palavra("UNIMED", 1110, 80),
    // Linha 2: a cirurgia em duas linhas, acima e abaixo do centro da célula.
    palavra("FRATURA", 850, 112), palavra("DE", 915, 112), palavra("PLATO", 935, 112),
    palavra("2", 8, 120), palavra("08:00", 40, 120), palavra("ANA", 150, 120), palavra("COSTA", 185, 120), palavra("51", 425, 120),
    palavra("SUS", 505, 120), palavra("DR.", 610, 120), palavra("DHENNIS", 635, 120), palavra("SALA", 755, 120), palavra("2", 795, 120),
    palavra("9/1", 1120, 120),
    palavra("JOELHO", 850, 128), palavra("DIREITO", 905, 128),
    // Linha 3: A/S e observação "_".
    palavra("3", 8, 160), palavra("A/S", 45, 160), palavra("JOSE", 150, 160), palavra("COSTA", 190, 160), palavra("52", 425, 160),
    palavra("SUS", 505, 160), palavra("DR.", 610, 160), palavra("DHENNIS", 635, 160), palavra("SALA", 755, 160), palavra("2", 795, 160),
    palavra("RETIRADA", 860, 160), palavra("DE", 935, 160), palavra("FIO", 955, 160), palavra("_", 1125, 160),
  ];
  const grade = gradeDePalavras(p)!;
  const m = lerMapa(grade)!;
  assert.equal(m.data, "2026-10-21");
  assert.equal(m.anestesista, "Fernanda");
  assert.deepEqual(m.linhas.map((l) => [l.horario, l.paciente, l.idade, l.convenio, l.sala, l.procedimento, l.leito]), [
    ["07:30", "Maria Silva", 34, "Unimed", "Sala 4", "RETIRADA DE CATETER", "UNIMED"],
    ["08:00", "Ana Costa", 51, "SUS", "Sala 2", "FRATURA DE PLATO JOELHO DIREITO", "9/1"],
    [null, "Jose Costa", 52, "SUS", "Sala 2", "RETIRADA DE FIO", null],
  ]);
  assert.equal(gradeDePalavras([palavra("nada", 0, 0)]), null);
});

test("duas leituras da foto juntas: a firme da primeira fica, o chute dá lugar à segunda", () => {
  const lida = (t: string, x: number, y: number, c: number, largura?: number) => ({ ...palavra(t, x, y, largura), c });
  const automatica = [
    lida("SALA", 755, 120, 92), lida("2", 795, 120, 88),
    // A cirurgia em duas linhas, embaralhada: chutes de baixa confiança.
    lida("irradia", 850, 116, 11), lida("o", 935, 116, 23),
  ];
  const esparsa = [
    // "SALA" sem o número, por cima da leitura firme: não entra.
    lida("SALA", 752, 120, 95, 50),
    lida("FRATURA", 850, 112, 96), lida("DE", 915, 112, 93), lida("PLATO", 935, 112, 91),
    lida("JOELHO", 850, 128, 96),
    // Fraca nas duas: não entra.
    lida("xx", 1000, 112, 40),
  ];
  assert.deepEqual(juntarLeituras(automatica, esparsa).map((p) => p.t), ["SALA", "2", "FRATURA", "DE", "PLATO", "JOELHO"]);
  // A mesma caixa lida pelas duas: fica a leitura mais certa.
  assert.deepEqual(juntarLeituras([lida("23530", 40, 160, 49, 45)], [lida("13:30", 40, 160, 96, 45)]).map((p) => p.t), ["13:30"]);
  assert.deepEqual(juntarLeituras([lida("13:30", 40, 160, 90, 45)], [lida("13530", 40, 160, 70, 45)]).map((p) => p.t), ["13:30"]);
});

test("a idade com a letra que o OCR troca pelo dígito", () => {
  assert.equal(idadeDaCelula("72"), 72);
  assert.equal(idadeDaCelula("F2"), 72);
  assert.equal(idadeDaCelula("5O"), 50);
  assert.equal(idadeDaCelula("72 anos"), 72);
  assert.equal(idadeDaCelula("8a"), 8);
  assert.equal(idadeDaCelula(""), null);
  assert.equal(idadeDaCelula("-"), null);
  assert.equal(idadeDaCelula("200"), null);
});

test("a borda da tabela lida como “|” não entra na célula", () => {
  const p: Palavra[] = [
    palavra("HORA", 40, 40), palavra("PACIENTE", 160, 40), palavra("CONVENIO", 490, 40), palavra("PROCEDIMENTO", 880, 40),
    palavra("07:30", 40, 80), palavra("MARIA", 160, 80), palavra("|", 485, 80), palavra("PARTICULAR|", 495, 80), palavra("HTV", 880, 80),
    palavra("08:00", 40, 120), palavra("ANA", 160, 120), palavra("SUS", 495, 120), palavra("RTU", 880, 120),
  ];
  assert.deepEqual(lerMapa(gradeDePalavras(p)!)!.linhas.map((l) => l.convenio), ["Particular", "SUS"]);
});

// ---------------------------------------------------------------------------
// A planilha .xlsx
// ---------------------------------------------------------------------------

test("as peças do .xlsx: endereço da célula, textos compartilhados e a aba", () => {
  assert.deepEqual(posicaoDaCelula("A1"), { linha: 0, coluna: 0 });
  assert.deepEqual(posicaoDaCelula("AB12"), { linha: 11, coluna: 27 });
  assert.deepEqual(textosCompartilhados('<sst><si><t>HORA</t></si><si><r><t>RTU </t></r><r><t xml:space="preserve">&amp; MAIS</t></r></si></sst>'), ["HORA", "RTU & MAIS"]);
  const g = gradeDaAba('<sheetData><row r="1"><c r="B1" t="s"><v>0</v></c><c r="D1"><v>0.3125</v></c><c r="E1" t="inlineStr"><is><t>SALA 2</t></is></c></row></sheetData>', ["HORA"]);
  assert.deepEqual(g, [["", "HORA", "", "0.3125", "SALA 2"]]);
});

test("a planilha .xlsx inteira vira o mapa: a primeira aba do livro, a hora do Excel em fração", async () => {
  const textos = ["21/10/2026 ANESTESISTA DR: Fernanda", "HORA", "PACIENTE", "PROCEDIMENTO", "SALA", "CONVENIO",
    "MARIA DA SILVA", "HERNIOPLASTIA", "SALA 1", "SUS", "JOSE COSTA", "COLECISTECTOMIA"];
  const si = textos.map((t) => `<si><t>${t}</t></si>`).join("");
  const s = (i: number) => `t="s"><v>${i}</v></c>`;
  const aba = `<worksheet><sheetData>
    <row r="1"><c r="A1" ${s(0)}</row>
    <row r="3"><c r="A3" ${s(1)}<c r="B3" ${s(2)}<c r="C3" ${s(3)}<c r="D3" ${s(4)}<c r="E3" ${s(5)}</row>
    <row r="4"><c r="A4"><v>0.3125</v></c><c r="B4" ${s(6)}<c r="C4" ${s(7)}<c r="D4" ${s(8)}<c r="E4" ${s(9)}</row>
    <row r="5"><c r="B5" ${s(10)}<c r="C5" ${s(11)}<c r="D5" ${s(8)}</row>
  </sheetData></worksheet>`;
  const arquivo = zip({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Mapa" sheetId="1" r:id="rId7"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId7" Type="x" Target="worksheets/mapa.xml"/></Relationships>',
    "xl/sharedStrings.xml": `<sst>${si}</sst>`,
    "xl/worksheets/mapa.xml": aba,
  });
  const m = lerMapa(await gradeDoXlsx(arquivo))!;
  assert.equal(m.data, "2026-10-21");
  assert.equal(m.anestesista, "Fernanda");
  assert.deepEqual(m.linhas.map((l) => [l.horario, l.paciente, l.procedimento, l.sala, l.convenio]), [
    ["07:30", "Maria da Silva", "HERNIOPLASTIA", "Sala 1", "SUS"],
    [null, "Jose Costa", "COLECISTECTOMIA", "Sala 1", null],
  ]);
  await assert.rejects(gradeDoXlsx(new TextEncoder().encode("não é zip").buffer), /não é uma planilha/);
});
