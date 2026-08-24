import test from "node:test";
import assert from "node:assert/strict";
import { decidirLocalDaSessao, localAindaVale, nomeDoLocal, type LocalDisponivel } from "./local-ativo.ts";

const local = (id: string, extra: Partial<LocalDisponivel> = {}): LocalDisponivel => ({
  id, nome: `Local ${id}`, nome_fantasia: null, tipo: "hospital",
  cidade: null, estado: null, logo_url: null, grupo_anestesia: null,
  particular: false, ativo: true, usado_em: null, ...extra,
});

// ---------------------------------------------------------------------------
// A decisão que substituiu a escrita de cookie no Server Component
//
// O painel gravava o cookie durante a renderização e o Next derrubava a página
// com erro 500 — "Cookies can only be modified in a Server Action or Route
// Handler". Estes testes fixam o comportamento que tirou a escrita dali, e em
// especial o caminho que quebrava: profissional com um local só.
// ---------------------------------------------------------------------------

test("um local só entra direto, sem passar pela escolha", () => {
  // Era este o caso do erro 500: /locais mandava para /dashboard?local=X e o
  // painel tentava gravar o cookie no meio do render.
  const r = decidirLocalDaSessao(undefined, [local("a")]);
  assert.equal(r.local?.id, "a");
  assert.equal(r.precisaEscolher, false);
});

test("vários locais e nenhum escolhido: manda escolher", () => {
  const r = decidirLocalDaSessao(undefined, [local("a"), local("b")]);
  assert.equal(r.local, null);
  assert.equal(r.precisaEscolher, true);
});

test("cookie válido é respeitado mesmo havendo vários", () => {
  const r = decidirLocalDaSessao("b", [local("a"), local("b"), local("c")]);
  assert.equal(r.local?.id, "b");
  assert.equal(r.precisaEscolher, false);
});

test("organização sem local nenhum entra como sempre entrou", () => {
  // A funcionalidade se liga sozinha quando o primeiro local nascer; até lá
  // ninguém pode ficar preso numa tela de escolha vazia.
  const r = decidirLocalDaSessao(undefined, []);
  assert.equal(r.local, null);
  assert.equal(r.precisaEscolher, false);
});

test("cookie de local arquivado não vale, e sobrando um o painel adota", () => {
  const r = decidirLocalDaSessao("a", [local("a", { ativo: false }), local("b")]);
  assert.equal(r.local?.id, "b");
  assert.equal(r.precisaEscolher, false);
});

test("cookie de local arquivado com vários restantes manda escolher", () => {
  const r = decidirLocalDaSessao("a", [local("a", { ativo: false }), local("b"), local("c")]);
  assert.equal(r.local, null);
  assert.equal(r.precisaEscolher, true);
});

test("cookie de outra organização é ignorado", () => {
  // Quem saiu do grupo continua com um cookie perfeitamente válido no
  // navegador. Guardar não é autorizar.
  const r = decidirLocalDaSessao("de-outro-grupo", [local("a"), local("b")]);
  assert.equal(r.local, null);
  assert.equal(r.precisaEscolher, true);
});

test("lista só com arquivados não prende ninguém na escolha", () => {
  const r = decidirLocalDaSessao(undefined, [local("a", { ativo: false }), local("b", { ativo: false })]);
  assert.equal(r.local, null);
  assert.equal(r.precisaEscolher, false);
});

test("nunca manda escolher havendo um único disponível — o laço do 500", () => {
  // /dashboard mandava para /locais, /locais mandava de volta para
  // /dashboard?local=X, e o painel estourava. Nenhuma entrada com um local
  // disponível pode devolver precisaEscolher.
  for (const preferido of [undefined, "", "inexistente", "a"]) {
    const r = decidirLocalDaSessao(preferido, [local("a"), local("z", { ativo: false })]);
    assert.equal(r.precisaEscolher, false, `preferido=${String(preferido)}`);
    assert.equal(r.local?.id, "a");
  }
});

// ---------------------------------------------------------------------------
// O fluxo entre /dashboard e /locais
//
// O erro em produção não era só a exceção do cookie: era um caminho que ia e
// voltava. Aqui as duas telas viram um modelo de estados, e o teste anda por
// ele até parar. Se um dia alguém devolver o ?local= ou reintroduzir um
// redirect, isto acusa em vez de o erro aparecer no log da Vercel.
// ---------------------------------------------------------------------------

/** Anda pelo fluxo e devolve o caminho percorrido, ou estoura se não parar. */
function percorrer(disponiveis: LocalDisponivel[], cookie?: string): string[] {
  const caminho: string[] = [];
  let pagina = "/dashboard";
  for (let passo = 0; passo < 8; passo++) {
    caminho.push(pagina);
    if (pagina === "/dashboard") {
      const { precisaEscolher } = decidirLocalDaSessao(cookie, disponiveis);
      if (!precisaEscolher) return caminho;   // renderiza o painel
      pagina = "/locais";
      continue;
    }
    // /locais: um só entra direto; vários mostram a escolha e param aqui.
    const ativos = disponiveis.filter((l) => l.ativo);
    if (ativos.length === 1) { pagina = "/dashboard"; continue; }
    return caminho;                            // mostra o seletor
  }
  throw new Error(`laço de redirect: ${caminho.join(" → ")}`);
}

test("um local: o painel abre sem desvio nenhum", () => {
  assert.deepEqual(percorrer([local("a")]), ["/dashboard"]);
});

test("nenhum local: o painel abre sem desvio nenhum", () => {
  assert.deepEqual(percorrer([]), ["/dashboard"]);
});

test("vários locais sem cookie: para na escolha, e não volta", () => {
  assert.deepEqual(percorrer([local("a"), local("b")]), ["/dashboard", "/locais"]);
});

test("vários locais com cookie válido: abre direto", () => {
  assert.deepEqual(percorrer([local("a"), local("b")], "b"), ["/dashboard"]);
});

test("cookie inválido não faz o fluxo ir e voltar", () => {
  assert.deepEqual(percorrer([local("a"), local("b")], "zzz"), ["/dashboard", "/locais"]);
});

test("nenhuma combinação de locais e cookie entra em laço", () => {
  const listas = [
    [], [local("a")], [local("a", { ativo: false })],
    [local("a"), local("b")], [local("a"), local("b", { ativo: false })],
    [local("a", { ativo: false }), local("b", { ativo: false })],
    [local("a"), local("b"), local("c")],
  ];
  for (const lista of listas) {
    for (const cookie of [undefined, "", "a", "b", "zzz"]) {
      assert.doesNotThrow(() => percorrer(lista, cookie),
        `lista=${lista.map((l) => `${l.id}${l.ativo ? "" : "(arquivado)"}`).join(",")} cookie=${String(cookie)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// As funções que já existiam
// ---------------------------------------------------------------------------

test("localAindaVale recusa arquivado e desconhecido", () => {
  const lista = [local("a"), local("b", { ativo: false })];
  assert.equal(localAindaVale("a", lista)?.id, "a");
  assert.equal(localAindaVale("b", lista), null);
  assert.equal(localAindaVale("z", lista), null);
  assert.equal(localAindaVale(undefined, lista), null);
});

test("nomeDoLocal prefere o fantasia", () => {
  assert.equal(nomeDoLocal({ nome: "Razão Social LTDA", nome_fantasia: "Santa Casa" }), "Santa Casa");
  assert.equal(nomeDoLocal({ nome: "Razão Social LTDA", nome_fantasia: null }), "Razão Social LTDA");
  assert.equal(nomeDoLocal({ nome: "Razão Social LTDA", nome_fantasia: "  " }), "Razão Social LTDA");
});
