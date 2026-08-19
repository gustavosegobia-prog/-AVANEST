import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { asaasConfigurado, conferirWebhook, lerEvento } from "@/lib/pagamentos/asaas";

// Aviso de cobrança do Asaas.
//
// Rota pública por natureza — quem chama é o Asaas, não um usuário logado. Por
// isso ela não acredita em nada que chega: primeiro confere o token que o
// Asaas manda em todo aviso, e só depois lê o corpo.
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
  if (!asaasConfigurado() || !process.env.ASAAS_WEBHOOK_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[webhook/asaas] integração não configurada");
    return NextResponse.json({ erro: "não configurado" }, { status: 503 });
  }

  // O token vem no cabeçalho, antes de qualquer leitura do corpo: aviso não
  // autenticado não merece nem ser parseado.
  if (!conferirWebhook({ cabecalhos: request.headers })) {
    console.warn("[webhook/asaas] token inválido");
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const corpo = await request.json().catch(() => null);
  const evento = lerEvento(corpo);
  // Aviso que não é de cobrança, ou sem pagamento: devolver 200 evita o Asaas
  // reenviar para sempre uma coisa que a gente nunca vai processar.
  if (!evento) return NextResponse.json({ ok: true, ignorado: "sem evento de cobrança" });

  try {
    const supabase = admin();
    const institutionId = await acharOrganizacao(supabase, evento);
    if (!institutionId) {
      // Sem dono, não dá para creditar. 200 de propósito: reenviar não vai
      // fazer aparecer uma organização que não existe, e o log é o que conta.
      console.warn("[webhook/asaas] pagamento sem organização", {
        pagamento: evento.idUnico,
        assinatura: evento.assinaturaId,
        cliente: evento.clienteId,
      });
      return NextResponse.json({ ok: true, ignorado: "organização não encontrada" });
    }

    // Grava o id definitivo da assinatura na primeira cobrança que chegar.
    //
    // Até aqui a organização estava vinculada à sessão de checkout: a
    // assinatura do Asaas só nasce quando o cliente termina de pagar. Sem esta
    // linha, o cancelamento não teria o que cancelar, e as cobranças dos meses
    // seguintes dependeriam de o externalReference vir sempre.
    if (evento.assinaturaId) {
      const { error } = await supabase.rpc("vincular_assinatura", {
        p_institution_id: institutionId,
        p_provedor: "asaas",
        p_assinatura_id: evento.assinaturaId,
        p_cliente_id: evento.clienteId,
        p_email: null,
      });
      // Vínculo é conveniência; não pode impedir o pagamento de ser creditado.
      if (error) console.error("[webhook/asaas] vincular", error);
    }

    const { error } = await supabase.rpc("registrar_pagamento_assinatura", {
      p_institution_id: institutionId,
      p_mp_id: evento.idUnico,
      p_tipo: evento.tipo,
      p_status: evento.status,
      p_valor: evento.valor,
      p_meses: evento.meses,
      p_payload: evento.payload,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (erro) {
    // 500 faz o Asaas reenviar, que é exatamente o que se quer: pagamento não
    // pode se perder por causa de uma falha nossa. O reenvio é seguro porque a
    // chave de idempotência já está no banco.
    console.error("[webhook/asaas]", evento.idUnico, erro);
    return NextResponse.json({ erro: "falha ao processar" }, { status: 500 });
  }
}

type Admin = ReturnType<typeof admin>;

/**
 * De quem é este pagamento.
 *
 * Três caminhos, e não um só. A documentação pública do Asaas não afirma que o
 * externalReference posto no checkout é herdado pela assinatura e pelas
 * cobranças dela. Apostar nisso e errar seria pagamento órfão — cliente
 * pagando sem receber acesso. Então tenta-se na ordem, do mais direto ao mais
 * indireto, e o primeiro que responder resolve.
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
      p_provedor: "asaas",
      p_assinatura_id: evento.assinaturaId,
    });
    if (data) return data as string;
  }

  // 3. Pelo cliente. Último recurso, para o caso de a assinatura ter sido
  //    recriada do lado do Asaas e mudar de id.
  if (evento.clienteId) {
    const { data } = await supabase
      .from("instituicoes").select("id")
      .eq("pagamento_provedor", "asaas")
      .eq("pagamento_cliente_id", evento.clienteId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}
