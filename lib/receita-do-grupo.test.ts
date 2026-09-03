import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * O Financeiro do GRUPO não pode somar plantão privado.
 *
 * A consulta mora num componente de servidor, que não dá para chamar daqui sem
 * um Supabase de verdade. Então o teste lê O ARQUIVO e confere a cláusula.
 * É rústico, e protege duas coisas que valem o incômodo:
 *
 *   PRIVACIDADE. O plantão privado é o que a escala promete que "entra só na
 *   sua escala e no seu mês — ninguém do grupo enxerga". Sem o filtro, ele
 *   aparecia no Financeiro do grupo, com hospital e valor.
 *
 *   UM TOTAL QUE NÃO DEPENDE DE QUEM OLHA. A política de RLS mostra a cada um
 *   o próprio privado, então sem este filtro dois administradores abriam o
 *   mesmo mês e liam "A receber" diferentes. Foi medido no banco: R$ 61.600
 *   para o dono dos plantões, R$ 42.900 para o colega — R$ 18.700 de
 *   diferença, sem nada na tela explicando.
 */
const pagina = readFileSync(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8");

/** O trecho da consulta que alimenta a receita de plantões do grupo. */
function consultaDaReceita(): string {
  const marca = 'supabase.from("plantoes")\n          .select("id,perfil_id,data,valor,situacao,local_id,local_texto")';
  const i = pagina.indexOf(marca);
  assert.notEqual(i, -1,
    "a consulta da receita de plantões mudou de forma — o teste está olhando para o lugar errado");
  return pagina.slice(i, pagina.indexOf("Promise.resolve", i));
}

test("receita do grupo: a consulta de plantões exclui os privados", () => {
  assert.match(consultaDaReceita(), /\.eq\("privado", false\)/,
    "sem isto, o plantão privado volta a ser somado no Financeiro do grupo");
});

test("receita do grupo: a consulta NÃO se limita a um perfil", () => {
  // O contrário do defeito acima, e igualmente importante: esta consulta é a
  // conta do SERVIÇO. Um `.eq("perfil_id", ...)` aqui faria o Financeiro do
  // grupo mostrar só os plantões de quem abriu a tela — e ninguém notaria,
  // porque o número continuaria parecendo um número.
  assert.doesNotMatch(consultaDaReceita(), /\.eq\("perfil_id"/,
    "esta é a receita do serviço, não a de uma pessoa");
});

test("meu financeiro: continua trazendo os meus privados", () => {
  // A outra metade da separação. O plantão privado não some do sistema: ele
  // sai do Financeiro do grupo e continua em Meu Financeiro, que é filtrado
  // por perfil e é onde a conta dele deve ser feita.
  const meu = readFileSync(new URL("../components/meu-financeiro.tsx", import.meta.url), "utf8");
  const i = meu.indexOf('cliente.from("plantoes")');
  assert.notEqual(i, -1, "a consulta de Meu Financeiro mudou de forma");
  const trecho = meu.slice(i, i + 400);
  assert.match(trecho, /\.eq\("perfil_id", perfilId\)/, "Meu Financeiro é filtrado por pessoa");
  assert.doesNotMatch(trecho, /\.eq\("privado"/,
    "o privado é seu e tem de aparecer no seu financeiro");
});
