/**
 * Gera as imagens que o iPhone e o iPad mostram no toque do ícone.
 *
 *     node scripts/gerar-tela-de-abertura.mjs
 *
 * POR QUE ELAS MOSTRAM SÓ O Λ, sem o nome e sem o slogan. A imagem do iOS é o
 * quadro da animação em que o Λ acabou de se desenhar — e naquele quadro nada
 * mais está pintado. A sequência que a pessoa vê atravessa dois programas:
 *
 *     iOS mostra o Λ  →  o site assume  →  o nome entra  →  o slogan fecha
 *
 * Se a imagem trouxesse a marca pronta, o site logo em seguida a desmontaria
 * para remontá-la. Leria como falha, não como abertura.
 *
 * E POR QUE NÃO O QUADRO ZERO, que seria a tela vazia: porque tela branca é
 * exatamente o problema que estas imagens existem para resolver. O aplicativo
 * pareceria travado por um segundo, e um segundo de tela vazia basta para a
 * pessoa achar que não abriu e tocar de novo. O primeiro quadro DESENHADO é o
 * Λ pronto, e é ele que a imagem mostra.
 *
 * O ESPAÇO DOS TRÊS FICA GUARDADO: o do Λ, o do nome embaixo dele e o do
 * slogan por último. Sem isso o Λ sairia centralizado na imagem e se mexeria
 * no instante em que o site assumisse — um tranco bem no meio da emenda, que é
 * o único lugar onde ele apareceria.
 *
 * O nome e o slogan são escondidos com `visibility`, e não com `display` nem
 * apagando o texto: só `visibility` tira a tinta MANTENDO o espaço. Com
 * `display:none` as linhas sumiriam do cálculo e o Λ desceria — exatamente o
 * tranco que este parágrafo existe para evitar.
 *
 * A lista de aparelhos vem de lib/tela-de-abertura.ts: uma fonte só para os
 * tamanhos, senão um aparelho novo entra na lista e não ganha arquivo — e o
 * iOS ignora medida que não bate CALADO, devolvendo a tela branca.
 *
 * As medidas em pontos são multiplicadas pela densidade, e a captura é feita
 * na densidade certa: renderizar em 1x e ampliar deixaria o traço do Λ
 * serrilhado justamente na tela onde ele é mais olhado.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "public", "abertura");

// Importado do próprio módulo do site, e não recopiado: duas listas de
// aparelhos seriam duas verdades, e a que estivesse errada falharia em
// silêncio.
const { TELAS_DE_ABERTURA, arquivoDaAbertura } = await import(
  join(raiz, "lib", "tela-de-abertura.ts")
);

/**
 * De onde vem a Outfit.
 *
 * O normal é o Google, igual ao site. Mas a geração inteira depende de uma
 * rede que pode falhar no meio — e aí ou o programa para (o que é o certo, e é
 * o que ele faz) ou sai imagem na fonte errada. Com `FONTE_LOCAL` apontando
 * para uma pasta com o `outfit.css` e os `.woff2` baixados, a folha é embutida
 * na página com as fontes em base64 e não há rede nenhuma no caminho.
 *
 *     FONTE_LOCAL=~/fontes/outfit node scripts/gerar-tela-de-abertura.mjs
 */
async function folhaDaFonte() {
  const pasta = process.env.FONTE_LOCAL;
  if (!pasta) {
    return '<link rel="stylesheet" href="https://fonts.googleapis.com/css2'
      + '?family=Outfit:wght@600;800&display=swap">';
  }
  const { readFile } = await import("node:fs/promises");
  let css = await readFile(join(pasta, "outfit.css"), "utf8");
  // Cada arquivo vira data: — assim a página não busca nada, nem em disco.
  for (const nome of [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => m[1])) {
    const bytes = await readFile(join(pasta, nome.replace(/^.*\//, "")));
    css = css.replaceAll(nome, `data:font/woff2;base64,${bytes.toString("base64")}`);
  }
  return `<style>${css}</style>`;
}

const FOLHA_DA_FONTE = await folhaDaFonte();

/** A mesma proporção que o CSS da abertura usa, para o quadro bater. */
const pagina = (largura, altura) => `<!doctype html><html><head><meta charset="utf-8">
${FOLHA_DA_FONTE}
<style>
  html,body{margin:0;padding:0;background:#fff}
  body{width:${largura}px;height:${altura}px;display:grid;place-items:center;
    font-family:Outfit,system-ui,sans-serif}
  /* AS MESMAS MEDIDAS DE .marcaAvanest EM app/globals.css, e tem de ser as
     mesmas: o nome desenhado aqui e o nome que o site continua exibindo no
     instante seguinte. Um pixel de diferenca vira um salto na emenda. */
  .marca{display:grid;justify-items:center;padding:0 24px;max-width:420px;width:100%;
    transform:translateY(-1.7vh)}
  /* O Λ, desenhado — é o que esta imagem mostra. Mesmo traçado e mesmo
     degradê da assinatura das folhas impressas e da abertura do site. */
  .vao{width:min(25.9vw,108px);height:auto;display:block}
  .nome{display:flex;justify-content:center;margin:0.35px 0 0;line-height:1;
    font-size:clamp(23px,7.551vw,32px);font-weight:800;letter-spacing:.1012em;text-indent:.1012em;
    /* Sem tinta, com o lugar guardado — veja o cabeçalho. */
    visibility:hidden}
  .nome span:nth-child(-n+4){color:#0879c9}
  .nome span:nth-child(n+5){color:#2bc5a8}
  .slogan{margin:8.4px 0 0;font-size:clamp(7.5px,2.28vw,9.5px);font-weight:600;line-height:1;
    letter-spacing:.317em;text-transform:uppercase;color:#7c95a8;text-indent:.317em;
    /* Sem tinta, com o lugar guardado — veja o cabeçalho. */
    visibility:hidden}
</style></head><body><div class="marca">
<svg class="vao" viewBox="0 0 128 128">
<defs><linearGradient id="avn" x1="18" y1="16" x2="104" y2="112" gradientUnits="userSpaceOnUse">
<stop stop-color="#0879c9"/><stop offset=".55" stop-color="#0d8ce1"/>
<stop offset="1" stop-color="#2bc5a8"/></linearGradient></defs>
<path d="M15 110 51 25c3-8 8-13 14-13s11 5 15 14l32 84" fill="none" stroke="url(#avn)"
 stroke-linecap="round" stroke-linejoin="round" stroke-width="14"/></svg>
<p class="nome">${[..."AVANEST"].map((l) => `<span>${l}</span>`).join("")}</p>
<p class="slogan">Gestão em anestesiologia</p></div></body></html>`;

await mkdir(destino, { recursive: true });
const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? undefined,
});

let feitas = 0;
for (const tela of TELAS_DE_ABERTURA) {
  const pag = await navegador.newPage({
    viewport: { width: tela.largura, height: tela.altura },
    deviceScaleFactor: tela.densidade,
  });
  await pag.setContent(pagina(tela.largura, tela.altura));
  // A FONTE TEM DE ESTAR MESMO CARREGADA, e `fonts.ready` sozinho não garante
  // isso: ele resolve igual quando o download FALHOU, e a página segue na
  // fonte de reserva. Foi exatamente o que aconteceu na primeira leva destas
  // imagens — saíram com o nome 7% maior, em outra fonte, e o programa disse
  // "22 telas geradas" sem reclamar de nada. Erro que só apareceria no
  // aparelho, depois de publicado.
  //
  // A PERGUNTA CERTA É PELA FACE CARREGADA, e não `document.fonts.check`:
  // esse devolve `true` mesmo quando não existe nenhuma @font-face de Outfit,
  // porque ele considera a substituta do sistema uma resposta válida. Foi
  // testado: numa página sem font-face nenhuma, `check("800 31px Outfit")`
  // respondeu `true` e as duas larguras medidas deram exatamente iguais.
  //
  // `document.fonts` só lista faces que a folha de estilo declarou, e
  // `status` só é "loaded" depois de o arquivo chegar.
  await pag.evaluate(() => document.fonts.ready);
  const temAFonte = await pag.evaluate(() =>
    [...document.fonts].some((f) => f.family === "Outfit" && f.status === "loaded"));
  if (!temAFonte) {
    await navegador.close();
    throw new Error(
      "A fonte Outfit não carregou — as imagens sairiam na fonte de reserva, "
      + "com medidas diferentes das do site. Verifique o acesso a "
      + "fonts.googleapis.com e rode de novo.",
    );
  }
  await pag.waitForTimeout(120);
  const png = await pag.screenshot({ type: "png" });
  await writeFile(join(raiz, "public", arquivoDaAbertura(tela).replace(/^\//, "")), png);
  await pag.close();
  feitas++;
}
await navegador.close();
console.log(`${feitas} telas de abertura geradas em public/abertura/`);
