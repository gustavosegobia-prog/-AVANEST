"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { folhasProntas } from "./registro-que-enche";
import { compartilharPdf, ehIOS, pdfDaFicha } from "./pdf-da-ficha";

// IMPRIMIR SEM SAIR DA FICHA.
//
// Antes "Imprimir" abria a página de impressão numa aba nova — no aplicativo
// instalado, uma janela nova, com a abertura da marca tocando de novo — e lá
// ainda era preciso apertar "Imprimir ou salvar PDF". Agora a página de
// impressão carrega escondida aqui mesmo e o navegador já abre a janela de
// imprimir / salvar PDF por cima da ficha.
//
// No iPhone e no iPad a janela de imprimir não serve: o Safari imprime a
// página de cima, e o aplicativo instalado na tela de início nem abre a
// janela. Ali a folha escondida vira um PDF no próprio aparelho e sobe o menu
// de compartilhar do iOS — Imprimir, Salvar em Arquivos, WhatsApp
// (pdf-da-ficha.ts). O menu só abre logo depois de um toque: se o PDF demorou
// e o iOS recusar, o botão vira "Abrir PDF" e o próximo toque abre na hora.

type Estado = "pronto" | "preparando" | "pdf";

export function ImprimirFicha({ id, className, rotulo, children, aguardar = false, verso = false }: {
  id: string;
  /** O verso (consumo) em vez da frente: é outra folha, impressa só quando pedida. */
  verso?: boolean;
  className?: string;
  /** Para leitor de tela, quando o botão só mostra um ícone. */
  rotulo?: string;
  children: React.ReactNode;
  /** Lançamentos ainda subindo: o papel sai do servidor, então espera. */
  aguardar?: boolean;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("pronto");
  const quadro = useRef<HTMLIFrameElement | null>(null);
  const arquivo = useRef<File | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => () => quadro.current?.remove(), []);
  const endereco = `/evolucao/${id}/imprimir${verso ? "?verso=1" : ""}`;
  const comAuto = `${endereco}${verso ? "&" : "?"}auto=1`;

  // A página de impressão, carregada fora da vista, com as folhas já
  // ajustadas. Recusa se ela não carregou aqui dentro (sessão expirada, erro).
  function folhaEscondida() {
    quadro.current?.remove();
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.title = "Ficha para imprimir";
    // Fora da vista, mas com a largura da área útil do A4 (196 mm): a folha
    // se monta como na impressora, e é ali que ela mede quanto o gráfico
    // pode crescer. Uma janela de tamanho zero caía nas regras de celular.
    f.style.cssText = "position:fixed;left:-10000px;top:0;width:196mm;height:1200px;border:0;pointer-events:none";
    quadro.current = f;
    return new Promise<Window>((resolver, recusar) => {
      f.onload = async () => {
        const janela = f.contentWindow;
        try {
          if (!janela?.document.querySelector(".imprFolha")) throw new Error("sem folha");
        } catch (erro) { recusar(erro); return; }
        // A fonte e as imagens precisam estar prontas, ou o papel sai na
        // fonte de reserva. E cada folha esticar o gráfico até o rodapé
        // (registro-que-enche.tsx).
        try { await janela.document.fonts?.ready; } catch { /* segue assim mesmo */ }
        try { await folhasProntas(janela.document); } catch { /* segue assim mesmo */ }
        resolver(janela);
      };
      f.onerror = () => recusar(new Error("não carregou"));
      f.src = endereco;
      document.body.appendChild(f);
    });
  }

  async function abrirPdf(pdf: File) {
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
    if (estado === "pdf" && arquivo.current) { void abrirPdf(arquivo.current); return; }
    if (estado !== "pronto") return;
    setEstado("preparando");
    const ios = ehIOS();
    let janela: Window;
    try {
      janela = await folhaEscondida();
    } catch {
      // Abre a própria página de impressão, que tem o botão de imprimir.
      setEstado("pronto");
      router.push(ios ? endereco : comAuto);
      return;
    }

    if (ios) {
      let pdf: File;
      try {
        pdf = await pdfDaFicha(janela.document);
      } catch {
        setEstado("pronto");
        router.push(endereco);
        return;
      } finally {
        quadro.current?.remove();
        quadro.current = null;
      }
      await abrirPdf(pdf);
      return;
    }

    setEstado("pronto");
    try {
      janela.focus();
      janela.print();
    } catch {
      router.push(comAuto);
    }
  }

  return (
    <>
      <button ref={botao} type="button" className={className} onClick={imprimir}
        disabled={estado === "preparando" || aguardar} aria-busy={estado === "preparando"}
        aria-label={estado === "pronto" ? rotulo : undefined}
        title={aguardar ? "Espere os lançamentos salvarem: o papel sai do que está no servidor." : undefined}>
        {estado === "preparando" ? "Preparando…" : estado === "pdf" ? "Abrir PDF" : children}
      </button>
      <span className="sr-only" role="status">{estado === "pdf" ? "PDF da ficha pronto. Toque em Abrir PDF para imprimir ou salvar." : ""}</span>
    </>
  );
}
