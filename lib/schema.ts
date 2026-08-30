// Marcação de dados estruturados.
//
// O que entra aqui é só o que o Google AINDA usa. A tentação é marcar tudo, e
// ela custa caro: `FAQPage` foi restrito em 2023 e teve o suporte encerrado em
// junho de 2026, então marcação de FAQ hoje não produz absolutamente nada na
// busca — quem a adiciona está escrevendo código para ninguém. O que faz o
// trabalho da FAQ é o TEXTO: escrever a seção em forma de pergunta, porque é
// assim que a pessoa digita.
//
// `BreadcrumbList` continua valendo, e é dos poucos que muda o que se vê: no
// lugar da URL crua, o resultado mostra "avanest.com.br › Escores › STOP-Bang".
// Num resultado de busca disputado, o caminho legível diz à pessoa que existe
// uma seção inteira sobre aquilo — e não uma página solta.

const SITE = "https://www.avanest.com.br";

export type Migalha = { nome: string; caminho: string };

/**
 * A trilha da página, do começo ao fim.
 *
 * A ÚLTIMA migalha é a página atual, e ela entra na lista como as outras — o
 * Google espera a trilha completa, com a folha inclusa. Omiti-la faz o
 * resultado mostrar o caminho até o pai e parar ali, que é pior do que não ter.
 */
export function migalhas(trilha: readonly Migalha[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trilha.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: m.nome,
      item: `${SITE}${m.caminho}`,
    })),
  };
}

/** Pronto para o `dangerouslySetInnerHTML` — o conteúdo é sempre nosso. */
export const comoJson = (dados: unknown) => JSON.stringify(dados);
