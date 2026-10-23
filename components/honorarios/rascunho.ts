// A versão em rascunho de um contrato: achar a que já existe ou criar a
// próxima. Usado pelo "Nova versão" do contrato e pela importação da tabela
// do plano, que grava sempre num rascunho — nunca numa versão publicada.

import type { SupabaseClient } from "@supabase/supabase-js";
import { proximaVersao } from "@/lib/honorarios-dados";
import { emLotes } from "@/lib/honorarios-telas";
import { exigir } from "./comum";
import type { DadosDasTabelas } from "./tipos";

export const rascunhoDoContrato = (dados: DadosDasTabelas, contratoId: string) =>
  dados.versoes.find((v) => v.contrato_id === contratoId && v.situacao === "rascunho") ?? null;

/**
 * A próxima versão do contrato, em rascunho: copia as regras e os valores da
 * última (o reajuste começa do que valia). Primeira versão: pela CBHPM
 * publicada, se houver; senão, tabela própria.
 */
export async function criarRascunho(
  supabase: SupabaseClient, dados: DadosDasTabelas, contratoId: string, referencia?: "cbhpm" | "propria",
): Promise<string> {
  const p = proximaVersao(dados.versoes, contratoId, dados.hoje);
  const b = p.base;
  const edicaoPublicada = dados.edicoes.find((e) => e.situacao === "vigente");
  const ref = b?.referencia ?? referencia ?? (edicaoPublicada ? "cbhpm" : "propria");
  const criada = exigir(await supabase.from("contrato_versoes").insert({
    contrato_id: contratoId, institution_id: dados.institutionId, versao: p.versao, vigencia_inicio: p.vigenciaInicio,
    referencia: ref,
    cbhpm_edicao_id: b ? b.cbhpm_edicao_id : ref === "cbhpm" ? edicaoPublicada?.id ?? null : null,
    reajuste_percentual: b?.reajuste_percentual ?? 0, urgencia_percentual: b?.urgencia_percentual ?? null,
    multiplos_percentuais: b?.multiplos_percentuais ?? null, ajustes: b?.ajustes ?? [],
    ajustes_cumulativos: b?.ajustes_cumulativos ?? false, situacao: "rascunho",
    observacoes: b ? `Copiada da versão ${b.versao}.` : null,
  }).select("id").single()) as { id: string };
  if (b) {
    const porte = dados.valoresPorPorte.filter((v) => v.versao_id === b.id)
      .map((v) => ({ versao_id: criada.id, institution_id: dados.institutionId, porte: v.porte, valor: v.valor }));
    const proc = dados.valoresPorProcedimento.filter((v) => v.versao_id === b.id)
      .map((v) => ({
        versao_id: criada.id, institution_id: dados.institutionId, tuss_codigo: v.tuss_codigo,
        descricao: v.descricao ?? null, porte_anestesico: v.porte_anestesico ?? null, valor: v.valor,
      }));
    if (porte.length) exigir(await supabase.from("contrato_valores_porte").insert(porte));
    for (const lote of emLotes(proc, 500)) exigir(await supabase.from("contrato_valores_procedimento").insert(lote));
  }
  return criada.id;
}
