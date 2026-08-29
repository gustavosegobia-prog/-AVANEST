import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { validateMutationRequest } from "@/lib/request-security";

// Guarda (ou apaga) o aparelho que quer receber notificação.
//
// O navegador já fez o trabalho difícil: falou com o serviço de push da
// Google ou da Apple e voltou com um endereço e duas chaves. Aqui só se anota
// de quem é.
//
// O PERFIL VEM DA SESSÃO, nunca do corpo do pedido. Aceitar um `perfilId`
// enviado pelo navegador deixaria qualquer um inscrever o próprio telefone
// para receber os avisos de um colega — e avisos de plantão dizem onde a
// pessoa vai estar e a que horas.

export async function POST(request: NextRequest) {
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  const corpo = await request.json().catch(() => null) as {
    endpoint?: unknown; p256dh?: unknown; auth?: unknown; aparelho?: unknown; sair?: unknown;
  } | null;

  const endpoint = typeof corpo?.endpoint === "string" ? corpo.endpoint.trim() : "";
  if (!endpoint || !/^https:\/\//.test(endpoint)) {
    return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  }

  // Desligar as notificações neste aparelho. O RLS garante que só sai o que é
  // da própria pessoa, então não é preciso conferir dono aqui.
  if (corpo?.sair === true) {
    const { error } = await supabase.from("push_inscricoes").delete().eq("endpoint", endpoint);
    if (error) {
      console.error("[api/push/inscrever] apagar", error);
      return NextResponse.json({ error: "Não foi possível desligar agora." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ativo: false });
  }

  const p256dh = typeof corpo?.p256dh === "string" ? corpo.p256dh : "";
  const auth = typeof corpo?.auth === "string" ? corpo.auth : "";
  if (!p256dh || !auth) {
    return NextResponse.json({ error: "Inscrição incompleta." }, { status: 400 });
  }

  const { data: perfil } = await supabase
    .from("perfis").select("institution_id").eq("id", user.id).maybeSingle();
  if (!perfil) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });

  // `onConflict: endpoint` porque o mesmo navegador reinscrito devolve o mesmo
  // endereço. Sem isto a pessoa acumularia uma linha por vez que abriu o app —
  // e receberia a mesma notificação cinco vezes.
  const { error } = await supabase.from("push_inscricoes").upsert({
    institution_id: perfil.institution_id,
    perfil_id: user.id,
    endpoint, p256dh, auth,
    aparelho: typeof corpo?.aparelho === "string" ? corpo.aparelho.slice(0, 120) : null,
    falhas: 0,
  }, { onConflict: "endpoint" });

  if (error) {
    console.error("[api/push/inscrever] salvar", error);
    return NextResponse.json({ error: "Não foi possível ligar as notificações agora." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ativo: true });
}
