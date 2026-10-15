"use client";

import estilos from "./calculos.module.css";

// O campo e a leitura de número da calculadora de doses. Nenhuma conta aqui:
// tudo vem de lib/calculos.

/**
 * Os dados do paciente (idade, peso, altura, sexo). Descem por props, então o
 * que foi digitado no manejo de crises já aparece na calculadora — sempre
 * visível e editável, nunca aplicado às escondidas.
 */
export type Compartilhado = Record<string, string>;

export const numero = (texto: string): number | undefined => {
  const limpo = (texto ?? "").replace(",", ".").trim();
  if (!limpo) return undefined;
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : undefined;
};

export function Campo({
  chave, rotulo, valor, aoMudar, passo = "1", tipo = "text",
}: {
  chave: string; rotulo: string; valor: string;
  aoMudar: (chave: string, valor: string) => void;
  passo?: string; tipo?: string;
}) {
  return (
    <label className={estilos.campo}>
      <span>{rotulo}</span>
      <input type={tipo} inputMode="decimal" step={passo} value={valor}
        onChange={(e) => aoMudar(chave, e.target.value)} />
    </label>
  );
}
