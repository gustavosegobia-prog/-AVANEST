// Quem assina o conteúdo clínico do site.
//
// AS QUATRO CALCULADORAS SÃO CONTEÚDO YMYL — "your money or your life" —, e o
// Google aplica a elas uma régua mais dura: página que influencia decisão de
// saúde é avaliada por quem escreveu, com que credencial e quando foi revisada.
// O site dizia "de anestesiologista para anestesiologista" em prosa e não
// sinalizava isso a máquina nenhuma. Era a maior distância entre o que ele é e
// o que ele demonstra ser.
//
// UMA FONTE SÓ, e não um nome repetido em quatro páginas. O CRM escrito à mão
// em cada arquivo é o tipo de dado que sai errado numa delas e ninguém confere:
// um número de registro trocado numa página de saúde é pior do que não ter
// número nenhum.
//
// O QUE APARECE NA TELA E O QUE VAI NO SCHEMA SÃO O MESMO DADO. Declarar autor
// só na marcação invisível é o que o Google chama de sinal não corroborado — a
// orientação dele é explícita em querer a assinatura visível na página. Por isso
// as duas saem daqui.

export const AUTOR = {
  nome: "Gustavo Segobia da Silva",
  tratamento: "Dr.",
  cargo: "Médico anestesiologista",
  // O RQE não entra enquanto não existir. Registro de especialista é conferível
  // no portal do CFM: publicar um número aproximado é pior do que omitir o
  // campo, porque um dado errado desmente justamente a credencial que ele
  // deveria sustentar.
  crm: "49131",
  ufDoCrm: "PR",
  organizacao: "G. Segobia Serviços Médicos Ltda.",
} as const;

/** "Dr. Gustavo Segobia da Silva" — como o nome aparece escrito. */
export const nomeCompleto = () => `${AUTOR.tratamento} ${AUTOR.nome}`;

/** "CRM 49131-PR" — o registro como o CFM o escreve. */
export const registro = () => `CRM ${AUTOR.crm}-${AUTOR.ufDoCrm}`;

/**
 * O autor em schema.org.
 *
 * `identifier` com `PropertyValue` é o jeito de declarar um registro
 * profissional: `Person.identifier` sozinho seria uma string sem dizer de que
 * cadastro ela é.
 */
export function autorEmSchema() {
  return {
    "@type": "Person",
    name: nomeCompleto(),
    honorificPrefix: AUTOR.tratamento,
    jobTitle: AUTOR.cargo,
    identifier: {
      "@type": "PropertyValue",
      propertyID: "CRM",
      name: `Conselho Regional de Medicina do ${AUTOR.ufDoCrm}`,
      value: `${AUTOR.crm}-${AUTOR.ufDoCrm}`,
    },
    affiliation: { "@type": "Organization", name: AUTOR.organizacao },
  } as const;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * "27 de agosto de 2026", a partir de "2026-08-27".
 *
 * Escrito por extenso, e não 27/08/2026: a data de revisão é lida por quem
 * quer saber se o conteúdo está velho, e o formato por extenso não se confunde
 * com o americano de mês na frente.
 */
export function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}
