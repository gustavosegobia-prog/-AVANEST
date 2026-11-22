import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mostrarPrimeirosPassos, primeirosPassos } from "./primeiros-passos.ts";

// 22/11/2026: o primeiro assinante fez uma avaliação, abriu uma ficha vazia e
// não voltou. A lista diz o que fazer primeiro e se risca pelo próprio uso.
const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

test("primeiros passos: a ficha só quando liberada, a equipe só no grupo, cada um riscado pelo uso", () => {
  const individual = primeirosPassos({ escala: false, avaliacao: true, ficha: false, equipe: null });
  assert.deepEqual(individual.map((p) => [p.chave, p.feito]), [["escala", false], ["avaliacao", true], ["ficha", false]]);
  const grupoSemFicha = primeirosPassos({ escala: true, avaliacao: false, ficha: null, equipe: false });
  assert.deepEqual(grupoSemFicha.map((p) => p.chave), ["escala", "avaliacao", "equipe"]);
  assert.deepEqual(individual[2].destino, { href: "/evolucao" });
  assert.deepEqual(individual[0].destino, { area: "plantoes" });
});

test("primeiros passos: só nos 30 primeiros dias, só para quem administra, só enquanto falta algum", () => {
  const passos = primeirosPassos({ escala: false, avaliacao: true, ficha: false, equipe: null });
  const agora = new Date("2026-11-22T12:00:00Z");
  assert.equal(mostrarPrimeirosPassos({ criadaEm: "2026-11-03T21:35:00Z", agora, papel: "owner", passos }), true);
  assert.equal(mostrarPrimeirosPassos({ criadaEm: "2026-10-01T00:00:00Z", agora, papel: "owner", passos }), false, "passou do mês");
  assert.equal(mostrarPrimeirosPassos({ criadaEm: "2026-11-03T21:35:00Z", agora, papel: "medico", passos }), false, "quem só trabalha não vê");
  const tudo = primeirosPassos({ escala: true, avaliacao: true, ficha: true, equipe: null });
  assert.equal(mostrarPrimeirosPassos({ criadaEm: "2026-11-03T21:35:00Z", agora, papel: "owner", passos: tudo }), false, "acabou, some");
});

test("primeiros passos: o painel calcula pelo banco e mostra abaixo da faixa do teste", () => {
  const pagina = ler("app/dashboard/page.tsx");
  assert.match(pagina, /supabase\.from\("evolucao_registros"\)\.select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(pagina, /equipe: instituicao\?\.tipo === "individual" \? null : \(perfis\?\.length \?\? 0\) > 1,/);
  assert.match(pagina, /primeirosPassos=\{passos\}/);
  const painel = ler("app/dashboard/dashboard-client.tsx");
  assert.match(painel, /<PrimeirosPassos passos=\{primeirosPassos\} onIrPara=\{\(area\) => changeView\(area\)\} \/>/);
});
