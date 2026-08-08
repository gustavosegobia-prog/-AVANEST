/**
 * Testes dos módulos de eletrólitos, gap osmolar e Fick.
 *
 * Arquivo separado do calculos.test.ts para os dois não virarem um único
 * arquivo gigante — ambos rodam juntos com `npm test`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  calcioCorrigido,
  paraInterno,
  situacao,
  sodioCorrigido,
} from "./eletrolitos.ts";
import { calcularOsmolar } from "./osmolar.ts";
import { calcularFick, conteudoOxigenio, superficieCorporal } from "./fick.ts";

describe("eletrólitos", () => {
  it("glicose normal não altera o sódio", () => {
    assert.equal(sodioCorrigido(140, 90), 140);
  });

  it("glicose 600 corrige o sódio em 12 mmol/L", () => {
    assert.equal(sodioCorrigido(128, 600), 140);
  });

  it("albumina baixa eleva o cálcio corrigido", () => {
    assert.equal(calcioCorrigido(7.6, 2), 9.2);
  });

  it("albumina normal não mexe no cálcio", () => {
    assert.equal(calcioCorrigido(9.2, 4), 9.2);
  });

  it("converte cálcio de mg/dL para mmol/L", () => {
    assert.ok(Math.abs(paraInterno("calcio", 10, "mg/dL") - 2.5) < 0.01);
  });

  it("sódio em mEq/L e mmol/L são o mesmo número", () => {
    assert.equal(paraInterno("sodio", 140, "mEq/L"), 140);
  });

  it("classifica fora da faixa", () => {
    assert.equal(situacao("potassio", 2.9), "baixo");
    assert.equal(situacao("potassio", 4.2), "normal");
    assert.equal(situacao("potassio", 6.1), "alto");
  });
});

describe("gap osmolar", () => {
  it("com BUN usa o divisor 2,8", () => {
    const r = calcularOsmolar({ osmolalidadeMedida: 290, sodio: 140, glicoseMgDl: 90, nitrogenioMgDl: 14, tipo: "bun" });
    assert.equal(r?.calculada, 290);
    assert.equal(r?.gap, 0);
  });

  it("com ureia usa o divisor 6, e não o do BUN", () => {
    const r = calcularOsmolar({ osmolalidadeMedida: 290, sodio: 140, glicoseMgDl: 90, nitrogenioMgDl: 30, tipo: "ureia" });
    assert.equal(r?.calculada, 290);
  });

  it("tratar ureia como BUN infla a osmolalidade — o erro que o módulo evita", () => {
    const comoUreia = calcularOsmolar({ sodio: 140, glicoseMgDl: 90, nitrogenioMgDl: 30, tipo: "ureia" })!.calculada;
    const comoBun = calcularOsmolar({ sodio: 140, glicoseMgDl: 90, nitrogenioMgDl: 30, tipo: "bun" })!.calculada;
    assert.ok(comoBun - comoUreia > 5, `diferença inesperada: ${comoBun - comoUreia}`);
  });

  it("gap acima de 10 é sinalizado", () => {
    const r = calcularOsmolar({ osmolalidadeMedida: 310, sodio: 140, glicoseMgDl: 90, nitrogenioMgDl: 14, tipo: "bun" });
    assert.match(r!.interpretacao!, /aumentado/);
  });

  it("etanol entra na conta quando informado", () => {
    const sem = calcularOsmolar({ sodio: 140, glicoseMgDl: 90, nitrogenioMgDl: 14, tipo: "bun" })!.calculada;
    const com = calcularOsmolar({ sodio: 140, glicoseMgDl: 90, nitrogenioMgDl: 14, tipo: "bun", etanolMgDl: 100 })!.calculada;
    assert.ok(com > sem);
  });

  it("sem osmolalidade medida devolve a calculada e diz o que falta", () => {
    const r = calcularOsmolar({ sodio: 140, glicoseMgDl: 90, nitrogenioMgDl: 14, tipo: "bun" });
    assert.equal(r?.gap, undefined);
    assert.ok(r!.faltando.some((f) => /osmolalidade medida/.test(f)));
  });
});

describe("Fick", () => {
  it("CaO2 com Hb 15 e SaO2 100% fica perto de 20", () => {
    assert.ok(Math.abs(conteudoOxigenio(15, 100) - 20.1) < 0.1);
  });

  it("a pressão parcial acrescenta o dissolvido", () => {
    assert.ok(conteudoOxigenio(15, 100, 100) > conteudoOxigenio(15, 100));
  });

  it("saturação aceita 98 e 0,98", () => {
    assert.equal(conteudoOxigenio(15, 98), conteudoOxigenio(15, 0.98));
  });

  it("superfície corporal de 70 kg e 170 cm é ~1,82 m²", () => {
    assert.ok(Math.abs(superficieCorporal(70, 170)! - 1.82) < 0.02);
  });

  it("VO2 informado tem precedência sobre a estimativa", () => {
    const r = calcularFick({ hemoglobina: 15, sao2: 98, svo2: 70, pesoKg: 70, alturaCm: 170, vo2Informado: 250 });
    assert.equal(r?.origemVo2, "informado");
    assert.equal(r?.vo2, 250);
  });

  it("sem VO2 informado, estima por superfície e avisa", () => {
    const r = calcularFick({ hemoglobina: 15, sao2: 98, svo2: 70, pesoKg: 70, alturaCm: 170 });
    assert.equal(r?.origemVo2, "estimado");
    assert.match(r!.aviso, /estimado/);
  });

  it("calcula débito e índice cardíaco coerentes", () => {
    const r = calcularFick({ hemoglobina: 15, sao2: 98, svo2: 70, pesoKg: 70, alturaCm: 170, vo2Informado: 250 });
    assert.ok(r!.debito > 3 && r!.debito < 8, `débito fora do plausível: ${r!.debito}`);
    assert.ok(r!.indice! > 1.5 && r!.indice! < 5, `índice fora do plausível: ${r!.indice}`);
  });

  it("diferença arteriovenosa nula não gera resultado, em vez de dividir por zero", () => {
    assert.equal(calcularFick({ hemoglobina: 15, sao2: 98, svo2: 98, vo2Informado: 250 }), undefined);
  });

  it("sem SvO2 não calcula", () => {
    assert.equal(calcularFick({ hemoglobina: 15, sao2: 98, vo2Informado: 250 }), undefined);
  });
});
