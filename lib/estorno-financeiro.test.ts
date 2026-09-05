import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

/**
 * O BECO QUE ESTES TESTES FECHAM.
 *
 * `excluir_lancamento_financeiro` recusa lançamento com pagamento registrado e
 * manda "estorne o pagamento antes de excluir". O estorno não existia — nem
 * função no banco, nem botão na tela. A pessoa clicava em Excluir, lia a
 * recusa, e o caminho que ela apontava não tinha porta.
 *
 * Um botão que nunca pode dar certo é pior do que nenhum: ele promete, e quem
 * tentou acha que errou e tenta de novo.
 */
test("a recusa de excluir tem um caminho de saída de verdade", () => {
  const excluir = ler("supabase/migrations/202609020002_excluir_lancamento_financeiro.sql");
  assert.match(excluir, /Estorne o pagamento antes de excluir/,
    "a recusa mudou — reveja se o caminho apontado ainda existe");
  // O que a recusa manda fazer precisa existir.
  const estorno = ler("supabase/migrations/202609050001_estornar_pagamento_financeiro.sql");
  assert.match(estorno, /create or replace function public\.estornar_pagamento_financeiro/);
});

test("o estorno é da mesma régua do excluir", () => {
  const estorno = ler("supabase/migrations/202609050001_estornar_pagamento_financeiro.sql");
  // Desfazer dinheiro que entrou muda o fechamento e a conta que alguém leu.
  assert.match(estorno, /role not in \('admin','owner'\)/,
    "o estorno tem de ser só de administrador e proprietário");
  // Período conferido é número assinado.
  assert.match(estorno, /fechado_at is not null/,
    "o estorno tem de recusar período fechado");
  // A auditoria vem ANTES do delete: depois, o id sozinho não diz nada a quem
  // for conferir por que a conta do mês mudou.
  const ondeAuditoria = estorno.indexOf("insert into public.auditoria");
  const ondeDelete = estorno.indexOf("delete from public.financeiro_pagamentos");
  assert.ok(ondeAuditoria > 0 && ondeAuditoria < ondeDelete,
    "a auditoria tem de ser escrita antes de apagar o pagamento");
  // O Postgres concede EXECUTE a PUBLIC em toda função nova, e `anon` herda.
  assert.match(estorno, /revoke execute on function public\.estornar_pagamento_financeiro\(uuid\) from public, anon;/,
    "sem o revoke, um visitante sem sessão alcança a função");
  // Glosa e cancelado são decisões sobre a COBRANÇA, não sobre o dinheiro: um
  // estorno não as desfaz.
  assert.match(estorno, /when v_item\.status in \('glosa','cancelado'\) then v_item\.status/);
});

test("a tela não oferece Excluir onde o banco recusa", () => {
  // Com pagamento registrado o botão é Estornar, e não Excluir. Oferecer
  // Excluir ali era prometer o que não se cumpre.
  const tela = ler("app/dashboard/dashboard-client.tsx");
  assert.match(tela, /pagamentosDoItem\.length===0&&<button type="button" className="paymentExcluir"/,
    "o Excluir voltou a aparecer em lançamento com pagamento");
  assert.match(tela, /pagamentosDoItem\.length>0&&<button type="button" className="paymentExcluir"[^]*?>Estornar<\/button>/,
    "falta o botão de estornar em lançamento com pagamento");
  assert.match(tela, /rpc\("estornar_pagamento_financeiro"/,
    "a tela não chama o estorno");
});
