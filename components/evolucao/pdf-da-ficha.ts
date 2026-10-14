"use client";

// O PDF DA FICHA, PARA O IPHONE E O IPAD.
//
// No aplicativo instalado na tela de início do iPhone, `window.print()` não faz
// nada, e abrir a página de impressão demorava. Aqui a folha que já está pronta
// (a página de impressão carregada escondida, com o gráfico esticado até o
// rodapé) vira um PDF A4 no próprio aparelho, e o menu de compartilhar do iOS
// abre com ele: "Imprimir", "Salvar em Arquivos", AirDrop, WhatsApp.
//
// As duas bibliotecas são pesadas e só o iOS usa: carregam na hora.

const A4 = { largura: 210, altura: 297 };
// 2,5 × 96 dpi ≈ 240 dpi: letra de 6 pt nítida no papel, e o desenho de cada
// folha (≈ 2000 × 2800 px) bem abaixo do limite de memória do Safari.
const ESCALA = 2.5;

function nomeDoArquivo(paciente: string) {
  const base = paciente
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ").slice(0, 3).join("-").toLowerCase();
  return `ficha-anestesica${base ? `-${base}` : ""}.pdf`;
}

// O desenhista do PDF não conhece texto em pé (`writing-mode`): a tira
// "Avaliação Pré-Anestésica" e a "Técnica" saíam deitadas, fora da folha. Na
// cópia que ele desenha, cada uma vira um SVG do mesmo tamanho com o texto
// girado — o que ele desenha bem, como o gráfico.
function textoEmPeComoDesenho(folha: HTMLElement) {
  const doc = folha.ownerDocument;
  const janela = doc.defaultView;
  if (!janela) return;
  const NS = "http://www.w3.org/2000/svg";
  for (const el of Array.from(folha.querySelectorAll<HTMLElement>("*"))) {
    const estilo = janela.getComputedStyle(el);
    if (!estilo.writingMode.startsWith("vertical") || el.children.length) continue;
    const { width: l, height: a } = el.getBoundingClientRect();
    if (!l || !a) continue;
    const bruto = (el.textContent ?? "").trim();
    const texto = estilo.textTransform === "uppercase" ? bruto.toLocaleUpperCase("pt-BR") : bruto;
    const svg = doc.createElementNS(NS, "svg");
    svg.setAttribute("width", String(l));
    svg.setAttribute("height", String(a));
    svg.setAttribute("viewBox", `0 0 ${l} ${a}`);
    const t = doc.createElementNS(NS, "text");
    t.setAttribute("x", String(l / 2));
    t.setAttribute("y", String(a / 2));
    t.setAttribute("transform", `rotate(-90 ${l / 2} ${a / 2})`);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "central");
    t.setAttribute("font-family", estilo.fontFamily);
    t.setAttribute("font-size", estilo.fontSize);
    t.setAttribute("font-weight", estilo.fontWeight);
    t.setAttribute("letter-spacing", estilo.letterSpacing === "normal" ? "0" : estilo.letterSpacing);
    t.setAttribute("fill", estilo.color);
    t.textContent = texto;
    svg.appendChild(t);
    Object.assign(el.style, { writingMode: "horizontal-tb", transform: "none", width: `${l}px`, height: `${a}px`, padding: "0" });
    el.replaceChildren(svg);
  }
}

/** Monta o PDF com as folhas de `doc` (uma página A4 por `.imprFolha`). */
export async function pdfDaFicha(doc: Document): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const folhas = Array.from(doc.querySelectorAll<HTMLElement>(".imprFolha"));
  if (!folhas.length) throw new Error("A página de impressão veio sem folha.");

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  for (const [n, folha] of folhas.entries()) {
    const tela = await html2canvas(folha, {
      scale: ESCALA,
      backgroundColor: "#ffffff",
      logging: false,
      // A sombra e a margem da folha são da tela, não do papel.
      onclone: (_copia, el) => { el.style.boxShadow = "none"; el.style.margin = "0"; textoEmPeComoDesenho(el); },
    });
    // A folha da tela já tem a largura do A4 com a margem (196 mm + 2 × 7 mm).
    // Se por algum motivo vier mais alta que a página, cabe pela altura.
    let largura = A4.largura;
    let altura = (tela.height / tela.width) * largura;
    if (altura > A4.altura) { largura *= A4.altura / altura; altura = A4.altura; }
    if (n > 0) pdf.addPage("a4", "portrait");
    pdf.addImage(tela.toDataURL("image/jpeg", 0.88), "JPEG", (A4.largura - largura) / 2, (A4.altura - altura) / 2, largura, altura, undefined, "FAST");
    tela.width = 0; // devolve a memória do desenho já
  }
  const paciente = doc.querySelector<HTMLElement>(".imprFolhas")?.dataset.paciente ?? "";
  return new File([pdf.output("blob")], nomeDoArquivo(paciente), { type: "application/pdf" });
}

/**
 * Abre o menu de compartilhar do iOS com o PDF. Precisa de um toque recente:
 * se o aparelho recusar (`NotAllowedError`), devolve `"precisa-de-toque"` e
 * quem chamou pede mais um toque. `"feito"` também quando a pessoa fecha o
 * menu sem escolher nada.
 */
export async function compartilharPdf(arquivo: File): Promise<"feito" | "precisa-de-toque"> {
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: "Ficha anestésica" });
      return "feito";
    } catch (erro) {
      const nome = (erro as { name?: string } | null)?.name;
      if (nome === "AbortError") return "feito";
      if (nome === "NotAllowedError") return "precisa-de-toque";
      // Qualquer outra recusa: tenta abrir o arquivo.
    }
  }
  // Sem menu de compartilhar com arquivo (iOS antigo): o PDF abre no visualizador,
  // que tem o botão de compartilhar → Imprimir.
  const endereco = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = endereco;
  link.download = arquivo.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(endereco), 60_000);
  return "feito";
}

export const ehIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
