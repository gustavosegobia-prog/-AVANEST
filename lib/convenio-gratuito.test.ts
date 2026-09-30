import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * O QUARTO ESTADO QUE FALTAVA: gratuito por decisão.
 *
 * "Preço pendente" resolveu a confusão entre "ninguém preencheu" e "cobra de
 * verdade" — mas deixou um caso real sem resposta: um convênio que É
 * gratuito mesmo (SUS que não cobra do serviço, cortesia combinada). Sem um
 * jeito de dizer isso ao sistema, esse convênio ficaria para sempre com o
 * aviso amber de "falta preencher", que é mentira — não falta nada.
 *
 * A migração 202609300001_convenio_gratuito.sql acrescenta a coluna
 * `gratuito`, default `false` — gratuidade não é o padrão, é exceção
 * declarada. Nunca inferida a partir de "está zerado há muito tempo" ou
 * qualquer outra suposição: só vira `true` quando alguém aperta o botão.
 */
const ler = (caminho: string) =>
  readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("a coluna nasce false por padrão — gratuidade nunca é suposta", () => {
  const sql = ler("supabase/migrations/202609300001_convenio_gratuito.sql");
  assert.match(sql, /add column if not exists gratuito boolean not null default false/,
    "a coluna gratuito mudou de forma, tipo ou padrão");
});

test("o formulário só grava gratuito quando o valor digitado é zero", () => {
  // Marcar "gratuito" com um preço real cadastrado seria uma contradição que
  // a tela aceitaria calada: R$ 380,00 e gratuito ao mesmo tempo.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf("async function saveConvenio");
  const trecho = tela.slice(i, i + 900);
  assert.match(trecho, /const gratuito=valor===0&&form\.get\("gratuito"\)==="on";/,
    "o formulário deixou de condicionar gratuito ao valor ser zero");
});

test("o editor de preços em lote preserva gratuito só quando o valor continua zero", () => {
  // Digitar um valor de verdade no editor rápido faz sentido perder a marca
  // de gratuito — as duas coisas juntas não fazem sentido. Digitar zero de
  // novo preserva o que já estava marcado: este formulário não pergunta
  // sobre gratuidade, não é ele quem decide isso.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf("async function savePrices");
  const trecho = tela.slice(i, i + 900);
  assert.match(trecho, /const gratuito=amount===0&&Boolean\(rule\?\.gratuito\);/,
    "o editor em lote deixou de preservar/zerar gratuito corretamente");
});

test("toggleGratuito existe e só mexe no campo gratuito", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf("async function toggleGratuito");
  assert.notEqual(i, -1, "sumiu a função que alterna gratuito");
  const trecho = tela.slice(i, i + 300);
  assert.match(trecho, /update\(\{gratuito:!item\.gratuito,updated_at:/,
    "toggleGratuito deixou de alternar só o campo gratuito");
});

test("o botão de alternar só aparece quando o valor é zero", () => {
  // Alternar gratuidade num convênio que cobra R$ 380,00 não muda nada
  // visível — o botão ali seria confuso, não uma opção real.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const i = tela.indexOf("function ConvenioValoresPanel");
  const painel = tela.slice(i, i + 7500);
  assert.match(painel, /\{zerado&&<button[^>]*onClick=\{\(\)=>toggleGratuito\(item\)\}/,
    "o botão de marcar/desmarcar gratuito deixou de ser condicionado a valor zero");
});

test("createBilling e a fila de Atenção hoje concordam sobre o que é pendência", () => {
  // As duas perguntam a mesma coisa — "este convênio precisa de decisão?" —
  // e precisam responder igual. Divergir aqui é o mesmo defeito do
  // R$ 2.850,00: duas conclusões diferentes sobre o mesmo dado.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  assert.match(tela, /Number\(price\.valor\)===0&&!price\.gratuito/,
    "createBilling deixou de ignorar convênio gratuito no aviso de preço");
  assert.match(tela, /item\.ativo&&Number\(item\.valor\)===0&&!item\.gratuito/,
    "a contagem de pendência deixou de ignorar convênio gratuito");
});
