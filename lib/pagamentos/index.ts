import { stripe } from "./stripe";
import type { AdaptadorDePagamento, Provedor } from "./tipos";

// Qual gateway cobra.
//
// Hoje é um só. Já foram três: o Mercado Pago bloqueou a conta, o Asaas nunca
// respondeu ao suporte depois que o primeiro pagamento não passou, e os dois
// saíram daqui quando o Stripe entrou em produção e nenhuma organização tinha
// assinatura ativa por eles — conferido no banco antes de remover.
//
// A camada de adaptador continua, e não por simetria vazia: ela é o que
// permitiu trocar de gateway duas vezes sem reescrever rota, banco e tela. Um
// provedor novo entra aqui e em ADAPTADORES, e o resto do sistema não fica
// sabendo.

const ADAPTADORES: Record<Provedor, AdaptadorDePagamento> = { stripe };

/**
 * Quem cobra as assinaturas novas.
 *
 * A escolha é por configuração, não por código: quem tiver chave configurada
 * cobra. PAGAMENTOS_PROVEDOR força um deles, para o dia em que houver mais de
 * um configurado ao mesmo tempo — durante uma migração, por exemplo. Devolve
 * null quando não há nenhum, e aí a tela avisa em vez de quebrar.
 */
export function provedorAtivo(): AdaptadorDePagamento | null {
  const escolhido = process.env.PAGAMENTOS_PROVEDOR as Provedor | undefined;
  if (escolhido && escolhido in ADAPTADORES) {
    const adaptador = ADAPTADORES[escolhido];
    return adaptador.configurado() ? adaptador : null;
  }
  if (stripe.configurado()) return stripe;
  return null;
}

/**
 * Quem cobra ESTA organização — que não é necessariamente quem cobra as novas.
 *
 * Cancelar a assinatura de um cliente antigo tem de falar com o gateway em que
 * ela foi criada. Usar o provedor ativo aqui mandaria o pedido de cancelamento
 * de um gateway para outro, que responderia "não encontrei" — e o cliente
 * seguiria sendo cobrado depois de ter cancelado.
 *
 * O banco ainda guarda 'asaas' e 'mercadopago' em organizações antigas, todas
 * sem assinatura ativa. Para elas isto devolve null, e a rota de cancelamento
 * responde que a equipe encerra a cobrança à mão — que é a verdade, já que não
 * há mais código para falar com aqueles dois.
 */
export function adaptadorDe(provedor: string | null | undefined): AdaptadorDePagamento | null {
  if (!provedor || !(provedor in ADAPTADORES)) return null;
  const adaptador = ADAPTADORES[provedor as Provedor];
  return adaptador.configurado() ? adaptador : null;
}

export type { AdaptadorDePagamento, Provedor } from "./tipos";
