import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

// A rota decide POR QUE nenhum aviso saiu; a tela traduz esse motivo para uma
// frase. São dois arquivos diferentes, e nada além deste teste liga um ao
// outro: quem adicionar um motivo novo na rota e esquecer a frase faz a tela
// dizer "o servidor não disse por quê" — que é exatamente a mensagem inútil
// que esta correção veio eliminar.

const rota = readFileSync("app/api/push/avisar/route.ts", "utf8");
const tela = readFileSync("components/plantoes.tsx", "utf8");

/**
 * Os motivos que a rota é capaz de devolver, lidos do próprio código.
 *
 * Procura em toda LINHA que fala de motivo, e não no formato `motivo: "x"`:
 * um deles é escrito como ternário (`motivo: cond ? "sem-aparelho" : undefined`)
 * e uma expressão exata deixaria justamente ele de fora — o teste passaria
 * verde sem cobrir o caso que mais interessa.
 */
const motivosDaRota = rota.split("\n")
  .filter((l) => l.includes("motivo"))
  .flatMap((l) => [...l.matchAll(/"([a-z]+(?:-[a-z]+)+)"/g)].map((m) => m[1]));

describe("quando nenhum aviso sai, a tela sabe explicar", () => {
  it("a rota devolve pelo menos os três motivos conhecidos", () => {
    for (const esperado of ["sem-chave", "sem-alvo", "sem-aparelho"]) {
      assert.ok(motivosDaRota.includes(esperado), `a rota deixou de devolver "${esperado}"`);
    }
  });

  it("TODO motivo da rota tem frase na tela", () => {
    for (const motivo of motivosDaRota) {
      assert.ok(
        tela.includes(`"${motivo}":`),
        `a rota devolve "${motivo}" e a tela não sabe explicar — o usuário veria a mensagem genérica`,
      );
    }
  });

  it("há um caso de reserva, para o motivo que ninguém previu", () => {
    assert.ok(tela.includes("desconhecido:"), "sem reserva, um motivo novo mostraria 'undefined'");
  });

  it("a frase da chave faltando aponta para o SERVIDOR", () => {
    // O defeito original: "ninguém da equipe ligou as notificações" aparecia
    // até quando faltava a chave no servidor, mandando o dono do serviço
    // cobrar os colegas por um problema de configuração.
    //
    // Proibir a palavra "equipe" nesta frase seria a checagem errada — a frase
    // certa PODE citá-la, para dizer que não é com ela. O que precisa estar lá
    // é para onde apontar.
    const semChave = tela.slice(tela.indexOf('"sem-chave"'), tela.indexOf('"sem-alvo"'));
    assert.match(semChave, /servidor|configura/i,
      "quem lê precisa saber que o problema é do sistema, não dos colegas");
  });
});
