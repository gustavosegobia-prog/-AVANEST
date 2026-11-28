// A auditoria em linguagem de gente.
//
// Os eventos são gravados por gatilhos e funções do banco, cada um com o seu
// vocabulário ("update" num local, "perfil_atualizado", "saiu_da_escala").
// Este arquivo traduz — sem inventar: evento sem rótulo conhecido aparece
// com o nome técnico legível, e o "antes → depois" só aparece quando o
// evento gravou os dois lados (a partir de 202609300014 para perfis).

import { rotuloDaFuncao } from "./equipe.ts";

export type EventoDeAuditoria = {
  id: string;
  actor_id: string | null;
  entidade: string | null;
  entidade_id: string | null;
  acao: string;
  detalhes: Record<string, unknown> | null;
  dados_anteriores?: Record<string, unknown> | null;
  dados_novos?: Record<string, unknown> | null;
  created_at: string;
};

/** Rótulo por entidade + ação ("local_atendimento:update") ou só pela ação. */
const ROTULOS: Record<string, string> = {
  "local_atendimento:insert": "Local cadastrado",
  "local_atendimento:update": "Local alterado",
  "local_atendimento:delete": "Local excluído",
  organizacao_criada: "Organização criada",
  nome_alterado: "Nome da organização alterado",
  assinatura_alterada: "Assinatura alterada",
  assinatura_vinculada: "Assinatura vinculada",
  plano_reservado: "Plano reservado",
  pagamento_registrado: "Pagamento registrado",
  perfil_atualizado: "Cadastro ou acesso alterado",
  usuario_excluido: "Cadastro excluído",
  usuario_convidado: "Convite enviado por e-mail",
  convite_reenviado: "Convite reenviado",
  profissional_sem_acesso_criado: "Profissional cadastrado sem acesso",
  convite_criado: "Convite por link criado",
  convite_aceito: "Convite aceito",
  entrou_na_escala: "Entrou na escala",
  saiu_da_escala: "Saiu da escala",
  avaliacao_excluida: "Avaliação excluída",
  avaliacao_concluida: "Avaliação concluída",
  concluida: "Avaliação concluída",
  documentos_impressos: "Documentos impressos",
  segunda_via_impressa: "Segunda via da ficha anestésica impressa",
  // A ficha anestésica (28/11/2026): antes saía o nome técnico, "cabecalho".
  "evolucao_anestesica:cabecalho": "Ficha anestésica alterada",
  "evolucao_anestesica:encerrar": "Ficha anestésica encerrada",
  "evolucao_anestesica:excluir": "Ficha anestésica excluída",
  "evolucao_anestesica:reabrir": "Ficha anestésica reaberta",
  presenca_confirmada: "Presença confirmada",
  status_alterado: "Situação do agendamento alterada",
  periodo_conferido: "Período conferido",
  periodo_fechado: "Período fechado",
  periodo_reaberto: "Período reaberto",
  lancamento_automatico: "Lançamento criado automaticamente",
  excluido: "Lançamento excluído",
  pagamento_estornado: "Pagamento estornado",
  producao_enviada: "Produção enviada ao financeiro",
  marcado_como_privado: "Plantão marcado como privado",
  local_corrigido: "Local do plantão corrigido",
  troca_aceita: "Troca de plantão aceita",
  troca_recusada: "Troca de plantão recusada",
};

export function rotuloDaAcao(e: Pick<EventoDeAuditoria, "entidade" | "acao">): string {
  return ROTULOS[`${e.entidade}:${e.acao}`] ?? ROTULOS[e.acao] ?? e.acao.replaceAll("_", " ");
}

/**
 * Grupos para o filtro "Tipo de ação". Cada grupo filtra por ENTIDADE no
 * banco — é o que dá para aplicar na consulta, sem trazer tudo para filtrar
 * na tela.
 */
export const GRUPOS_DE_ACAO: { id: string; rotulo: string; entidades: string[] }[] = [
  { id: "equipe", rotulo: "Equipe e acessos", entidades: ["perfil", "convite"] },
  { id: "locais", rotulo: "Locais de atendimento", entidades: ["local_atendimento"] },
  { id: "organizacao", rotulo: "Organização e plano", entidades: ["instituicao", "campanha", "assinatura_mp"] },
  { id: "clinico", rotulo: "Avaliações, fichas e agenda", entidades: ["avaliacao", "agendamento", "evolucao_anestesica"] },
  { id: "escala", rotulo: "Escala e plantões", entidades: ["plantao"] },
  { id: "financeiro", rotulo: "Financeiro", entidades: ["financeiro_atendimento", "financeiro_periodo", "producao"] },
];

/** As entidades administrativas — as do resumo "últimas alterações". */
export const ENTIDADES_ADMINISTRATIVAS = ["perfil", "convite", "local_atendimento", "instituicao"];

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/** Sobre o quê — a pessoa, o local, o paciente, a competência. */
export function sobreOEvento(e: EventoDeAuditoria, nomes: Map<string, string>, pacienteDaFicha?: Map<string, string>): string {
  const d = e.detalhes ?? {};
  if (e.entidade === "evolucao_anestesica") {
    const paciente = e.entidade_id ? pacienteDaFicha?.get(e.entidade_id) : undefined;
    return paciente ? `ficha de ${paciente}` : texto(d.paciente) ? `ficha de ${texto(d.paciente)}` : "ficha anestésica";
  }
  if (texto(d.paciente)) return `paciente ${texto(d.paciente)}`;
  if (texto(d.periodo)) {
    const periodo = texto(d.periodo).split("-").reverse().join("/");
    return `competência ${periodo}${texto(d.motivo) ? ` — motivo: ${texto(d.motivo)}` : ""}`;
  }
  if (texto(d.nome)) return texto(d.nome);
  if (e.entidade === "perfil" && e.entidade_id && nomes.get(e.entidade_id)) return nomes.get(e.entidade_id)!;
  if (texto(d.email)) return texto(d.email);
  return (e.entidade ?? "").replaceAll("_", " ");
}

/** Quem fez. O nome gravado no evento vale mais: o perfil pode ter sido excluído. */
export function autorDoEvento(e: EventoDeAuditoria, nomes: Map<string, string>): string {
  const d = e.detalhes ?? {};
  return texto(d.excluida_por) || (e.actor_id ? nomes.get(e.actor_id) : null) || (e.actor_id ? "Pessoa removida" : "Sistema");
}

const ROTULO_DO_CAMPO: Record<string, string> = {
  nome: "Nome", role: "Função", status: "Situação", permissoes: "Áreas", crm: "CRM",
  rqe: "RQE", atuacao_medica: "Profissão", ativo: "Situação do local",
};

function legivel(campo: string, v: unknown): string {
  // Profissão antes do vazio: NULL ali quer dizer "não informada", não "—".
  if (campo === "atuacao_medica") return v === true ? "Médico(a)" : v === false ? "Outra profissão" : "Não informada";
  if (v === null || v === undefined || v === "") return "—";
  if (campo === "role") return rotuloDaFuncao(String(v));
  if (campo === "status") return v === "ativo" ? "Ativo" : "Desativado";
  if (campo === "ativo") return v ? "Ativo" : "Arquivado";
  if (Array.isArray(v)) return v.length ? v.map((x) => rotuloDaFuncao(String(x))).join(", ") : "nenhuma";
  return String(v);
}

/** O que mudou, campo a campo — só quando o evento gravou antes e depois. */
export function diferencas(e: EventoDeAuditoria): { campo: string; de: string; para: string }[] {
  const antes = e.dados_anteriores, depois = e.dados_novos;
  if (!antes || !depois) return [];
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(depois)])];
  return campos
    .filter((c) => JSON.stringify(antes[c] ?? null) !== JSON.stringify(depois[c] ?? null))
    .map((c) => ({ campo: ROTULO_DO_CAMPO[c] ?? c, de: legivel(c, antes[c]), para: legivel(c, depois[c]) }));
}

// ── A ficha anestésica no histórico (28/11/2026) ────────────────────────────
// Cada campo mexido no cabeçalho da ficha grava um evento "cabecalho", com os
// campos novos em `detalhes`: 2.565 eventos em 116 fichas, uns 22 por ficha,
// que afogavam o resto do histórico. Aqui eles ganham nome em português e as
// alterações seguidas da mesma ficha, pela mesma pessoa, viram uma linha só.

const CAMPO_DA_FICHA: Record<string, string> = {
  peso_kg: "Peso", altura_cm: "Altura", asa: "ASA", asa_emergencia: "Emergência", emergencia: "Emergência",
  alergias: "Alergias", nega_alergia: "Nega alergia", cirurgiao: "Cirurgião", segundo_cirurgiao: "2º cirurgião",
  auxiliar: "Auxiliar", equipe: "Equipe", procedimento: "Procedimento", local_atendimento: "Local",
  local_atendimento_id: "Local", observacoes: "Observações", consumo: "Consumo", posicoes: "Posição",
  protecoes: "Proteções", saida: "Saída da sala", tecnicas: "Técnica", tecnica_detalhes: "Detalhes da técnica",
  anestesia_anterior: "Anestesia anterior", ap_circulatorio: "Ap. circulatório", ap_digestivo: "Ap. digestivo",
  ap_endocrino: "Ap. endócrino", ap_respiratorio: "Ap. respiratório", convenio: "Convênio", creatinina: "Creatinina",
  diagnostico: "Diagnóstico", estado_mental: "Estado mental", glicemia: "Glicemia", hematocrito: "Hematócrito",
  hemoglobina: "Hemoglobina", jejum_horas: "Jejum", medicacao_uso: "Medicação em uso", observacoes_pre: "Obs. pré-anestésicas",
  pa: "Pressão arterial", plaquetas: "Plaquetas", pulso: "Pulso", respiracao: "Respiração", tap_inr: "TAP/INR",
  temperatura: "Temperatura", tipo_sanguineo: "Tipo sanguíneo",
};

/** "papel_pa" → "Pressão arterial"; o que não tem nome conhecido vai legível. */
export function nomeDoCampoDaFicha(chave: string): string {
  const k = chave.replace(/^papel_/, "");
  return CAMPO_DA_FICHA[k] ?? k.replaceAll("_", " ");
}

/** O valor novo, curto: lista e objeto não viram JSON na tela. */
function valorCurto(v: unknown): string {
  if (v === null || v === undefined || v === "") return "apagado";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (Array.isArray(v)) return v.every((x) => typeof x === "string") ? (v.length ? v.join(", ") : "nenhum") : "alterado";
  if (typeof v === "object") return "alterado";
  const t = String(v);
  return t.length > 80 ? `${t.slice(0, 79)}…` : t;
}

/** Os campos que o evento da ficha mudou, com o valor novo (o antigo não é gravado). */
export function camposDaFicha(e: EventoDeAuditoria): { campo: string; valor: string }[] {
  if (e.entidade !== "evolucao_anestesica" || e.acao !== "cabecalho") return [];
  const vistos = new Set<string>();
  const saida: { campo: string; valor: string }[] = [];
  for (const [k, v] of Object.entries(e.detalhes ?? {})) {
    const campo = nomeDoCampoDaFicha(k);
    if (vistos.has(campo)) continue;
    vistos.add(campo);
    saida.push({ campo, valor: valorCurto(v) });
  }
  return saida;
}

export type GrupoDeEventos = { principal: EventoDeAuditoria; eventos: EventoDeAuditoria[] };

/** Quanto tempo entre duas alterações ainda conta como a mesma sessão na ficha. */
export const JANELA_DO_GRUPO_MS = 30 * 60_000;

/**
 * Junta as alterações seguidas do cabeçalho da mesma ficha, pela mesma pessoa,
 * com menos de 30 minutos entre uma e outra. A lista vem do mais novo para o
 * mais antigo; o principal do grupo é o mais novo. Qualquer outro evento fica
 * sozinho, como antes.
 */
export function agruparEventos(eventos: readonly EventoDeAuditoria[]): GrupoDeEventos[] {
  const grupos: GrupoDeEventos[] = [];
  const juntavel = (e: EventoDeAuditoria) => e.entidade === "evolucao_anestesica" && e.acao === "cabecalho" && Boolean(e.entidade_id);
  for (const e of eventos) {
    const ultimo = grupos[grupos.length - 1];
    const anterior = ultimo?.eventos[ultimo.eventos.length - 1];
    if (ultimo && anterior && juntavel(e) && juntavel(ultimo.principal)
      && e.entidade_id === ultimo.principal.entidade_id && e.actor_id === ultimo.principal.actor_id
      && Date.parse(anterior.created_at) - Date.parse(e.created_at) <= JANELA_DO_GRUPO_MS) {
      ultimo.eventos.push(e);
      continue;
    }
    grupos.push({ principal: e, eventos: [e] });
  }
  return grupos;
}

/** Os campos do grupo inteiro, cada um com o valor mais recente. */
export function camposDoGrupo(g: GrupoDeEventos): { campo: string; valor: string }[] {
  const porCampo = new Map<string, string>();
  for (const e of g.eventos) {
    for (const { campo, valor } of camposDaFicha(e)) if (!porCampo.has(campo)) porCampo.set(campo, valor);
  }
  return [...porCampo].map(([campo, valor]) => ({ campo, valor }));
}
