import test from "node:test";
import assert from "node:assert/strict";
import { buscarConsumo, lerConsumo, linhasPorGrupo, trazerDaFicha } from "./consumo.ts";
import type { Administracao } from "./medicamentos.ts";
import type { Registro } from "./registros.ts";

const adm = (nome: string, dose: number, unidade: Administracao["unidade"], min = 0): Administracao =>
  ({ id: `${nome}${min}`, momento: new Date(Date.UTC(2026, 9, 14, 10, min)).toISOString(), nome, dose, unidade,
    via: "EV", forma: "bolus", volumeMl: null, observacao: "" });
const liquido = (nome: string, ml: number): Registro => ({ id: nome + ml, evolucao_id: "e", tipo: "liquido",
  momento: "2026-10-14T10:00:00Z", dados: { nome, volume_ml: ml, sentido: "entrada" }, origem: "manual",
  substitui_id: null, anulado: false, motivo: null, created_by: "u", created_at: null });

test("trazer da ficha: ampolas pela dose total, soro pelo volume, tubo e agulha da técnica", () => {
  const c = trazerDaFicha({ itens: [] },
    [adm("Fentanil", 150, "mcg"), adm("Fentanil", 100, "mcg", 30), adm("Propofol", 140, "mg"), adm("Kefazol", 2, "g")],
    [liquido("Ringer lactato", 500), liquido("Ringer lactato", 300)],
    { tecnica_detalhes: { geral: { numero: "7,5 com balonete", dispositivo: "TOT" }, raqui: { agulha: "27" } } });
  const q = Object.fromEntries(c.itens.map((l) => [`${l.nome}${l.numero ? ` nº ${l.numero}` : ""}`, l.qtd]));
  // 250 mcg de fentanil em ampolas de 200 mcg: 2 ampolas.
  assert.equal(q["Fentanil 0,1 mg/mL, amp. 2 mL"], 2);
  assert.equal(q["Propofol 200 mg, fr. 20 mL"], 1);
  // 2 g de cefazolina em frascos de 1 g.
  assert.equal(q["Kefazol 1 g"], 2);
  // 800 mL de Ringer em bolsas de 500.
  assert.equal(q["Ringer lactato 500 mL"], 2);
  assert.equal(q["Cânula orotraqueal c/ cuff nº 7,5"], 1);
  assert.equal(q["Agulha de raqui nº 27"], 1);
});

test("trazer de novo não dobra, e não diminui o que foi contado à mão", () => {
  const primeira = trazerDaFicha({ itens: [{ nome: "Propofol 200 mg, fr. 20 mL", qtd: 3 }] }, [adm("Propofol", 140, "mg")], [], {});
  const segunda = trazerDaFicha(primeira, [adm("Propofol", 140, "mg")], [], {});
  assert.deepEqual(segunda.itens, [{ nome: "Propofol 200 mg, fr. 20 mL", qtd: 3 }]);
});

test("ler o consumo descarta linha vazia, e a busca acha pelo princípio ativo", () => {
  const c = lerConsumo({ consumo: { itens: [{ nome: "Seringa 10 mL", qtd: 4 }, { nome: "", qtd: 2 }, { nome: "Agulha 25 × 7", qtd: 0 }], observacao: "ok" } });
  assert.deepEqual(c, { itens: [{ nome: "Seringa 10 mL", qtd: 4 }], observacao: "ok" });
  assert.ok(buscarConsumo("cetamina", []).some((i) => i.nome.startsWith("Ketamina")));
  assert.ok(buscarConsumo("serin", [{ nome: "Seringa 10 mL", qtd: 1 }]).every((i) => i.nome !== "Seringa 10 mL"));
  assert.equal(buscarConsumo("serin 10", [])[0]?.nome, "Seringa 10 mL");
  assert.deepEqual(linhasPorGrupo(c).map((g) => g.grupo), ["agulhas"]);
});
