// Importação das tabelas de honorários: TUSS (arquivo oficial da ANS), CBHPM
// da clínica, valores de contrato e correspondências TUSS ↔ CBHPM.
//
// Tudo aqui trabalha sobre a GRADE da planilha (linhas × colunas de texto),
// que vem do .xlsx (lib/xlsx-leitura) ou do .csv (gradeDoCsv) lidos no próprio
// aparelho. Nada é gravado aqui: cada leitor devolve o que valeu e, linha a
// linha, o que não valeu e por quê — é a PRÉVIA que a tela mostra antes de
// alguém confirmar a importação.
//
// Regras de toda importação:
// - As colunas são achadas pelo título, em qualquer ordem e em qualquer das
//   primeiras linhas; sem a coluna obrigatória, a importação para e diz qual.
// - Linha com erro não entra, e o erro diz a linha da planilha (contando como
//   o Excel conta, a partir de 1).
// - Código repetido no mesmo arquivo é erro nas duas linhas: o sistema não
//   escolhe qual das duas vale.
// - Texto oficial não é corrigido: a descrição da TUSS entra como a ANS
//   publicou, só sem os espaços das pontas.

import { nomeSimples } from "./honorarios.ts";

export type ErroDeLinha = { linha: number; mensagem: string };

export type Leitura<T> = {
  itens: T[];
  erros: ErroDeLinha[];
  /** Linhas de dados lidas (válidas + com erro), sem o título. */
  total: number;
  /** A linha do título, contada a partir de 1. */
  linhaDoTitulo: number;
};

// ── Células ────────────────────────────────────────────────────────────────

/**
 * Data de uma célula: "dd/mm/aaaa", "aaaa-mm-dd" ou o número de série do Excel
 * (dias desde 30/12/1899). Vazia: null. Ilegível: undefined (é erro).
 */
export function dataDaCelula(v: string | null | undefined): string | null | undefined {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return dataValida(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (m) return dataValida(Number(m[1]), Number(m[2]), Number(m[3]));
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const serie = Math.floor(Number(s));
    if (serie < 1 || serie > 2958465) return undefined;
    const d = new Date(Date.UTC(1899, 11, 30) + serie * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return undefined;
}

function dataValida(a: number, mes: number, d: number): string | undefined {
  const dt = new Date(Date.UTC(a, mes - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== d) return undefined;
  return dt.toISOString().slice(0, 10);
}

/**
 * Valor em reais: "1.234,56", "1234,56", "1234.56", "R$ 1.234,56" ou o número
 * do Excel. Vazio: null. Ilegível ou negativo: undefined (é erro).
 */
export function valorDaCelula(v: string | null | undefined): number | null | undefined {
  let s = String(v ?? "").trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d+$/.test(s)) s = s.replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Math.round(Number(s) * 100) / 100;
  return Number.isFinite(n) ? n : undefined;
}

/** Porte anestésico: "AN3", "AN 3", "3", "AN-3". Vazio: null. Fora de AN0–AN8: undefined. */
export function porteDaCelula(v: string | null | undefined): number | null | undefined {
  const s = String(v ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (!s || s === "—" || s === "-") return null;
  const m = s.match(/^(?:AN|PORTE)?(\d+)$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n >= 0 && n <= 8 ? n : undefined;
}

/**
 * Código numérico (TUSS): só dígitos. O Excel às vezes guarda o código como
 * número ("10101012" vira "10101012" ou "1.0101012E7"); o segundo caso é erro,
 * porque não dá para saber se perdeu um zero à esquerda.
 */
export function codigoDaCelula(v: string | null | undefined): string | null | undefined {
  const s = String(v ?? "").trim().replace(/[.\-\s]/g, "");
  if (!s) return null;
  return /^\d{1,10}$/.test(s) ? s : undefined;
}

// ── Colunas ────────────────────────────────────────────────────────────────

type Campos<K extends string> = Record<K, { titulos: string[]; obrigatorio: boolean }>;

/**
 * A linha do título e a coluna de cada campo. Procura nas 30 primeiras
 * linhas a que tem todos os campos obrigatórios; o título casa pelo começo
 * da forma simples ("Código do Termo" casa com "codigo do termo").
 */
export function acharColunas<K extends string>(grade: string[][], campos: Campos<K>):
  { linha: number; colunas: Record<K, number> } | { faltam: string[] } {
  const chaves = Object.keys(campos) as K[];
  let melhor: { linha: number; colunas: Record<K, number>; achados: number } | null = null;
  for (let i = 0; i < Math.min(grade.length, 30); i++) {
    const titulos = (grade[i] ?? []).map((c) => nomeSimples(c));
    const colunas = {} as Record<K, number>;
    let achados = 0;
    for (const k of chaves) {
      // O título exato vale antes do que só começa igual, e na ordem da lista:
      // na Tabela 22, “Termo” é a descrição, e não a “Descrição Detalhada”.
      const alvo = campos[k].titulos.map(nomeSimples);
      let j = -1;
      for (const a of alvo) { j = titulos.indexOf(a); if (j >= 0) break; }
      if (j < 0) for (const a of alvo) { j = titulos.findIndex((t) => t.startsWith(`${a} `)); if (j >= 0) break; }
      colunas[k] = j;
      if (j >= 0) achados++;
    }
    const temObrigatorios = chaves.every((k) => !campos[k].obrigatorio || colunas[k] >= 0);
    if (temObrigatorios && (!melhor || achados > melhor.achados)) melhor = { linha: i, colunas, achados };
  }
  if (melhor) return { linha: melhor.linha, colunas: melhor.colunas };
  return { faltam: chaves.filter((k) => campos[k].obrigatorio).map((k) => campos[k].titulos[0]) };
}

/**
 * Um arquivo com várias abas: lê todas e fica com a que deu mais linhas. O
 * arquivo oficial da ANS abre com uma CAPA, e a tabela vem na segunda aba.
 * Se nenhuma tem as colunas, vale o aviso da primeira.
 */
export function lerDasAbas<T>(
  abas: Array<{ nome: string; grade: string[][] }>, ler: (grade: string[][]) => Leitura<T>,
): Leitura<T> & { aba: string } {
  let melhor: (Leitura<T> & { aba: string }) | null = null;
  for (const a of abas) {
    const r = ler(a.grade);
    if (!melhor || r.itens.length > melhor.itens.length || (!melhor.total && r.total)) melhor = { ...r, aba: a.nome };
  }
  return melhor ?? { ...ler([]), aba: "" };
}

const celula = (linha: string[] | undefined, j: number) => (j >= 0 ? String(linha?.[j] ?? "") : "");
const vazia = (linha: string[] | undefined) => !(linha ?? []).some((c) => String(c ?? "").trim());

function semColunas<T>(faltam: string[]): Leitura<T> {
  return {
    itens: [], total: 0, linhaDoTitulo: 0,
    erros: [{ linha: 0, mensagem: `Não achei ${faltam.length > 1 ? "as colunas" : "a coluna"} ${faltam.map((f) => `“${f}”`).join(", ")} nas primeiras linhas do arquivo.` }],
  };
}

/** Marca como erro as linhas com a mesma chave e tira todas da lista. */
function semRepetidos<T>(itens: Array<T & { linha: number }>, chave: (x: T) => string, erros: ErroDeLinha[], rotulo: string): T[] {
  const vistos = new Map<string, number[]>();
  for (const it of itens) vistos.set(chave(it), [...(vistos.get(chave(it)) ?? []), it.linha]);
  const repetidos = new Set([...vistos].filter(([, l]) => l.length > 1).map(([k]) => k));
  for (const k of repetidos) {
    const linhas = vistos.get(k)!;
    for (const l of linhas) erros.push({ linha: l, mensagem: `${rotulo} ${k} repetido no arquivo (linhas ${linhas.join(", ")}).` });
  }
  return itens.filter((it) => !repetidos.has(chave(it))).map((it) => {
    const resto: Partial<T & { linha: number }> = { ...it };
    delete resto.linha;
    return resto as T;
  });
}

const porLinha = (a: ErroDeLinha, b: ErroDeLinha) => a.linha - b.linha;

// ── TUSS (Tabela 22 da ANS) ────────────────────────────────────────────────

export type CodigoTussLido = {
  codigo: string;
  descricao: string;
  inicioVigencia: string | null;
  fimVigencia: string | null;
  fimImplantacao: string | null;
};

const CAMPOS_TUSS = {
  codigo: { titulos: ["Código do Termo", "Codigo do termo", "Código", "Codigo TUSS"], obrigatorio: true },
  descricao: { titulos: ["Termo", "Descrição", "Descricao do termo"], obrigatorio: true },
  inicio: { titulos: ["Data de início de vigência", "Data de inicio de vigencia", "Início de vigência", "Inicio vigencia"], obrigatorio: false },
  fim: { titulos: ["Data de fim de vigência", "Data de fim de vigencia", "Fim de vigência", "Fim vigencia"], obrigatorio: false },
  implantacao: { titulos: ["Data de fim de implantação", "Data de fim de implantacao", "Fim de implantação"], obrigatorio: false },
};

/** A Tabela 22 da TUSS, do arquivo oficial da ANS (aba em grade). */
export function lerTabelaTuss(grade: string[][]): Leitura<CodigoTussLido> {
  const achado = acharColunas(grade, CAMPOS_TUSS);
  if ("faltam" in achado) return semColunas(achado.faltam);
  const { linha: titulo, colunas: c } = achado;
  const erros: ErroDeLinha[] = [];
  const lidos: Array<CodigoTussLido & { linha: number }> = [];
  let total = 0;
  for (let i = titulo + 1; i < grade.length; i++) {
    const l = grade[i];
    if (vazia(l)) continue;
    total++;
    const n = i + 1;
    const codigo = codigoDaCelula(celula(l, c.codigo));
    const descricao = celula(l, c.descricao).trim();
    const inicio = dataDaCelula(celula(l, c.inicio));
    const fim = dataDaCelula(celula(l, c.fim));
    const implantacao = dataDaCelula(celula(l, c.implantacao));
    if (!codigo) { erros.push({ linha: n, mensagem: codigo === null ? "Código vazio." : `Código “${celula(l, c.codigo)}” não é só número.` }); continue; }
    if (!descricao) { erros.push({ linha: n, mensagem: `Código ${codigo} sem descrição.` }); continue; }
    if (inicio === undefined || fim === undefined || implantacao === undefined) {
      erros.push({ linha: n, mensagem: `Código ${codigo} com data ilegível.` });
      continue;
    }
    if (inicio && fim && fim < inicio) { erros.push({ linha: n, mensagem: `Código ${codigo}: o fim da vigência é antes do início.` }); continue; }
    lidos.push({ linha: n, codigo, descricao, inicioVigencia: inicio, fimVigencia: fim, fimImplantacao: implantacao });
  }
  const itens = semRepetidos(lidos, (x) => x.codigo, erros, "Código");
  return { itens, erros: erros.sort(porLinha), total, linhaDoTitulo: titulo + 1 };
}

/** A situação do código na data da importação: com fim de vigência passado, inativo. */
export const situacaoDoCodigo = (c: Pick<CodigoTussLido, "fimVigencia">, hoje: string): "ativo" | "inativo" =>
  c.fimVigencia && c.fimVigencia < hoje ? "inativo" : "ativo";

export type ComparacaoDeVersoes = {
  novos: string[];
  descricaoAlterada: Array<{ codigo: string; antes: string; depois: string }>;
  /** Estavam ativos e passaram a ter fim de vigência. */
  encerrados: string[];
  /** Estavam na versão anterior e não vieram na nova. */
  naoEncontrados: string[];
  iguais: number;
};

/** O que muda da versão vigente para a importada — para conferir antes de publicar. */
export function compararVersoes(
  anterior: Map<string, { descricao: string; fimVigencia: string | null }>, nova: CodigoTussLido[],
): ComparacaoDeVersoes {
  const r: ComparacaoDeVersoes = { novos: [], descricaoAlterada: [], encerrados: [], naoEncontrados: [], iguais: 0 };
  const naNova = new Set<string>();
  for (const c of nova) {
    naNova.add(c.codigo);
    const a = anterior.get(c.codigo);
    if (!a) { r.novos.push(c.codigo); continue; }
    let mudou = false;
    if (a.descricao !== c.descricao) { r.descricaoAlterada.push({ codigo: c.codigo, antes: a.descricao, depois: c.descricao }); mudou = true; }
    if (!a.fimVigencia && c.fimVigencia) { r.encerrados.push(c.codigo); mudou = true; }
    if (!mudou) r.iguais++;
  }
  for (const codigo of anterior.keys()) if (!naNova.has(codigo)) r.naoEncontrados.push(codigo);
  return r;
}

// ── CBHPM da clínica ───────────────────────────────────────────────────────

export type ProcedimentoCbhpmLido = { codigo: string; descricao: string; porte: number | null };

const CAMPOS_CBHPM = {
  codigo: { titulos: ["Código", "Codigo", "Código CBHPM", "Cod"], obrigatorio: true },
  descricao: { titulos: ["Descrição", "Descricao", "Procedimento", "Procedimentos"], obrigatorio: true },
  porte: { titulos: ["Porte anestésico", "Porte anestesico", "Porte anest", "Anestesia", "AN", "Porte AN"], obrigatorio: true },
};

/** Procedimentos de uma edição da CBHPM, com o porte anestésico (AN0–AN8). */
export function lerCbhpm(grade: string[][]): Leitura<ProcedimentoCbhpmLido> {
  const achado = acharColunas(grade, CAMPOS_CBHPM);
  if ("faltam" in achado) return semColunas(achado.faltam);
  const { linha: titulo, colunas: c } = achado;
  const erros: ErroDeLinha[] = [];
  const lidos: Array<ProcedimentoCbhpmLido & { linha: number }> = [];
  let total = 0;
  for (let i = titulo + 1; i < grade.length; i++) {
    const l = grade[i];
    if (vazia(l)) continue;
    total++;
    const n = i + 1;
    const codigo = celula(l, c.codigo).trim();
    const descricao = celula(l, c.descricao).trim();
    const porte = porteDaCelula(celula(l, c.porte));
    if (!codigo) { erros.push({ linha: n, mensagem: "Código vazio." }); continue; }
    if (!descricao) { erros.push({ linha: n, mensagem: `Código ${codigo} sem descrição.` }); continue; }
    if (porte === undefined) { erros.push({ linha: n, mensagem: `Código ${codigo}: porte “${celula(l, c.porte)}” fora de AN0 a AN8.` }); continue; }
    lidos.push({ linha: n, codigo, descricao, porte });
  }
  const itens = semRepetidos(lidos, (x) => x.codigo, erros, "Código");
  return { itens, erros: erros.sort(porLinha), total, linhaDoTitulo: titulo + 1 };
}

export type PorteDeReferenciaLido = { porte: number; valor: number };

const CAMPOS_PORTES = {
  porte: { titulos: ["Porte anestésico", "Porte anestesico", "Porte", "AN"], obrigatorio: true },
  valor: { titulos: ["Valor", "Valor de referência", "Valor referencia", "R$"], obrigatorio: true },
};

/** Valores de referência por porte (quando a clínica tem autorização para cadastrá-los). */
export function lerPortesDeReferencia(grade: string[][]): Leitura<PorteDeReferenciaLido> {
  const achado = acharColunas(grade, CAMPOS_PORTES);
  if ("faltam" in achado) return semColunas(achado.faltam);
  const { linha: titulo, colunas: c } = achado;
  const erros: ErroDeLinha[] = [];
  const lidos: Array<PorteDeReferenciaLido & { linha: number }> = [];
  let total = 0;
  for (let i = titulo + 1; i < grade.length; i++) {
    const l = grade[i];
    if (vazia(l)) continue;
    total++;
    const n = i + 1;
    const porte = porteDaCelula(celula(l, c.porte));
    const valor = valorDaCelula(celula(l, c.valor));
    if (porte == null) { erros.push({ linha: n, mensagem: `Porte “${celula(l, c.porte)}” fora de AN0 a AN8.` }); continue; }
    if (valor == null) { erros.push({ linha: n, mensagem: `AN${porte}: valor “${celula(l, c.valor)}” ilegível.` }); continue; }
    lidos.push({ linha: n, porte, valor });
  }
  const itens = semRepetidos(lidos, (x) => `AN${x.porte}`, erros, "Porte");
  return { itens, erros: erros.sort(porLinha), total, linhaDoTitulo: titulo + 1 };
}

// ── Valores de contrato ────────────────────────────────────────────────────

export type ValorDeContratoLido =
  | { tipo: "porte"; porte: number; valor: number }
  | { tipo: "procedimento"; tussCodigo: string; valor: number };

const CAMPOS_CONTRATO = {
  porte: { titulos: ["Porte anestésico", "Porte anestesico", "Porte", "AN"], obrigatorio: false },
  codigo: { titulos: ["Código TUSS", "Codigo TUSS", "Código", "Codigo", "TUSS"], obrigatorio: false },
  valor: { titulos: ["Valor", "Valor negociado", "Honorário", "Honorario", "R$"], obrigatorio: true },
};

/**
 * A tabela de um contrato: cada linha é um porte (AN0–AN8) OU um código TUSS
 * com valor fixo, e o valor. Linha com os dois, ou com nenhum, é erro.
 */
export function lerValoresDoContrato(grade: string[][]): Leitura<ValorDeContratoLido> {
  const achado = acharColunas(grade, CAMPOS_CONTRATO);
  if ("faltam" in achado) return semColunas(achado.faltam);
  const { linha: titulo, colunas: c } = achado;
  if (c.porte < 0 && c.codigo < 0) return semColunas(["Porte anestésico” ou “Código TUSS"]);
  const erros: ErroDeLinha[] = [];
  const lidos: Array<ValorDeContratoLido & { linha: number }> = [];
  let total = 0;
  for (let i = titulo + 1; i < grade.length; i++) {
    const l = grade[i];
    if (vazia(l)) continue;
    total++;
    const n = i + 1;
    const textoPorte = celula(l, c.porte).trim();
    const textoCodigo = celula(l, c.codigo).trim();
    const valor = valorDaCelula(celula(l, c.valor));
    if (textoPorte && textoCodigo) { erros.push({ linha: n, mensagem: "Informe o porte OU o código TUSS, não os dois." }); continue; }
    if (!textoPorte && !textoCodigo) { erros.push({ linha: n, mensagem: "Sem porte e sem código TUSS." }); continue; }
    if (valor == null) { erros.push({ linha: n, mensagem: `Valor “${celula(l, c.valor)}” ilegível.` }); continue; }
    if (textoPorte) {
      const porte = porteDaCelula(textoPorte);
      if (porte == null) { erros.push({ linha: n, mensagem: `Porte “${textoPorte}” fora de AN0 a AN8.` }); continue; }
      lidos.push({ linha: n, tipo: "porte", porte, valor });
    } else {
      const tussCodigo = codigoDaCelula(textoCodigo);
      if (!tussCodigo) { erros.push({ linha: n, mensagem: `Código TUSS “${textoCodigo}” não é só número.` }); continue; }
      lidos.push({ linha: n, tipo: "procedimento", tussCodigo, valor });
    }
  }
  const itens = semRepetidos(lidos, (x) => (x.tipo === "porte" ? `AN${x.porte}` : x.tussCodigo), erros, "Item");
  return { itens, erros: erros.sort(porLinha), total, linhaDoTitulo: titulo + 1 };
}

// ── Correspondências TUSS ↔ CBHPM ──────────────────────────────────────────

export type CorrespondenciaLida = { tussCodigo: string; cbhpmCodigo: string };

const CAMPOS_CORRESPONDENCIA = {
  tuss: { titulos: ["Código TUSS", "Codigo TUSS", "TUSS"], obrigatorio: true },
  cbhpm: { titulos: ["Código CBHPM", "Codigo CBHPM", "CBHPM"], obrigatorio: true },
};

/**
 * Pares TUSS → CBHPM. Entram como PROPOSTAS: só valem no cálculo depois que
 * alguém da clínica valida cada uma.
 */
export function lerCorrespondencias(grade: string[][]): Leitura<CorrespondenciaLida> {
  const achado = acharColunas(grade, CAMPOS_CORRESPONDENCIA);
  if ("faltam" in achado) return semColunas(achado.faltam);
  const { linha: titulo, colunas: c } = achado;
  const erros: ErroDeLinha[] = [];
  const lidos: Array<CorrespondenciaLida & { linha: number }> = [];
  let total = 0;
  for (let i = titulo + 1; i < grade.length; i++) {
    const l = grade[i];
    if (vazia(l)) continue;
    total++;
    const n = i + 1;
    const tussCodigo = codigoDaCelula(celula(l, c.tuss));
    const cbhpmCodigo = celula(l, c.cbhpm).trim();
    if (!tussCodigo) { erros.push({ linha: n, mensagem: `Código TUSS “${celula(l, c.tuss)}” vazio ou não numérico.` }); continue; }
    if (!cbhpmCodigo) { erros.push({ linha: n, mensagem: `TUSS ${tussCodigo} sem código CBHPM.` }); continue; }
    lidos.push({ linha: n, tussCodigo, cbhpmCodigo });
  }
  const itens = semRepetidos(lidos, (x) => x.tussCodigo, erros, "Código TUSS");
  return { itens, erros: erros.sort(porLinha), total, linhaDoTitulo: titulo + 1 };
}

// ── Impressão digital do arquivo ───────────────────────────────────────────

/** SHA-256 do arquivo, em hexadecimal: o mesmo arquivo não se aplica duas vezes. */
export async function impressaoDigital(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const dados = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", dados as BufferSource);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
