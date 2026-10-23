// Das linhas do banco (migração 202610230001) para o que o cálculo usa
// (lib/honorarios.ts). Sem consulta nenhuma: quem lê o banco é a tela ou a
// rota; aqui só se monta, e por isso dá para testar.

import type { Ajuste, EdicaoCbhpm, Porte, Tabelas, VersaoDeContrato } from "./honorarios.ts";

export type LinhaOperadora = { id: string; nome: string; particular: boolean; ativo: boolean };
export type LinhaContrato = { id: string; operadora_id: string; identificacao: string; local_id: string | null; ativo: boolean };
export type LinhaVersao = {
  id: string; contrato_id: string; versao: number; vigencia_inicio: string; vigencia_fim: string | null;
  referencia: "cbhpm" | "propria"; cbhpm_edicao_id: string | null; reajuste_percentual: number | string;
  urgencia_percentual: number | string | null; multiplos_percentuais: Array<number | string> | null;
  ajustes: unknown; ajustes_cumulativos: boolean; situacao: "rascunho" | "vigente" | "encerrada";
  observacoes?: string | null; publicada_em?: string | null;
};
export type LinhaValorPorte = { versao_id: string; porte: number; valor: number | string };
/** Uma linha da tabela do plano: o código com o porte que o plano dá e/ou um valor fixo. */
export type LinhaValorProcedimento = {
  versao_id: string; tuss_codigo: string; valor: number | string | null;
  porte_anestesico?: number | null; descricao?: string | null;
};
export type LinhaEdicao = {
  id: string; nome: string; edicao: string; ano: number | null; fonte: string; situacao: "em_conferencia" | "vigente" | "encerrada";
  vigencia_inicio: string | null; vigencia_fim: string | null;
};

const num = (v: number | string | null | undefined): number | null =>
  v == null || v === "" ? null : Number(v);

/** O Postgres devolve numeric como texto; o cálculo quer número. */
export function versaoDeContrato(
  v: LinhaVersao, contrato: LinhaContrato, operadora: LinhaOperadora,
  porPorte: LinhaValorPorte[], porProcedimento: LinhaValorProcedimento[],
): VersaoDeContrato {
  const valoresPorPorte: Partial<Record<number, number>> = {};
  for (const p of porPorte) if (p.versao_id === v.id) valoresPorPorte[p.porte] = Number(p.valor);
  const valoresPorProcedimento: Record<string, number> = {};
  const portesPorProcedimento: Record<string, Porte> = {};
  for (const p of porProcedimento) {
    if (p.versao_id !== v.id) continue;
    if (p.valor != null && p.valor !== "") valoresPorProcedimento[p.tuss_codigo] = Number(p.valor);
    if (p.porte_anestesico != null) portesPorProcedimento[p.tuss_codigo] = p.porte_anestesico as Porte;
  }
  return {
    id: v.id,
    contratoId: contrato.id,
    operadora: operadora.nome,
    localId: contrato.local_id,
    versao: v.versao,
    vigenciaInicio: v.vigencia_inicio,
    vigenciaFim: v.vigencia_fim,
    situacao: v.situacao,
    referencia: v.referencia,
    cbhpmEdicaoId: v.cbhpm_edicao_id,
    reajustePercentual: num(v.reajuste_percentual) ?? 0,
    urgenciaPercentual: num(v.urgencia_percentual),
    multiplosPercentuais: v.multiplos_percentuais?.map(Number) ?? null,
    ajustes: (Array.isArray(v.ajustes) ? v.ajustes : []) as Ajuste[],
    ajustesCumulativos: v.ajustes_cumulativos,
    valoresPorPorte,
    valoresPorProcedimento,
    portesPorProcedimento,
  };
}

/** Todas as versões publicadas (as que o cálculo considera), já montadas. */
export function versoesPublicadas(
  versoes: LinhaVersao[], contratos: LinhaContrato[], operadoras: LinhaOperadora[],
  porPorte: LinhaValorPorte[], porProcedimento: LinhaValorProcedimento[],
): VersaoDeContrato[] {
  const contratoPorId = new Map(contratos.map((c) => [c.id, c]));
  const operadoraPorId = new Map(operadoras.map((o) => [o.id, o]));
  const r: VersaoDeContrato[] = [];
  for (const v of versoes) {
    if (v.situacao === "rascunho") continue;
    const c = contratoPorId.get(v.contrato_id);
    const o = c ? operadoraPorId.get(c.operadora_id) : undefined;
    if (!c || !o || !c.ativo) continue;
    r.push(versaoDeContrato(v, c, o, porPorte, porProcedimento));
  }
  return r;
}

export function edicaoCbhpm(
  e: Pick<LinhaEdicao, "id" | "edicao">,
  procedimentos: Array<{ codigo: string; porte_anestesico: number | null }>,
  portes: Array<{ porte: number; valor_referencia: number | string; vigencia_inicio: string }>,
): EdicaoCbhpm {
  return {
    id: e.id,
    edicao: e.edicao,
    procedimentos: new Map(procedimentos.map((p) => [p.codigo, p.porte_anestesico as Porte | null])),
    portes: portes.map((p) => ({ porte: p.porte as Porte, valor: Number(p.valor_referencia), vigenciaInicio: p.vigencia_inicio })),
  };
}

/** Monta as tabelas do cálculo a partir do que foi lido. */
export function tabelasDoCalculo(x: {
  tussVersao: { id: string; versao: string } | null;
  tussCodigos: Array<{ codigo: string; descricao: string; situacao: "ativo" | "inativo" | "substituido"; substituido_por: string | null; inicio_vigencia: string | null; fim_vigencia: string | null }>;
  correspondencias: Array<{ tuss_codigo: string; cbhpm_edicao_id: string; cbhpm_codigo: string; situacao: string }>;
  edicoes: EdicaoCbhpm[];
  contratos: VersaoDeContrato[];
}): Tabelas {
  return {
    tuss: x.tussVersao ? {
      versaoId: x.tussVersao.id,
      versao: x.tussVersao.versao,
      codigos: new Map(x.tussCodigos.map((c) => [c.codigo, {
        codigo: c.codigo, descricao: c.descricao, situacao: c.situacao,
        substituidoPor: c.substituido_por, inicioVigencia: c.inicio_vigencia, fimVigencia: c.fim_vigencia,
      }])),
    } : null,
    correspondencias: x.correspondencias.filter((c) => c.situacao === "validada")
      .map((c) => ({ tussCodigo: c.tuss_codigo, cbhpmEdicaoId: c.cbhpm_edicao_id, cbhpmCodigo: c.cbhpm_codigo })),
    cbhpm: new Map(x.edicoes.map((e) => [e.id, e])),
    contratos: x.contratos,
  };
}

export const NOME_DA_SITUACAO_DA_VERSAO: Record<LinhaVersao["situacao"], string> = {
  rascunho: "Rascunho", vigente: "Vigente", encerrada: "Encerrada",
};
export const NOME_DA_SITUACAO_DA_EDICAO: Record<LinhaEdicao["situacao"], string> = {
  em_conferencia: "Em conferência", vigente: "Publicada", encerrada: "Encerrada",
};

/** A próxima versão de um contrato copia as regras da última, em rascunho, começando no dia seguinte ao fim dela. */
export function proximaVersao(versoes: LinhaVersao[], contratoId: string, hoje: string) {
  const doContrato = versoes.filter((v) => v.contrato_id === contratoId).sort((a, b) => b.versao - a.versao);
  const ultima = doContrato[0];
  return {
    versao: (ultima?.versao ?? 0) + 1,
    base: ultima ?? null,
    vigenciaInicio: ultima?.vigencia_fim ? diaSeguinte(ultima.vigencia_fim) : hoje,
  };
}

function diaSeguinte(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}
