"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { padroesDaBusca } from "@/lib/honorarios-telas";
import type { Codigo } from "./calculo-da-anestesia";
import estilos from "./honorarios.module.css";

// Escolher os códigos TUSS de um procedimento: a busca na TUSS em uso e a
// lista do que foi escolhido, na ordem do cálculo. A gaveta do honorário e a
// lista de procedimentos da clínica usam as duas peças.

/**
 * A busca na TUSS em uso: o começo do código, ou um pedaço da descrição. O
 * texto fica com quem usa (a gaveta começa a busca pelo procedimento da
 * ficha); escolher um código chama `onEscolher` e a lista se fecha.
 */
export function BuscaNaTuss({
  tussId, busca, onBusca, onEscolher, rotulo = "Buscar código TUSS",
}: {
  tussId: string | null | undefined;
  busca: string;
  onBusca: (texto: string) => void;
  onEscolher: (c: Codigo) => void;
  rotulo?: string;
}) {
  const [achados, setAchados] = useState<Codigo[]>([]);

  useEffect(() => {
    const termo = busca.trim();
    if (!tussId || termo.length < 3) return;
    let valendo = true;
    const espera = setTimeout(async () => {
      const base = () => createClient().from("tuss_codigos").select("codigo, descricao").eq("versao_id", tussId).eq("situacao", "ativo");
      let achados: Codigo[] = [];
      if (/^[\d.\s-]+$/.test(termo)) {
        const { data } = await base().like("codigo", `${termo.replace(/\D/g, "")}%`).order("codigo").limit(8);
        achados = (data ?? []) as Codigo[];
      } else {
        // Todas as palavras primeiro; sem resultado, com uma palavra a menos.
        const padroes = padroesDaBusca(termo);
        for (let n = padroes.length; n > 0 && !achados.length && valendo; n--) {
          let q = base();
          for (const p of padroes.slice(0, n)) q = q.ilike("descricao", p);
          const { data } = await q.order("codigo").limit(8);
          achados = (data ?? []) as Codigo[];
        }
      }
      if (valendo) setAchados(achados);
    }, 250);
    return () => { valendo = false; clearTimeout(espera); };
  }, [busca, tussId]);

  return <>
    <label className="admBusca">
      <span className="sr-only">{rotulo}</span>
      <Icone nome="busca" tamanho={16} />
      <input type="search" value={busca} onChange={(e) => onBusca(e.target.value)} disabled={!tussId}
        placeholder="Código TUSS ou nome do procedimento" />
    </label>
    {busca.trim().length >= 3 && achados.length > 0 && (
      <ul className={estilos.achados} aria-label="Códigos encontrados: escolha para acrescentar">
        {achados.map((c) => (
          <li key={c.codigo}>
            <button type="button" onClick={() => { onEscolher(c); onBusca(""); setAchados([]); }}>
              <span className={estilos.codigo}>{c.codigo}</span><span>{c.descricao}</span>
            </button>
          </li>
        ))}
      </ul>
    )}
  </>;
}

/** Os códigos escolhidos, o principal primeiro: subir muda a ordem do cálculo. */
export function CodigosEscolhidos({ codigos, onMudar }: { codigos: Codigo[]; onMudar: (novos: Codigo[]) => void }) {
  function subir(i: number) {
    const novos = [...codigos];
    [novos[i - 1], novos[i]] = [novos[i], novos[i - 1]];
    onMudar(novos);
  }
  return (
    <ol className={estilos.codigosEscolhidos}>
      {codigos.map((c, i) => (
        <li key={c.codigo}>
          <span className={estilos.codigo}>{c.codigo}</span>
          <span>{c.descricao || "—"}</span>
          <span className={estilos.acoesDoCodigo}>
            {i > 0 && (
              <button type="button" className={`outlineClinical compacto ${estilos.comIcone}`}
                aria-label={`Subir ${c.codigo} para ${i}º`} onClick={() => subir(i)}>
                <Icone nome="subir" tamanho={14} /> Subir
              </button>
            )}
            <button type="button" className="outlineClinical compacto" aria-label={`Remover ${c.codigo}`}
              onClick={() => onMudar(codigos.filter((x) => x.codigo !== c.codigo))}>Remover</button>
          </span>
        </li>
      ))}
    </ol>
  );
}
