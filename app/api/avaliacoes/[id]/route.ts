import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// A exclusão é feita no servidor: a chave administrativa nunca chega ao navegador.
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  // A rota mais destrutiva do sistema apaga registro clínico. Confere a origem
  // como a de faturamento já fazia — não fazia sentido a mais perigosa ser a
  // menos protegida.
  const origemInvalida = validateMutationRequest(request);
  if (origemInvalida) return origemInvalida;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Identificador de avaliação inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });

  // Apagar avaliação é uma de cada vez, com confirmação na tela. Dez por
  // minuto já é folgado — e transforma "conta tomada apaga o arquivo inteiro
  // num laço" em algo lento o bastante para alguém notar.
  const excedeu = enforceRateLimit(`avaliacao-excluir:${user.id}`, { limit: 10, windowMs: 60_000 });
  if (excedeu) return excedeu;

  const { data: actor } = await supabase
    .from("perfis")
    .select("id,institution_id,role,status,nome")
    .eq("id", user.id)
    .single();

  if (!actor || actor.status !== "ativo" || !["medico", "admin", "owner"].includes(actor.role)) {
    return NextResponse.json({ error: "Somente médico ou administrador pode excluir uma avaliação." }, { status: 403 });
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
    .select("id,patient_id,status,concluida_at,pacientes(nome)")
    .eq("id", id)
    .eq("institution_id", actor.institution_id)
    .maybeSingle();

  if (!assessment) return NextResponse.json({ error: "Avaliação não encontrada ou já removida." }, { status: 404 });

  // O grosso dos registros clínicos cai em cascata, e agendamento e
  // financeiro apenas se desligam, preservando a agenda e o caixa. Duas
  // amarras não caem sozinhas e travariam a exclusão da concluída:
  // os documentos gerados e a referência "avaliação anterior" de uma
  // reavaliação posterior.
  await admin.from("documentos").delete().eq("assessment_id", assessment.id);
  await admin
    .from("avaliacoes")
    .update({ avaliacao_anterior_id: null })
    .eq("avaliacao_anterior_id", assessment.id)
    .eq("institution_id", actor.institution_id);

  const { error: deleteError } = await admin
    .from("avaliacoes")
    .delete()
    .eq("id", assessment.id)
    .eq("institution_id", actor.institution_id);
  if (deleteError) return NextResponse.json({ error: "Não foi possível excluir a avaliação. Tente novamente." }, { status: 500 });

  // O histórico responde "quem apagou o quê, e de quem era": o nome entra
  // por escrito porque o perfil do autor pode ser excluído depois, e aí o
  // id sozinho não contaria a história.
  const pacienteNome = (assessment as { pacientes?: { nome?: string } | null }).pacientes?.nome ?? null;
  await admin.from("auditoria").insert({
    institution_id: actor.institution_id,
    actor_id: actor.id,
    user_id: actor.id,
    entidade: "avaliacao",
    entidade_id: assessment.id,
    acao: "avaliacao_excluida",
    detalhes: {
      patient_id: assessment.patient_id,
      paciente: pacienteNome,
      status: assessment.status,
      concluida_at: assessment.concluida_at,
      excluida_por: actor.nome,
    },
  });

  return NextResponse.json({ ok: true });
}
