"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { folhasProntas } from "./registro-que-enche";

// IMPRIMIR SEM SAIR DA FICHA.
//
// Antes "Imprimir" abria a página de impressão numa aba nova — no aplicativo
// instalado, uma janela nova, com a abertura da marca tocando de novo — e lá
// ainda era preciso apertar "Imprimir ou salvar PDF". Agora a página de
// impressão carrega escondida aqui mesmo e o navegador já abre a janela de
// imprimir / salvar PDF por cima da ficha.
//
// No iPhone e no iPad o Safari imprime a página de cima, e não a escondida:
// ali a impressão abre na mesma aba e a janela de imprimir sobe sozinha
// (`?auto=1`, components/evolucao/imprimir-ao-abrir.tsx).
const ehIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function ImprimirFicha({ id, className, rotulo, children, aguardar = false }: {
  id: string;
  className?: string;
  /** Para leitor de tela, quando o botão só mostra um ícone. */
  rotulo?: string;
  children: React.ReactNode;
  /** Lançamentos ainda subindo: o papel sai do servidor, então espera. */
  aguardar?: boolean;
}) {
  const router = useRouter();
  const [preparando, setPreparando] = useState(false);
  const quadro = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => quadro.current?.remove(), []);

  function imprimir() {
    const endereco = `/evolucao/${id}/imprimir`;
    if (ehIOS()) { router.push(`${endereco}?auto=1`); return; }
    if (preparando) return;
    setPreparando(true);
    quadro.current?.remove();
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.tabIndex = -1;
    f.title = "Ficha para imprimir";
    // Fora da vista, mas com a largura da área útil do A4 (196 mm): a folha
    // se monta como na impressora, e é ali que ela mede quanto o gráfico
    // pode crescer. Uma janela de tamanho zero caía nas regras de celular.
    f.style.cssText = "position:fixed;left:-10000px;top:0;width:196mm;height:1200px;border:0;pointer-events:none";
    f.onload = async () => {
      const janela = f.contentWindow;
      // A fonte e as imagens precisam estar prontas, ou o papel sai na fonte
      // de reserva.
      try { await janela?.document.fonts?.ready; } catch { /* imprime assim mesmo */ }
      // E cada folha esticar o gráfico até o rodapé (registro-que-enche.tsx).
      try { if (janela) await folhasProntas(janela.document); } catch { /* imprime assim mesmo */ }
      setPreparando(false);
      try {
        janela!.focus();
        janela!.print();
      } catch {
        // A página não carregou aqui dentro (sessão expirada, erro): abre ela
        // mesma, que já sobe a janela de imprimir.
        router.push(`${endereco}?auto=1`);
      }
    };
    f.src = endereco;
    document.body.appendChild(f);
    quadro.current = f;
  }

  return (
    <button type="button" className={className} onClick={imprimir} disabled={preparando || aguardar}
      aria-busy={preparando} aria-label={rotulo}
      title={aguardar ? "Espere os lançamentos salvarem: o papel sai do que está no servidor." : undefined}>
      {preparando ? "Preparando…" : children}
    </button>
  );
}
