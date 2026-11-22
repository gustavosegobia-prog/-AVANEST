import test from "node:test";
import assert from "node:assert/strict";
import {
  casaNome, dataDaCelula, horarioDaSigla, horarioDoTexto, lerEscala, linhasDaGrade, linhasDePalavras,
  mesDasLinhas, plantoesDaPessoa, sugerirPessoa, turnosDaCelula,
} from "./escala-importar.ts";

// Importar a escala que o médico recebe (20/11/2026). Escalas e nomes fictícios.

test("horário escrito e siglas de turno", () => {
  assert.deepEqual(horarioDoTexto("07-19"), { inicio: "07:00", fim: "19:00" });
  assert.deepEqual(horarioDoTexto("7h às 19h"), { inicio: "07:00", fim: "19:00" });
  assert.deepEqual(horarioDoTexto("19x7"), { inicio: "19:00", fim: "07:00" });
  assert.deepEqual(horarioDoTexto("07:00 - 13:30"), { inicio: "07:00", fim: "13:30" });
  assert.deepEqual(horarioDoTexto("19h/07h"), { inicio: "19:00", fim: "07:00" });
  assert.equal(horarioDoTexto("05/11"), null, "data não é horário");
  assert.equal(horarioDoTexto("CRM 12345-6"), null);
  assert.deepEqual(horarioDaSigla("N"), { inicio: "19:00", fim: "07:00" });
  assert.deepEqual(horarioDaSigla("D"), { inicio: "07:00", fim: "19:00" });
  assert.deepEqual(horarioDaSigla("24h"), { inicio: "07:00", fim: "07:00" });
  assert.deepEqual(horarioDaSigla("Noturno"), { inicio: "19:00", fim: "07:00" });
  assert.deepEqual(horarioDaSigla("Diurno (07-19)"), { inicio: "07:00", fim: "19:00" });
  assert.equal(horarioDaSigla("X"), null, "sigla desconhecida: a tela pergunta");
  // A legenda da própria escala manda.
  assert.deepEqual(horarioDaSigla("N", { n: { inicio: "18:00", fim: "06:00" } }), { inicio: "18:00", fim: "06:00" });
  // Dois turnos emendados são um plantão só; folga não é plantão.
  assert.deepEqual(turnosDaCelula("D/N"), [{ codigo: "D/N", horario: { inicio: "07:00", fim: "07:00" } }]);
  assert.deepEqual(turnosDaCelula("M T"), [{ codigo: "M/T", horario: { inicio: "07:00", fim: "19:00" } }]);
  assert.deepEqual(turnosDaCelula("F"), []);
  assert.deepEqual(turnosDaCelula("Férias"), []);
});

test("datas e mês da escala", () => {
  assert.deepEqual(dataDaCelula("05/12"), { dia: 5, mes: 12, ano: null, resto: "" });
  assert.deepEqual(dataDaCelula("05/12/2026 seg"), { dia: 5, mes: 12, ano: 2026, resto: "" });
  assert.deepEqual(dataDaCelula("Sex 05"), { dia: 5, mes: null, ano: null, resto: "" });
  assert.deepEqual(dataDaCelula("05 - sexta"), { dia: 5, mes: null, ano: null, resto: "" });
  assert.deepEqual(dataDaCelula("46361"), { dia: 5, mes: 12, ano: 2026, resto: "" }, "a data da planilha");
  assert.equal(dataDaCelula("07-19"), null);
  assert.deepEqual(mesDasLinhas(linhasDaGrade([["ESCALA DE ANESTESIA — DEZEMBRO 2026"]])), { mes: 12, ano: 2026 });
  assert.deepEqual(mesDasLinhas(linhasDaGrade([["Escala", "dez/26"]])), { mes: 12, ano: 2026 });
  assert.deepEqual(mesDasLinhas(linhasDaGrade([["Escala 12/2026"]])), { mes: 12, ano: 2026 });
});

test("nome: o da lista, o digitado e a sugestão pelo cadastro", () => {
  assert.equal(casaNome("Dr. Fulano Beltrano", "Fulano Beltrano"), true);
  assert.equal(casaNome("FULANO B.", "Fulano Beltrano"), true);
  assert.equal(casaNome("Dra. Ciclana", "Fulano"), false);
  assert.equal(casaNome("Fulnao Beltrano", "Fulano Beltrano"), false, "uma letra trocada só vale de cinco letras para cima");
  assert.equal(casaNome("Beltrann", "Beltrano"), true);
  const pessoas = ["Fulano", "Fulano Ciclano", "Fulano B.", "Ana Paula"];
  assert.equal(sugerirPessoa(pessoas, "Fulano Beltrano da Silva"), "Fulano B.");
  assert.equal(sugerirPessoa(["Ana Paula", "Bruno"], "Fulano Beltrano"), null);
  assert.equal(sugerirPessoa(pessoas, "Fulano Beltrano", "Fulano"), "Fulano", "o nome da escala do grupo ganha");
});

test("grade: médicos nas linhas, dias nas colunas, mês e legenda do arquivo", () => {
  const dias = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const vazio = () => Array.from({ length: 31 }, () => "");
  const fulano = vazio(); fulano[0] = "D"; fulano[2] = "N"; fulano[4] = "D/N"; fulano[6] = "F"; fulano[9] = "X";
  const ana = vazio(); ana[0] = "N"; ana[1] = "D";
  const grade = [
    ["ESCALA DEZEMBRO 2026"],
    ["Anestesista", ...dias],
    ["", ...["S", "T", "Q", "Q", "S", "S", "D"], ...["S", "T", "Q", "Q", "S", "S", "D"]],
    ["1", "Dr. Fulano B.", ...fulano],
    ["2", "Dra. Ana Paula", ...ana],
    ["N = 19h às 7h"],
  ];
  // As linhas dos médicos têm o número na frente ("1", "2"): as outras ganham
  // uma célula vazia para as colunas dos dias ficarem no mesmo lugar.
  const e = lerEscala(linhasDaGrade(grade.map((l, i) => (i === 3 || i === 4 ? l : ["", ...l]))))!;
  assert.equal(e.formato, "grade");
  assert.equal(e.mes, "2026-12");
  assert.deepEqual(e.pessoas.sort(), ["Dr. Fulano B.", "Dra. Ana Paula"]);
  assert.deepEqual(plantoesDaPessoa(e, "Dr. Fulano B.", "2026-12"), [
    { data: "2026-12-01", codigo: "D", horario: { inicio: "07:00", fim: "19:00" } },
    { data: "2026-12-03", codigo: "N", horario: { inicio: "19:00", fim: "07:00" } },
    { data: "2026-12-05", codigo: "D/N", horario: { inicio: "07:00", fim: "07:00" } },
    { data: "2026-12-10", codigo: "X", horario: null },
  ]);
  assert.equal(sugerirPessoa(e.pessoas, "Fulano Beltrano"), "Dr. Fulano B.");
});

test("grade que atravessa o mês (21 a 20) e linha de dias com dia/mês", () => {
  const dias = [...Array.from({ length: 10 }, (_, i) => String(i + 21)), ...Array.from({ length: 5 }, (_, i) => String(i + 1))];
  const fulano = Array.from({ length: 15 }, () => "");
  fulano[0] = "D"; fulano[10] = "N"; fulano[14] = "12h";
  const e = lerEscala(linhasDaGrade([["Nome", ...dias], ["Fulano", ...fulano]]))!;
  assert.equal(e.mes, null);
  // 31/11 não existe e cai fora; 21/11 é o primeiro dia, 1/12 o 11º.
  assert.deepEqual(plantoesDaPessoa(e, "Fulano", "2026-11").map((p) => `${p.data} ${p.codigo}`),
    ["2026-11-21 D", "2026-12-01 N", "2026-12-05 12h"]);
});

test("grade deitada: dias nas linhas, médicos nas colunas", () => {
  const e = lerEscala(linhasDaGrade([
    ["Escala janeiro 2027"],
    ["Data", "Fulano", "Ana Paula", "Bruno"],
    ["01/01", "D", "N", ""],
    ["02/01", "", "D", "N"],
    ["03/01", "N", "", "D"],
  ]))!;
  assert.equal(e.formato, "por-dia");
  assert.ok(e.pessoas.includes("Fulano"));
  assert.deepEqual(plantoesDaPessoa(e, "Fulano", "2027-01").map((p) => `${p.data} ${p.codigo} ${p.horario?.inicio}`),
    ["2027-01-01 D 07:00", "2027-01-03 N 19:00"]);
});

test("por dia: turnos nas colunas, nomes nas células, dois nomes numa célula", () => {
  const e = lerEscala(linhasDaGrade([
    ["Data", "Diurno 07-19", "Noturno 19-07"],
    ["seg 07/12", "Fulano / Ana Paula", "Bruno"],
    ["ter 08/12", "Bruno", "Fulano"],
    ["qua 09/12", "Ana Paula", "Bruno"],
  ]))!;
  assert.equal(e.formato, "por-dia");
  assert.deepEqual(e.pessoas.slice(0, 3).sort(), ["Ana Paula", "Bruno", "Fulano"]);
  assert.deepEqual(plantoesDaPessoa(e, "Fulano", "2026-12"), [
    { data: "2026-12-07", codigo: "Diurno 07-19", horario: { inicio: "07:00", fim: "19:00" } },
    { data: "2026-12-08", codigo: "Noturno 19-07", horario: { inicio: "19:00", fim: "07:00" } },
  ]);
  // Digitado em vez de escolhido: casa pelo nome.
  assert.equal(plantoesDaPessoa(e, "fulano", "2026-12").length, 2);
});

test("lista: data, nome, início e fim; e a planilha com hora em fração de dia", () => {
  const e = lerEscala(linhasDaGrade([
    ["Data", "Médico", "Início", "Fim", "Local"],
    ["05/12/2026", "Dr. Carlos", "07:00", "19:00", "Hospital Teste"],
    ["06/12/2026", "Dr. Fulano", "0.791666666", "0.291666666", "Hospital Teste"],
    ["07/12/2026", "Dr. Fulano", "N", "", "Hospital Teste"],
  ]))!;
  assert.deepEqual(plantoesDaPessoa(e, "Fulano", "2026-12"), [
    { data: "2026-12-06", codigo: "19:00–07:00", horario: { inicio: "19:00", fim: "07:00" } },
    { data: "2026-12-07", codigo: "N", horario: { inicio: "19:00", fim: "07:00" } },
  ]);
  // Ano sem escrever: o mais perto do mês da escala (janeiro lido em dezembro é do ano seguinte).
  const virada = lerEscala(linhasDaGrade([["30/12", "Fulano 07-19"], ["02/01", "Fulano 19-07"]]))!;
  assert.deepEqual(plantoesDaPessoa(virada, "Fulano", "2026-12").map((p) => p.data), ["2026-12-30", "2027-01-02"]);
});

test("PDF e foto: palavras com posição viram linhas e colunas da grade", () => {
  const palavras: Array<{ t: string; x0: number; x1: number; y0: number; y1: number }> = [];
  const y = (l: number) => ({ y0: 100 + l * 20, y1: 110 + l * 20 });
  palavras.push({ t: "Escala", x0: 10, x1: 50, ...y(0) }, { t: "Novembro", x0: 54, x1: 110, ...y(0) }, { t: "2026", x0: 114, x1: 140, ...y(0) });
  palavras.push({ t: "Nome", x0: 10, x1: 40, ...y(1) });
  for (let d = 1; d <= 10; d++) palavras.push({ t: String(d), x0: 100 + d * 20, x1: 106 + d * 20, ...y(1) });
  palavras.push({ t: "Dr.", x0: 10, x1: 24, ...y(2) }, { t: "Fulano", x0: 27, x1: 60, y0: 141, y1: 151 });
  palavras.push({ t: "D", x0: 121, x1: 126, ...y(2) }, { t: "N", x0: 181, x1: 186, ...y(2) });
  const linhas = linhasDePalavras(palavras);
  assert.equal(linhas.length, 3);
  assert.equal(linhas[2][0].t, "Dr. Fulano", "palavras próximas são a mesma célula");
  const e = lerEscala(linhas)!;
  assert.equal(e.formato, "grade");
  assert.deepEqual(plantoesDaPessoa(e, "Dr. Fulano", e.mes ?? "2026-11").map((p) => `${p.data} ${p.codigo}`),
    ["2026-11-01 D", "2026-11-04 N"]);
});

test("arquivo sem escala nenhuma: nada lido", () => {
  assert.equal(lerEscala(linhasDaGrade([["Relatório"], ["Paciente", "Convênio"], ["Fulano", "Particular"]])), null);
});

test("foto: letras de dias vizinhos emendadas numa palavra voltam cada uma ao seu dia; DIN é D/N", () => {
  const y = (l: number) => ({ y0: 100 + l * 30, y1: 112 + l * 30 });
  const palavras = [{ t: "Nome", x0: 10, x1: 40, ...y(0) }];
  for (let d = 1; d <= 8; d++) palavras.push({ t: String(d), x0: 100 + d * 30, x1: 108 + d * 30, ...y(0) });
  // "F T D N" nos dias 2 a 5, lidos como "FTDN"; "DIN" no dia 7.
  palavras.push({ t: "Fulano", x0: 10, x1: 50, ...y(1) }, { t: "FTDN", x0: 159, x1: 251, ...y(1) }, { t: "DIN", x0: 307, x1: 322, ...y(1) });
  const e = lerEscala(linhasDePalavras(palavras))!;
  assert.deepEqual(plantoesDaPessoa(e, "Fulano", "2026-12").map((p) => `${p.data.slice(8)} ${p.codigo}`),
    ["03 T", "04 D", "05 N", "07 D/N"]);
});

test("tela: importar só na Minha escala, do próprio médico, sem duplicar", async () => {
  const fs = await import("node:fs");
  const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
  const plantoes = ler("components/plantoes.tsx");
  assert.match(plantoes, /\{escopo === "minha" && \(\s*<button className="outlineClinical" onClick=\{\(\) => \{ setErro\(""\); setAviso\(""\); setImportando\(true\); \}\}/);
  assert.match(plantoes, /valorDoLocal=\{\(alvo\) => valorDoHospital\(perfilId, alvo, 0\)\}/);
  const janela = ler("components/importar-escala.tsx");
  // Sempre para quem importa; o que já está na escala vem desmarcado; o repetido que escapar o banco recusa e a tela conta.
  assert.match(janela, /institution_id: institutionId, perfil_id: perfilId, \.\.\.lugar, privado,/);
  assert.match(janela, /\.eq\("perfil_id", perfilId\)\.neq\("situacao", "cancelado"\)\.gte\("data", de\)\.lte\("data", ate\)/);
  assert.match(janela, /const marcado = \(p: [^)]*\) => escolha\.get\(chave\(p\)\) \?\? !jaTem\(p\);/);
  assert.match(janela, /else if \(e\.code === "23505"\) jaEstavam\+\+;/);
  // O mesmo padrão do lançamento à mão: quem não monta a escala começa em "Só meu".
  assert.match(janela, /const \[privado, setPrivado\] = useState\(!ehAdmin\);/);
});

test("escala do grupo: cada nome da escala vai para o colega certo, e o empate não escolhe", async () => {
  const { colegaDaPessoa } = await import("./escala-importar.ts");
  const colegas = [
    { id: "f", nome: "Fulano Beltrano da Silva", apelido: "Fulano" },
    { id: "a", nome: "Ana Paula Souza", apelido: "Ana" },
    { id: "b", nome: "Bruno Costa", apelido: null },
    { id: "c", nome: "Carla Dias" },
  ];
  assert.equal(colegaDaPessoa("Dr. Fulano B.", colegas), "f");
  assert.equal(colegaDaPessoa("Fulano", colegas), "f", "o apelido ganha");
  assert.equal(colegaDaPessoa("Dra. Ana Paula", colegas), "a");
  assert.equal(colegaDaPessoa("BRUNO C.", colegas), "b");
  assert.equal(colegaDaPessoa("Dr. Diego E.", colegas), null, "quem não é da equipe fica sem colega");
  // Dois Fulanos na equipe e a escala diz só "Dr. Fulano": a pessoa escolhe.
  assert.equal(colegaDaPessoa("Dr. Fulano", [{ id: "1", nome: "Fulano Silva" }, { id: "2", nome: "Fulano Souza" }]), null);
});

test("PDF apertado: dois dias vizinhos com a mesma sigla, juntados numa célula \"D D\", voltam a ser dois", () => {
  const y = (l: number) => ({ y0: 100 + l * 30, y1: 112 + l * 30 });
  const palavras = [{ t: "Nome", x0: 10, x1: 40, ...y(0) }];
  for (let d = 1; d <= 8; d++) palavras.push({ t: String(d), x0: 100 + d * 30, x1: 108 + d * 30, ...y(0) });
  palavras.push({ t: "Fulano", x0: 10, x1: 50, ...y(1) }, { t: "D D", x0: 219, x1: 251, ...y(1) });
  const e = lerEscala([...linhasDePalavras(palavras.slice(0, 9)), [{ t: "Fulano", x0: 10, x1: 50 }, { t: "D D", x0: 219, x1: 251 }]])!;
  assert.deepEqual(plantoesDaPessoa(e, "Fulano", "2026-12").map((p) => `${p.data.slice(8)} ${p.codigo}`), ["04 D", "05 D"]);
});

test("PDF apertado: \"D/N D/N\" de dois dias vizinhos são dois plantões de 24 h", () => {
  const cab = [{ t: "Nome", x0: 10, x1: 40 }, ...Array.from({ length: 8 }, (_, i) => ({ t: String(i + 1), x0: 130 + i * 30, x1: 138 + i * 30 }))];
  const e = lerEscala([cab, [{ t: "Fulano", x0: 10, x1: 50 }, { t: "D/N D/N", x0: 158, x1: 202 }]])!;
  assert.deepEqual(plantoesDaPessoa(e, "Fulano", "2026-12").map((p) => `${p.data.slice(8)} ${p.codigo} ${p.horario?.fim}`), ["02 D/N 07:00", "03 D/N 07:00"]);
});

test("tela: a escala do grupo só para quem monta a escala, cada um com o seu valor, sem duplicar", async () => {
  const fs = await import("node:fs");
  const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
  const plantoes = ler("components/plantoes.tsx");
  assert.match(plantoes, /\{ehAdmin && escopo === "grupo" && \(\s*<button className="outlineClinical" onClick=\{\(\) => \{ setErro\(""\); setAviso\(""\); setImportandoGrupo\(true\); \}\}/);
  assert.match(plantoes, /colegas=\{escalaveis\.map\(\(c\) => \(\{ id: c\.id, nome: c\.nome, apelido: apelidos\.get\(c\.id\) \?\? null \}\)\)\}/);
  assert.match(plantoes, /valorDoColega=\{\(dono, alvo\) => valorDoHospital\(dono, alvo, 0\)\}/);
  const janela = ler("components/importar-escala-do-grupo.tsx");
  assert.match(janela, /institution_id: institutionId, perfil_id: dono, \.\.\.lugar, privado: false,/);
  assert.match(janela, /valor, created_by: perfilId,/);
  assert.match(janela, /\.in\("perfil_id", lista\.split\(","\)\)\.neq\("situacao", "cancelado"\)\.gte\("data", de\)\.lte\("data", ate\)/);
  assert.match(janela, /else if \(e\.code !== "23505"\) throw e;/);
  assert.match(janela, /setMapa\(Object\.fromEntries\(lida\.pessoas\.map\(\(p\) => \[p, colegaDaPessoa\(p, colegas\) \?\? NINGUEM\]\)\)\);/);
});
