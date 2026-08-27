// O contrato que qualquer gateway de pagamento precisa cumprir.
//
// Existe porque a conta do Mercado Pago foi bloqueada e a assinatura ficou sem
// por onde cobrar. Trocar de provedor não pode significar reescrever as rotas,
// o banco e a tela — então o que muda de um gateway para outro fica dentro de
// um adaptador, e o resto do sistema fala esta linguagem aqui. Já valeu duas
// vezes: Mercado Pago → Asaas → Stripe, sem tocar em rota nem em banco.
//
// A regra é: nenhum vocabulário de gateway atravessa esta fronteira. "approved",
// "cancelled" e "paused" são os únicos status que o banco entende, e é o
// adaptador que traduz PAYMENT_CONFIRMED, authorized_payment e o que vier.

// Um só hoje. A união continua sendo um tipo, e não uma string solta, porque é
// ela que faz o compilador apontar todo lugar a acertar quando entrar o
// próximo — foi assim que a entrada do Stripe não deixou ponta faltando.
export type Provedor = "stripe";

export type NovaAssinatura = {
  institutionId: string;
  organizacao: string;
  plano: string;
  emailPagador: string;
  valorMensal: number;
  /**
   * Meses sem cobrança antes da primeira fatura, vindos da campanha.
   *
   * Não é desconto: o valor mensal continua o mesmo, o que muda é quando a
   * primeira cobrança vence. Por isso mora aqui e não num campo de preço —
   * quem decide o valor é o banco, e quem decide a data é a campanha.
   */
  mesesGratis?: number;
  /** Para onde o cliente volta quando termina de pagar. */
  retornoSucesso: string;
  /** Para onde ele volta se desistir no meio. */
  retornoCancelado: string;
};

export type AssinaturaCriada = {
  provedor: Provedor;
  /**
   * O identificador que o webhook vai usar para reencontrar esta organização.
   * Nem sempre é o id da assinatura: no Stripe a assinatura só passa a existir
   * quando o cliente termina o checkout, então aqui vai o id da sessão, e o id
   * definitivo é gravado quando a primeira cobrança chega.
   */
  referencia: string;
  clienteId?: string;
  /** Para onde mandar o navegador do cliente. */
  url: string;
};

/**
 * O que o banco precisa saber sobre um evento de cobrança, já traduzido.
 *
 * `idUnico` é a chave de idempotência: os gateways reenviam o mesmo aviso, e é
 * ele que impede o mesmo pagamento render dois meses de acesso.
 */
export type EventoDeCobranca = {
  idUnico: string;
  provedor: Provedor;
  /** Id da assinatura no provedor, quando o evento traz. */
  assinaturaId: string | null;
  /** Id do cliente no provedor, quando o evento traz. */
  clienteId: string | null;
  /** Id da organização, quando o evento traz de volta o que mandamos. */
  institutionId: string | null;
  tipo: "pagamento" | "assinatura";
  /** Só estes três movem alguma coisa; "outro" é registrado e ignorado. */
  status: "approved" | "cancelled" | "paused" | "outro";
  valor: number | null;
  /** Quantos meses de acesso este evento compra. Zero para eventos que não são pagamento. */
  meses: number;
  /**
   * Até quando o acesso vale, em segundos desde 1970, quando o provedor diz.
   *
   * Existe porque somar meses erra devagar. O banco fazia
   * `greatest(now(), assinatura_ate) + p_meses meses` a cada pagamento: como o
   * aviso chega horas depois da cobrança e o ciclo do gateway tem 30 dias e não
   * "um mês", cada renovação empurrava a validade um pouco além do que foi
   * pago. Em um ano vira semanas de acesso que ninguém pagou — e, no sentido
   * contrário, o cliente de campanha ficava sem acesso entre o fim do teste e a
   * primeira fatura.
   *
   * Quando vem preenchido, manda: a validade passa a ser a data do provedor, e
   * `meses` fica de reserva para os gateways que não informam período.
   */
  acessoAte?: number | null;
  payload: Record<string, unknown>;
};

/**
 * O que o resto do sistema pede a um gateway.
 *
 * O webhook de propósito NÃO está aqui. Cada provedor autentica do seu jeito —
 * o Stripe assina os bytes brutos com HMAC e manda no cabeçalho, outros já
 * usaram token fixo — e cada um chama uma URL própria, configurada no painel
 * dele. Espremer isso numa assinatura de método só produziria um parâmetro que
 * metade dos provedores ignora. Cada webhook mora na sua rota, e todos
 * desembocam no mesmo registrar_pagamento_assinatura.
 */
export interface AdaptadorDePagamento {
  readonly nome: Provedor;
  /** Falso quando faltam as variáveis de ambiente: a tela avisa em vez de quebrar. */
  configurado(): boolean;
  criarAssinatura(dados: NovaAssinatura): Promise<AssinaturaCriada>;
  cancelarAssinatura(assinaturaId: string): Promise<void>;
}
