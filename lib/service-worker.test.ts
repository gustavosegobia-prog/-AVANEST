import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * O `sw.js` não é um módulo: roda cru no navegador, sem import e sem export,
 * e fala com `self`. Não dá para importá-lo aqui.
 *
 * Então o teste LÊ O ARQUIVO QUE VAI PARA O AR e monta a função a partir do
 * texto dele. Copiar a regra para dentro do teste seria mais simples e testaria
 * a cópia — e a cópia é justamente o que não vai para o navegador.
 */
function regraDoServiceWorker(): (caminho: string) => boolean {
  const fonte = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const i = fonte.indexOf("function ehArquivoDeBuild(");
  assert.notEqual(i, -1, "a função sumiu do sw.js — o teste está olhando para o arquivo errado");
  const fim = fonte.indexOf("\n}", i);
  assert.notEqual(fim, -1, "não achei o fim da função");
  const corpo = fonte.slice(i, fim + 2);
  return new Function(`${corpo}; return ehArquivoDeBuild;`)() as (c: string) => boolean;
}

const ehArquivoDeBuild = regraDoServiceWorker();

test("service worker: guarda os arquivos de build, que têm o conteúdo no nome", () => {
  // Mudou o conteúdo, mudou o endereço. Um arquivo guardado nunca está velho.
  assert.equal(ehArquivoDeBuild("/_next/static/chunks/0dty8r1y3.1p2.css"), true);
  assert.equal(ehArquivoDeBuild("/_next/static/chunks/main-abc123.js"), true);
  assert.equal(ehArquivoDeBuild("/_next/static/media/outfit.woff2"), true);
  assert.equal(ehArquivoDeBuild("/favicon.svg"), true);
  assert.equal(ehArquivoDeBuild("/icone192.png"), true);
  assert.equal(ehArquivoDeBuild("/icone512.png"), true);
});

test("service worker: NUNCA guarda página — é assim que se mostra a escala do mês passado", () => {
  // Esta é a razão de o cache existir separado. Um HTML guardado devolve a
  // escala, a agenda ou o financeiro de ontem sem ninguém perceber.
  for (const pagina of [
    "/", "/dashboard", "/login", "/avaliacoes/123", "/escores/apfel",
    "/organizacoes", "/assinatura", "/convite/abc", "/comecar",
  ]) {
    assert.equal(ehArquivoDeBuild(pagina), false, `${pagina} é página, não pode ser guardada`);
  }
});

test("service worker: NUNCA guarda API", () => {
  for (const rota of [
    "/api/assinatura/checkout", "/api/assinatura/cupom", "/api/push/avisar",
    "/api/admin/users", "/api/assinatura/webhook/stripe",
  ]) {
    assert.equal(ehArquivoDeBuild(rota), false, `${rota} é API, não pode ser guardada`);
  }
});

test("service worker: /_next/image e /_next/data ficam de fora", () => {
  // Parecem estáticos pelo prefixo e não são: o endereço deles não muda
  // quando o conteúdo muda, que é exatamente a propriedade de que o cache
  // depende. /_next/data devolve os DADOS de uma página.
  assert.equal(ehArquivoDeBuild("/_next/image?url=%2Flogo.png&w=256"), false);
  assert.equal(ehArquivoDeBuild("/_next/data/build/dashboard.json"), false);
  assert.equal(ehArquivoDeBuild("/_next/static"), false, "sem a barra não é a pasta");
});

test("service worker: nada que só PAREÇA um arquivo de build entra", () => {
  // O guardião compara o começo do caminho. Um endereço que traz o texto no
  // meio, e não no começo, não pode passar.
  assert.equal(ehArquivoDeBuild("/dashboard/_next/static/x.js"), false);
  assert.equal(ehArquivoDeBuild("/api/_next/static/x.js"), false);
  assert.equal(ehArquivoDeBuild("/favicon.svg.html"), false);
  assert.equal(ehArquivoDeBuild("/icone192.png/../dashboard"), false);
});
