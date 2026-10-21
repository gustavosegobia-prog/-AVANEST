// Mapa cirúrgico: as regras, sem tela e sem banco.
//
// O enfermeiro chefe monta o mapa do dia — sala, horário, paciente, cirurgia,
// convênio, anestesista — e o paciente anda por quatro etapas: agendado, em
// sala, RPA e alta. Cada passo guarda a hora. No fim do dia, o mapa vira a
// lista dos atos anestésicos por anestesista e por convênio, que é de onde o
// anestesista fatura.
//
// Tudo aqui é função pura de propósito: a tela, a impressão e os testes fazem
// a mesma conta, e o banco (202610210001) é quem tem a palavra final sobre
// quem pode gravar.

import { ALDRETE, somaAldrete } from "./evolucao/lista-da-folha.ts";

export { ALDRETE, somaAldrete };

export type Etapa = "agendado" | "em_sala" | "rpa" | "concluido" | "cancelado";
export type Destino = "quarto" | "uti" | "casa" | "outro";

export type Sala = { id: string; nome: string; ordem: number; ativa: boolean };

export type Caso = {
  id: string;
  data: string;               // "AAAA-MM-DD"
  sala_id: string | null;
  horario: string | null;     // "HH:MM" ou "HH:MM:SS", como o Postgres devolve
  paciente: string;
  idade: number | null;
  prontuario: string | null;
  procedimento: string;
  cirurgiao: string | null;
  convenio: string | null;
  anestesista_id: string | null;
  etapa: Etapa;
  destino: Destino | null;
  entrada_sala_em: string | null;
  inicio_cirurgia_em: string | null;
  fim_cirurgia_em: string | null;
  saida_sala_em: string | null;
  alta_rpa_em: string | null;
  aldrete_alta: number | null;
  cancelado_motivo: string | null;
  observacoes: string | null;
  created_at?: string;
};

/** As colunas que a tela lê — a mesma lista no servidor e na recarga do navegador. */
export const CAMPOS_DO_CASO =
  "id, data, sala_id, horario, paciente, idade, prontuario, procedimento, cirurgiao, convenio, anestesista_id, etapa, destino, "
  + "entrada_sala_em, inicio_cirurgia_em, fim_cirurgia_em, saida_sala_em, alta_rpa_em, aldrete_alta, cancelado_motivo, observacoes, created_at";

export const NOME_DA_ETAPA: Record<Etapa, string> = {
  agendado: "Agendado",
  em_sala: "Em sala",
  rpa: "RPA",
  concluido: "Alta",
  cancelado: "Cancelado",
};

/** A ordem do dia de trabalho — é a dos contadores no alto do mapa. */
export const ETAPAS_DO_FLUXO: Etapa[] = ["agendado", "em_sala", "rpa", "concluido"];

export const NOME_DO_DESTINO: Record<Destino, string> = {
  quarto: "Quarto / enfermaria",
  uti: "UTI",
  casa: "Casa (alta hospitalar)",
  outro: "Outro",
};

/** O Aldrete abaixo do qual a alta da RPA pede uma confirmação a mais. */
export const ALDRETE_PARA_ALTA = 9;

// ---------------------------------------------------------------------------
// Horário
// ---------------------------------------------------------------------------

/** "07:30:00" → "07:30"; vazio → "". */
export const hhmm = (h: string | null | undefined) => (h ?? "").slice(0, 5);

/**
 * O instante de um horário do dia, no fuso do serviço.
 *
 * O mesmo -03:00 fixo da ficha (lib/evolucao/folha.ts): o Brasil não tem
 * horário de verão desde 2019, e o banco guarda o instante em UTC.
 */
export const instanteDe = (data: string, hora: string) => Date.parse(`${data}T${hhmm(hora)}:00-03:00`);

/** A hora de um instante, em "HH:MM", no fuso do serviço. */
export function horaDe(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms - 3 * 3600000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Minutos entre dois instantes; nulo se faltar um ou se o fim vier antes. */
export function minutosEntre(inicio: string | number | null | undefined, fim: string | number | null | undefined): number | null {
  if (inicio == null || fim == null) return null;
  const a = typeof inicio === "number" ? inicio : Date.parse(inicio);
  const b = typeof fim === "number" ? fim : Date.parse(fim);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.floor((b - a) / 60000);
}

/** 25 → "25 min"; 65 → "1h05"; 120 → "2h". */
export function duracao(min: number | null): string {
  if (min == null) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/**
 * Há quanto tempo o paciente está na etapa em que está — o número que o
 * cartão mostra. "Em sala há 1h12" é o que o enfermeiro chefe procura quando
 * pensa no próximo da fila.
 */
export function tempoNaEtapa(c: Caso, agoraMs: number): number | null {
  if (c.etapa === "em_sala") return minutosEntre(c.entrada_sala_em, agoraMs);
  if (c.etapa === "rpa") return minutosEntre(c.saida_sala_em, agoraMs);
  return null;
}

/** Tempo de sala e de RPA, para o cartão concluído e o resumo. */
export function tempos(c: Caso) {
  return {
    sala: minutosEntre(c.entrada_sala_em, c.saida_sala_em),
    cirurgia: minutosEntre(c.inicio_cirurgia_em, c.fim_cirurgia_em),
    rpa: c.alta_rpa_em ? minutosEntre(c.saida_sala_em, c.alta_rpa_em) : null,
  };
}

// ---------------------------------------------------------------------------
// As etapas
// ---------------------------------------------------------------------------

/** O botão principal do cartão: o próximo passo do paciente. */
export type Passo = { acao: "entrar" | "sair" | "alta"; rotulo: string };

export function proximoPasso(c: Caso): Passo | null {
  if (c.etapa === "agendado") return { acao: "entrar", rotulo: "Entrou em sala" };
  if (c.etapa === "em_sala") return { acao: "sair", rotulo: "Saiu da sala" };
  if (c.etapa === "rpa") return { acao: "alta", rotulo: "Alta da RPA" };
  return null;
}

/** O que gravar em cada passo. O horário vem da tela, já em ISO. */
export type Mudanca = Partial<Pick<Caso,
  "etapa" | "destino" | "entrada_sala_em" | "saida_sala_em" | "alta_rpa_em" | "aldrete_alta" | "cancelado_motivo">>;

export function entrarEmSala(quando: string): Mudanca {
  return { etapa: "em_sala", entrada_sala_em: quando };
}

/** Sai da sala para a RPA (o caminho comum) ou direto para a UTI. */
export function sairDaSala(quando: string, para: "rpa" | "uti"): Mudanca {
  return para === "uti"
    ? { etapa: "concluido", saida_sala_em: quando, destino: "uti" }
    : { etapa: "rpa", saida_sala_em: quando, destino: null };
}

export function altaDaRpa(quando: string, aldrete: number | null, destino: Destino): Mudanca {
  return { etapa: "concluido", alta_rpa_em: quando, aldrete_alta: aldrete, destino };
}

export function cancelar(motivo: string): Mudanca {
  return { etapa: "cancelado", cancelado_motivo: motivo.trim() };
}

/**
 * Voltar um passo: o toque errado de "Entrou em sala" no paciente da sala ao
 * lado. Volta para a etapa anterior e apaga só a hora daquele passo — as
 * anteriores continuam. O histórico do banco guarda que houve a volta.
 */
export function desfazer(c: Caso): Mudanca | null {
  if (c.etapa === "em_sala") return { etapa: "agendado", entrada_sala_em: null };
  if (c.etapa === "rpa") return { etapa: "em_sala", saida_sala_em: null };
  if (c.etapa === "concluido") {
    // Da sala direto para a UTI: volta para a sala. Da RPA: volta para a RPA.
    if (!c.alta_rpa_em) return { etapa: "em_sala", saida_sala_em: null, destino: null };
    return { etapa: "rpa", alta_rpa_em: null, aldrete_alta: null, destino: null };
  }
  if (c.etapa === "cancelado") {
    return { etapa: c.saida_sala_em ? "rpa" : c.entrada_sala_em ? "em_sala" : "agendado", cancelado_motivo: null };
  }
  return null;
}

/** O que o botão de voltar diz, para a pessoa saber o que vai desfazer. */
export function rotuloDoDesfazer(c: Caso): string | null {
  if (c.etapa === "em_sala") return "Voltar para agendado";
  if (c.etapa === "rpa") return "Voltar para em sala";
  if (c.etapa === "concluido") return c.alta_rpa_em ? "Voltar para a RPA" : "Voltar para em sala";
  if (c.etapa === "cancelado") return "Desfazer o cancelamento";
  return null;
}

/**
 * Confere o horário de um passo antes de gravar. O banco recusa a hora que
 * anda para trás; aqui a mensagem sai em português e antes do clique.
 */
export function conferirHorario(c: Caso, acao: Passo["acao"], quandoMs: number, agoraMs: number): string | null {
  if (Number.isNaN(quandoMs)) return "Horário inválido.";
  if (quandoMs > agoraMs + 5 * 60000) return "O horário não pode ser depois de agora.";
  const antes = acao === "sair" ? c.entrada_sala_em : acao === "alta" ? c.saida_sala_em : null;
  if (antes && quandoMs < Date.parse(antes)) {
    return acao === "sair"
      ? `A saída não pode ser antes da entrada em sala (${horaDe(antes)}).`
      : `A alta não pode ser antes da saída da sala (${horaDe(antes)}).`;
  }
  return null;
}

/**
 * O instante de um horário digitado num passo. O paciente que entrou às 23h e
 * saiu à 1h: a saída digitada como "01:00" é do dia seguinte. Se a hora cair
 * antes da etapa anterior e somar um dia resolver, soma.
 */
export function instanteDoPasso(c: Caso, acao: Passo["acao"], hora: string, agoraMs: number): number {
  const antes = acao === "sair" ? c.entrada_sala_em : acao === "alta" ? c.saida_sala_em : null;
  const base = antes ? dataDoInstante(antes) : c.data;
  let ms = instanteDe(base, hora);
  if (antes && ms < Date.parse(antes) && ms + 86400000 <= agoraMs + 5 * 60000) ms += 86400000;
  return ms;
}

/** A data local ("AAAA-MM-DD") de um instante, no fuso do serviço. */
export function dataDoInstante(iso: string): string {
  return new Date(Date.parse(iso) - 3 * 3600000).toISOString().slice(0, 10);
}

/** Aviso — não trava — da alta com Aldrete baixo. */
export function avisoDoAldrete(total: number | null): string | null {
  if (total == null) return null;
  return total < ALDRETE_PARA_ALTA
    ? `Aldrete ${total}: abaixo de ${ALDRETE_PARA_ALTA}. Confirme a alta com o anestesista.`
    : null;
}

// ---------------------------------------------------------------------------
// O cadastro
// ---------------------------------------------------------------------------

export type FormDoCaso = {
  data: string; sala_id: string; horario: string; paciente: string; idade: string;
  prontuario: string; procedimento: string; cirurgiao: string; convenio: string;
  anestesista_id: string; observacoes: string;
};

export const formVazio = (data: string, sala_id = ""): FormDoCaso => ({
  data, sala_id, horario: "", paciente: "", idade: "", prontuario: "", procedimento: "",
  cirurgiao: "", convenio: "", anestesista_id: "", observacoes: "",
});

export function formDoCaso(c: Caso): FormDoCaso {
  return {
    data: c.data, sala_id: c.sala_id ?? "", horario: hhmm(c.horario), paciente: c.paciente,
    idade: c.idade == null ? "" : String(c.idade), prontuario: c.prontuario ?? "",
    procedimento: c.procedimento, cirurgiao: c.cirurgiao ?? "", convenio: c.convenio ?? "",
    anestesista_id: c.anestesista_id ?? "", observacoes: c.observacoes ?? "",
  };
}

const limpo = (s: string) => s.replace(/\s+/g, " ").trim();
const ouNulo = (s: string) => limpo(s) || null;

/**
 * Valida e transforma o formulário no que o banco grava. Só paciente,
 * cirurgia e data são obrigatórios: o mapa da véspera nasce incompleto, e
 * exigir o anestesista na hora de marcar faria a enfermagem inventar um.
 */
export function linhaDoForm(f: FormDoCaso):
  { ok: true; linha: Omit<Caso, "id" | "etapa" | "destino" | "entrada_sala_em" | "inicio_cirurgia_em" | "fim_cirurgia_em" | "saida_sala_em" | "alta_rpa_em" | "aldrete_alta" | "cancelado_motivo"> }
  | { ok: false; erro: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) return { ok: false, erro: "Informe a data." };
  if (!limpo(f.paciente)) return { ok: false, erro: "Informe o nome do paciente." };
  if (!limpo(f.procedimento)) return { ok: false, erro: "Informe a cirurgia." };
  if (f.horario && !/^\d{2}:\d{2}$/.test(f.horario)) return { ok: false, erro: "Horário inválido." };
  let idade: number | null = null;
  if (f.idade.trim()) {
    idade = Number(f.idade.trim());
    if (!Number.isInteger(idade) || idade < 0 || idade > 130) return { ok: false, erro: "Idade inválida." };
  }
  return {
    ok: true,
    linha: {
      data: f.data, sala_id: f.sala_id || null, horario: f.horario || null,
      paciente: limpo(f.paciente), idade, prontuario: ouNulo(f.prontuario),
      procedimento: limpo(f.procedimento), cirurgiao: ouNulo(f.cirurgiao), convenio: ouNulo(f.convenio),
      anestesista_id: f.anestesista_id || null, observacoes: ouNulo(f.observacoes),
    },
  };
}

// ---------------------------------------------------------------------------
// Quem está de plantão
// ---------------------------------------------------------------------------

export type PlantaoDaEscala = { data: string; hora_inicio: string; hora_fim: string; perfil_id: string | null; situacao?: string };

/**
 * Os anestesistas de plantão num horário, pela escala da casa.
 *
 * O plantão de 24h começa às 7h e acaba às 7h do dia seguinte: a cirurgia das
 * 5h é do plantão de ONTEM. Fim igual ou antes do início é virada de dia, como
 * no resto da escala. Sem horário marcado, vale o começo do dia de trabalho
 * (7h): é a pergunta "quem está hoje".
 */
export function anestesistasDePlantao(plantoes: PlantaoDaEscala[], data: string, horario: string | null): string[] {
  const alvo = instanteDe(data, hhmm(horario) || "07:00");
  const quem: string[] = [];
  for (const p of plantoes) {
    if (!p.perfil_id || p.situacao === "cancelado") continue;
    const ini = instanteDe(p.data, p.hora_inicio);
    let fim = instanteDe(p.data, p.hora_fim);
    if (fim <= ini) fim += 86400000;
    if (alvo >= ini && alvo < fim && !quem.includes(p.perfil_id)) quem.push(p.perfil_id);
  }
  return quem;
}

// ---------------------------------------------------------------------------
// O mapa do dia
// ---------------------------------------------------------------------------

const chaveHorario = (c: Caso) => hhmm(c.horario) || "99:99";

/** A fila de uma sala: pelo horário marcado, e quem não tem horário no fim. */
export function ordenarCasos(casos: Caso[]): Caso[] {
  return [...casos].sort((a, b) =>
    chaveHorario(a).localeCompare(chaveHorario(b))
    || (a.created_at ?? "").localeCompare(b.created_at ?? "")
    || a.id.localeCompare(b.id));
}

export type ColunaDoMapa = { sala: Sala | null; casos: Caso[] };

/**
 * As colunas do mapa: uma por sala ativa, na ordem cadastrada, e uma "Sem
 * sala" no fim quando houver paciente sem sala. A sala desativada que ainda
 * tem paciente neste dia continua aparecendo — sumir com ela esconderia
 * gente do mapa.
 */
export function colunasDoMapa(salas: Sala[], casos: Caso[]): ColunaDoMapa[] {
  const ordenadas = [...salas].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
  const porSala = new Map<string, Caso[]>();
  const semSala: Caso[] = [];
  const conhecidas = new Set(salas.map((s) => s.id));
  for (const c of casos) {
    if (c.sala_id && conhecidas.has(c.sala_id)) porSala.set(c.sala_id, [...(porSala.get(c.sala_id) ?? []), c]);
    else semSala.push(c);
  }
  const colunas: ColunaDoMapa[] = ordenadas
    .filter((s) => s.ativa || porSala.has(s.id))
    .map((s) => ({ sala: s, casos: ordenarCasos(porSala.get(s.id) ?? []) }));
  if (semSala.length) colunas.push({ sala: null, casos: ordenarCasos(semSala) });
  return colunas;
}

/** Quantos em cada etapa — os contadores do alto do mapa. */
export function contagemPorEtapa(casos: Caso[]): Record<Etapa, number> {
  const n: Record<Etapa, number> = { agendado: 0, em_sala: 0, rpa: 0, concluido: 0, cancelado: 0 };
  for (const c of casos) n[c.etapa] += 1;
  return n;
}

// ---------------------------------------------------------------------------
// O resumo do dia: o faturamento do anestesista
// ---------------------------------------------------------------------------

/** Ato que aconteceu: o paciente entrou em sala e não foi cancelado. */
export const aconteceu = (c: Caso) => c.etapa !== "cancelado" && (c.etapa !== "agendado" || Boolean(c.entrada_sala_em));

export type LinhaDoResumo = { anestesistaId: string | null; nome: string; atos: Caso[]; porConvenio: Array<{ convenio: string; atos: number }> };

export type ResumoDoDia = {
  atos: number;
  porAnestesista: LinhaDoResumo[];
  porConvenio: Array<{ convenio: string; atos: number }>;
  pendencias: Array<{ casoId: string; paciente: string; falta: string }>;
  cancelados: number;
  naoIniciados: number;
};

const SEM_CONVENIO = "Sem convênio";

/** "Dra. Ana Lima" → "Ana Lima", para ordenar pelo nome e não pelo título. */
const semTitulo = (nome: string) => nome.replace(/^\s*dr(a)?\.?\s+/i, "");

function contarConvenios(casos: Caso[]) {
  const m = new Map<string, number>();
  for (const c of casos) {
    const k = c.convenio?.trim() || SEM_CONVENIO;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([convenio, atos]) => ({ convenio, atos }))
    .sort((a, b) => b.atos - a.atos || a.convenio.localeCompare(b.convenio, "pt-BR"));
}

/**
 * O que o anestesista leva para faturar: os atos do dia, dele, por convênio.
 *
 * Conta o paciente que entrou em sala, e não só o que teve alta: o que ainda
 * está na RPA no fim do plantão já foi anestesiado. O cancelado antes de
 * entrar não conta. As pendências são o que impede a cobrança — ato sem
 * anestesista não tem de quem cobrar, ato sem convênio não tem para quem.
 */
export function resumoDoDia(casos: Caso[], nomeDe: (id: string) => string | undefined): ResumoDoDia {
  const feitos = ordenarCasos(casos.filter(aconteceu));
  const grupos = new Map<string, Caso[]>();
  for (const c of feitos) {
    const k = c.anestesista_id ?? "";
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }
  const porAnestesista: LinhaDoResumo[] = [...grupos.entries()]
    .map(([id, atos]) => ({
      anestesistaId: id || null,
      nome: id ? nomeDe(id) ?? "Anestesista" : "Sem anestesista",
      atos,
      porConvenio: contarConvenios(atos),
    }))
    // Quem tem nome primeiro, em ordem alfabética pelo nome — "Dra. Ana" antes
    // de "Dr. Bruno" —; "sem anestesista" no fim.
    .sort((a, b) => Number(!a.anestesistaId) - Number(!b.anestesistaId)
      || semTitulo(a.nome).localeCompare(semTitulo(b.nome), "pt-BR"));
  const pendencias: ResumoDoDia["pendencias"] = [];
  for (const c of feitos) {
    const falta = [!c.anestesista_id && "anestesista", !c.convenio?.trim() && "convênio"].filter(Boolean) as string[];
    if (falta.length) pendencias.push({ casoId: c.id, paciente: c.paciente, falta: `Falta ${falta.join(" e ")}` });
  }
  return {
    atos: feitos.length,
    porAnestesista,
    porConvenio: contarConvenios(feitos),
    pendencias,
    cancelados: casos.filter((c) => c.etapa === "cancelado").length,
    naoIniciados: casos.filter((c) => c.etapa === "agendado" && !c.entrada_sala_em).length,
  };
}

// ---------------------------------------------------------------------------
// O painel da TV do corredor
// ---------------------------------------------------------------------------

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e"]);

/**
 * "Maria Aparecida da Souza" → "M. A. S.".
 *
 * A TV fica no corredor, e quem passa lê. O nome inteiro é dado de saúde de
 * quem está sendo operado; as iniciais com a idade e a cirurgia bastam para a
 * equipe saber de quem se trata.
 */
export function iniciaisDoPaciente(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((p) => p && !PARTICULAS.has(p.toLowerCase()));
  if (!partes.length) return "—";
  return partes.map((p) => `${p.charAt(0).toLocaleUpperCase("pt-BR")}.`).join(" ");
}

/** Minutos de atraso de quem ainda não entrou; nulo se não está atrasado. */
export function atraso(c: Caso, agoraMs: number, tolerancia = 15): number | null {
  if (c.etapa !== "agendado" || !c.horario) return null;
  const min = minutosEntre(instanteDe(c.data, c.horario), agoraMs);
  return min != null && min > tolerancia ? min : null;
}

export type SituacaoNaTv = "agendado" | "atrasado" | "em_sala" | "rpa" | "concluido" | "cancelado";
export type LinhaDaTv = { caso: Caso; situacao: SituacaoNaTv; minutos: number | null };

/**
 * A lista da TV: todos os pacientes do dia numa fila só, e a cor diz onde
 * cada um está.
 *
 * A ordem é a do mapa — pelo horário marcado —, e quem entra em sala muda de
 * cor no MESMO lugar: a fila não pula enquanto se olha para ela. Quem sai para
 * a RPA desce para o fim, com outra cor, por ordem de chegada; depois vêm as
 * altas, e as canceladas por último.
 */
export function linhasDaTv(casos: Caso[], agoraMs: number): LinhaDaTv[] {
  const chave = (c: Caso) => hhmm(c.horario) || horaDe(c.entrada_sala_em) || "99:99";
  const porHorario = (a: Caso, b: Caso) => chave(a).localeCompare(chave(b)) || a.paciente.localeCompare(b.paciente, "pt-BR");
  const porInstante = (k: (c: Caso) => string | null) => (a: Caso, b: Caso) => (k(a) ?? "").localeCompare(k(b) ?? "");
  const fila = casos.filter((c) => c.etapa === "agendado" || c.etapa === "em_sala").sort(porHorario);
  const rpa = casos.filter((c) => c.etapa === "rpa").sort(porInstante((c) => c.saida_sala_em));
  const altas = casos.filter((c) => c.etapa === "concluido").sort(porInstante((c) => c.alta_rpa_em ?? c.saida_sala_em));
  const canceladas = casos.filter((c) => c.etapa === "cancelado").sort(porHorario);
  return [...fila, ...rpa, ...altas, ...canceladas].map((caso) => {
    if (caso.etapa === "em_sala" || caso.etapa === "rpa") {
      return { caso, situacao: caso.etapa, minutos: tempoNaEtapa(caso, agoraMs) };
    }
    if (caso.etapa === "agendado") {
      const min = atraso(caso, agoraMs);
      return { caso, situacao: min != null ? "atrasado" : "agendado", minutos: min };
    }
    return { caso, situacao: caso.etapa, minutos: null };
  });
}
