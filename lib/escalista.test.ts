import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  explicarEscala, podeEscolherEscalista, podeMontarEscala, temEscalista,
} from "./escalista.ts";

const dono = { role: "owner" };
const admin = { role: "admin" };
const outroAdmin = { role: "admin" };
const medico = { role: "medico" };
const recepcao = { role: "recepcao" };

describe("enquanto ninguém foi eleito, nada muda", () => {
  // A regra de compatibilidade, e a mais importante do arquivo: as
  // organizações que já existem não podem acordar sem ninguém capaz de lançar
  // um plantão. A primeira notícia disso seria alguém tentando escalar o
  // plantão de amanhã.
  const equipe = [dono, admin, medico, recepcao];

  it("o administrador continua montando", () => {
    assert.equal(podeMontarEscala(admin, equipe), true);
  });

  it("o proprietário continua montando", () => {
    assert.equal(podeMontarEscala(dono, equipe), true);
  });

  it("o anestesiologista comum continua sem montar", () => {
    assert.equal(podeMontarEscala(medico, equipe), false);
    assert.equal(podeMontarEscala(recepcao, equipe), false);
  });

  it("temEscalista responde não", () => {
    assert.equal(temEscalista(equipe), false);
  });
});

describe("eleito um escalista, a escala passa a ter dono", () => {
  const escalista = { role: "medico", escalista: true };
  const equipe = [dono, admin, outroAdmin, escalista, recepcao];

  it("o escalista monta, mesmo sendo médico e não administrador", () => {
    // É o ponto do recurso: dá o poder de montar a escala SEM entregar o
    // Financeiro, os convites e o cadastro de todo mundo junto.
    assert.equal(podeMontarEscala(escalista, equipe), true);
  });

  it("o administrador PERDE — é para isso que serve", () => {
    // Sem isto, "só ele monta" seria mentira: continuariam três pessoas
    // podendo trocar a escala do mês sem ninguém saber quem trocou.
    assert.equal(podeMontarEscala(admin, equipe), false);
    assert.equal(podeMontarEscala(outroAdmin, equipe), false);
  });

  it("o proprietário nunca perde: é a saída de emergência", () => {
    // Escalista de férias, com a senha perdida ou fora do grupo não pode
    // trancar a escala do mês do lado de fora.
    assert.equal(podeMontarEscala(dono, equipe), true);
  });

  it("o resto da equipe segue de fora", () => {
    assert.equal(podeMontarEscala(medico, equipe), false);
    assert.equal(podeMontarEscala(recepcao, equipe), false);
  });
});

describe("mais de um escalista", () => {
  it("num grupo grande, dois dividem a escala", () => {
    const a = { role: "medico", escalista: true };
    const b = { role: "medico", escalista: true };
    const equipe = [dono, admin, a, b];
    assert.equal(podeMontarEscala(a, equipe), true);
    assert.equal(podeMontarEscala(b, equipe), true);
    assert.equal(podeMontarEscala(admin, equipe), false);
  });
});

describe("quem escolhe o escalista", () => {
  it("proprietário e administrador", () => {
    assert.equal(podeEscolherEscalista(dono), true);
    assert.equal(podeEscolherEscalista(admin), true);
  });

  it("o escalista NÃO escolhe outro, nem se desmarca", () => {
    // Duas razões: a decisão de quem manda na escala é de quem responde pelo
    // grupo, e um escalista que se desmarcasse trancaria a escala sem querer.
    assert.equal(podeEscolherEscalista({ role: "medico", escalista: true }), false);
    assert.equal(podeEscolherEscalista(medico), false);
  });
});

describe("a frase que a tela mostra", () => {
  it("sem ninguém marcado, avisa a consequência ANTES do clique", () => {
    // O administrador precisa saber que marcar o primeiro tira o poder dele
    // próprio. Descobrir isso pelo efeito é descobrir tarde.
    const frase = explicarEscala([dono, admin, medico]);
    assert.match(frase, /todos os administradores/);
    assert.match(frase, /só essa pessoa e o proprietário/);
  });

  it("com um, diz que é um", () => {
    assert.match(explicarEscala([dono, { role: "medico", escalista: true }]),
      /Um escalista definido/);
  });

  it("com dois, diz quantos", () => {
    assert.match(explicarEscala([
      { role: "medico", escalista: true }, { role: "medico", escalista: true },
    ]), /^2 escalistas/);
  });
});

describe("dados imperfeitos não mudam a resposta", () => {
  it("nulo e indefinido no marcador contam como não eleito", () => {
    // Vem do banco, onde a coluna é nula em toda linha antiga.
    const equipe = [{ role: "admin", escalista: null }, { role: "medico" }];
    assert.equal(temEscalista(equipe), false);
    assert.equal(podeMontarEscala(equipe[0], equipe), true, "segue a regra antiga");
  });

  it("equipe vazia não trava o proprietário", () => {
    assert.equal(podeMontarEscala(dono, []), true);
  });
});

describe("a saída de emergência", () => {
  it("o super-admin monta escala mesmo com escalista eleito", () => {
    // O caso real: a INOVANEST nasceu sem proprietário. Eleito o escalista, os
    // 4 administradores perderam o poder e não sobrou ninguém para destravar —
    // 13 anestesiologistas dependendo de uma pessoa só não faltar.
    const equipe = [
      { role: "admin", escalista: true },
      { role: "admin", escalista: false },
      { role: "admin", escalista: false, super_admin: true },
    ];
    assert.equal(podeMontarEscala(equipe[1], equipe), false, "admin comum perde, como projetado");
    assert.equal(podeMontarEscala(equipe[2], equipe), true, "o super-admin destrava");
  });

  it("a tela e o banco precisam concordar", () => {
    // Esta função decide se o botão aparece; a policy decide se a gravação
    // passa. Botão visível que dá erro ao salvar é pior que botão escondido.
    const so = [{ role: "medico", escalista: true }];
    assert.equal(podeMontarEscala({ role: "medico", super_admin: true }, so), true);
    assert.equal(podeMontarEscala({ role: "medico" }, so), false);
  });
});
