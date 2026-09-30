// A agenda da Recepção — etapas, ações permitidas, indicadores e busca —
// num lugar só, testável sem a tela.
//
// OS ESTADOS SÃO OS DO BANCO (agendamentos.status): agendado, confirmado,
// presente, faltou, cancelado, reagendado. As etapas do atendimento são LIDAS
// deles, e não gravadas à parte:
//
//   Agendado ─ registrar chegada ─▶ Aguardando ─▶ Em atendimento ─▶ Concluído
//   (agendado/confirmado)           (presente)    (avaliação em      (avaliação
//                                                  andamento)         concluída)
//
// "Chegou" é o momento em que a chegada é registrada (status_at do presente);
// a partir dele o paciente está aguardando. Em atendimento e Concluído vêm da
// avaliação — que a recepção não lê: a função andamento_da_agenda devolve só a
// etapa, sem nenhum campo clínico.
//
// Confirmação, falta e cancelamento são coisas diferentes e continuam
// separadas: confirmação é um detalhe do Agendado (o paciente disse que vem);
// falta e cancelamento tiram a consulta do fluxo, cada um com o seu nome.

import { dataLocal } from "./data-local.ts";

export type StatusDaAgenda = "agendado" | "confirmado" | "presente" | "faltou" | "cancelado" | "reagendado";

export type ConsultaDaAgenda = {
  id: string;
  patient_id: string;
  avaliacao_id: string | null;
  data: string;
  horario: string | null;
  status: string;
  medico_id?: string | null;
  status_at?: string | null;
  status_by?: string | null;
};

export type Andamento = { etapa: "em_atendimento" | "concluido" | null; medico_id: string | null };

export type Etapa = "agendado" | "aguardando" | "em_atendimento" | "concluido" | "faltou" | "cancelado" | "reagendado";

export const ETAPAS_DO_FLUXO: [Etapa, string][] = [
  ["agendado", "Agendado"],
  ["aguardando", "Aguardando"],
  ["em_atendimento", "Em atendimento"],
  ["concluido", "Concluído"],
];

export const NOME_DA_ETAPA: Record<Etapa, string> = {
  agendado: "Agendado", aguardando: "Aguardando", em_atendimento: "Em atendimento", concluido: "Concluído",
  faltou: "Faltou", cancelado: "Cancelado", reagendado: "Reagendado",
};

export const FORA_DO_FLUXO = (status: string) => ["cancelado", "reagendado"].includes(status);

export function etapaDaConsulta(c: ConsultaDaAgenda, andamento?: Andamento | null): Etapa {
  if (c.status === "cancelado" || c.status === "reagendado" || c.status === "faltou") return c.status;
  if (andamento?.etapa === "concluido") return "concluido";
  if (andamento?.etapa === "em_atendimento") return "em_atendimento";
  if (c.status === "presente") return "aguardando";
  return "agendado";
}

/** Só para o Agendado: o paciente confirmou ou ainda não. */
export const confirmacaoDaConsulta = (c: ConsultaDaAgenda): "confirmada" | "pendente" | null =>
  c.status === "confirmado" ? "confirmada" : c.status === "agendado" ? "pendente" : null;

/** O médico da consulta: o marcado nela, ou quem iniciou a avaliação. */
export const medicoDaConsulta = (c: ConsultaDaAgenda, andamento?: Andamento | null) =>
  c.medico_id ?? andamento?.medico_id ?? null;

// ── Transições ─────────────────────────────────────────────────────────────

/**
 * A MESMA regra de public.transicao_de_agendamento_valida (202609300016) —
 * o banco recusa o que esta função recusa. Aqui ela serve para não oferecer
 * o botão; lá, para garantir. Devolve null quando pode, senão o motivo.
 */
export function motivoParaRecusar(de: string, para: string, data: string, temAvaliacao: boolean, hoje: string): string | null {
  if (de === para) return null;
  if (de === "reagendado") return "Esta consulta foi reagendada: altere a nova marcação.";
  if ((para === "presente" || para === "faltou") && data > hoje)
    return "Chegada e falta só podem ser registradas no dia da consulta ou depois.";
  if (de === "presente" && temAvaliacao) return "O atendimento já começou: a chegada não pode mais ser desfeita.";
  if (de === "presente" && !["agendado", "confirmado"].includes(para))
    return "Paciente já chegou: desfaça a chegada antes de mudar a situação.";
  if ((de === "faltou" || de === "cancelado") && !["agendado", "reagendado"].includes(para))
    return "Reative a consulta antes de mudar a situação.";
  if (para === "reagendado" && !["agendado", "confirmado", "faltou", "cancelado"].includes(de))
    return "Só consultas que ainda não aconteceram podem ser reagendadas.";
  return null;
}

export type Acao =
  | "confirmar" | "desfazer_confirmacao" | "chegada" | "desfazer_chegada"
  | "falta" | "reagendar" | "cancelar" | "reativar";

/** Para qual situação cada ação leva ("reagendar" usa a função própria). */
export const DESTINO_DA_ACAO: Record<Acao, StatusDaAgenda> = {
  confirmar: "confirmado", desfazer_confirmacao: "agendado", chegada: "presente", desfazer_chegada: "agendado",
  falta: "faltou", reagendar: "reagendado", cancelar: "cancelado", reativar: "agendado",
};

export const NOME_DA_ACAO: Record<Acao, string> = {
  confirmar: "Confirmar", desfazer_confirmacao: "Desfazer confirmação", chegada: "Registrar chegada",
  desfazer_chegada: "Desfazer chegada", falta: "Registrar falta", reagendar: "Reagendar",
  cancelar: "Cancelar consulta", reativar: "Reativar",
};

/**
 * As ações que fazem sentido AGORA para esta consulta — só as que o banco
 * aceitaria, e só as que mudam algo. Na ordem em que aparecem: a primeira é a
 * ação principal da linha.
 */
export function acoesDaConsulta(c: ConsultaDaAgenda, hoje: string): Acao[] {
  const candidatas: Acao[] = ({
    agendado: ["chegada", "confirmar", "reagendar", "falta", "cancelar"],
    confirmado: ["chegada", "reagendar", "desfazer_confirmacao", "falta", "cancelar"],
    presente: ["desfazer_chegada"],
    faltou: ["reagendar", "reativar"],
    cancelado: ["reagendar", "reativar"],
    reagendado: [],
  } as Record<string, Acao[]>)[c.status] ?? [];
  return candidatas.filter((a) =>
    motivoParaRecusar(c.status, DESTINO_DA_ACAO[a], c.data, Boolean(c.avaliacao_id), hoje) === null);
}

// ── Indicadores ────────────────────────────────────────────────────────────

export type IndicadoresDoDia = {
  previstas: number; confirmacoesPendentes: number; aguardando: number;
  emAtendimento: number; concluidas: number; faltas: number; canceladas: number;
};

export function indicadoresDoDia(
  doDia: ConsultaDaAgenda[], andamento: Map<string, Andamento>,
): IndicadoresDoDia {
  const etapa = (c: ConsultaDaAgenda) => etapaDaConsulta(c, andamento.get(c.id));
  const ativas = doDia.filter((c) => !FORA_DO_FLUXO(c.status));
  return {
    previstas: ativas.length,
    confirmacoesPendentes: ativas.filter((c) => c.status === "agendado").length,
    aguardando: ativas.filter((c) => etapa(c) === "aguardando").length,
    emAtendimento: ativas.filter((c) => etapa(c) === "em_atendimento").length,
    concluidas: ativas.filter((c) => etapa(c) === "concluido").length,
    faltas: doDia.filter((c) => c.status === "faltou").length,
    canceladas: doDia.filter((c) => c.status === "cancelado").length,
  };
}

/** Totais do mês — área secundária. */
export function totaisDoMes(todas: ConsultaDaAgenda[], mes: string) {
  const doMes = todas.filter((c) => c.data.startsWith(mes));
  return {
    marcadas: doMes.filter((c) => !FORA_DO_FLUXO(c.status)).length,
    compareceram: doMes.filter((c) => c.status === "presente").length,
    faltas: doMes.filter((c) => c.status === "faltou").length,
    canceladas: doMes.filter((c) => c.status === "cancelado").length,
    reagendadas: doMes.filter((c) => c.status === "reagendado").length,
  };
}

/** A próxima data DEPOIS de `dia` com consulta ativa — para o estado vazio. */
export function proximaDataComConsultas(todas: ConsultaDaAgenda[], dia: string): string | null {
  const datas = todas.filter((c) => c.data > dia && !FORA_DO_FLUXO(c.status)).map((c) => c.data).sort();
  return datas[0] ?? null;
}

export const ordemDaAgenda = (a: ConsultaDaAgenda, b: ConsultaDaAgenda) =>
  (a.horario ?? "99").localeCompare(b.horario ?? "99") || a.id.localeCompare(b.id);

// ── Busca ──────────────────────────────────────────────────────────────────

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const digitos = (t: string | null | undefined) => String(t ?? "").replace(/\D/g, "");

export type PacienteBuscavel = { id: string; nome: string; cpf: string | null; telefone: string | null };

/**
 * Nome (sem acento, em qualquer parte), CPF ou telefone (só os números, em
 * qualquer formato). Três dígitos ou mais contam como número; menos que isso
 * procuraria "1" em todo CPF.
 */
export function buscarPacientes<T extends PacienteBuscavel>(pacientes: T[], termo: string, limite = 8): T[] {
  const t = termo.trim();
  if (t.length < 2) return [];
  const num = digitos(t);
  const texto = semAcento(t);
  const porNumero = num.length >= 3 && num.length === t.replace(/[\s.\-()/]/g, "").length;
  return pacientes.filter((p) => porNumero
    ? digitos(p.cpf).includes(num) || digitos(p.telefone).includes(num)
    : semAcento(p.nome).includes(texto)).slice(0, limite);
}

export const formatarCPF = (cpf: string | null) => {
  const d = digitos(cpf);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf || "CPF não informado";
};
export const formatarTelefone = (tel: string | null) => {
  const d = digitos(tel);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel || "telefone não informado";
};

// ── Datas e horários ───────────────────────────────────────────────────────

export const somarDiasIso = (iso: string, n: number) => {
  const [a, m, d] = iso.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return x.toISOString().slice(0, 10);
};

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
/** "quarta-feira, 30/09/2026" */
export function dataPorExtenso(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return `${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
export const dataCurtaBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** "09:30" a partir de "09:30:00"; hora de um instante no fuso do navegador. */
export const horaCurta = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
// No fuso do serviço, e não no da máquina: a tela é montada primeiro no
// servidor (UTC) e depois no navegador, e as duas horas precisam bater.
export const horaDoInstante = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
export const momentoBr = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

const paraMinutos = (time?: string | null) => {
  const [h, m] = String(time ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
const paraHorario = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00`;

/**
 * O próximo horário livre da agenda: de 30 em 30 minutos, das 08h30, com
 * almoço das 12h às 13h30. Hoje, a partir de agora. Mesma regra que o
 * cadastro de paciente sempre usou — saiu de dashboard-client para ser
 * compartilhada com Agendar e Reagendar.
 */
export function proximoHorarioLivre(
  data: string, consultas: { horario: string | null; status: string }[], agora = new Date(),
): string {
  const manha = 8 * 60 + 30, almoco = 12 * 60, tarde = 13 * 60 + 30, passo = 30;
  let candidato = manha;
  if (data === dataLocal(agora)) {
    const minuto = agora.getHours() * 60 + agora.getMinutes() + (agora.getSeconds() > 0 || agora.getMilliseconds() > 0 ? 1 : 0);
    if (minuto <= manha) candidato = manha;
    else if (minuto < almoco) {
      candidato = Math.ceil(minuto / passo) * passo;
      if (candidato >= almoco) candidato = tarde;
    } else if (minuto <= tarde) candidato = tarde;
    else candidato = Math.ceil(minuto / passo) * passo;
  }
  const ocupados = new Set(consultas.filter((c) => !FORA_DO_FLUXO(c.status))
    .map((c) => paraMinutos(c.horario)).filter((m): m is number => m !== null));
  while (ocupados.has(candidato)) {
    candidato += passo;
    if (candidato >= almoco && candidato < tarde) candidato = tarde;
  }
  return paraHorario(candidato);
}

/** Já existe consulta ativa neste horário (fora a própria)? */
export const horarioOcupado = (
  consultas: { id: string; data: string; horario: string | null; status: string }[],
  data: string, horario: string, excetoId?: string,
) => consultas.some((c) => c.id !== excetoId && c.data === data && !FORA_DO_FLUXO(c.status)
  && horaCurta(c.horario) === horaCurta(horario));
