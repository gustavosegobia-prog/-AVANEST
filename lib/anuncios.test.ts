import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { destinoDaConversao, idValido, rotaAceitaAnuncios } from "./anuncios.ts";

const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

test("a tag do Google Ads nunca entra no sistema", () => {
  // Dentro do sistema o endereço leva o identificador do paciente, e a tag
  // envia o endereço da página em toda chamada.
  for (const c of ["/dashboard", "/avaliacoes/8f3c2a", "/avaliacoes", "/locais", "/organizacoes",
    "/assinatura", "/calculos", "/comecar", "/convite/abc", "/login", "/duas-etapas", "/api/x",
    "/escoresx", "/planosfalsos"])
    assert.equal(rotaAceitaAnuncios(c), false, c);
});

test("as páginas públicas e o caminho do cadastro aceitam a tag", () => {
  for (const c of ["/", "/planos", "/2meses", "/criar-conta", "/escores/stop-bang",
    "/avaliacao-pre-anestesica-digital", "/escala-medica", "/ficha-anestesica", "/privacidade"])
    assert.equal(rotaAceitaAnuncios(c), true, c);
});

test("sem ID ou rótulo válidos, nenhuma conversão é enviada", () => {
  assert.equal(idValido(""), false);
  assert.equal(idValido("AW-123"), false);
  assert.equal(idValido("G-ABC123"), false);
  assert.equal(idValido("AW-1234567890"), true);
  assert.equal(destinoDaConversao("", "abcDEF12"), null);
  assert.equal(destinoDaConversao("AW-1234567890", ""), null);
  assert.equal(destinoDaConversao("AW-1234567890", "abc/../x"), null);
  assert.equal(destinoDaConversao("AW-1234567890", "abcDEF12"), "AW-1234567890/abcDEF12");
});

test("o cadastro por convite não conta como conversão de anúncio", () => {
  const form = ler("app/criar-conta/sign-up-form.tsx");
  assert.match(form, /if \(!porConvite\) await registrarConversao\("cadastro"\)/);
});

test("a política de privacidade descreve o cookie e permite mudar a escolha", () => {
  const politica = ler("app/privacidade/page.tsx");
  assert.match(politica, /<h2 id="cookies">/);
  assert.match(politica, /<MudarEscolhaDeCookies \/>/);
  assert.match(politica, /Google<\/b> — medição dos anúncios/);
  assert.doesNotMatch(politica, /Não há cookies de publicidade nem rastreamento de terceiros\./);
});
