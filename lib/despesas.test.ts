import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CATEGORIAS, deAlguem, despesasDoMes, doServico, porCategoria,
  recorrentesFaltando, resultadoDoMes, somarDespesas, type Despesa,
} from "./despesas.ts";

const d = (dados: Partial<Despesa> = {}): Despesa => ({
  id: "x", perfil_id: null, data: "2026-08-05", descricao: "Aluguel",
  categoria: "estrutura", valor: 1000, recorrente: false, ...dados,
});

describe("catálogo de categorias", () => {
  it("toda categoria tem exemplo", () => {
    // Sem exemplo cada pessoa classifica de um jeito, e no terceiro mês
    // "estrutura" e "outra" viram a mesma coisa.
    for (const c of CATEGORIAS) {
      assert.ok(c.exemplo.length > 0, `${c.id} sem exemplo`);
    }
  });

  it("os identificadores não se repetem", () => {
    assert.equal(new Set(CATEGORIAS.map((c) => c.id)).size, CATEGORIAS.length);
  });
});

describe("filtros", () => {
  const lista = [
    d({ id: "a", data: "2026-08-05" }),
    d({ id: "b", data: "2026-07-30" }),
    d({ id: "c", data: "2026-08-28", perfil_id: "ana" }),
  ];

  it("separa por competência", () => {
    assert.deepEqual(despesasDoMes(lista, "2026-08").map((x) => x.id), ["a", "c"]);
  });

  it("separa despesa do serviço da despesa de alguém", () => {
    // Sem dono é o que marca a que se rateia.
    assert.deepEqual(doServico(lista).map((x) => x.id), ["a", "b"]);
    assert.deepEqual(deAlguem(lista).map((x) => x.id), ["c"]);
  });

  it("soma", () => {
    assert.equal(somarDespesas(lista), 3000);
    assert.equal(somarDespesas([]), 0);
  });

  it("valor ausente conta como zero, não como NaN", () => {
    assert.equal(somarDespesas([d({ valor: undefined as unknown as number })]), 0);
  });
});

describe("por categoria", () => {
  const lista = [
    d({ id: "a", categoria: "estrutura", valor: 1000 }),
    d({ id: "b", categoria: "impostos", valor: 3000 }),
    d({ id: "c", categoria: "estrutura", valor: 500 }),
  ];

  it("agrupa, soma e ordena pelo maior", () => {
    const linhas = porCategoria(lista);
    assert.deepEqual(linhas.map((l) => l.id), ["impostos", "estrutura"]);
    assert.equal(linhas[0].valor, 3000);
    assert.equal(linhas[1].valor, 1500);
    assert.equal(linhas[1].linhas, 2);
  });

  it("mostra SÓ as categorias com gasto", () => {
    // Dez linhas, sete zeradas, esconderiam as três que importam no meio da
    // lista — o oposto do que a tabela existe para fazer.
    assert.equal(porCategoria(lista).length, 2);
  });

  it("calcula a fatia de cada uma", () => {
    const linhas = porCategoria(lista);
    assert.equal(linhas[0].fatia, (3000 / 4500) * 100);
    // Com tolerância: 1/3 em ponto flutuante devolve 99,999...% e não 100, e
    // travar a igualdade exata quebraria o teste sem nenhum defeito no código.
    const soma = linhas.reduce((s, l) => s + (l.fatia ?? 0), 0);
    assert.ok(Math.abs(soma - 100) < 1e-9, `as fatias somaram ${soma}`);
  });

  it("categoria desconhecida cai em 'outra' em vez de sumir", () => {
    // Vinda de um lançamento antigo ou de um import. Sumir faria o total da
    // tabela não bater com o total do mês.
    const linhas = porCategoria([d({ categoria: "inventada", valor: 200 })]);
    assert.equal(linhas[0].id, "outra");
    assert.equal(linhas[0].valor, 200);
  });

  it("sem gasto nenhum não devolve fatia", () => {
    assert.equal(porCategoria([d({ valor: 0 })])[0].fatia, null);
  });

  it("a soma das categorias bate com o total", () => {
    assert.equal(porCategoria(lista).reduce((s, l) => s + l.valor, 0), somarDespesas(lista));
  });
});

describe("resultado do mês", () => {
  it("é o faturado menos a despesa", () => {
    const r = resultadoDoMes(10000, 4000);
    assert.equal(r.resultado, 6000);
    assert.equal(r.margem, 60);
  });

  it("mostra prejuízo como número negativo, e não como zero", () => {
    // Zerar um mês ruim seria esconder exatamente o que a tela existe para
    // mostrar.
    const r = resultadoDoMes(3000, 5000);
    assert.equal(r.resultado, -2000);
    assert.ok(r.margem !== null && r.margem < 0);
  });

  it("não devolve margem quando não houve receita", () => {
    // Dividir por zero daria Infinity.
    assert.equal(resultadoDoMes(0, 1500).margem, null);
    assert.equal(resultadoDoMes(0, 1500).resultado, -1500);
  });

  it("mês vazio devolve zeros", () => {
    assert.deepEqual(resultadoDoMes(0, 0),
      { receita: 0, despesa: 0, resultado: 0, margem: null });
  });
});

describe("lembrete de recorrentes", () => {
  const historico = [
    d({ id: "a", descricao: "Aluguel", data: "2026-07-05", recorrente: true, valor: 1000 }),
    d({ id: "b", descricao: "Contador", data: "2026-07-10", recorrente: true, valor: 600 }),
    d({ id: "c", descricao: "Congresso", data: "2026-05-02", recorrente: false, valor: 2500 }),
  ];

  it("lembra do que se repete e ainda não foi lançado", () => {
    const faltando = recorrentesFaltando(historico, "2026-08");
    assert.deepEqual(faltando.map((x) => x.descricao), ["Aluguel", "Contador"]);
  });

  it("não lembra do que não é recorrente", () => {
    const faltando = recorrentesFaltando(historico, "2026-08");
    assert.equal(faltando.some((x) => x.descricao === "Congresso"), false);
  });

  it("some da lista quando a despesa é lançada no mês", () => {
    const faltando = recorrentesFaltando(
      [...historico, d({ id: "d", descricao: "Aluguel", data: "2026-08-05", valor: 1000 })],
      "2026-08");
    assert.deepEqual(faltando.map((x) => x.descricao), ["Contador"]);
  });

  it("ignora espaço e caixa ao comparar", () => {
    // "Aluguel" e "aluguel " são a mesma conta. Cobrar o lançamento de uma
    // despesa já lançada é o jeito mais rápido de a pessoa parar de olhar.
    const faltando = recorrentesFaltando(
      [...historico, d({ id: "d", descricao: "  aluguel ", data: "2026-08-05" })],
      "2026-08");
    assert.equal(faltando.some((x) => x.descricao === "Aluguel"), false);
  });

  it("usa o valor mais recente para lembrar quanto se costuma pagar", () => {
    const faltando = recorrentesFaltando([
      d({ id: "v1", descricao: "Aluguel", data: "2025-09-05", recorrente: true, valor: 800 }),
      d({ id: "v2", descricao: "Aluguel", data: "2026-07-05", recorrente: true, valor: 1200 }),
    ], "2026-08");
    assert.equal(faltando[0].valor, 1200);
  });

  it("não lembra de despesa de mês igual ou posterior ao consultado", () => {
    // Sem isto, lançar a de setembro faria a de agosto reaparecer como
    // pendente ao voltar um mês.
    assert.deepEqual(recorrentesFaltando(
      [d({ descricao: "Aluguel", data: "2026-09-05", recorrente: true })], "2026-08"), []);
  });

  it("histórico vazio não lembra de nada", () => {
    assert.deepEqual(recorrentesFaltando([], "2026-08"), []);
  });
});
