import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

/**
 * O QUE APARECE QUANDO ALGUÉM COLA UM LINK DO SITE.
 *
 * As doze páginas estavam sem `og:image`: um link do avanest.com.br no
 * WhatsApp, no Instagram ou no LinkedIn saía como um bloco de texto cinza, sem
 * imagem. Em campanha de lançamento é o item que mais custa clique — a mesma
 * mensagem, com e sem imagem, não recebe o mesmo número de toques.
 *
 * Nada disso quebra o build nem aparece em teste de tela: some em silêncio, e
 * só se descobre colando o link em algum lugar.
 */
test("o layout declara a imagem de compartilhamento por inteiro", () => {
  const layout = ler("app/layout.tsx");
  const og = layout.match(/openGraph:\s*\{([^]*?)\n  \},/);
  assert.ok(og, "sumiu o bloco openGraph do layout");
  for (const campo of ["type:", "locale:", "siteName:", "url:", "images:"])
    assert.ok(og![1].includes(campo), `falta ${campo} no openGraph`);
  // Largura e altura evitam o pulo de layout na prévia, e o alt é o que o
  // leitor de tela e o cliente de e-mail sem imagem mostram no lugar dela.
  for (const campo of ["width: 1200", "height: 630", "alt:"])
    assert.ok(og![1].includes(campo), `falta ${campo} na imagem`);
});

test("o cartão do Twitter é o grande, e leva imagem", () => {
  // Com `summary`, o X e o LinkedIn mostram a imagem num quadradinho ao lado do
  // texto — e uma peça 1200×630 cortada em quadrado perde o nome e a frase.
  const layout = ler("app/layout.tsx");
  const tw = layout.match(/twitter:\s*\{([^]*?)\n  \},/);
  assert.ok(tw, "sumiu o bloco twitter do layout");
  assert.match(tw![1], /card: "summary_large_image"/);
  assert.match(tw![1], /images:/);
});

test("a imagem existe, é PNG e tem 1200×630", () => {
  // O caminho declarado tem de existir no repositório: uma tag apontando para
  // arquivo que não existe é o mesmo que não ter tag, com a diferença de
  // parecer resolvida.
  const arquivo = new URL("../public/compartilhar.png", import.meta.url);
  const bytes = fs.readFileSync(arquivo);
  assert.ok(bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), "não é PNG");
  // O IHDR começa no byte 16: largura e altura, big-endian.
  assert.equal(bytes.readUInt32BE(16), 1200, "largura fora do padrão das redes");
  assert.equal(bytes.readUInt32BE(20), 630, "altura fora do padrão das redes");
});

test("o /favicon.ico existe no caminho fixo", () => {
  // O ícone declarado no HTML é outro arquivo, mas muitos rastreadores e
  // leitores pedem /favicon.ico direto, sem ler o HTML. Ali respondia 404.
  const ico = fs.readFileSync(new URL("../public/favicon.ico", import.meta.url));
  // Cabeçalho ICO: reservado 0, tipo 1 (ícone), 1 imagem dentro.
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.ok(ico.readUInt16LE(4) >= 1, "o .ico está vazio");
});

test("o gerador da imagem recusa rodar com a fonte errada", () => {
  // Com a Outfit ainda em trânsito, a imagem sai na fonte do sistema — o nome
  // da marca com outro desenho de letra, e ninguém percebe até o link estar na
  // rua. Foi o que aconteceu na primeira execução, e o guarda pegou.
  const script = ler("scripts/gerar-imagem-de-compartilhamento.mjs");
  assert.match(script, /document\.fonts\.ready/);
  assert.match(script, /f\.family === "Outfit" && f\.status === "loaded"/);
  assert.match(script, /throw new Error/);
});
