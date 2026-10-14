import test from "node:test";
import assert from "node:assert/strict";
import {
  chaveDaLeitura, consertarSequencia, horaDoTexto, juntarPalavras, montar, planejar, SELO_ILEGIVEL, type Palavra,
} from "./grade-do-monitor.ts";

// Palavras de mentira, como o OCR devolve: texto e retângulo de 0 a 1.
const p = (t: string, x: number, y: number, larg = 0.04, alt = 0.024, c = 90): Palavra =>
  ({ t, x0: x - larg / 2, x1: x + larg / 2, y0: y - alt / 2, y1: y + alt / 2, c });

/** A "Tend tabulares": horários no alto, FC / SpO₂ / PNI na margem, o selo da PNI embaixo do valor. */
function deitada(o: { horas?: Array<string | null>; selos?: Array<string | null> } = {}) {
  const horas = o.horas ?? ["08:10", "08:20", "08:30"];
  const selos = o.selos ?? ["[08:05]", "[08:15]", "[08:25]"];
  const xs = [0.3, 0.45, 0.6];
  const fc = ["72", "70", "68"], spo2 = ["98", "97", "99"];
  const pni = [["118", "/72", "(87)"], ["112", "/68", "(83)"], ["105", "/63", "(77)"]];
  return [
    p("02-03-2026", 0.08, 0.27, 0.1),
    ...horas.flatMap((h, i) => (h ? [p(h, xs[i], 0.27)] : [])),
    p("FC", 0.12, 0.33), p("bpm", 0.12, 0.37),
    p("SpO2", 0.12, 0.41), p("%", 0.13, 0.45, 0.01),
    p("PNI", 0.12, 0.49), p("mmHg", 0.12, 0.53),
    p("FR", 0.12, 0.57),
    ...xs.flatMap((x, i) => [
      p(fc[i], x, 0.33), p(spo2[i], x, 0.41),
      p(pni[i][0], x - 0.05, 0.49, 0.03), p(pni[i][1], x - 0.02, 0.49, 0.03), p(pni[i][2], x + 0.01, 0.49, 0.03),
      ...(selos[i] ? [p(selos[i]!, x, 0.525, 0.05, 0.02)] : []),
      p("15", x, 0.57),
    ]),
  ];
}

test("tabela deitada: FC e SpO₂ na hora da coluna, a PA na hora do selo", () => {
  const plano = planejar(deitada());
  assert.equal(plano?.forma, "deitada");
  assert.deepEqual(montar(plano!, {}), [
    { hora: "08:05", pas: 118, pad: 72, pam: 87 },
    { hora: "08:10", fc: 72, spo2: 98 },
    { hora: "08:15", pas: 112, pad: 68, pam: 83 },
    { hora: "08:20", fc: 70, spo2: 97 },
    { hora: "08:25", pas: 105, pad: 63, pam: 77 },
    { hora: "08:30", fc: 68, spo2: 99 },
  ]);
});

test("horário do alto ilegível e selo ilegível: o passo das colunas e a distância dos outros selos completam", () => {
  const plano = planejar(deitada({ horas: ["08:10", null, "08:30"], selos: ["[08:05]", null, "[08:25]"] }))!;
  const linhas = montar(plano, {});
  assert.deepEqual(linhas.map((l) => l.hora), ["08:05", "08:10", "08:15", "08:20", "08:25", "08:30"]);
  assert.equal(linhas.find((l) => l.hora === "08:15")?.pas, 112);
});

test("a releitura de cada célula vence a foto inteira, e o selo lido 1 min fora do padrão fica no padrão", () => {
  const plano = planejar(deitada())!;
  const linhas = montar(plano, { "0-fc": ["73", "73"], "2-hora": ["08:26", "08:26"] });
  assert.equal(linhas.find((l) => l.hora === "08:10")?.fc, 73);
  assert.ok(linhas.some((l) => l.hora === "08:25" && l.pas === 105), "08:26 lido, mas os outros selos estão 5 min antes da coluna");
});

test("há selo, mas nenhum se lê: a PA vem sem hora, para o médico escrever", () => {
  const plano = planejar(deitada({ selos: [null, null, null] }))!;
  const lidos = Object.fromEntries(plano.celulas.filter((c) => c.alfabeto === "hora").map((c) => [c.id, [SELO_ILEGIVEL]]));
  const linhas = montar(plano, lidos);
  assert.deepEqual(linhas.filter((l) => l.pas !== undefined).map((l) => l.hora), ["", "", ""]);
  assert.deepEqual(linhas.filter((l) => l.hora).map((l) => l.hora), ["08:10", "08:20", "08:30"]);
});

test("monitor sem selo nenhum: a PA fica na hora da coluna", () => {
  const plano = planejar(deitada({ selos: [null, null, null] }))!;
  assert.ok(montar(plano, {}).some((l) => l.hora === "08:10" && l.fc === 72 && l.pas === 118));
});

test("nome da margem ilegível: vai para releitura, e o plano refeito usa o que foi relido", () => {
  const palavras = deitada().map((w) => (w.t === "PNI" ? { ...w, t: "o" } : w));
  const primeiro = planejar(palavras)!;
  const duvida = primeiro.rotulosDuvidosos?.find((c) => c.primeiraLeitura === "o");
  assert.ok(duvida, "o nome que não se reconheceu vai para releitura (e as unidades não)");
  assert.ok(!primeiro.rotulosDuvidosos?.some((c) => /bpm|mmHg|%/.test(c.primeiraLeitura)));
  const refeito = planejar(palavras, { [duvida!.id]: ["PNI"] })!;
  assert.ok(montar(refeito, {}).some((l) => l.hora === "08:05" && l.pas === 118));
});

/** A "Revisão de PNI": SIS DIA PAM FP HORA no alto, uma medida por linha, a data e a hora no fim. */
function emLinhas(medidas: Array<[string, string, string, string, string | null]>) {
  const passo = 0.055;
  return [
    p("Revis", 0.05, 0.29), p("SIS", 0.16, 0.34), p("DIA", 0.29, 0.34), p("PAM", 0.42, 0.34), p("FP", 0.55, 0.34), p("HORA", 0.8, 0.34, 0.06),
    ...medidas.flatMap(([sis, dia, pam, fp, hora], k) => {
      const y = 0.39 + k * passo;
      return [
        p(String(k + 1), 0.07, y, 0.015), p(sis, 0.16, y), p(dia, 0.29, y), p(pam, 0.42, y), p(fp, 0.55, y),
        p("2026-03-02", 0.71, y, 0.13), ...(hora ? [p(hora, 0.84, y, 0.06)] : []),
      ];
    }),
  ];
}

test("tabela em linhas: cada linha uma medida, e a hora não lida volta da releitura", () => {
  const plano = planejar(emLinhas([
    ["128", "74", "92", "88", "09:42"],
    ["124", "71", "89", "86", null],
    ["121", "70", "87", "84", "09:36"],
  ]))!;
  assert.equal(plano.forma, "em-linhas");
  const hora1 = plano.linhas[plano.linhas.findIndex((l) => !l.especulativa) + 1].celulaDaHora!;
  assert.deepEqual(montar(plano, { [hora1]: ["-03-0209:39"] }), [
    { hora: "09:36", pas: 121, pad: 70, pam: 87, fc: 84 },
    { hora: "09:39", pas: 124, pad: 71, pam: 89, fc: 86 },
    { hora: "09:42", pas: 128, pad: 74, pam: 92, fc: 88 },
  ]);
});

test("PAS, PAD e PAM que não fecham: outra leitura da célula que feche, ou a pressão fica de fora", () => {
  const plano = planejar(emLinhas([
    ["131", "19", "95", "90", "09:10"],
    ["127", "80", "96", "88", "09:15"],
  ]))!;
  const pad = plano.celulas.find((c) => c.alfabeto === "numero" && c.id.endsWith("-pad") && c.primeiraLeitura === "19")!.id;
  // "19" na foto inteira, "79" relido: 131/79 (95) fecha.
  assert.deepEqual(montar(plano, { [pad]: ["79"] })[0], { hora: "09:10", pas: 131, pad: 79, pam: 95, fc: 90 });
  // Só "19": nenhuma combinação fecha, e a PA dessa linha não entra.
  assert.deepEqual(montar(plano, {})[0], { hora: "09:10", fc: 90 });
});

test("a hora na célula: com a data grudada, entre colchetes, com traço, sem separador", () => {
  assert.equal(horaDoTexto("-03-0209:39"), "09:39");
  assert.equal(horaDoTexto("2026-03-02 09:42"), "09:42");
  assert.equal(horaDoTexto("[08-25"), "08:25");
  assert.equal(horaDoTexto("(08:15,"), "08:15");
  assert.equal(horaDoTexto("2026-03-02"), null);
  assert.equal(horaDoTexto("36,4"), null);
  assert.equal(horaDoTexto("0815"), null);
  assert.equal(horaDoTexto("0815", true), "08:15");
  assert.equal(horaDoTexto("25:10"), null);
});

test("a sequência dos horários do alto: o mal lido e o que faltou seguem o passo", () => {
  assert.deepEqual(consertarSequencia(["08:10", "18:20", "08:30", null, "08:50"]), ["08:10", "08:20", "08:30", "08:40", "08:50"]);
  assert.deepEqual(consertarSequencia(["23:50", "23:55", null]), ["23:50", "23:55", "00:00"]);
  assert.deepEqual(consertarSequencia(["10:00", null]), ["10:00", null], "sem passo, fica como veio");
});

test("a pressão lida: o '(' perdido ou lido '1', e a PAM que não fecha sai", () => {
  assert.equal(chaveDaLeitura("pressao", "118/72(87)"), "118/72/87");
  assert.equal(chaveDaLeitura("pressao", "118/7287)"), "118/72/87");
  assert.equal(chaveDaLeitura("pressao", "104/66179)"), "104/66/79");
  assert.equal(chaveDaLeitura("pressao", "112/68(838)"), "112/68/");
  assert.equal(chaveDaLeitura("pressao", "120/80"), "120/80/");
  assert.equal(chaveDaLeitura("pressao", "70/120"), null);
});

test("as duas leituras da foto inteira: a mesma palavra fica uma vez, a que é número antes do rabisco", () => {
  const juntas = juntarPalavras([p("58", 0.5, 0.5, 0.04, 0.024, 40)], [p("5B", 0.5, 0.5, 0.04, 0.024, 45), p("FC", 0.1, 0.5)]);
  assert.deepEqual(juntas.map((w) => w.t), ["58", "FC"]);
});
