"use client";

import { useEffect } from "react";
import { folhasProntas } from "./registro-que-enche";

// Aberta com `?auto=1` (o caminho do iPhone e do iPad, ver imprimir-ficha.tsx),
// a página de impressão já sobe a janela de imprimir / salvar PDF, quando a
// fonte estiver pronta.
export function ImprimirAoAbrir() {
  useEffect(() => {
    let vale = true;
    (document.fonts?.ready ?? Promise.resolve())
      .then(() => folhasProntas(document))
      .then(() => { if (vale) setTimeout(() => window.print(), 150); });
    return () => { vale = false; };
  }, []);
  return null;
}
