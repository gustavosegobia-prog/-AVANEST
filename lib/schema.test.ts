import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { migalhas } from "./schema.ts";

describe("a trilha de migalhas", () => {
  const trilha = migalhas([
    { nome: "Início", caminho: "/" },
    { nome: "Escores", caminho: "/escores" },
    { nome: "STOP-Bang", caminho: "/escores/stop-bang" },
  ]);

  it("numera a partir de 1, e não de zero", () => {
    // O schema.org conta posição a partir de 1. Começar em zero faz o Google
    // descartar a marcação inteira, em silêncio.
    assert.deepEqual(trilha.itemListElement.map((i) => i.position), [1, 2, 3]);
  });

  it("inclui a PÁGINA ATUAL como última migalha", () => {
    // Omitir a folha faz o resultado mostrar o caminho até o pai e parar ali,
    // que é pior do que não ter trilha nenhuma.
    assert.equal(trilha.itemListElement.at(-1)?.name, "STOP-Bang");
  });

  it("usa endereço absoluto, com o domínio", () => {
    // Caminho relativo é ignorado: o Google precisa saber de qual site é.
    for (const item of trilha.itemListElement) {
      assert.match(item.item, /^https:\/\/www\.avanest\.com\.br\//);
    }
  });

  it("não inventa barra dupla na raiz", () => {
    assert.equal(trilha.itemListElement[0].item, "https://www.avanest.com.br/");
  });
});
