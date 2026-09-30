import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";

/**
 * Reenvia o convite por e-mail de quem ainda não criou a senha.
 *
 * As mesmas travas de quem convida (administrador ou proprietário ativo, da
 * mesma organização) e duas a mais:
 *
 *   * só reenvia para quem NUNCA entrou — para quem já tem senha, "reenviar
 *     convite" seria mandar um link de definição de senha para uma conta
 *     em uso;
 *   * não reenvia se o último convite saiu há menos de dez minutos. A marca
 *     é o invited_at do próprio Supabase, e não um contador em memória: com
 *     vários servidores atendendo, um contador por servidor deixaria o
 *     clique duplo mandar dois e-mails.
 */
const INTERVALO_MINIMO_MS = 10 * 60_000;

export async function POST(request: NextRequest) {
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  // O mesmo balde de quem convida: reenvio também dispara e-mail do nosso domínio.
  const excedeu = enforceRateLimit(`convite-usuario:${user.id}`, { limit: 20, windowMs: 3_600_000 });
  if (excedeu) return excedeu;

  const { data: actor } = await supabase
    .from("perfis").select("id,institution_id,role,status").eq("id", user.id).single();
  if (!actor || actor.status !== "ativo" || !["admin", "owner"].includes(actor.role)) {
    return NextResponse.json({ error: "Você não tem permissão para reenviar convites." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const perfilId = String(body?.perfil_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(perfilId)) {
    return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 400 });
  }

  const { data: alvo } = await supabase
    .from("perfis").select("id,institution_id,nome,email,role,status,sem_acesso").eq("id", perfilId).maybeSingle();
  if (!alvo || alvo.institution_id !== actor.institution_id) {
    return NextResponse.json({ error: "Pessoa não encontrada nesta organização." }, { status: 404 });
  }
  if (alvo.sem_acesso || !alvo.email) {
    return NextResponse.json({ error: "Este cadastro não tem conta de acesso, então não há convite para reenviar." }, { status: 400 });
  }
  if (alvo.status !== "ativo") {
    return NextResponse.json({ error: "O acesso desta pessoa está desativado. Reative antes de reenviar o convite." }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "O envio de convites ainda não foi habilitado no servidor." }, { status: 503 });
  }
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: conta } = await admin.auth.admin.getUserById(alvo.id);
  if (!conta?.user) {
    return NextResponse.json({ error: "Não foi possível encontrar a conta desta pessoa." }, { status: 404 });
  }
  if (conta.user.email_confirmed_at || conta.user.last_sign_in_at) {
    return NextResponse.json({ error: `${alvo.nome} já criou a senha e entra normalmente. Não há convite pendente.` }, { status: 409 });
  }
  const ultimoConvite = conta.user.invited_at ? Date.parse(conta.user.invited_at) : 0;
  if (Date.now() - ultimoConvite < INTERVALO_MINIMO_MS) {
    return NextResponse.json({ error: "Um convite foi enviado há menos de dez minutos. Aguarde antes de enviar outro — o e-mail pode estar chegando." }, { status: 429 });
  }

  const redirectTo = new URL("/auth/callback?next=/atualizar-senha", request.nextUrl.origin).toString();
  const { error } = await admin.auth.admin.inviteUserByEmail(alvo.email, {
    redirectTo,
    data: { nome: alvo.nome, institution_id: alvo.institution_id, role: alvo.role },
  });
  if (error) {
    return NextResponse.json({ error: "O Supabase não conseguiu reenviar o convite. Confira o e-mail e as configurações de envio." }, { status: 502 });
  }

  await supabase.from("auditoria").insert({
    institution_id: actor.institution_id,
    actor_id: actor.id,
    entidade: "perfil",
    entidade_id: alvo.id,
    acao: "convite_reenviado",
    detalhes: { nome: alvo.nome, email: alvo.email },
  });

  return NextResponse.json({ ok: true });
}
