import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diaDaSemana, ondeEQuando, quandoPlantao, quantosPlantoes } from "./aviso-plantao.ts";

describe("o dia da semana", () => {
  it("02/09/2026 é quarta", () => {
    assert.equal(diaDaSemana("2026-09-02"), "Quarta");
  });

  it("NÃO escorrega um dia por causa do fuso", () => {
    // `new Date("2026-09-02")` é meia-noite UTC. Lida no fuso de São Paulo ela
    // vira 21h do dia 1º — e a notificação diria "Terça" num plantão de quarta.
    // É o mesmo defeito que trocava o dia na agenda, e aqui ninguém
    // desconfiaria do sistema: erraria calado.
    const antes = process.env.TZ;
    for (const fuso of ["UTC", "America/Sao_Paulo", "Pacific/Kiritimati"]) {
      process.env.TZ = fuso;
      assert.equal(diaDaSemana("2026-09-02"), "Quarta", `errou em ${fuso}`);
    }
    process.env.TZ = antes;
  });

  it("data inválida não vira 'Invalid'", () => {
    for (const ruim of ["", "abc", "2026-13-45"]) {
      assert.equal(/invalid/i.test(diaDaSemana(ruim)), false, ruim);
    }
  });
});

describe("o plantão em uma linha", () => {
  const plantao = { data: "2026-09-02", hora_inicio: "07:00:00", hora_fim: "19:00:00" };

  it("mostra o dia da semana, a data e a FAIXA de horas", () => {
    // A hora de fim é o que decide se a pessoa assume: 07:00–13:00 e
    // 07:00–19:00 são decisões diferentes, e antes apareciam iguais.
    assert.equal(quandoPlantao(plantao), "Quarta, 02/09 · 07:00–19:00");
  });

  it("sem hora de fim, mostra só o começo em vez de mentir", () => {
    assert.equal(quandoPlantao({ ...plantao, hora_fim: null }), "Quarta, 02/09 · 07:00");
  });

  it("não escreve o ano", () => {
    // Quem recebe decide sobre as próximas semanas. O ano rouba o espaço que o
    // nome do hospital usa melhor, e a tela bloqueada corta o que sobra.
    assert.equal(/2026/.test(quandoPlantao(plantao)), false);
  });

  it("o lugar entra no fim, e some quando não há", () => {
    assert.match(ondeEQuando(plantao, "Santa Casa"), /· Santa Casa$/);
    assert.equal(ondeEQuando(plantao, ""), quandoPlantao(plantao));
    assert.equal(ondeEQuando(plantao, "   "), quandoPlantao(plantao));
  });

  it("plantão sem data não produz uma linha quebrada", () => {
    assert.equal(quandoPlantao({ data: null }), "");
    assert.equal(ondeEQuando({ data: null }, "Santa Casa"), "Santa Casa");
  });
});

describe("quantos plantões no mês", () => {
  it("diz o número, que é o que a pessoa foi conferir", () => {
    assert.equal(quantosPlantoes(12, "2026-09"), "Você tem 12 plantões em setembro.");
  });

  it("um plantão não vira '1 plantões'", () => {
    assert.equal(quantosPlantoes(1, "2026-09"), "Você tem 1 plantão em setembro.");
  });

  it("nenhum é uma resposta, e poupa abrir o sistema", () => {
    assert.equal(quantosPlantoes(0, "2026-02"), "Você não tem plantões em fevereiro.");
  });
});
