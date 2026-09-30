import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * LANÇAMENTO QUE ENTRA EM MÊS JÁ FECHADO.
 *
 * A conclusão de uma avaliação antiga (rota de faturar, service_role) e o
 * recebimento no balcão (receber_particular, SECURITY DEFINER) não passam
 * pela trava — de propósito: barrá-los travaria o médico e a recepção. Visto
 * no teste de ponta a ponta no banco: com setembro fechado, o balcão lançou
 * em setembro, e a linha nova ficou sem trava.
 *
 * A decisão foi deixar entrar e AVISAR. Como fechar trava todos os
 * lançamentos do mês, lançamento de mês fechado SEM trava é, por definição,
 * um que chegou depois — dá para achar sem coluna nova no banco.
 */
const tela = readFileSync(new URL("../app/dashboard/dashboard-client.tsx", import.meta.url), "utf8");

test("quem entrou depois é: mês fechado, sem trava, não cancelado", () => {
  assert.match(tela,
    /const depoisDoFechamento=financeiro\.filter\(i=>i\.periodo&&mesesFechados\.has\(i\.periodo\)&&!i\.fechado_at&&i\.status!=="cancelado"\);/,
    "mudou o critério de lançamento que entrou depois do fechamento");
  assert.match(tela, /const mesesFechados=new Set\(periodos\.filter\(p=>p\.status==="fechado"\)/,
    "os meses fechados deixaram de vir de financeiro_periodos");
});

test("Atenção hoje avisa, um item por mês, e leva ao fechamento daquele mês", () => {
  const i = tela.indexOf("function VisaoGeral(");
  const componente = tela.slice(i, tela.indexOf("\nfunction ", i + 10));
  assert.match(componente, /for\(const \[mes,quantos\] of depoisDoFechamento\) fila\.push\(\{/,
    "sumiu o aviso de lançamento depois do fechamento");
  assert.match(componente, /tarefa:"fechamento",\s*\n\s*periodo:mes,/,
    "o aviso deixou de levar ao mês certo");
  assert.match(componente, /onClick=\{\(\)=>onIr\(item\.tarefa,item\.periodo\)\}/,
    "o botão Ver deixou de passar o mês");
  assert.match(tela, /onIr=\{\(tarefa,mes\)=>\{if\(mes\)setPeriod\(mes\);setTarefa\(tarefa\)\}\}/,
    "o Financeiro deixou de trocar para o mês do aviso");
});

const sql = readFileSync(new URL("../supabase/migrations/202609300005_producao_no_fechamento.sql", import.meta.url), "utf8");

test("fechar guarda o retrato da produção enviada; reabrir apaga", () => {
  assert.match(sql, /add column if not exists producao_no_fechamento jsonb;/, "sumiu a coluna do retrato");
  assert.match(sql, /v_producao := public\.resumo_producao_do_mes\(p_periodo\);/, "fechar deixou de tirar o retrato");
  assert.match(sql, /producao_no_fechamento = v_producao,/, "fechar de novo deixou de atualizar o retrato");
  assert.match(sql, /producao_no_fechamento = null,/, "reabrir deixou de apagar o retrato");
  // As duas funções continuam ligando a marca da trava (202609300004).
  assert.equal([...sql.matchAll(/perform set_config\('avanest\.escrita_financeira', 'sim', true\);/g)].length, 2,
    "fechar ou reabrir perdeu a marca — a trava passaria a recusar o próprio fechamento");
});

test("o retrato conta só o que compõe o faturado: enviado, não cancelado, anotações e valor", () => {
  assert.match(sql, /and pr\.enviado_em is not null\s*\n\s*and pr\.situacao <> 'cancelado'/,
    "o retrato mudou de critério — passaria a divergir da produção que a tela soma");
  assert.match(sql, /jsonb_build_object\('anotacoes', count\(\*\), 'valor', coalesce\(sum\(pr\.valor\), 0\)\)/);
  assert.match(sql, /if coalesce\(public\.current_app_role\(\), ''\) not in \('financeiro', 'owner', 'admin'\)/,
    "o resumo deixou de recusar quem não é do financeiro (ou quem não está logado)");
  assert.match(sql, /revoke all on function public\.resumo_producao_do_mes\(text\) from public, anon;/);
});

test("a tela compara o retrato com a produção de agora, dentro da janela carregada", () => {
  assert.match(tela, /const doMes=\(producaoDaReceita\?\?\[\]\)\.filter\(i=>i\.situacao!=="cancelado"&&i\.data\.startsWith\(p\.periodo\)\);/,
    "a comparação passou a somar a produção com outro critério que o retrato");
  assert.match(tela, /p\.periodo>=inicioDaJanela/,
    "a comparação voltou a olhar meses fora da janela carregada — daria alarme falso");
  assert.match(tela, /for\(const \{mes,antes,agora\} of producaoMudou\) fila\.push\(\{/,
    "sumiu o aviso de produção alterada em Atenção hoje");
  const i = tela.indexOf('chave="fin-fechamento"');
  assert.match(tela.slice(i, i + 5000), /const producao=producaoMudou\.find\(x=>x\.mes===period\);/,
    "o painel de Fechamento deixou de avisar produção alterada");
});

test("o painel de Fechamento do mês avisa quando há lançamento sem trava", () => {
  const i = tela.indexOf('chave="fin-fechamento"');
  const painel = tela.slice(i, i + 5000);
  assert.match(painel, /const tardios=depoisDoFechamento\.filter\(i=>i\.periodo===period\);/,
    "o painel de Fechamento deixou de conferir lançamentos que entraram depois");
  assert.match(painel, /reabra com o motivo, confira e feche de novo/,
    "sumiu a orientação do que fazer");
});
