// Honorários anestésicos: o cálculo, sem tela e sem banco.
//
// Recebe uma anestesia da Produção (data, convênio, hospital, urgência e os
// códigos TUSS escolhidos na conferência) e as tabelas da clínica (TUSS
// vigente, correspondências TUSS ↔ CBHPM validadas, portes da CBHPM e as
// versões de contrato publicadas). Devolve o honorário previsto com a
// memória do cálculo — ou a lista do que falta para calculá-lo.
//
// TRÊS COMPROMISSOS:
//
// 1. Não há fórmula universal. Cada versão de contrato diz o que paga: valor
//    fixo por procedimento, valor negociado por porte, referência da CBHPM com
//    reajuste, urgência, procedimentos múltiplos, adicionais e redutores. O
//    que o contrato não disser não é suposto: vira pendência.
//
// 2. Nada é presumido. Código inexistente, inativo, sem correspondência
//    validada, sem porte, sem contrato, sem valor: o resultado é
//    "Valor pendente de conferência — tabela ou código não validado", sem
//    valor previsto, e não se libera ao Financeiro.
//
// 3. O passado não muda. O resultado é um objeto novo, com as versões e a
//    regra que usou (a "memória"), gravado na linha da Produção. Atualizar uma
//    tabela depois não mexe nele; só um novo cálculo, pedido por alguém, muda.
//
// A ordem do cálculo, que vale para todo contrato:
//   base de cada procedimento → percentual de procedimentos múltiplos →
//   subtotal → urgência e ajustes percentuais (somados sobre o subtotal, ou
//   um sobre o outro se o contrato for cumulativo) → ajustes fixos → total.
// Tudo em centavos inteiros, arredondando cada passo para o centavo.

export type Porte = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const PENDENTE_DE_CONFERENCIA = "Valor pendente de conferência — tabela ou código não validado.";
export const CONFERIR_ANTES_DE_ENVIAR = "Valor calculado, com divergência a conferir antes de enviar ao Financeiro.";

export type CodigoTuss = {
  codigo: string;
  descricao: string;
  situacao: "ativo" | "inativo" | "substituido";
  substituidoPor?: string | null;
  inicioVigencia?: string | null;
  fimVigencia?: string | null;
};

export type Ajuste = {
  nome: string;
  tipo: "percentual" | "fixo";
  /** Percentual (10 = +10%, −10 = redutor de 10%) ou valor fixo em reais. */
  valor: number;
  quando: "sempre" | "urgencia";
};

export type VersaoDeContrato = {
  id: string;
  contratoId: string;
  /** O nome do convênio, como o contrato o cadastrou (operadora). */
  operadora: string;
  /** O hospital em que o contrato vale; vazio: qualquer um. */
  localId: string | null;
  versao: number;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  situacao: "rascunho" | "vigente" | "encerrada";
  referencia: "cbhpm" | "propria";
  cbhpmEdicaoId: string | null;
  reajustePercentual: number;
  /** Vazio: o contrato não prevê urgência. */
  urgenciaPercentual: number | null;
  /** Percentual por ordem de valor (o maior primeiro). Vazio: não prevê múltiplos. */
  multiplosPercentuais: number[] | null;
  ajustes: Ajuste[];
  ajustesCumulativos: boolean;
  /** Valor negociado por porte anestésico (0 a 8), em reais. */
  valoresPorPorte: Partial<Record<number, number>>;
  /** Valor fixo por código TUSS, em reais. */
  valoresPorProcedimento: Record<string, number>;
  /**
   * O porte anestésico que a tabela do plano dá a cada código TUSS. Vale
   * antes da correspondência com a CBHPM: é o plano dizendo o porte dele.
   */
  portesPorProcedimento: Record<string, Porte>;
};

export type EdicaoCbhpm = {
  id: string;
  edicao: string;
  /** Código CBHPM → porte anestésico (null: a edição não dá porte). */
  procedimentos: Map<string, Porte | null>;
  /** Valor de referência de cada porte, com o início da vigência. */
  portes: Array<{ porte: Porte; valor: number; vigenciaInicio: string }>;
};

export type Tabelas = {
  tuss: { versaoId: string; versao: string; codigos: Map<string, CodigoTuss> } | null;
  /** Só as correspondências VALIDADAS. */
  correspondencias: Array<{ tussCodigo: string; cbhpmEdicaoId: string; cbhpmCodigo: string }>;
  cbhpm: Map<string, EdicaoCbhpm>;
  /** As versões publicadas (vigentes e encerradas); rascunho não conta. */
  contratos: VersaoDeContrato[];
};

export type Anestesia = {
  data: string;
  convenio: string;
  localId: string | null;
  urgencia: boolean;
  /** Os códigos TUSS na ordem da conferência; vazio: ainda não escolhido. */
  procedimentos: Array<string | null>;
  /** O valor que o médico anotou na Produção, se anotou. */
  valorInformado?: number | null;
  paciente?: string;
};

/** Outras anestesias já lançadas, para achar o mesmo procedimento duas vezes. */
export type JaLancado = { data: string; paciente: string; codigos: string[] };

export type TipoDePendencia =
  | "codigo_ausente" | "tuss_sem_versao" | "codigo_inexistente" | "codigo_inativo" | "codigo_fora_da_vigencia"
  | "procedimento_duplicado" | "sem_contrato" | "contrato_ambiguo" | "sem_edicao_cbhpm" | "sem_correspondencia"
  | "codigo_cbhpm_inexistente" | "sem_porte" | "sem_valor" | "multiplos_sem_regra" | "urgencia_sem_regra"
  | "ajuste_invalido" | "valor_negativo" | "divergencia_valor";

export type Pendencia = { tipo: TipoDePendencia; texto: string; codigo?: string };

export type OrigemDaBase = "valor_fixo_do_contrato" | "porte_do_contrato" | "referencia_cbhpm";

export type LinhaDoCalculo = {
  ordem: number;
  tussCodigo: string;
  descricao: string | null;
  cbhpmCodigo: string | null;
  porte: Porte | null;
  /** De onde veio o porte: a tabela do plano (contrato) ou a CBHPM. */
  porteDe: "contrato" | "cbhpm" | null;
  base: number;
  origem: OrigemDaBase;
  percentual: number;
  valor: number;
};

export type Acrescimo = { nome: string; tipo: "percentual" | "fixo"; parametro: number; valor: number };

export type Memoria = {
  tussVersao: string | null;
  tussVersaoId: string | null;
  contratoVersaoId: string | null;
  contratoId: string | null;
  contratoVersao: number | null;
  operadora: string | null;
  referencia: "cbhpm" | "propria" | null;
  cbhpmEdicao: string | null;
  reajustePercentual: number | null;
  linhas: LinhaDoCalculo[];
  subtotal: number | null;
  acrescimos: Acrescimo[];
  total: number | null;
  regra: string[];
};

export type ResultadoDoHonorario = {
  situacao: "calculado" | "pendente";
  /** Vazio quando falta tabela ou código: nada é presumido. */
  valorPrevisto: number | null;
  mensagem: string | null;
  pendencias: Pendencia[];
  memoria: Memoria;
};

// ── Apoio ──────────────────────────────────────────────────────────────────

/** A mesma forma simples do banco (nome_simples): minúscula, sem acento, só letras e números. */
export function nomeSimples(s: string | null | undefined): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const centavos = (reais: number) => Math.round(reais * 100);
const reais = (c: number) => c / 100;
const percentualDe = (c: number, p: number) => Math.round((c * p) / 100);
const vale = (v: { vigenciaInicio: string; vigenciaFim: string | null }, data: string) =>
  v.vigenciaInicio <= data && (v.vigenciaFim == null || data <= v.vigenciaFim);
const dinheiro = (c: number) => reais(c).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Pendências que impedem dar valor: falta tabela, código ou regra. */
const SEM_VALOR: ReadonlySet<TipoDePendencia> = new Set<TipoDePendencia>([
  "codigo_ausente", "tuss_sem_versao", "codigo_inexistente", "codigo_inativo", "codigo_fora_da_vigencia",
  "sem_contrato", "contrato_ambiguo", "sem_edicao_cbhpm", "sem_correspondencia", "codigo_cbhpm_inexistente",
  "sem_porte", "sem_valor", "multiplos_sem_regra", "urgencia_sem_regra", "ajuste_invalido", "valor_negativo",
]);

/**
 * O contrato que vale para a anestesia: do mesmo convênio, publicado, com a
 * data dentro da vigência. O do hospital ganha do geral. Dois contratos
 * diferentes no mesmo nível são ambiguidade — e não se escolhe um por sorte.
 * No mesmo contrato, vale a versão mais nova que cubra a data.
 */
export function contratoAplicavel(
  a: Pick<Anestesia, "data" | "convenio" | "localId">, contratos: VersaoDeContrato[],
): { versao: VersaoDeContrato | null; pendencia: Pendencia | null } {
  const chave = nomeSimples(a.convenio);
  const candidatas = contratos.filter((v) =>
    v.situacao !== "rascunho" && nomeSimples(v.operadora) === chave && vale(v, a.data)
    && (v.localId == null || v.localId === a.localId));
  if (!candidatas.length) {
    return {
      versao: null,
      pendencia: { tipo: "sem_contrato", texto: `Nenhum contrato de ${a.convenio || "convênio"} vigente em ${dataBr(a.data)}.` },
    };
  }
  const doHospital = candidatas.filter((v) => v.localId != null && v.localId === a.localId);
  const nivel = doHospital.length ? doHospital : candidatas;
  const porContrato = new Map<string, VersaoDeContrato>();
  for (const v of nivel) {
    const atual = porContrato.get(v.contratoId);
    if (!atual || v.versao > atual.versao) porContrato.set(v.contratoId, v);
  }
  if (porContrato.size > 1) {
    return {
      versao: null,
      pendencia: { tipo: "contrato_ambiguo", texto: `Mais de um contrato de ${a.convenio} vale em ${dataBr(a.data)}: indique o hospital ou encerre um deles.` },
    };
  }
  return { versao: [...porContrato.values()][0], pendencia: null };
}

const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function ajusteValido(a: unknown): a is Ajuste {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return typeof x.nome === "string" && x.nome.trim() !== ""
    && (x.tipo === "percentual" || x.tipo === "fixo")
    && typeof x.valor === "number" && Number.isFinite(x.valor)
    && (x.quando === "sempre" || x.quando === "urgencia");
}

// ── O cálculo ──────────────────────────────────────────────────────────────

export function calcularHonorario(a: Anestesia, t: Tabelas, outros: JaLancado[] = []): ResultadoDoHonorario {
  const pendencias: Pendencia[] = [];
  const regra: string[] = [];
  const memoria: Memoria = {
    tussVersao: t.tuss?.versao ?? null, tussVersaoId: t.tuss?.versaoId ?? null,
    contratoVersaoId: null, contratoId: null, contratoVersao: null, operadora: null, referencia: null,
    cbhpmEdicao: null, reajustePercentual: null, linhas: [], subtotal: null, acrescimos: [], total: null, regra,
  };

  // 1. Os códigos
  const codigos = a.procedimentos.map((c) => (c ?? "").trim()).filter(Boolean);
  if (!codigos.length) pendencias.push({ tipo: "codigo_ausente", texto: "Nenhum código TUSS escolhido para esta anestesia." });
  if (codigos.length && !t.tuss) pendencias.push({ tipo: "tuss_sem_versao", texto: "Não há versão da TUSS publicada para conferir os códigos." });
  const validos: string[] = [];
  const vistos = new Set<string>();
  for (const codigo of codigos) {
    if (vistos.has(codigo)) {
      pendencias.push({ tipo: "procedimento_duplicado", codigo, texto: `O código ${codigo} aparece duas vezes nesta anestesia.` });
      continue;
    }
    vistos.add(codigo);
    const item = t.tuss?.codigos.get(codigo);
    if (t.tuss && !item) {
      pendencias.push({ tipo: "codigo_inexistente", codigo, texto: `O código ${codigo} não existe na TUSS ${t.tuss.versao}.` });
    } else if (item && item.situacao !== "ativo") {
      const troca = item.substituidoPor ? ` Substituído por ${item.substituidoPor}.` : "";
      pendencias.push({ tipo: "codigo_inativo", codigo, texto: `O código ${codigo} está ${item.situacao === "substituido" ? "substituído" : "inativo"} na TUSS.${troca}` });
    } else if (item && ((item.inicioVigencia && a.data < item.inicioVigencia) || (item.fimVigencia && a.data > item.fimVigencia))) {
      pendencias.push({ tipo: "codigo_fora_da_vigencia", codigo, texto: `O código ${codigo} não estava vigente na TUSS em ${dataBr(a.data)}.` });
    } else if (item) {
      validos.push(codigo);
    }
  }

  // 2. O mesmo procedimento já lançado para o mesmo paciente no mesmo dia
  if (a.paciente) {
    const paciente = nomeSimples(a.paciente);
    for (const o of outros) {
      if (o.data !== a.data || nomeSimples(o.paciente) !== paciente) continue;
      for (const codigo of codigos) {
        if (o.codigos.includes(codigo)) {
          pendencias.push({ tipo: "procedimento_duplicado", codigo, texto: `O código ${codigo} já foi lançado para este paciente em ${dataBr(a.data)}.` });
        }
      }
    }
  }

  // 3. O contrato
  const { versao: contrato, pendencia: semContrato } = contratoAplicavel(a, t.contratos);
  if (semContrato) pendencias.push(semContrato);
  if (contrato) {
    memoria.contratoVersaoId = contrato.id;
    memoria.contratoId = contrato.contratoId;
    memoria.contratoVersao = contrato.versao;
    memoria.operadora = contrato.operadora;
    memoria.referencia = contrato.referencia;
    memoria.reajustePercentual = contrato.reajustePercentual;
    regra.push(`Contrato de ${contrato.operadora}, versão ${contrato.versao} (vigência a partir de ${dataBr(contrato.vigenciaInicio)}).`);
  }
  const edicao = contrato?.cbhpmEdicaoId ? t.cbhpm.get(contrato.cbhpmEdicaoId) ?? null : null;
  if (edicao) memoria.cbhpmEdicao = edicao.edicao;

  // 4. A base de cada procedimento
  const linhas: Omit<LinhaDoCalculo, "percentual" | "valor">[] = [];
  if (contrato) {
    validos.forEach((codigo, i) => {
      const descricao = t.tuss?.codigos.get(codigo)?.descricao ?? null;
      const fixo = contrato.valoresPorProcedimento[codigo];
      if (fixo != null) {
        linhas.push({ ordem: i + 1, tussCodigo: codigo, descricao, cbhpmCodigo: null, porte: null, porteDe: null, base: centavos(fixo), origem: "valor_fixo_do_contrato" });
        return;
      }
      // O porte: primeiro o que a tabela do plano dá ao código; sem ele, o da
      // CBHPM, pela correspondência validada. Nunca um porte suposto.
      let porte: Porte | null = contrato.portesPorProcedimento[codigo] ?? null;
      let porteDe: "contrato" | "cbhpm" = "contrato";
      let cbhpmCodigo: string | null = null;
      if (porte != null) {
        regra.push(`Porte do ${codigo} pela tabela do contrato: AN${porte}.`);
      } else {
        porteDe = "cbhpm";
        if (!edicao) {
          pendencias.push({ tipo: "sem_edicao_cbhpm", codigo, texto: `O contrato não tem valor fixo nem porte para ${codigo} na tabela dele, nem edição da CBHPM para achar o porte.` });
          return;
        }
        const cor = t.correspondencias.find((c) => c.tussCodigo === codigo && c.cbhpmEdicaoId === edicao.id);
        if (!cor) {
          pendencias.push({ tipo: "sem_correspondencia", codigo, texto: `O código ${codigo} não está na tabela do contrato nem tem correspondência validada com a ${edicao.edicao}.` });
          return;
        }
        if (!edicao.procedimentos.has(cor.cbhpmCodigo)) {
          pendencias.push({ tipo: "codigo_cbhpm_inexistente", codigo, texto: `O código CBHPM ${cor.cbhpmCodigo} não está na ${edicao.edicao}.` });
          return;
        }
        cbhpmCodigo = cor.cbhpmCodigo;
        porte = edicao.procedimentos.get(cor.cbhpmCodigo) ?? null;
        if (porte == null) {
          pendencias.push({ tipo: "sem_porte", codigo, texto: `O procedimento ${cor.cbhpmCodigo} não tem porte anestésico na ${edicao.edicao}.` });
          return;
        }
      }
      const negociado = contrato.valoresPorPorte[porte];
      if (negociado != null) {
        linhas.push({ ordem: i + 1, tussCodigo: codigo, descricao, cbhpmCodigo, porte, porteDe, base: centavos(negociado), origem: "porte_do_contrato" });
        return;
      }
      if (contrato.referencia === "cbhpm" && edicao) {
        const ref = edicao.portes
          .filter((p) => p.porte === porte && p.vigenciaInicio <= a.data)
          .sort((x, y) => y.vigenciaInicio.localeCompare(x.vigenciaInicio))[0];
        if (ref) {
          const base = Math.round(centavos(ref.valor) * (1 + contrato.reajustePercentual / 100));
          linhas.push({ ordem: i + 1, tussCodigo: codigo, descricao, cbhpmCodigo, porte, porteDe, base, origem: "referencia_cbhpm" });
          return;
        }
      }
      pendencias.push({ tipo: "sem_valor", codigo, texto: `Não há valor para o porte AN${porte} no contrato${contrato.referencia === "cbhpm" ? " nem na referência da CBHPM" : ""}.` });
    });
  }

  // 5. Procedimentos múltiplos: o de maior valor primeiro
  const ordenadas = [...linhas].sort((x, y) => y.base - x.base || x.ordem - y.ordem);
  let percentuais: number[] = [100];
  if (ordenadas.length > 1) {
    if (!contrato?.multiplosPercentuais?.length) {
      pendencias.push({ tipo: "multiplos_sem_regra", texto: "Há mais de um procedimento e o contrato não diz como pagar procedimentos múltiplos." });
    } else {
      percentuais = contrato.multiplosPercentuais;
      regra.push(`Procedimentos múltiplos: ${percentuais.join("%, ")}% por ordem de valor.`);
    }
  }
  // Conta em centavos; a memória guarda reais, como o valor previsto.
  let subtotal = 0;
  memoria.linhas = ordenadas.map((l, i) => {
    const percentual = percentuais[Math.min(i, percentuais.length - 1)];
    const valor = percentualDe(l.base, percentual);
    subtotal += valor;
    return { ...l, base: reais(l.base), percentual, valor: reais(valor) };
  });

  // 6. Urgência e ajustes
  const percentuaisAplicaveis: Array<{ nome: string; p: number }> = [];
  const fixos: Array<{ nome: string; c: number }> = [];
  if (contrato) {
    if (a.urgencia) {
      if (contrato.urgenciaPercentual == null) {
        pendencias.push({ tipo: "urgencia_sem_regra", texto: "A anestesia é de urgência e o contrato não diz como paga a urgência." });
      } else {
        percentuaisAplicaveis.push({ nome: "Urgência/emergência", p: contrato.urgenciaPercentual });
      }
    }
    for (const aj of contrato.ajustes as unknown[]) {
      if (!ajusteValido(aj)) {
        pendencias.push({ tipo: "ajuste_invalido", texto: "Um adicional ou redutor do contrato está incompleto e precisa ser corrigido." });
        continue;
      }
      if (aj.quando === "urgencia" && !a.urgencia) continue;
      if (aj.tipo === "percentual") percentuaisAplicaveis.push({ nome: aj.nome, p: aj.valor });
      else fixos.push({ nome: aj.nome, c: centavos(aj.valor) });
    }
  }
  let total = subtotal;
  if (contrato?.ajustesCumulativos) {
    for (const { nome, p } of percentuaisAplicaveis) {
      const v = percentualDe(total, p);
      memoria.acrescimos.push({ nome, tipo: "percentual", parametro: p, valor: reais(v) });
      total += v;
    }
  } else {
    for (const { nome, p } of percentuaisAplicaveis) {
      const v = percentualDe(subtotal, p);
      memoria.acrescimos.push({ nome, tipo: "percentual", parametro: p, valor: reais(v) });
      total += v;
    }
  }
  for (const { nome, c } of fixos) {
    memoria.acrescimos.push({ nome, tipo: "fixo", parametro: reais(c), valor: reais(c) });
    total += c;
  }
  if (contrato && percentuaisAplicaveis.length > 1) {
    regra.push(contrato.ajustesCumulativos ? "Percentuais aplicados um sobre o outro." : "Percentuais somados sobre o subtotal.");
  }
  if (memoria.linhas.length && total < 0) {
    pendencias.push({ tipo: "valor_negativo", texto: "Os redutores do contrato deixaram o honorário negativo." });
  }

  // 7. O resultado
  const semValor = pendencias.some((p) => SEM_VALOR.has(p.tipo));
  if (!semValor && memoria.linhas.length) {
    memoria.subtotal = reais(subtotal);
    memoria.total = reais(total);
    if (a.valorInformado != null && a.valorInformado > 0 && Math.abs(centavos(a.valorInformado) - total) > 0) {
      pendencias.push({
        tipo: "divergencia_valor",
        texto: `O valor anotado (${dinheiro(centavos(a.valorInformado))}) é diferente do calculado (${dinheiro(total)}).`,
      });
    }
  }
  const valorPrevisto = semValor || !memoria.linhas.length ? null : reais(total);
  return {
    situacao: pendencias.length ? "pendente" : "calculado",
    valorPrevisto,
    mensagem: valorPrevisto == null ? PENDENTE_DE_CONFERENCIA : pendencias.length ? CONFERIR_ANTES_DE_ENVIAR : null,
    pendencias,
    memoria,
  };
}

/** Só o que foi calculado sem pendência vai ao Financeiro sem conferência. */
export const liberaParaOFinanceiro = (r: Pick<ResultadoDoHonorario, "situacao">) => r.situacao === "calculado";

// ── Conferência de uma versão de contrato antes de publicar ────────────────

/** O que impede publicar uma versão de contrato. Vazio: pode publicar. */
export function problemasDaVersao(v: VersaoDeContrato): string[] {
  const p: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.vigenciaInicio)) p.push("Informe o início da vigência.");
  if (v.vigenciaFim && v.vigenciaFim < v.vigenciaInicio) p.push("O fim da vigência é antes do início.");
  if (v.referencia === "cbhpm" && !v.cbhpmEdicaoId) p.push("Contrato pela CBHPM precisa da edição da CBHPM.");
  const portes = Object.entries(v.valoresPorPorte);
  if (v.referencia === "propria" && !portes.length && !Object.keys(v.valoresPorProcedimento).length) {
    p.push(Object.keys(v.portesPorProcedimento).length
      ? "A tabela dá o porte de cada procedimento, mas falta o valor de cada porte (AN0 a AN8)."
      : "Contrato com tabela própria precisa de valores por porte ou por procedimento.");
  }
  for (const [codigo, porte] of Object.entries(v.portesPorProcedimento)) {
    if (!/^\d+$/.test(codigo)) p.push(`Código ${codigo} inválido: o código TUSS tem só números.`);
    if (!(Number.isInteger(porte) && porte >= 0 && porte <= 8)) p.push(`Porte do código ${codigo} fora de AN0 a AN8.`);
  }
  for (const [porte, valor] of portes) {
    if (!/^[0-8]$/.test(porte)) p.push(`Porte AN${porte} não existe: os portes vão de AN0 a AN8.`);
    if (!(typeof valor === "number" && valor >= 0)) p.push(`Valor do porte AN${porte} inválido.`);
  }
  for (const [codigo, valor] of Object.entries(v.valoresPorProcedimento)) {
    if (!/^\d+$/.test(codigo)) p.push(`Código ${codigo} inválido: o código TUSS tem só números.`);
    if (!(typeof valor === "number" && valor >= 0)) p.push(`Valor do procedimento ${codigo} inválido.`);
  }
  if (v.multiplosPercentuais && v.multiplosPercentuais.some((x) => !(x >= 0 && x <= 1000))) {
    p.push("Percentuais de procedimentos múltiplos devem estar entre 0% e 1000%.");
  }
  if (v.reajustePercentual <= -100) p.push("Reajuste não pode zerar a tabela.");
  if ((v.ajustes as unknown[]).some((a) => !ajusteValido(a))) p.push("Há adicional ou redutor incompleto.");
  return p;
}
