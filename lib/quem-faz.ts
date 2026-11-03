// ===========================================================================
// "Quem faz o AVANEST" — o bloco da capa antes das perguntas frequentes
// ===========================================================================
// O TEXTO AINDA NÃO FOI CONFIRMADO. Enquanto `confirmado` for false, o bloco
// aparece marcado ("Texto aguardando confirmação") no ambiente local e nas
// prévias da Vercel, e NÃO aparece em produção: texto sobre uma pessoa não vai
// ao ar sem ela ler.
//
// O que fica de fora até lá, de propósito: CRM, título ("Dr.") e cargo. O nome
// sai de lib/autoria.ts (`AUTOR.nome`), a mesma fonte da assinatura dos guias.
// As frases só repetem o que o site já diz (PRODUCT.md, "Feito por
// anestesiologista, dentro de um serviço em atividade"; /recursos, "nasceu no
// serviço de anestesiologia de Campo Mourão").
//
// A FOTO: o arquivo vai em public/capa/quem-faz.webp. Quando ele existir, troque
// `foto` para "/capa/quem-faz.webp" — o teste confere que o arquivo está lá.
// Sem foto, o bloco mostra o espaço reservado (fora de produção) ou só o texto.
// ===========================================================================

import { AUTOR } from "./autoria.ts";

export const ARQUIVO_DA_FOTO = "public/capa/quem-faz.webp";

export const QUEM_FAZ = {
  /** Troque para true quando o texto e a foto estiverem conferidos. */
  confirmado: false,
  /** "/capa/quem-faz.webp" quando o arquivo chegar; null até lá. */
  foto: null as string | null,
  /** Largura e altura do arquivo, em pixels (retrato 4:5). */
  tamanhoDaFoto: [800, 1000] as const,
  nome: AUTOR.nome,
  titulo: "Quem faz o AVANEST",
  paragrafos: [
    "O AVANEST nasceu no serviço de anestesiologia de Campo Mourão (PR), para resolver o que "
      + "atrapalhava o plantão por lá, e continua sendo feito dentro de um serviço em atividade.",
    "Cada tela parte de uma situação real: a consulta no consultório ou à beira do leito, a ficha "
      + "preenchida dentro da sala, a escala do mês e o fechamento do grupo.",
  ],
} as const;

/**
 * O bloco vai para a página? Sempre, depois de confirmado. Antes disso, só
 * fora de produção (`VERCEL_ENV` é "production" no site publicado, "preview"
 * nas prévias e vazio no ambiente local).
 */
export function mostrarQuemFaz(ambiente: string | undefined = process.env.VERCEL_ENV): boolean {
  return QUEM_FAZ.confirmado || ambiente !== "production";
}
