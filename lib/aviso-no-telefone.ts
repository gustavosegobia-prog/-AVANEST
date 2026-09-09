// ===========================================================================
// Do sino para o telefone
// ===========================================================================
// O sino mostra duas famílias de aviso, e elas chegam ao telefone por caminhos
// diferentes — não por descuido, por natureza.
//
// UNS NASCEM DE UM CLIQUE. Alguém oferece um plantão, alguém responde, alguém
// publica a escala, alguém manda mensagem na sala. Há um instante exato em que
// o fato passa a existir, e é nele que o telefone deve tocar: quem oferece o
// plantão da sexta precisa de resposta hoje, não amanhã de manhã. Esses saem
// por app/api/push/avisar, no mesmo pedido que grava o fato.
//
// OUTROS NÃO NASCEM DE NADA. "19 plantões esperando sua confirmação" e "9
// plantões de julho sem receber" não são eventos: são o estado do mundo. Ninguém
// clicou em lugar nenhum para que virassem verdade, e por isso não existe pedido
// em que pegar carona. Eles só chegam ao telefone se alguém for olhar de tempos
// em tempos — que é o que a rota app/api/push/lembretes faz, uma vez por dia.
//
// Este arquivo é a parte que DECIDE, sem tocar em banco nem em rede: dado o que
// está no sino, o que já foi mandado e que horas são, o que vai para o telefone
// agora. Fica separado para poder ser conferido num teste, e não abrindo o
// celular e esperando as sete da noite.
// ===========================================================================

import { chaveDoAviso, type Aviso, type TipoDeAviso } from "./avisos.ts";
import type { Notificacao } from "./push.ts";

/**
 * Os avisos que o lembrete diário pode mandar.
 *
 * A lista é do que NÃO tem outro caminho até o telefone. Troca de plantão e
 * escala publicada saem no instante em que acontecem, pela outra rota; repetir
 * aqui faria a mesma notícia tocar duas vezes — uma na hora e outra à noite.
 *
 * `chat` também fica de fora, e por um motivo mais forte: mensagem de equipe
 * que chega doze horas depois não é aviso, é arqueologia. Ela sai no envio,
 * junto com a mensagem.
 */
export const NOTIFICAVEIS: ReadonlySet<TipoDeAviso> = new Set<TipoDeAviso>([
  "a_confirmar", "plantao_a_receber", "a_receber", "a_faturar", "suporte",
]);

/**
 * Quantos dias um mesmo aviso fica calado depois de tocar.
 *
 * A pendência não some sozinha: "9 plantões de julho sem receber" continua
 * verdade amanhã, e depois de amanhã. Sem esta trava o telefone repetiria a
 * mesma frase todo dia até a pessoa desligar as notificações — e aí perderia
 * junto o pedido de troca, que é o que ela nunca quis perder.
 *
 * Sete dias, o mesmo prazo do botão Adiar do sino. Não é coincidência: os dois
 * respondem à mesma pergunta ("de quanto em quanto tempo isto merece voltar?"),
 * e responder diferente faria o Adiar parecer que não funcionou.
 */
export const DIAS_DE_SILENCIO = 7;

/**
 * Quantos avisos podem tocar de uma vez.
 *
 * Cinco notificações ao mesmo tempo não são cinco avisos: são uma parede, e
 * parede se ignora inteira. As que ficam de fora NÃO são marcadas como
 * enviadas, então descem na execução seguinte — quando as três de hoje já
 * estarão caladas. O resultado é um pingo por dia em vez de um balde de uma vez.
 */
export const TETO_POR_PESSOA = 3;

/**
 * A que horas o telefone pode tocar, na hora de Brasília.
 *
 * O lembrete é de faturamento e de confirmação de plantão: nenhum deles vale
 * uma tela acesa às três da manhã. A janela é generosa de propósito — quem sai
 * de um plantão às 19h ainda recebe o "confirme o plantão de hoje" a tempo de
 * lembrar como foi o dia.
 */
export const PRIMEIRA_HORA = 8;
export const ULTIMA_HORA = 21;

/**
 * Que horas são em São Paulo, a partir de um instante qualquer.
 *
 * Pela biblioteca de fuso do próprio JavaScript, e não por "menos três": o
 * Brasil já teve horário de verão e pode ter de novo, e um `-3` cravado no
 * código erraria uma hora durante quatro meses do ano sem ninguém notar.
 */
export function horaEmSaoPaulo(agora: Date): number {
  return Number(new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false,
  }).format(agora));
}

export const dentroDoHorario = (agora: Date) => {
  const h = horaEmSaoPaulo(agora);
  return h >= PRIMEIRA_HORA && h < ULTIMA_HORA;
};

/**
 * O aviso do sino, virado notificação de telefone.
 *
 * O TEXTO É O MESMO DAS DUAS TELAS, e isso é a regra e não a economia: quem
 * recebe "9 plantões de julho de 2026 sem receber" no telefone e abre o
 * sistema tem de encontrar aquela frase, com aquelas palavras. Reescrever aqui
 * criaria duas versões do mesmo aviso, e a pessoa passaria a procurar no
 * sistema um aviso que não existe com aquele nome.
 *
 * A `tag` é a chave do aviso — a mesma do Adiar. É ela que faz a notificação de
 * hoje SUBSTITUIR a da semana passada em vez de empilhar: o telefone mostra
 * "19 plantões esperando confirmação", e não uma pilha de 12, 15 e 19.
 */
export function notificacaoDoAviso(aviso: Aviso): Notificacao {
  return {
    titulo: aviso.titulo,
    corpo: aviso.detalhe,
    url: destinoDoAviso(aviso),
    tag: chaveDoAviso(aviso),
  };
}

/**
 * Onde o toque na notificação abre.
 *
 * Não basta a área: os lembretes de dinheiro vivem na Escala, na aba Produção,
 * que é onde se marca faturado e recebido. Abrir a Escala no calendário
 * obrigaria a procurar a aba certa — e um aviso que dá trabalho para ser
 * atendido é um aviso que fica para depois.
 */
export function destinoDoAviso(aviso: Aviso): string {
  if (aviso.area === "producao") return "/dashboard?area=plantoes&aba=producao";
  if (aviso.area === "plantoes") return "/dashboard?area=plantoes";
  // Chat e suporte moram na mesma janela flutuante, que abre por conta própria.
  return "/dashboard";
}

/**
 * O que vai tocar agora.
 *
 * Recebe o sino já pronto — inclusive já sem os adiados, porque adiar é uma
 * decisão sobre o aviso e não sobre a tela: quem mandou o lembrete de julho
 * voltar semana que vem não quer ouvi-lo no telefone hoje à noite.
 */
export function paraNotificar(entrada: {
  /** Os avisos visíveis da pessoa, na ordem em que o sino os mostra. */
  avisos: readonly Aviso[];
  /** Chave do aviso -> ISO do último envio. O que nunca tocou não está aqui. */
  enviados: ReadonlyMap<string, string>;
  agora: Date;
  teto?: number;
}): Aviso[] {
  const limite = new Date(entrada.agora.getTime() - DIAS_DE_SILENCIO * 86400_000)
    .toISOString();

  return entrada.avisos
    .filter((a) => NOTIFICAVEIS.has(a.tipo))
    .filter((a) => {
      const ultimo = entrada.enviados.get(chaveDoAviso(a));
      return !ultimo || ultimo < limite;
    })
    // O que pede resposta na frente. Com o teto valendo, a ordem decide o que
    // toca hoje e o que espera amanhã — e "o suporte respondeu você" não pode
    // ficar atrás de um lembrete de faturamento de três meses atrás.
    .sort((a, b) => Number(b.acao) - Number(a.acao) || b.quando.localeCompare(a.quando))
    .slice(0, entrada.teto ?? TETO_POR_PESSOA);
}
