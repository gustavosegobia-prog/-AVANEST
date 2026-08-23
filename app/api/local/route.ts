import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { validateMutationRequest } from "@/lib/request-security";
import { COOKIE_LOCAL, COOKIE_LOCAL_MAX_AGE } from "@/lib/local-ativo";

// Escolhe o local de atendimento da sessão.
//
// Poderia ser só um cookie escrito pelo navegador, e seria errado: cookie é
// texto que o dono da máquina edita à vontade. Quem confere se a pessoa pode
// usar aquele local é selecionar_local, no banco, com o RLS por trás — e o
// cookie só é gravado depois que ela responde que sim.
//
// A mesma chamada registra o local como recente. São a mesma ação do ponto de
// vista de quem usa ("vou atender aqui"), e separar em duas daria uma lista de
// recentes que discorda do que a pessoa escolheu.

export async function POST(request: NextRequest) {
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  const corpo = await request.json().catch(() => null) as { localId?: unknown } | null;
  const localId = typeof corpo?.localId === "string" ? corpo.localId.trim() : "";

  // Sair do local ativo é legítimo: manda string vazia e o cookie some.
  if (!localId) {
    const resposta = NextResponse.json({ ok: true, local: null });
    resposta.cookies.delete(COOKIE_LOCAL);
    return resposta;
  }

  const { data: autorizado, error } = await supabase.rpc("selecionar_local", {
    p_local_id: localId,
  });
  if (error) {
    console.error("[api/local] selecionar", error);
    return NextResponse.json({ error: "Não foi possível registrar o local agora." }, { status: 500 });
  }
  if (autorizado !== true) {
    // Arquivado, de outra organização, ou particular de outra pessoa. A
    // mensagem é a mesma nos três casos de propósito: dizer qual deles é
    // confirmaria a existência de um local que não é da pessoa.
    return NextResponse.json(
      { error: "Este local não está disponível para você." },
      { status: 403 },
    );
  }

  const resposta = NextResponse.json({ ok: true, local: localId });
  resposta.cookies.set(COOKIE_LOCAL, localId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_LOCAL_MAX_AGE,
  });
  return resposta;
}
