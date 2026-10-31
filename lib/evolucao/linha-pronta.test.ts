import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PONTO_NEUTRO_DA_LINHA, ajustarNaLinha, linhasProntas } from "./sinais.ts";
import type { Registro } from "./registros.ts";

// A linha pronta das faixas de SpO₂, EtCO₂ e temperatura (pedido de
// 31/10/2026): o último valor repetido em cada coluna vazia, para tocar
// (lança igual) ou arrastar para cima e para baixo (ajusta).

const reg = (id: string, p: string, valor: number, hhmm: string) =>
  ({ id, evolucao_id: "e", tipo: "sinal", momento: `2026-10-31T${hhmm}:00Z`, dados: { parametro: p, valor }, origem: "manual",
    substitui_id: null, anulado: false, motivo: null, created_by: "u", created_at: `2026-10-31T${hhmm}:00Z` }) as Registro;
const ms = (hhmm: string) => Date.parse(`2026-10-31T${hhmm}:00Z`);
const hora = (t: number) => new Date(t).toISOString().slice(11, 16);
const janela = { inicioMs: ms("10:00"), ateMs: ms("10:17"), intervaloMin: 5 };

test("o último valor se repete em cada coluna vazia depois dele, no meio da coluna", () => {
  const prontos = linhasProntas([reg("1", "spo2", 99, "10:03")], janela);
  const spo2 = prontos.filter((r) => r.parametro === "spo2");
  // Colunas 10:00 (tem o 99), 10:05, 10:10 e 10:15 (a de agora, até 10:17).
  assert.deepEqual(spo2.map((r) => [hora(r.ms), r.valor]), [["10:08", 99], ["10:13", 99], ["10:17", 99]]);
});

test("a coluna que já tem valor fica como está, e o valor novo passa a ser o repetido", () => {
  const prontos = linhasProntas([reg("1", "spo2", 99, "10:03"), reg("2", "spo2", 96, "10:07")], janela)
    .filter((r) => r.parametro === "spo2");
  assert.deepEqual(prontos.map((r) => [hora(r.ms), r.valor]), [["10:13", 96], ["10:17", 96]]);
});

test("antes do primeiro valor não há o que repetir; sinal nunca lançado pede o valor na coluna de agora", () => {
  const prontos = linhasProntas([reg("1", "temp", 36.2, "10:12")], janela);
  // Temperatura: nada antes das 10:10; a coluna 10:15 repete 36,2.
  assert.deepEqual(prontos.filter((r) => r.parametro === "temp").map((r) => [hora(r.ms), r.valor]), [["10:17", 36.2]]);
  // SpO₂ e EtCO₂ sem nenhum valor: só o "?" (valor nulo) na coluna de agora.
  for (const p of ["spo2", "etco2"]) {
    assert.deepEqual(prontos.filter((r) => r.parametro === p).map((r) => [hora(r.ms), r.valor]), [["10:17", null]], p);
  }
  // Pressão e FC não entram aqui: elas têm a linha pronta do gráfico.
  assert.ok(prontos.every((r) => ["spo2", "etco2", "temp"].includes(r.parametro)));
});

test("nunca no futuro, e para no fim da anestesia", () => {
  const prontos = linhasProntas([reg("1", "etco2", 35, "10:01")], { ...janela, ateMs: ms("10:09") });
  assert.ok(prontos.every((r) => r.ms <= ms("10:09")));
  assert.deepEqual(prontos.filter((r) => r.parametro === "etco2").map((r) => hora(r.ms)), ["10:08"]);
});

test("arrastar: para cima aumenta, para baixo diminui, dentro da faixa possível", () => {
  assert.equal(ajustarNaLinha("spo2", 97, 2), 99);
  assert.equal(ajustarNaLinha("spo2", 97, -3), 94);
  assert.equal(ajustarNaLinha("spo2", 99, 5), 100, "SpO₂ não passa de 100");
  assert.equal(ajustarNaLinha("etco2", 35, -4), 31);
  assert.equal(ajustarNaLinha("etco2", 2, -10), 0);
  // Temperatura de 0,1 em 0,1, sem o erro da vírgula flutuante.
  assert.equal(ajustarNaLinha("temp", 36, 1), 36.1);
  assert.equal(ajustarNaLinha("temp", 36.2, -3), 35.9);
  assert.equal(ajustarNaLinha("temp", 36, 7), 36.7);
  // O "?" parte de um ponto neutro, que só vale arrastado.
  assert.deepEqual(PONTO_NEUTRO_DA_LINHA, { spo2: 98, etco2: 35, temp: 36 });
});

test("a tela: tocar lança igual, o '?' pede o valor, e o ✓ Igual leva a coluna inteira", () => {
  const grafico = fs.readFileSync(new URL("../../components/evolucao/grafico-sinais.tsx", import.meta.url), "utf8");
  assert.match(grafico, /if \(ajustando\.ativo\) onLancar\?\.\(r\.parametro, valorEmAjuste\(ajustando\), r\.ms, false\);\s*else if \(r\.valor !== null\) onLancar\?\.\(r\.parametro, r\.valor, r\.ms, false\);\s*else onTocarLinha\(r\.parametro, r\.ms\);/);
  // Para cima é y menor: o passo é positivo.
  assert.match(grafico, /Math\.round\(\(ajustando\.y0 - ly\) \/ PX_POR_PASSO\)/);
  // De lado, o dedo continua rolando a folha no celular.
  assert.match(grafico, /segurarDedo\.current = !t \|\| !i \|\| Math\.abs\(t\.clientY - i\.y\) >= Math\.abs\(t\.clientX - i\.x\);/);
  const folha = fs.readFileSync(new URL("../../components/evolucao/folha-anestesica.tsx", import.meta.url), "utf8");
  assert.match(folha, /linha=\{linha\}/);
  assert.match(folha, /\.\.\.linhaDeAgora\.map\(\(r\) => `\$\{PARAMETROS\[r\.parametro\]\.curto\} \$\{fmt\(r\.valor, 1\)\}`\)/);
  assert.match(folha, /r\.valor !== null && Math\.floor\(r\.ms \/ passoMs\) === Math\.floor\(agora \/ passoMs\)/);
});
