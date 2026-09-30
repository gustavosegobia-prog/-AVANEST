import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recusaDoAvisoDePlantao, recusaDoAvisoDeTroca } from "./aviso-autorizado.ts";

const ANA = "ana", BETO = "beto", CAIO = "caio";

describe("aviso de troca", () => {
  const pendente = { solicitante_id: ANA, respondido_por: null, status: "pendente" };

  it("quem pediu a troca avisa; outro colega não", () => {
    assert.equal(recusaDoAvisoDeTroca("troca", pendente, ANA), null);
    assert.ok(recusaDoAvisoDeTroca("troca", pendente, CAIO));
  });

  it("troca que já não está aberta não gera convite", () => {
    assert.ok(recusaDoAvisoDeTroca("troca", { ...pendente, status: "cancelada" }, ANA));
  });

  it("só quem respondeu avisa a resposta, e só depois de responder", () => {
    const aceita = { solicitante_id: ANA, respondido_por: BETO, status: "aceita" };
    assert.equal(recusaDoAvisoDeTroca("troca_resolvida", aceita, BETO), null);
    // "Caio assumiu o seu plantão" sem Caio ter respondido nada.
    assert.ok(recusaDoAvisoDeTroca("troca_resolvida", aceita, CAIO));
    assert.ok(recusaDoAvisoDeTroca("troca_resolvida", pendente, BETO));
  });
});

describe("aviso de plantão de colega", () => {
  it("só quem monta a escala avisa", () => {
    assert.ok(recusaDoAvisoDePlantao("plantao_alterado", { situacao: "escalado" }, false));
    assert.equal(recusaDoAvisoDePlantao("plantao_alterado", { situacao: "escalado" }, true), null);
  });

  it("'plantão cancelado' só sai se o plantão está mesmo cancelado", () => {
    // O defeito que pode tirar alguém de um plantão que continua valendo.
    assert.ok(recusaDoAvisoDePlantao("plantao_cancelado", { situacao: "escalado" }, true));
    assert.equal(recusaDoAvisoDePlantao("plantao_cancelado", { situacao: "cancelado" }, true), null);
  });

  it("plantão cancelado não vira aviso de plantão novo nem de alteração", () => {
    assert.ok(recusaDoAvisoDePlantao("plantao_novo", { situacao: "cancelado" }, true));
  });
});

describe("a rota usa as duas regras", () => {
  const rota = readFileSync(new URL("../app/api/push/avisar/route.ts", import.meta.url), "utf8");
  it("confere a troca e o plantão antes de achar os aparelhos", () => {
    assert.match(rota, /recusaDoAvisoDeTroca\(tipo, troca, euPerfil\.id\)/);
    assert.match(rota, /recusaDoAvisoDePlantao\(tipo, plantao, podeMontar === true\)/);
    assert.match(rota, /select\("id, plantao_id, solicitante_id, destinatario_id, status, mensagem, respondido_por"\)/);
  });
});
