"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/utils/supabase/client";
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
  // O questionário só é anunciado quando o banco já tem as funções dele
  // (migração 202611100001). Lista vazia não lê nada: só confirma que existe.
  const [questionarioPronto, setQuestionarioPronto] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o visto é do aparelho, só existe depois de montar
    setPronto(true);
    let vivo = true;
    void createClient().rpc("situacao_dos_questionarios", { p_patient_ids: [] })
      .then(({ error }) => { if (vivo) setQuestionarioPronto(!error); });
    return () => { vivo = false; };
  }, []);
  if (!pronto) return null;

  const n = novidadeDaArea(area, hoje(), (id) => dispensadas.includes(id) || jaViu(perfilId, id), undefined,
    (requisito) => requisito === "questionario-pre" && questionarioPronto);
  if (!n) return null;

  const entendi = () => {
    try { window.localStorage.setItem(chaveDaNovidade(perfilId, n.id), "1"); } catch { /* segue só nesta visita */ }
    setDispensadas((d) => [...d, n.id]);
  };

  return (
    <aside className="novidadePainel" aria-labelledby={titulo}>
      <span className="novidadeIcone" aria-hidden="true"><Icone nome="whatsapp" tamanho={22} /></span>
      <div className="novidadeTexto">
        {/* O rótulo sai quando o próprio título já anuncia a novidade. */}
        {!/novidade/i.test(n.titulo) && <small>Novidade</small>}
        <strong id={titulo}>{n.titulo}</strong>
        <p>{n.textoDaArea}</p>
        {n.itens && n.itens.length > 0 && (
          <ul className="novidadeItens">
            {n.itens.map((i) => (
              <li key={i.rotulo}>
                <Icone nome="confirmado" tamanho={15} />
                <span><b>{i.rotulo}:</b> {i.texto}</span>
              </li>
            ))}
          </ul>
        )}
        {n.assinatura && <p className="novidadeAssinatura">{n.assinatura}</p>}
      </div>
      <button type="button" className="outlineClinical" onClick={entendi}>Entendi</button>
    </aside>
  );
}
