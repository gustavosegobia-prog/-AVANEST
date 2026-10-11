// Líquidos: o que entrou, o que saiu e o balanço — a partir do que foi
// registrado, e dizendo quando o registro está incompleto.

import { num, type Registro } from "./registros.ts";
import { montarInfusoes, totalDaInfusao } from "./infusoes.ts";

export type CategoriaDeLiquido =
  | "cristaloide" | "coloide" | "hemoderivado" | "diurese" | "sangramento" | "outra_perda" | "outro";

export const LIQUIDOS_ENTRADA: Array<{ categoria: CategoriaDeLiquido; rotulo: string; exemplos: string[] }> = [
  { categoria: "cristaloide", rotulo: "Cristaloide", exemplos: ["Soro fisiológico 0,9%", "Ringer lactato", "Plasma-Lyte", "Soro glicosado 5%"] },
  { categoria: "coloide", rotulo: "Coloide", exemplos: ["Albumina", "Gelatina"] },
  { categoria: "hemoderivado", rotulo: "Hemoderivado", exemplos: ["Concentrado de hemácias", "Plasma fresco congelado", "Concentrado de plaquetas", "Crioprecipitado"] },
  { categoria: "outro", rotulo: "Outro", exemplos: [] },
];
/**
 * Os toques rápidos do painel: a bolsa mais usada, no volume da bolsa. Um
 * toque grava a entrada no minuto atual (com "Desfazer"); outro horário ou
 * outra solução, pela janela de entrada.
 */
export const VOLUMES_RAPIDOS = [100, 250, 500, 1000] as const;
export const LIQUIDOS_RAPIDOS: Array<{ nome: string; curto: string }> = [
  { nome: "Soro fisiológico 0,9%", curto: "SF 0,9%" },
  { nome: "Ringer lactato", curto: "Ringer lactato" },
];

export const LIQUIDOS_SAIDA: Array<{ categoria: CategoriaDeLiquido; rotulo: string }> = [
  { categoria: "diurese", rotulo: "Diurese" },
  { categoria: "sangramento", rotulo: "Sangramento" },
  { categoria: "outra_perda", rotulo: "Outra perda" },
];

/** O nome que aparece: a solução, na entrada; a categoria, na saída sem nome. */
export function rotuloDoLiquido(dados: Record<string, unknown>): string {
  const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";
  if (nome) return nome;
  const cat = String(dados.categoria ?? "");
  return [...LIQUIDOS_ENTRADA, ...LIQUIDOS_SAIDA].find((l) => l.categoria === cat)?.rotulo
    ?? (dados.sentido === "saida" ? "Perda" : "Entrada");
}

export type Balanco = {
  entradas: number;
  saidas: number;
  saldo: number;
  porCategoria: Partial<Record<CategoriaDeLiquido, number>>;
  /** Volume de infusões de fármaco (mL/h) somado à parte, quando conhecido. */
  infusoesMl: number;
  avisos: string[];
};

export function balancoHidrico(vigentes: readonly Registro[], pesoKg: number | null): Balanco {
  const porCategoria: Balanco["porCategoria"] = {};
  let entradas = 0, saidas = 0;
  for (const r of vigentes) {
    if (r.tipo !== "liquido") continue;
    const v = num(r.dados.volume_ml);
    if (v === null) continue;
    const cat = r.dados.categoria as CategoriaDeLiquido;
    porCategoria[cat] = Math.round(((porCategoria[cat] ?? 0) + v) * 10) / 10;
    if (r.dados.sentido === "entrada") entradas += v; else saidas += v;
  }
  const avisos: string[] = [];
  let infusoesMl = 0;
  for (const inf of montarInfusoes(vigentes)) {
    const t = totalDaInfusao(inf, pesoKg);
    if (t.volumeMl === null) avisos.push(`Volume da infusão de ${inf.nome} desconhecido (falta concentração ou peso).`);
    else infusoesMl += t.volumeMl;
    if (t.incompleto) avisos.push(`Infusão de ${inf.nome} sem horário de término: contada até o último registro.`);
  }
  infusoesMl = Math.round(infusoesMl * 10) / 10;
  if (porCategoria.diurese === undefined) avisos.push("Sem registro de diurese.");
  if (porCategoria.sangramento === undefined) avisos.push("Sem registro de sangramento.");
  const totalEntradas = Math.round((entradas + infusoesMl) * 10) / 10;
  return {
    entradas: totalEntradas,
    saidas: Math.round(saidas * 10) / 10,
    saldo: Math.round((totalEntradas - saidas) * 10) / 10,
    porCategoria,
    infusoesMl,
    avisos,
  };
}
