import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Auditoria de qualidade (23/11/2026): toda página pública com o menu do topo
// começa pelo "Pular para o conteúdo", e o destino existe logo depois do topo.
const PAGINAS = [
  "app/page.tsx", "app/planos/page.tsx", "app/recursos/page.tsx", "app/escores/page.tsx",
  "app/seguranca/page.tsx", "app/app/page.tsx", "components/pagina-legal.tsx",
  "components/pagina-de-conteudo.tsx", "components/pagina-de-escore.tsx",
];

test("cada página pública tem o link e o destino, nesta ordem", () => {
  for (const caminho of PAGINAS) {
    const fonte = fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
    const link = fonte.indexOf("<PularParaOConteudo />");
    const topo = fonte.indexOf('<header className="avnNav');
    const destino = fonte.indexOf('id="conteudo" tabIndex={-1}');
    assert.ok(link > 0 && link < topo, `${caminho}: o link vem antes do menu`);
    assert.ok(destino > topo, `${caminho}: o destino vem depois do menu`);
  }
});
