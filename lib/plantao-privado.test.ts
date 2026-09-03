import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Um plantão que a pessoa lança para si mesma, sem ser quem monta a escala,
 * NÃO nasce como plantão do grupo.
 *
 * É uma regra de dinheiro, e o defeito que ela conserta foi visto num serviço
 * real: um plantão de R$ 900 lançado pela própria anestesiologista, num
 * hospital digitado à mão, apareceu nas cobranças em atraso do GRUPO. Ninguém
 * escolheu isso — era o que acontecia sozinho.
 *
 * O formulário é um componente de React com estado; testá-lo de verdade exigiria
 * montar a árvore inteira. O que dá para garantir daqui, e é o que importa, é
 * que o PADRÃO não voltou a ser "do grupo" — uma letra a menos aqui e o
 * dinheiro de alguém volta a mudar de dono em silêncio.
 */
const tela = readFileSync(new URL("../components/plantoes.tsx", import.meta.url), "utf8");

test("plantão novo: quem não monta a escala começa em 'só meu'", () => {
  assert.match(tela, /privado: !ehAdmin,/,
    "o padrão do formulário deixou de depender de quem está lançando — "
    + "sem isso, o plantão pessoal volta a cair na conta do grupo");
});

test("plantão novo: o padrão antigo não voltou", () => {
  const i = tela.indexOf("valor: \"\", perfil_id: ehAdmin ? para : perfilId");
  assert.notEqual(i, -1, "o estado inicial do formulário mudou de forma");
  assert.doesNotMatch(tela.slice(i, i + 120), /privado: false/,
    "`privado: false` fixo faria todo lançamento nascer como do grupo");
});

test("os dois botões se distinguem para quem não monta a escala", () => {
  // Com o padrão novo, a diferença entre os dois botões é o que decide se o
  // plantão entra na conta do serviço. "Para mim" e "Só meu" lado a lado não
  // dizem isso a quem não montou escala nenhuma.
  assert.match(tela, /\{ehAdmin \? "Para mim" : "Do grupo"\}/,
    "quem não monta a escala precisa de um rótulo que diga o que o botão faz");
});
