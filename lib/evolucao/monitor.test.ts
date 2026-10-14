import test from "node:test";
import assert from "node:assert/strict";
import { lerTendencias, resumoDaLinha } from "./monitor.ts";

test("tabela de tendências com cabeçalho: hora, PNI, FC e SpO₂ em colunas", () => {
  const texto = `Tendências tabulares
Hora    PNI (mmHg)     FC    SpO2
10:00   120/70 (87)    82    99
10:05   118/68 (85)    80    98
10:10   110/65(80)     78    99`;
  assert.deepEqual(lerTendencias(texto), [
    { hora: "10:00", pas: 120, pad: 70, pam: 87, fc: 82, spo2: 99 },
    { hora: "10:05", pas: 118, pad: 68, pam: 85, fc: 80, spo2: 98 },
    { hora: "10:10", pas: 110, pad: 65, pam: 80, fc: 78, spo2: 99 },
  ]);
});

test("cabeçalho em outra ordem (SpO₂ antes da FC) e nomes em inglês", () => {
  const texto = `Time  NIBP     SpO2  HR   EtCO2
9:45  132/81   97    64   35`;
  assert.deepEqual(lerTendencias(texto), [{ hora: "09:45", pas: 132, pad: 81, spo2: 97, fc: 64, etco2: 35 }]);
});

test("número com o nome ao lado, temperatura com vírgula, e o que é ruído fica de fora", () => {
  const texto = `11h20 PA 140/90 FC 110 SpO2 96 T 36,4
11:25 ---- FC 400 SpO2 99
sem hora 120/80 70`;
  const [a, b, ...resto] = lerTendencias(texto);
  assert.deepEqual(a, { hora: "11:20", pas: 140, pad: 90, fc: 110, spo2: 96, temp: 36.4 });
  // FC 400 é impossível: não entra; a SpO₂ da linha fica.
  assert.deepEqual(b, { hora: "11:25", spo2: 99 });
  assert.equal(resto.length, 0, "linha sem hora não vira medida");
});

test("PAD maior que PAS é leitura errada: a pressão não entra", () => {
  assert.deepEqual(lerTendencias("10:30 70/120 80 99"), [{ hora: "10:30", fc: 80, spo2: 99 }]);
});

test("a mesma hora lida duas vezes se junta, e o resumo escreve a linha", () => {
  const [l] = lerTendencias("10:40 PA 100/60\n10:40 FC 72");
  assert.deepEqual(l, { hora: "10:40", pas: 100, pad: 60, fc: 72 });
  assert.equal(resumoDaLinha(l), "10:40 · PA 100/60 · FC 72");
});

test("relatório em PDF, que chega como texto corrido: cada hora abre uma linha", () => {
  const texto = "Relatorio Hora PNI (mmHg) FC SpO2 EtCO2 10:00 121/72 (88) 84 99 35 10:05 117/69 (85) 81 98 34";
  assert.deepEqual(lerTendencias(texto), [
    { hora: "10:00", pas: 121, pad: 72, pam: 88, fc: 84, spo2: 99, etco2: 35 },
    { hora: "10:05", pas: 117, pad: 69, pam: 85, fc: 81, spo2: 98, etco2: 34 },
  ]);
});
