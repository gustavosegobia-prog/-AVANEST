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

export type PlanoParaSchema = {
  codigo: string;
  nome: string;
  descricao: string;
  preco_mensal: number | null;
  preco_por_profissional: number | null;
  sob_consulta: boolean;
};

/**
 * Os planos como oferta, para o preço aparecer no resultado da busca.
 *
 * A página tinha seis planos com valor público e o único dado estruturado era
 * a trilha de migalhas. Sem `Offer`, o Google não tem de onde tirar a faixa de
 * preço, e a página fica fora do resultado rico — que é onde a comparação
 * acontece antes do clique.
 *
 * OS PREÇOS VÊM DOS PLANOS QUE A PÁGINA JÁ BUSCOU, e não de uma lista escrita
 * aqui. Preço é dado que muda na tela administrativa; uma segunda cópia no
 * código viraria um preço no schema e outro na página no dia da primeira
 * alteração — e o Google mostraria o antigo.
 *
 * PLANO SOB CONSULTA FICA DE FORA. `Offer` sem `price` é marcação inválida, e
 * inventar um valor para o plano que não tem preço público seria anunciar
 * número que ninguém combinou.
 *
 * `priceValidUntil` é exigência do Google para oferta com preço: sem ela a
 * marcação vale, mas o rich result pode ser recusado por "oferta sem validade".
 */
export function ofertaDosPlanos(
  planos: readonly PlanoParaSchema[], validoAte: string,
) {
  const comPreco = planos.filter((p) => !p.sob_consulta
    && (p.preco_mensal != null || p.preco_por_profissional != null));
  if (!comPreco.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "AVANEST",
    serviceType: "Sistema de gestão para serviços de anestesiologia",
    provider: { "@type": "Organization", name: "AVANEST", url: SITE },
    areaServed: { "@type": "Country", name: "Brasil" },
    url: `${SITE}/planos`,
    offers: comPreco.map((p) => ({
      "@type": "Offer",
      name: p.nome,
      description: p.descricao,
      url: `${SITE}/planos`,
      // O por-profissional é o preço de entrada de quem cobra por cabeça: é o
      // menor valor pelo qual aquele plano pode ser contratado, que é o que o
      // resultado de busca compara.
      price: String(p.preco_mensal ?? p.preco_por_profissional),
      priceCurrency: "BRL",
      priceValidUntil: validoAte,
      availability: "https://schema.org/InStock",
    })),
  };
}

/** Pronto para o `dangerouslySetInnerHTML` — o conteúdo é sempre nosso. */
export const comoJson = (dados: unknown) => JSON.stringify(dados);
