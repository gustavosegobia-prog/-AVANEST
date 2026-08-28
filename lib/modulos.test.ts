import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areasLiberadas, modulosDaOrganizacao, papeisConvidaveis, restringivel,
} from "./modulos.ts";

// As cinco áreas na ordem em que o dashboard as oferece.
const TODAS = ["medico", "recepcao", "financeiro", "admin", "plantoes"] as const;

describe("o que veio do banco", () => {
  it("nulo é TUDO — é o que mantém inteiras as organizações que já existem", () => {
    // A regressão que este teste existe para impedir: se nulo virasse "nada",
    // a primeira publicação apagaria todas as abas de todos os clientes.
    assert.equal(modulosDaOrganizacao(null), null);
    assert.equal(modulosDaOrganizacao(undefined), null);
  });

  it("lista vazia também é TUDO", () => {
    // Um `{}` gravado por engano não pode trancar ninguém para fora.
    assert.equal(modulosDaOrganizacao([]), null);
  });

  it("lê a lista que interessa", () => {
    assert.deepEqual(modulosDaOrganizacao(["medico", "plantoes"]), ["medico", "plantoes"]);
  });

  it("descarta nome que não é módulo, em vez de confiar no banco", () => {
    assert.deepEqual(modulosDaOrganizacao(["medico", "chutar", 7, null]), ["medico"]);
  });

  it("lista só de lixo cai no padrão seguro, que é tudo", () => {
    assert.equal(modulosDaOrganizacao(["chutar"]), null);
  });

  it("não repete", () => {
    assert.deepEqual(modulosDaOrganizacao(["medico", "medico"]), ["medico"]);
  });
});

describe("o filtro da organização", () => {
  it("sem restrição, ninguém perde nada", () => {
    assert.deepEqual(areasLiberadas(TODAS, null), [...TODAS]);
  });

  it("o FUNDHOSPAR: ficha e escala, e o Financeiro some", () => {
    // O caso que motivou o módulo. Note que "admin" continua: é por ela que o
    // enfermeiro convida os anestesistas.
    assert.deepEqual(areasLiberadas(TODAS, ["medico", "plantoes"]),
      ["medico", "admin", "plantoes"]);
  });

  it("some para o DONO da organização também", () => {
    // Não é permissão de pessoa: é contrato da casa. Quem tem todos os papéis
    // continua sem ver o que a organização não contratou.
    assert.equal(areasLiberadas(TODAS, ["medico", "plantoes"]).includes("financeiro"), false);
  });

  it("admin atravessa mesmo sem estar na lista", () => {
    // Se a administração pudesse ser desligada, a organização ficaria trancada
    // por fora: ninguém lá dentro conseguiria convidar nem pagar.
    assert.equal(areasLiberadas(TODAS, ["medico"]).includes("admin"), true);
  });

  it("preserva a ordem, que é quem decide a tela de entrada", () => {
    // O dashboard abre no PRIMEIRO item da lista. Reordenar aqui mudaria em
    // que área cada pessoa entra.
    assert.deepEqual(areasLiberadas(TODAS, ["plantoes", "medico"]),
      ["medico", "admin", "plantoes"]);
  });

  it("o papel continua mandando: módulo ligado não dá acesso a quem não tem alcance", () => {
    // Os dois filtros são em série. Este recebe o que o papel já alcançou.
    assert.deepEqual(areasLiberadas(["medico", "plantoes"], ["medico", "plantoes", "financeiro"]),
      ["medico", "plantoes"]);
  });

  it("pode sobrar só a administração", () => {
    // Acontece com um recepcionista numa organização que não contratou
    // recepção. É por isso que a tela precisa saber dizer "nenhuma área".
    assert.deepEqual(areasLiberadas(["recepcao", "admin"], ["medico"]), ["admin"]);
  });

  it("pode não sobrar nada", () => {
    assert.deepEqual(areasLiberadas(["recepcao"], ["medico"]), []);
  });
});

describe("quem se pode convidar", () => {
  it("sem restrição, os quatro papéis", () => {
    assert.deepEqual(papeisConvidaveis(null), ["recepcao", "medico", "financeiro", "admin"]);
  });

  it("no FUNDHOSPAR não se oferece Financeiro nem Recepção", () => {
    // Convidar alguém para um papel que não abre nada é entregar uma conta que
    // cai numa tela vazia. Fecha-se na origem.
    assert.deepEqual(papeisConvidaveis(["medico", "plantoes"]), ["medico", "admin"]);
  });

  it("administrador nunca sai da lista", () => {
    assert.equal(papeisConvidaveis(["medico"]).includes("admin"), true);
  });
});

describe("o que é restringível", () => {
  it("as quatro áreas de trabalho", () => {
    for (const area of ["medico", "plantoes", "recepcao", "financeiro"]) {
      assert.equal(restringivel(area), true, `${area} deveria ser restringível`);
    }
  });

  it("administração, não", () => {
    assert.equal(restringivel("admin"), false);
  });
});
