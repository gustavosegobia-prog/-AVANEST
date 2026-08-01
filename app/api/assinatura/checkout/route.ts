import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { criarAssinatura, mercadoPagoConfigurado } from "@/lib/mercado-pago";

// Abre o checkout da assinatura mensal.
//
// Quem decide o valor é o servidor, a partir do número de anestesiologistas
// ativos: o navegador não manda preço.

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  const { data: perfil } = await supabase
    .from("perfis").select("id,institution_id,role,status").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo") {
    return NextResponse.json({ error: "Perfil inativo." }, { status: 403 });
  }
  if (!["owner", "admin"].includes(perfil.role)) {
    return NextResponse.json(
      { error: "Só o responsável pela organização pode contratar a assinatura." },
      { status: 403 },
    );
  }

  if (!mercadoPagoConfigurado()) {
    return NextResponse.json(
      { error: "O pagamento online ainda não foi habilitado. Fale com o AVANEST pelo WhatsApp." },
      { status: 503 },
    );
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "O servidor não está configurado para registrar a assinatura." },
      { status: 503 },
    );
  }

  const { data: assinaturaData } = await supabase.rpc("minha_assinatura");
  const assinatura = Array.isArray(assinaturaData) ? assinaturaData[0] : assinaturaData;
  if (!assinatura) return NextResponse.json({ error: "Organização não encontrada." }, { status: 404 });

  const valorMensal = Number(assinatura.valor_mensal ?? 0);
  if (!(valorMensal > 0)) {
    return NextResponse.json({
      error: "Cadastre ao menos um anestesiologista com CRM antes de assinar.",
    }, { status: 400 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://avanest.com.br";

  let preapproval;
  try {
    preapproval = await criarAssinatura({
      institutionId: perfil.institution_id,
      organizacao: String(assinatura.organizacao ?? "Organização"),
      emailPagador: user.email ?? "",
      valorMensal,
      retorno: `${site}/assinatura/retorno`,
    });
  } catch (erro) {
    // O motivo real vai para o log do servidor; o cliente recebe algo útil.
    console.error("[assinatura/checkout]", erro);
    return NextResponse.json({
      error: "Não foi possível abrir o pagamento agora. Tente de novo ou fale com o AVANEST.",
    }, { status: 502 });
  }

  if (!preapproval?.init_point) {
    return NextResponse.json({ error: "O Mercado Pago não devolveu o link de pagamento." }, { status: 502 });
  }

  // Guarda o vínculo com a chave de serviço: a coluna é protegida contra
  // escrita pelo cliente, e é isso que impede alguém de se dar acesso grátis.
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.rpc("vincular_assinatura_mp", {
    p_institution_id: perfil.institution_id,
    p_preapproval_id: preapproval.id,
    p_payer_email: user.email ?? "",
  });
  if (error) {
    console.error("[assinatura/checkout] vincular", error);
    return NextResponse.json({ error: "A assinatura foi criada, mas não ficou registrada. Fale com o AVANEST." }, { status: 500 });
  }

  return NextResponse.json({ url: preapproval.init_point });
}
