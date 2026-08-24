import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { conferirWebhook, lerEvento } from "@/lib/pagamentos/stripe";

// Aviso de cobrança do Stripe.
//
// Rota pública por natureza — quem chama é o Stripe, não um usuário logado.
// Por isso ela não acredita em nada que chega: primeiro confere a assinatura
// HMAC do corpo bruto, e só depois lê o que veio.
//
// O que ela nunca faz é decidir sozinha que alguém pagou. Quem estende a
// validade é registrar_pagamento_assinatura, no banco, com o unique que impede
// o mesmo pagamento render dois meses.

export const dynamic = "force-dynamic";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  // Exige só o que esta rota de fato usa: o segredo do webhook para conferir
  // quem chamou, e a chave de serviço para gravar. A STRIPE_SECRET_KEY NÃO
  // entra aqui — receber um pagamento não depende de a gente poder chamar o
  // Stripe de volta, o aviso já traz tudo. Com ela na condição, um dia em que
  // fosse trocada todo pagamento que chegasse levaria 503, o Stripe contaria
  // como falha e acabaria desativando o endpoint. Cliente pagando, acesso não
  // liberando, e a causa seria uma chave que esta rota nem usa.
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[webhook/stripe] integração não configurada");
    return NextResponse.json({ erro: "não configurado" }, { status: 503 });
  }

  // Texto bruto, e não request.json(). A assinatura do Stripe cobre os bytes
  // exatos que ele mandou; ler como JSON e serializar de novo muda espaços e
  // ordem de chaves, e aí nenhuma assinatura legítima confere.
  const corpoBruto = await request.text();

  if (!conferirWebhook({
    cabecalhoAssinatura: request.headers.get("stripe-signature"),
    corpoBruto,
  })) {
    console.warn("[webhook/stripe] assinatura inválida");
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(corpoBruto);
  } catch {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }

  const evento = lerEvento(corpo);
  // Aviso que não é de cobrança: devolver 200 evita o Stripe reenviar para
  // sempre uma coisa que a gente nunca vai processar.
  if (!evento) return NextResponse.json({ ok: true, ignorado: "sem evento de cobrança" });
  if (evento.status === "outro") {
    return NextResponse.json({ ok: true, ignorado: "evento sem efeito" });
  }

  try {
    const supabase = admin();
    const institutionId = await acharOrganizacao(supabase, evento);
    if (!institutionId) {
      // Sem dono, não dá para creditar. 200 de propósito: reenviar não vai
      // fazer aparecer uma organização que não existe, e o log é o que conta.
      console.warn("[webhook/stripe] pagamento sem organização", {
        pagamento: evento.idUnico,
        assinatura: evento.assinaturaId,
        cliente: evento.clienteId,
      });
      return NextResponse.json({ ok: true, ignorado: "organização não encontrada" });
    }

    // Grava o id definitivo da assinatura no primeiro aviso que o traga.
    //
    // Até aqui a organização estava vinculada à sessão de checkout: a
    // assinatura do Stripe só nasce quando o cliente termina de pagar. Sem esta
    // linha, o cancelamento não teria o que cancelar, e as faturas dos meses
    // seguintes — que não trazem client_reference_id — chegariam órfãs.
    if (evento.assinaturaId) {
      const { error } = await supabase.rpc("vincular_assinatura", {
        p_institution_id: institutionId,
        p_provedor: "stripe",
        p_assinatura_id: evento.assinaturaId,
        p_cliente_id: evento.clienteId,
        p_email: null,
      });
      // Vínculo é conveniência; não pode impedir o pagamento de ser creditado.
      if (error) console.error("[webhook/stripe] vincular", error);
    }

    const { error } = await supabase.rpc("registrar_pagamento_assinatura", {
      p_institution_id: institutionId,
      p_mp_id: evento.idUnico,
      p_tipo: evento.tipo,
      p_status: evento.status,
      p_valor: evento.valor,
      p_meses: evento.meses,
      p_payload: evento.payload,
      // A data real do Stripe, quando o aviso traz. É ela que manda sobre a
      // soma de meses — ver o comentário de acessoAte em lib/pagamentos/tipos.
      p_acesso_ate: evento.acessoAte ? new Date(evento.acessoAte * 1000).toISOString() : null,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (erro) {
    // 500 faz o Stripe reenviar, que é exatamente o que se quer: pagamento não
    // pode se perder por causa de uma falha nossa. O reenvio é seguro porque a
    // chave de idempotência já está no banco.
    console.error("[webhook/stripe]", evento.idUnico, erro);
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }
}

type Admin = ReturnType<typeof admin>;

/**
 * De quem é este pagamento.
 *
 * Três caminhos, e não um só. O client_reference_id só existe no aviso do
 * checkout; as faturas dos meses seguintes chegam sem ele, e se a busca
 * dependesse dele o cliente renovaria sem receber a renovação. Tenta-se na
 * ordem, do mais direto ao mais indireto, e o primeiro que responder resolve.
 */
async function acharOrganizacao(
  supabase: Admin,
  evento: { institutionId: string | null; assinaturaId: string | null; clienteId: string | null },
): Promise<string | null> {
  // 1. O id que nós mesmos mandamos, quando volta. Já veio validado como UUID.
  if (evento.institutionId) {
    const { data } = await supabase
      .from("instituicoes").select("id").eq("id", evento.institutionId).maybeSingle();
    if (data?.id) return data.id;
  }

  // 2. Pela assinatura, que é como os meses seguintes chegam.
  if (evento.assinaturaId) {
    const { data } = await supabase.rpc("instituicao_por_assinatura", {
      p_provedor: "stripe",
      p_assinatura_id: evento.assinaturaId,
    });
    if (data) return data as string;
  }

  // 3. Pelo cliente. Último recurso, para o caso de a assinatura ter sido
  //    recriada do lado do Stripe e mudar de id.
  if (evento.clienteId) {
    const { data } = await supabase
      .from("instituicoes").select("id")
      .eq("pagamento_provedor", "stripe")
      .eq("pagamento_cliente_id", evento.clienteId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}
