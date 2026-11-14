import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { apagarLinhas, inclinacao, linhasDaTabela, tintaDe, type Cinza } from "./centro-foto.ts";
import { gradeDaFoto, gradeDePalavras, gradeSemTitulos, lerMapa, nomeDaSala, type Palavra } from "./centro-importar.ts";

// A foto do mapa IMPRESSO (14/11/2026: "às vezes não tem um arquivo e tem
// impresso aqui, só tirar a foto"). Pacientes, médicos e anestesista fictícios.
const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

/** Uma folha branca com a grade de uma tabela e "letras" (blocos pequenos). */
function folha(w: number, h: number, graus = 0): Cinza {
  const px = new Uint8ClampedArray(w * h).fill(235);
  const t = Math.tan((graus * Math.PI) / 180);
  const pinta = (x: number, y: number) => {
    const yy = Math.round(y + x * t);
    if (x >= 0 && x < w && yy >= 0 && yy < h) px[yy * w + Math.round(x)] = 30;
  };
  // Linhas horizontais da tabela, de 3 px.
  for (let y = 60; y <= h - 60; y += 40) for (let x = 40; x < w - 40; x++) for (let k = 0; k < 3; k++) pinta(x, y + k);
  // Linhas verticais.
  for (const x of [40, 120, 300, 420, w - 41]) for (let y = 60; y <= h - 58; y++) for (let k = 0; k < 3; k++) pinta(x + k, y);
  // "Letras": blocos de 7×12 dentro das células.
  for (let y = 74; y < h - 80; y += 40) for (let x = 140; x < 280; x += 11) for (let dy = 0; dy < 12; dy++) for (let dx = 0; dx < 7; dx++) pinta(x + dx, y + dy);
  return { w, h, px };
}

test("foto do mapa: a inclinação da folha é achada pelas linhas", () => {
  for (const graus of [0, 1.5, -2.2, 4]) {
    const f = folha(900, 600, graus);
    const achado = inclinacao(tintaDe(f), f.w, f.h);
    assert.ok(Math.abs(achado - graus) <= 0.15, `torta ${graus}°, achou ${achado}°`);
  }
});

test("foto do mapa: as linhas da tabela somem e as letras ficam", () => {
  const f = folha(900, 600);
  const linhas = linhasDaTabela(tintaDe(f), f.w, f.h);
  // Um ponto de linha horizontal, um de linha vertical e o meio de uma "letra".
  assert.equal(linhas[61 * f.w + 500], 1, "linha horizontal");
  assert.equal(linhas[200 * f.w + 121], 1, "linha vertical");
  assert.equal(linhas[(74 + 6) * f.w + 143], 0, "a letra não é linha");
  assert.ok(apagarLinhas(f, linhas) > 0);
  assert.equal(f.px[61 * f.w + 500], 255, "a linha virou papel");
  assert.equal(f.px[(74 + 6) * f.w + 143], 30, "a letra continua");
});

// Palavras como a foto entrega, sem os títulos das colunas: na folha impressa
// eles vêm em letra miúda, e o OCR os transforma em lixo baixinho.
const p = (t: string, x: number, y: number, altura = 22): Palavra => ({ t, x0: x, x1: x + t.length * 13, y0: y - altura / 2, y1: y + altura / 2 });
const SEM_TITULOS: Palavra[] = [
  p("16/11/2026", 850, 360, 30), p("Segunda", 1075, 360, 30), p("ANESTESISTA", 1270, 372), p("DR:", 1440, 372), p("Mariana", 1490, 372),
  // Os títulos miúdos, lidos como lixo.
  p("eo", 922, 418, 9), p("convemo", 1063, 418, 9), p("mEDICO", 1292, 418, 9), p("sa", 1480, 418, 9),
  // Linha 1.
  p("1", 280, 456), p("07:30", 367, 456), p("MARIA", 498, 456), p("APARECIDA", 565, 456), p("LIMA", 700, 456), p("s2", 927, 456),
  p("UNIMED", 1057, 456), p("DR.", 1248, 456), p("CARLOS", 1290, 456), p("SALA", 1464, 456), p("1", 1525, 456),
  p("COLECISTECTOMIA", 1620, 456), p("UNIMED", 1985, 456),
  // Linha 2: o nome em duas linhas.
  p("2", 280, 512), p("07:30", 367, 512), p("JOSE", 489, 502), p("ROBERTO", 546, 502), p("NETO", 560, 522), p("67", 931, 512),
  p("PARTICULAR", 1033, 512), p("DR.", 1266, 512), p("PAULO", 1304, 512), p("SALA2", 1464, 512),
  p("ARTROPLASTIA", 1591, 504), p("DE", 1760, 504), p("JOELHO", 1800, 504), p("DIREITO", 1700, 522), p("212/2", 1999, 512),
  // Linha 3.
  p("3", 280, 567), p("10:00", 368, 567), p("ANA", 579, 567), p("COSTA", 640, 567), p("8", 935, 567), p("SUS", 1079, 567),
  p("DRA.", 1263, 567), p("LUCIA", 1315, 567), p("SALA", 1464, 567), p("3", 1525, 567), p("AMIGDALECTOMIA", 1610, 567),
  // Linha 4: o "A/S" que o OCR não leu — a linha sai pelo nome.
  p("4", 280, 624), p("PEDRO", 555, 624), p("SOUZA", 640, 624), p("34", 931, 624), p("BRADESCO", 1044, 624),
  p("DR.", 1248, 624), p("CARLOS", 1290, 624), p("HERNIORRAFIA", 1595, 624), p("305/1", 2000, 624),
  // As linhas vazias da folha: só o número.
  p("5", 280, 680), p("6", 280, 736),
];

test("foto do mapa sem os títulos: cada coluna pelo que tem", () => {
  assert.equal(gradeDePalavras(SEM_TITULOS), null, "os títulos não foram lidos");
  const m = lerMapa(gradeSemTitulos(SEM_TITULOS)!, "2026-11-14")!;
  assert.equal(m.data, "2026-11-16");
  assert.equal(m.anestesista, "Mariana");
  assert.equal(m.ignoradas, 0);
  assert.deepEqual(m.linhas.map((l) => [l.horario, l.paciente, l.idade, l.convenio, l.cirurgiao, l.sala, l.procedimento, l.leito]), [
    ["07:30", "Maria Aparecida Lima", 52, "Unimed", "DR. CARLOS", "Sala 1", "COLECISTECTOMIA", "UNIMED"],
    ["07:30", "Jose Roberto Neto", 67, "Particular", "DR. PAULO", "Sala 2", "ARTROPLASTIA DE JOELHO DIREITO", "212/2"],
    ["10:00", "Ana Costa", 8, "SUS", "DRA. LUCIA", "Sala 3", "AMIGDALECTOMIA", null],
    [null, "Pedro Souza", 34, "BRADESCO", "DR. CARLOS", null, "HERNIORRAFIA", "305/1"],
  ]);
  // Sem horário nenhum, não há tabela.
  assert.equal(gradeSemTitulos(SEM_TITULOS.filter((q) => !/^\d\d:\d\d$/.test(q.t))), null);
});

test("foto do mapa: com só três títulos lidos, fica a leitura pelo conteúdo", () => {
  // HORA, PACIENTE e IDADE saíram; o resto grudou na coluna da idade, e os
  // pacientes viriam sem cirurgia.
  const tres = [...SEM_TITULOS, p("HORA", 367, 418, 20), p("PACIENTE", 560, 418, 20), p("IDADE", 925, 418, 20)];
  assert.equal(lerMapa(gradeDePalavras(tres)!, "2026-11-14")!.linhas.length, 0);
  const m = lerMapa(gradeDaFoto(tres, "2026-11-14")!, "2026-11-14")!;
  assert.equal(m.linhas.length, 4);
  assert.equal(m.linhas[1].procedimento, "ARTROPLASTIA DE JOELHO DIREITO");
});

test("a sala colada no número ou com a letra no lugar do dígito", () => {
  assert.equal(nomeDaSala("SALA1"), "Sala 1");
  assert.equal(nomeDaSala("SALA l"), "Sala 1");
  assert.equal(nomeDaSala("SALA 12"), "Sala 12");
  assert.equal(nomeDaSala("Sala Híbrida"), "Sala Híbrida");
});

test("foto do mapa: o botão abre a câmera e a janela já abre lendo", () => {
  const importar = ler("components/centro/importar.tsx");
  assert.match(importar, /<input ref=\{camera\} type="file" accept="image\/\*" capture="environment" hidden/);
  assert.match(importar, /\{mapa \? "Tirar outra foto" : "Tirar foto do mapa"\}/);
  assert.match(importar, /if \(!arquivoInicial \|\| comecou\.current\) return;/);
  for (const tela of ["components/centro/mapa-cirurgico.tsx", "app/evolucao/importar-mapa.tsx"]) {
    const c = ler(tela);
    assert.match(c, /<Icone nome="camera" tamanho=\{16\} \/> Foto do mapa/, tela);
    assert.match(c, /accept="image\/\*" capture="environment"/, tela);
    assert.match(c, /arquivoInicial=\{/, tela);
  }
  const leitura = ler("components/centro/ler-arquivo.ts");
  // A foto é endireitada e perde a grade antes do OCR; deitada, tenta virar.
  assert.match(leitura, /inclinacao\(tintaDe\(cinzaDoRgba\(dados\.data, w, h\)\), w, h\)/);
  assert.match(leitura, /apagarLinhas\(cinza, linhasDaTabela\(tintaDe\(cinza\), w, h\)\)/);
  assert.match(leitura, /for \(const giro of \[0, 90, 270\] as const\)/);
  assert.match(leitura, /const grade = gradeDaFoto\(palavras\);/);
});
