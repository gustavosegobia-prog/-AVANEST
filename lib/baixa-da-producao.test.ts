import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { camposDaBaixa } from "./baixa-da-producao.ts";

const VAZIO = { faturado_em: null, recebido_em: null };

test("emitir a nota carimba o dia, e não diz que recebeu", () => {
  const r = camposDaBaixa("faturado", VAZIO, "2026-09-25");
  assert.equal(r.situacao, "faturado");
  assert.equal(r.faturado_em, "2026-09-25");
  // Emitir a nota não é receber. Este é o passo que existe justamente para
  // separar "quem deve uma ação sou eu" de "quem deve é o hospital".
  assert.equal(r.recebido_em, null);
});

test("receber não apaga a nota", () => {
  // Sem isto, a pergunta "quanto tempo essa nota levou para ser paga" fica
  // sem resposta no instante em que ela é paga — que é quando ela importa.
  const r = camposDaBaixa("recebido", { faturado_em: "2026-07-03", recebido_em: null }, "2026-09-25");
  assert.equal(r.situacao, "recebido");
  assert.equal(r.faturado_em, "2026-07-03");
  assert.equal(r.recebido_em, "2026-09-25");
});

test("a glosa também não apaga a nota", () => {
  // A glosa acontece DEPOIS da nota: é a operadora recusando o que foi
  // cobrado. Um glosado sem data de nota seria uma recusa a um documento que
  // o sistema diz nunca ter existido.
  const r = camposDaBaixa("glosado", { faturado_em: "2026-08-10", recebido_em: null }, "2026-09-25");
  assert.equal(r.faturado_em, "2026-08-10");
  assert.equal(r.recebido_em, null);
});

test("voltar para 'a cobrar' limpa as duas datas", () => {
  // Um ato que guardasse a data da nota antiga voltaria a parecer faturado no
  // primeiro relatório que olhasse só a coluna.
  const r = camposDaBaixa("a_cobrar", { faturado_em: "2026-08-10", recebido_em: "2026-09-01" }, "2026-09-25");
  assert.deepEqual(r, { situacao: "a_cobrar", faturado_em: null, recebido_em: null });
});

test("marcar em lote não rejuvenesce uma nota velha", () => {
  // Marcar doze pacientes e apertar "Emiti a nota" quando cinco já tinham nota
  // de julho não pode redatar os cinco: a data da nota é o que diz se a
  // cobrança está atrasada, e reescrevê-la esconde a dívida mais velha
  // justamente na tela que existe para mostrá-la.
  const r = camposDaBaixa("faturado", { faturado_em: "2026-07-03", recebido_em: null }, "2026-09-25");
  assert.equal(r.faturado_em, "2026-07-03");
});

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("a produção tem a mesma seleção de nota que a escala", () => {
  const tela = ler("components/producao-do-dia.tsx");
  // A caixinha por paciente, o botão da nota e o carimbo em lote — os três
  // pedaços do gesto que a escala já tinha e a produção não.
  assert.ok(/type="checkbox"/.test(tela), "sumiu a caixinha de marcar o paciente");
  assert.ok(/Emiti a nota/.test(tela), "sumiu o botão de emitir a nota");
  assert.ok(/async function marcarEmLote/.test(tela), "sumiu o carimbo em lote");
  // O botão só toca no que ainda não está nesse passo.
  assert.ok(/i\.situacao !== passo/.test(tela),
    "o lote voltou a carimbar o que já estava no passo");
  // E OS DOIS CAMINHOS usam a mesma regra: o seletor da linha e o botão do
  // lote. Uma cópia da regra em cada lugar é como um dos dois acaba gravando
  // a data errada, e isso só aparece no fechamento, meses depois.
  assert.equal((tela.match(/camposDaBaixa\(/g) ?? []).length, 3,
    "alguém voltou a escrever situação e datas à mão nesta tela");
});

test("a nota impressa respeita o que está marcado", () => {
  // Emitir contra um hospital não é emitir o mês inteiro. Sem escopo, o botão
  // "Imprimir" da nota de faturamento levava sempre os quarenta pacientes.
  const tela = ler("components/producao-do-dia.tsx");
  assert.ok(/const paraNota = selecionados\.length \? selecionados : itens;/.test(tela),
    "a nota de faturamento deixou de respeitar a marcação");
  assert.ok(!/onImprimirFaturamento\(itens\)/.test(tela),
    "a nota voltou a imprimir o mês inteiro mesmo com pacientes marcados");
});

test("a coluna da data da nota existe na migração", () => {
  const sql = ler("supabase/migrations/202609250001_nota_da_producao.sql");
  assert.ok(/add column if not exists faturado_em date/.test(sql),
    "sumiu a coluna faturado_em da produção");
  // Só o que está "faturado" é preenchido para trás: carimbar data de nota em
  // quem foi marcado direto como recebido seria inventar um documento.
  assert.ok(/where situacao = 'faturado' and faturado_em is null/.test(sql),
    "o preenchimento para trás passou a inventar nota em quem nunca teve");
});
