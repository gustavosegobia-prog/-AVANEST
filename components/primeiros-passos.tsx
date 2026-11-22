"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Icone } from "@/components/icone";
import type { Passo } from "@/lib/primeiros-passos";

// O cartão dos primeiros passos (lib/primeiros-passos.ts). Cada passo leva ao
// lugar de fazê-lo; feito, ele aparece riscado. "Fechar" esconde neste
// aparelho — a lista some sozinha quando os passos acabam ou o mês passa.

const CHAVE = "avanest:primeiros-passos-fechado";

// Lido do aparelho sem efeito: no servidor (e no primeiro quadro) o cartão vem
// fechado, para não piscar aberto em quem já o fechou.
function assinar(avisar: () => void) {
  window.addEventListener("storage", avisar);
  return () => window.removeEventListener("storage", avisar);
}
function fechadoNoAparelho(): boolean {
  try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; }
}

export function PrimeirosPassos({ passos, onIrPara }: {
  passos: Passo[];
  onIrPara: (area: "plantoes" | "medico" | "admin") => void;
}) {
  const fechadoAntes = useSyncExternalStore(assinar, fechadoNoAparelho, () => true);
  const [fechadoAgora, setFechadoAgora] = useState(false);
  if (fechadoAntes || fechadoAgora) return null;
  const feitos = passos.filter((p) => p.feito).length;

  return (
    <section className="primeirosPassos" aria-labelledby="primeiros-passos-titulo">
      <header>
        <div>
          <h2 id="primeiros-passos-titulo">Primeiros passos</h2>
          <p>{feitos} de {passos.length} feitos. Cada um se marca sozinho quando você faz.</p>
        </div>
        <button type="button" className="primeirosPassosFechar" aria-label="Fechar os primeiros passos"
          onClick={() => { setFechadoAgora(true); try { localStorage.setItem(CHAVE, "1"); } catch { /* sem armazenamento: só fecha agora */ } }}>
          <Icone nome="fechar" tamanho={16} />
        </button>
      </header>
      <ol>
        {passos.map((p) => {
          const conteudo = (
            <>
              <span className="primeirosPassosMarca" aria-hidden="true">{p.feito ? <Icone nome="confirmado" tamanho={14} /> : null}</span>
              <span><b>{p.titulo}</b><small>{p.detalhe}</small></span>
            </>
          );
          return (
            <li key={p.chave} className={p.feito ? "feito" : undefined}>
              {"href" in p.destino
                ? <Link href={p.destino.href} aria-label={`${p.titulo}${p.feito ? " (feito)" : ""}`}>{conteudo}</Link>
                : (
                  <button type="button" onClick={() => onIrPara((p.destino as { area: "plantoes" | "medico" | "admin" }).area)}
                    aria-label={`${p.titulo}${p.feito ? " (feito)" : ""}`}>{conteudo}</button>
                )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
