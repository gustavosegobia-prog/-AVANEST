import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deveRecarregar } from "./versao.ts";

describe("versão nova do site", () => {
  it("recarrega quando o servidor publicou outra versão", () => {
    assert.equal(deveRecarregar("abc", "def", null), true);
  });

  it("não recarrega na mesma versão, nem sem resposta do servidor", () => {
    assert.equal(deveRecarregar("abc", "abc", null), false);
    assert.equal(deveRecarregar("abc", null, null), false);
    assert.equal(deveRecarregar("abc", "", null), false);
  });

  it("uma vez por versão: se já recarregou por ela e nada mudou, não entra em ciclo", () => {
    assert.equal(deveRecarregar("abc", "def", "def"), false);
    assert.equal(deveRecarregar("abc", "ghi", "def"), true, "outra versão nova tenta de novo");
  });
});
