import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fraseDoPrecoDeEntrada, menorPrecoMensal, precoDeEntrada, REVALIDAR_PRECO_DA_CAPA } from "./preco-de-entrada.ts";

const ler = (caminho: string) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("preço da capa: o menor preco_mensal dos planos ativos, sem o sob consulta nem o inativo", () => {
  // O formato da tabela de verdade (01/11/2026): o "Teste interno" de R$ 5 é inativo, o hospital é sob consulta.
  const planos = [
    { preco_mensal: "129.00", ativo: true, sob_consulta: false },
    { preco_mensal: "239.00", ativo: true, sob_consulta: false },
    { preco_mensal: 599, ativo: false, sob_consulta: false },
    { preco_mensal: null, ativo: true, sob_consulta: true },
    { preco_mensal: "5.00", ativo: false, sob_consulta: false },
  ];
  assert.equal(menorPrecoMensal(planos), 129);
  assert.equal(fraseDoPrecoDeEntrada(129), "Planos a partir de R$ 129,00/mês");
  // Sem preço, nada: a capa não mostra a linha.
  for (const vazio of [[], null, undefined, [{ preco_mensal: null }], [{ preco_mensal: "abc" }], [{ preco_mensal: 0 }]]) {
    assert.equal(menorPrecoMensal(vazio), null);
  }
  assert.equal(fraseDoPrecoDeEntrada(null), null);
});

test("preço da capa: sem banco configurado ou com o banco fora do ar, a linha some (e a página não quebra)", async () => {
  const antes = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, chave: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    assert.equal(await precoDeEntrada(), null);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "x";
    assert.equal(await precoDeEntrada(), null);
  } finally {
    if (antes.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = antes.url;
    if (antes.chave === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = antes.chave;
  }
});

test("preço da capa: vem da tabela, com cache, e a capa continua estática", () => {
  const capa = ler("app/page.tsx");
  // O número nunca é digitado na capa.
  assert.doesNotMatch(capa, /a partir de R\$/i);
  assert.match(capa, /fraseDoPrecoDeEntrada\(await precoDeEntrada\(\)\)/);
  assert.match(capa, /\{precoDosPlanos && <p className="avnOfertaPreco">/);
  // A capa refaz no mesmo ritmo da consulta, e não pede cookie (que a tornaria dinâmica).
  assert.match(capa, new RegExp(`export const revalidate = ${REVALIDAR_PRECO_DA_CAPA};`));
  assert.doesNotMatch(capa, /utils\/supabase\/server|cookies\(\)|force-dynamic/);
  const consulta = ler("lib/preco-de-entrada.ts");
  assert.match(consulta, /next: \{ revalidate: REVALIDAR_PRECO_DA_CAPA/);
  // A mesma fonte da página de planos: a tabela `planos`, só os ativos.
  assert.match(consulta, /\/rest\/v1\/planos\?/);
  assert.match(consulta, /ativo=eq\.true/);
  assert.match(ler("app/planos/page.tsx"), /from\("planos"\)\.select\([^)]*\)\.eq\("ativo", true\)/);
});
