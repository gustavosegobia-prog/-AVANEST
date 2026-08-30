// O e-mail de boas-vindas, mandado de propósito para quem está configurando.
//
// Por que existe: o caminho completo — Stripe confirma, o webhook grava, o
// e-mail sai, chega na caixa — só acontece quando alguém assina de verdade.
// Cada pedaço tem teste, e isso NÃO é a mesma coisa: chave de API errada,
// domínio não verificado, variável escrita com espaço sobrando, remetente
// recusado pelo provedor — nada disso aparece em teste, aparece no envio.
//
// Sem este botão, o primeiro envio real é o do primeiro cliente pagante — que
// é justamente quem não pode ficar sem o e-mail, e o único que não avisa que
// não recebeu. Com ele, dá para provar o caminho em dez segundos, e de novo a
// cada troca de chave ou mudança de texto.
//
// O CONTEÚDO É O MESMO que o cliente recebe, de propósito: um teste que manda
// outra mensagem não testa a mensagem. O que muda é só o assunto, marcado.

import { boasVindas } from "./email-boas-vindas.ts";
import { hoje, somarDias } from "./data-local.ts";

/**
 * A marca no assunto.
 *
 * No assunto, e não no corpo. O corpo precisa ser idêntico ao real para o
 * teste valer alguma coisa; o assunto é o bastante para ninguém confundir,
 * meses depois, um teste com a prova de que alguém assinou.
 *
 * SEM COLCHETES E SEM CAIXA ALTA. "[TESTE]" no começo do assunto é um padrão
 * clássico de mala direta, e filtro de spam pontua isso — o primeiro teste
 * caiu na caixa de lixo do iCloud. O e-mail do cliente nunca leva esta marca,
 * então isso não afeta a entrega em produção; afeta a de quem usa o botão, que
 * é justamente quem precisa que ele chegue.
 */
export const MARCA_TESTE = "Teste — ";

export type DadosDeTeste = {
  nome?: string | null;
  organizacao: string;
  plano: string;
  valorMensal: number;
  cupom?: string | null;
};

export function emailDeTeste(dados: DadosDeTeste) {
  // Uma data plausível e no fuso certo. `somarDias` passa pelo calendário de
  // São Paulo — usar `new Date()` cru daria a data de Greenwich, que à noite
  // já é o dia seguinte. Foi exatamente esse o defeito que apareceu na agenda.
  const mensagem = boasVindas({
    ...dados,
    primeiraCobranca: somarDias(hoje(), 30),
  });
  return { ...mensagem, assunto: `${MARCA_TESTE}${mensagem.assunto}` };
}
