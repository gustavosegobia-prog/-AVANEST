import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
// @ts-expect-error: o gerador é um .mjs sem tipos; o teste só precisa da função.
import { AREAS_DO_SISTEMA, gerarCssDoSite } from "../scripts/gerar-css-do-site.mjs";

// O CSS das páginas públicas separado do sistema (auditoria de SEO de
// 15/11/2026): a capa, os guias e os escores baixavam os 640 KB do
// globals.css inteiro. Agora o layout raiz carrega app/site.css (só o que as
// páginas públicas usam) e cada área do sistema carrega o globals.css inteiro.
// Conferido antes de publicar: 25 páginas públicas, celular e computador, claro
// e escuro — 15.640 elementos com o estilo calculado idêntico antes e depois.
const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

test("css do site: o site.css commitado é o que o gerador produz do globals.css de agora", () => {
  const { css } = gerarCssDoSite() as { css: string };
  assert.equal(ler("app/site.css"), css, "rode: node scripts/gerar-css-do-site.mjs");
});

test("css do site: o raiz carrega o site.css, e cada área do sistema o globals.css inteiro", () => {
  const raiz = ler("app/layout.tsx");
  assert.match(raiz, /^import "\.\/site\.css";$/m);
  assert.doesNotMatch(raiz, /^import "\.\/globals\.css";$/m);
  for (const area of AREAS_DO_SISTEMA as string[]) {
    assert.match(ler(`app/${area}/layout.tsx`), /^import "\.\.\/globals\.css";$/m, area);
  }
  // O build e o dev regeneram antes de compilar: editar o globals.css basta.
  const pacote = JSON.parse(ler("package.json")) as { scripts: Record<string, string> };
  assert.match(pacote.scripts.build, /^node scripts\/gerar-css-do-site\.mjs && next build$/);
  assert.match(pacote.scripts.dev, /^node scripts\/gerar-css-do-site\.mjs && next dev$/);
});

test("css do site: área nova que exige login entra na lista (senão ela abriria sem o CSS do sistema)", () => {
  // Toda pasta de app/ que o robots bloqueia por ser do sistema logado.
  const robots = ler("app/robots.ts");
  const PUBLICAS_DE_PROPOSITO = new Set(["api", "auth", "atualizar-senha", "recuperar-senha", "convite", "q"]);
  const bloqueadas = [...robots.matchAll(/^\s*"\/([a-z0-9-]+)\/?",?$/gm)].map((m) => m[1])
    .filter((d) => fs.existsSync(new URL(`../app/${d}`, import.meta.url)) && !PUBLICAS_DE_PROPOSITO.has(d));
  for (const d of bloqueadas) assert.ok((AREAS_DO_SISTEMA as string[]).includes(d), `app/${d} fora de AREAS_DO_SISTEMA`);
});

test("css do site: o que é da capa fica, o que é só da ficha anestésica sai", () => {
  const site = ler("app/site.css");
  assert.match(site, /\.avnLanding/);
  assert.match(site, /\.avnBrand \.brandBlue\{color:#2e89d7\}/);
  assert.doesNotMatch(site, /\.evoBotao\b/);
  assert.ok(site.length < ler("app/globals.css").length * 0.6);
});
