// ===========================================================================
// "Quem está por trás do AVANEST" — o bloco da capa antes das perguntas
// ===========================================================================
// TEXTO DO PRÓPRIO RESPONSÁVEL, enviado e confirmado em 05/11/2026 (segunda
// versão, que substituiu a primeira no mesmo dia): título, parágrafos, a
// assinatura "Dr. Gustavo Segobia da Silva" e a linha "Médico anestesiologista
// | Fundador do AVANEST" vão como ele escreveu. Não reescreva sem ele ler: texto sobre uma pessoa não vai
// ao ar sem ela confirmar. Se `confirmado` voltar a false, o bloco sai de
// produção e reaparece marcado ("Texto aguardando confirmação") no ambiente
// local e nas prévias da Vercel.
//
// O nome sai de lib/autoria.ts (`AUTOR.nome`), a mesma fonte da assinatura dos
// guias. O CRM não entra no bloco (pedido do responsável).
//
// A FOTO: public/capa/quem-faz.webp, enviada em 05/11/2026 e recortada em 4:5
// (800 x 1000). O teste confere que o arquivo está lá.
// Sem foto, o bloco mostra o espaço reservado (fora de produção) ou só o texto.
// ===========================================================================

import { AUTOR } from "./autoria.ts";

export const ARQUIVO_DA_FOTO = "public/capa/quem-faz.webp";

export const QUEM_FAZ = {
  /** Texto confirmado pelo responsável em 05/11/2026. false tira o bloco de produção. */
  confirmado: true,
  /** A foto enviada pelo responsável em 05/11/2026, recortada em 4:5. */
  foto: "/capa/quem-faz.webp" as string | null,
  /** Largura e altura do arquivo, em pixels (retrato 4:5). */
  tamanhoDaFoto: [800, 1000] as const,
  /** O nome, para o texto alternativo da foto. */
  nome: AUTOR.nome,
  /** A assinatura abaixo do texto, como o responsável a escreveu. */
  assinatura: `Dr. ${AUTOR.nome}`,
  /** A linha abaixo da assinatura, como o responsável a escreveu. */
  papel: "Médico anestesiologista | Fundador do AVANEST",
  titulo: "Quem está por trás do AVANEST",
  paragrafos: [
    `Sou ${AUTOR.nome}, médico anestesiologista, e criei o AVANEST a partir dos desafios que `
      + "vivencio diariamente na profissão.",
    "Tudo começou em Campo Mourão (PR), com a vontade de simplificar nossa rotina e encontrar "
      + "soluções para problemas que conhecemos de perto.",
    "O AVANEST nasceu dessa experiência e continua evoluindo dentro de um serviço de "
      + "anestesiologia em atividade, sempre pensando em facilitar o dia a dia de quem está na "
      + "linha de frente.",
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
