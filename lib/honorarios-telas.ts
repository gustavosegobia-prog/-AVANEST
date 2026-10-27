// O que as telas de "Tabelas e honorários" decidem sem falar com o banco:
// as áreas, o aviso de módulo não instalado, a versão escrita no nome do
// arquivo da ANS, os lotes de gravação e a lista de pendências das tabelas.
// Tudo puro, para ser testado (lib/honorarios-telas.test.ts).

import { nomeSimples, problemasDaVersao, type VersaoDeContrato } from "./honorarios.ts";

export type Area = "tuss" | "cbhpm" | "contratos" | "codigos" | "importar" | "regras" | "pendencias" | "historico";

export const AREAS: Array<{ id: Area; rotulo: string }> = [
  { id: "pendencias", rotulo: "Divergências e pendências" },
  { id: "tuss", rotulo: "Consulta TUSS" },
  { id: "contratos", rotulo: "Planos de saúde" },
  { id: "codigos", rotulo: "Códigos e marcas" },
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

/**
 * Um botão que leva aonde se resolve: a uma área — já no item certo (`foco`:
 * a edição, ou o contrato) —, à importação com o tipo escolhido, ou a outra
 * tela do sistema (`href`).
 */
export type AcaoDaTela = { rotulo: string; area?: Area; importar?: "tuss" | "contrato"; foco?: string; href?: string };

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
  /**
   * Quem pode importar e publicar a TUSS — o AVANEST (super-admin), porque a
   * TUSS vale para todas as clínicas. Para a clínica, versão nova em
   * conferência não é pendência dela, e TUSS ausente não se resolve com um
   * botão de importar que ela não tem. Ausente: como antes (true).
   */
  mantemATuss?: boolean;
};

const PESO: Record<Gravidade, number> = { alta: 0, media: 1, baixa: 2 };

/**
 * O que falta nas tabelas para o cálculo andar sozinho, do mais grave ao
 * menos. Nada aqui é corrigido automaticamente: cada item diz onde resolver.
 */
export function pendenciasDasTabelas(e: EstadoDasTabelas): PendenciaDaTabela[] {
  const r: PendenciaDaTabela[] = [];
  const vigenteTuss = e.tuss.find((t) => t.situacao === "vigente");
  const mantemATuss = e.mantemATuss !== false;
  if (!vigenteTuss) {
    r.push({
      chave: "tuss-sem-vigente", gravidade: "alta", area: "tuss",
      titulo: "Nenhuma versão da TUSS publicada",
      detalhe: mantemATuss
        ? "Sem a TUSS, nenhum código é conferido e todo honorário fica pendente."
        : "A TUSS é publicada pelo AVANEST para todas as clínicas. Até lá, todo honorário fica pendente.",
      ...(mantemATuss ? { acao: { rotulo: "Importar a TUSS", importar: "tuss" as const } } : {}),
    });
  }
  for (const t of e.tuss.filter((x) => mantemATuss && x.situacao === "em_conferencia")) {
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
        acao: { rotulo: "Conferir e publicar", foco: ed.id },
      });
    } else if (ed.situacao === "vigente" && ed.portes === 0 && edicoesUsadas.has(ed.id)) {
      r.push({
        chave: `cbhpm-sem-portes-${ed.id}`, gravidade: "alta", area: "cbhpm",
        titulo: `CBHPM ${ed.edicao} sem valor de referência dos portes`,
        detalhe: "Contrato pela CBHPM sem valor negociado para o porte fica pendente.",
        acao: { rotulo: "Cadastrar os portes", foco: ed.id },
      });
    }
  }

  if (e.correspondenciasPropostas > 0) {
    r.push({
      chave: "correspondencias-propostas", gravidade: "media", area: "cbhpm",
      titulo: `${e.correspondenciasPropostas} ${e.correspondenciasPropostas === 1 ? "correspondência" : "correspondências"} TUSS ↔ CBHPM aguardando validação`,
      detalhe: "Só a correspondência validada entra no cálculo. Código sem ela fica pendente.",
      acao: { rotulo: "Validar" },
    });
  }

  for (const v of e.versoes.filter((x) => x.situacao === "rascunho")) {
    const problemas = problemasDaVersao(v);
    r.push({
      chave: `rascunho-${v.id}`, gravidade: "media", area: "contratos",
      titulo: `${nomeDoContrato(v.contratoId)} — versão ${v.versao} em rascunho`,
      detalhe: problemas.length ? problemas.join(" ") : "Pronta para publicar: até lá, o cálculo não usa esta versão.",
      acao: { rotulo: "Conferir e publicar", foco: v.contratoId },
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
        acao: { rotulo: "Abrir o contrato", foco: v.contratoId },
      });
    }
  }

  // Nenhum plano com versão publicada: com a TUSS em dia, ainda assim nenhum
  // honorário sai. Sem este item a lista dizia "nada pendente".
  if (vigenteTuss && !e.versoes.some((v) => v.situacao !== "rascunho")) {
    const rascunho = e.versoes.find((v) => v.situacao === "rascunho");
    r.push({
      chave: "sem-plano-publicado", gravidade: "alta", area: "contratos",
      titulo: "Nenhum plano de saúde com tabela publicada",
      detalhe: rascunho
        ? "Há tabela importada esperando publicação: até publicar, todo honorário fica pendente."
        : "Importe a tabela de um plano e publique: sem ela, todo honorário fica pendente.",
      acao: rascunho
        ? { rotulo: "Conferir e publicar", foco: rascunho.contratoId }
        : { rotulo: "Importar a tabela do plano", importar: "contrato" },
    });
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
        acao: contratos.length
          ? { rotulo: "Abrir o contrato", foco: contratos[0] }
          : { rotulo: "Importar a tabela do plano", importar: "contrato" },
      });
    }
  }

  if (e.producaoPendente > 0) {
    r.push({
      chave: "producao-pendente", gravidade: "alta", area: "pendencias",
      titulo: `${e.producaoPendente} ${e.producaoPendente === 1 ? "anestesia enviada" : "anestesias enviadas"} com honorário pendente`,
      detalhe: "O valor não é presumido: resolva a tabela ou o código e calcule de novo.",
      acao: { rotulo: "Ver na Produção da equipe", href: "/dashboard?area=financeiro&aba=producao" },
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
  /** Ver EstadoDasTabelas.mantemATuss. Ausente: true. */
  mantemATuss?: boolean;
}): PassoInicial[] {
  const tussPublicada = e.tuss.some((t) => t.situacao === "vigente");
  const tussEmConferencia = e.tuss.some((t) => t.situacao === "em_conferencia");
  const planoPublicado = e.versoes.some((v) => v.situacao !== "rascunho");
  const planoEmRascunho = e.versoes.some((v) => v.situacao === "rascunho");
  return [
    e.mantemATuss === false ? {
      chave: "tuss", titulo: "A TUSS publicada", feito: tussPublicada,
      detalhe: "A Tabela 22 da ANS, publicada pelo AVANEST para todas as clínicas: é ela que confere cada código.",
      acao: { rotulo: "Consultar a TUSS", area: "tuss" },
    } : {
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
      detalhe: "Teste no simulador; depois, em Financeiro → Produção da equipe, use “Conferir códigos” na produção enviada.",
      acao: { rotulo: "Abrir o simulador", area: "regras" },
    },
  ];
}

// ── A anestesia da Produção e o código TUSS ────────────────────────────────

const PALAVRAS_VAZIAS = new Set(["para", "pela", "pelo", "pelas", "pelos", "sobre", "entre", "outros", "outras"]);

/**
 * O procedimento como foi escrito na ficha ("Colecistectomia
 * videolaparoscópica") vira até três trechos para procurar na descrição da
 * TUSS ("COLECISTECTOMIA … POR VIDEOLAPAROSCOPIA"), todos exigidos. Cada
 * trecho é o começo de uma palavra, com vogais, acentos e ç trocados por "_"
 * (um caractere qualquer no ilike): quem escreveu "cesarea" acha "CESÁREA", e
 * o começo da palavra acha "videolaparoscopia" a partir de "videolaparoscópica".
 */
export function padroesDaBusca(texto: string | null | undefined): string[] {
  const palavras = String(texto ?? "").toLowerCase().split(/[^0-9a-zà-ÿ]+/)
    .filter((p) => p.length >= 4 && !/^\d+$/.test(p) && !PALAVRAS_VAZIAS.has(nomeSimples(p)));
  const r: string[] = [];
  for (const palavra of palavras) {
    const raiz = palavra.slice(0, 6).replace(/[aeiouà-öø-ÿ]/g, "_");
    const padrao = `%${raiz}%`;
    if (!r.includes(padrao)) r.push(padrao);
    if (r.length === 3) break;
  }
  return r;
}

export type CodigoEscolhido = { codigo: string; descricao: string };

/**
 * Os códigos que o médico já usou para o mesmo procedimento escrito, na
 * anotação mais recente que tem código. "O mesmo" é pela forma simples do
 * texto: maiúscula, acento e espaço não importam. É sugestão — a tela mostra
 * de onde veio, e nada é calculado sem o médico conferir.
 */
export function codigosSugeridos(
  atual: { id: string; procedimento: string | null },
  anteriores: Array<{ id: string; data: string; procedimento: string | null }>,
  procedimentos: Array<{ producao_id: string; ordem: number; tuss_codigo: string | null; descricao: string | null }>,
): { codigos: CodigoEscolhido[]; data: string } | null {
  const chave = nomeSimples(atual.procedimento);
  if (!chave) return null;
  const mesmos = anteriores
    .filter((a) => a.id !== atual.id && nomeSimples(a.procedimento) === chave)
    .sort((a, b) => b.data.localeCompare(a.data));
  for (const a of mesmos) {
    const codigos = procedimentos
      .filter((p) => p.producao_id === a.id && p.tuss_codigo)
      .sort((x, y) => x.ordem - y.ordem)
      .map((p) => ({ codigo: p.tuss_codigo as string, descricao: p.descricao ?? "" }));
    if (codigos.length) return { codigos, data: a.data };
  }
  return null;
}

// ── O código sai no Financeiro (migração 202610270001) ──────────────────────

export type MarcaDaClinica = { id: string; nome: string; tuss_codigo: string; descricao?: string | null; ativo?: boolean; ordem?: number };
export type ProcedimentoDaClinica = { chave: string; nome: string; codigos: CodigoEscolhido[] };

/**
 * Os códigos que entram na conta da anestesia: os dos procedimentos, na
 * ordem escolhida, e depois um por marca que o médico marcou (urgência não é
 * marca: é regra do contrato). Código repetido entra uma vez só. Marca que
 * não existe mais na clínica é ignorada; a desativada continua valendo para
 * quem já a tinha marcado.
 */
export function codigosDaAnestesia(
  procedimentos: string[], marcasDaAnestesia: readonly string[] | null | undefined, marcasDaClinica: MarcaDaClinica[],
): string[] {
  const porId = new Map(marcasDaClinica.map((m) => [m.id, m.tuss_codigo]));
  const todos = [...procedimentos, ...(marcasDaAnestesia ?? []).map((id) => porId.get(id) ?? "")];
  return [...new Set(todos.map((c) => c.replace(/\D/g, "")).filter(Boolean))];
}

/** Os códigos da lista da clínica para o procedimento como foi escrito na ficha. */
export function codigosPeloNome(procedimento: string | null | undefined, lista: ProcedimentoDaClinica[]): CodigoEscolhido[] | null {
  const chave = nomeSimples(procedimento);
  if (!chave) return null;
  const achado = lista.find((p) => p.chave === chave);
  return achado && achado.codigos.length ? achado.codigos : null;
}

/** A linha da lista da clínica que a conferência ensina: o nome da ficha → os códigos escolhidos. */
export function entradaDaLista(procedimento: string | null | undefined, codigos: CodigoEscolhido[]): ProcedimentoDaClinica | null {
  const chave = nomeSimples(procedimento);
  const validos = codigos.filter((c) => /^\d+$/.test(c.codigo));
  if (!chave || !validos.length) return null;
  return { chave: chave.slice(0, 200), nome: String(procedimento).trim().slice(0, 200), codigos: validos.slice(0, 20) };
}

/**
 * A lista da clínica filtrada pelo que se digitou na busca: um pedaço do
 * nome (sem acento nem caixa) ou o começo de um dos códigos.
 */
export function filtrarDaLista<T extends ProcedimentoDaClinica>(lista: T[], termo: string): T[] {
  const t = nomeSimples(termo);
  if (!t) return lista;
  const digitos = /^[\d.\s-]+$/.test(termo.trim()) ? termo.replace(/\D/g, "") : "";
  return lista.filter((p) => digitos
    ? p.codigos.some((c) => c.codigo.startsWith(digitos))
    : p.chave.includes(t));
}

/**
 * O que impede gravar a marca, em português; null quando pode. O nome não
 * repete na clínica (sem diferenciar maiúscula e acento: "Bloqueio" e
 * "bloqueio" confundiriam o médico na Produção).
 */
export function problemaDaMarca(
  marca: { id?: string; nome: string; tuss_codigo: string }, existentes: Array<{ id: string; nome: string }>,
): string | null {
  const nome = marca.nome.trim();
  if (!nome) return "Dê um nome à marca, como o médico vai ver na Produção.";
  if (nome.length > 60) return "O nome da marca passa de 60 letras: encurte.";
  if (!/^\d+$/.test(marca.tuss_codigo)) return "Escolha o código TUSS que a marca puxa.";
  const chave = nomeSimples(nome);
  if (existentes.some((x) => x.id !== marca.id && nomeSimples(x.nome) === chave)) return `Já existe a marca “${nome}”.`;
  return null;
}

export type ResumoDoHonorarioDoMes = {
  /** Soma do honorário previsto das anestesias já calculadas. */
  previsto: number;
  calculadas: number; pendentes: number; semCalculo: number; total: number;
  /** Nas calculadas que têm valor anotado: o que a tabela dá a mais (+) ou a menos (−) que o anotado. */
  diferenca: number;
  /** Quantas calculadas têm valor anotado para comparar. */
  comparadas: number;
};

/**
 * O honorário previsto do mês na Produção. O total é PARCIAL enquanto houver
 * anestesia sem cálculo ou pendente — por isso volta junto quantas entraram
 * nele, e a diferença para o que foi anotado só nas que dá para comparar.
 */
export function resumoDoHonorarioDoMes(itens: Array<{
  honorario_situacao?: string | null; honorario_valor_previsto?: number | string | null; valor?: number | string | null;
}>): ResumoDoHonorarioDoMes {
  let previsto = 0, diferenca = 0, calculadas = 0, pendentes = 0, semCalculo = 0, comparadas = 0;
  for (const i of itens) {
    if (i.honorario_situacao === "calculado" || i.honorario_situacao === "conferido") {
      calculadas++;
      const tabela = Number(i.honorario_valor_previsto ?? 0) || 0;
      previsto += tabela;
      const anotado = Number(i.valor ?? 0) || 0;
      if (anotado > 0) { comparadas++; diferenca += tabela - anotado; }
    } else if (i.honorario_situacao === "pendente") pendentes++;
    else semCalculo++;
  }
  const centavos = (n: number) => Math.round(n * 100) / 100;
  return { previsto: centavos(previsto), calculadas, pendentes, semCalculo, total: itens.length, diferenca: centavos(diferenca), comparadas };
}

/** O selo diz "tabela × anotado" quando os dois existem e não batem (mais de um centavo). */
export function divergeDoAnotado(previsto: number | string | null | undefined, anotado: number | string | null | undefined): boolean {
  const t = Number(previsto ?? NaN), a = Number(anotado ?? 0);
  return Number.isFinite(t) && a > 0 && Math.abs(t - a) >= 0.01;
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
