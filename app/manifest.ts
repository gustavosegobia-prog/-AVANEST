import type { MetadataRoute } from "next";

/**
 * O manifesto que o Android e o Chrome leem ao adicionar o site à tela.
 *
 * O que importa aqui é o `short_name`: sem ele, o rótulo abaixo do ícone vira o
 * título inteiro da página e o sistema corta no meio — "AvaNEST|Avaliaç...".
 * Com ele, o nome cabe.
 *
 * O ícone é o mesmo Λ da marca sobre fundo branco. Fundo cheio, e não
 * transparente, porque o iOS não respeita transparência: ele compõe o que
 * estiver de fora sobre preto, e o desenho ficaria numa moldura escura.
 *
 * Os arquivos moram em /public com esses nomes exatos. Não seguem a convenção
 * de nome do Next de propósito: o caminho declarado aqui vale para qualquer
 * nome, e evita depender de um arquivo chamar-se exatamente "apple-icon.png".
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AVANEST — Avaliação pré-anestésica",
    short_name: "AVANEST",
    description:
      "Antes da cirurgia, segurança. Avaliação pré-anestésica digital, simples e orientada.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0879c9",
    lang: "pt-BR",
    icons: [
      { src: "/icone192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
