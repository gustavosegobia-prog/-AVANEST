import { asaas } from "./asaas";
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
// continuar funcionando mesmo depois que ninguém novo entrar por ele.

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
  asaas,
  mercadopago: mercadoPago,
};

/**
 * Quem cobra as assinaturas novas.
 *
 * A escolha é por configuração, não por código: quem tiver chave do Asaas usa
 * o Asaas. PAGAMENTOS_PROVEDOR força um dos dois, para o dia em que os dois
 * estiverem configurados ao mesmo tempo — durante uma migração, por exemplo.
 * Devolve null quando não há nenhum, e aí a tela avisa em vez de quebrar.
 */
export function provedorAtivo(): AdaptadorDePagamento | null {
  const escolhido = process.env.PAGAMENTOS_PROVEDOR as Provedor | undefined;
  if (escolhido && escolhido in ADAPTADORES) {
    const adaptador = ADAPTADORES[escolhido];
    return adaptador.configurado() ? adaptador : null;
  }
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
