// O que a Escala afirma sobre um mês — contagens, horários e situações —
// num lugar só, testável sem a tela.
//
// A divergência que motivou este arquivo: o cartão "Plantões no mês" dizia
// 18 e a lista embaixo dizia 14, sobre o MESMO conjunto de plantões. Não era
// erro de soma: o cartão contava TURNOS DE 12 HORAS (horas ÷ 12, a unidade
// em que o fechamento paga) e a lista contava LANÇAMENTOS. Quatro plantões de
// 24h viravam oito turnos. Medido nos dados: 14 lançamentos, 216 horas,
// 18 turnos. Os três números são verdadeiros — o defeito era chamar dois
// deles de "plantões". Aqui cada um tem o seu nome.

import { emTurnos, podeConfirmar, turnosCobertos, type TurnoDoDia } from "./escala.ts";

export type PlantaoDoPainel = {
  id: string;
  perfil_id: string;
  local_id: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  horas: number;
  valor: number;
  /** false = ninguém digitou o valor ainda (o banco guarda 0 nos dois casos). */
  valor_informado?: boolean;
  situacao: string;
  pago_em: string | null;
  privado: boolean;
  confirmado_em: string | null;
};

// ── Contagem ──────────────────────────────────────────────────────────────

export type Contagem = { plantoes: number; turnos: number; horas: number };

/**
 * Plantões (lançamentos), turnos de 12h e horas do MESMO conjunto — quem
 * chama passa a lista já filtrada, e a tela usa o mesmo resultado no resumo e
 * na lista. Cancelado não conta.
 */
export function contagem(plantoes: PlantaoDoPainel[]): Contagem {
  const validos = plantoes.filter((p) => p.situacao !== "cancelado");
  const horas = validos.reduce((s, p) => s + Number(p.horas || 0), 0);
  return { plantoes: validos.length, turnos: emTurnos(horas), horas };
}

const numeroBr = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const pl = (n: number, um: string, varios: string) => `${numeroBr(n)} ${n === 1 ? um : varios}`;

/** "14 plantões · 18 turnos de 12h · 216 h" — os três, cada um com o nome certo. */
export function contagemEscrita(c: Contagem): string {
  return `${pl(c.plantoes, "plantão", "plantões")} · ${pl(c.turnos, "turno de 12h", "turnos de 12h")} · ${numeroBr(c.horas)} h`;
}

// ── Horário ───────────────────────────────────────────────────────────────

const emMinutos = (t: string) => {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
};
/** "07h", "07h30". */
export const horaBr = (t: string) => {
  const [h, m] = (t || "").split(":");
  return `${h.padStart(2, "0")}h${m && m !== "00" ? m : ""}`;
};

export const atravessaMeiaNoite = (p: Pick<PlantaoDoPainel, "hora_inicio" | "hora_fim">) =>
  emMinutos(p.hora_fim) <= emMinutos(p.hora_inicio);

/**
 * "07h–19h · 12h" ou, quando vira o dia, "19h → 07h do dia seguinte · 12h".
 * O de 24h (fim igual ao início) também vira o dia: "07h → 07h do dia
 * seguinte · 24h".
 */
export function horarioEscrito(p: Pick<PlantaoDoPainel, "hora_inicio" | "hora_fim" | "horas">): string {
  const horas = `${numeroBr(Number(p.horas))}h`;
  return atravessaMeiaNoite(p)
    ? `${horaBr(p.hora_inicio)} → ${horaBr(p.hora_fim)} do dia seguinte · ${horas}`
    : `${horaBr(p.hora_inicio)}–${horaBr(p.hora_fim)} · ${horas}`;
}

/** O intervalo real do plantão, em minutos desde a meia-noite do dia dele (em UTC, só para comparar). */
function intervalo(p: PlantaoDoPainel): [number, number] {
  const [a, m, d] = p.data.split("-").map(Number);
  const base = Date.UTC(a, m - 1, d) / 60_000;
  const ini = base + emMinutos(p.hora_inicio);
  const fim = base + emMinutos(p.hora_fim) + (atravessaMeiaNoite(p) ? 24 * 60 : 0);
  return [ini, fim];
}

// ── Situações: confirmação, execução e pagamento ──────────────────────────

export type Tom = "ok" | "atencao" | "perigo" | "neutro" | "info";
export type Situacao = { rotulo: string; tom: Tom; detalhe?: string };

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/**
 * Confirmação — quem trabalhou dizendo que trabalhou (confirmado_em).
 * A janela é a do banco (confirmacao_de_plantao_honesta): do começo do dia
 * do plantão até meia hora depois do fim.
 */
export function situacaoDaConfirmacao(p: PlantaoDoPainel, agora: Date): Situacao {
  if (p.situacao === "cancelado") return { rotulo: "Não se aplica", tom: "neutro" };
  if (p.privado) return { rotulo: "Não se aplica", tom: "neutro", detalhe: "Plantão só seu não passa por confirmação." };
  if (p.confirmado_em) return { rotulo: "Confirmado", tom: "ok", detalhe: `Confirmado em ${dataBr(p.confirmado_em)}.` };
  if (podeConfirmar(p, agora)) return { rotulo: "Pendente", tom: "atencao", detalhe: "Confirme até meia hora depois do fim do plantão." };
  const [ini] = intervalo(p);
  const agoraMin = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate(), agora.getHours(), agora.getMinutes()) / 60_000;
  if (agoraMin < ini) return { rotulo: "Aguardando o dia", tom: "neutro" };
  return { rotulo: "Não confirmado", tom: "perigo", detalhe: "A janela de confirmação fechou. O plantão continua no fechamento, marcado como não confirmado." };
}

/** Execução — o que aconteceu com o turno (situacao: escalado, realizado, cancelado). */
export function situacaoDaExecucao(p: PlantaoDoPainel): Situacao {
  switch (p.situacao) {
    case "cancelado": return { rotulo: "Cancelado", tom: "perigo" };
    case "escalado": return { rotulo: "Escalado", tom: "info" };
    // Nota emitida e pago só vêm depois de realizado.
    default: return { rotulo: "Realizado", tom: "ok" };
  }
}

/** Pagamento — o dinheiro (situacao faturado/pago, pago_em, e o valor). */
export function situacaoDoPagamento(p: PlantaoDoPainel): Situacao {
  if (p.situacao === "cancelado") return { rotulo: "Não se aplica", tom: "neutro" };
  if (p.situacao === "pago") return { rotulo: p.pago_em ? `Pago em ${dataBr(p.pago_em)}` : "Pago", tom: "ok" };
  if (p.situacao === "faturado") return { rotulo: "Nota emitida", tom: "info" };
  if (valorAusente(p)) return { rotulo: "Valor não preenchido", tom: "atencao" };
  if (Number(p.valor) === 0) return { rotulo: "Valor zero", tom: "neutro", detalhe: "R$ 0,00 informado." };
  return { rotulo: "A receber", tom: "neutro" };
}

/** Sem valor digitado — diferente de R$ 0,00 informado de propósito. */
export const valorAusente = (p: PlantaoDoPainel) =>
  p.valor_informado === false || (p.valor_informado === undefined && Number(p.valor) === 0);

// ── Pendências ────────────────────────────────────────────────────────────

export type Sobreposicao = { a: PlantaoDoPainel; b: PlantaoDoPainel };

/**
 * Plantões da MESMA pessoa cujos horários se cruzam — contando a virada do
 * dia (19h → 07h cruza com um 06h–13h do dia seguinte).
 */
export function sobreposicoes(plantoes: PlantaoDoPainel[]): Sobreposicao[] {
  const porPessoa = new Map<string, PlantaoDoPainel[]>();
  for (const p of plantoes) {
    if (p.situacao === "cancelado") continue;
    porPessoa.set(p.perfil_id, [...(porPessoa.get(p.perfil_id) ?? []), p]);
  }
  const achadas: Sobreposicao[] = [];
  for (const lista of porPessoa.values()) {
    const ord = [...lista].sort((x, y) => intervalo(x)[0] - intervalo(y)[0]);
    for (let i = 0; i < ord.length; i++) {
      const [, fimI] = intervalo(ord[i]);
      for (let j = i + 1; j < ord.length; j++) {
        const [iniJ] = intervalo(ord[j]);
        if (iniJ >= fimI) break;
        achadas.push({ a: ord[i], b: ord[j] });
      }
    }
  }
  return achadas;
}

export type Pendencias = {
  confirmacoes: PlantaoDoPainel[];
  semValor: PlantaoDoPainel[];
  sobreposicoes: Sobreposicao[];
};

/**
 * As três pendências da faixa. Confirmação e valor são de quem fez o plantão
 * (só a pessoa confirma e só ela preenche o próprio valor); sobreposição vale
 * para todos os plantões visíveis — é quem monta a escala que precisa ver.
 */
export function pendenciasDaEscala(plantoes: PlantaoDoPainel[], perfilId: string, agora: Date): Pendencias {
  const meus = plantoes.filter((p) => p.perfil_id === perfilId && p.situacao !== "cancelado");
  return {
    confirmacoes: meus.filter((p) => situacaoDaConfirmacao(p, agora).rotulo === "Pendente"),
    semValor: meus.filter(valorAusente),
    sobreposicoes: sobreposicoes(plantoes),
  };
}

// ── Filtros ───────────────────────────────────────────────────────────────

export type FiltroDeSituacao =
  | "todas" | "confirmacao_pendente" | "nao_confirmado" | "escalado" | "realizado"
  | "a_receber" | "pago" | "sem_valor" | "sobreposicao";

/** As opções do seletor de situação, agrupadas pela dimensão que filtram. */
export const OPCOES_DE_SITUACAO: { grupo: string; opcoes: [FiltroDeSituacao, string][] }[] = [
  { grupo: "Confirmação", opcoes: [["confirmacao_pendente", "Confirmação pendente"], ["nao_confirmado", "Não confirmado"]] },
  { grupo: "Execução", opcoes: [["escalado", "Escalado"], ["realizado", "Realizado"]] },
  { grupo: "Pagamento", opcoes: [["a_receber", "A receber"], ["pago", "Pago"], ["sem_valor", "Valor não preenchido"]] },
  { grupo: "Conferência", opcoes: [["sobreposicao", "Horário sobreposto"]] },
];

export type FiltrosDaEscala = { local: string; turno: "todos" | TurnoDoDia; situacao: FiltroDeSituacao };
export const FILTROS_DA_ESCALA: FiltrosDaEscala = { local: "todos", turno: "todos", situacao: "todas" };

export const filtrosAtivos = (f: FiltrosDaEscala) =>
  f.local !== FILTROS_DA_ESCALA.local || f.turno !== FILTROS_DA_ESCALA.turno || f.situacao !== FILTROS_DA_ESCALA.situacao;

/**
 * Os mesmos filtros para o resumo e para a lista — quem chama aplica isto uma
 * vez e passa o resultado aos dois. `perfilId` delimita o "valor não
 * preenchido": só quem fez o plantão preenche o próprio valor.
 */
export function filtrarEscala<T extends PlantaoDoPainel>(
  plantoes: T[], f: FiltrosDaEscala, agora: Date, perfilId = "",
): T[] {
  const sobrepostos = f.situacao === "sobreposicao"
    ? new Set(sobreposicoes(plantoes).flatMap((s) => [s.a.id, s.b.id]))
    : null;
  return plantoes.filter((p) => {
    if (f.local !== "todos" && (f.local === "sem" ? p.local_id !== null : p.local_id !== f.local)) return false;
    if (f.turno !== "todos" && !turnosCobertos(p.hora_inicio, p.hora_fim).includes(f.turno)) return false;
    switch (f.situacao) {
      case "confirmacao_pendente": return situacaoDaConfirmacao(p, agora).rotulo === "Pendente";
      case "nao_confirmado": return situacaoDaConfirmacao(p, agora).rotulo === "Não confirmado";
      case "escalado": return p.situacao === "escalado";
      case "realizado": return situacaoDaExecucao(p).rotulo === "Realizado";
      case "a_receber": return !["pago", "cancelado"].includes(p.situacao);
      case "pago": return p.situacao === "pago";
      case "sem_valor": return p.perfil_id === perfilId && p.situacao !== "cancelado" && valorAusente(p);
      case "sobreposicao": return sobrepostos!.has(p.id);
      default: return true;
    }
  });
}

// ── Período: a semana ─────────────────────────────────────────────────────
// Datas em "aaaa-mm-dd", contadas em UTC só para somar dias sem que o horário
// de verão ou o fuso mudem o dia.

const emUTC = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const paraIso = (d: Date) => d.toISOString().slice(0, 10);

export const somarDias = (iso: string, n: number) => {
  const d = emUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return paraIso(d);
};

/** O domingo da semana — o calendário da Escala começa no domingo. */
export const inicioDaSemana = (iso: string) => somarDias(iso, -emUTC(iso).getUTCDay());

export const diasDaSemana = (inicio: string) => Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
/** "qui" */
export const diaDaSemanaCurto = (iso: string) => DIAS_CURTOS[emUTC(iso).getUTCDay()];
/** "10/09" */
export const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "27/09 a 03/10/2026" — a semana, com o ano uma vez só. */
export function semanaEscrita(inicio: string): string {
  const fim = somarDias(inicio, 6);
  return `${dataCurta(inicio)}${inicio.slice(0, 4) !== fim.slice(0, 4) ? `/${inicio.slice(0, 4)}` : ""} a ${dataCurta(fim)}/${fim.slice(0, 4)}`;
}
