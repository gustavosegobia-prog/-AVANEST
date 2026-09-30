import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** A JANELA MODAL — contorno por fora, rolagem por dentro, um recuo só. */
const ler = (c: string) => readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const css = ler("app/globals.css");
const janela = ler("components/janela.tsx");
const ui = ler("components/admin-ui.tsx");
const painel = ler("app/dashboard/dashboard-client.tsx");

test("tokens de janela: raio 16px, borda 1px, sombra e recuo 24/16", () => {
  assert.match(css, /--raio-modal:16px; --borda-modal:1px solid var\(--cor-borda\); --sombra-modal:var\(--sombra-3\);/);
  assert.match(css, /--recuo-modal:24px;/);
  assert.match(css, /@media\(max-width:560px\)\{\n  :root\{--recuo-modal:16px\}/);
});

test("a caixa de fora não rola; a de dentro rola", () => {
  assert.match(css, /\.janela\{[^}]*overflow:hidden;[^}]*border-radius:var\(--raio-modal\)/);
  assert.match(css, /\.janelaCorpo\{[^}]*overflow-y:auto/);
  assert.match(css, /\.admDialogo\{[^}]*overflow:hidden;/);
  assert.match(css, /\.admDialogoRolagem\{[^}]*overflow-y:auto/);
});

test("Minha conta usa a janela compartilhada, sem margem lateral própria nos blocos", () => {
  assert.match(painel, /<Janela titulo="Minha conta"/);
  assert.doesNotMatch(painel, /className="contaModal"/);
  assert.match(css, /\.contaDados\{margin:0;/);
  assert.match(css, /\.contaSenha\{margin:var\(--esp-5\) 0 0;/);
});

test("a página de fundo trava enquanto houver janela aberta — em todas", () => {
  assert.match(css, /html\.rolagemTravada,html\.rolagemTravada body\{overflow:hidden\}/);
  assert.match(ui, /if \(travas\+\+ === 0\) document\.documentElement\.classList\.add\("rolagemTravada"\);/);
  assert.equal((ui.match(/useTravaDeRolagem\(true\);/g) ?? []).length, 2, "Gaveta e Diálogo");
  assert.match(janela, /useTravaDeRolagem\(true\);/);
  assert.match(painel, /function PatientModal[\s\S]{0,600}useTravaDeRolagem\(true\);/);
});
