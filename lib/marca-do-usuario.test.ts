import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ladrilhoDaMarca, textoDaMarca } from "./marca-do-usuario.ts";

const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
// 22h55 em Brasília (UTC-3) do dia 28/10/2026.
const QUANDO = new Date("2026-10-29T01:55:00Z");

test("a marca diz quem, com o CRM, e a data e a hora de Brasília", () => {
  assert.equal(
    textoDaMarca({ nome: "Fulana  de Tal", crm: "crm-pr 12.345" }, QUANDO),
    "Fulana de Tal · CRM 12345/PR · 28/10/2026 22:55",
  );
  assert.equal(textoDaMarca({ nome: "Fulana de Tal", crm: "12345" }, QUANDO), "Fulana de Tal · CRM 12345 · 28/10/2026 22:55");
});

test("sem CRM (recepção, financeiro), só o nome e a hora", () => {
  assert.equal(textoDaMarca({ nome: "Ciclano", crm: null }, QUANDO), "Ciclano · 28/10/2026 22:55");
  assert.equal(textoDaMarca({ nome: "Ciclano", crm: "" }, QUANDO), "Ciclano · 28/10/2026 22:55");
});

test("o ladrilho é uma imagem SVG que não quebra com nome estranho", () => {
  const { url, largura, altura } = ladrilhoDaMarca(`Ana & "Bia" <Teste> · CRM 1/SP · 28/10/2026 22:55`);
  assert.match(url, /^data:image\/svg\+xml;charset=utf-8,/);
  const svg = decodeURIComponent(url.split(",")[1]);
  assert.match(svg, /Ana &amp; &quot;Bia&quot; &lt;Teste&gt;/);
  assert.doesNotMatch(svg, /<Teste>/);
  assert.match(svg, new RegExp(`width="${largura}" height="${altura}"`));
});

test("o ladrilho tem o tamanho do texto: no celular cada linha mostra o nome inteiro", () => {
  const curto = ladrilhoDaMarca(textoDaMarca({ nome: "Ana Lima", crm: null }, QUANDO));
  assert.equal(curto.corpo, 13);
  const comum = ladrilhoDaMarca(textoDaMarca({ nome: "Gustavo Segobia da Silva", crm: "49131/PR" }, QUANDO));
  assert.ok(comum.corpo >= 10 && comum.corpo < 13, `${comum.corpo}px`);
  // A área da crise no celular tem 358px de largura.
  assert.ok(comum.largura <= 358, `${comum.largura}px: maior que a área do celular`);
  // Nome comprido: a letra diminui, com um piso legível, e o texto ainda cabe.
  const longo = ladrilhoDaMarca("Maria Aparecida dos Santos Albuquerque · CRM 123456/SP · 28/10/2026 22:55");
  assert.ok(longo.corpo < 13 && longo.corpo >= 9);
  assert.ok(longo.alcance <= 358, `${longo.alcance}px`);
  const enorme = ladrilhoDaMarca("x".repeat(160));
  assert.equal(enorme.corpo, 9);
});

test("a marca vai no sistema (crise, calculadora) e nos dados dos pacientes, sem pegar toque", () => {
  // O sistema: o protocolo e a calculadora levam a marca também no PDF.
  assert.match(ler("components/intercorrencias/intercorrencias.tsx"), /<MarcaDaguaDoUsuario naImpressao \/>/);
  assert.match(ler("app/calculos/calculos-client.tsx"), /<MarcaDaguaDoUsuario naImpressao \/>/);
  // Os pacientes: só na tela — a ficha e os documentos saem limpos no papel.
  for (const arquivo of ["app/evolucao/[id]/page.tsx", "app/avaliacoes/[id]/page.tsx", "components/meu-financeiro.tsx"])
    assert.match(ler(arquivo), /<MarcaDaguaDoUsuario \/>/, arquivo);
  assert.match(ler("app/dashboard/dashboard-client.tsx"), /className="clinicalMain financeMain">\s*<MarcaDaguaDoUsuario \/>/);

  const css = ler("app/globals.css");
  assert.match(css, /\.marcaDoUsuario\{position:fixed;inset:0;[^}]*pointer-events:none/);
  assert.match(css, /mask-size:var\(--marca-do-usuario-tamanho\)/);
  assert.match(css, /@media print\{\s*\.marcaDoUsuario\{display:none\}[\s\S]*?\.marcaDoUsuario\.naImpressao\{display:block;visibility:visible/);
  // Discreta: o pedido foi "mais discreto".
  const opacidade = Number(css.match(/\.marcaDoUsuario\{[^}]*opacity:([\d.]+)/)![1]);
  assert.ok(opacidade <= 0.06, `opacidade ${opacidade}`);
});
