import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { adaptadorDe } from "@/lib/pagamentos";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { emailDeCancelamento } from "@/lib/aviso-de-cancelamento";

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

export async function POST(request: NextRequest) {
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  // Cancelar é uma ação por vez, não uma rajada. O limite existe porque cada
  // chamada fala com o gateway e grava auditoria.
  const excedeu = enforceRateLimit(`assinatura-cancelar:${user.id}`, { limit: 5, windowMs: 600_000 });
  if (excedeu) return excedeu;

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
  const AVISO_EQUIPE = "Cancelamento registrado. A cobrança recorrente será encerrada pela equipe do AVANEST.";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = serviceKey
    ? createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    : null;
  const { data: perfil } = await supabase
    .from("perfis").select("institution_id, nome, email").eq("id", user.id).maybeSingle();

  let cobrancaEncerrada = true;
  let aviso: string | undefined;
  if (!admin) {
    cobrancaEncerrada = false;
    aviso = AVISO_EQUIPE;
  } else {
    const { data: cobranca } = await admin
      .from("instituicoes").select("pagamento_provedor,pagamento_assinatura_id")
      .eq("id", perfil?.institution_id ?? "").maybeSingle();
    const dados = cobranca as
      { pagamento_provedor?: string | null; pagamento_assinatura_id?: string | null } | null;
    const assinaturaId = dados?.pagamento_assinatura_id;
    // Sem assinatura no provedor (cortesia, cobrança fora do sistema, ou que
    // nunca chegou a existir), não há o que encerrar.
    if (assinaturaId) {
      // O gateway em que ESTA assinatura nasceu, não o que cobra as novas. Mandar
      // o id de um gateway para outro daria "não encontrei", e o cliente seguiria
      // sendo cobrado depois de ter cancelado. Hoje só o Stripe tem adaptador; as
      // organizações que ainda guardam 'asaas' ou 'mercadopago' caem no null
      // abaixo, e nenhuma delas tem assinatura ativa para encerrar.
      const provedor = adaptadorDe(dados?.pagamento_provedor);
      if (!provedor) {
        cobrancaEncerrada = false;
        aviso = AVISO_EQUIPE;
      } else {
        try {
          await provedor.cancelarAssinatura(assinaturaId);
        } catch {
          cobrancaEncerrada = false;
          aviso = "Cancelamento registrado, mas não consegui encerrar a cobrança automática agora. "
            + "A equipe do AVANEST vai concluir — se aparecer uma cobrança nova, avise que devolvemos.";
        }
      }
    }
    // AVISA O DONO DO AVANEST (25/11/2026): antes ninguém sabia do
    // cancelamento, e a devolução prometida na tela dependia de alguém abrir o
    // Stripe por acaso. Falha no aviso não desfaz nada do que já foi feito.
    try {
      await avisarODono(admin, supabase, {
        institutionId: perfil?.institution_id ?? null,
        quem: perfil ? { nome: String(perfil.nome ?? ""), email: String(perfil.email ?? "") } : null,
        motivo, acessoAte, reembolsoDevido, cobrancaEncerrada,
      });
    } catch (e) {
      console.error("[api/assinatura/cancelar] aviso ao dono", e);
    }
  }

  return NextResponse.json({ ok: true, acessoAte, reembolsoDevido, cobrancaEncerrada, ...(aviso ? { aviso } : {}) });
}

type Sessao = Awaited<ReturnType<typeof createClient>>;

async function avisarODono(admin: SupabaseClient, supabase: Sessao, c: {
  institutionId: string | null; quem: { nome: string; email: string } | null; motivo: string;
  acessoAte: string | null; reembolsoDevido: boolean; cobrancaEncerrada: boolean;
}) {
  if (!emailConfigurado() || !c.institutionId) return;
  const [{ data: donos }, { data: assinaturaData }, { data: pagamento }] = await Promise.all([
    admin.from("perfis").select("email").eq("super_admin", true).eq("status", "ativo"),
    supabase.rpc("minha_assinatura"),
    admin.from("assinatura_eventos").select("valor")
      .eq("institution_id", c.institutionId).eq("tipo", "pagamento").eq("status", "approved").gt("valor", 0)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const destinos = [...new Set((donos ?? []).map((d) => String(d.email ?? "").trim()).filter(Boolean))];
  if (!destinos.length) return;
  const assinatura = (Array.isArray(assinaturaData) ? assinaturaData[0] : assinaturaData) as
    { organizacao?: string; plano?: string; em_teste?: boolean } | null;
  const mensagem = emailDeCancelamento({
    organizacao: assinatura?.organizacao ?? "Organização",
    plano: assinatura?.plano ?? null,
    quem: c.quem, motivo: c.motivo || null, acessoAte: c.acessoAte,
    emTeste: assinatura?.em_teste === true,
    reembolsoDevido: c.reembolsoDevido,
    ultimoPagamento: pagamento?.valor != null ? Number(pagamento.valor) : null,
    cobrancaEncerrada: c.cobrancaEncerrada,
  });
  await Promise.all(destinos.map((para) => enviarEmail({ para, ...mensagem })));
}
