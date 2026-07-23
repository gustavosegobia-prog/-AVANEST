import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

const ALLOWED_ROLES = new Set(["recepcao", "medico", "financeiro", "admin"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  const { data: actor } = await supabase
    .from("perfis")
    .select("id,institution_id,role,status")
    .eq("id", user.id)
    .single();
  if (!actor || actor.status !== "ativo" || !["admin", "owner"].includes(actor.role)) {
    return NextResponse.json({ error: "Você não tem permissão para adicionar usuários." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const nome = String(body?.nome ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = String(body?.role ?? "");
  if (!nome || !email.includes("@") || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Confira nome, e-mail e área de acesso." }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({
      error: "A criação de usuários ainda não foi habilitada no servidor. Configure a chave administrativa do Supabase na Vercel.",
    }, { status: 503 });
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const redirectTo = new URL("/auth/callback?next=/atualizar-senha", request.nextUrl.origin).toString();
  const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { nome, institution_id: actor.institution_id, role },
  });
  if (inviteError || !data.user) {
    const duplicate = inviteError?.message.toLowerCase().includes("already");
    return NextResponse.json({
      error: duplicate ? "Este e-mail já possui um acesso cadastrado." : "O Supabase não conseguiu enviar o convite. Confira o e-mail e as configurações de envio.",
    }, { status: 400 });
  }

  const { error: profileError } = await admin.from("perfis").insert({
    id: data.user.id,
    institution_id: actor.institution_id,
    nome,
    email,
    role,
    status: "ativo",
    must_reset: true,
    permissoes: [],
  });
  if (profileError) {
    return NextResponse.json({ error: "O usuário foi convidado, mas o perfil não pôde ser criado. Revise a tabela de perfis." }, { status: 500 });
  }

  await supabase.from("auditoria").insert({
    institution_id: actor.institution_id,
    actor_id: actor.id,
    entidade: "perfil",
    entidade_id: data.user.id,
    acao: "usuario_convidado",
    detalhes: { email, role },
  });

  return NextResponse.json({ ok: true });
}
