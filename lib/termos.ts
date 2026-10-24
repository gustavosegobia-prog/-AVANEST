// ===========================================================================
// A versão dos Termos de Uso e da Política de Privacidade
// ===========================================================================
// A versão é a data em que o texto no ar passou a valer. Cada aceite guarda a
// versão que a pessoa aceitou (tabela aceites_de_termos), porque o texto muda
// com o tempo e o aceite precisa dizer a que texto se refere.
//
// Mudou o texto de um dos dois documentos: troque VERSAO_DOS_TERMOS para a
// data nova e a vigência das páginas acompanha. Quem já usava o AVANEST é
// avisado no painel e tem 30 dias (item "Alterações" dos Termos) antes de o
// texto novo valer sem aceite.

/** 23/10/2026: cláusula de propriedade intelectual e confidencialidade. */
export const VERSAO_DOS_TERMOS = "2026-10-23";

/** Para quem já usava o AVANEST antes desta versão: o texto novo vale do aceite ou desta data, o que vier primeiro. */
export const TERMOS_VALEM_PARA_QUEM_JA_USAVA = "2026-11-22";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10-23" → "23 de outubro de 2026". */
export function dataPorExtenso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return iso;
  return `${Number(m[3])} de ${mes} de ${m[1]}`;
}

/** Falta aceitar a versão atual: nenhum dos aceites guardados é dela. */
export function precisaAceitar(versoesAceitas: readonly string[], atual: string = VERSAO_DOS_TERMOS): boolean {
  return !versoesAceitas.includes(atual);
}

/**
 * O endereço de quem aceitou, do cabeçalho que a Vercel preenche (o primeiro
 * da lista é o do aparelho). Valor que não parece IP não é guardado.
 */
export function ipDaRequisicao(headers: Headers): string | null {
  const encaminhado = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = encaminhado || headers.get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

/** O navegador de quem aceitou, cortado para não guardar texto sem fim. */
export function navegadorDaRequisicao(headers: Headers): string | null {
  const ua = headers.get("user-agent")?.trim();
  return ua ? ua.slice(0, 300) : null;
}
