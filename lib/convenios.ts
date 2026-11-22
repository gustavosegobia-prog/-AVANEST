import { grafiaConhecida } from "./financeiro-indicadores.ts";

// Os convênios que o sistema já sugere, antes de a organização cadastrar os
// dela. Uma lista só para o cadastro do paciente, o financeiro e o mapa
// cirúrgico: duas listas acabariam com o "Unimed" escrito de dois jeitos.
export const CONVENIOS = [
  "Particular","Unimed","FUPS","SAS","CISCOMCAM","Humana Saúde","Bradesco Saúde",
  "SulAmérica","Amil","CASSI","SANEPAR","COPEL",
  // O nome como o mapa do hospital escreve (22/11/2026: "CAMP DE MELHORAMENTO" e
  // "COMP MELHORAMENTO" eram o mesmo convênio, digitado de dois jeitos).
  "Companhia Melhoramentos",
];

/**
 * O convênio a gravar no cadastro do paciente aberto pela ficha anestésica
 * (digitado ou lido da foto da ficha do hospital), na grafia que a
 * organização já usa: "Sus" vira "SUS", "UNIMED" vira "Unimed" (22/11/2026 —
 * o cadastro tinha os dois jeitos, e o preço do convênio, procurado pelo nome
 * exato, não achava o de grafia diferente). O que não é conhecido entra como
 * foi escrito; vazio continua vazio (não vira "Particular").
 */
export function convenioDoCadastro(digitado: string | null | undefined, daOrganizacao: string[] = []): string | null {
  const texto = String(digitado ?? "").trim();
  return texto ? grafiaConhecida(texto, [...daOrganizacao, "SUS", ...CONVENIOS]) : null;
}
