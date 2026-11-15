import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// O que a auditoria de SEO de 15/11/2026 corrigiu (Lighthouse no celular:
// SEO 100 nas páginas públicas). Aqui, para não voltar.
const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

test("seo: a oferta do software na capa leva o preço de entrada, com validade", () => {
  const capa = ler("app/page.tsx");
  // Sem `price`, o Google recusa o resultado rico de software.
  assert.match(capa, /price: String\(precoDeEntrada\)/);
  assert.match(capa, /priceValidUntil: `\$\{new Date\(\)\.getFullYear\(\)\}-12-31`/);
  assert.match(capa, /JSON\.stringify\(dadosEstruturados\(preco\)\)/);
  // O preço sai da tabela, nunca escrito à mão.
  assert.match(capa, /const preco = await precoDeEntrada\(\);/);
});

test("seo: o logo que leva à capa tem o nome que se lê na tela", () => {
  // aria-label "AVANEST" num link cujo texto visível é "AVANEST GESTÃO EM
  // ANESTESIOLOGIA" é nome acessível diferente do rótulo visível (WCAG 2.5.3).
  for (const arq of ["components/pagina-de-conteudo.tsx", "components/pagina-de-escore.tsx", "app/recursos/page.tsx", "app/escores/page.tsx"]) {
    assert.doesNotMatch(ler(arq), /<Link href="\/" aria-label="AVANEST"><AppLogo \/><\/Link>/, arq);
  }
});

test("seo: a volta do login fica fora da busca", () => {
  assert.match(ler("app/robots.ts"), /"\/auth\/"/);
});

test("excluir avaliação: a ficha anestésica ligada a ela é desligada antes, e não trava mais", () => {
  // 15/11/2026: "não apaga" — evolucoes_anestesicas.avaliacao_id não tem ON
  // DELETE e o banco recusava. A ficha guarda a cópia da pré-anestésica.
  const rota = ler("app/api/avaliacoes/[id]/route.ts");
  const desliga = rota.indexOf('.from("evolucoes_anestesicas")\n    .update({ avaliacao_id: null })');
  const apaga = rota.indexOf('.from("avaliacoes")\n    .delete()');
  assert.ok(desliga > 0 && apaga > desliga, "a ficha é desligada antes do delete da avaliação");
  assert.match(ler("lib/evolucao/importar.ts"), /preanestesica_origem: avaliacao \? \{ avaliacao_id: avaliacao\.id/);
});

test("seo: o rodapé de todas as páginas públicas liga a cada escore (Search Console, 15/11/2026)", () => {
  const rodape = ler("components/rodape-publico.tsx");
  for (const c of ["/escores/stop-bang", "/escores/apfel", "/escores/indice-de-lee", "/escores/classificacao-asa"]) {
    assert.match(rodape, new RegExp(`href: "${c}"`), c);
    assert.match(ler("app/sitemap.ts"), new RegExp(`caminho: "${c}"`), `${c} no sitemap`);
  }
  assert.match(rodape, /\{ESCORES_NO_RODAPE\.map\(\(p\) => <Link key=\{p\.href\} href=\{p\.href\}>\{p\.nome\}<\/Link>\)\}/);
});
