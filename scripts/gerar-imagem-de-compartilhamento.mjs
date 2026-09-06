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

/** A foto do topo do site, embutida — o navegador do script não tem servidor. */
const foto = await readFile(join(RAIZ, "public", "hero-bg.jpg"));
const fundo = `data:image/jpeg;base64,${foto.toString("base64")}`;

/**
 * A folha da fonte.
 *
 * Da rede por padrão. Onde a rede é bloqueada — e o proxy deste ambiente
 * bloqueia —, `FONTE_LOCAL` aponta para uma pasta com o CSS e os `.woff2`
 * baixados, e tudo entra na página em base64: nenhuma requisição no caminho.
 *
 *     FONTE_LOCAL=~/fontes/outfit node scripts/gerar-imagem-de-compartilhamento.mjs
 *
 * O CSS pode se chamar `outfit.css` ou `outfit-embutida.css` — o segundo já vem
 * com as fontes embutidas e é usado como está.
 */
async function folhaDaFonte() {
  const pasta = process.env.FONTE_LOCAL;
  if (!pasta) {
    return '<link rel="stylesheet" href="https://fonts.googleapis.com/css2'
      + '?family=Outfit:wght@500;600;800&display=swap">';
  }
  const nomes = ["outfit-embutida.css", "outfit.css"];
  let css = null;
  for (const nome of nomes) {
    css = await readFile(join(pasta, nome), "utf8").catch(() => null);
    if (css) break;
  }
  if (!css) throw new Error(`Não achei ${nomes.join(" nem ")} em ${pasta}`);
  for (const arquivo of [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => m[1])) {
    const bytes = await readFile(join(pasta, arquivo.replace(/^.*\//, "")));
    css = css.replaceAll(arquivo, `data:font/woff2;base64,${bytes.toString("base64")}`);
  }
  return `<style>${css}</style>`;
}

const pagina = `<!doctype html><meta charset="utf-8">
${await folhaDaFonte()}
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${LARGURA}px;height:${ALTURA}px;overflow:hidden;
    font-family:Outfit,'Segoe UI',system-ui,sans-serif;background:#041626}
  .foto{position:absolute;inset:0;background:url("${fundo}") center/cover}
  /* O mesmo véu da capa do site: o texto branco precisa de contraste, e a foto
     sozinha não garante nenhum. Mais fechado à esquerda, onde o texto fica. */
  .veu{position:absolute;inset:0;
    background:linear-gradient(100deg,#041626f7 0%,#041626ea 52%,#04162699 100%)}
  .conteudo{position:absolute;inset:0;padding:90px;display:flex;flex-direction:column;
    justify-content:center;gap:26px}
  .marca{display:flex;align-items:center;gap:22px}
  .marca svg{width:78px;height:78px}
  .marca b{font-size:52px;font-weight:800;letter-spacing:.13em;color:#fff;line-height:1}
  h1{font-size:62px;font-weight:600;line-height:1.06;letter-spacing:-.025em;color:#fff;
    max-width:15ch}
  p{font-size:27px;line-height:1.45;color:#c5d4df;max-width:34ch}
  .selo{position:absolute;left:90px;bottom:78px;font-size:19px;font-weight:600;
    letter-spacing:.24em;text-transform:uppercase;color:#2bc5a8}
</style>
<div class="foto"></div><div class="veu"></div>
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
  <h1>Gestão em anestesiologia</h1>
  <p>Avaliação pré-anestésica, escala do serviço e o controle do que você tem a receber.</p>
</div>
<div class="selo">Feito por anestesiologista</div>`;

const navegador = await chromium.launch();
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
    + "Verifique o acesso a fonts.googleapis.com e rode de novo.");
}

await mkdir(join(RAIZ, "public"), { recursive: true });
await aba.screenshot({ path: SAIDA });
await navegador.close();

const { size } = await import("node:fs").then((fs) => fs.promises.stat(SAIDA));
console.log(`public/compartilhar.png  ${LARGURA}×${ALTURA}  ${(size / 1024).toFixed(0)} KB`);
