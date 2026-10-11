"use client";

import { useState } from "react";

const escrever = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
const ler = (texto: string) => (texto.trim() === "" ? null : Number(texto.replace(",", ".")));

/**
 * Peso e altura: o texto fica como digitado ("70," no meio da vírgula) e o
 * número só é gravado quando é um valor possível. Se o valor muda por fora
 * (desfazer, recarregar), o campo acompanha.
 */
export function CampoDecimal({ valor, max, onMudar, rotulo, leitura }: {
  valor: number | null; max: number; onMudar: (v: number | null) => void; rotulo: string; leitura: boolean;
}) {
  const [texto, setTexto] = useState(escrever(valor));
  const [anterior, setAnterior] = useState(valor);
  if (valor !== anterior) {
    setAnterior(valor);
    if (ler(texto) !== valor) setTexto(escrever(valor));
  }
  return (
    <input inputMode="decimal" value={texto} disabled={leitura} aria-label={rotulo}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = ler(e.target.value);
        if (n === null) onMudar(null);
        else if (Number.isFinite(n) && n > 0 && n <= max) onMudar(n);
      }} />
  );
}
