// A fila de salvamento da folha.
//
// No centro cirúrgico a rede cai. O registro nasce no aparelho com o id
// definitivo (crypto.randomUUID) e entra numa fila guardada no localStorage;
// a fila envia em ordem e só tira da fila o que o banco confirmou. Se a resposta
// se perder no caminho, o reenvio do MESMO id bate na chave primária — o banco
// devolve "já existe", e isso conta como salvo. Nada se duplica, nada se perde.
//
// A TELA NUNCA DIZ "SALVO" ANTES DA CONFIRMAÇÃO. O registro pendente aparece
// na folha (o médico precisa ver o ponto que acabou de tocar), mas marcado como
// pendente, e o contador de sincronização mostra quantos faltam.

export type Pendente = {
  id: string;
  evolucao_id: string;
  tipo: string;
  momento: string;
  dados: Record<string, unknown>;
  origem: string;
  substitui_id: string | null;
  anulado: boolean;
  motivo: string | null;
  tentativas: number;
  /** Erro definitivo (dado recusado pelo servidor): não reenvia sozinho. */
  recusado?: string;
};

export type Resultado = "salvo" | "tentar_de_novo" | "recusado" | "conflito";

/**
 * O que fazer com a resposta do banco.
 *  - 23505 na chave primária: já estava salvo (reenvio) → salvo.
 *  - 23505 no índice de `substitui_id`: outra pessoa corrigiu o mesmo ponto
 *    antes → conflito; a tela recarrega e mostra a versão dela.
 *  - REGISTRO_INVALIDO, FOLHA_ENCERRADA, permissão: recusado, com o motivo.
 *  - Rede, tempo esgotado, 5xx: tentar de novo.
 */
export function classificarErro(erro: { code?: string; message?: string; details?: string } | null): Resultado {
  if (!erro) return "salvo";
  const texto = `${erro.message ?? ""} ${erro.details ?? ""}`;
  if (erro.code === "23505") {
    return texto.includes("substitui") ? "conflito" : "salvo";
  }
  if (/REGISTRO_INVALIDO|REGISTRO_IMUTAVEL|FOLHA_ENCERRADA|FOLHA_INEXISTENTE|row-level security|42501|23514|23503/.test(
    `${texto} ${erro.code ?? ""}`)) return "recusado";
  return "tentar_de_novo";
}

/** Espera antes da próxima tentativa: 1, 2, 4, 8… até 30 s. */
export const esperaMs = (tentativas: number) => Math.min(30000, 1000 * 2 ** Math.max(0, tentativas));

/** O motivo legível de um "recusado", sem o prefixo técnico. */
export function motivoLegivel(mensagem: string): string {
  const m = mensagem.match(/REGISTRO_INVALIDO:\s*(.+)/);
  if (m) return m[1].trim();
  if (mensagem.includes("FOLHA_ENCERRADA")) return "A folha foi encerrada; reabra para corrigir.";
  if (/row-level security|42501/.test(mensagem)) return "Sem permissão para registrar nesta folha.";
  return mensagem;
}

const chave = (evolucaoId: string) => `avanest:evolucao-fila:${evolucaoId}`;

export function lerFila(evolucaoId: string): Pendente[] {
  try {
    const v = JSON.parse(localStorage.getItem(chave(evolucaoId)) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function gravarFila(evolucaoId: string, fila: readonly Pendente[]) {
  try {
    if (fila.length) localStorage.setItem(chave(evolucaoId), JSON.stringify(fila));
    else localStorage.removeItem(chave(evolucaoId));
  } catch {
    // Sem localStorage (aba privada cheia): a fila vive só na memória. A tela
    // continua mostrando o contador de pendentes, então ninguém fecha achando
    // que salvou.
  }
}
