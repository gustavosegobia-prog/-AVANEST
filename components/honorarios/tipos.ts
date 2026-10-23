// As linhas que a página de "Tabelas e honorários" lê do banco
// (migração 202610230011), como o Supabase as devolve: numeric em texto.

import type {
  LinhaContrato, LinhaEdicao, LinhaOperadora, LinhaValorPorte, LinhaValorProcedimento, LinhaVersao,
} from "@/lib/honorarios-dados";

export type { LinhaContrato, LinhaOperadora, LinhaValorPorte, LinhaValorProcedimento, LinhaVersao };

export type LinhaTussVersao = {
  id: string; tabela: string; versao: string; publicada_em: string | null; origem: string;
  arquivo_nome: string | null; arquivo_sha256: string | null; situacao: "em_conferencia" | "vigente" | "substituida";
  total_codigos: number; importada_em: string; vigente_desde: string | null;
};

export type LinhaEdicaoCompleta = LinhaEdicao & {
  licenca: string | null; arquivo_nome: string | null; created_at: string;
};

export type LinhaPorteDeReferencia = {
  id: string; edicao_id: string; porte: number; valor_referencia: number | string; unidade: string;
  vigencia_inicio: string; fonte: string;
};

export type LinhaImportacao = {
  id: string; institution_id: string | null; tipo: "tuss" | "cbhpm" | "contrato" | "correspondencia";
  arquivo_nome: string; arquivo_sha256: string; origem: string | null; linhas_total: number; linhas_validas: number;
  erros: Array<{ linha: number; mensagem: string }>; situacao: "previa" | "aplicada" | "descartada";
  destino_id: string | null; created_at: string; aplicada_em: string | null;
};

export type LocalDoContrato = { id: string; nome: string };

/** Tudo o que a página leu no servidor; o resto se lê na área que precisa. */
export type DadosDasTabelas = {
  institutionId: string;
  hoje: string;
  superAdmin: boolean;
  /** pode_tabelas_honorarios(): Financeiro na própria organização. */
  podeEditar: boolean;
  tuss: LinhaTussVersao[];
  edicoes: LinhaEdicaoCompleta[];
  portes: LinhaPorteDeReferencia[];
  operadoras: LinhaOperadora[];
  contratos: LinhaContrato[];
  versoes: LinhaVersao[];
  valoresPorPorte: LinhaValorPorte[];
  valoresPorProcedimento: LinhaValorProcedimento[];
  locais: LocalDoContrato[];
  importacoes: LinhaImportacao[];
  correspondenciasPropostas: number;
  producaoPendente: number;
};
