// ===========================================================================
// "Quem está por trás do AVANEST" — o bloco da capa antes das perguntas
// ===========================================================================
// TEXTO DO PRÓPRIO RESPONSÁVEL, enviado e confirmado em 05/11/2026: título,
// parágrafos, nome e a linha "Médico | Idealizador e fundador do AVANEST" vão
// como ele escreveu. Não reescreva sem ele ler: texto sobre uma pessoa não vai
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
  nome: AUTOR.nome,
  /** A linha abaixo do nome, como o responsável a escreveu. */
  papel: "Médico | Idealizador e fundador do AVANEST",
  titulo: "Quem está por trás do AVANEST",
  paragrafos: [
    "O AVANEST nasceu da prática médica, dentro do serviço de anestesiologia de Campo Mourão (PR), "
      + "a partir da necessidade de tornar a rotina do anestesiologista mais simples, organizada e "
      + "eficiente.",
    "Desenvolvido com base na experiência de quem vive diariamente os desafios do centro "
      + "cirúrgico, o projeto transforma necessidades reais em soluções tecnológicas que conectam a "
      + "avaliação pré-anestésica, a ficha anestésica, a gestão de escalas e o controle financeiro "
      + "em uma única plataforma.",
    "Mais do que um sistema, o AVANEST representa o compromisso de unir medicina, tecnologia e "
      + "inovação, reduzindo a burocracia e permitindo que o anestesiologista dedique mais tempo ao "
      + "que realmente importa: o cuidado com o paciente.",
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
