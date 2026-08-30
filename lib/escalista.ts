// Quem monta a escala do grupo.
//
// Até aqui a resposta era "qualquer administrador", porque montar escala e
// administrar a casa eram a mesma coisa no código. Num grupo de verdade não
// são: quem organiza a escala costuma ser UM anestesiologista, o que virou a
// escala do mês no papel durante anos — e transformá-lo em administrador para
// isso lhe entregaria de brinde o Financeiro, os convites e o cadastro de
// todo mundo.
//
// O caminho contrário é igualmente ruim: deixar todos os administradores
// mexendo na escala é o motivo de a escala do mês aparecer trocada sem
// ninguém saber quem trocou.
//
// Por isso `escalista` é um MARCADOR na pessoa, e não um papel. Papel é
// exclusivo — virar "escalista" custaria o "médico", e o escalista é
// justamente um médico. O marcador soma-se ao que a pessoa já é.
//
// ---------------------------------------------------------------------------
// A REGRA DE COMPATIBILIDADE, que é a parte delicada
//
// Enquanto NINGUÉM estiver marcado, os administradores continuam montando a
// escala — exatamente como hoje. Se a regra nova valesse de imediato, as seis
// organizações que já existem acordariam sem ninguém capaz de lançar um
// plantão, e a primeira notícia disso seria alguém tentando escalar o plantão
// de amanhã.
//
// Marcado o primeiro escalista, a organização passa a ter dono da escala: dali
// em diante só ele e o proprietário mexem. É uma decisão que se toma uma vez e
// se percebe na hora.
//
// O PROPRIETÁRIO NUNCA PERDE. Ele é a saída de emergência: escalista que sai
// de férias, perde a senha ou deixa o grupo não pode trancar a escala do mês
// inteiro do lado de fora.

export type QuemMonta = {
  /** O papel da pessoa: owner, admin, medico, recepcao, financeiro. */
  role: string;
  /** O marcador. Verdadeiro só para quem foi escolhido. */
  escalista?: boolean | null;
  /** Conta da plataforma. É a saída de emergência quando a escala trava. */
  super_admin?: boolean | null;
};

/**
 * A organização já elegeu alguém?
 *
 * Recebe a equipe inteira. Nenhum marcado = ninguém elegeu, e vale a regra
 * antiga.
 */
export const temEscalista = (equipe: readonly QuemMonta[]) =>
  equipe.some((p) => p.escalista === true);

/**
 * Esta pessoa pode montar a escala do grupo?
 *
 * `equipe` é a lista inteira porque a resposta depende dela: sem escalista
 * eleito, todo administrador monta; com escalista eleito, só ele e o
 * proprietário. Uma função que olhasse apenas a pessoa não teria como saber em
 * qual dos dois mundos está.
 */
export function podeMontarEscala(pessoa: QuemMonta, equipe: readonly QuemMonta[]) {
  if (pessoa.role === "owner") return true;
  if (pessoa.escalista === true) return true;
  // A saída de emergência, e ela precisa existir aqui TAMBÉM.
  //
  // Esta função decide se a tela mostra o botão; a policy do banco decide se a
  // gravação passa. Divergir faz uma das duas coisas ruins: botão escondido de
  // quem podia, ou — pior — botão visível que dá erro ao salvar. Foi por não
  // ter proprietário nenhum que a INOVANEST ficou dependendo de uma pessoa só.
  if (pessoa.super_admin === true) return true;
  // Ninguém eleito: segue como sempre foi.
  if (!temEscalista(equipe)) return pessoa.role === "admin";
  return false;
}

/**
 * Quem pode ELEGER o escalista.
 *
 * Só proprietário e administrador. Se o próprio escalista pudesse marcar
 * outros, a decisão de quem manda na escala sairia de quem responde pelo
 * grupo — e, pior, ele poderia se desmarcar e trancar a escala sem querer.
 */
export const podeEscolherEscalista = (pessoa: QuemMonta) =>
  ["owner", "admin"].includes(pessoa.role);

/**
 * O que a tela diz sobre o estado atual.
 *
 * Existe para o administrador entender a consequência ANTES de marcar o
 * primeiro: o texto muda de "todos montam" para "só fulano monta" no instante
 * em que ele clica, e a frase precisa explicar isso sem ele ter de descobrir
 * pelo efeito.
 */
export function explicarEscala(equipe: readonly QuemMonta[]): string {
  const eleitos = equipe.filter((p) => p.escalista === true).length;
  if (eleitos === 0) {
    return "Ninguém foi definido como escalista, então todos os administradores montam a escala do grupo. "
      + "Marcando alguém, só essa pessoa e o proprietário passam a montar.";
  }
  return eleitos === 1
    ? "Um escalista definido: só ele e o proprietário montam a escala do grupo."
    : `${eleitos} escalistas definidos: só eles e o proprietário montam a escala do grupo.`;
}
