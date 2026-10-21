// O relatório do mês do centro cirúrgico: quantas cirurgias, e quanto tempo
// cada uma ficou em sala e na RPA.
//
// Tudo sai do que o mapa já grava a cada toque — "Entrou em sala", "Saiu da
// sala", "Alta da RPA". Nada é estimado: a cirurgia em que faltou um toque
// aparece na lista com "sem horário" e fica de fora da média, em vez de entrar
// com um número inventado.

import {
  aconteceu, compararNoMapa, contarConvenios, duracao, horaDe, hhmm, NOME_DO_DESTINO, tempos,
  type Caso, type Sala,
} from "./centro-cirurgico.ts";
import type { Celula } from "./xlsx.ts";

// ---------------------------------------------------------------------------
// O mês
// ---------------------------------------------------------------------------

/** "2026-10" é um mês; o resto não. */
export const mesValido = (s: string | null | undefined): s is string => /^\d{4}-(0[1-9]|1[0-2])$/.test(s ?? "");

/** Os dias do mês, de "2026-10-01" a "2026-10-31". */
export function diasDoMes(mes: string): string[] {
  const [a, m] = mes.split("-").map(Number);
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
}

/** O mês antes (-1) ou depois (+1). */
export function mesVizinho(mes: string, passo: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + passo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const NOME_DO_MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
/** "2026-10" → "outubro de 2026". */
export const nomeDoMes = (mes: string) => NOME_DO_MES.format(new Date(`${mes}-15T12:00:00Z`));

// ---------------------------------------------------------------------------
// As contas
// ---------------------------------------------------------------------------

/** Quantas medidas, a média e os extremos, em minutos. */
export type Estatistica = { n: number; media: number | null; menor: number | null; maior: number | null };

export function estatistica(valores: Array<number | null>): Estatistica {
  const v = valores.filter((x): x is number => x != null);
  if (!v.length) return { n: 0, media: null, menor: null, maior: null };
  return { n: v.length, media: Math.round(v.reduce((s, x) => s + x, 0) / v.length), menor: Math.min(...v), maior: Math.max(...v) };
}

/** Cada cirurgia do mês, com os tempos já contados. */
export type LinhaDoRelatorio = {
  caso: Caso;
  sala: string;
  anestesista: string;
  /** Minutos da entrada à saída da sala. */
  emSala: number | null;
  /** Minutos da saída da sala à alta da RPA. Nulo quando foi direto para a UTI. */
  naRpa: number | null;
  /** O toque que falta para o tempo sair: "saída da sala", "alta da RPA". */
  falta: string[];
};

export type Grupo = { nome: string; n: number; emSala: Estatistica };

export type RelatorioDoMes = {
  mes: string;
  feitas: number;
  canceladas: number;
  /** Agendados de dias que já passaram, sem "Entrou em sala": não se sabe se houve. */
  semRegistro: number;
  /** Agendados de hoje em diante. */
  aindaAgendados: number;
  /** Cirurgias feitas em que falta algum horário. */
  incompletas: number;
  emSala: Estatistica;
  naRpa: Estatistica;
  diretoUti: number;
  porDia: Array<{ data: string; n: number }>;
  porSala: Grupo[];
  porCirurgiao: Grupo[];
  porConvenio: Array<{ convenio: string; atos: number }>;
  porAnestesista: Array<{ nome: string; n: number }>;
  motivos: Array<{ motivo: string; n: number }>;
  linhas: LinhaDoRelatorio[];
  /** Os cancelados, na mesma forma (sem tempos). */
  listaCanceladas: LinhaDoRelatorio[];
};

/** "DR. DANILO", "Dr Danilo" e "DR DANILO" são o mesmo cirurgião. */
const chaveDoNome = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();

function agrupar(linhas: LinhaDoRelatorio[], nomeDe: (l: LinhaDoRelatorio) => string, ordem?: (nome: string) => number): Grupo[] {
  const m = new Map<string, { nome: string; minutos: Array<number | null> }>();
  for (const l of linhas) {
    const nome = nomeDe(l);
    const k = chaveDoNome(nome);
    const atual = m.get(k) ?? { nome, minutos: [] };
    atual.minutos.push(l.emSala);
    m.set(k, atual);
  }
  return [...m.values()]
    .map((g) => ({ nome: g.nome, n: g.minutos.length, emSala: estatistica(g.minutos) }))
    .sort((a, b) => (ordem ? ordem(a.nome) - ordem(b.nome) : b.n - a.n) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/**
 * O relatório de um mês.
 *
 * Feita é a cirurgia em que o paciente entrou em sala e não foi cancelado — a
 * mesma conta do resumo do dia. O tempo em sala vai da entrada à saída; o da
 * RPA, da saída à alta. Quem saiu da sala direto para a UTI não passa pela RPA
 * e não entra na média dela.
 */
export function relatorioDoMes({ mes, hoje, casos, salas, nomeDoAnestesista }: {
  mes: string;
  hoje: string;
  casos: Caso[];
  salas: Sala[];
  nomeDoAnestesista: (id: string) => string | undefined;
}): RelatorioDoMes {
  const doMes = casos.filter((c) => c.data.startsWith(`${mes}-`));
  const ordenados = [...doMes].sort((a, b) => a.data.localeCompare(b.data) || compararNoMapa(a, b));
  const salaPorId = new Map(salas.map((s) => [s.id, s]));
  const nomeDaSala = (id: string | null) => (id && salaPorId.get(id)?.nome) || "Sem sala";

  const anestesistaDe = (c: Caso) => (c.anestesista_id ? nomeDoAnestesista(c.anestesista_id) ?? "Anestesista" : "");
  const linhas: LinhaDoRelatorio[] = ordenados.filter(aconteceu).map((caso) => {
    const t = tempos(caso);
    const falta: string[] = [];
    if (!caso.entrada_sala_em) falta.push("entrada em sala");
    if (!caso.saida_sala_em) falta.push("saída da sala");
    else if (caso.etapa === "rpa" && !caso.alta_rpa_em) falta.push("alta da RPA");
    return {
      caso,
      sala: nomeDaSala(caso.sala_id),
      anestesista: anestesistaDe(caso),
      emSala: t.sala,
      naRpa: t.rpa,
      falta,
    };
  });
  const listaCanceladas: LinhaDoRelatorio[] = ordenados.filter((c) => c.etapa === "cancelado")
    .map((caso) => ({ caso, sala: nomeDaSala(caso.sala_id), anestesista: anestesistaDe(caso), emSala: null, naRpa: null, falta: [] }));
  const agendados = ordenados.filter((c) => c.etapa === "agendado" && !c.entrada_sala_em);

  const contagemPorDia = new Map<string, number>();
  for (const l of linhas) contagemPorDia.set(l.caso.data, (contagemPorDia.get(l.caso.data) ?? 0) + 1);

  const motivos = new Map<string, { motivo: string; n: number }>();
  for (const { caso: c } of listaCanceladas) {
    const motivo = c.cancelado_motivo?.trim() || "Sem motivo";
    const k = chaveDoNome(motivo);
    motivos.set(k, { motivo: motivos.get(k)?.motivo ?? motivo, n: (motivos.get(k)?.n ?? 0) + 1 });
  }

  const anestesistas = new Map<string, number>();
  for (const l of linhas) {
    const nome = l.anestesista || "Sem anestesista";
    anestesistas.set(nome, (anestesistas.get(nome) ?? 0) + 1);
  }

  const ordemDaSala = new Map(salas.map((s) => [s.nome, s.ordem]));
  return {
    mes,
    feitas: linhas.length,
    canceladas: listaCanceladas.length,
    semRegistro: agendados.filter((c) => c.data < hoje).length,
    aindaAgendados: agendados.filter((c) => c.data >= hoje).length,
    incompletas: linhas.filter((l) => l.falta.length).length,
    emSala: estatistica(linhas.map((l) => l.emSala)),
    naRpa: estatistica(linhas.map((l) => l.naRpa)),
    diretoUti: linhas.filter((l) => l.caso.saida_sala_em && !l.caso.alta_rpa_em && l.caso.destino === "uti").length,
    porDia: diasDoMes(mes).map((data) => ({ data, n: contagemPorDia.get(data) ?? 0 })),
    porSala: agrupar(linhas, (l) => l.sala, (nome) => ordemDaSala.get(nome) ?? Number.MAX_SAFE_INTEGER),
    porCirurgiao: agrupar(linhas, (l) => l.caso.cirurgiao?.trim() || "Sem cirurgião"),
    porConvenio: contarConvenios(linhas.map((l) => l.caso)),
    porAnestesista: [...anestesistas].map(([nome, n]) => ({ nome, n }))
      .sort((a, b) => Number(a.nome === "Sem anestesista") - Number(b.nome === "Sem anestesista") || b.n - a.n
        || a.nome.localeCompare(b.nome, "pt-BR")),
    motivos: [...motivos.values()].sort((a, b) => b.n - a.n || a.motivo.localeCompare(b.motivo, "pt-BR")),
    linhas,
    listaCanceladas,
  };
}

// ---------------------------------------------------------------------------
// A planilha
// ---------------------------------------------------------------------------

/** "2026-10-22" → "22/10/2026". */
export const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/**
 * A planilha do mês: uma linha por paciente do mapa, feito ou cancelado. Os
 * tempos vão em minutos, como número — o Excel soma e tira média deles; a
 * duração em "1h05" seria texto.
 */
export function planilhaDoRelatorio(r: RelatorioDoMes): Celula[][] {
  const cabecalho = ["Data", "Sala", "Marcado", "Paciente", "Idade", "Cirurgia", "Cirurgião", "Convênio", "Anestesista",
    "Entrou em sala", "Saiu da sala", "Minutos em sala", "Alta da RPA", "Minutos na RPA", "Destino", "Situação"];
  const situacao = (l: LinhaDoRelatorio) => (l.caso.etapa === "cancelado"
    ? `Cancelada: ${l.caso.cancelado_motivo?.trim() || "sem motivo"}`
    : l.falta.length ? `Feita, sem horário de ${l.falta.join(" e ")}` : "Feita");
  // Os cancelados entram no dia deles, na ordem do mapa, e não todos no fim.
  const todas = [...r.linhas, ...r.listaCanceladas]
    .sort((a, b) => a.caso.data.localeCompare(b.caso.data) || compararNoMapa(a.caso, b.caso));
  return [cabecalho, ...todas.map((l): Celula[] => {
    const c = l.caso;
    return [
      dataBR(c.data), l.sala, hhmm(c.horario) || "A/S", c.paciente, c.idade ?? "", c.procedimento, c.cirurgiao ?? "",
      c.convenio ?? "", l.anestesista, horaDe(c.entrada_sala_em), horaDe(c.saida_sala_em), l.emSala ?? "",
      horaDe(c.alta_rpa_em), l.naRpa ?? "", c.destino ? NOME_DO_DESTINO[c.destino] : "", situacao(l),
    ];
  })];
}

/** "15 min a 5h40": o mais curto e o mais longo. */
export const faixaDeTempo = (e: Estatistica) =>
  e.n ? `${duracao(e.menor)} a ${duracao(e.maior)}` : "";
