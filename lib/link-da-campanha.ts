// ===========================================================================
// O link da campanha dos dois meses
// ===========================================================================
// "Use por 2 meses grátis e após, se gostar, assine."
//
// A promessa já estava na capa e no /planos, mas NÃO HAVIA PORTA. /criar-conta
// sem convite e sem plano respondia "Cadastro por convite — peça o link a quem
// administra o sistema": quem lesse a campanha e quisesse experimentar não
// tinha por onde. Este arquivo é a porta.
//
// POR QUE UM ENDEREÇO CURTO, E NÃO /criar-conta?origem=instagram
//
// Ele vai no direct do Instagram, e quase sempre lido no telefone. Um endereço
// com interrogação e igual no meio parece rastreador, é impossível de ditar em
// voz alta e o Instagram o encurta com reticências no meio. "avanest.com.br/
// 2meses" cabe na mensagem inteiro, diz o que é antes de ser clicado e pode
// ser repetido por telefone.
// ===========================================================================

/** O endereço curto. É este que vai na mensagem. */
export const CAMINHO_DA_CAMPANHA = "/2meses";
export const LINK_DA_CAMPANHA = `https://www.avanest.com.br${CAMINHO_DA_CAMPANHA}`;

/** Quando não vem `?de=`, a origem é o próprio link. */
export const ORIGEM_PADRAO = "2meses";

/**
 * De onde a pessoa veio, como vai ficar guardado.
 *
 * O valor sai da barra de endereços e vai parar nos metadados da conta, então
 * ele é NORMALIZADO e não apenas copiado: minúsculas, sem acento, só letras,
 * números e hífen, no máximo 32 caracteres. Não é paranoia de segurança — é
 * que "Instagram", "instagram " e "instagram/stories" viram três origens
 * diferentes na hora de contar, e uma contagem que se divide sozinha não
 * responde à única pergunta que ela existe para responder: de onde vieram.
 *
 * Sobrando nada depois da limpeza, vale a origem padrão. Guardar string vazia
 * seria guardar "não sei" com cara de resposta.
 */
export function origemDoLink(de: string | string[] | undefined | null): string {
  const bruto = Array.isArray(de) ? de[0] : de;
  const limpo = String(bruto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/, "");
  return limpo || ORIGEM_PADRAO;
}

/** O link pronto para colar, com a origem que se quer medir. */
export const linkComOrigem = (de?: string) =>
  de && origemDoLink(de) !== ORIGEM_PADRAO
    ? `${LINK_DA_CAMPANHA}?de=${origemDoLink(de)}`
    : LINK_DA_CAMPANHA;
