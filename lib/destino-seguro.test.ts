import { strict as assert } from "node:assert";
import { test } from "node:test";
import { destinoInterno } from "./destino-seguro.ts";

const SITE = "https://www.avanest.com.br/auth/callback";

test("mantém um caminho interno", () => {
  assert.equal(destinoInterno("/dashboard", SITE), "/dashboard");
  assert.equal(destinoInterno("/atualizar-senha", SITE), "/atualizar-senha");
  assert.equal(destinoInterno("/avaliacoes/38bfa990-4f58-4bb5-9881-68cab921fd31", SITE),
    "/avaliacoes/38bfa990-4f58-4bb5-9881-68cab921fd31");
});

test("preserva a query, que é onde vão os avisos da tela", () => {
  assert.equal(destinoInterno("/login?erro=expirado", SITE), "/login?erro=expirado");
});

test("recusa o endereço relativo a protocolo", () => {
  // O caso que passava pela verificação antiga: começa com "/" e mesmo assim
  // aponta para outro site.
  assert.equal(destinoInterno("//evil.com", SITE), "/dashboard");
  assert.equal(destinoInterno("//evil.com/roubar", SITE), "/dashboard");
  assert.equal(destinoInterno("///evil.com", SITE), "/dashboard");
});

test("recusa a contrabarra, que o navegador lê como barra", () => {
  assert.equal(destinoInterno("/\\evil.com", SITE), "/dashboard");
  assert.equal(destinoInterno("\\\\evil.com", SITE), "/dashboard");
  assert.equal(destinoInterno("/\\/evil.com", SITE), "/dashboard");
});

test("recusa endereço absoluto para fora", () => {
  assert.equal(destinoInterno("https://evil.com", SITE), "/dashboard");
  assert.equal(destinoInterno("http://www.avanest.com.br.evil.com/x", SITE), "/dashboard");
  // Domínio que contém o nosso como prefixo não é o nosso.
  assert.equal(destinoInterno("https://www.avanest.com.br.evil.com", SITE), "/dashboard");
});

test("recusa outros esquemas", () => {
  assert.equal(destinoInterno("javascript:alert(1)", SITE), "/dashboard");
  assert.equal(destinoInterno("data:text/html,<script>", SITE), "/dashboard");
});

test("não quebra com entrada malformada", () => {
  // Isto derrubava a rota com 500 antes, porque new URL lança.
  assert.equal(destinoInterno("//attacker.tld%2f..", SITE), "/dashboard");
});

test("caminho relativo cai no padrão em vez de resolver dentro de /auth", () => {
  // Sem caminho absoluto, "dashboard" resolveria para "/auth/dashboard" — uma
  // página que não existe. É interno e inofensivo, mas leva a lugar nenhum.
  assert.equal(destinoInterno("dashboard", SITE), "/dashboard");
  assert.equal(destinoInterno("%", SITE), "/dashboard");
  assert.equal(destinoInterno("../admin", SITE), "/dashboard");
});

test("vazio, nulo e indefinido caem no padrão", () => {
  assert.equal(destinoInterno(null, SITE), "/dashboard");
  assert.equal(destinoInterno(undefined, SITE), "/dashboard");
  assert.equal(destinoInterno("", SITE), "/dashboard");
});

test("o mesmo site em http e https são origens diferentes", () => {
  // Rebaixar para http levaria a sessão por um canal sem cifra.
  assert.equal(destinoInterno("http://www.avanest.com.br/dashboard", SITE), "/dashboard");
});
