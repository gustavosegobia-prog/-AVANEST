import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sinaisDaSaida } from "./sinais.ts";
import type { Registro } from "./registros.ts";

// A alta da sala puxa os sinais do último lançado na ficha (20/11/2026: "os
// sinais vitais têm que puxar lá do último que foi lançado na ficha").
// Dados fictícios.
const ler = (c: string) => fs.readFileSync(new URL(`../../${c}`, import.meta.url), "utf8");

let n = 0;
const sinal = (parametro: string, momento: string, valor: number, origem: Registro["origem"] = "manual"): Registro => ({
  id: `r${++n}`, evolucao_id: "f", tipo: "sinal", momento: `2026-11-20T${momento}:00-03:00`, dados: { parametro, valor },
  origem, substitui_id: null, anulado: false, motivo: null, created_by: null, created_at: null,
});

test("alta da sala: o último PA, FC e SpO₂ da ficha", () => {
  const vig = [
    sinal("pas", "10:00", 140), sinal("pad", "10:00", 90), sinal("fc", "10:00", 95), sinal("spo2", "10:00", 96),
    sinal("pas", "10:30", 118), sinal("pad", "10:30", 72), sinal("pam", "10:30", 87, "estimado"),
    sinal("fc", "10:35", 78.4), sinal("spo2", "10:25", 99),
  ];
  assert.deepEqual(sinaisDaSaida(vig), { pa: "118/72", fc: "78", spo2: "99", momento: "2026-11-20T10:35:00-03:00" });
});

test("alta da sala: a diastólica é a da mesma medida; sem ela, a última lançada; ficha vazia fica em branco", () => {
  // A PAD das 10:30 não pertence à PAS das 10:40, mas é a última que há.
  const semPar = [sinal("pas", "10:00", 130), sinal("pad", "10:30", 75), sinal("pas", "10:40", 125)];
  assert.equal(sinaisDaSaida(semPar).pa, "125/75");
  // Com PAD no mesmo minuto da última PAS, é ela — mesmo havendo outra lançada depois.
  const comPar = [sinal("pas", "10:40", 125), sinal("pad", "10:40", 70), sinal("pad", "10:50", 60)];
  assert.equal(sinaisDaSaida(comPar).pa, "125/70");
  assert.deepEqual(sinaisDaSaida([]), { pa: "", fc: "", spo2: "", momento: null });
});

test("alta da sala: o rodapé usa o último sinal só enquanto o campo não foi escrito, na tela e na impressão", () => {
  const rodape = ler("components/evolucao/rodape-da-folha.tsx");
  assert.match(rodape, /const daAlta = \(k: "pa" \| "fc" \| "spo2"\) => \(saida\[k\] == null \? sinais\?\.\[k\] \?\? "" : t\(saida\[k\]\)\);/);
  assert.match(rodape, /const \[paS = "", paD = ""\] = daAlta\("pa"\)\.split\("\/"\);/);
  assert.match(rodape, /valor=\{daAlta\("fc"\)\}/);
  assert.match(rodape, /valor=\{daAlta\("spo2"\)\.replace/);
  assert.match(ler("components/evolucao/folha-anestesica.tsx"), /sinais=\{sinaisDaSaida\(atuais\)\}/);
  assert.match(ler("components/evolucao/folha-impressa.tsx"), /sinais=\{sinaisDaSaida\(vigentes\)\}/);
});
