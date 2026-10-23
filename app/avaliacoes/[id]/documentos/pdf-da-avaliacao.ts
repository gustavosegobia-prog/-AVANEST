"use client";

// O PDF DA FICHA DE AVALIAÇÃO, MONTADO A PARTIR DA FOLHA QUE JÁ ESTÁ NA TELA.
//
// É o PDF que vai por e-mail ao prontuário do hospital. A ficha da tela de
// documentos já tem o desenho do papel; aqui ela é desenhada numa imagem e
// posta em páginas A4, como faz o PDF da ficha anestésica no iPhone
// (components/evolucao/pdf-da-ficha.ts).
//
// O DESENHO É FEITO NUMA CÓPIA, COM LARGURA FIXA. Na tela do celular a folha
// encolhe e ganha rolagem; no computador ela ocupa o que sobra ao lado da
// barra lateral. Sem fixar, o PDF sairia com uma cara diferente para cada
// aparelho. A cópia é desenhada como num monitor largo, e o original na tela
// não muda.

const A4 = { largura: 210, altura: 297 };
const LARGURA_DA_FOLHA = 900; // px, a folha como aparece num monitor comum
const JANELA = 1400;          // px, para valer o CSS de computador na cópia

async function desenhar(folha: HTMLElement, escala: number) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const tela = await html2canvas(folha, {
    scale: escala,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: JANELA,
    onclone: (_copia, el) => {
      // Desmarcada para impressão, a folha aparece apagada na tela; no PDF do
      // prontuário ela vai sempre inteira.
      el.classList.remove("notSelected");
      Object.assign(el.style, {
        width: `${LARGURA_DA_FOLHA}px`, maxWidth: "none", minHeight: "0",
        boxShadow: "none", border: "0", borderRadius: "0", margin: "0",
        opacity: "1", filter: "none", overflow: "visible",
      });
    },
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const margem = 7; // mm, a mesma do @page da impressão
  const largura = A4.largura - 2 * margem;
  const alturaUtil = A4.altura - 2 * margem;
  // Quantos pixels do desenho cabem numa página.
  const fatia = Math.floor(tela.width * (alturaUtil / largura));

  for (let topo = 0, pagina = 0; topo < tela.height; topo += fatia, pagina++) {
    const altura = Math.min(fatia, tela.height - topo);
    const pedaco = document.createElement("canvas");
    pedaco.width = tela.width;
    pedaco.height = altura;
    const ctx = pedaco.getContext("2d");
    if (!ctx) throw new Error("O navegador não deixou desenhar o PDF.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pedaco.width, pedaco.height);
    ctx.drawImage(tela, 0, topo, tela.width, altura, 0, 0, tela.width, altura);
    if (pagina > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(pedaco.toDataURL("image/jpeg", 0.85), "JPEG", margem, margem, largura, (altura / tela.width) * largura, undefined, "FAST");
    pedaco.width = 0;
  }
  tela.width = 0; // devolve a memória do desenho já
  return pdf.output("datauristring");
}

/**
 * O PDF da ficha, em data URI base64.
 *
 * Se sair maior do que o servidor aceita (ficha muito longa), tenta de novo
 * com menos resolução antes de desistir.
 */
export async function pdfDaAvaliacao(limiteBytes: number): Promise<string> {
  const folha = document.querySelector<HTMLElement>("article.assessmentPaper");
  if (!folha) throw new Error("A ficha não está na tela.");
  for (const escala of [2, 1.4]) {
    const uri = await desenhar(folha, escala);
    const bytes = Math.floor((uri.length - uri.indexOf(",") - 1) * 0.75);
    if (bytes <= limiteBytes) return uri;
  }
  throw new Error("A ficha ficou grande demais para enviar por e-mail.");
}
