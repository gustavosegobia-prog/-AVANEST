import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APFEL_CRITERIOS, ASA_CLASSES, LEE_CLASSES, LEE_RISCO,
  RCRI_CRITERIOS, STOP_BANG_CRITERIOS, lerApfel, lerLee, lerStopBang,
} from "./escores.ts";

describe("índice de Lee", () => {
  it("tem os seis critérios do RCRI, nem mais nem menos", () => {
    // Seis é a definição do escore. Um sétimo critério não seria "mais
    // completo": seria outro índice, com outras taxas de evento.
    assert.equal(RCRI_CRITERIOS.length, 6);
  });

  it("liga cada total à classe e à taxa publicadas", () => {
    assert.deepEqual(lerLee(0), { classe: "I", risco: "0,4%" });
    assert.deepEqual(lerLee(1), { classe: "II", risco: "0,9%" });
    assert.deepEqual(lerLee(2), { classe: "III", risco: "6,6%" });
    assert.deepEqual(lerLee(3), { classe: "IV", risco: "11%" });
  });

  it("de 3 pontos em diante fica tudo na classe IV", () => {
    // A coorte original não separou 3 de 6. Inventar uma quinta faixa daria a
    // um número um respaldo que ele não tem.
    for (const pontos of [3, 4, 5, 6]) assert.equal(lerLee(pontos).classe, "IV");
  });

  it("as duas listas de leitura andam juntas", () => {
    assert.equal(LEE_CLASSES.length, LEE_RISCO.length);
  });
});

describe("STOP-Bang", () => {
  it("tem os oito critérios", () => {
    assert.equal(STOP_BANG_CRITERIOS.length, 8);
  });

  it("separa as três faixas nos pontos de corte certos", () => {
    // As bordas são o que erra na hora de reescrever: 2 ainda é baixo, 3 já é
    // intermediário; 4 ainda é intermediário, 5 já é alto.
    assert.equal(lerStopBang(0), "baixo risco");
    assert.equal(lerStopBang(2), "baixo risco");
    assert.equal(lerStopBang(3), "risco intermediário");
    assert.equal(lerStopBang(4), "risco intermediário");
    assert.equal(lerStopBang(5), "alto risco");
    assert.equal(lerStopBang(8), "alto risco");
  });
});

describe("Apfel", () => {
  it("tem os quatro fatores", () => {
    assert.equal(APFEL_CRITERIOS.length, 4);
  });

  it("devolve a incidência de cada total", () => {
    assert.equal(lerApfel(0), "≈ 10%");
    assert.equal(lerApfel(1), "≈ 21%");
    assert.equal(lerApfel(2), "≈ 39%");
    assert.equal(lerApfel(3), "≈ 61%");
    assert.equal(lerApfel(4), "≈ 79%");
  });

  it("não devolve indefinido para total fora da faixa", () => {
    // A página pública conta caixinhas marcadas; se alguma vez contar errado,
    // o certo é mostrar uma ponta da escala e não "undefined" na tela.
    assert.equal(lerApfel(-1), "≈ 10%");
    assert.equal(lerApfel(9), "≈ 79%");
  });
});

describe("classificação ASA", () => {
  it("tem as seis classes, em ordem", () => {
    assert.deepEqual(
      ASA_CLASSES.map((c) => c.classe),
      ["ASA I", "ASA II", "ASA III", "ASA IV", "ASA V", "ASA VI"],
    );
  });

  it("toda classe tem definição e exemplo", () => {
    // Definição sem exemplo vira abstração, e aí cada um classifica de um jeito.
    for (const c of ASA_CLASSES) {
      assert.ok(c.definicao.length > 0, `${c.classe} sem definição`);
      assert.ok(c.exemplos.length > 0, `${c.classe} sem exemplos`);
    }
  });
});

describe("as chaves dos critérios", () => {
  it("não se repetem entre escores", () => {
    // As chaves são as mesmas gravadas na avaliação. Duas iguais em escores
    // diferentes fariam marcar um critério ligar o outro.
    const todas = [...RCRI_CRITERIOS, ...STOP_BANG_CRITERIOS, ...APFEL_CRITERIOS]
      .map(([chave]) => chave);
    assert.equal(new Set(todas).size, todas.length);
  });
});
