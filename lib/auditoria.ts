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
  { id: "clinico", rotulo: "Avaliações e agenda", entidades: ["avaliacao", "agendamento"] },
  { id: "escala", rotulo: "Escala e plantões", entidades: ["plantao"] },
  { id: "financeiro", rotulo: "Financeiro", entidades: ["financeiro_atendimento", "financeiro_periodo", "producao"] },
];

/** As entidades administrativas — as do resumo "últimas alterações". */
export const ENTIDADES_ADMINISTRATIVAS = ["perfil", "convite", "local_atendimento", "instituicao"];

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/** Sobre o quê — a pessoa, o local, o paciente, a competência. */
export function sobreOEvento(e: EventoDeAuditoria, nomes: Map<string, string>): string {
  const d = e.detalhes ?? {};
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
