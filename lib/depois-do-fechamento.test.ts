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

test("o painel de Fechamento do mês avisa quando há lançamento sem trava", () => {
  const i = tela.indexOf('chave="fin-fechamento"');
  const painel = tela.slice(i, i + 5000);
  assert.match(painel, /const tardios=depoisDoFechamento\.filter\(i=>i\.periodo===period\);/,
    "o painel de Fechamento deixou de conferir lançamentos que entraram depois");
  assert.match(painel, /reabra com o motivo, confira e feche de novo/,
    "sumiu a orientação do que fazer");
});
