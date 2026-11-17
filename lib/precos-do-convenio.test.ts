import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { lancamentosQueOPrecoPreenche, mesmaRegra, regraDaConsulta, repasseDoValor } from "./precos-do-convenio.ts";
import { camposDaBaixa } from "./baixa-da-producao.ts";
import { mesesSemEnviar, nomeDoMesDaProducao } from "./producao-sem-enviar.ts";

// Produção e Financeiro (17/11/2026: "analise a produção e o financeiro e
// corrija e melhore o que for necessário"). O que o banco real mostrou: a
// tabela "Valores por convênio" com tudo em R$ 0,00 e as consultas nascendo
// assim; seis baixas "recebido" sem o dia do recebimento; "UNIMED" e
// "Unimed", "Particular" e "PARTICULAR" na mesma lista. Dados fictícios.
const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

const regra = (id: string, convenio: string, valor: number, extra: Partial<Parameters<typeof regraDaConsulta>[0][number]> = {}) =>
  ({ id, convenio, procedimento: null, hospital: null, valor, repasse_percentual: null, ativo: true, updated_at: "2026-11-01T00:00:00Z", ...extra });

test("preço: o convênio casa sem caixa nem acento, a regra mais específica vale, e no empate a mais recente", () => {
  const regras = [
    regra("geral", "Unimed", 300),
    regra("hospital", "Unimed", 380, { hospital: "Hospital Teste" }),
    regra("inativa", "Unimed", 999, { ativo: false, hospital: "Hospital Teste", procedimento: "Mastopexia" }),
  ];
  assert.equal(regraDaConsulta(regras, { convenio: "UNIMED", procedimento: null, hospital: null })?.id, "geral");
  assert.equal(regraDaConsulta(regras, { convenio: "unimed", procedimento: "Mastopexia", hospital: "hospital  teste" })?.id, "hospital");
  assert.equal(regraDaConsulta(regras, { convenio: "Amil", procedimento: null, hospital: null }), null);
  // A velha de R$ 0,00 e a nova com preço, igualmente gerais: vale a nova.
  const duas = [regra("velha", "Particular", 0, { updated_at: "2026-09-01T00:00:00Z" }), regra("nova", "Particular", 350, { updated_at: "2026-11-17T00:00:00Z" })];
  assert.equal(regraDaConsulta(duas, { convenio: "PARTICULAR", procedimento: null, hospital: null })?.id, "nova");
  assert.equal(regraDaConsulta([...duas].reverse(), { convenio: "Particular", procedimento: null, hospital: null })?.id, "nova");
});

test("preço: o botão preenche só o que espera pagamento, em R$ 0,00, de período aberto, e cuja regra tem preço", () => {
  const regras = [regra("part", "Particular", 350, { repasse_percentual: 30 }), regra("unimed", "Unimed", 0)];
  const l = (id: string, extra: object = {}) => ({ id, convenio: "Particular", procedimento: null, hospital: null, valor: 0, status: "aguardando", fechado_at: null, ...extra });
  const preenche = lancamentosQueOPrecoPreenche(regras, [
    l("a"), l("b", { convenio: "PARTICULAR" }),
    l("pago", { status: "pago" }), l("comValor", { valor: 200 }), l("fechado", { fechado_at: "2026-10-31" }),
    l("semPreco", { convenio: "Unimed" }),
  ]);
  assert.deepEqual(preenche.get("part"), ["a", "b"]);
  assert.equal(preenche.has("unimed"), false);
  assert.equal(repasseDoValor(350, 30), 105);
  assert.equal(repasseDoValor(333.33, 12.5), 41.67);
  assert.equal(repasseDoValor(350, null), 0);
});

test("preço: salvar o mesmo convênio de novo atualiza a regra em vez de criar outra", () => {
  const regras = [regra("u", "Unimed", 0), regra("uh", "Unimed", 380, { hospital: "Hospital Teste" })];
  assert.equal(mesmaRegra(regras, { convenio: "UNIMED", procedimento: null, hospital: null })?.id, "u");
  assert.equal(mesmaRegra(regras, { convenio: "unimed", procedimento: null, hospital: "hospital teste" })?.id, "uh");
  assert.equal(mesmaRegra(regras, { convenio: "Unimed", procedimento: "Mastopexia", hospital: null }), null);
});

test("financeiro: a rota de faturar e a tela usam a mesma regra de preço", () => {
  const rota = ler("app/api/avaliacoes/[id]/faturar/route.ts");
  assert.match(rota, /const rule = regraDaConsulta\(rules \?\? \[\], \{ convenio, procedimento, hospital \}\);/);
  // O convênio não filtra mais pelo texto exato no banco ("UNIMED" ≠ "Unimed").
  assert.doesNotMatch(rota, /\.eq\("convenio", convenio\)/);
  const painel = ler("app/dashboard/dashboard-client.tsx");
  // O formulário guardado antes do await: depois dele o React solta o evento e o reset() quebrava.
  assert.match(painel, /const formulario=event\.currentTarget;[\s\S]{0,2400}formulario\.reset\(\);onRefresh\(\);/);
  assert.doesNotMatch(painel, /event\.currentTarget\.reset\(\);onRefresh\(\)/);
  assert.match(painel, /const existente=mesmaRegra\(convenioValores,\{convenio,procedimento,hospital\}\);/);
  assert.match(painel, /\.update\(\{valor,repasse_valor:repasseDoValor\(valor,item\.repasse_percentual\),updated_at:new Date\(\)\.toISOString\(\)\}\)\.eq\("id",id\)\.eq\("valor",0\)/);
  assert.match(painel, /lancamentos=\{lancamentosParaPreco\}/);
});

test("produção: a baixa na Produção do dia grava as datas, como a do mês", () => {
  const tela = ler("components/producao-do-dia.tsx");
  assert.doesNotMatch(tela, /onChange=\{\(e\) => void mudar\(i\.id, \{ situacao: e\.target\.value \}\)\}/);
  assert.match(tela, /void mudar\(i\.id,\s*camposDaBaixa\(e\.target\.value as SituacaoDaProducao, i, hojeLocal\(\)\)\)/);
  assert.deepEqual(camposDaBaixa("recebido", {}, "2026-11-17"), { situacao: "recebido", faturado_em: null, recebido_em: "2026-11-17" });
});

test("produção: os meses anteriores sem enviar ao financeiro aparecem, e levam até o mês", () => {
  const linhas = [
    { data: "2026-09-03", enviado_em: null }, { data: "2026-09-17", enviado_em: null },
    { data: "2026-10-16", enviado_em: null }, { data: "2026-10-19", enviado_em: "2026-10-20" },
    { data: "2026-11-02", enviado_em: null },
  ];
  assert.deepEqual(mesesSemEnviar(linhas, "2026-11", "2026-11"), [{ mes: "2026-09", n: 2 }, { mes: "2026-10", n: 1 }]);
  // O mês aberto já tem o próprio botão.
  assert.deepEqual(mesesSemEnviar(linhas, "2026-09", "2026-11"), [{ mes: "2026-10", n: 1 }]);
  assert.equal(nomeDoMesDaProducao("2026-09", 2026), "setembro");
  assert.equal(nomeDoMesDaProducao("2025-12", 2026), "dezembro de 2025");
  const tela = ler("components/producao-do-dia.tsx");
  assert.match(tela, /const atrasados = mesesSemEnviar\(linhasSemEnviar, mes, hojeLocal\(\)\.slice\(0, 7\)\);/);
  assert.match(tela, /onClick=\{\(\) => onEscolherMes \? onEscolherMes\(m\) : undefined\}/);
});

test("banco: a baixa sem data recebe o dia, um convênio tem uma grafia, e a ficha lança na grafia da organização", () => {
  const sql = ler("supabase/migrations/202611170002_producao_e_financeiro.sql");
  assert.match(sql, /set recebido_em = coalesce\([\s\S]*?where pr\.situacao = 'recebido' and pr\.recebido_em is null;/);
  assert.match(sql, /create or replace function public\.grafia_do_convenio\(p_institution uuid, p_convenio text\)/);
  assert.match(sql, /revoke all on function public\.grafia_do_convenio\(uuid, text\) from public, anon, authenticated;/);
  assert.match(sql, /set convenio = public\.grafia_do_convenio\(pd\.institution_id, pd\.convenio\)/);
  assert.match(sql, /v_convenio := public\.grafia_do_convenio\(f\.institution_id, v_convenio\);/);
  // Continua achando a anotação à mão pelo nome simples (202611170001).
  assert.match(sql, /and public\.nome_simples\(x\.paciente\) = public\.nome_simples\(v_paciente\)/);
});
