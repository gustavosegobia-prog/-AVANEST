import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

// A exclusão é feita no servidor: a chave administrativa nunca chega ao navegador.
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });

  const { data: actor } = await supabase
    .from("perfis")
    .select("id,institution_id,role,status")
    .eq("id", user.id)
    .single();

  if (!actor || actor.status !== "ativo" || !["admin", "owner"].includes(actor.role)) {
    return NextResponse.json({ error: "Somente administrador ou proprietário pode excluir uma avaliação." }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "A exclusão segura ainda não está configurada no servidor." }, { status: 503 });
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: assessment } = await admin
    .from("avaliacoes")
    .select("id,patient_id,status")
    .eq("id", id)
    .eq("institution_id", actor.institution_id)
    .maybeSingle();

  if (!assessment) return NextResponse.json({ error: "Avaliação não encontrada ou já removida." }, { status: 404 });

  const { error: deleteError } = await admin
    .from("avaliacoes")
    .delete()
    .eq("id", assessment.id)
    .eq("institution_id", actor.institution_id);
  if (deleteError) return NextResponse.json({ error: "Não foi possível excluir a avaliação. Tente novamente." }, { status: 500 });

  await admin.from("auditoria").insert({
    institution_id: actor.institution_id,
    actor_id: actor.id,
    entidade: "avaliacao",
    entidade_id: assessment.id,
    acao: "avaliacao_excluida",
    detalhes: { patient_id: assessment.patient_id, status: assessment.status },
  });

  return NextResponse.json({ ok: true });
}
