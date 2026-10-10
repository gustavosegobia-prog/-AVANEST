import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { codigoDigitado, destinoSeguro, exigeDuasEtapas, rotaPedeDuasEtapas, segredoEmGrupos } from "./duas-etapas.ts";

test("proprietário, administrador e operador são obrigados; o resto não", () => {
  assert.equal(exigeDuasEtapas({ role: "owner" }), true);
  assert.equal(exigeDuasEtapas({ role: "admin" }), true);
  assert.equal(exigeDuasEtapas({ role: "medico", super_admin: true }), true);
  assert.equal(exigeDuasEtapas({ role: "medico", permissoes: ["medico", "admin"] }), true, "concessão antiga de admin também");
  assert.equal(exigeDuasEtapas({ role: "medico", permissoes: ["medico", "financeiro"] }), false);
  assert.equal(exigeDuasEtapas({ role: "recepcao" }), false);
  assert.equal(exigeDuasEtapas(null), false);
});

test("o proxy confere o sistema por dentro, e não as páginas públicas", () => {
  for (const r of ["/dashboard", "/dashboard?area=admin", "/locais", "/avaliacoes/123", "/assinatura", "/organizacoes/planos", "/api/admin/users"])
    assert.equal(rotaPedeDuasEtapas(r.split("?")[0]), true, r);
  for (const r of ["/", "/planos", "/termos", "/login", "/duas-etapas", "/auth/callback", "/atualizar-senha", "/dashboardx"])
    assert.equal(rotaPedeDuasEtapas(r), false, r);
});

test("o retorno depois do código é sempre interno", () => {
  assert.equal(destinoSeguro("/dashboard?area=admin"), "/dashboard?area=admin");
  assert.equal(destinoSeguro("https://falso.example/login"), "/locais");
  assert.equal(destinoSeguro("//falso.example"), "/locais");
  assert.equal(destinoSeguro("/\\falso.example"), "/locais");
  assert.equal(destinoSeguro("/duas-etapas"), "/locais", "não volta para a própria tela");
  assert.equal(destinoSeguro(null), "/locais");
});

test("código e segredo do jeito que a pessoa digita", () => {
  assert.equal(codigoDigitado(" 123 456 "), "123456");
  assert.equal(codigoDigitado("1234567"), "123456");
  assert.equal(segredoEmGrupos("ABCDEFGHIJKL"), "ABCD EFGH IJKL");
});

test("a tranca está no banco, não só na tela", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/202610100003_duas_etapas.sql", import.meta.url), "utf8");
  assert.match(sql, /pgrst\.db_pre_request = 'public\.porteiro_das_duas_etapas'/);
  assert.match(sql, /auth\.mfa_factors/);
  assert.match(sql, /'aal2'/);
  // A conversa da equipe chega por Realtime, que não passa pelo porteiro da API.
  for (const t of ["chamados", "chamado_mensagens", "sala_mensagens"])
    assert.match(sql, new RegExp(`on public\\.${t} as restrictive`));
});
