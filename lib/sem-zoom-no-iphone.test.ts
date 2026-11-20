import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { comSemZoom, ehIos, ROTEIRO_SEM_ZOOM_NO_IPHONE } from "./sem-zoom-no-iphone.ts";

// O iPhone dava zoom na ficha ao tocar no campo do peso e dos exames, e a
// página ficava cortada (19/11/2026). A trava vai só para o iOS.

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

/** Roda o roteiro de verdade num documento de mentira, com uma meta viewport. */
function rodar(nav: { userAgent: string; platform?: string; maxTouchPoints?: number }, conteudo: string) {
  const meta = { conteudo, getAttribute: () => meta.conteudo, setAttribute: (_: string, v: string) => { meta.conteudo = v; } };
  const documento = { readyState: "complete", head: {}, documentElement: {}, querySelectorAll: () => [meta], addEventListener() {} };
  new Function("navigator", "document", "window", ROTEIRO_SEM_ZOOM_NO_IPHONE)(nav, documento, {});
  return meta.conteudo;
}

test("sem zoom no iPhone: só o iOS ganha a trava, e ela não se repete", () => {
  assert.equal(ehIos({ userAgent: IPHONE }), true);
  assert.equal(ehIos({ userAgent: "Mac", platform: "MacIntel", maxTouchPoints: 5 }), true, "iPad se apresenta como Mac com toque");
  assert.equal(ehIos({ userAgent: "Mac", platform: "MacIntel", maxTouchPoints: 0 }), false, "Mac de mesa, não");
  assert.equal(ehIos({ userAgent: ANDROID }), false);
  assert.equal(comSemZoom("width=device-width, initial-scale=1"), "width=device-width, initial-scale=1, maximum-scale=1");
  assert.equal(comSemZoom("width=device-width, initial-scale=1, maximum-scale=1"), "width=device-width, initial-scale=1, maximum-scale=1");

  // O roteiro do <head> faz o mesmo: o iPhone ganha a trava; o Android, que
  // perderia a pinça, fica como estava.
  assert.equal(rodar({ userAgent: IPHONE }, "width=device-width, initial-scale=1"), "width=device-width, initial-scale=1, maximum-scale=1");
  assert.equal(rodar({ userAgent: "Mac", platform: "MacIntel", maxTouchPoints: 5 }, "width=device-width, initial-scale=1"), "width=device-width, initial-scale=1, maximum-scale=1");
  assert.equal(rodar({ userAgent: ANDROID }, "width=device-width, initial-scale=1"), "width=device-width, initial-scale=1");
  assert.equal(rodar({ userAgent: IPHONE }, "width=device-width, initial-scale=1, maximum-scale=1"), "width=device-width, initial-scale=1, maximum-scale=1");
});

test("sem zoom no iPhone: o roteiro está no <head> de todas as páginas, e o viewport geral não trava a pinça", () => {
  const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /<script dangerouslySetInnerHTML=\{\{ __html: ROTEIRO_SEM_ZOOM_NO_IPHONE \}\} \/>/);
  // A trava não pode ir para todos (no Android ela bloquearia a pinça).
  assert.doesNotMatch(layout, /maximumScale/);
});
