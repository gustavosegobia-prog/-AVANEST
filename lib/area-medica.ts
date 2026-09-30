// A área médica — o dia, o escopo e as pendências — num lugar só, testável
// sem a tela.
//
// O QUE É O QUE, e de onde vem (nada aqui é deduzido do horário):
//
//   Agendado          agendamento em agendado/confirmado, sem chegada.
//   Aguardando        a recepção registrou a chegada (status presente) e
//                     ainda não há avaliação ligada ao agendamento.
//   Em atendimento    chegada registrada E avaliação em rascunho ligada a
//                     este agendamento — o paciente está sendo avaliado.
//   Avaliação em      QUALQUER avaliação em rascunho, com ou sem agendamento,
//   andamento         de hoje ou de semanas atrás. É trabalho a concluir; não
//                     quer dizer que o paciente está na sala.
//
// As pendências são só as VERIFICADAS nos registros. Lembretes da rotina
// (medicamentos, exames) são textos fixos e ficam separados, com a origem
// dita; o que o sistema não registra (envio e leitura de orientações,
// assinatura) é declarado como indisponível, e não como zero.

import { etapaDaConsulta, FORA_DO_FLUXO, type Andamento, type ConsultaDaAgenda, type Etapa } from "./recepcao.ts";

export type AvaliacaoResumo = {
  id: string;
  patient_id: string;
  created_by: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  concluida_at: string | null;
  local_atendimento_id: string | null;
};

export type ConsultaMedica = ConsultaDaAgenda & {
  hospital: string | null;
  procedimento: string | null;
};

/** A etapa de cada agendamento, lida das avaliações ligadas a ele. */
export function andamentoPelasAvaliacoes(
  consultas: ConsultaDaAgenda[], avaliacoes: Map<string, AvaliacaoResumo>,
): Map<string, Andamento> {
  const m = new Map<string, Andamento>();
  for (const c of consultas) {
    const av = c.avaliacao_id ? avaliacoes.get(c.avaliacao_id) : undefined;
    m.set(c.id, {
      etapa: av?.status === "concluida" ? "concluido" : av?.status === "rascunho" ? "em_atendimento" : null,
      medico_id: av?.created_by ?? null,
    });
  }
  return m;
}

export const etapaMedica = (c: ConsultaDaAgenda, and?: Andamento | null): Etapa => etapaDaConsulta(c, and);

// ── Escopo ─────────────────────────────────────────────────────────────────

export type Escopo = { pessoa: "meus" | "equipe"; local: "todos" | "atual" };

/**
 * O escopo é um RECORTE DE VISÃO, não uma permissão: o que a pessoa pode ler
 * já foi decidido no banco (RLS de avaliacoes e agendamentos). Aqui só se
 * escolhe o que mostrar do que ela pode ler.
 */
export function avaliacaoNoEscopo(a: AvaliacaoResumo, e: Escopo, perfilId: string, localAtivoId: string | null) {
  if (e.pessoa === "meus" && a.created_by !== perfilId) return false;
  if (e.local === "atual" && localAtivoId && a.local_atendimento_id !== localAtivoId) return false;
  return true;
}

/**
 * Na agenda, "meus" = marcados para mim, ou já em avaliação comigo, ou ainda
 * sem médico definido (quem abre a agenda precisa ver o que ninguém assumiu).
 * O agendamento não registra o local de atendimento — só o nome do hospital,
 * digitado —, então o recorte de local não vale para a agenda, e a tela diz.
 */
export function consultaNoEscopo(c: ConsultaDaAgenda, and: Andamento | undefined, e: Escopo, perfilId: string) {
  if (e.pessoa === "equipe") return true;
  const medico = c.medico_id ?? and?.medico_id ?? null;
  return !medico || medico === perfilId;
}

export function descricaoDoEscopo(e: Escopo, nomeDoLocal: string | null): string {
  const quem = e.pessoa === "meus" ? "Seus atendimentos" : "Toda a equipe";
  const onde = e.local === "atual" && nomeDoLocal ? `avaliações de ${nomeDoLocal}` : "todos os locais";
  return `${quem} · ${onde}`;
}

// ── O dia ──────────────────────────────────────────────────────────────────

export type ResumoDoDia = { agendados: number; aguardando: number; emAtendimento: number; emAndamento: number };

export function resumoDoDia(
  doDia: ConsultaDaAgenda[], andamento: Map<string, Andamento>, rascunhos: AvaliacaoResumo[],
): ResumoDoDia {
  const ativos = doDia.filter((c) => !FORA_DO_FLUXO(c.status) && c.status !== "faltou");
  const etapa = (c: ConsultaDaAgenda) => etapaMedica(c, andamento.get(c.id));
  return {
    agendados: ativos.filter((c) => etapa(c) === "agendado").length,
    aguardando: ativos.filter((c) => etapa(c) === "aguardando").length,
    emAtendimento: ativos.filter((c) => etapa(c) === "em_atendimento").length,
    emAndamento: rascunhos.length,
  };
}

/** As avaliações para retomar: todas as em rascunho, da alteração mais recente para a mais antiga. */
export const paraRetomar = (avaliacoes: AvaliacaoResumo[]) =>
  avaliacoes.filter((a) => a.status === "rascunho").sort((a, b) => b.updated_at.localeCompare(a.updated_at));

/** O próximo atendimento: o primeiro de hoje, pela hora, que ainda não terminou nem saiu da agenda. */
export function proximoAtendimento<T extends ConsultaDaAgenda>(doDia: T[], andamento: Map<string, Andamento>): T | null {
  return doDia
    .filter((c) => !FORA_DO_FLUXO(c.status) && c.status !== "faltou" && etapaMedica(c, andamento.get(c.id)) !== "concluido")
    .sort((a, b) => (a.horario ?? "99").localeCompare(b.horario ?? "99"))[0] ?? null;
}

// ── Agenda: período ────────────────────────────────────────────────────────

export type Periodo = { tipo: "hoje" | "amanha" | "semana" | "dia"; dia?: string };

const somar = (iso: string, n: number) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};
const curta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function intervaloDoPeriodo(p: Periodo, hoje: string): { de: string; ate: string; rotulo: string } {
  if (p.tipo === "amanha") { const d = somar(hoje, 1); return { de: d, ate: d, rotulo: `Amanhã, ${curta(d)}` }; }
  if (p.tipo === "semana") { const ate = somar(hoje, 6); return { de: hoje, ate, rotulo: `Próximos 7 dias: ${curta(hoje)} a ${curta(ate)}` }; }
  if (p.tipo === "dia" && p.dia) return { de: p.dia, ate: p.dia, rotulo: p.dia === hoje ? `Hoje, ${curta(hoje)}` : `Dia ${curta(p.dia)}/${p.dia.slice(0, 4)}` };
  return { de: hoje, ate: hoje, rotulo: `Hoje, ${curta(hoje)}` };
}

// ── Pendências verificadas ─────────────────────────────────────────────────

export type Pendencia = {
  id: string;
  tipo: "avaliacao_aberta" | "chegou_sem_avaliacao" | "consulta_sem_desfecho";
  patientId: string;
  motivo: string;
  /** ISO do instante (ou da data) que comprova a pendência. */
  data: string;
  rotuloDaData: string;
  responsavel: string | null;
  acao: "continuar" | "iniciar" | "ver_na_agenda";
  avaliacaoId?: string;
  agendamentoId?: string;
  localId?: string | null;
};

/** Consultas passadas sem chegada nem falta: só as dos últimos 30 dias. */
export const JANELA_SEM_DESFECHO = 30;

export function pendenciasVerificadas(
  avaliacoes: AvaliacaoResumo[], consultas: ConsultaDaAgenda[], hoje: string,
): Pendencia[] {
  const lista: Pendencia[] = [];
  for (const a of paraRetomar(avaliacoes)) {
    lista.push({
      id: `av-${a.id}`, tipo: "avaliacao_aberta", patientId: a.patient_id,
      motivo: "Avaliação iniciada e ainda não concluída",
      data: a.updated_at, rotuloDaData: "Última alteração", responsavel: a.created_by,
      acao: "continuar", avaliacaoId: a.id, localId: a.local_atendimento_id,
    });
  }
  const limite = somar(hoje, -JANELA_SEM_DESFECHO);
  for (const c of consultas) {
    if (c.status === "presente" && !c.avaliacao_id && c.data <= hoje) {
      lista.push({
        id: `ch-${c.id}`, tipo: "chegou_sem_avaliacao", patientId: c.patient_id,
        motivo: "Chegada registrada pela recepção, sem avaliação iniciada",
        data: c.status_at ?? c.data, rotuloDaData: c.status_at ? "Chegada" : "Consulta", responsavel: c.status_by ?? null,
        acao: "iniciar", agendamentoId: c.id,
      });
    } else if ((c.status === "agendado" || c.status === "confirmado") && c.data < hoje && c.data >= limite) {
      lista.push({
        id: `sd-${c.id}`, tipo: "consulta_sem_desfecho", patientId: c.patient_id,
        motivo: "Consulta de dia anterior sem chegada nem falta registradas",
        data: c.data, rotuloDaData: "Consulta", responsavel: null,
        acao: "ver_na_agenda", agendamentoId: c.id,
      });
    }
  }
  return lista;
}

/** Lembretes da rotina: não vêm dos dados de nenhum paciente, e a tela diz isso. */
export const LEMBRETES_GERAIS = [
  { titulo: "Medicamentos de uso contínuo", texto: "Revise anticoagulantes e agonistas de GLP-1 durante a anamnese." },
  { titulo: "Exames e pareceres", texto: "Confira exames e pareceres solicitados antes de concluir a avaliação." },
];
export const ORIGEM_DOS_LEMBRETES =
  "Lembrete fixo do AVANEST para a rotina. Não é uma verificação dos dados de nenhum paciente e não substitui o julgamento clínico.";

/** O que o sistema não registra — e por isso não vira pendência nem contagem. */
export const INFORMACOES_INDISPONIVEIS = [
  { titulo: "Envio das orientações", texto: "Os atalhos de WhatsApp, e-mail e SMS abrem o aplicativo, mas o envio não é registrado. O AVANEST não sabe se a mensagem saiu." },
  { titulo: "Leitura pelo paciente", texto: "Não há confirmação de leitura: gerar o documento não quer dizer que ele foi entregue ou lido." },
  { titulo: "Assinatura", texto: "A assinatura é feita no papel impresso; o sistema não registra documento assinado." },
];

// ── Documentos ─────────────────────────────────────────────────────────────

/** Os documentos que uma avaliação concluída gera (ver documentos/print-documents.tsx). */
export const TIPOS_DE_DOCUMENTO = [
  ["assessment", "Avaliação pré-anestésica"],
  ["consent", "Termo de consentimento"],
  ["guidance", "Orientações ao paciente"],
] as const;
export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number][0];

// ── Identificação ──────────────────────────────────────────────────────────

/** "***.456.789-**" — o suficiente para distinguir homônimos sem expor o CPF inteiro. */
export function cpfMascarado(cpf: string | null | undefined): string | null {
  const d = String(cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : null;
}
