import test from "node:test";
import assert from "node:assert/strict";
import { senhaRecusada } from "./senha-recusada.ts";

test("senha vazada é explicada, e não 'não foi possível'", () => {
  const vazada = { code: "weak_password", message: "Password is known to be weak and easy to guess, please choose a different one.", reasons: ["pwned"] };
  assert.match(senhaRecusada(vazada) ?? "", /vazamentos/);
  assert.match(senhaRecusada({ code: "weak_password", reasons: ["length"] }) ?? "", /oito caracteres/);
  assert.match(senhaRecusada({ code: "weak_password", reasons: ["characters"] }) ?? "", /números e símbolos/);
});

test("erro que não é de senha fraca não vira mensagem de senha", () => {
  assert.equal(senhaRecusada({ message: "Invalid login credentials" }), null);
  assert.equal(senhaRecusada(null), null);
});
