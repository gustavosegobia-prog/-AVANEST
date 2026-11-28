// O tipo sanguíneo e o Rh da gestante, numa linha (27/11/2026). Vai em alerta
// vermelho na ficha pré-anestésica — na tela, junto da alergia, e na folha
// impressa —, porque o Rh negativo pede imunoglobulina anti-D e muda a
// reserva de sangue. Os campos só existem com a gestação marcada.

/** "tipo sanguíneo O · Rh negativo", ou vazio (sem gestação ou sem nada marcado). */
export function sangueDaGestanteTexto(dados: Record<string, unknown>): string {
  if (dados.gestacao !== "Sim") return "";
  const tipo = String(dados.gestacao_tipo_sanguineo ?? "").trim();
  const rh = String(dados.gestacao_fator_rh ?? "").trim();
  return [tipo && `tipo sanguíneo ${tipo}`, rh && `Rh ${rh.toLowerCase()}`].filter(Boolean).join(" · ");
}

/**
 * Para a célula "Tipo Sanguíneo" da ficha anestésica (28/11/2026): curto,
 * como se escreve no papel — "O negativo", "A positivo"; só o Rh, "Rh
 * negativo"; só o tipo, "O". Vazio sem gestação ou sem nada marcado.
 */
export function tipoSanguineoDaGestante(dados: Record<string, unknown>): string {
  if (dados.gestacao !== "Sim") return "";
  const tipo = String(dados.gestacao_tipo_sanguineo ?? "").trim();
  const rh = String(dados.gestacao_fator_rh ?? "").trim().toLowerCase();
  if (tipo && rh) return `${tipo} ${rh}`;
  return tipo || (rh ? `Rh ${rh}` : "");
}
