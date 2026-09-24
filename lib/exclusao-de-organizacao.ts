/**
 * Quem pode ser excluída de vez, e o que a tela diz quando não pode.
 *
 * A decisão de verdade mora no banco (`excluir_organizacao`), e é lá que ela
 * precisa estar: uma trava escrita só aqui cai na primeira chamada nova feita
 * por outro caminho. O que este arquivo faz é ANTECIPAR a resposta, para a
 * tela não oferecer um botão que vai falhar e para a pessoa entender o motivo
 * antes de tentar.
 *
 * A REGRA CLÍNICA QUE SUSTENTA TUDO: ficha pré-anestésica é prontuário, e
 * prontuário tem guarda obrigatória. Organização com paciente, ficha ou
 * usuário não se apaga — sai de circulação com "Cancelar", que é outra coisa.
 * O que sobra para excluir é o que nunca saiu do papel: cadastro de teste,
 * grupo que desistiu antes de convidar alguém, nome digitado errado.
 */

export type OrganizacaoParaExcluir = {
  nome: string;
  pacientes: number;
  avaliacoes: number;
  usuarios: number;
  /** A organização de quem está olhando o painel. */
  minha?: boolean;
};

/**
 * O motivo de não poder excluir, ou `null` quando pode.
 *
 * Devolve FRASE, e não booleano, porque o "não" precisa dizer por quê. Um botão
 * cinza sem explicação faz a pessoa tentar de novo amanhã, e depois pedir
 * suporte para uma regra que o próprio sistema poderia ter contado.
 */
export function bloqueioParaExcluir(org: OrganizacaoParaExcluir): string | null {
  if (org.minha) {
    return "Esta é a sua própria organização — excluí-la deixaria você sem acesso ao sistema.";
  }
  const partes: string[] = [];
  if (org.pacientes > 0) partes.push(`${org.pacientes} paciente(s)`);
  if (org.avaliacoes > 0) partes.push(`${org.avaliacoes} ficha(s)`);
  if (org.usuarios > 0) partes.push(`${org.usuarios} usuário(s)`);
  if (!partes.length) return null;
  return `Tem ${listar(partes)}. Ficha pré-anestésica é prontuário e não se apaga — use Cancelar para tirar de circulação.`;
}

export const podeExcluir = (org: OrganizacaoParaExcluir) => bloqueioParaExcluir(org) === null;

/** "a, b e c" — o "e" antes do último, como se escreve. */
function listar(partes: string[]): string {
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/**
 * O nome digitado confere com o da organização?
 *
 * DIGITAR O NOME é a confirmação, e não uma caixa de "tem certeza?". Caixa de
 * certeza é clicada no automático — é o mesmo gesto de fechar um aviso —, e
 * aqui o gesto não tem volta. Copiar o nome obriga a olhar QUAL linha está
 * prestes a sumir, que é justamente o erro que se quer evitar: excluir a
 * organização de baixo.
 *
 * A comparação ignora acento, caixa e espaço sobrando: o objetivo é provar
 * atenção, não testar datilografia.
 */
export function confirmacaoConfere(digitado: string, nome: string): boolean {
  const limpar = (t: string) =>
    t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const alvo = limpar(nome);
  return alvo.length > 0 && limpar(digitado) === alvo;
}
