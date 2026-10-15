/**
 * A SITUAÇÃO DE CADA PROTOCOLO: quem revisou o quê, e o que o médico vê.
 *
 * O conteúdo nasce no código (versionado no git, com testes). A aprovação
 * mora no banco, num histórico em que só se acrescenta: cada linha é uma
 * decisão — enviar para revisão, aprovar, pedir atualização, suspender —
 * com o instantâneo exato do protocolo naquela hora, quem decidiu e o CRM.
 *
 * A ASSINATURA liga as duas pontas. É um resumo do conteúdo inteiro: mudou uma
 * vírgula numa dose, mudou a assinatura, e a aprovação antiga deixa de valer
 * para a versão nova. Mas não some: o médico continua vendo a versão aprovada
 * (o instantâneo do banco) até o revisor aprovar a nova. É o "alterações nas
 * recomendações geram aviso de revisão, sem mudar sozinhas um protocolo
 * aprovado".
 */

import type { Protocolo, Situacao } from "./tipos.ts";

export type RegistroDeRevisao = {
  id: string;
  protocolo: string;
  versao: number;
  assinatura: string;
  situacao: Situacao;
  conteudo: unknown;
  observacao: string | null;
  autorNome: string;
  autorCrm: string | null;
  autorPapel: "admin" | "editor" | "revisor";
  criadoEm: string;
};

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  rascunho: "Rascunho",
  pendente: "Pendente de revisão científica",
  aprovado: "Aprovado",
  necessita_atualizacao: "Necessita atualização",
  suspenso: "Suspenso",
};

/** JSON com as chaves em ordem: o mesmo conteúdo dá sempre o mesmo texto. */
export function jsonEstavel(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonEstavel).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${jsonEstavel((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/**
 * A assinatura: cyrb53, 53 bits em hexadecimal. Serve para notar mudança, não
 * para segurança — quem escreve no histórico já passou pela checagem de papel
 * no banco.
 */
export function assinatura(p: Protocolo): string {
  const texto = jsonEstavel(p);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** O instantâneo do banco tem a forma de um protocolo? (Quem escreve é revisor, mas o dado vem de fora.) */
export function ehProtocolo(v: unknown, id?: string): v is Protocolo {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  const listas = ["reconhecer", "agirAgora", "medicamentos", "volumes", "pensarEm", "depois", "divergencias", "referencias", "sinonimos", "sinais"];
  return typeof p.id === "string" && (id === undefined || p.id === id)
    && typeof p.titulo === "string" && typeof p.versao === "number"
    && listas.every((k) => Array.isArray(p[k]));
}

export type Estado = {
  /** A situação da versão que está no código agora. */
  daVersaoAtual: Situacao;
  /** O conteúdo que o médico usa: a versão aprovada (do código ou o instantâneo). Nulo: nada aprovado. */
  emUso: Protocolo | null;
  /** A decisão que pôs `emUso` em uso, com revisor e data. */
  aprovacao: RegistroDeRevisao | null;
  /** A versão em uso foi marcada para atualização pelo revisor. */
  precisaAtualizar: boolean;
  /** O protocolo inteiro está suspenso. */
  suspenso: RegistroDeRevisao | null;
  /** Há no código uma versão diferente da aprovada, esperando revisão. */
  versaoNovaEsperando: boolean;
  historico: RegistroDeRevisao[];
};

/**
 * Lê o histórico em ordem e devolve o estado. Regras:
 * - "aprovado" põe aquele instantâneo em uso (e tira a suspensão);
 * - "necessita_atualizacao" sobre a versão em uso mantém em uso, com aviso;
 * - "suspenso" tira tudo de uso até uma nova aprovação;
 * - "rascunho" e "pendente" só mudam a situação da versão a que se referem.
 * A versão do código sem registro nenhum nasce "pendente": a etapa 1 do
 * módulo entra para revisão, e nada é aprovado sem um revisor.
 */
export function resolverEstado(protocolo: Protocolo, todos: readonly RegistroDeRevisao[]): Estado {
  const historico = todos.filter((r) => r.protocolo === protocolo.id)
    .sort((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm));
  let aprovacao: RegistroDeRevisao | null = null;
  let precisaAtualizar = false;
  let suspenso: RegistroDeRevisao | null = null;
  for (const r of historico) {
    if (r.situacao === "aprovado" && ehProtocolo(r.conteudo, protocolo.id)) {
      aprovacao = r; precisaAtualizar = false; suspenso = null;
    } else if (r.situacao === "necessita_atualizacao" && aprovacao && r.assinatura === aprovacao.assinatura) {
      precisaAtualizar = true;
    } else if (r.situacao === "suspenso") {
      suspenso = r; aprovacao = null; precisaAtualizar = false;
    }
  }

  const atual = assinatura(protocolo);
  const daAtual = historico.filter((r) => r.assinatura === atual).at(-1);
  let daVersaoAtual: Situacao = daAtual?.situacao ?? "pendente";
  if (suspenso) daVersaoAtual = "suspenso";
  else if (aprovacao && aprovacao.assinatura === atual) daVersaoAtual = precisaAtualizar ? "necessita_atualizacao" : "aprovado";
  else if (daVersaoAtual === "aprovado" || daVersaoAtual === "necessita_atualizacao") daVersaoAtual = "pendente";

  const emUso = aprovacao ? (aprovacao.assinatura === atual ? protocolo : aprovacao.conteudo as Protocolo) : null;
  return {
    daVersaoAtual, emUso, aprovacao, precisaAtualizar, suspenso,
    versaoNovaEsperando: Boolean(aprovacao && aprovacao.assinatura !== atual),
    historico,
  };
}

/** O que cada papel pode registrar. A mesma regra está no banco; aqui ela só esconde os botões. */
export const PODE_REGISTRAR: Record<"admin" | "editor" | "revisor", Situacao[]> = {
  editor: ["rascunho", "pendente"],
  admin: ["rascunho", "pendente", "suspenso"],
  revisor: ["rascunho", "pendente", "aprovado", "necessita_atualizacao", "suspenso"],
};
