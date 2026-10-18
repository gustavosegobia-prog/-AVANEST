import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DUAS_ETAPAS_LIGADA, codigoDigitado, destinoSeguro, exigeDuasEtapas, papelExigeDuasEtapas, rotaPedeDuasEtapas, segredoEmGrupos } from "./duas-etapas.ts";

test("a regra por papel: proprietário, administrador e operador; o resto não", () => {
  assert.equal(papelExigeDuasEtapas({ role: "owner" }), true);
  assert.equal(papelExigeDuasEtapas({ role: "admin" }), true);
  assert.equal(papelExigeDuasEtapas({ role: "medico", super_admin: true }), true);
  assert.equal(papelExigeDuasEtapas({ role: "medico", permissoes: ["medico", "admin"] }), true, "concessão antiga de admin também");
  assert.equal(papelExigeDuasEtapas({ role: "medico", permissoes: ["medico", "financeiro"] }), false);
  assert.equal(papelExigeDuasEtapas({ role: "recepcao" }), false);
  assert.equal(papelExigeDuasEtapas(null), false);
});

test("desligada desde 18/10/2026: ninguém é obrigado, nem o proprietário", () => {
  assert.equal(DUAS_ETAPAS_LIGADA, false);
  for (const p of [{ role: "owner" }, { role: "admin" }, { role: "medico", super_admin: true }]) {
    assert.equal(exigeDuasEtapas(p), false, p.role);
  }
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
