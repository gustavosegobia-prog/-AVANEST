"use client";

import { useEffect, useId, useState } from "react";
import { Icone } from "@/components/icone";
import { hoje } from "@/lib/data-local";
import { chaveDaNovidade, novidadeDaArea } from "@/lib/novidades";

// O aviso de novidade no alto da área (lib/novidades.ts). "Entendi" guarda o
// visto neste aparelho; sem armazenamento (aba anônima), o aviso volta na
// próxima visita, e some sozinho no prazo de qualquer jeito.

function jaViu(perfilId: string, id: string): boolean {
  try { return window.localStorage.getItem(chaveDaNovidade(perfilId, id)) === "1"; } catch { return false; }
}

export function NovidadeNoPainel({ perfilId, area }: { perfilId: string; area: string }) {
  const titulo = useId();
  // Só depois de montar: o visto mora no aparelho, e o servidor não o conhece.
  // Até lá, nada aparece — quem já disse "Entendi" não vê o aviso piscar.
  const [pronto, setPronto] = useState(false);
  const [dispensadas, setDispensadas] = useState<string[]>([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- o visto é do aparelho, só existe depois de montar
  useEffect(() => { setPronto(true); }, []);
  if (!pronto) return null;

  const n = novidadeDaArea(area, hoje(), (id) => dispensadas.includes(id) || jaViu(perfilId, id));
  if (!n) return null;

  const entendi = () => {
    try { window.localStorage.setItem(chaveDaNovidade(perfilId, n.id), "1"); } catch { /* segue só nesta visita */ }
    setDispensadas((d) => [...d, n.id]);
  };

  return (
    <aside className="novidadePainel" aria-labelledby={titulo}>
      <span className="novidadeIcone" aria-hidden="true"><Icone nome="whatsapp" tamanho={22} /></span>
      <div className="novidadeTexto">
        <small>Novidade</small>
        <strong id={titulo}>{n.titulo}</strong>
        <p>{n.textoDaArea}</p>
      </div>
      <button type="button" className="outlineClinical" onClick={entendi}>Entendi</button>
    </aside>
  );
}
