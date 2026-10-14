// A FOTO DO MONITOR, LIDA NO PRÓPRIO APARELHO.
//
// Foto de tela é o pior caso do OCR: cristal líquido com moiré, reflexo,
// grade, letra clara em fundo escuro, foto torta. Ler a foto inteira de uma
// vez acerta os horários e os nomes, mas erra metade dos números. Então:
//
// 1. A foto inteira é lida duas vezes — como veio e tratada (cinza, contraste
//    esticado, clara em fundo escuro invertida, a grade apagada) — e as duas
//    listas de palavras viram uma (grade-do-monitor.ts, `juntarPalavras`).
// 2. Das palavras sai o desenho da tabela e a lista de células
//    (`planejar`).
// 3. Cada célula é recortada da foto em resolução cheia, ampliada, limpa
//    (selo escuro com letra clara vira letra escura; traço da grade sai) e
//    relida sozinha, como uma linha só, aceitando apenas os caracteres que
//    cabem nela (algarismos; "/" e "()" na pressão; ":" na hora).
// 4. `montar` confere e junta tudo por horário.
//
// Sem tabela reconhecível, o texto da foto vai para lerTendencias, como antes.
// A foto não sai do aparelho e não fica guardada.

import { chaveDaLeitura, juntarPalavras, leituraBoa, montar, planejar, SELO_ILEGIVEL, type Alfabeto, type Caixa, type Celula, type Palavra } from "./grade-do-monitor";
import { lerTendencias, type LinhaDoMonitor } from "./monitor";

export type Tela = { canvas: HTMLCanvasElement; largura: number; altura: number };

const LADO_DA_LEITURA = 2000;   // a foto inteira, para achar a tabela
const LADO_DOS_RECORTES = 3200; // a fonte dos recortes de cada célula (foto maior encolhe)
const ALTURA_DO_RECORTE = 96;   // a célula ampliada: letra com uns 40–60 px

const ALFABETOS: Record<Alfabeto, string> = {
  numero: "0123456789.,",
  pressao: "0123456789/()",
  hora: "0123456789:-",
  rotulo: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
};

export function desenhar(fonte: CanvasImageSource, largura: number, altura: number, lado: number, minimo = 0): Tela {
  // Maior que `lado`, encolhe; menor que `minimo`, cresce — letra miúda o OCR não lê.
  const maior = Math.max(largura, altura);
  const k = Math.min(lado / maior, Math.max(1, minimo / maior));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(largura * k);
  canvas.height = Math.round(altura * k);
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingQuality = "high";
  g.drawImage(fonte, 0, 0, canvas.width, canvas.height);
  return { canvas, largura: canvas.width, altura: canvas.height };
}

/** Cinza de 0 a 255, contraste esticado entre os percentis 2 e 98, sempre letra escura em fundo claro. */
function cinzaEsticado(px: Uint8ClampedArray, n: number, inverter?: boolean): { cinza: Float32Array; escuro: boolean } {
  const cinza = new Float32Array(n);
  for (let i = 0; i < n; i++) cinza[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const passo = Math.max(1, Math.floor(n / 4000));
  const amostra: number[] = [];
  for (let i = 0; i < n; i += passo) amostra.push(cinza[i]);
  amostra.sort((a, b) => a - b);
  const q = (f: number) => amostra[Math.min(amostra.length - 1, Math.floor(amostra.length * f))];
  const p2 = q(0.02), p98 = q(0.98);
  const escuro = inverter ?? q(0.5) < (p2 + p98) / 2;
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(255, ((cinza[i] - p2) / Math.max(1, p98 - p2)) * 255));
    cinza[i] = escuro ? 255 - v : v;
  }
  return { cinza, escuro };
}

function limiarDeOtsu(cinza: Float32Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of cinza) hist[v | 0]++;
  let soma = 0;
  for (let t = 0; t < 256; t++) soma += t * hist[t];
  let sB = 0, wB = 0, melhor = -1, limiar = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = cinza.length - wB;
    if (!wF) break;
    sB += t * hist[t];
    const entre = wB * wF * (sB / wB - (soma - sB) / wF) ** 2;
    if (entre > melhor) { melhor = entre; limiar = t; }
  }
  return limiar;
}

/**
 * A foto torta: o ângulo (em graus) que deixa as linhas de texto e da grade
 * na horizontal. Prova os ângulos de −8° a 8° e fica com o que mais concentra
 * a tinta em poucas alturas (as linhas da tabela alinhadas dão picos).
 */
export function inclinacao(tela: Tela): number {
  const p = desenhar(tela.canvas, tela.largura, tela.altura, 800);
  const d = p.canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, p.largura, p.altura);
  const n = p.largura * p.altura;
  const { cinza } = cinzaEsticado(d.data, n);
  // As bordas de cima e de baixo de cada letra e de cada linha da grade (o
  // degrau de claro para escuro na vertical) — e não a tinta: a moldura preta
  // do monitor pesaria mais que a tabela inteira.
  const W = p.largura;
  const degraus = new Float32Array(n - W);
  for (let i = 0; i < n - W; i++) degraus[i] = Math.abs(cinza[i + W] - cinza[i]);
  const amostra = Array.from(degraus.filter((_, i) => i % 37 === 0)).sort((a, b) => a - b);
  const corte = Math.max(30, amostra[Math.floor(amostra.length * 0.93)] ?? 255);
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < n - W; i++) {
    if (degraus[i] < corte) continue;
    xs.push((i % W) - W / 2);
    ys.push(Math.floor(i / W) - p.altura / 2);
  }
  if (xs.length < 200) return 0;
  const nota = (graus: number) => {
    const r = (graus * Math.PI) / 180, sen = Math.sin(r), cos = Math.cos(r);
    const base = p.largura + p.altura;
    const hist = new Float64Array(base * 2);
    for (let i = 0; i < xs.length; i++) hist[Math.round(ys[i] * cos - xs[i] * sen) + base]++;
    let soma = 0;
    for (const h of hist) soma += h * h;
    return soma;
  };
  let melhor = 0, melhorNota = nota(0);
  for (let a = -8; a <= 8; a += 0.5) { const v = nota(a); if (v > melhorNota) { melhor = a; melhorNota = v; } }
  for (let a = melhor - 0.4; a <= melhor + 0.4; a += 0.1) { const v = nota(a); if (v > melhorNota) { melhor = a; melhorNota = v; } }
  return Math.abs(melhor) < 0.3 ? 0 : melhor;
}

/** A foto girada `graus` para trás, do mesmo tamanho; os cantos que sobram ficam cinza. */
function endireitada(tela: Tela, graus: number): Tela {
  if (!graus) return tela;
  const canvas = document.createElement("canvas");
  canvas.width = tela.largura; canvas.height = tela.altura;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = "#777";
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.imageSmoothingQuality = "high";
  g.translate(tela.largura / 2, tela.altura / 2);
  g.rotate((-graus * Math.PI) / 180);
  g.drawImage(tela.canvas, -tela.largura / 2, -tela.altura / 2);
  return { canvas, largura: tela.largura, altura: tela.altura };
}

/** A foto inteira tratada: cinza, contraste, escuro invertido, e as linhas compridas da grade apagadas. */
function tratada(tela: Tela): HTMLCanvasElement {
  const { largura: W, altura: H } = tela;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(tela.canvas, 0, 0);
  const d = g.getImageData(0, 0, W, H);
  const n = W * H;
  const { cinza } = cinzaEsticado(d.data, n);
  const limiar = limiarDeOtsu(cinza);
  const longo = Math.round(Math.max(W, H) / 22);
  const apagar = new Uint8Array(n);
  for (let y = 0; y < H; y++) {
    let ini = -1;
    for (let x = 0; x <= W; x++) {
      const t = x < W && cinza[y * W + x] < limiar;
      if (t && ini < 0) ini = x;
      if (!t && ini >= 0) { if (x - ini > longo) apagar.fill(1, y * W + ini, y * W + x); ini = -1; }
    }
  }
  for (let x = 0; x < W; x++) {
    let ini = -1;
    for (let y = 0; y <= H; y++) {
      const t = y < H && cinza[y * W + x] < limiar;
      if (t && ini < 0) ini = y;
      if (!t && ini >= 0) { if (y - ini > longo) for (let i = ini; i < y; i++) apagar[i * W + x] = 1; ini = -1; }
    }
  }
  for (let i = 0; i < n; i++) {
    const v = apagar[i] ? 255 : cinza[i];
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v;
    d.data[i * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return canvas;
}

/**
 * Uma célula recortada da foto em resolução cheia, pronta para o OCR: ampliada,
 * letra escura em fundo branco. Em "cinza", só o contraste — o OCR acha o
 * limiar sozinho, e o moiré não vira borrão. Em "pb", preto e branco feito
 * aqui: o selo escuro com a hora clara dentro (a hora da PNI) é desvirado, e o
 * traço da grade que encosta na borda do recorte sai. "espacado" é o preto
 * e branco com um vão entre os caracteres: o OCR junta algarismos repetidos e
 * colados ("77" sai "7"), e com o vão cada um é lido.
 */
type Modo = "cinza" | "pb" | "espacado";

/** Os recortes em que apareceu o selo escuro da hora. */
const comSelo = new WeakSet<HTMLCanvasElement>();

type Ajuste = { altura?: number; apertado?: boolean; crescido?: boolean };

function recorte(fonte: Tela, caixa: Caixa, modo: Modo, alfabeto: Alfabeto, ajuste: Ajuste = {}): HTMLCanvasElement {
  const { altura = ALTURA_DO_RECORTE, apertado = false, crescido = false } = ajuste;
  const sx = Math.floor(caixa.x0 * fonte.largura), sy = Math.floor(caixa.y0 * fonte.altura);
  const sw = Math.max(4, Math.ceil((caixa.x1 - caixa.x0) * fonte.largura));
  const sh = Math.max(4, Math.ceil((caixa.y1 - caixa.y0) * fonte.altura));
  const k = altura / sh;
  const W = Math.max(8, Math.round(sw * k)), H = altura;
  const margem = 16;
  const canvas = document.createElement("canvas");
  canvas.width = W + margem * 2; canvas.height = H + margem * 2;
  const g = canvas.getContext("2d", { willReadFrequently: true })!;
  g.imageSmoothingQuality = "high";
  g.drawImage(fonte.canvas, sx, sy, sw, sh, margem, margem, W, H);
  const d = g.getImageData(margem, margem, W, H);
  const n = W * H;
  const { cinza } = cinzaEsticado(d.data, n);
  const limiar = limiarDeOtsu(cinza);
  const tinta = new Uint8Array(n);
  for (let i = 0; i < n; i++) tinta[i] = cinza[i] < limiar ? 1 : 0;

  // As manchas de tinta, uma a uma (vizinhança de 4).
  let selo = false;
  const marca = new Int32Array(n).fill(-1);
  const pilha: number[] = [];
  let rotulo = 0;
  for (let i = 0; i < n; i++) {
    if (!tinta[i] || marca[i] >= 0) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    marca[i] = rotulo; pilha.push(i);
    const membros: number[] = [];
    while (pilha.length) {
      const j = pilha.pop()!;
      membros.push(j);
      const x = j % W, y = (j / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const v of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) {
        if (v >= 0 && tinta[v] && marca[v] < 0) { marca[v] = rotulo; pilha.push(v); }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const cheio = membros.length / (bw * bh);
    const naBorda = x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1;
    if (alfabeto === "hora" && cheio > 0.5 && bw > bh * 1.6 && bh > H * 0.3) {
      // Um bloco escuro largo onde vai a hora: é o selo com a letra clara
      // dentro. Desvira — o bloco vira papel e a letra, tinta — e limpa a
      // moldura, onde sobram os cantos arredondados.
      selo = true;
      const f = Math.max(2, Math.round(bh * 0.12));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * W + x;
          tinta[i] = y - y0 < f || y1 - y < f || x - x0 < f || x1 - x < f ? 0 : tinta[i] ^ 1;
        }
      }
    } else if (naBorda && (bh < H * 0.12 || bw < W * 0.04 || bh > H * 0.92 || bw > W * 0.92)) {
      // Traço da grade, ou o pedaço da célula vizinha cortado na borda.
      for (const j of membros) tinta[j] = 0;
    }
    rotulo++;
  }

  // A letra pequena no meio da célula: recorta de novo, justo em volta da
  // tinta, para o algarismo chegar ao OCR com uns 55 px de altura.
  if (!apertado) {
    let ix0 = W, iy0 = H, ix1 = -1, iy1 = -1;
    for (let i = 0; i < n; i++) {
      if (!tinta[i]) continue;
      const x = i % W, y = (i / W) | 0;
      if (x < ix0) ix0 = x; if (x > ix1) ix1 = x; if (y < iy0) iy0 = y; if (y > iy1) iy1 = y;
    }
    const ih = iy1 - iy0 + 1;
    // A letra cortada na borda de cima ou de baixo: a célula cresce para
    // aquele lado antes de ler (uma vez só).
    const cortadaEmCima = iy1 >= 0 && iy0 <= 1, cortadaEmBaixo = iy1 >= H - 2;
    if (!crescido && (cortadaEmCima || cortadaEmBaixo)) {
      const a = caixa.y1 - caixa.y0;
      return recorte(fonte, {
        ...caixa, y0: Math.max(0, caixa.y0 - (cortadaEmCima ? a * 0.35 : 0)), y1: Math.min(1, caixa.y1 + (cortadaEmBaixo ? a * 0.35 : 0)),
      }, modo, alfabeto, { altura, crescido: true });
    }
    if (iy1 >= 0 && ih > H * 0.12 && ih < H * 0.62) {
      const fx = (caixa.x1 - caixa.x0) / W, fy = (caixa.y1 - caixa.y0) / H;
      const justa = {
        x0: caixa.x0 + Math.max(0, ix0 - ih * 0.5) * fx, x1: caixa.x0 + Math.min(W, ix1 + 1 + ih * 0.5) * fx,
        y0: caixa.y0 + Math.max(0, iy0 - ih * 0.4) * fy, y1: caixa.y0 + Math.min(H, iy1 + 1 + ih * 0.4) * fy,
      };
      const justo = recorte(fonte, justa, modo, alfabeto, { altura, apertado: true });
      if (selo) comSelo.add(justo);
      return justo;
    }
  }
  if (selo) comSelo.add(canvas);

  g.fillStyle = "#fff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  if (modo === "espacado") {
    const remontado = espacado(tinta, W, H, margem);
    if (selo) comSelo.add(remontado);
    return remontado;
  }
  for (let i = 0; i < n; i++) {
    const v = modo === "cinza" ? cinza[i] : tinta[i] ? 0 : 255;
    d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v;
    d.data[i * 4 + 3] = 255;
  }
  g.putImageData(d, margem, margem);
  return canvas;
}

/** O preto e branco remontado com um vão entre cada pedaço separado por coluna vazia. */
function espacado(tinta: Uint8Array, W: number, H: number, margem: number): HTMLCanvasElement {
  const pedacos: Array<[number, number]> = [];
  let ini = -1;
  for (let x = 0; x <= W; x++) {
    let tem = false;
    if (x < W) for (let y = 0; y < H && !tem; y++) tem = tinta[y * W + x] === 1;
    if (tem && ini < 0) ini = x;
    if (!tem && ini >= 0) { pedacos.push([ini, x]); ini = -1; }
  }
  const vao = Math.round(H * 0.45);
  const largura = pedacos.reduce((s, [a, b]) => s + b - a, 0) + vao * Math.max(0, pedacos.length - 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, largura) + margem * 2; canvas.height = H + margem * 2;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, canvas.width, canvas.height);
  const d = g.getImageData(margem, margem, Math.max(8, largura), H);
  let destino = 0;
  for (const [a, b] of pedacos) {
    for (let y = 0; y < H; y++) {
      for (let x = a; x < b; x++) {
        const j = (y * d.width + destino + x - a) * 4;
        const v = tinta[y * W + x] ? 0 : 255;
        d.data[j] = d.data[j + 1] = d.data[j + 2] = v;
        d.data[j + 3] = 255;
      }
    }
    destino += b - a + vao;
  }
  g.putImageData(d, margem, margem);
  return canvas;
}

type Trabalhador = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

async function palavrasDa(worker: Trabalhador, imagem: HTMLCanvasElement): Promise<{ palavras: Palavra[]; texto: string }> {
  const { data } = await worker.recognize(imagem, {}, { blocks: true, text: true });
  const W = imagem.width, H = imagem.height;
  const palavras: Palavra[] = [];
  for (const bloco of data.blocks ?? []) {
    for (const par of bloco.paragraphs) {
      for (const linha of par.lines) {
        for (const w of linha.words) {
          palavras.push({ t: w.text, c: w.confidence, x0: w.bbox.x0 / W, x1: w.bbox.x1 / W, y0: w.bbox.y0 / H, y1: w.bbox.y1 / H });
        }
      }
    }
  }
  return { palavras, texto: data.text ?? "" };
}

/**
 * Lê a foto da tela de tendências. `avancar` recebe de 0 a 1, para a barra
 * de "Lendo a foto…".
 */
export async function lerFotoDoMonitor(arquivo: Blob, avancar: (fracao: number) => void = () => {},
  /** Para conferir a leitura: cada célula recortada e o que o OCR leu nela. */
  espiar?: (celula: Celula, recortada: HTMLCanvasElement, lido: string) => void): Promise<LinhaDoMonitor[]> {
  const bitmap = await createImageBitmap(arquivo);
  const original = desenhar(bitmap, bitmap.width, bitmap.height, LADO_DOS_RECORTES, 1600);
  bitmap.close();
  // Endireitada antes de tudo: torta, a linha da tabela vira duas.
  const cheia = endireitada(original, inclinacao(original));
  const menor = desenhar(cheia.canvas, cheia.largura, cheia.altura, LADO_DA_LEITURA, LADO_DA_LEITURA);

  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("por");
  try {
    avancar(0.1);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const crua = await palavrasDa(worker, menor.canvas);
    avancar(0.35);
    const limpa = await palavrasDa(worker, tratada(menor));
    avancar(0.55);
    const juntas = juntarPalavras(crua.palavras, limpa.palavras);
    espiar?.({ id: "palavras", caixa: { x0: 0, y0: 0, x1: 1, y1: 1 }, alfabeto: "numero", primeiraLeitura: "" }, menor.canvas, JSON.stringify(juntas));
    let plano = planejar(juntas);
    if (plano?.rotulosDuvidosos) {
      // Os nomes da margem que a foto inteira não leu: relidos, e o plano refeito.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: ALFABETOS.rotulo });
      const rotulos: Record<string, string[]> = {};
      for (const c of plano.rotulosDuvidosos) {
        rotulos[c.id] = [];
        for (const modo of ["cinza", "pb"] as const) {
          const imagem = recorte(cheia, c.caixa, modo, "rotulo");
          const texto = (await worker.recognize(imagem)).data.text.trim();
          espiar?.(c, imagem, `${modo}: ${texto}`);
          rotulos[c.id].push(texto);
          if (leituraBoa("rotulo", texto)) break;
        }
      }
      plano = planejar(juntas, rotulos);
    }
    if (!plano) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      return lerTendencias((await worker.recognize(menor.canvas)).data.text);
    }

    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    const lidos: Record<string, string[]> = {};
    const porAlfabeto = new Map<Alfabeto, Celula[]>();
    for (const c of plano.celulas) porAlfabeto.set(c.alfabeto, [...(porAlfabeto.get(c.alfabeto) ?? []), c]);
    let feitas = 0;
    for (const [alfabeto, celulas] of porAlfabeto) {
      await worker.setParameters({ tessedit_char_whitelist: ALFABETOS[alfabeto] });
      for (const c of celulas) {
        // Em cinza primeiro; se não bate com a foto inteira, em preto e
        // branco; se as leituras ainda não se confirmam, espaçado. `montar`
        // fica com o valor lido mais vezes.
        const lidas: string[] = [];
        let viuSelo = false;
        const chaves = [chaveDaLeitura(alfabeto, c.primeiraLeitura)];
        for (const modo of ["cinza", "pb", "espacado"] as const) {
          const imagem = recorte(cheia, c.caixa, modo, alfabeto);
          viuSelo ||= comSelo.has(imagem);
          const bruto = (await worker.recognize(imagem)).data.text.trim();
          // No espaçado, o vão não é espaço de verdade.
          const texto = modo === "espacado" ? bruto.replace(/\s+/g, "") : bruto;
          lidas.push(texto);
          espiar?.(c, imagem, `${modo}: ${texto}`);
          const chave = chaveDaLeitura(alfabeto, texto);
          if (leituraBoa(alfabeto, texto) && chaves.includes(chave)) break;
          chaves.push(chave);
        }
        // Empate entre dois valores que fazem sentido ("86" e "88"): mais
        // leituras, com a letra menor e maior, até um ganhar.
        const empate = () => {
          const conta = new Map<string, number>();
          for (const t of [c.primeiraLeitura, ...lidas]) {
            const k = leituraBoa(alfabeto, t) ? chaveDaLeitura(alfabeto, t) : null;
            if (k) conta.set(k, (conta.get(k) ?? 0) + 1);
          }
          const [a = 0, b = 0] = [...conta.values()].sort((x, y) => y - x);
          return conta.size >= 2 && a === b;
        };
        for (const [modo, altura] of [["cinza", 72], ["cinza", 128], ["pb", 128]] as const) {
          if (!empate()) break;
          const imagem = recorte(cheia, c.caixa, modo, alfabeto, { altura });
          const texto = (await worker.recognize(imagem)).data.text.trim();
          lidas.push(texto);
          espiar?.(c, imagem, `${modo} ${altura}: ${texto}`);
        }
        lidos[c.id] = lidas.filter(Boolean);
        if (!lidos[c.id].length && viuSelo) lidos[c.id] = [SELO_ILEGIVEL];
        avancar(0.55 + (0.45 * ++feitas) / plano.celulas.length);
      }
    }
    return montar(plano, lidos);
  } finally {
    await worker.terminate();
  }
}
