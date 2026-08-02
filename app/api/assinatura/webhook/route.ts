import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  ajustarValorMensal,
  assinaturaDoWebhookConfere,
  buscarAssinatura,
  buscarPagamentoAutorizado,
  mercadoPagoConfigurado,
} from "@/lib/mercado-pago";

// Aviso de pagamento do Mercado Pago.
//
// Esta rota é pública por natureza — quem chama é o Mercado Pago, não um
// usuário logado. Por isso ela nunca acredita no que chega no corpo da
// requisição: confere a assinatura HMAC e depois vai buscar o pagamento na
// API para saber o valor e o status de verdade.

export const dynamic = "force-dynamic";

function admin() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  const segredo = process.env.MP_WEBHOOK_SECRET;
  if (!segredo || !mercadoPagoConfigurado() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[assinatura/webhook] integração não configurada");
    return NextResponse.json({ erro: "não configurado" }, { status: 503 });
  }

  const corpo = await request.json().catch(() => null) as
    | { type?: string; topic?: string; action?: string; data?: { id?: string | number } }
    | null;

  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id")
    ?? (corpo?.data?.id != null ? String(corpo.data.id) : null);
  const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic")
    ?? corpo?.type ?? corpo?.topic ?? "";

  const confere = assinaturaDoWebhookConfere({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId,
    segredo,
  });
  if (!confere) {
    console.warn("[assinatura/webhook] assinatura inválida", { tipo, dataId });
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }
  if (!dataId) return NextResponse.json({ ok: true, ignorado: "sem data.id" });

  try {
    if (tipo === "subscription_authorized_payment") {
      return await pagamentoRecorrente(dataId);
    }
    if (tipo === "subscription_preapproval") {
      return await mudancaDaAssinatura(dataId);
    }
    // Outros tópicos não movem a validade; devolver 200 evita reenvio infinito.
    return NextResponse.json({ ok: true, ignorado: tipo });
  } catch (erro) {
    // Erro nosso ou do Mercado Pago: devolver 500 faz o Mercado Pago reenviar,
    // que é exatamente o que queremos — o pagamento não pode se perder.
    console.error("[assinatura/webhook]", tipo, dataId, erro);
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }
}

// Cobrança mensal: é ela que estende a validade.
async function pagamentoRecorrente(id: string) {
  const pagamento = await buscarPagamentoAutorizado(id);
  const preapproval = pagamento.preapproval_id;
  if (!preapproval) return NextResponse.json({ ok: true, ignorado: "sem preapproval" });

  const supabase = admin();
  const { data: institutionId } = await supabase.rpc("instituicao_por_preapproval", {
    p_preapproval_id: preapproval,
  });
  if (!institutionId) {
    console.warn("[assinatura/webhook] preapproval sem organização", preapproval);
    return NextResponse.json({ ok: true, ignorado: "organização não encontrada" });
  }

  const status = String(pagamento.payment?.status ?? pagamento.status ?? "");
  const { error } = await supabase.rpc("registrar_pagamento_assinatura", {
    p_institution_id: institutionId,
    p_mp_id: `authorized_payment:${id}`,
    p_tipo: "pagamento",
    p_status: status,
    p_valor: pagamento.transaction_amount ?? null,
    p_meses: 1,
    p_payload: pagamento as unknown as Record<string, unknown>,
  });
  if (error) throw error;

  if (status === "approved") await sincronizarValor(institutionId, preapproval);
  return NextResponse.json({ ok: true });
}

// Assinatura autorizada, pausada ou cancelada pelo cliente.
async function mudancaDaAssinatura(id: string) {
  const assinatura = await buscarAssinatura(id);
  const supabase = admin();
  const { data: institutionId } = await supabase.rpc("instituicao_por_preapproval", {
    p_preapproval_id: id,
  });
  const alvo = institutionId ?? assinatura.external_reference ?? null;
  if (!alvo) return NextResponse.json({ ok: true, ignorado: "organização não encontrada" });

  // "authorized" só quer dizer que o cliente autorizou o débito. Quem libera o
  // acesso é o pagamento aprovado, que chega no outro tópico.
  const status = String(assinatura.status ?? "");
  const { error } = await supabase.rpc("registrar_pagamento_assinatura", {
    p_institution_id: alvo,
    p_mp_id: `preapproval:${id}:${status}`,
    p_tipo: "assinatura",
    p_status: status,
    p_valor: assinatura.auto_recurring?.transaction_amount ?? null,
    p_meses: 0,
    p_payload: assinatura as unknown as Record<string, unknown>,
  });
  if (error) throw error;
  return NextResponse.json({ ok: true });
}

// Mantém a cobrança recorrente igual ao preço contratado.
//
// Antes daqui saía uma conta por cabeça, recalculada a cada pagamento. Com a
// tabela de planos isso passou a ser proibido: o preço de quem já assinou é
// congelado, e um fundador que contratasse por R$ 89 veria a mensalidade subir
// sozinha no mês seguinte. Agora só reconciliamos com preco_contratado, que
// nenhuma rotina automática altera — na prática é um no-op, e só age se um
// super-admin tiver mudado o valor daquele cliente de propósito.
async function sincronizarValor(institutionId: string, preapproval: string) {
  try {
    const supabase = admin();
    const { data: instituicao } = await supabase
      .from("instituicoes").select("preco_contratado").eq("id", institutionId).maybeSingle();
    const valor = Number(instituicao?.preco_contratado ?? 0);
    if (!(valor > 0)) return;

    const atual = await buscarAssinatura(preapproval);
    const cobrado = Number(atual.auto_recurring?.transaction_amount ?? 0);
    if (Math.abs(cobrado - valor) < 0.01) return;
    await ajustarValorMensal(preapproval, valor);
  } catch (erro) {
    // Ajuste de preço não pode derrubar a confirmação de um pagamento válido.
    console.error("[assinatura/webhook] sincronizarValor", erro);
  }
}
