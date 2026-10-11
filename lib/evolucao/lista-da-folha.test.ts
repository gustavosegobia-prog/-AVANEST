import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGO } from "./medicamentos.ts";
import {
  ALDRETE, INFUSOES_DA_FOLHA, LISTA_DA_FOLHA, grupoDaAdministracao, itemDaAdministracao, somaAldrete,
} from "./lista-da-folha.ts";
import type { Registro } from "./registros.ts";

const reg = (dados: Record<string, unknown>): Registro => ({
  id: "m1", evolucao_id: "f1", tipo: "medicamento", momento: "2026-10-10T10:00:00-03:00", dados, origem: "manual",
  substitui_id: null, anulado: false, motivo: null, created_by: "u1", created_at: null,
});

test("Lista do papel — seis grupos na ordem da ficha, e nenhum valor de dose", () => {
  assert.deepEqual(LISTA_DA_FOLHA.map((g) => g.codigo), ["antibiotico", "sedacao", "neuroeixo", "geral", "bloqueio", "outras"]);
  for (const g of LISTA_DA_FOLHA) {
    for (const it of g.itens) {
      assert.deepEqual(Object.keys(it).filter((k) => !["nome", "rotulo", "unidade", "via", "apresentacao"].includes(k)), [], it.nome);
      assert.ok(!/\d+\s*(mg|mcg|g|UI)\b/.test(it.rotulo ?? ""), `${it.rotulo} traz dose`);
      assert.ok(CATALOGO.some((c) => c.nome === it.nome), `${it.nome} fora do catálogo`);
    }
  }
  for (const n of INFUSOES_DA_FOLHA) assert.ok(CATALOGO.some((c) => c.nome === n), n);
});

test("Lista do papel — o grupo gravado manda; sem ele, a via, a indicação e a técnica decidem", () => {
  assert.equal(grupoDaAdministracao(reg({ nome: "Fentanil", via: "EV", grupo: "sedacao" }), ["geral_balanceada"]), "sedacao");
  assert.equal(grupoDaAdministracao(reg({ nome: "Fentanil", via: "intratecal" }), []), "neuroeixo");
  assert.equal(grupoDaAdministracao(reg({ nome: "Ropivacaína", via: "perineural" }), []), "bloqueio");
  assert.equal(grupoDaAdministracao(reg({ nome: "Kefazol", via: "EV" }), []), "antibiotico");
  assert.equal(grupoDaAdministracao(reg({ nome: "Propofol", via: "EV" }), ["geral_venosa_total"]), "geral");
  assert.equal(grupoDaAdministracao(reg({ nome: "Propofol", via: "EV" }), ["sedacao", "raquianestesia"]), "sedacao");
  assert.equal(grupoDaAdministracao(reg({ nome: "Ondansetrona", via: "EV" }), ["geral_balanceada"]), "outras");
  assert.equal(grupoDaAdministracao(reg({ nome: "Soro antiofídico", via: "EV" }), []), "outras");
});

test("Lista do papel — bupivacaína pesada e isobárica caem cada uma na sua linha", () => {
  const raqui = LISTA_DA_FOLHA.find((g) => g.codigo === "neuroeixo")!;
  assert.equal(itemDaAdministracao(raqui, { nome: "Bupivacaína" }, reg({ apresentacao: "isobárica" })), 1);
  assert.equal(itemDaAdministracao(raqui, { nome: "Bupivacaína" }, reg({ apresentacao: "pesada (hiperbárica)" })), 0);
  assert.equal(itemDaAdministracao(raqui, { nome: "Neocaína" }, reg({})), 0);
  assert.equal(itemDaAdministracao(raqui, { nome: "Propofol" }, reg({})), -1);
});

test("Aldrete — soma só com os cinco critérios marcados", () => {
  assert.equal(ALDRETE.length, 5);
  assert.equal(somaAldrete({ atividade: 2, respiracao: 2, circulacao: 2, consciencia: 1, saturacao: 2 }), 9);
  assert.equal(somaAldrete({ atividade: 2, respiracao: 2 }), null);
  assert.equal(somaAldrete({ atividade: 3, respiracao: 2, circulacao: 2, consciencia: 2, saturacao: 2 }), null);
  assert.equal(somaAldrete(null), null);
});
