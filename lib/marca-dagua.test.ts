import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AZUL_DA_MARCA_DAGUA, pintarDeAzul } from "./marca-dagua.ts";

const pixel = (r: number, g: number, b: number, a = 255) => pintarDeAzul(new Uint8ClampedArray([r, g, b, a]));

describe("marca d'água pintada de azul", () => {
  it("o desenho escuro do logo vira azul cheio", () => {
    assert.deepEqual([...pixel(0, 0, 0)], [...AZUL_DA_MARCA_DAGUA, 255]);
    assert.deepEqual([...pixel(22, 82, 160)], [...AZUL_DA_MARCA_DAGUA, 255], "o azul-escuro de um logo");
  });

  it("o fundo branco do JPG, e o ruído quase branco, somem", () => {
    assert.equal(pixel(255, 255, 255)[3], 0);
    assert.equal(pixel(240, 242, 238)[3], 0);
  });

  it("o meio-tom fica meio transparente, e o transparente do PNG continua transparente", () => {
    const meio = pixel(160, 160, 160)[3];
    assert.ok(meio > 50 && meio < 200, String(meio));
    assert.equal(pixel(0, 0, 0, 0)[3], 0);
  });
});
