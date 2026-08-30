import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";
import { provedorAtivo } from "@/lib/pagamentos";
import { normalizarCupom } from "@/lib/pagamentos/cupom";

// Confere um cupom antes de abrir o pagamento.
//
// Existe para a pessoa VER o desconto na nossa tela, e não descobrir se o
// código presta só depois de já estar dentro do checkout do Stripe. Quem
// recebeu um cupom num evento quer a confirmação antes de digitar o cartão.
//
// Esta rota NÃO cobra nada e NÃO reserva nada. Quem decide o preço continua
// sendo o banco, na hora do checkout, e o cupom é conferido de novo lá — o que
// esta rota responde é informação para a tela, nunca autorização de desconto.

export async function POST(request: NextRequest) {
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  // Limite curto, e por um motivo específico: sem ele isto é um adivinhador de
  // cupons. Cada chamada responde "existe" ou "não existe" para um código
  // qualquer, e alguém com um laço descobriria a campanha inteira em minutos.
  // Quem recebeu um cupom digita uma ou duas vezes; vinte é folga de sobra.
  const excedeu = enforceRateLimit(`assinatura-cupom:${user.id}`, { limit: 20, windowMs: 600_000 });
  if (excedeu) return excedeu;

  const corpo = await request.json().catch(() => null) as { cupom?: unknown } | null;
  const codigo = normalizarCupom(corpo?.cupom);
  if (!codigo) return NextResponse.json({ error: "Digite o cupom." }, { status: 400 });

  const provedor = provedorAtivo();
  if (!provedor?.buscarCupom) {
    return NextResponse.json({ error: "Cupons não estão disponíveis agora." }, { status: 503 });
  }

  let cupom;
  try {
    cupom = await provedor.buscarCupom(codigo);
  } catch (erro) {
    // Gateway fora do ar não é cupom inválido, e dizer "cupom inválido" aqui
    // mandaria a pessoa embora achando que o código dela não presta.
    console.error("[assinatura/cupom]", erro);
    return NextResponse.json({ error: "Não foi possível conferir o cupom agora. Tente de novo." }, { status: 502 });
  }

  if (!cupom) {
    return NextResponse.json({ error: "Cupom não encontrado ou já encerrado." }, { status: 404 });
  }

  // O id do cupom no gateway (`promo_...`) NÃO vai para o navegador. A tela só
  // precisa do desconto para mostrar; quem procura o cupom de novo, na hora de
  // cobrar, é o servidor — pelo código, e não por um id que veio de fora.
  return NextResponse.json({
    codigo: cupom.codigo,
    percentual: cupom.percentual,
    valorFixo: cupom.valorFixo,
    duracao: cupom.duracao,
    meses: cupom.meses,
  });
}
