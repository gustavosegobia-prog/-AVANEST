import test from "node:test";
import assert from "node:assert/strict";
import {
  A4_DEITADA, conteudoDosDias, escalaEmPdf, larguraDasPastilhas, recuoDoDia, tituloDaFolha,
} from "./escala-pdf.ts";

const plantao = (data: string, inicio: string, fim: string, quem: string, local = "Santa Casa") => ({
  data, hora_inicio: inicio, hora_fim: fim, horas: 6, valor: 900,
  situacao: "confirmado", local, profissional: quem,
});

const folha = (extra: Partial<Parameters<typeof escalaEmPdf>[0]> = {}) => ({
  doGrupo: true, mes: "2026-09", nomeMes: "setembro", ano: 2026,
  diasNoMes: 30, primeiroDiaSemana: 2, impressoEm: new Date("2026-09-03T14:30:00"),
  plantoes: [
    plantao("2026-09-01", "07:00", "13:00", "Thais Ferreira"),
    plantao("2026-09-01", "13:00", "19:00", "Matheus Gomes"),
    plantao("2026-09-15", "19:00", "07:00", "Ana Souza"),
  ],
  // Como o componente chama de verdade: o MESMO apelido dos botões de escalar e
  // das etiquetas do calendário. Sem ele `nomeCurto` devolve nome e sobrenome,
  // que na pastilha empilha uma pessoa por linha e faz a folha sair menor.
  apelidos: new Map([
    ["Thais Ferreira", "Thais"], ["Matheus Gomes", "Matheus"], ["Ana Souza", "Ana"],
  ]),
  ...extra,
});

test("a folha do grupo sai em três faixas por dia, sempre nas mesmas alturas", () => {
  // É o alinhamento que deixa ler "quem faz as noites desta semana" correndo o
  // olho na horizontal, em vez de dia por dia.
  const dias = conteudoDosDias(folha());
  assert.deepEqual(dias.get(1)!.map((f) => f.letra), ["M", "T", "N"]);
  assert.deepEqual(dias.get(1)!.map((f) => f.pastilhas.map((p) => p.texto)),
    [["Thais"], ["Matheus"], []]);
  // Dia sem plantão nenhum não desenha faixa: três traços num dia vago é ruído.
  assert.deepEqual(dias.get(2), []);
});

test("o plantão da noite atravessa a meia-noite e fica no dia em que começa", () => {
  const dias = conteudoDosDias(folha());
  assert.deepEqual(dias.get(15)!.map((f) => f.pastilhas.map((p) => p.texto)),
    [[], [], ["Ana"]]);
});

test("a folha pessoal pinta o HOSPITAL, e não a pessoa", () => {
  // Ali todo turno é seu; pintar o próprio nome não separaria nada.
  const dias = conteudoDosDias(folha({ doGrupo: false }));
  assert.deepEqual(dias.get(1)!.map((f) => f.pastilhas[0].texto),
    ["Santa Casa", "Santa Casa"]);
});

test("o plantão de 24 horas sai em Diurno e Noturno na folha pessoal", () => {
  // O mesmo corte da tela. Duas leituras diferentes do mesmo dia fariam
  // duvidar das duas.
  const dias = conteudoDosDias(folha({
    doGrupo: false,
    plantoes: [plantao("2026-09-10", "07:00", "07:00", "Gustavo Segobia")],
  }));
  assert.deepEqual(dias.get(10)!.map((f) => f.letra), ["Diurno", "Noturno"]);
});

test("as cores vêm da tela, e não são sorteadas de novo", () => {
  // Se a folha sorteasse por conta própria, o Matheus roxo da tela sairia verde
  // no papel — e a cor deixaria de ser atalho para virar mais uma conferência.
  const dias = conteudoDosDias(folha({ cores: new Map([["Thais", 5], ["Matheus", 2]]) }));
  assert.equal(dias.get(1)!.find((f) => f.letra === "M")!.pastilhas[0].cor, 5);
  assert.equal(dias.get(1)!.find((f) => f.letra === "T")!.pastilhas[0].cor, 2);
});

test("o título diz o hospital quando a folha é de um só", () => {
  assert.equal(tituloDaFolha(folha()),
    "Escala da equipe — Hospital Santa Casa — SETEMBRO de 2026".replace("Hospital Santa Casa", "Santa Casa"));
  assert.equal(tituloDaFolha(folha({ doGrupo: false })), "Meus plantões — SETEMBRO de 2026");
  // Com dois hospitais o nome sai do título: a folha não responde por um lugar
  // onde metade do que está impresso não aconteceu.
  const doisLugares = folha({
    plantoes: [plantao("2026-09-01", "07:00", "13:00", "A", "Santa Casa"),
               plantao("2026-09-02", "07:00", "13:00", "B", "Unimed")],
  });
  assert.equal(tituloDaFolha(doisLugares), "Escala da equipe — SETEMBRO de 2026");
});

test("UMA folha, deitada — que é o motivo deste arquivo existir", () => {
  const pdf = escalaEmPdf(folha());
  assert.equal((pdf.match(/\/Type \/Page[^s]/g) ?? []).length, 1, "tem de ser uma página só");
  assert.match(pdf, /\/Count 1/);
  const mb = pdf.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)!;
  assert.ok(Number(mb[1]) > Number(mb[2]), "a largura tem de ser maior que a altura");
  assert.equal(Number(mb[1]), Math.round(A4_DEITADA.largura * 100) / 100);
});

test("um mês cheio continua numa folha só, encolhendo a letra", () => {
  // Sete anestesistas, cinco por dia, o mês inteiro: é o pior caso real, e é
  // exatamente o mês que não pode virar duas páginas.
  const nomes = ["Gustavo S", "Thais F", "Matheus G", "Ana S", "Lucas Q", "Carla M", "Rafael N"];
  const plantoes = [];
  for (let d = 1; d <= 31; d++)
    for (let i = 0; i < 5; i++)
      plantoes.push(plantao(`2026-08-${String(d).padStart(2, "0")}`,
        ["07:00", "13:00", "19:00"][i % 3], ["13:00", "19:00", "07:00"][i % 3], nomes[(d + i) % 7]));
  const pdf = escalaEmPdf({
    ...folha(), mes: "2026-08", nomeMes: "agosto", diasNoMes: 31,
    primeiroDiaSemana: 6, plantoes,
  });
  assert.equal((pdf.match(/\/Type \/Page[^s]/g) ?? []).length, 1);
});

test("nada é desenhado fora da folha", () => {
  // Um retângulo com Y negativo ou acima da altura não dá erro nenhum: some no
  // papel, em silêncio. É o tipo de defeito que só aparece impresso.
  const pdf = escalaEmPdf(folha());
  const conteudo = pdf.match(/stream\n([^]*?)\nendstream/)![1];
  for (const [, x, y, l, a] of conteudo.matchAll(/^([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) re f$/gm)) {
    assert.ok(Number(x) >= -0.01 && Number(y) >= -0.01, `retângulo fora: ${x},${y}`);
    assert.ok(Number(x) + Number(l) <= A4_DEITADA.largura + 0.01, `passa da direita: ${x}+${l}`);
    assert.ok(Number(y) + Number(a) <= A4_DEITADA.altura + 0.01, `passa do topo: ${y}+${a}`);
  }
  for (const [, x, y] of conteudo.matchAll(/Tf ([-\d.]+) ([-\d.]+) Td/g)) {
    assert.ok(Number(x) >= -0.01 && Number(x) <= A4_DEITADA.largura, `texto fora: x=${x}`);
    assert.ok(Number(y) >= -0.01 && Number(y) <= A4_DEITADA.altura, `texto fora: y=${y}`);
  }
});

test("o preto e branco não usa cor nenhuma nas pastilhas", () => {
  // A impressora do centro cirúrgico raramente tem cor, e uma pastilha colorida
  // impressa em cinza claro com letra branca por cima não se lê.
  const cores = new Map([["Thais", 1], ["Matheus", 2], ["Ana", 0]]);
  const emCores = escalaEmPdf(folha({ emCores: true, cores }));
  const semCores = escalaEmPdf(folha({ emCores: false, cores }));
  // O verde e o roxo da paleta aparecem na folha colorida...
  assert.ok(emCores.includes("0.05 0.48 0.36 rg"), "o verde da paleta tinha de estar aqui");
  // ...e nenhum tom da paleta sobra na de preto e branco.
  for (const cor of ["0.05 0.48 0.36", "0.48 0.29 0.74", "0.09 0.41 0.7"])
    assert.ok(!semCores.includes(`${cor} rg`), `sobrou cor da paleta: ${cor}`);
});

test("o rótulo do turno não fica embaixo da pastilha", () => {
  // Na folha do grupo o rótulo é uma letra. Na PESSOAL é o turno por extenso —
  // "07-13h", "Diurno", "Noturno" —, e com um recuo fixo a pastilha do hospital
  // era desenhada por cima dele: saía "Diu" e "Not" espiando debaixo do azul.
  const umaLetra = recuoDoDia([{ letra: "M", pastilhas: [] }], 9);
  const porExtenso = recuoDoDia([
    { letra: "Diurno", pastilhas: [] }, { letra: "Noturno", pastilhas: [] },
  ], 9);
  assert.ok(porExtenso > umaLetra + 20, `recuo curto demais: ${porExtenso}`);
  // E o recuo é o do rótulo MAIS LARGO da célula, para as pastilhas do mesmo
  // dia começarem todas na mesma coluna.
  assert.equal(recuoDoDia([{ letra: "M", pastilhas: [] }, { letra: "Noturno", pastilhas: [] }], 9),
    recuoDoDia([{ letra: "Noturno", pastilhas: [] }], 9));
});

/** Os nomes que a folha escreveu, na ordem em que foram desenhados. */
const nomesEscritos = (pdf: string) =>
  [...pdf.match(/stream\n([^]*?)\nendstream/)![1]
    .matchAll(/Td \((.*)\) Tj/g)].map((m) => m[1]);

test("UM TURNO NUNCA OCUPA DUAS LINHAS", () => {
  // Foi o pedido, e é o que faz a grade valer: as três tarjas do dia ficam na
  // mesma altura em todos os dias, e "quem faz as noites desta semana" se lê
  // correndo o olho na horizontal.
  const faixa = {
    letra: "M",
    pastilhas: [{ texto: "Matheus", cor: 1 }, { texto: "Luana", cor: 2 }, { texto: "Gerusa", cor: 3 }],
  };
  for (const util of [30, 55, 90, 140, 400]) {
    const larguras = larguraDasPastilhas(faixa, util, 9);
    assert.equal(larguras.length, 3, "toda pastilha tem de receber uma largura");
    const total = larguras.reduce((a, b) => a + b, 0) + 9 * 0.3 * 2;
    assert.ok(total <= util + 0.01, `estourou a linha em util=${util}: ${total}`);
    for (const l of larguras) assert.ok(l > 0);
  }
});

test("quem é estreito não encolhe junto com quem é largo", () => {
  // "Ana" ao lado de "Maria Fernanda" não tem por que virar "An…": a repartição
  // dá a cada um o que precisa e divide só a sobra.
  const faixa = {
    letra: "M",
    pastilhas: [{ texto: "Ana", cor: 1 }, { texto: "Maria Fernanda Albuquerque", cor: 2 }],
  };
  const [ana, maria] = larguraDasPastilhas(faixa, 70, 9);
  assert.equal(ana, larguraDasPastilhas({ letra: "M", pastilhas: [{ texto: "Ana", cor: 1 }] }, 999, 9)[0]);
  assert.ok(maria > ana, "o nome longo fica com a sobra");
});

test("o nome que cabe na pastilha não é cortado", () => {
  // A pastilha é feita sob medida para o nome — "largura do texto MAIS o
  // recheio" —, e a conta voltava a "menos o recheio" para saber quanto de
  // texto cabia. Em ponto flutuante essa ida e volta devolve 27.600000000000001
  // onde entrou 27.6, e "Gerusa" saía "Geru…" com meia célula vazia ao lado.
  const nomes = ["Gerusa", "Matheus", "Luana", "Thais"];
  const pdf = escalaEmPdf(folha({
    plantoes: nomes.map((quem, i) => plantao(`2026-09-${String(i + 1).padStart(2, "0")}`,
      "07:00", "13:00", quem)),
    apelidos: new Map(nomes.map((n) => [n, n])),
    cores: new Map(nomes.map((n, i) => [n, i])),
  }));
  const escritos = nomesEscritos(pdf);
  for (const nome of nomes)
    assert.ok(escritos.includes(nome), `"${nome}" saiu cortado: ${escritos.join(", ")}`);
  // O único texto que ainda pode levar reticências é o nome do feriado, que é
  // longo por natureza e mora numa faixa estreita ao lado do número do dia.
  const comReticencias = escritos.filter((t) => t.includes("\\205"));
  assert.deepEqual(comReticencias.filter((t) => nomes.some((n) => t.startsWith(n.slice(0, 3)))), [],
    `nome de gente cortado: ${comReticencias.join(", ")}`);
});

test("no preto e branco a pastilha é branca com contorno, e a legenda some", () => {
  // Pintar as quatorze cores todas do mesmo cinza-escuro deixava Eder, Matheus,
  // Lucas e Thais com pastilhas idênticas — pior do que não ter cor, porque
  // parece informação e não é. Sem cor, quem separa é o nome.
  const semCores = escalaEmPdf(folha({ emCores: false }));
  const conteudo = semCores.match(/stream\n([^]*?)\nendstream/)![1];
  for (const [, r, g, b] of conteudo.matchAll(/^([\d.]+) ([\d.]+) ([\d.]+) rg$/gm))
    assert.ok(r === g && g === b, `sobrou cor no preto e branco: ${r} ${g} ${b}`);
  // A legenda só liga cor a nome. Sem cor, ela não liga nada — e sai.
  const escritos = nomesEscritos(semCores);
  assert.equal(escritos.filter((t) => t === "Thais").length,
    nomesEscritos(escalaEmPdf(folha({ emCores: true }))).filter((t) => t === "Thais").length - 1,
    "a folha colorida tem o nome uma vez a mais: na legenda");
});
