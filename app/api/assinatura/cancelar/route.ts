import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { adaptadorDe } from "@/lib/pagamentos";

// Cancelar a assinatura.
//
// A ordem aqui é deliberada e não é a mais óbvia: primeiro registra no banco,
// depois avisa o gateway. O contrário parece mais seguro — só cancela de
// verdade quando a cobrança parar —, mas amarra o direito do cliente à saúde
// de um serviço de terceiro. Se o gateway estiver fora do ar, ou a conta
// bloqueada, a pessoa ficaria sem conseguir cancelar e continuaria sendo
// cobrada. Então o pedido é aceito sempre, e a cobrança é o que pode falhar e
// virar uma pendência nossa para resolver à mão.
//
// Cancelar aqui quer dizer "não renove mais". O acesso segue até a data já
// paga — quem decide isso é a função no banco, que não mexe em assinatura_ate.

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  const corpo = await request.json().catch(() => null) as { motivo?: unknown } | null;
  const motivo = typeof corpo?.motivo === "string" ? corpo.motivo.trim().slice(0, 500) : "";

  // A função confere o papel de quem chamou e descobre a organização pelo
  // próprio perfil: esta rota não escolhe qual assinatura cancelar.
  const { data: instituicaoData, error } = await supabase
    .rpc("cancelar_assinatura", { p_motivo: motivo || null });
  if (error) {
    const semPermissao = /permiss|proprietário|administrador/i.test(error.message);
    return NextResponse.json(
      { error: semPermissao ? error.message : "Não consegui registrar o cancelamento. Tente de novo." },
      { status: semPermissao ? 403 : 500 },
    );
  }

  // A função devolve uma linha com o que foi decidido: até quando vai o acesso
  // e se o cancelamento caiu dentro do prazo de devolução. Quem decide é o
  // banco — a rota só repassa, para a tela e o navegador não terem versão
  // própria da regra.
  const decidido = (Array.isArray(instituicaoData) ? instituicaoData[0] : instituicaoData) as
    { acesso_ate?: string | null; reembolso_devido?: boolean | null } | null;
  const acessoAte = decidido?.acesso_ate ?? null;
  const reembolsoDevido = decidido?.reembolso_devido === true;

  // Daqui para baixo é a cobrança. Nada que falhe aqui desfaz o cancelamento
  // acima: o cliente já saiu, e o que sobra é uma conta para fechar.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({
      ok: true,
      acessoAte,
      reembolsoDevido,
      cobrancaEncerrada: false,
      aviso: "Cancelamento registrado. A cobrança recorrente será encerrada pela equipe do AVANEST.",
    });
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: perfil } = await supabase
    .from("perfis").select("institution_id").eq("id", user.id).maybeSingle();
  const { data: cobranca } = await admin
    .from("instituicoes").select("pagamento_provedor,pagamento_assinatura_id")
    .eq("id", perfil?.institution_id ?? "").maybeSingle();

  const dados = cobranca as
    { pagamento_provedor?: string | null; pagamento_assinatura_id?: string | null } | null;
  const assinaturaId = dados?.pagamento_assinatura_id;
  if (!assinaturaId) {
    // Cortesia, cobrança fora do sistema, ou assinatura que nunca chegou a
    // existir no provedor: não há o que encerrar.
    return NextResponse.json({ ok: true, acessoAte, reembolsoDevido, cobrancaEncerrada: true });
  }

  // O gateway em que ESTA assinatura nasceu, não o que cobra as novas. Mandar
  // um preapproval do Mercado Pago para o Asaas daria "não encontrei", e o
  // cliente seguiria sendo cobrado depois de ter cancelado.
  const provedor = adaptadorDe(dados?.pagamento_provedor);
  if (!provedor) {
    return NextResponse.json({
      ok: true, acessoAte, reembolsoDevido, cobrancaEncerrada: false,
      aviso: "Cancelamento registrado. A cobrança recorrente será encerrada pela equipe do AVANEST.",
    });
  }

  try {
    await provedor.cancelarAssinatura(assinaturaId);
    return NextResponse.json({ ok: true, acessoAte, reembolsoDevido, cobrancaEncerrada: true });
  } catch {
    return NextResponse.json({
      ok: true,
      acessoAte,
      reembolsoDevido,
      cobrancaEncerrada: false,
      aviso:
        "Cancelamento registrado, mas não consegui encerrar a cobrança automática agora. " +
        "A equipe do AVANEST vai concluir — se aparecer uma cobrança nova, avise que devolvemos.",
    });
  }
}
