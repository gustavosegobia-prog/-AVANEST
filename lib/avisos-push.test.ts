import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

// A rota decide POR QUE nenhum aviso saiu; a tela traduz esse motivo para uma
// frase. São dois arquivos diferentes, e nada além deste teste liga um ao
// outro: quem adicionar um motivo novo na rota e esquecer a frase faz a tela
// dizer "o servidor não disse por quê" — que é exatamente a mensagem inútil
// que esta correção veio eliminar.

const rota = readFileSync("app/api/push/avisar/route.ts", "utf8");
/**
 * A rota SEM os comentários.
 *
 * Necessário porque os comentários deste projeto citam o código errado para
 * explicar por que ele era errado — e um teste que procura o padrão proibido
 * no arquivo inteiro reprova justamente a documentação da correção.
 */
const rotaSemComentarios = rota
  .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
  .join("\n");
// A TELA TAMBÉM VAI SEM COMENTÁRIOS, pela mesma razão da rota logo acima — e
// não por simetria: um comentário na tela que cita `"sem-alvo"` para explicar
// quando a rota o devolve aparecia ANTES da tabela de frases, e o recorte
// abaixo (de `"sem-chave"` até `"sem-alvo"`) saía vazio. O teste reprovava a
// documentação, de novo.
const tela = readFileSync("components/plantoes.tsx", "utf8")
  .split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
  .join("\n");

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

describe("o fim do mês na busca de quem avisar", () => {
  it("NUNCA usa 31 fixo", () => {
    // "2026-09-31" não existe. O Postgres recusa a comparação inteira, a
    // consulta volta vazia, e o sistema conclui que não há ninguém a avisar —
    // em abril, junho, setembro, novembro e fevereiro. Cinco meses dos doze,
    // em silêncio, culpando a equipe pela ausência de avisos.
    assert.equal(/\$\{mes\}-31/.test(rotaSemComentarios), false,
      "o fim do mês precisa vir do calendário, não de um 31 fixo");
    assert.ok(rota.includes("ultimoDiaDoMes"), "use o helper que já existe em lib/data-local");
  });

  it("erro de consulta não vira 'ninguém para avisar'", () => {
    // Confundir os dois foi o que escondeu o defeito acima: a consulta falhava
    // e a tela dizia que a equipe não tinha ligado as notificações.
    assert.ok(rota.includes("erroPlantoes"), "o erro da consulta precisa ser lido");
    assert.ok(rota.includes("falha-consulta"), "e ter motivo próprio");
  });
});

describe("quem pode disparar o aviso da escala", () => {
  it("a rota confere no BANCO, e não confia na tela", () => {
    // O botão "Avisar a equipe" só aparece para quem administra — mas tela não
    // é fronteira de segurança. Bastava um POST com `{tipo:"escala"}` para
    // qualquer pessoa da organização tocar o telefone e mandar e-mail para
    // todos os colegas escalados no mês, com o remetente avanest.com.br e o
    // nosso DKIM em cima.
    assert.ok(/rpc\("pode_montar_escala"\)/.test(rota),
      "a rota voltou a aceitar o disparo da escala sem conferir quem pediu");
    // A MESMA regra que decide quem monta a escala: avisar que ela saiu é
    // parte de publicá-la, e duas regras para o mesmo ato divergem na
    // primeira mudança.
    const ondeConfere = rota.indexOf('rpc("pode_montar_escala")');
    const ondeDispara = rota.indexOf("alvos.push(");
    assert.ok(ondeConfere > 0 && ondeConfere < ondeDispara,
      "a checagem de permissão ficou depois de a rota montar os alvos");
  });

  it("há teto por hora, e o do disparo em massa é mais apertado", () => {
    // O aviso de escala publicada manda dez e-mails e toca dez telefones de
    // uma vez; os outros avisos acompanham o uso normal — montar a escala do
    // mês são trinta lançamentos, cada um com o seu aviso. Um teto só, para os
    // dois, ou solta o disparo em massa ou silencia a metade do mês.
    assert.ok(/avisar-escala:\$\{user\.id\}/.test(rota), "sumiu o teto do disparo em massa");
    assert.ok(/enforceRateLimit\(`avisar:\$\{user\.id\}`/.test(rota), "sumiu o teto dos outros avisos");
    const massa = rota.match(/avisar-escala:[^}]*\}`, \{ limit: (\d+)/)?.[1];
    const normal = rota.match(/`avisar:[^}]*\}`, \{ limit: (\d+)/)?.[1];
    assert.ok(massa && normal && Number(massa) < Number(normal),
      `o disparo em massa deixou de ser o mais apertado (massa ${massa}, normal ${normal})`);
  });
});
