import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// As páginas que respondem às buscas de quem ainda não conhece o AVANEST.
//
// Uma página nova que não entra no sitemap, que nenhuma outra aponta ou que
// abre atrás da cortina da marca existe no repositório e não existe no Google.
// Nada disso quebra o build: some em silêncio. Estes testes são a lista de
// conferência de lançamento de página, escrita uma vez.

const ler = (caminho: string) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const PAGINAS = [
  { caminho: "/avaliacao-pre-anestesica", arquivo: "app/avaliacao-pre-anestesica/page.tsx" },
  { caminho: "/ficha-anestesica", arquivo: "app/ficha-anestesica/page.tsx" },
  { caminho: "/escala-medica", arquivo: "app/escala-medica/page.tsx" },
  // A página de produto da avaliação é o destino dos anúncios: o rodapé e o
  // guia apontam para ela; a capa e o /recursos continuam levando ao guia.
  { caminho: "/avaliacao-pre-anestesica-digital", arquivo: "app/avaliacao-pre-anestesica-digital/page.tsx", produto: true },
];

test("as páginas de conteúdo estão no sitemap e fora do bloqueio do robots", () => {
  const sitemap = ler("app/sitemap.ts");
  const robots = ler("app/robots.ts");
  for (const p of PAGINAS) {
    assert.ok(sitemap.includes(`caminho: "${p.caminho}"`), `${p.caminho} fora do sitemap`);
    assert.ok(!robots.includes(`"${p.caminho}"`), `${p.caminho} bloqueada no robots`);
  }
});

test("as páginas de conteúdo são ligadas pelo rodapé, pela capa e pelo /recursos", () => {
  // Página que só o sitemap aponta é tratada pelo buscador como periferia.
  const rodape = ler("components/rodape-publico.tsx");
  const capa = ler("app/page.tsx");
  const recursos = ler("app/recursos/page.tsx");
  for (const p of PAGINAS) {
    assert.ok(rodape.includes(`"${p.caminho}"`), `${p.caminho} fora do rodapé`);
    if ("produto" in p) {
      assert.ok(ler("app/avaliacao-pre-anestesica/page.tsx").includes(`"${p.caminho}"`),
        `${p.caminho} sem link no guia`);
      continue;
    }
    assert.ok(capa.includes(`"${p.caminho}"`), `${p.caminho} sem link na capa`);
    assert.ok(recursos.includes(`"${p.caminho}"`), `${p.caminho} sem link no /recursos`);
  }
});

test("quem chega pela busca não espera a abertura da marca", () => {
  // Dois segundos de tela branca depois do clique são o tempo de voltar ao
  // Google e clicar no resultado seguinte.
  const abertura = ler("components/abertura-animada.tsx");
  const lista = abertura.match(/PAGINAS_SEM_ABERTURA = \[([^\]]*)\]/);
  assert.ok(lista, "sumiu a lista de páginas sem abertura");
  for (const p of [...PAGINAS.map((x) => x.caminho), "/escores", "/recursos", "/planos"])
    assert.ok(lista![1].includes(`"${p.slice(1)}"`), `${p} abre com a cortina`);
  assert.match(abertura, /location\.pathname==='\/'/, "a capa abre com a cortina");
});

test("título e descrição cabem no resultado do Google", () => {
  for (const p of PAGINAS) {
    const texto = ler(p.arquivo);
    const titulo = texto.match(/const TITULO = "(.+)";/)![1];
    const descricao = texto.match(/const DESCRICAO =\s*\n?\s*((?:"[^"]*"\s*\+?\s*)+);/)![1]
      .split(/"\s*\+\s*"/).join("").replace(/^"|"$/g, "");
    // O título vai ao ar com " | AVANEST" (10 caracteres) no fim.
    assert.ok(titulo.length + 10 <= 65, `${p.caminho}: título com ${titulo.length + 10}`);
    assert.ok(descricao.length >= 100 && descricao.length <= 160,
      `${p.caminho}: descrição com ${descricao.length}`);
    assert.match(texto, /alternates|paginaPublica\(\{/, `${p.caminho} sem canonical`);
  }
});

test("o texto clínico cita a resolução e leva a assinatura médica", () => {
  // Conteúdo que orienta conduta é avaliado por quem o assina e de onde tira
  // o que afirma. Sem a fonte e sem a revisão, a página não compete.
  for (const arquivo of ["app/avaliacao-pre-anestesica/page.tsx", "app/ficha-anestesica/page.tsx"]) {
    const texto = ler(arquivo);
    assert.match(texto, /revisadoEm=\{REVISADO_EM\}/, `${arquivo} sem assinatura`);
    assert.match(texto, /medica: true/, `${arquivo} sem marcação de página médica`);
    assert.match(texto, /2174_2017\.pdf/, `${arquivo} sem a referência oficial`);
  }
});
