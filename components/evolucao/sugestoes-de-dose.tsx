"use client";

import type { Sugestao, SugestoesDaFicha } from "@/lib/evolucao/sugestoes";

// As doses da tabela, prontas para tocar (lib/evolucao/sugestoes.ts).
//
// Um toque PREENCHE a dose — não registra. O número fica no campo, editável,
// e o médico confirma. A fonte vai embaixo, sempre: é o que diz de onde o
// número veio.
//
// O botão diz a dose por kg ("0,05 mg/kg"), e não "Mínima" e "Máxima": as
// pontas da faixa de uma dose da tabela não são o limite do total. Chamada de
// "Máxima", a ponta de cima de uma sedação titulada (midazolam 0,05 mg/kg)
// parecia proibir os 5 mg que o anestesiologista fez em doses repetidas.

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function SugestoesDeDose({ sugestoes, pesoKg, escolhida, mostrarVia = false, onEscolher }: {
  sugestoes: SugestoesDaFicha;
  pesoKg: number | null;
  /** A dose que está no campo agora: o botão dela aparece marcado. */
  escolhida?: number | null;
  /** Na janela completa, a via pode mudar: cada cartão diz a dele. */
  mostrarVia?: boolean;
  onEscolher: (s: Sugestao) => void;
}) {
  const { cartoes, tetos, aviso, rotulo } = sugestoes;
  if (!cartoes.length && !tetos.length && !aviso) return null;
  const fontes = [...new Set([...cartoes.map((c) => c.fonte), ...tetos.map((t) => t.fonte)].filter(Boolean))];
  return (
    <div className="evoSugestoes">
      <p className="evoSugTopo">
        Dose sugerida{rotulo ? ` · ${rotulo}` : ""}{pesoKg !== null ? ` · ${fmt(pesoKg)} kg` : ""}
      </p>
      {cartoes.map((c) => (
        <div key={c.titulo} className="evoSugCartao">
          <p className="evoSugTitulo">
            <b>{c.titulo}</b>
            {c.indicacao && <span> — {c.indicacao}</span>}
            <small>{c.base}{mostrarVia ? ` · ${c.via}` : ""}</small>
          </p>
          <div className="evoSugDoses">
            {c.doses.map((d) => (
              <button key={d.chave} type="button" aria-pressed={escolhida === d.dose}
                aria-label={`Usar ${fmt(d.dose)} ${d.unidade} (${d.base})`}
                onClick={() => onEscolher(d)}>
                <b>{fmt(d.dose)} {d.unidade}</b>
                <small>{d.base}{d.limitada ? " · teto" : ""}</small>
              </button>
            ))}
          </div>
          {c.observacao && <p className="evoSugObs">{c.observacao}</p>}
        </div>
      ))}
      {tetos.map((t) => (
        <p key={t.titulo} className="evoSugTeto">
          <b>{t.titulo}:</b> no máximo {fmt(t.dose)} {t.unidade} ({t.base}).
        </p>
      ))}
      {aviso && <p className="evoSugAviso">{aviso}</p>}
      {fontes.length > 0 && (
        <p className="evoSugFonte">{fontes.join(" · ")}. Confira contra a ampola e o protocolo do serviço.</p>
      )}
    </div>
  );
}
