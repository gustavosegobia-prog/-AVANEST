"use client";

import { useRef, useState } from "react";
import { folhasProntas } from "./registro-que-enche";
import { compartilharPdf, ehIOS, pdfDaFicha } from "./pdf-da-ficha";

// O botão da página de impressão. No computador e no Android, a janela de
// imprimir do navegador. No iPhone e no iPad, que não imprimem por ali, o PDF
// da folha e o menu de compartilhar (pdf-da-ficha.ts) — com o mesmo segundo
// toque de imprimir-ficha.tsx quando o iOS pede.
export function BotaoImprimirFolha({ className }: { className?: string }) {
  const [estado, setEstado] = useState<"pronto" | "preparando" | "pdf">("pronto");
  const arquivo = useRef<File | null>(null);
  const botao = useRef<HTMLButtonElement>(null);

  async function abrir(pdf: File) {
    if (await compartilharPdf(pdf) === "precisa-de-toque") {
      arquivo.current = pdf;
      setEstado("pdf");
      botao.current?.focus();
      return;
    }
    arquivo.current = null;
    setEstado("pronto");
  }

  async function imprimir() {
    if (!ehIOS()) { window.print(); return; }
    if (estado === "pdf" && arquivo.current) { void abrir(arquivo.current); return; }
    if (estado !== "pronto") return;
    setEstado("preparando");
    try {
      await folhasProntas(document);
      await abrir(await pdfDaFicha(document));
    } catch {
      setEstado("pronto");
      window.print();
    }
  }

  return (
    <>
      <button ref={botao} type="button" className={className} onClick={imprimir}
        disabled={estado === "preparando"} aria-busy={estado === "preparando"}>
        {estado === "preparando" ? "Preparando PDF…" : estado === "pdf" ? "Abrir PDF" : "Imprimir ou salvar PDF"}
      </button>
      <span className="sr-only" role="status">{estado === "pdf" ? "PDF da ficha pronto. Toque em Abrir PDF para imprimir ou salvar." : ""}</span>
    </>
  );
}
