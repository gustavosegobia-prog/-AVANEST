import type { Metadata } from "next";

// Título, descrição, endereço oficial e prévia de link de uma página pública.
//
// O DEFEITO QUE ISTO CONSERTA. O layout declara a prévia de compartilhamento
// (og:*), e no Next a página que não declara a sua HERDA a do layout inteira —
// com o título da capa e o og:url da capa. Resultado conferido no ar: o link do
// STOP-Bang colado no WhatsApp saía como "AVANEST | Gestão em anestesiologia",
// apontando para www.avanest.com.br. O Facebook e o LinkedIn ainda agrupam as
// curtidas e os compartilhamentos pelo og:url, então cada página estava dando o
// seu crédito à capa.
//
// E o motivo de ser uma função, e não um campo em cada página: quando a página
// declara o `openGraph`, o Next SUBSTITUI o do layout por inteiro (a fusão é
// rasa — node_modules/next/dist/docs, generate-metadata, "Merging"). Quem
// escrevesse só o título perderia a imagem sem perceber.

/** A imagem que aparece no link colado. Gerada por scripts/gerar-imagem-de-compartilhamento.mjs. */
export const IMAGEM_DE_COMPARTILHAMENTO = {
  url: "/compartilhar.png",
  width: 1200,
  height: 630,
  // O alt não é enfeite: leitor de tela e cliente de e-mail que não baixa
  // imagem mostram este texto no lugar dela.
  alt: "AVANEST — gestão em anestesiologia: avaliação pré-anestésica, escala do serviço e o controle do que você tem a receber.",
};

export function paginaPublica(a: {
  /** O <title> inteiro, já com a marca. */
  titulo: string;
  /** Entre ~100 e 160 caracteres: menos, o Google escreve a dele; mais, ele corta. */
  descricao: string;
  caminho: string;
  /** Guia de conteúdo (og:type article) em vez de página do produto. */
  artigo?: boolean;
}): Metadata {
  return {
    title: a.titulo,
    description: a.descricao,
    // O canonical fica aqui, e nunca no layout: no Next ele é herdado, e um
    // canonical no layout apontaria todas as páginas para a capa.
    alternates: { canonical: a.caminho },
    openGraph: {
      type: a.artigo ? "article" : "website",
      locale: "pt_BR",
      siteName: "AVANEST",
      url: a.caminho,
      title: a.titulo,
      description: a.descricao,
      images: [IMAGEM_DE_COMPARTILHAMENTO],
    },
    twitter: {
      card: "summary_large_image",
      title: a.titulo,
      description: a.descricao,
      images: [IMAGEM_DE_COMPARTILHAMENTO.url],
    },
  };
}
