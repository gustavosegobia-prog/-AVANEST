// As peças da ficha de papel, para a tela e para a impressão.
//
// O "○" que se marca e o "____" em que se escreve. Na tela são um botão e um
// campo; impressos, a bolinha (cheia quando marcada) e o texto sobre a linha.
// Sem estado: servem à folha na tela (cliente) e à folha impressa (servidor).

import type { ReactNode } from "react";

/** Tela (editável ou só leitura) ou papel impresso. */
export type Modo = { impresso: boolean; leitura: boolean };

/** O "○" do papel: um toque marca, outro desmarca. */
export function Op({ m, marcado, rotulo, onClick }: { m: Modo; marcado: boolean; rotulo: string; onClick: () => void }) {
  const bola = <i aria-hidden="true">{marcado ? "◉" : "○"}</i>;
  if (m.impresso) return <span className={`evoOp${marcado ? " marcado" : ""}`}>{bola}{rotulo}</span>;
  return (
    <button type="button" className={`evoOp${marcado ? " marcado" : ""}`} aria-pressed={marcado} disabled={m.leitura} onClick={onClick}>
      {bola}{rotulo}
    </button>
  );
}

/** O "____" do papel: um campo curto na própria linha. */
export function Linha({ m, valor, onMudar, largura = 6, rotulo, sufixo, numerico, sugestoes }: {
  m: Modo; valor: string; onMudar: (v: string) => void; largura?: number; rotulo: string;
  sufixo?: string; numerico?: boolean; sugestoes?: string;
}) {
  return (
    <label className="evoLinhaCampo">
      {m.impresso ? (
        <span className="valor" style={{ minWidth: `${largura}ch` }}>{valor}</span>
      ) : (
        <input value={valor} onChange={(e) => onMudar(e.target.value)} disabled={m.leitura} aria-label={rotulo}
          style={{ width: `${largura + 1.5}ch` }} inputMode={numerico ? "decimal" : undefined} list={sugestoes} />
      )}
      {sufixo && <span>{sufixo}</span>}
    </label>
  );
}

/** Texto impresso entre as opções ("L", "VM:", "e"…). */
export const Txt = ({ children }: { children: ReactNode }) => <span className="evoRTexto">{children}</span>;
