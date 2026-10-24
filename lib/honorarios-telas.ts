// O que as telas de "Tabelas e honorários" decidem sem falar com o banco:
// as áreas, o aviso de módulo não instalado, a versão escrita no nome do
// arquivo da ANS, os lotes de gravação e a lista de pendências das tabelas.
// Tudo puro, para ser testado (lib/honorarios-telas.test.ts).

import { problemasDaVersao, type VersaoDeContrato } from "./honorarios.ts";

export type Area = "tuss" | "cbhpm" | "contratos" | "importar" | "regras" | "pendencias" | "historico";

export const AREAS: Array<{ id: Area; rotulo: string }> = [
  { id: "pendencias", rotulo: "Divergências e pendências" },
  { id: "tuss", rotulo: "Consulta TUSS" },
  { id: "contratos", rotulo: "Planos de saúde" },
  { id: "cbhpm", rotulo: "Procedimentos e portes (CBHPM)" },
  { id: "importar", rotulo: "Importar arquivo" },
  { id: "regras", rotulo: "Regras de cálculo" },
  { id: "historico", rotulo: "Histórico" },
];

export const ehArea = (x: string | null | undefined): x is Area => AREAS.some((a) => a.id === x);

/**
 * A migração 202610230011 ainda não foi aplicada: a tabela (ou a função)
 * não existe. PostgREST diz PGRST205/PGRST202; o Postgres, 42P01/42883.
 */
export function faltaInstalar(erro: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!erro) return false;
  if (["PGRST205", "PGRST202", "42P01", "42883"].includes(erro.code ?? "")) return true;
  return /could not find the (table|function)|does not exist/i.test(erro.message ?? "");
}

/**
 * "TUSS 22 - PROCEDIMENTOS … - VERSÃO 202609.xlsx" → "202609". A ANS escreve
 * a versão como ano e mês; sem isso no nome, a pessoa digita.
 */
export function versaoDoNome(...nomes: Array<string | null | undefined>): string | null {
  for (const n of nomes) {
    const m = (n ?? "").match(/(?:^|\D)(20\d{2})(0[1-9]|1[0-2])(?:\D|$)/);
    if (m) return `${m[1]}${m[2]}`;
  }
  return null;
}

/** Fatias para gravar aos poucos: o PostgREST recusa corpo grande demais. */
export function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) r.push(itens.slice(i, i + tamanho));
  return r;
}

/**
 * Lê uma tabela inteira em páginas de mil — o teto de linhas por pedido do
 * banco. `pedir(de, ate)` é a consulta já com a ordem fixa (senão a página
 * seguinte pode repetir ou pular linha). Erro numa página: para e devolve o erro.
 */
export async function lerEmPaginas<T>(
  pedir: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>, tamanho = 1000,
): Promise<{ linhas: T[]; erro: unknown }> {
  const linhas: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await pedir(de, de + tamanho - 1);
    if (error) return { linhas, erro: error };
    linhas.push(...(data ?? []));
    if (!data || data.length < tamanho) return { linhas, erro: null };
  }
}

export const rotuloDoPorte = (p: number) => `AN${p}`;

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

// ── Pendências das tabelas ─────────────────────────────────────────────────

export type Gravidade = "alta" | "media" | "baixa";

export type PendenciaDaTabela = {
  chave: string;
  gravidade: Gravidade;
  /** Onde se resolve. */
  area: Area;
  titulo: string;
  detalhe: string;
  /**
   * O botão do item: o que ele diz e, quando o caminho é importar um arquivo,
   * o quê. Sem ele, o botão leva à área, com o nome dela.
   */
  acao?: AcaoDaTela;
};

/** Um botão que leva aonde se resolve: a uma área, ou à importação já com o tipo escolhido. */
export type AcaoDaTela = { rotulo: string; area?: Area; importar?: "tuss" | "contrato" };

export type EstadoDasTabelas = {
  hoje: string;
  tuss: Array<{ id: string; versao: string; situacao: "em_conferencia" | "vigente" | "substituida" }>;
  edicoes: Array<{ id: string; edicao: string; situacao: "em_conferencia" | "vigente" | "encerrada"; portes: number }>;
  operadoras: Array<{ id: string; nome: string; ativo: boolean }>;
  contratos: Array<{ id: string; operadora_id: string; identificacao: string; ativo: boolean }>;
  /** As versões já montadas para o cálculo, rascunhos incluídos. */
  versoes: VersaoDeContrato[];
  correspondenciasPropostas: number;
  /** Anestesias enviadas ao Financeiro com o honorário pendente (Etapa 5). */
  producaoPendente: number;
};

const PESO: Record<Gravidade, number> = { alta: 0, media: 1, baixa: 2 };

/**
 * O que falta nas tabelas para o cálculo andar sozinho, do mais grave ao
 * menos. Nada aqui é corrigido automaticamente: cada item diz onde resolver.
 */
export function pendenciasDasTabelas(e: EstadoDasTabelas): PendenciaDaTabela[] {
  const r: PendenciaDaTabela[] = [];
  const vigenteTuss = e.tuss.find((t) => t.situacao === "vigente");
  if (!vigenteTuss) {
    r.push({
      chave: "tuss-sem-vigente", gravidade: "alta", area: "tuss",
      titulo: "Nenhuma versão da TUSS publicada",
      detalhe: "Sem a TUSS, nenhum código é conferido e todo honorário fica pendente.",
      acao: { rotulo: "Importar a TUSS", importar: "tuss" },
    });
  }
  for (const t of e.tuss.filter((x) => x.situacao === "em_conferencia")) {
    r.push({
      chave: `tuss-conferencia-${t.id}`, gravidade: "media", area: "tuss",
      titulo: `TUSS ${t.versao} aguardando publicação`,
      detalhe: "Importada e ainda em conferência: o cálculo continua usando a versão publicada.",
      acao: { rotulo: "Conferir e publicar" },
    });
  }

  const operadoraPorId = new Map(e.operadoras.map((o) => [o.id, o]));
  const contratoPorId = new Map(e.contratos.map((c) => [c.id, c]));
  const nomeDoContrato = (contratoId: string) => {
    const c = contratoPorId.get(contratoId);
    const o = c ? operadoraPorId.get(c.operadora_id) : undefined;
    return [o?.nome, c?.identificacao].filter(Boolean).join(" · ") || "Contrato";
  };

  // Edição da CBHPM usada por contrato publicado, mas sem valor de referência:
  // os portes sem valor negociado ficam pendentes.
  const edicoesUsadas = new Set(e.versoes
    .filter((v) => v.situacao === "vigente" && v.referencia === "cbhpm" && v.cbhpmEdicaoId)
    .map((v) => v.cbhpmEdicaoId as string));
  for (const ed of e.edicoes) {
    if (ed.situacao === "em_conferencia") {
      r.push({
        chave: `cbhpm-conferencia-${ed.id}`, gravidade: edicoesUsadas.has(ed.id) ? "alta" : "media", area: "cbhpm",
        titulo: `CBHPM ${ed.edicao} em conferência`,
        detalhe: edicoesUsadas.has(ed.id)
          ? "Há contrato publicado que depende dela, e o cálculo não usa edição em conferência."
          : "Confira os procedimentos e os portes e publique a edição.",
      });
    } else if (ed.situacao === "vigente" && ed.portes === 0 && edicoesUsadas.has(ed.id)) {
      r.push({
        chave: `cbhpm-sem-portes-${ed.id}`, gravidade: "alta", area: "cbhpm",
        titulo: `CBHPM ${ed.edicao} sem valor de referência dos portes`,
        detalhe: "Contrato pela CBHPM sem valor negociado para o porte fica pendente.",
      });
    }
  }

  if (e.correspondenciasPropostas > 0) {
    r.push({
      chave: "correspondencias-propostas", gravidade: "media", area: "cbhpm",
      titulo: `${e.correspondenciasPropostas} ${e.correspondenciasPropostas === 1 ? "correspondência" : "correspondências"} TUSS ↔ CBHPM aguardando validação`,
      detalhe: "Só a correspondência validada entra no cálculo. Código sem ela fica pendente.",
    });
  }

  for (const v of e.versoes.filter((x) => x.situacao === "rascunho")) {
    const problemas = problemasDaVersao(v);
    r.push({
      chave: `rascunho-${v.id}`, gravidade: "baixa", area: "contratos",
      titulo: `${nomeDoContrato(v.contratoId)} — versão ${v.versao} em rascunho`,
      detalhe: problemas.length ? problemas.join(" ") : "Pronta para publicar.",
      acao: { rotulo: "Conferir e publicar" },
    });
  }

  for (const v of e.versoes.filter((x) => x.situacao === "vigente" && x.vigenciaFim)) {
    const faltam = diasEntre(e.hoje, v.vigenciaFim as string);
    const temSeguinte = e.versoes.some((o) => o.contratoId === v.contratoId && o.id !== v.id && o.versao > v.versao);
    if (faltam >= 0 && faltam <= 30 && !temSeguinte) {
      r.push({
        chave: `vence-${v.id}`, gravidade: "media", area: "contratos",
        titulo: `${nomeDoContrato(v.contratoId)} vence ${faltam === 0 ? "hoje" : `em ${faltam} ${faltam === 1 ? "dia" : "dias"}`}`,
        detalhe: "Sem a próxima versão, as anestesias depois do vencimento ficam sem contrato.",
      });
    }
  }

  // Convênio ativo sem nenhuma versão valendo hoje.
  for (const o of e.operadoras.filter((x) => x.ativo)) {
    const contratos = e.contratos.filter((c) => c.operadora_id === o.id && c.ativo).map((c) => c.id);
    const valeHoje = e.versoes.some((v) => contratos.includes(v.contratoId) && v.situacao !== "rascunho"
      && v.vigenciaInicio <= e.hoje && (!v.vigenciaFim || v.vigenciaFim >= e.hoje));
    if (!valeHoje) {
      r.push({
        chave: `sem-contrato-${o.id}`, gravidade: "media", area: "contratos",
        titulo: `${o.nome} sem contrato valendo hoje`,
        detalhe: contratos.length
          ? "Há contrato cadastrado, mas nenhuma versão publicada cobre a data de hoje."
          : "Importe a tabela do plano e publique a versão para o cálculo usar.",
        ...(contratos.length ? {} : { acao: { rotulo: "Importar a tabela do plano", importar: "contrato" as const } }),
      });
    }
  }

  if (e.producaoPendente > 0) {
    r.push({
      chave: "producao-pendente", gravidade: "alta", area: "pendencias",
      titulo: `${e.producaoPendente} ${e.producaoPendente === 1 ? "anestesia enviada" : "anestesias enviadas"} com honorário pendente`,
      detalhe: "O valor não é presumido: resolva a tabela ou o código e calcule de novo.",
    });
  }

  return r.sort((a, b) => PESO[a.gravidade] - PESO[b.gravidade]);
}

// ── Primeiros passos ───────────────────────────────────────────────────────

export type PassoInicial = {
  chave: "tuss" | "plano" | "calculo";
  titulo: string;
  detalhe: string;
  feito: boolean;
  acao: AcaoDaTela;
};

/**
 * O caminho mais curto até o primeiro honorário calculado: a TUSS publicada,
 * a tabela de um plano publicada e um cálculo feito. Cada passo diz o próximo
 * clique — importar, ou conferir e publicar o que já foi importado. A CBHPM e
 * as correspondências ficam de fora: com o porte na tabela do plano, não são
 * necessárias.
 */
export function primeirosPassos(e: {
  tuss: EstadoDasTabelas["tuss"];
  versoes: Array<{ situacao: string }>;
  honorariosCalculados: number;
}): PassoInicial[] {
  const tussPublicada = e.tuss.some((t) => t.situacao === "vigente");
  const tussEmConferencia = e.tuss.some((t) => t.situacao === "em_conferencia");
  const planoPublicado = e.versoes.some((v) => v.situacao !== "rascunho");
  const planoEmRascunho = e.versoes.some((v) => v.situacao === "rascunho");
  return [
    {
      chave: "tuss", titulo: "Publicar a TUSS", feito: tussPublicada,
      detalhe: "A Tabela 22 da ANS: é ela que confere cada código.",
      acao: tussEmConferencia && !tussPublicada
        ? { rotulo: "Conferir e publicar", area: "tuss" }
        : { rotulo: "Importar a TUSS", importar: "tuss" },
    },
    {
      chave: "plano", titulo: "Publicar a tabela de um plano", feito: planoPublicado,
      detalhe: "O código TUSS com o porte do plano e/ou o valor, e o valor de cada porte.",
      acao: planoEmRascunho && !planoPublicado
        ? { rotulo: "Conferir e publicar", area: "contratos" }
        : { rotulo: "Importar a tabela do plano", importar: "contrato" },
    },
    {
      chave: "calculo", titulo: "Calcular o primeiro honorário", feito: e.honorariosCalculados > 0,
      detalhe: "Teste no simulador; depois, na Produção, use “Calcular honorário” numa anestesia.",
      acao: { rotulo: "Abrir o simulador", area: "regras" },
    },
  ];
}

// ── Histórico ──────────────────────────────────────────────────────────────

export type LinhaDeAuditoria = {
  tabela: string;
  acao: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
};

const real = (v: unknown) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** O que mudou, numa frase: "Publicou a versão 2 do contrato", "Valor do AN3: R$ 500,00 → R$ 600,00". */
export function descreverAlteracao(a: LinhaDeAuditoria): { oQue: string; detalhe: string } {
  const n = a.dados_novos ?? {};
  const v = a.dados_anteriores ?? {};
  const x = { ...v, ...n } as Record<string, unknown>;
  const situacaoNova = a.acao === "update" && n.situacao !== v.situacao ? String(n.situacao ?? "") : "";
  const objeto = ({
    tuss_versoes: `a TUSS ${x.versao ?? ""}`,
    cbhpm_edicoes: `a edição ${x.edicao ?? ""} da CBHPM`,
    cbhpm_portes: `o valor de referência do AN${x.porte ?? "?"}`,
    tuss_cbhpm_correspondencias: `a correspondência ${x.tuss_codigo ?? ""} ↔ ${x.cbhpm_codigo ?? ""}`,
    operadoras: `o convênio ${x.nome ?? ""}`,
    contratos: `o contrato ${x.identificacao ?? ""}`,
    contrato_versoes: `a versão ${x.versao ?? ""} do contrato`,
    contrato_valores_porte: `o valor do AN${x.porte ?? "?"}`,
    contrato_valores_procedimento: `o ${x.tuss_codigo ?? "procedimento"} na tabela do plano`,
  } as Record<string, string>)[a.tabela] ?? a.tabela;
  const verbo = a.acao === "insert" ? "Cadastrou"
    : a.acao === "delete" ? "Apagou"
    : situacaoNova === "vigente" ? "Publicou"
    : situacaoNova === "encerrada" ? "Encerrou"
    : situacaoNova === "validada" ? "Validou"
    : situacaoNova === "revogada" ? "Revogou"
    : situacaoNova === "substituida" ? "Substituiu"
    : "Alterou";
  let detalhe = "";
  const campoDoValor = a.tabela === "cbhpm_portes" ? "valor_referencia" : "valor";
  const doProcedimento = (y: Record<string, unknown>) =>
    [y.porte_anestesico != null ? `AN${y.porte_anestesico}` : "", y.valor != null ? real(y.valor) : ""].filter(Boolean).join(" · ") || "—";
  if (a.tabela === "contrato_valores_procedimento") {
    detalhe = a.acao === "update" ? `${doProcedimento(v)} → ${doProcedimento(n)}` : doProcedimento(x);
  } else if (/valores|portes/.test(a.tabela)) {
    detalhe = a.acao === "update" ? `${real(v[campoDoValor])} → ${real(n[campoDoValor])}` : real(x[campoDoValor]);
  } else if (a.acao === "update" && !situacaoNova) {
    const mudou = Object.keys(n).filter((k) => !["created_at", "publicada_em", "publicada_por", "validada_em", "validada_por"].includes(k)
      && JSON.stringify(n[k]) !== JSON.stringify(v[k]));
    detalhe = mudou.length ? `Campos: ${mudou.map((k) => k.replace(/_/g, " ")).join(", ")}` : "";
  }
  return { oQue: `${verbo} ${objeto}`.trim(), detalhe };
}
