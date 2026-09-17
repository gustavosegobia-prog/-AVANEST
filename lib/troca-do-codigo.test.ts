import test from "node:test";
import assert from "node:assert/strict";
import {
  destinoComOCodigo, fluxoDoLink, PARAM_CODIGO, PARAM_FLUXO, temCodigoNaUrl,
} from "./troca-do-codigo.ts";
import { destinoInterno } from "./destino-seguro.ts";

const SITE = "https://www.avanest.com.br/auth/callback";
const FLUXO = "0fa5f2871066d01dd0d1eb03ac58917a";

test("o número do fluxo é lido do link", () => {
  assert.equal(fluxoDoLink(FLUXO), FLUXO);
  assert.equal(fluxoDoLink(null), null);
  assert.equal(fluxoDoLink(""), null);
});

test("fluxo malformado vira ausência, e não erro", () => {
  // Recusar devolve a busca para a gaveta de compatibilidade — o
  // comportamento de antes desta correção. Nunca derruba a rota.
  assert.equal(fluxoDoLink("curto"), null);
  assert.equal(fluxoDoLink("a".repeat(65)), null);
  assert.equal(fluxoDoLink("tem espaço aqui"), null);
  assert.equal(fluxoDoLink("../../etc/passwd"), null);
});

test("o código segue para o destino junto com o fluxo", () => {
  assert.equal(
    destinoComOCodigo("/atualizar-senha", "abc123", FLUXO),
    `/atualizar-senha?${PARAM_CODIGO}=abc123&${PARAM_FLUXO}=${FLUXO}`,
  );
});

test("sem fluxo, só o código viaja", () => {
  assert.equal(destinoComOCodigo("/atualizar-senha", "abc123", null),
    "/atualizar-senha?code=abc123");
});

test("busca que já existia no destino é preservada", () => {
  const saida = destinoComOCodigo("/atualizar-senha?origem=email", "abc", FLUXO);
  const p = new URLSearchParams(saida.split("?")[1]);
  assert.equal(p.get("origem"), "email");
  assert.equal(p.get(PARAM_CODIGO), "abc");
});

test("um código que já estava lá é substituído, não duplicado", () => {
  const saida = destinoComOCodigo("/atualizar-senha?code=velho", "novo", null);
  assert.equal(saida, "/atualizar-senha?code=novo");
  assert.equal(saida.match(/code=/g)?.length, 1);
});

test("caracteres especiais do código são escapados", () => {
  const saida = destinoComOCodigo("/atualizar-senha", "a b&c=d#e", null);
  assert.ok(!saida.includes("#"), "o # cortaria o resto da URL");
  assert.equal(new URLSearchParams(saida.split("?")[1]).get("code"), "a b&c=d#e");
});

test("O CÓDIGO NUNCA SAI DO SITE", () => {
  // É a razão de esta função exigir um destino já conferido. Se um `next`
  // apontando para fora chegasse até aqui, o código de autorização iria junto
  // — e quem recebe o código com o comprovante certo entra na conta. Por isso
  // o par `destinoInterno` → `destinoComOCodigo` é indivisível, e este teste
  // percorre os dois na ordem em que a rota os chama.
  for (const hostil of ["//evil.com", "/\\evil.com", "https://evil.com/x",
                        "//attacker.tld%2f..", "\\\\evil.com"]) {
    const conferido = destinoInterno(hostil, SITE);
    const final = new URL(destinoComOCodigo(conferido, "segredo", FLUXO), SITE);
    assert.equal(final.origin, "https://www.avanest.com.br",
      `"${hostil}" escapou levando o código junto`);
  }
});

test("a página sabe quando um código está a caminho", () => {
  assert.equal(temCodigoNaUrl("?code=abc&sb_flow_id=x"), true);
  assert.equal(temCodigoNaUrl("?erro=link-invalido"), false);
  assert.equal(temCodigoNaUrl(""), false);
});
