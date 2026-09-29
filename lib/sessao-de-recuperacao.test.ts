import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { sessaoVeioDeRecuperacao } from "./sessao-de-recuperacao.ts";

/**
 * O DEFEITO QUE ESTES TESTES GUARDAM.
 *
 * A tela de criar nova senha exigia apenas que HOUVESSE uma sessão, e trocava
 * a senha. Num computador compartilhado — o normal no hospital — quem
 * encontrasse o navegador aberto podia abrir aquele endereço e ficar com a
 * conta do médico para sempre: senha nova, acesso permanente, e o dono
 * descobrindo só no dia em que não conseguisse entrar.
 *
 * O `amr` do token é o Supabase dizendo COMO a sessão nasceu — ele grava isso
 * em `auth.mfa_amr_claims` (`password` ou `recovery`) e assina o token.
 */

/** Um token com o miolo pedido. Assinatura falsa: aqui ninguém a confere. */
const token = (payload: unknown) => {
  const base64url = (texto: string) => Buffer.from(texto, "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${base64url('{"alg":"HS256"}')}.${base64url(JSON.stringify(payload))}.assinatura`;
};

test("sessão de senha digitada NÃO libera a troca", () => {
  // É o caso do computador compartilhado: a pessoa entrou normalmente, deixou
  // o navegador aberto, e alguém abriu /atualizar-senha.
  assert.equal(sessaoVeioDeRecuperacao(token({ amr: [{ method: "password", timestamp: 1 }] })), false);
  assert.equal(sessaoVeioDeRecuperacao(token({ amr: ["password"] })), false);
});

test("sessão vinda do link de recuperação libera", () => {
  // Os dois formatos que a biblioteca do Supabase documenta. Ler só um deles
  // faria a tela recusar um link BOM no dia em que o formato mudasse — e esse
  // é o pior defeito possível aqui: manda pedir outro e-mail que também não
  // vai funcionar.
  assert.equal(sessaoVeioDeRecuperacao(token({ amr: [{ method: "recovery", timestamp: 1 }] })), true);
  assert.equal(sessaoVeioDeRecuperacao(token({ amr: ["recovery"] })), true);
  // Com dois métodos na sessão, basta um ser recuperação.
  assert.equal(sessaoVeioDeRecuperacao(token({ amr: ["password", "recovery"] })), true);
});

test("na dúvida, recusa", () => {
  // Token torto, ausente ou sem `amr` é "não veio de recuperação". O resultado
  // prático é o mesmo — esta pessoa não troca a senha por aqui — e falhar para
  // o lado fechado é a única escolha defensável numa tela que dá acesso
  // permanente a prontuário.
  for (const ruim of [null, undefined, "", "abc", "a.b", "a.b.c", token({}), token({ amr: "recovery" })]) {
    assert.equal(sessaoVeioDeRecuperacao(ruim as string | null | undefined), false,
      `deveria recusar: ${JSON.stringify(ruim)}`);
  }
});

test("nome com acento no token não quebra a leitura", () => {
  // `atob` devolve bytes. Lido como texto direto, "José" viraria dois
  // caracteres e o JSON.parse falharia — e a tela recusaria um link bom.
  const t = token({ amr: ["recovery"], user_metadata: { nome: "Dra. Alessandra Conceição" } });
  assert.equal(sessaoVeioDeRecuperacao(t), true);
});

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("a tela de nova senha exige a sessão de recuperação", () => {
  const tela = ler("app/atualizar-senha/update-password-form.tsx");
  // Nenhum caminho pode liberar só por existir sessão.
  assert.ok(!/if \(sessao\) liberar\(\)/.test(tela),
    "voltou a liberar a troca de senha por haver qualquer sessão");
  assert.ok(!/if \(data\.session\) return liberar\(\)/.test(tela),
    "voltou a liberar a troca de senha por haver qualquer sessão");
  assert.equal((tela.match(/sessaoVeioDeRecuperacao\(/g) ?? []).length, 3,
    "algum caminho da tela deixou de conferir de onde a sessão veio");
  // E a recusa manda para o lugar certo: quem já está logado não precisa de
  // outro link, precisa de Minha conta — que pede a senha atual.
  assert.match(tela, /Minha conta → Alterar senha/,
    "a recusa deixou de dizer por onde trocar a senha com a conta aberta");
});
