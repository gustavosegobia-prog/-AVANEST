"use client";

import { horaLocal } from "@/lib/data-local";
import { lerDecimal } from "@/lib/numero-clinico";

// Os campos que se repetem em todas as janelas da folha.

/** Horário HH:MM, com "agora" e "−5 min" a um toque — a sala não tem tempo para relógio. */
export function CampoHora({ valor, onMudar, rotulo = "Horário" }: {
  valor: string; onMudar: (v: string) => void; rotulo?: string;
}) {
  const deslocar = (min: number) => {
    const [h, m] = valor.split(":").map(Number);
    if (Number.isNaN(h)) return;
    const total = (h * 60 + m + min + 1440) % 1440;
    onMudar(`${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`);
  };
  return (
    <div className="evoCampo evoCampoHora">
      <label>
        <span>{rotulo}</span>
        <input type="time" value={valor} onChange={(e) => onMudar(e.target.value)} required />
      </label>
      <div className="evoHoraAtalhos">
        <button type="button" onClick={() => deslocar(-5)}>−5 min</button>
        <button type="button" onClick={() => onMudar(horaLocal())}>Agora</button>
      </div>
    </div>
  );
}

/** Número com vírgula ou ponto, teclado numérico no tablet. */
export function CampoNumero({ rotulo, valor, onMudar, unidade, autoFocus, aviso, id }: {
  rotulo: string; valor: string; onMudar: (v: string) => void; unidade?: string;
  autoFocus?: boolean; aviso?: string | null; id?: string;
}) {
  return (
    <label className={`evoCampo${aviso ? " comAviso" : ""}`}>
      <span>{rotulo}</span>
      <span className="evoNumero">
        <input id={id} inputMode="decimal" value={valor} autoFocus={autoFocus}
          onChange={(e) => onMudar(e.target.value.replace(/[^\d.,-]/g, ""))} />
        {unidade && <em>{unidade}</em>}
      </span>
      {aviso && <small role="alert">{aviso}</small>}
    </label>
  );
}

export const numero = (texto: string) => lerDecimal(texto);

/** Opções em botões grandes, uma escolhida. */
export function Escolha<T extends string>({ rotulo, opcoes, valor, onMudar }: {
  rotulo: string; opcoes: Array<{ valor: T; rotulo: string }>; valor: T | ""; onMudar: (v: T) => void;
}) {
  return (
    <fieldset className="evoEscolha">
      <legend>{rotulo}</legend>
      <div>
        {opcoes.map((o) => (
          <button type="button" key={o.valor} aria-pressed={valor === o.valor}
            className={valor === o.valor ? "ativo" : ""} onClick={() => onMudar(o.valor)}>
            {o.rotulo}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Várias escolhidas. */
export function Marcas({ rotulo, opcoes, valores, onMudar }: {
  rotulo: string; opcoes: string[]; valores: string[]; onMudar: (v: string[]) => void;
}) {
  return (
    <fieldset className="evoEscolha">
      <legend>{rotulo}</legend>
      <div>
        {opcoes.map((o) => {
          const ativo = valores.includes(o);
          return (
            <button type="button" key={o} aria-pressed={ativo} className={ativo ? "ativo" : ""}
              onClick={() => onMudar(ativo ? valores.filter((v) => v !== o) : [...valores, o])}>
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
