// O que cada organização contratou.
//
// Até aqui o AVANEST tinha um tamanho só: quem entrava recebia o sistema
// inteiro — ficha, escala, recepção e financeiro — e o que variava era o PAPEL
// da pessoa dentro dele. Isso basta enquanto a organização é um grupo de
// anestesiologistas que faz tudo.
//
// Deixa de bastar quando o cliente é um HOSPITAL. O centro cirúrgico do
// FUNDHOSPAR quer a ficha anestésica e a escala, e não quer — nem deve ter — o
// financeiro de um serviço médico que não é dele. Não é uma questão de
// permissão de pessoa: é o contrato da organização. Nem o administrador de lá
// deve enxergar uma aba de Financeiro, porque aquela organização não comprou
// financeiro nenhum.
//
// Por isso a lista mora na instituição, e não no perfil. São dois filtros em
// série, e a ordem importa:
//
//   1. o que a ORGANIZAÇÃO liberou   (esta lista)
//   2. o que o PAPEL da pessoa alcança (role + permissoes)
//
// Uma pessoa vê a interseção. Módulo desligado não aparece para ninguém, nem
// para o dono; papel sem alcance não vê o módulo mesmo ligado.

/** As áreas do sistema, no vocabulário do dashboard. */
export type Area = "medico" | "plantoes" | "recepcao" | "financeiro" | "admin";

/**
 * As áreas que uma organização pode NÃO ter contratado.
 *
 * "admin" ficou de fora de propósito, e é a decisão de projeto deste arquivo:
 * é por ela que se convida gente, se cadastra local e se paga a assinatura. Uma
 * organização que pudesse desligar a própria administração ficaria trancada por
 * fora, sem ninguém lá dentro capaz de reabrir — e o conserto passaria por um
 * super-admin e uma consulta SQL. O que se restringe é o TRABALHO; a
 * administração da casa acompanha quem tem o papel.
 */
export const MODULOS = ["medico", "plantoes", "recepcao", "financeiro"] as const;
export type Modulo = (typeof MODULOS)[number];

export const NOME_DO_MODULO: Record<Modulo, string> = {
  medico: "Ficha anestésica",
  plantoes: "Escala",
  recepcao: "Recepção",
  financeiro: "Financeiro",
};

/** Se é um dos módulos que se pode desligar. */
export const restringivel = (area: string): area is Modulo =>
  (MODULOS as readonly string[]).includes(area);

/**
 * Normaliza o que veio do banco.
 *
 * NULO E VAZIO SIGNIFICAM "TUDO", e isso não é descuido: é o que faz as
 * organizações que já existem continuarem inteiras sem precisar preencher
 * coluna nenhuma. A restrição é a exceção declarada, não o padrão — o padrão
 * errado aqui apagaria abas de todo mundo na primeira publicação.
 */
export function modulosDaOrganizacao(bruto: unknown): Modulo[] | null {
  if (!Array.isArray(bruto)) return null;
  const limpos = bruto.filter((m): m is Modulo => typeof m === "string" && restringivel(m));
  return limpos.length ? [...new Set(limpos)] : null;
}

/**
 * O primeiro filtro: o que a organização liberou.
 *
 * Recebe as áreas que o PAPEL da pessoa já alcança e devolve as que a
 * organização também contratou. "admin" atravessa sempre, pelo motivo acima.
 */
export function areasLiberadas<T extends string>(
  areasDoPapel: readonly T[], modulos: Modulo[] | null,
): T[] {
  if (!modulos) return [...areasDoPapel];
  return areasDoPapel.filter((area) => !restringivel(area) || modulos.includes(area));
}

/**
 * O que o teste grátis de dois meses abre.
 *
 * "Use por 2 meses grátis" não é "use o sistema inteiro por dois meses": o
 * teste mostra o TRABALHO CLÍNICO — a ficha anestésica e a escala —, e a
 * gestão do negócio fica para quem assinar. Recepção e Financeiro são as duas
 * áreas que só fazem sentido quando o serviço já decidiu adotar o sistema:
 * uma pressupõe alguém atendendo o balcão, a outra pressupõe o mês inteiro
 * lançado.
 *
 * "admin" ATRAVESSA, pelo mesmo motivo que ele atravessa o filtro de módulos
 * logo acima, e aqui o motivo pesa mais: é por ele que se cadastra o local de
 * atendimento, se convida a equipe e SE ASSINA. Um teste que trancasse a
 * administração seria um teste sem porta de saída — a pessoa não conseguiria
 * nem preparar o sistema para usar, nem pagar quando decidisse ficar.
 *
 * É o terceiro filtro em série, e a ordem continua importando:
 *   1. o que a organização contratou
 *   2. o que o papel da pessoa alcança
 *   3. o que o teste libera        (esta função)
 */
export const AREAS_DO_TESTE = ["medico", "plantoes", "admin"] as const;

export function areasNoTeste<T extends string>(areas: readonly T[]): T[] {
  return areas.filter((area) => (AREAS_DO_TESTE as readonly string[]).includes(area));
}

/** As que o teste NÃO abre — para a tela poder dizer o que se ganha assinando. */
export const AREAS_QUE_A_ASSINATURA_ABRE: Modulo[] = MODULOS
  .filter((m) => !(AREAS_DO_TESTE as readonly string[]).includes(m));

/**
 * Os papéis que se pode convidar numa organização.
 *
 * Fecha o buraco na origem. Sem isto, o administrador do hospital podia
 * convidar alguém como "financeiro" — um perfil que, na organização dele, não
 * abre absolutamente nada: a pessoa entraria, faria a senha e cairia numa tela
 * sem nenhuma aba. O convite que não leva a lugar nenhum não deve ser oferecido.
 */
export function papeisConvidaveis(modulos: Modulo[] | null): string[] {
  const todos = ["recepcao", "medico", "financeiro", "admin"];
  if (!modulos) return todos;
  return todos.filter((papel) => !restringivel(papel) || modulos.includes(papel));
}
