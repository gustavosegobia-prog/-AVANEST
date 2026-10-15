/**
 * Gera a imagem que aparece quando alguém cola um link do site.
 *
 *     node scripts/gerar-imagem-de-compartilhamento.mjs
 *
 * POR QUE ELA PRECISA EXISTIR. Um link do avanest.com.br colado no WhatsApp, no
 * Instagram ou no LinkedIn aparecia como um bloco de texto cinza, sem imagem —
 * as doze páginas do site estavam sem `og:image`. Em campanha de lançamento é o
 * item que mais custa clique: a mesma mensagem, com e sem imagem, não recebe o
 * mesmo número de toques.
 *
 * 1200×630 é a medida que as três redes cortam melhor. O WhatsApp mostra um
 * quadrado no meio, o LinkedIn mostra a faixa inteira e o Instagram fica no
 * meio do caminho — por isso nada importante encosta nas bordas: o texto e a
 * marca vivem na área central segura, com folga de 90px de cada lado.
 *
 * GERADA E VERSIONADA, e não montada a cada requisição. Uma rota que desenha a
 * imagem por chamada gasta computação em toda prévia de link e depende do
 * servidor estar de pé para o link ficar bonito — que é justamente quando ele
 * mais precisa funcionar. Um PNG no `public/` é servido pelo cache da Vercel e
 * não tem como falhar.
 *
 * O Playwright vem do ambiente de desenvolvimento; a imagem entra no
 * repositório e o site não depende dele em produção.
 */
import { chromium } from "playwright";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "public", "compartilhar.png");
const LARGURA = 1200;
const ALTURA = 630;

/**
 * As telas, as mesmas da capa do site (public/capa), embutidas — o navegador
 * do script não tem servidor. A ficha anestésica no tablet na frente e o
 * manejo de crises atrás: os dois módulos que o colega não encontra em outro
 * sistema. A prévia do link é a primeira imagem do sistema que muita gente
 * vê, e não pode ser inventada: são capturas reais, com dados fictícios.
 */
const embutir = async (arquivo) =>
  `data:image/webp;base64,${(await readFile(join(RAIZ, "public", "capa", arquivo))).toString("base64")}`;
const ficha = await embutir("ficha-anestesica.webp");
const crises = await embutir("manejo-de-crises.webp");

/**
 * A fonte é a mesma que o site serve (public/fontes), embutida em base64:
 * nenhuma requisição no caminho, e nada do Google — o site deixou de usar o
 * Google Fonts pela privacidade de quem visita, e o gerador segue a mesma
 * regra.
 */
async function folhaDaFonte() {
  const faces = [];
  for (const [arquivo, faixa] of [
    ["outfit-latin-v15.woff2", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212"],
    ["outfit-latin-ext-v15.woff2", "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+20A0-20AB,U+20AD-20C4"],
  ]) {
    const bytes = await readFile(join(RAIZ, "public", "fontes", arquivo));
    faces.push(`@font-face{font-family:"Outfit";font-weight:100 900;unicode-range:${faixa};`
      + `src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2")}`);
  }
  return `<style>${faces.join("")}</style>`;
}

const pagina = `<!doctype html><meta charset="utf-8">
${await folhaDaFonte()}
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${LARGURA}px;height:${ALTURA}px;overflow:hidden;position:relative;
    font-family:Outfit,'Segoe UI',system-ui,sans-serif;background:#071c2f}
  /* As telas entram pela direita e passam da borda: é o sistema, não um
     enfeite. O véu à esquerda garante o contraste do texto onde se encontram. */
  .janela{position:absolute;left:700px;top:58px;width:640px;border-radius:14px;overflow:hidden;
    background:#fff;box-shadow:0 30px 70px -24px #000d,0 0 0 1px #ffffff26}
  .janela i{display:block;height:26px;background:#e8eef3;border-bottom:1px solid #d3dde6}
  .janela img{display:block;width:100%}
  .tablet{position:absolute;left:620px;top:250px;width:560px;padding:11px;border-radius:26px;
    background:#0b1824;box-shadow:0 34px 80px -20px #000e,0 0 0 1px #ffffff2e}
  .tablet img{display:block;width:100%;border-radius:14px}
  .veu{position:absolute;inset:0;
    background:linear-gradient(90deg,#071c2f 0%,#071c2ff5 44%,#071c2f80 55%,#071c2f00 66%)}
  .conteudo{position:absolute;inset:0;padding:0 90px;display:flex;flex-direction:column;
    justify-content:center;gap:26px}
  .marca{display:flex;align-items:center;gap:20px}
  .marca svg{width:70px;height:70px}
  .marca b{font-size:46px;font-weight:600;letter-spacing:.16em;color:#fff;line-height:1}
  h1{font-size:54px;font-weight:600;line-height:1.08;letter-spacing:-.025em;color:#fff;white-space:nowrap}
  p{font-size:25px;line-height:1.45;color:#c5d4df;max-width:31ch}
  p b{color:#43c8b8;font-weight:600}
</style>
<div class="janela"><i></i><img src="${crises}" alt=""></div>
<div class="tablet"><img src="${ficha}" alt=""></div>
<div class="veu"></div>
<div class="conteudo">
  <div class="marca">
    <svg viewBox="0 0 128 128">
      <defs><linearGradient id="avn" x1="18" y1="16" x2="104" y2="112" gradientUnits="userSpaceOnUse">
        <stop stop-color="#0879c9"/><stop offset=".55" stop-color="#0d8ce1"/>
        <stop offset="1" stop-color="#2bc5a8"/></linearGradient></defs>
      <path d="M15 110 51 25c3-8 8-13 14-13s11 5 15 14l32 84" fill="none"
        stroke="url(#avn)" stroke-linecap="round" stroke-linejoin="round" stroke-width="14"/>
    </svg>
    <b>AVANEST</b>
  </div>
  <h1>Da recepção ao<br>fechamento do mês.</h1>
  <p>Recepção, consulta pré-anestésica, ficha anestésica, manejo de crises, escala e financeiro. <b>Feito por anestesiologista.</b></p>
</div>`;

// CHROMIUM aponta um navegador já instalado, quando o do Playwright não está.
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const aba = await navegador.newPage({ viewport: { width: LARGURA, height: ALTURA } });
await aba.setContent(pagina, { waitUntil: "domcontentloaded" });

// A FONTE PRECISA ESTAR CARREGADA, e esperar tempo fixo não garante isso.
// Com a Outfit ainda em trânsito, a imagem sai na fonte do sistema — o nome da
// marca com outro desenho de letra, e ninguém percebe até o link estar na rua.
await aba.evaluate(() => document.fonts.ready);
const temOutfit = await aba.evaluate(() =>
  [...document.fonts].some((f) => f.family === "Outfit" && f.status === "loaded"));
if (!temOutfit) {
  await navegador.close();
  throw new Error(
    "A fonte Outfit não carregou — a imagem sairia com a letra do sistema. "
    + "Confira os arquivos em public/fontes e rode de novo.");
}

await mkdir(join(RAIZ, "public"), { recursive: true });
await aba.screenshot({ path: SAIDA });
await navegador.close();

const { size } = await import("node:fs").then((fs) => fs.promises.stat(SAIDA));
console.log(`public/compartilhar.png  ${LARGURA}×${ALTURA}  ${(size / 1024).toFixed(0)} KB`);
