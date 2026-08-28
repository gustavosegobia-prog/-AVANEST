import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dataLocal, horaLocal, hoje, mesAtual, somarDias, somarMeses, ultimoDiaDoMes,
} from "./data-local.ts";

describe("a data no fuso do serviço", () => {
  it("às 23h25 do dia 27 no Brasil, hoje é dia 27", () => {
    // O defeito relatado, na íntegra: nesse instante já é dia 28 em Greenwich,
    // e o calendário da escala marcava "hoje" no quadradinho de amanhã.
    assert.equal(dataLocal(new Date("2026-08-28T02:25:00Z")), "2026-08-27");
  });

  it("vira o dia à meia-noite daqui, e não à de Londres", () => {
    assert.equal(dataLocal(new Date("2026-08-28T02:59:59Z")), "2026-08-27");
    assert.equal(dataLocal(new Date("2026-08-28T03:00:00Z")), "2026-08-28");
  });

  it("meio-dia continua sendo o mesmo dia", () => {
    assert.equal(dataLocal(new Date("2026-08-27T15:00:00Z")), "2026-08-27");
  });

  it("atravessa a virada do ano sem perder o ano", () => {
    assert.equal(dataLocal(new Date("2027-01-01T02:00:00Z")), "2026-12-31");
  });

  it("responde o mesmo esteja o processo em UTC ou não", () => {
    // É o que faz a Vercel (que roda em UTC) concordar com o navegador de quem
    // está em Campo Mourão. O contrato do módulo é este: o fuso é do serviço,
    // não da máquina.
    const instante = new Date("2026-08-28T02:25:00Z");
    const antes = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      assert.equal(dataLocal(instante), "2026-08-27");
      process.env.TZ = "Asia/Tokyo";
      assert.equal(dataLocal(instante), "2026-08-27");
    } finally {
      if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes;
    }
  });

  it("sem argumento devolve hoje, em AAAA-MM-DD", () => {
    assert.match(hoje(), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(hoje(), dataLocal());
  });

  it("o mês corrente é os sete primeiros caracteres de hoje", () => {
    assert.match(mesAtual(), /^\d{4}-\d{2}$/);
    assert.equal(mesAtual(), hoje().slice(0, 7));
  });
});

describe("a hora no fuso do serviço", () => {
  it("02h25 em Greenwich são 23h25 aqui", () => {
    assert.equal(horaLocal(new Date("2026-08-28T02:25:00Z")), "23:25");
  });

  it("meia-noite sai como 00, e nunca como 24", () => {
    // Algumas versões do ICU escrevem "24" para a meia-noite com hour12:false,
    // e "24:10" não é hora que se mostre a ninguém.
    assert.equal(horaLocal(new Date("2026-08-28T03:00:00Z")), "00:00");
  });
});

describe("somar dias", () => {
  it("soma dentro do mês", () => {
    assert.equal(somarDias("2026-08-14", 15), "2026-08-29");
  });

  it("atravessa o fim do mês", () => {
    assert.equal(somarDias("2026-08-25", 15), "2026-09-09");
  });

  it("anda para trás", () => {
    assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
  });

  it("conhece o ano bissexto", () => {
    assert.equal(somarDias("2028-02-28", 1), "2028-02-29");
  });

  it("aceita um carimbo com hora e devolve só a data", () => {
    assert.equal(somarDias("2026-08-14T18:00:00Z", 1), "2026-08-15");
  });

  it("somar zero não move a data", () => {
    // A prova de que a montagem ao meio-dia não escorrega sozinha: se a função
    // passasse por meia-noite local, esta linha já sairia um dia antes.
    for (const dia of ["2026-01-01", "2026-02-15", "2026-10-18", "2026-11-01"]) {
      assert.equal(somarDias(dia, 0), dia, `${dia} escorregou`);
    }
  });

  it("data sem sentido volta vazia, em vez de virar NaN", () => {
    // A nota fiscal só ganha data de emissão depois de sair: a coluna nula é
    // rotina. "NaN-NaN-NaN" passaria por data e entraria numa comparação.
    assert.equal(somarDias("", 5), "");
    assert.equal(somarDias(null, 5), "");
    assert.equal(somarDias(undefined, 5), "");
  });
});

describe("último dia do mês", () => {
  it("meses de 31, de 30 e fevereiro", () => {
    assert.equal(ultimoDiaDoMes("2026-08"), "2026-08-31");
    assert.equal(ultimoDiaDoMes("2026-09"), "2026-09-30");
    assert.equal(ultimoDiaDoMes("2026-02"), "2026-02-28");
  });

  it("fevereiro bissexto", () => {
    assert.equal(ultimoDiaDoMes("2028-02"), "2028-02-29");
  });

  it("dezembro não vira janeiro do ano seguinte", () => {
    assert.equal(ultimoDiaDoMes("2026-12"), "2026-12-31");
  });

  it("aceita uma data inteira e usa só o mês", () => {
    assert.equal(ultimoDiaDoMes("2026-02-10"), "2026-02-28");
  });
});

describe("somar meses", () => {
  it("anda para a frente e para trás", () => {
    assert.equal(somarMeses("2026-08", 1), "2026-09");
    assert.equal(somarMeses("2026-08", -6), "2026-02");
  });

  it("atravessa o ano nos dois sentidos", () => {
    assert.equal(somarMeses("2026-01", -1), "2025-12");
    assert.equal(somarMeses("2026-12", 1), "2027-01");
  });

  it("doze meses para trás caem no mesmo mês do ano anterior", () => {
    assert.equal(somarMeses("2026-08", -12), "2025-08");
  });
});
