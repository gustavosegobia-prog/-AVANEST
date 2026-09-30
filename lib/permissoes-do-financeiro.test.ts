import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * DUAS FORMAS DE CONFERIR QUEM PODE, E QUEM CAÍA NO MEIO.
 *
 * Medido no banco, numa transação desfeita, papel por papel:
 *   - médico e recepção enxergavam ZERO convênios: o cadastro de paciente
 *     ficava com a lista fixa, e as sugestões da Produção chegavam vazias;
 *   - recepção com permissão de Financeiro (uma pessoa ativa hoje) via o
 *     Financeiro pela metade — sem preços, sem produção, sem as despesas do
 *     serviço, sem poder fechar o mês.
 * 202609300007 dá a lista de convênios (sem preço) a toda a equipe.
 * 202609300008 faz tudo do Financeiro usar current_has_permission.
 */
const ler = (c: string) => readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const lista = ler("supabase/migrations/202609300007_convenios_para_a_equipe.sql");
const perm = ler("supabase/migrations/202609300008_permissao_financeiro_por_inteiro.sql");
const tela = ler("app/dashboard/dashboard-client.tsx");
const pagina = ler("app/dashboard/page.tsx");
const plantoes = ler("components/plantoes.tsx");

test("a lista de convênios da equipe devolve nome e situação, nunca preço", () => {
  assert.match(lista, /returns table\(convenio text, ativo boolean\)/,
    "a função passou a devolver outra coisa — se for preço, é outra decisão");
  assert.doesNotMatch(lista, /cv\.valor/, "a lista da equipe passou a expor o valor");
  assert.match(lista, /where cv\.institution_id = public\.current_institution_id\(\)/);
  assert.match(lista, /revoke all on function public\.convenios_da_organizacao\(\) from public, anon;/);
});

test("Produção do dia e cadastro de paciente leem a lista da equipe", () => {
  assert.match(plantoes, /createClient\(\)\.rpc\("convenios_da_organizacao"\)/,
    "as sugestões da Produção voltaram a ler a tabela de preços, que o médico não enxerga");
  assert.doesNotMatch(plantoes, /from\("convenio_valores"\)\.select\("convenio"\)/);
  assert.match(pagina, /supabase\.rpc\("convenios_da_organizacao"\)/, "o servidor deixou de buscar a lista da equipe");
  assert.match(tela, /listarConvenios\(\[\.\.\.convenioValores,\.\.\.conveniosDaOrganizacao\.map/,
    "o cadastro de paciente deixou de juntar a lista da equipe");
});

test("convênio com uma linha ativa não some da lista por ter outra desativada", () => {
  assert.match(tela, /const ocultos=new Set\(base\.filter\(r=>!r\.ativo&&!ativos\.has\(r\.convenio\)\)/,
    "voltou a esconder convênio ativo que tem uma linha desativada");
});

test("tudo do Financeiro confere a permissão, não só o papel", () => {
  for (const politica of ["financeiro_gerencia_periodos", "despesas_do_servico", "financeiro_le_valores_convenio", "financeiro_le_o_que_foi_enviado"]) {
    const i = perm.indexOf(`create policy ${politica}`);
    assert.notEqual(i, -1, `sumiu a regra ${politica}`);
    assert.match(perm.slice(i, i + 700), /public\.current_has_permission\('financeiro'\)/,
      `a regra ${politica} voltou a olhar só o papel`);
  }
  for (const fn of ["producao_do_periodo", "resumo_producao_do_mes", "conferir_periodo_financeiro"]) {
    const i = perm.indexOf(`function public.${fn}`);
    assert.match(perm.slice(i, i + 900), /if not public\.current_has_permission\('financeiro'\) then/,
      `${fn} voltou a olhar só o papel`);
  }
  assert.doesNotMatch(perm, /current_app_role\(\)/, "sobrou checagem por papel na migração");
});

test("o que é de administrador continua sendo só dele", () => {
  assert.doesNotMatch(perm, /reabrir_periodo_financeiro|estornar_pagamento_financeiro|excluir_lancamento_financeiro|admin_gerencia_valores_convenio/,
    "a migração de permissão passou a mexer no que é só de administrador");
  assert.match(perm, /fechar o mês|reabrir período, estornar pagamento, excluir lançamento/);
});

test("o convite de primeiro uso só oferece configurar preços a quem pode salvar", () => {
  assert.match(tela, /onConfigurarValores=\{\["admin","owner"\]\.includes\(perfil\.role\)\?openPriceConfig:undefined\}/);
  assert.match(tela, /Quem configura é o administrador ou o proprietário da organização\./);
});
