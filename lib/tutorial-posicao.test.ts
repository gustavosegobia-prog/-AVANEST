import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LARGURA, MARGEM, posicaoDaJanela, type Recorte,
} from "./tutorial-posicao.ts";

const TELA = { larguraTela: 1440, alturaTela: 900 };
const item = (topo: number, esquerda = 40): Recorte =>
  ({ topo, esquerda, largura: 240, altura: 44 });

/** A regra que o módulo inteiro existe para garantir. */
function dentroDaTela(p: NonNullable<ReturnType<typeof posicaoDaJanela>>,
  larguraTela: number, alturaTela: number) {
  assert.ok(p.top >= MARGEM, `topo ${p.top} acima da margem`);
  assert.ok(p.left >= MARGEM, `esquerda ${p.left} fora da margem`);
  assert.ok(p.left + p.width <= larguraTela - MARGEM,
    `a janela passa da borda direita: ${p.left + p.width} > ${larguraTela - MARGEM}`);
  // `maxHeight` é o TETO, não a altura: a janela ocupa o menor entre ele e o
  // conteúdo. O que não pode é o teto deixá-la passar da borda de baixo.
  assert.ok(p.top + p.maxHeight <= alturaTela - MARGEM + 1,
    `a janela pode passar da borda de baixo: ${p.top} + ${p.maxHeight} > ${alturaTela - MARGEM}`);
  assert.ok(p.maxHeight > 0, "teto de altura zero esconderia a janela");
}

describe("a janela nunca sai da tela", () => {
  it("alvo no alto: a janela desce, e não vaza por cima", () => {
    // O defeito relatado. A conta antiga posicionava por `bottom` quando não
    // cabia embaixo, e um alvo no topo empurrava a janela para fora.
    const p = posicaoDaJanela({ foco: item(20), altura: 320, ...TELA })!;
    dentroDaTela(p, TELA.larguraTela, TELA.alturaTela);
  });

  it("alvo no rodapé: a janela sobe", () => {
    const p = posicaoDaJanela({ foco: item(830), altura: 300, ...TELA })!;
    assert.ok(p.top + 300 <= 830, "deveria caber acima do elemento");
    dentroDaTela(p, TELA.larguraTela, TELA.alturaTela);
  });

  it("alvo colado na borda direita: a janela recua", () => {
    // Encostada num botão do canto, ela sairia pela direita e a pessoa leria
    // meia frase.
    const p = posicaoDaJanela({ foco: item(300, 1400), altura: 260, ...TELA })!;
    assert.equal(p.left, TELA.larguraTela - LARGURA - MARGEM);
    dentroDaTela(p, TELA.larguraTela, TELA.alturaTela);
  });

  it("janela mais alta que a tela inteira: rola por dentro", () => {
    // Notebook de tela baixa com uma etapa de texto longo. Sem o teto, os
    // botões Voltar e Próximo saem da tela e o tutorial fica sem saída.
    const p = posicaoDaJanela({ foco: item(200), altura: 700,
      larguraTela: 1440, alturaTela: 620 })!;
    assert.equal(p.top, MARGEM);
    assert.ok(p.maxHeight <= 620 - MARGEM * 2);
    dentroDaTela(p, 1440, 620);
  });

  it("vale para qualquer alvo, em qualquer tela", () => {
    // Varredura: a regra é uma só e tem de valer sempre. Foi uma combinação
    // não pensada — alvo alto, texto longo — que produziu o defeito.
    for (const alturaTela of [560, 700, 900, 1200]) {
      for (const larguraTela of [700, 1024, 1440, 1920]) {
        for (const topo of [0, 5, 60, 300, alturaTela - 60, alturaTela - 5]) {
          for (const esquerda of [0, 200, larguraTela - 100]) {
            for (const altura of [180, 260, 340, 520, 900]) {
              const p = posicaoDaJanela({
                foco: { topo, esquerda, largura: 240, altura: 44 },
                altura, larguraTela, alturaTela,
              });
              if (!p) continue;
              dentroDaTela(p, larguraTela, alturaTela);
            }
          }
        }
      }
    }
  });
});

describe("quando não há onde ancorar", () => {
  it("sem alvo, devolve nulo e quem chama centraliza", () => {
    assert.equal(posicaoDaJanela({ foco: null, altura: 260, ...TELA }), null);
  });

  it("tela estreita devolve nulo: ao lado de um botão sobra tira de texto", () => {
    assert.equal(posicaoDaJanela({ foco: item(200), altura: 260,
      larguraTela: 390, alturaTela: 844 }), null);
    assert.equal(posicaoDaJanela({ foco: item(200), altura: 260,
      larguraTela: 699, alturaTela: 900 }), null);
  });

  it("a partir de 700px ancora", () => {
    assert.ok(posicaoDaJanela({ foco: item(200), altura: 260,
      larguraTela: 700, alturaTela: 900 }));
  });
});

describe("a preferência é embaixo do elemento", () => {
  it("cabendo embaixo, fica embaixo", () => {
    // É onde o olho vai depois de ver o destaque: o texto explica o que está
    // aceso logo acima dele.
    const foco = item(100);
    const p = posicaoDaJanela({ foco, altura: 260, ...TELA })!;
    assert.equal(p.top, foco.topo + foco.altura + MARGEM);
  });

  it("não cabendo embaixo mas cabendo em cima, sobe", () => {
    const foco = item(700);
    const p = posicaoDaJanela({ foco, altura: 300, ...TELA })!;
    assert.equal(p.top, foco.topo - 300 - MARGEM);
  });
});
