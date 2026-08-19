import { timingSafeEqual } from "node:crypto";
import type {
  AdaptadorDePagamento,
  AssinaturaCriada,
  EventoDeCobranca,
  NovaAssinatura,
} from "./tipos.ts";

// Asaas — assinatura mensal no cartão.
//
// A chave de API é segredo de servidor: mora nas variáveis de ambiente da
// Vercel e nunca sai daqui. Nenhuma função deste arquivo pode ser chamada do
// navegador.
//
// Por que checkout hospedado, e não assinatura criada direto: o Asaas exige
// CPF ou CNPJ do pagador, e o AVANEST não pede isso no cadastro. Na página do
// Asaas o próprio cliente digita, junto com os dados do cartão — que assim
// nunca passam pelo nosso servidor. Menos dado sensível em trânsito e menos
// campo no cadastro.

const PRODUCAO = "https://api.asaas.com/v3";
const SANDBOX = "https://api-sandbox.asaas.com/v3";

function api() {
  // Sandbox é o padrão. Cobrar de verdade tem de ser uma decisão explícita,
  // não o que acontece quando alguém esquece de configurar uma variável.
  return process.env.ASAAS_AMBIENTE === "producao" ? PRODUCAO : SANDBOX;
}

export function asaasConfigurado() {
  return Boolean(process.env.ASAAS_API_KEY);
}

function chave() {
  const valor = process.env.ASAAS_API_KEY;
  if (!valor) throw new Error("ASAAS_API_KEY não configurada na Vercel.");
  return valor;
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${api()}${caminho}`, {
    ...init,
    headers: {
      access_token: chave(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const corpo = await resposta.text();
  if (!resposta.ok) {
    // O Asaas devolve {errors:[{code,description}]}, e a description costuma
    // explicar o problema melhor do que o status.
    throw new Error(`Asaas respondeu ${resposta.status}: ${corpo.slice(0, 400)}`);
  }
  return corpo ? (JSON.parse(corpo) as T) : ({} as T);
}

type RespostaCheckout = { id: string; link: string };

/** Data de amanhã em YYYY-MM-DD, no fuso de Brasília. */
export function primeiroVencimento(hoje = new Date()): string {
  // Hoje não serve: se o cliente terminar o checkout depois do corte do dia, a
  // cobrança já nasceria vencida. Amanhã é o primeiro dia seguro.
  const amanha = new Date(hoje.getTime() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(amanha);
}

export async function criarAssinatura(dados: NovaAssinatura): Promise<AssinaturaCriada> {
  const checkout = await chamar<RespostaCheckout>("/checkouts", {
    method: "POST",
    body: JSON.stringify({
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      // Uma hora para terminar de pagar. Sessão que não expira vira link antigo
      // circulando por e-mail, cobrando um preço de campanha que já acabou.
      minutesToExpire: 60,
      // É por aqui que o webhook reencontra a organização. O nome do campo é do
      // Asaas; o valor é nosso, e nunca é lido como verdade sem conferir.
      externalReference: dados.institutionId,
      subscription: {
        cycle: "MONTHLY",
        nextDueDate: primeiroVencimento(),
      },
      items: [{
        name: `AVANEST ${dados.plano}`,
        // É o texto que o cliente lê na fatura do cartão.
        description: `Assinatura mensal — ${dados.organizacao}`,
        quantity: 1,
        value: Number(dados.valorMensal.toFixed(2)),
      }],
      customerData: {
        name: dados.nomePagador,
        email: dados.emailPagador,
      },
      callback: {
        successUrl: dados.retornoSucesso,
        cancelUrl: dados.retornoCancelado,
        expiredUrl: dados.retornoCancelado,
      },
    }),
  });

  if (!checkout?.link) throw new Error("O Asaas não devolveu o link do checkout.");
  // A assinatura ainda não existe: ela nasce quando o cliente termina de pagar.
  // Até lá a referência é a sessão de checkout, e o id definitivo é gravado
  // quando a primeira cobrança chega pelo webhook.
  return { provedor: "asaas", referencia: checkout.id, url: checkout.link };
}

export async function cancelarAssinatura(assinaturaId: string): Promise<void> {
  // No Asaas, apagar a assinatura é o que interrompe a geração de novas
  // cobranças. As que já existem não somem — e nem deveriam: o cliente pagou o
  // mês e o acesso dele vai até o fim dele.
  await chamar(`/subscriptions/${encodeURIComponent(assinaturaId)}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * O Asaas autentica mandando, em todo aviso, o token configurado no painel —
 * no cabeçalho `asaas-access-token`. Não é HMAC do corpo: é um segredo
 * compartilhado, e por isso a comparação precisa ser em tempo constante.
 */
export function conferirWebhook(dados: { cabecalhos: Headers }): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado) return false;
  const recebido = dados.cabecalhos.get("asaas-access-token");
  if (!recebido) return false;
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(recebido, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Só estes liberam ou cortam acesso. O resto dos 31 eventos do Asaas é
// registrado como "outro" e não move validade nenhuma.
//
// PAYMENT_CONFIRMED, e não PAYMENT_RECEIVED: no cartão de crédito o RECEIVED
// só chega 32 dias depois, quando o dinheiro cai na conta. Liberar por ele
// seria o cliente pagar hoje e entrar no mês que vem.
const APROVA = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
// Dinheiro que voltou: o acesso para de ser devido.
const CANCELA = new Set([
  "PAYMENT_REFUNDED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_REVERSED",
  "PAYMENT_DELETED",
]);
// Venceu e não pagou. Não é cancelamento: o cliente ainda pode pagar, e o
// acesso segue até a data que ele já tinha comprado.
const SUSPENDE = new Set(["PAYMENT_OVERDUE"]);

type CorpoWebhook = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    value?: number;
    subscription?: string;
    customer?: string;
    externalReference?: string | null;
    billingType?: string;
    status?: string;
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerEvento(corpo: unknown): EventoDeCobranca | null {
  const dados = corpo as CorpoWebhook | null;
  const evento = String(dados?.event ?? "");
  const pagamento = dados?.payment;
  if (!evento || !pagamento?.id) return null;

  const status = APROVA.has(evento) ? "approved"
    : CANCELA.has(evento) ? "cancelled"
    : SUSPENDE.has(evento) ? "paused"
    : "outro";

  // Três caminhos para descobrir de quem é o pagamento, e não um só.
  //
  // A documentação pública do Asaas não afirma que o externalReference do
  // checkout é herdado pela assinatura e pelas cobranças dela. Pode ser que
  // sim; apostar nisso e errar significaria pagamento órfão e cliente pagando
  // sem receber acesso. Então mandamos os três e a rota tenta na ordem:
  // organização pelo externalReference, depois pela assinatura, depois pelo
  // cliente. Quando um deles resolve, o vínculo é gravado e os próximos meses
  // acham pelo caminho direto.
  const referencia = String(pagamento.externalReference ?? "");

  return {
    // A chave de idempotência é o id do pagamento, nunca o do evento — o Asaas
    // reenvia, e id de evento novo a cada reenvio contaria o mesmo dinheiro
    // duas vezes.
    //
    // E os dois eventos que aprovam compartilham a MESMA chave, de propósito.
    // O mesmo pagamento no cartão gera PAYMENT_CONFIRMED hoje e
    // PAYMENT_RECEIVED 32 dias depois; com uma chave por evento, o segundo
    // renderia um mês de acesso que ninguém pagou. Com a chave compartilhada,
    // o primeiro a chegar credita e o outro esbarra no unique do banco —
    // inclusive se um dia só o RECEIVED chegar.
    //
    // Estorno e chargeback ficam com chave própria: estornar um pagamento
    // confirmado é fato novo, não repetição.
    idUnico: status === "approved"
      ? `asaas:pago:${pagamento.id}`
      : `asaas:${evento}:${pagamento.id}`,
    provedor: "asaas",
    assinaturaId: pagamento.subscription ?? null,
    clienteId: pagamento.customer ?? null,
    institutionId: UUID.test(referencia) ? referencia : null,
    tipo: "pagamento",
    status,
    valor: typeof pagamento.value === "number" ? pagamento.value : null,
    // Um pagamento aprovado compra um mês. Os demais não compram nada.
    meses: status === "approved" ? 1 : 0,
    payload: (corpo ?? {}) as Record<string, unknown>,
  };
}

export const asaas: AdaptadorDePagamento = {
  nome: "asaas",
  configurado: asaasConfigurado,
  criarAssinatura,
  cancelarAssinatura,
};
