import test from "node:test";
import assert from "node:assert/strict";
import {
  contarTentativa, formatoAceito, origemAceita, tamanhoAceito, TAMANHO_MAXIMO,
} from "./portaria.ts";

// ---------------------------------------------------------------------------
// De onde veio o pedido
// ---------------------------------------------------------------------------

const daCasa = {
  esperada: "https://www.avanest.com.br",
  doNextUrl: "https://www.avanest.com.br",
  fetchSite: "same-origin" as string | null,
};

test("origem: o pedido da própria casa passa", () => {
  assert.equal(origemAceita({ ...daCasa, origin: "https://www.avanest.com.br" }), true);
});

test("origem: pedido sem Origin nenhum é recusado", () => {
  // O navegador manda esse cabeçalho em toda requisição que grava. Quem não
  // manda não é navegador em uso normal — é script, e script não precisa das
  // credenciais da sessão de ninguém.
  assert.equal(origemAceita({ ...daCasa, origin: null }), false);
  assert.equal(origemAceita({ ...daCasa, origin: "" }), false);
});

test("origem: outro site é recusado", () => {
  assert.equal(origemAceita({ ...daCasa, origin: "https://avanest.com.br.evil.io" }), false);
  assert.equal(origemAceita({ ...daCasa, origin: "http://www.avanest.com.br" }), false,
    "http não é https: o protocolo faz parte da origem");
});

test("origem: cross-site é recusado mesmo com a origem batendo", () => {
  // É o próprio navegador dizendo que o pedido nasceu noutro site. Um atacante
  // que consiga forjar o Origin não forja isto — quem escreve é o navegador.
  assert.equal(origemAceita({
    ...daCasa, origin: "https://www.avanest.com.br", fetchSite: "cross-site",
  }), false);
});

test("origem: atrás do proxy vale a origem encaminhada, e também a do Next", () => {
  // Na Vercel o pedido chega com x-forwarded-host, e a origem que o Next
  // calcula é a interna. Aceitar só uma das duas quebra num dos dois lugares:
  // a encaminhada em produção, a do Next em desenvolvimento.
  assert.equal(origemAceita({
    origin: "https://www.avanest.com.br",
    esperada: "https://www.avanest.com.br",
    doNextUrl: "http://localhost:3000",
    fetchSite: null,
  }), true);
  assert.equal(origemAceita({
    origin: "http://localhost:3000",
    esperada: "https://www.avanest.com.br",
    doNextUrl: "http://localhost:3000",
    fetchSite: null,
  }), true);
});

// ---------------------------------------------------------------------------
// Em que formato
// ---------------------------------------------------------------------------

test("formato: JSON com charset colado continua sendo JSON", () => {
  // É como o cabeçalho chega de verdade. Comparar por igualdade recusaria a
  // maioria dos pedidos corretos.
  assert.equal(formatoAceito("application/json; charset=utf-8", true), true);
  assert.equal(formatoAceito("APPLICATION/JSON", true), true);
});

test("formato: formulário disfarçado não passa por JSON", () => {
  // É o formato que um <form> de outro site consegue enviar sem preflight.
  assert.equal(formatoAceito("application/x-www-form-urlencoded", true), false);
  assert.equal(formatoAceito("multipart/form-data; boundary=x", true), false);
  assert.equal(formatoAceito("text/plain", true), false);
  assert.equal(formatoAceito(null, true), false);
});

test("formato: onde não se exige JSON, qualquer um serve", () => {
  assert.equal(formatoAceito(null, false), true);
  assert.equal(formatoAceito("text/plain", false), true);
});

// ---------------------------------------------------------------------------
// De que tamanho
// ---------------------------------------------------------------------------

test("tamanho: o corpo dentro do teto passa, e o de cima não", () => {
  assert.equal(tamanhoAceito(String(TAMANHO_MAXIMO)), true);
  assert.equal(tamanhoAceito(String(TAMANHO_MAXIMO + 1)), false);
  assert.equal(tamanhoAceito("500", 400), false);
  assert.equal(tamanhoAceito("400", 400), true);
});

test("tamanho: sem cabeçalho vale zero, e zero passa", () => {
  // Há rotas que gravam sem corpo nenhum.
  assert.equal(tamanhoAceito(null), true);
  assert.equal(tamanhoAceito("0"), true);
});

test("tamanho: Content-Length que não é número é recusado", () => {
  // `Number("abc")` é NaN, e NaN escapa de qualquer comparação de "maior que".
  // Sem a checagem explícita, um corpo gigante com este cabeçalho passaria
  // pelo teto como se fosse pequeno.
  assert.equal(tamanhoAceito("abc"), false);
  assert.equal(tamanhoAceito("1e999"), false, "Infinity também não é finito");
  assert.equal(tamanhoAceito("-1"), false);
});

// ---------------------------------------------------------------------------
// Quantas vezes
// ---------------------------------------------------------------------------

test("limite: a primeira tentativa abre a janela", () => {
  const v = contarTentativa(undefined, 1_000, 3, 60_000);
  assert.equal(v.permitido, true);
  assert.deepEqual(v.permitido && v.entrada, { count: 1, resetAt: 61_000 });
});

test("limite: conta até o limite e barra a seguinte", () => {
  let entrada = { count: 1, resetAt: 61_000 };
  for (const esperado of [2, 3]) {
    const v = contarTentativa(entrada, 1_000, 3, 60_000);
    assert.equal(v.permitido, true);
    entrada = (v as { entrada: typeof entrada }).entrada;
    assert.equal(entrada.count, esperado);
  }
  const barrada = contarTentativa(entrada, 1_000, 3, 60_000);
  assert.equal(barrada.permitido, false);
});

test("limite: a janela não desliza — contar de novo não adia o fim dela", () => {
  // Janela fixa: a primeira tentativa marca o fim, e as seguintes não o
  // empurram. Sem isto, bater sem parar manteria a pessoa presa para sempre.
  const primeira = contarTentativa(undefined, 1_000, 5, 60_000);
  const entrada = (primeira as { entrada: { count: number; resetAt: number } }).entrada;
  const segunda = contarTentativa(entrada, 30_000, 5, 60_000);
  assert.equal((segunda as { entrada: { resetAt: number } }).entrada.resetAt, 61_000);
});

test("limite: passada a janela, a contagem recomeça do zero", () => {
  const vencida = { count: 99, resetAt: 61_000 };
  const v = contarTentativa(vencida, 61_000, 3, 60_000);
  assert.equal(v.permitido, true, "resetAt igual ao agora já está vencida");
  assert.equal((v as { entrada: { count: number } }).entrada.count, 1);
});

test("limite: a espera devolvida nunca é zero", () => {
  // Um "Retry-After: 0" convida a repetir na mesma hora, que é exatamente o
  // que o limite existe para impedir.
  const quaseNoFim = contarTentativa({ count: 9, resetAt: 1_100 }, 1_000, 3, 60_000);
  assert.equal(quaseNoFim.permitido, false);
  assert.equal((quaseNoFim as { esperarSegundos: number }).esperarSegundos, 1);

  const meio = contarTentativa({ count: 9, resetAt: 31_000 }, 1_000, 3, 60_000);
  assert.equal((meio as { esperarSegundos: number }).esperarSegundos, 30);
});
