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

import { autorEmSchema } from "./autoria.ts";

const SITE = "https://www.avanest.com.br";

/** O apelido da empresa dentro da marcação. Ver `organizacao()`. */
export const ID_DA_ORGANIZACAO = `${SITE}/#organizacao`;

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
    // Só a referência: a empresa inteira está declarada no layout, e repetir
    // o objeto aqui criaria uma segunda organização de mesmo nome.
    provider: { "@id": ID_DA_ORGANIZACAO },
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

/**
 * A empresa, declarada uma vez para o site inteiro.
 *
 * O site falava de si em toda página e não dizia a máquina nenhuma QUEM o
 * opera: não havia entidade de empresa — nome, logo, CNPJ, contato, perfil no
 * Instagram. É o que alimenta o painel lateral de conhecimento do Google e,
 * antes disso, o que permite a ele ligar a marca "AVANEST" ao CNPJ, ao perfil
 * social e ao produto. Sem isso são três coisas soltas que por acaso usam a
 * mesma palavra.
 *
 * VAI NO LAYOUT, e não numa página só. A entidade da empresa não pertence à
 * capa: ela é verdadeira em qualquer endereço do site, e o buscador pode entrar
 * por uma calculadora de escore sem jamais passar pela capa.
 *
 * O `@id` é o que faz disto UMA empresa e não várias. A capa e a página de
 * planos também precisam citar o fornecedor; repetir o objeto inteiro nos três
 * lugares cria três organizações homônimas, e no dia em que uma delas mudar o
 * Google fica com duas versões conflitantes da mesma marca. Elas apontam para
 * este `@id`, e a descrição completa mora só aqui.
 *
 * `taxID` é o campo do vocabulário para inscrição fiscal — o CNPJ vai nele, e
 * não num `identifier` genérico. Para o Brasil é o que identifica a pessoa
 * jurídica sem ambiguidade, e é o mesmo número impresso no rodapé de todas as
 * páginas.
 *
 * `founder` liga a empresa ao médico que assina o conteúdo clínico. É a mesma
 * pessoa de `lib/autoria.ts`, e a ligação é o que impede que a autoria das
 * calculadoras e a empresa pareçam duas entidades sem relação.
 */
export function organizacao() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ID_DA_ORGANIZACAO,
    name: "AVANEST",
    legalName: "G. Segobia Serviços Médicos Ltda.",
    // O que o buscador usa para desambiguar "avanest" de qualquer outra
    // palavra parecida.
    alternateName: ["AvaNest", "Avanest"],
    url: SITE,
    // O logo do painel de conhecimento. O Google pede no mínimo 112×112 e a
    // imagem tem de ser rastreável — por isso um arquivo de /public, e não o
    // SVG inline do componente da marca, que não tem endereço próprio.
    logo: {
      "@type": "ImageObject",
      url: `${SITE}/icone512.png`,
      width: 512,
      height: 512,
    },
    image: `${SITE}/compartilhar.png`,
    description:
      "Sistema de gestão para serviços de anestesiologia: avaliação "
      + "pré-anestésica, escala de plantões por instituição e controle do que "
      + "foi faturado e recebido.",
    taxID: "55.965.276/0001-04",
    email: "contato@avanest.com.br",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Campo Mourão",
      addressRegion: "PR",
      addressCountry: "BR",
    },
    contactPoint: {
      "@type": "ContactPoint",
      // Em inglês porque `contactType` é um enumerado do Google, e não texto
      // livre: "atendimento ao cliente" ele não reconhece, e o campo vira
      // ruído. O rótulo não aparece para ninguém — quem vê é o buscador.
      contactType: "customer service",
      email: "contato@avanest.com.br",
      // O mesmo número do botão de WhatsApp da capa, em formato internacional
      // — que é o único que o buscador sabe ler.
      telephone: "+55-41-99787-0810",
      areaServed: "BR",
      availableLanguage: "Portuguese",
    },
    // O perfil que já existe e já é ligado no rodapé da capa. `sameAs` é o que
    // diz ao Google que aquela conta e esta empresa são a mesma coisa.
    sameAs: ["https://www.instagram.com/useavanest/"],
    founder: autorEmSchema(),
    areaServed: { "@type": "Country", name: "Brasil" },
  };
}

/** Pronto para o `dangerouslySetInnerHTML` — o conteúdo é sempre nosso. */
export const comoJson = (dados: unknown) => JSON.stringify(dados);
