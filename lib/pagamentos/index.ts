import { asaas } from "./asaas";
import { stripe } from "./stripe";
import {
  cancelarAssinatura as cancelarNoMercadoPago,
  criarAssinatura as criarNoMercadoPago,
  mercadoPagoConfigurado,
} from "../mercado-pago";
import type { AdaptadorDePagamento, Provedor } from "./tipos";

// Qual gateway cobra.
//
// O Mercado Pago continua aqui, e não por nostalgia: quem já assinou por lá
// tem uma cobrança recorrente rodando, e cancelar essa assinatura precisa
// continuar funcionando mesmo depois que ninguém novo entrar por ele. O mesmo
// vale para o Asaas — o suporte nunca respondeu e ninguém novo entra por ele,
// mas cancelar quem está lá tem de seguir funcionando.

const mercadoPago: AdaptadorDePagamento = {
  nome: "mercadopago",
  configurado: mercadoPagoConfigurado,
  async criarAssinatura(dados) {
    const preapproval = await criarNoMercadoPago({
      institutionId: dados.institutionId,
      organizacao: dados.organizacao,
      plano: dados.plano,
      emailPagador: dados.emailPagador,
      valorMensal: dados.valorMensal,
      retorno: dados.retornoSucesso,
    });
    if (!preapproval?.init_point) {
      throw new Error("O Mercado Pago não devolveu o link de pagamento.");
    }
    return { provedor: "mercadopago", referencia: preapproval.id, url: preapproval.init_point };
  },
  async cancelarAssinatura(assinaturaId) {
    await cancelarNoMercadoPago(assinaturaId);
  },
};

const ADAPTADORES: Record<Provedor, AdaptadorDePagamento> = {
  stripe,
  asaas,
  mercadopago: mercadoPago,
};

/**
 * Quem cobra as assinaturas novas.
 *
 * A escolha é por configuração, não por código: quem tiver chave configurada
 * cobra, na ordem abaixo. PAGAMENTOS_PROVEDOR força um deles, para quando mais
 * de um estiver configurado ao mesmo tempo — durante uma migração, por
 * exemplo. Devolve null quando não há nenhum, e aí a tela avisa em vez de
 * quebrar.
 *
 * A ordem tem o Stripe na frente porque é ele que cobra hoje. As chaves dos
 * outros dois continuam nas variáveis de ambiente para o cancelamento de quem
 * já está lá — se a ordem fosse a antiga, um cliente novo entraria num gateway
 * que ninguém está atendendo.
 */
export function provedorAtivo(): AdaptadorDePagamento | null {
  const escolhido = process.env.PAGAMENTOS_PROVEDOR as Provedor | undefined;
  if (escolhido && escolhido in ADAPTADORES) {
    const adaptador = ADAPTADORES[escolhido];
    return adaptador.configurado() ? adaptador : null;
  }
  if (stripe.configurado()) return stripe;
  if (asaas.configurado()) return asaas;
  if (mercadoPago.configurado()) return mercadoPago;
  return null;
}

/**
 * Quem cobra ESTA organização — que não é necessariamente quem cobra as novas.
 *
 * Cancelar a assinatura de um cliente antigo tem de falar com o gateway em que
 * ela foi criada. Usar o provedor ativo aqui mandaria o pedido de cancelamento
 * do Mercado Pago para o Asaas, que responderia "não encontrei" — e o cliente
 * seguiria sendo cobrado depois de ter cancelado.
 */
export function adaptadorDe(provedor: string | null | undefined): AdaptadorDePagamento | null {
  if (!provedor || !(provedor in ADAPTADORES)) return null;
  const adaptador = ADAPTADORES[provedor as Provedor];
  return adaptador.configurado() ? adaptador : null;
}

export type { AdaptadorDePagamento, Provedor } from "./tipos";
