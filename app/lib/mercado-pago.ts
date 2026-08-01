import { createHmac, timingSafeEqual } from "node:crypto";

// Integração com o Mercado Pago (Assinaturas / preapproval).
//
// O token de acesso é segredo de servidor: mora só nas variáveis de ambiente
// da Vercel e nunca sai daqui. Nenhuma função deste arquivo pode ser chamada
// do navegador.

const API = "https://api.mercadopago.com";

export const MP_MENSAL = 49.99;

export function mercadoPagoConfigurado() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

function token() {
  const valor = process.env.MP_ACCESS_TOKEN;
  if (!valor) throw new Error("MP_ACCESS_TOKEN não configurado na Vercel.");
  return valor;
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const corpo = await resposta.text();
  if (!resposta.ok) {
    // A mensagem do Mercado Pago costuma explicar o erro melhor do que o status.
    throw new Error(`Mercado Pago respondeu ${resposta.status}: ${corpo.slice(0, 400)}`);
  }
  return corpo ? (JSON.parse(corpo) as T) : ({} as T);
}

export type Preapproval = {
  id: string;
  status: string;
  init_point?: string;
  external_reference?: string;
  payer_email?: string;
  auto_recurring?: { transaction_amount?: number; frequency?: number; frequency_type?: string };
};

export type PagamentoAutorizado = {
  id: number | string;
  preapproval_id: string;
  status: string;
  transaction_amount?: number;
  payment?: { id?: number | string; status?: string };
};

// Cria a assinatura mensal. O cliente ainda precisa abrir o init_point e
// autorizar o débito — até lá ela fica pendente e nada é cobrado.
export function criarAssinatura(dados: {
  institutionId: string;
  organizacao: string;
  emailPagador: string;
  valorMensal: number;
  retorno: string;
}) {
  return chamar<Preapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: `AVANEST — ${dados.organizacao}`,
      external_reference: dados.institutionId,
      payer_email: dados.emailPagador,
      back_url: dados.retorno,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: Number(dados.valorMensal.toFixed(2)),
        currency_id: "BRL",
      },
    }),
  });
}

export function buscarAssinatura(preapprovalId: string) {
  return chamar<Preapproval>(`/preapproval/${encodeURIComponent(preapprovalId)}`);
}

export function buscarPagamentoAutorizado(id: string) {
  return chamar<PagamentoAutorizado>(`/authorized_payments/${encodeURIComponent(id)}`);
}

// O valor acompanha o número de anestesiologistas. Ajustar aqui vale para as
// próximas cobranças — a que já foi feita não muda.
export function ajustarValorMensal(preapprovalId: string, valorMensal: number) {
  return chamar<Preapproval>(`/preapproval/${encodeURIComponent(preapprovalId)}`, {
    method: "PUT",
    body: JSON.stringify({
      auto_recurring: {
        transaction_amount: Number(valorMensal.toFixed(2)),
        currency_id: "BRL",
      },
    }),
  });
}

export function cancelarAssinatura(preapprovalId: string) {
  return chamar<Preapproval>(`/preapproval/${encodeURIComponent(preapprovalId)}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });
}

// Confere se a notificação veio mesmo do Mercado Pago.
//
// O manifest é montado como "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
// e assinado com HMAC-SHA256 usando a chave secreta do webhook. Partes que não
// vierem na notificação saem do manifest.
export function assinaturaDoWebhookConfere(dados: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  segredo: string;
}) {
  if (!dados.xSignature) return false;

  const partes = new Map<string, string>();
  for (const trecho of dados.xSignature.split(",")) {
    const [chave, valor] = trecho.split("=", 2);
    if (chave && valor) partes.set(chave.trim(), valor.trim());
  }
  const ts = partes.get("ts");
  const v1 = partes.get("v1");
  if (!ts || !v1) return false;

  // O Mercado Pago manda o id alfanumérico em minúsculas no manifest.
  const id = dados.dataId ? dados.dataId.toLowerCase() : null;
  const manifest =
    (id ? `id:${id};` : "") +
    (dados.xRequestId ? `request-id:${dados.xRequestId};` : "") +
    `ts:${ts};`;

  const esperado = createHmac("sha256", dados.segredo).update(manifest).digest("hex");
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(v1, "utf8");
  // Comparar sem vazar tempo; tamanhos diferentes já reprovam.
  return a.length === b.length && timingSafeEqual(a, b);
}
