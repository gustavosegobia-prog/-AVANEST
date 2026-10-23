"use client";

import { useState } from "react";
import { Icone } from "@/components/icone";
import { valorDaCelula } from "@/lib/importar-tabelas";
import estilos from "./honorarios.module.css";

// Peças pequenas que as áreas de "Tabelas e honorários" dividem: datas,
// dinheiro, a etiqueta de situação e a mensagem de erro do banco.

export const dataBr = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

const HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
export const dataHoraBr = (ts: string | null | undefined) => (ts ? HORA.format(new Date(ts)) : "—");

export const dinheiro = (v: number | string | null | undefined) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const percentual = (v: number | string | null | undefined) =>
  v == null || v === "" ? "—" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/**
 * O número que a pessoa digitou: "1.234,56", "1234,5", "-10" ou vazio. Vazio:
 * null. Texto que não é número: NaN. Mesma leitura das planilhas.
 */
export function lerNumero(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const negativo = /^[-−]/.test(t);
  const n = valorDaCelula(negativo ? t.slice(1) : t);
  if (n == null) return n === null && !negativo ? null : NaN;
  return negativo ? -n : n;
}

export type Tom = "ok" | "atencao" | "perigo" | "neutra" | "info";

export function Etiqueta({ tom, children }: { tom: Tom; children: React.ReactNode }) {
  return <span className={`${estilos.etiqueta} ${estilos[`tom_${tom}`]}`}>{children}</span>;
}

/**
 * O erro do banco em português. As travas da migração já falam a língua da
 * clínica ("Versão de contrato publicada não muda…"); o resto é traduzido.
 */
export function mensagemDoBanco(erro: unknown, padrao = "Não foi possível salvar. Tente de novo."): string {
  if (erro instanceof Recusa) return erro.message;
  const e = (erro ?? {}) as { code?: string; message?: string };
  if (e.code === "23505") return "Já existe um cadastro igual a este.";
  if (e.code === "23503") return "Este cadastro está em uso e não pode ser apagado.";
  if (e.code === "42501" || /row-level security/i.test(e.message ?? "")) return "Sem permissão para esta alteração.";
  if (e.code === "P0001" && e.message) return e.message;
  if (/failed to fetch|network/i.test(e.message ?? "")) return "Sem conexão. Confira a internet e tente de novo.";
  return e.message && /[áéíóúãõç]/i.test(e.message) ? e.message : padrao;
}

/** O que a própria tela recusa antes de ir ao banco: a mensagem vai como está. */
export class Recusa extends Error {}

/** Uma ação com "salvando…" e o erro dela, sem repetir o mesmo useState em todo canto. */
export function useAcao() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  async function executar(fazer: () => Promise<void>, padrao?: string) {
    setOcupado(true);
    setErro("");
    try {
      await fazer();
      return true;
    } catch (e) {
      setErro(mensagemDoBanco(e, padrao));
      return false;
    } finally {
      setOcupado(false);
    }
  }
  return { ocupado, erro, setErro, executar };
}

/** Lança o erro do Supabase para o useAcao mostrar. */
export function exigir<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data;
}

export function Vazio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className={`emptyClinical ${estilos.vazio}`}>
      <strong>{titulo}</strong>
      {children}
    </div>
  );
}

export function Aviso({ children, tom = "info" }: { children: React.ReactNode; tom?: "info" | "atencao" }) {
  return (
    <p className={`${estilos.aviso} ${tom === "atencao" ? estilos.avisoAtencao : ""}`}>
      <Icone nome={tom === "atencao" ? "alerta" : "nota"} tamanho={16} />
      <span>{children}</span>
    </p>
  );
}
