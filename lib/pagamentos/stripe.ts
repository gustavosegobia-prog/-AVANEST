import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  AdaptadorDePagamento,
  AssinaturaCriada,
  EventoDeCobranca,
  NovaAssinatura,
} from "./tipos.ts";

// Stripe — assinatura mensal no cartão.
//
// Por que existe: a conta do Mercado Pago foi bloqueada, e o Asaas nunca
// respondeu ao suporte depois que o primeiro pagamento não passou. A camada de
// pagamento foi escrita para essa troca — o que muda de um gateway para outro
// mora no adaptador, e o resto do sistema não sabe qual está cobrando.
//
// Sem SDK, de propósito. Os outros dois adaptadores falam com o gateway por
// fetch e assinam webhook com node:crypto; trazer uma biblioteca só para este
// deixaria três jeitos diferentes de fazer a mesma coisa no mesmo diretório.
//
// A chave secreta é segredo de servidor: mora nas variáveis de ambiente da
// Vercel e nunca sai daqui. Nenhuma função deste arquivo pode ser chamada do
// navegador.

const API = "https://api.stripe.com/v1";

export function stripeConfigurado() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function chave() {
  const valor = process.env.STRIPE_SECRET_KEY;
  if (!valor) throw new Error("STRIPE_SECRET_KEY não configurada na Vercel.");
  return valor;
}

/**
 * A API do Stripe recebe formulário, não JSON, e aninha com colchetes:
 * `subscription_data[metadata][meses_gratis]=2`. Escrever isso à mão em cada
 * chamada é onde nascem os erros silenciosos — um colchete fora do lugar vira
 * um campo que o Stripe ignora sem reclamar.
 */
function form(dados: Record<string, unknown>, prefixo = ""): string[] {
  const partes: string[] = [];
  for (const [chaveBruta, valor] of Object.entries(dados)) {
    if (valor === undefined || valor === null) continue;
    const nome = prefixo ? `${prefixo}[${chaveBruta}]` : chaveBruta;
    if (typeof valor === "object" && !Array.isArray(valor)) {
      partes.push(...form(valor as Record<string, unknown>, nome));
    } else if (Array.isArray(valor)) {
      valor.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          partes.push(...form(item as Record<string, unknown>, `${nome}[${i}]`));
        } else {
          partes.push(`${encodeURIComponent(`${nome}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      partes.push(`${encodeURIComponent(nome)}=${encodeURIComponent(String(valor))}`);
    }
  }
  return partes;
}

async function chamar<T>(caminho: string, corpo?: Record<string, unknown>, metodo = "POST"): Promise<T> {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${chave()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: corpo ? form(corpo).join("&") : undefined,
    cache: "no-store",
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    // O Stripe devolve {error:{message,...}}, e a message explica o problema
    // melhor do que o status.
    throw new Error(`Stripe respondeu ${resposta.status}: ${texto.slice(0, 400)}`);
  }
  return texto ? (JSON.parse(texto) as T) : ({} as T);
}

/**
 * O fim do período grátis, em segundos desde 1970 — que é como o Stripe conta.
 *
 * Zero mês devolve undefined em vez de "agora": mandar um trial_end no passado
 * faz o Stripe recusar a sessão inteira, e o cliente veria um erro no lugar do
 * checkout por causa de uma campanha desligada.
 */
export function fimDoPeriodoGratis(mesesGratis: number, agora = new Date()): number | undefined {
  const meses = Number.isFinite(mesesGratis) ? Math.max(0, Math.trunc(mesesGratis)) : 0;
  if (meses === 0) return undefined;

  const fim = new Date(agora.getTime());
  // Fixa o dia 1 antes de somar: 31/08 + 1 mês transbordaria para 01/10, e o
  // cliente seria cobrado um dia depois do combinado.
  const dia = fim.getUTCDate();
  fim.setUTCDate(1);
  fim.setUTCMonth(fim.getUTCMonth() + meses);
  const ultimoDia = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth() + 1, 0)).getUTCDate();
  fim.setUTCDate(Math.min(dia, ultimoDia));
  return Math.floor(fim.getTime() / 1000);
}

type SessaoCheckout = { id: string; url: string | null };

export async function criarAssinatura(dados: NovaAssinatura): Promise<AssinaturaCriada> {
  const trialEm = fimDoPeriodoGratis(dados.mesesGratis ?? 0);
  const centavos = Math.round(dados.valorMensal * 100);
  if (!(centavos > 0)) throw new Error("Valor mensal inválido para o Stripe.");

  const sessao = await chamar<SessaoCheckout>("/checkout/sessions", {
    mode: "subscription",
    locale: "pt-BR",
    // É por aqui que o webhook reencontra a organização. O valor é nosso, e
    // nunca é lido como verdade sem conferir contra o banco.
    client_reference_id: dados.institutionId,
    customer_email: dados.emailPagador || undefined,
    success_url: dados.retornoSucesso,
    cancel_url: dados.retornoCancelado,
    // Sempre pedir o cartão, inclusive com período grátis. Sem isto o Stripe
    // deixa passar sem meio de pagamento quando há trial, e no fim dos dois
    // meses não haveria o que cobrar — a assinatura morreria sozinha e o
    // cliente sumiria sem ninguém perceber.
    payment_method_collection: "always",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "brl",
        unit_amount: centavos,
        recurring: { interval: "month" },
        product_data: {
          name: `AVANEST ${dados.plano}`,
          // É o texto que o cliente lê na fatura do cartão.
          description: `Assinatura mensal — ${dados.organizacao}`,
        },
      },
    }],
    subscription_data: {
      trial_end: trialEm,
      metadata: {
        institution_id: dados.institutionId,
        // Guardado aqui porque o webhook precisa saber quantos meses foram
        // dados sem ter de recalcular a campanha — a campanha pode ter mudado
        // entre o checkout e o aviso.
        meses_gratis: String(dados.mesesGratis ?? 0),
      },
    },
    // A MESMA informação nos DOIS lugares, e não é redundância.
    //
    // `subscription_data.metadata` vai para a ASSINATURA, e é de lá que as
    // renovações a leem. O evento `checkout.session.completed` entrega a
    // SESSÃO, que tem o metadata próprio — e foi exatamente aqui que o
    // primeiro cliente pagante quase se perdeu: sem `meses_gratis` na sessão,
    // o webhook leu zero mês, somou zero à validade, e a assinatura ficou
    // "ativa" com a data do teste de 14 dias em vez dos 60 dias comprados.
    metadata: {
      institution_id: dados.institutionId,
      meses_gratis: String(dados.mesesGratis ?? 0),
    },
  });

  if (!sessao?.url) throw new Error("O Stripe não devolveu o link do checkout.");
  // A assinatura ainda não existe: ela nasce quando o cliente termina o
  // checkout. Até lá a referência é a sessão, e o id definitivo é gravado
  // quando o aviso de checkout concluído chega.
  return { provedor: "stripe", referencia: sessao.id, url: sessao.url };
}

export async function cancelarAssinatura(assinaturaId: string): Promise<void> {
  // cancel_at_period_end, e não delete: cancelar aqui quer dizer "não renove
  // mais". O cliente pagou o mês e o acesso dele vai até o fim dele. Apagar a
  // assinatura cortaria o acesso no mesmo instante, e ele teria pago por dias
  // que não usou.
  await chamar(`/subscriptions/${encodeURIComponent(assinaturaId)}`, { cancel_at_period_end: true });
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * O Stripe assina o corpo bruto com HMAC-SHA256 e manda no cabeçalho
 * `Stripe-Signature`, no formato `t=<segundos>,v1=<hex>`.
 *
 * O que é assinado é `${t}.${corpo}` — o timestamp entra na conta de propósito,
 * para que um aviso capturado hoje não possa ser reenviado amanhã. Por isso a
 * tolerância de tempo abaixo não é zelo extra: sem ela, a assinatura continua
 * válida para sempre e o replay volta a funcionar.
 */
export function conferirWebhook(dados: {
  cabecalhoAssinatura: string | null;
  corpoBruto: string;
  agora?: number;
  toleranciaSegundos?: number;
}): boolean {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo || !dados.cabecalhoAssinatura) return false;

  let t = "";
  const assinaturas: string[] = [];
  for (const parte of dados.cabecalhoAssinatura.split(",")) {
    const [nome, valor] = parte.trim().split("=");
    if (nome === "t") t = valor ?? "";
    // v1 pode aparecer mais de uma vez durante a troca de segredo do Stripe.
    else if (nome === "v1" && valor) assinaturas.push(valor);
  }
  if (!t || !assinaturas.length) return false;

  const segundos = Number(t);
  if (!Number.isFinite(segundos)) return false;
  const agora = dados.agora ?? Math.floor(Date.now() / 1000);
  const tolerancia = dados.toleranciaSegundos ?? 300;
  if (Math.abs(agora - segundos) > tolerancia) return false;

  const esperado = createHmac("sha256", segredo)
    .update(`${t}.${dados.corpoBruto}`, "utf8")
    .digest("hex");
  const a = Buffer.from(esperado, "utf8");

  return assinaturas.some((recebida) => {
    const b = Buffer.from(recebida, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

type ObjetoStripe = {
  id?: string;
  object?: string;
  client_reference_id?: string | null;
  subscription?: string | null;
  customer?: string | null;
  amount_paid?: number;
  amount_total?: number;
  current_period_end?: number;
  trial_end?: number | null;
  metadata?: Record<string, string> | null;
  subscription_details?: DetalhesDaAssinatura | null;
  // Versões da API a partir de 2025-03 movem o vínculo da fatura com a
  // assinatura para cá. Ver `assinaturaDaFatura`.
  parent?: { subscription_details?: DetalhesDaAssinatura | null } | null;
  lines?: { data?: Array<{ period?: { end?: number } }> } | null;
};

type DetalhesDaAssinatura = {
  subscription?: string | null;
  metadata?: Record<string, string> | null;
};

type CorpoWebhook = { id?: string; type?: string; data?: { object?: ObjetoStripe } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O fim do período pago desta fatura, em segundos. */
function fimDoPeriodo(objeto: ObjetoStripe): number | null {
  if (typeof objeto.current_period_end === "number") return objeto.current_period_end;
  const linha = objeto.lines?.data?.[0]?.period?.end;
  return typeof linha === "number" ? linha : null;
}

/**
 * De qual assinatura é esta fatura, e o que veio anexado a ela.
 *
 * A fatura mudou de forma no meio do caminho. Até 2025-02 o Stripe entregava
 * `invoice.subscription` e `invoice.subscription_details`; de 2025-03 em diante
 * os dois moraram para dentro de `invoice.parent.subscription_details`. Um
 * webhook criado hoje nasce na versão nova, e um criado no ano passado continua
 * na antiga — a conta escolhe, e o painel deixa mudar depois.
 *
 * Ler só uma das formas quebra exatamente onde dói mais: a primeira compra
 * passaria (ela vem pelo `client_reference_id` do checkout, que não mudou), e
 * só as RENOVAÇÕES ficariam órfãs — sem assinatura para achar a organização,
 * ninguém estende a validade e o cliente adimplente é bloqueado.
 */
function daAssinatura(objeto: ObjetoStripe): DetalhesDaAssinatura {
  const novo = objeto.parent?.subscription_details;
  const velho = objeto.subscription_details;
  return {
    subscription: novo?.subscription ?? velho?.subscription ?? null,
    metadata: novo?.metadata ?? velho?.metadata ?? null,
  };
}

export function lerEvento(corpo: unknown): EventoDeCobranca | null {
  const dados = corpo as CorpoWebhook | null;
  const evento = String(dados?.type ?? "");
  const objeto = dados?.data?.object;
  if (!evento || !objeto?.id) return null;

  const daFatura = daAssinatura(objeto);
  const meta = objeto.metadata ?? daFatura.metadata ?? null;
  const referencia = String(objeto.client_reference_id ?? meta?.institution_id ?? "");
  const institutionId = UUID.test(referencia) ? referencia : null;
  const assinaturaId = typeof objeto.subscription === "string"
    ? objeto.subscription
    : typeof daFatura.subscription === "string" ? daFatura.subscription
    : objeto.object === "subscription" ? objeto.id : null;

  const base = {
    provedor: "stripe" as const,
    assinaturaId,
    clienteId: typeof objeto.customer === "string" ? objeto.customer : null,
    institutionId,
    tipo: "pagamento" as const,
    payload: (corpo ?? {}) as Record<string, unknown>,
  };

  switch (evento) {
    // O checkout terminou. Com período grátis não houve dinheiro nenhum, e é
    // justamente por isso que este evento importa: sem ele o cliente que
    // aceitou a campanha seria bloqueado quando o teste de 14 dias acabasse, e
    // ficaria sem acesso até a primeira fatura — 46 dias depois.
    case "checkout.session.completed": {
      const meses = Number(meta?.meses_gratis ?? 0);
      // A DATA DO STRIPE MANDA, quando ela vem. `trial_end` é o dia em que o
      // período grátis acaba e a primeira cobrança sai — é a mesma data que o
      // cliente leu na tela do checkout, e discordar dela é prometer uma coisa
      // e entregar outra.
      //
      // O `meses` fica de reserva, para a sessão que chegar sem período: aí a
      // conta do banco soma os meses da campanha à validade que houver.
      const ate = typeof objeto.trial_end === "number" ? objeto.trial_end
        : fimDoPeriodo(objeto);
      return {
        ...base,
        idUnico: `stripe:checkout:${objeto.id}`,
        status: "approved",
        valor: typeof objeto.amount_total === "number" ? objeto.amount_total / 100 : null,
        meses: Number.isFinite(meses) && meses > 0 ? meses : 0,
        acessoAte: ate,
      };
    }

    // A assinatura nasceu ou mudou de período. Trazem `trial_end` e
    // `current_period_end` — a data autoritativa, direto da fonte. Entram
    // aqui como rede: se a sessão do checkout vier sem data por qualquer
    // motivo, é este evento que acerta a validade.
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const ate = typeof objeto.trial_end === "number" ? objeto.trial_end
        : fimDoPeriodo(objeto);
      // Sem data, o evento é só ruído: registra e não move validade nenhuma.
      if (!ate) {
        return { ...base, idUnico: `stripe:${evento}:${objeto.id}`, status: "outro", valor: null, meses: 0, acessoAte: null };
      }
      return {
        ...base,
        // Uma chave por DATA, e não por evento: o Stripe dispara
        // `subscription.updated` várias vezes com o mesmo período, e uma
        // chave nova a cada disparo faria o unique do banco parar de proteger.
        idUnico: `stripe:periodo:${objeto.id}:${ate}`,
        status: "approved",
        valor: null,
        meses: 0,
        acessoAte: ate,
      };
    }

    // Dinheiro entrou. A data de fim do período vem do próprio Stripe, e é ela
    // que manda: somar "mais um mês" a cada fatura faz o acesso descolar da
    // cobrança um pouco a cada vez, e ao fim de um ano o cliente tem semanas
    // que ninguém pagou.
    case "invoice.paid":
    case "invoice.payment_succeeded":
      return {
        ...base,
        // Os dois eventos compartilham a MESMA chave de propósito: o Stripe
        // dispara ambos para a mesma fatura, e uma chave por evento contaria
        // o mesmo dinheiro duas vezes.
        idUnico: `stripe:pago:${objeto.id}`,
        status: "approved",
        valor: typeof objeto.amount_paid === "number" ? objeto.amount_paid / 100 : null,
        meses: 1,
        acessoAte: fimDoPeriodo(objeto),
      };

    // Venceu e não pagou. Não é cancelamento: o cliente ainda pode acertar, e
    // o acesso segue até a data que ele já tinha comprado.
    case "invoice.payment_failed":
      return { ...base, idUnico: `stripe:falhou:${objeto.id}`, status: "paused", valor: null, meses: 0, acessoAte: null };

    // A assinatura acabou de verdade — cancelada pelo cliente ou por falta de
    // pagamento depois das tentativas do Stripe.
    case "customer.subscription.deleted":
      return { ...base, idUnico: `stripe:cancelada:${objeto.id}`, status: "cancelled", valor: null, meses: 0, acessoAte: null };

    // Dinheiro que voltou.
    case "charge.refunded":
    case "charge.dispute.created":
      return { ...base, idUnico: `stripe:${evento}:${objeto.id}`, status: "cancelled", valor: null, meses: 0, acessoAte: null };

    default:
      // O Stripe tem centenas de eventos. O resto é registrado como "outro" e
      // não move validade nenhuma.
      return { ...base, idUnico: `stripe:${evento}:${objeto.id}`, status: "outro", valor: null, meses: 0, acessoAte: null };
  }
}

export const stripe: AdaptadorDePagamento = {
  nome: "stripe",
  configurado: stripeConfigurado,
  criarAssinatura,
  cancelarAssinatura,
};
