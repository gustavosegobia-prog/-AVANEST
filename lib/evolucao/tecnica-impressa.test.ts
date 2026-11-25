import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Impressa, a ficha leva só a técnica usada (25/11/2026): sem as linhas das
// técnicas não feitas nem as opções não escolhidas. Sem nenhuma marcada, sai a
// folha inteira, para preencher à mão.
const rodape = fs.readFileSync(new URL("../../components/evolucao/rodape-da-folha.tsx", import.meta.url), "utf8");
const bloco = rodape.slice(rodape.indexOf('<div className="evoRTecnica">'), rodape.indexOf('<div className="evoRLinha larga alta">'));

test("só na impressão e só com alguma técnica marcada", () => {
  assert.match(rodape, /const soAUsada = m\.impresso && tecnicas\.length > 0;/);
});

test("cada linha de técnica some quando não foi usada", () => {
  for (const usa of ["usaNeuraxial", "usaGeral", "usaSedacao", "usaBloqueio"]) {
    assert.match(bloco, new RegExp(`\\{\\(!soAUsada \\|\\| ${usa}\\) && \\(`), usa);
  }
});

test("toda opção da técnica passa pelo filtro do não escolhido", () => {
  assert.equal((bloco.match(/<Op /g) ?? []).length, 0, "sobrou opção que sai sempre");
  assert.ok((bloco.match(/<OpT esconder=\{soAUsada\}/g) ?? []).length >= 20);
});

test("todo código de técnica cai numa linha", () => {
  const folha = fs.readFileSync(new URL("./folha.ts", import.meta.url), "utf8");
  const codigos = [...folha.slice(folha.indexOf("export const TECNICAS"), folha.indexOf("export const BLOQUEIOS"))
    .matchAll(/codigo: "([a-z_]+)"/g)].map((x) => x[1]);
  assert.ok(codigos.length >= 10);
  const cobertos = (c: string) => c.startsWith("geral")
    || ["raquianestesia", "peridural", "combinada", "sedacao", "local_assistida", "bloqueio_periferico"].includes(c);
  for (const c of codigos) assert.ok(cobertos(c), `a técnica ${c} não tem linha: sumiria da impressão`);
});
