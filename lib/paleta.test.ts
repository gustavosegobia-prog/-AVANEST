import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PALETA_DA_FOLHA } from "./escala.ts";

/* ---------------------------------------------------------------------------
   As contas de cor moram no teste, e não em lib/.
   O sistema não precisa saber calcular ΔE2000 em tempo de execução: as cores
   são fixas. Quem precisa saber é quem for mexer nelas — e é aqui que ele
   descobre se piorou.
   --------------------------------------------------------------------------- */

const paraRgb = (h: string) => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16) / 255);
const linear = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const luminancia = (h: string) => {
  const [r, g, b] = paraRgb(h).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
};
const paraLab = (h: string) => {
  const [r, g, b] = paraRgb(h).map(linear);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};

/**
 * ΔE2000 — quanto duas cores são diferentes AOS OLHOS, e não em números.
 *
 * A distância crua em RGB não serve: dois verdes com 40 de diferença em RGB
 * são a mesma cor na parede, e dois azuis com os mesmos 40 são cores
 * distintas. Esta é a fórmula que a CIE recomenda desde 2001.
 */
function deltaE(h1: string, h2: string): number {
  const [L1, a1, b1] = paraLab(h1), [L2, a2, b2] = paraLab(h2);
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const A1 = (1 + G) * a1, A2 = (1 + G) * a2;
  const C1 = Math.hypot(A1, b1), C2 = Math.hypot(A2, b2);
  const grau = (x: number) => (x * 180) / Math.PI;
  const h1a = C1 === 0 ? 0 : (grau(Math.atan2(b1, A1)) + 360) % 360;
  const h2a = C2 === 0 ? 0 : (grau(Math.atan2(b2, A2)) + 360) % 360;
  const dL = L2 - L1, dC = C2 - C1;
  let dh = 0;
  if (C1 * C2 !== 0) {
    dh = h2a - h1a;
    if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh * Math.PI) / 360);
  const Lm = (L1 + L2) / 2, Cml = (C1 + C2) / 2;
  let hm = h1a + h2a;
  if (C1 * C2 !== 0) {
    if (Math.abs(h1a - h2a) > 180) hm += h1a + h2a < 360 ? 360 : -360;
    hm /= 2;
  }
  const T = 1 - 0.17 * Math.cos(((hm - 30) * Math.PI) / 180)
    + 0.24 * Math.cos((2 * hm * Math.PI) / 180)
    + 0.32 * Math.cos(((3 * hm + 6) * Math.PI) / 180)
    - 0.20 * Math.cos(((4 * hm - 63) * Math.PI) / 180);
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const Sc = 1 + 0.045 * Cml, Sh = 1 + 0.015 * Cml * T;
  const Rt = -2 * Math.sqrt(Cml ** 7 / (Cml ** 7 + 25 ** 7))
    * Math.sin((60 * Math.exp(-(((hm - 275) / 25) ** 2)) * Math.PI) / 180);
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2
    + Rt * (dC / Sc) * (dH / Sh));
}

const menorDistancia = (cores: readonly string[], quantas: number) => {
  let menor = Infinity, par = "";
  for (let i = 0; i < quantas; i++)
    for (let j = i + 1; j < quantas; j++) {
      const d = deltaE(cores[i], cores[j]);
      if (d < menor) { menor = d; par = `m${i + 1} ${cores[i]} x m${j + 1} ${cores[j]}`; }
    }
  return { menor, par };
};

test("as cores da equipe estão longe umas das outras", () => {
  // A paleta anterior tinha três verdes e três arroxeados: o par mais parecido
  // ficava em ΔE 9,9, e na parede eles viravam a mesma cor.
  //
  // A ORDEM importa: a cor sai da posição na lista da equipe, então um serviço
  // de sete pessoas usa só as sete primeiras. Elas são as que precisam estar
  // mais separadas.
  const sete = menorDistancia(PALETA_DA_FOLHA, 7);
  assert.ok(sete.menor >= 18, `as 7 primeiras se aproximaram: ΔE ${sete.menor.toFixed(1)} — ${sete.par}`);
  const todas = menorDistancia(PALETA_DA_FOLHA, PALETA_DA_FOLHA.length);
  assert.ok(todas.menor >= 14, `a paleta se aproximou: ΔE ${todas.menor.toFixed(1)} — ${todas.par}`);
});

test("o rosa e o roxo só entram da oitava posição em diante", () => {
  // Foi pedido. Reservar a faixa é tudo o que dá para fazer daqui: o sistema
  // não sabe quem é quem, e a cor sai da posição na lista da equipe. Quem
  // quiser essas cores numa pessoa fixa pelo seletor da equipe, e a cor fixada
  // vence a da posição.
  //
  // A faixa é a do rosa, roxo, magenta e vinho: de 296° a 360° e a ponta até
  // 25°, medida no ângulo de tom do CIELAB.
  const tom = (hex: string) => {
    const [, a, b] = paraLab(hex);
    return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  };
  const ehRosaOuRoxo = (hex: string) => tom(hex) >= 296 || tom(hex) <= 25;
  for (let i = 0; i < 7; i++)
    assert.ok(!ehRosaOuRoxo(PALETA_DA_FOLHA[i]),
      `m${i + 1} (${PALETA_DA_FOLHA[i]}, tom ${tom(PALETA_DA_FOLHA[i]).toFixed(0)}°) é rosa ou roxo`);
  // E elas continuam na paleta: reservar não é apagar.
  assert.ok(PALETA_DA_FOLHA.slice(7).some(ehRosaOuRoxo), "o rosa e o roxo sumiram da paleta");
});

test("o nome branco se lê em cima de qualquer uma delas", () => {
  // A pastilha é a cor cheia com o nome em branco por cima. Uma cor clara
  // demais some o nome, e a cor deixa de identificar para atrapalhar.
  for (const [i, cor] of PALETA_DA_FOLHA.entries())
    assert.ok(contraste(cor, "#ffffff") >= 4.5,
      `m${i + 1} (${cor}) tem contraste ${contraste(cor, "#ffffff").toFixed(2)} com o branco`);
});

/**
 * A MESMA COR NA TELA E NO PAPEL.
 *
 * A paleta existe em dois lugares: aqui, para o PDF, e em `.med-m1`…`.med-m14`
 * no globals.css, para o calendário. Elas discordarem significa a pessoa ser
 * roxa no telefone e verde na parede — e a cor deixar de ser atalho para virar
 * mais uma coisa a conferir. Nenhum compilador pega isso; este teste pega.
 */
test("o CSS do calendário usa exatamente as cores da folha", () => {
  const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const [i, cor] of PALETA_DA_FOLHA.entries()) {
    const regra = `.med-m${i + 1}{--med-cor:${cor}}`;
    assert.ok(css.includes(regra), `faltou no globals.css: ${regra}`);
  }
});

test("no tema escuro cada cor clareia, e continuam separadas", () => {
  const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const escuras = PALETA_DA_FOLHA.map((_, i) => {
    const achado = css.match(new RegExp(`\\.clinicalDark \\.med-m${i + 1}\\{--med-cor:(#[0-9a-f]{6})\\}`));
    assert.ok(achado, `falta a versão escura de m${i + 1}`);
    return achado![1];
  });
  // Lá a pastilha leva tinta escura por cima, e o piso é 7:1.
  for (const [i, cor] of escuras.entries())
    assert.ok(contraste(cor, "#0b1220") >= 7,
      `m${i + 1} escura (${cor}) tem só ${contraste(cor, "#0b1220").toFixed(2)} contra a tinta`);
  const sete = menorDistancia(escuras, 7);
  assert.ok(sete.menor >= 17, `as 7 escuras se aproximaram: ΔE ${sete.menor.toFixed(1)} — ${sete.par}`);
});

test("o seletor de cor da equipe chama cada cor pelo nome certo", () => {
  // Estes nomes são o que o leitor de tela lê e o que aparece ao pousar o dedo:
  // são a única forma de escolher uma cor sem enxergá-la. Trocar a paleta e
  // esquecer a lista faz o botão azul-petróleo dizer "Ciano", que é pior do que
  // não dizer nada.
  const fonte = fs.readFileSync(new URL("../components/plantoes.tsx", import.meta.url), "utf8");
  const bloco = fonte.match(/const NOMES_DAS_CORES = \[([^]*?)\] as const;/);
  assert.ok(bloco, "não achei NOMES_DAS_CORES");
  const nomes = [...bloco![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(nomes.length, PALETA_DA_FOLHA.length,
    `são ${PALETA_DA_FOLHA.length} cores e ${nomes.length} nomes`);
  // E nenhum nome pode ter sobrado da paleta antiga.
  for (const antigo of ["Ciano", "Verde-limão", "Índigo", "Magenta", "Ardósia"])
    assert.ok(!nomes.includes(antigo), `"${antigo}" é nome da paleta antiga`);
});
