import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { hoje } from "@/lib/data-local";
import { ehArea, faltaInstalar, lerEmPaginas } from "@/lib/honorarios-telas";
import { TabelasEHonorarios } from "@/components/honorarios/tabelas-e-honorarios";
import type {
  DadosDasTabelas, LinhaContrato, LinhaEdicaoCompleta, LinhaImportacao, LinhaOperadora, LinhaPorteDeReferencia,
  LinhaTussVersao, LinhaValorPorte, LinhaValorProcedimento, LinhaVersao,
} from "@/components/honorarios/tipos";

export const metadata: Metadata = {
  title: "Tabelas e honorários | AVANEST",
  robots: { index: false, follow: false },
};

// Tabelas e honorários: TUSS, CBHPM, contratos dos convênios e as regras do
// cálculo do honorário anestésico (migração 202610230011, lib/honorarios.ts).
//
// Enquanto amadurece, só o super-admin abre — o padrão dos módulos novos
// (PRODUCT.md). A trava de verdade continua sendo o banco: as tabelas da
// clínica só se leem com pode_tabelas_honorarios(), e a TUSS só se grava como
// super-admin. Sem a migração aplicada, a página diz isso em vez de quebrar.
export default async function TabelasEHonorariosPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis").select("id, institution_id, status, super_admin").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo" || !perfil.institution_id) redirect("/dashboard");
  if (perfil.super_admin !== true) redirect("/dashboard");
  const inst = perfil.institution_id as string;
  const { area } = await searchParams;

  const tuss = await supabase.from("tuss_versoes")
    .select("id, tabela, versao, publicada_em, origem, arquivo_nome, arquivo_sha256, situacao, total_codigos, importada_em, vigente_desde")
    .order("importada_em", { ascending: false });
  if (tuss.error && faltaInstalar(tuss.error)) {
    return <TabelasEHonorarios naoInstalado dados={null} areaInicial={ehArea(area) ? area : "pendencias"} />;
  }

  // As tabelas da clínica, inteiras: valores por procedimento passam de mil.
  const daClinica = async <T,>(tabela: string, campos: string) => {
    const { linhas } = await lerEmPaginas<T>((de, ate) => supabase.from(tabela).select(campos)
      .eq("institution_id", inst).order("id").range(de, ate) as unknown as PromiseLike<{ data: T[] | null; error: unknown }>);
    return { data: linhas };
  };

  const [pode, edicoes, portes, operadoras, contratos, versoes, porPorte, porProcedimento, locais, importacoes, propostas, pendentes] =
    await Promise.all([
      supabase.rpc("pode_tabelas_honorarios", { p_institution_id: inst }),
      daClinica<LinhaEdicaoCompleta>("cbhpm_edicoes",
        "id, nome, edicao, ano, fonte, licenca, situacao, vigencia_inicio, vigencia_fim, arquivo_nome, created_at"),
      daClinica<LinhaPorteDeReferencia>("cbhpm_portes", "id, edicao_id, porte, valor_referencia, unidade, vigencia_inicio, fonte"),
      daClinica<LinhaOperadora>("operadoras", "id, nome, particular, ativo"),
      daClinica<LinhaContrato>("contratos", "id, operadora_id, identificacao, local_id, ativo"),
      daClinica<LinhaVersao>("contrato_versoes",
        "id, contrato_id, versao, vigencia_inicio, vigencia_fim, referencia, cbhpm_edicao_id, reajuste_percentual, urgencia_percentual, multiplos_percentuais, ajustes, ajustes_cumulativos, situacao, observacoes, publicada_em"),
      daClinica<LinhaValorPorte>("contrato_valores_porte", "versao_id, porte, valor"),
      daClinica<LinhaValorProcedimento>("contrato_valores_procedimento", "versao_id, tuss_codigo, valor, porte_anestesico, descricao"),
      supabase.from("locais_atendimento").select("id, nome, nome_fantasia")
        .eq("institution_id", inst).is("owner_id", null).eq("ativo", true).order("nome"),
      supabase.from("importacoes_tabelas")
        .select("id, institution_id, tipo, arquivo_nome, arquivo_sha256, origem, linhas_total, linhas_validas, erros, situacao, destino_id, created_at, aplicada_em")
        .order("created_at", { ascending: false }).limit(100),
      supabase.from("tuss_cbhpm_correspondencias").select("id", { count: "exact", head: true })
        .eq("institution_id", inst).eq("situacao", "proposta"),
      supabase.from("producao_do_dia").select("id", { count: "exact", head: true })
        .eq("institution_id", inst).eq("honorario_situacao", "pendente").not("enviado_em", "is", null),
    ]);

  const dados: DadosDasTabelas = {
    institutionId: inst,
    hoje: hoje(),
    superAdmin: true,
    podeEditar: pode.data === true,
    tuss: (tuss.data ?? []) as LinhaTussVersao[],
    edicoes: edicoes.data ?? [],
    portes: portes.data ?? [],
    operadoras: (operadoras.data ?? []).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    contratos: contratos.data ?? [],
    versoes: versoes.data ?? [],
    valoresPorPorte: porPorte.data ?? [],
    valoresPorProcedimento: porProcedimento.data ?? [],
    locais: ((locais.data ?? []) as Array<{ id: string; nome: string; nome_fantasia: string | null }>)
      .map((l) => ({ id: l.id, nome: l.nome_fantasia?.trim() || l.nome })),
    importacoes: (importacoes.data ?? []) as LinhaImportacao[],
    correspondenciasPropostas: propostas.count ?? 0,
    producaoPendente: pendentes.count ?? 0,
  };

  return <TabelasEHonorarios naoInstalado={false} dados={dados} areaInicial={ehArea(area) ? area : "pendencias"} />;
}
