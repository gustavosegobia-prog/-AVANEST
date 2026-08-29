import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";
import { hoje } from "@/lib/data-local";

type RouteContext = { params: Promise<{ id: string }> };
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: RouteContext) {
  const invalidRequest = validateMutationRequest(request);
  if (invalidRequest) return invalidRequest;

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Identificador de avaliação inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401 });
  }

  const rateLimited = enforceRateLimit(`assessment-billing:${user.id}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const { data: actor } = await supabase
    .from("perfis")
    .select("id,institution_id,role,status")
    .eq("id", user.id)
    .single();

  if (!actor || actor.status !== "ativo" || !["medico", "admin", "owner"].includes(actor.role)) {
    return NextResponse.json({ error: "Perfil sem permissão para concluir avaliações." }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "O faturamento automático não está configurado no servidor." }, { status: 503 });
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await admin
    .from("financeiro_atendimentos")
    .select("id,valor")
    .eq("institution_id", actor.institution_id)
    .eq("avaliacao_id", id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, created: false, atendimento: existing });

  const { data: assessment } = await admin
    .from("avaliacoes")
    .select("id,patient_id,status,created_by,concluida_at")
    .eq("id", id)
    .eq("institution_id", actor.institution_id)
    .maybeSingle();

  if (!assessment || assessment.status !== "concluida") {
    return NextResponse.json({ error: "A avaliação precisa estar concluída antes do faturamento." }, { status: 409 });
  }

  const { data: patient } = await admin
    .from("pacientes")
    .select("id,convenio,hospital,procedimento,cirurgia,data_consulta")
    .eq("id", assessment.patient_id)
    .eq("institution_id", actor.institution_id)
    .maybeSingle();
  if (!patient) {
    return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
  }

  const convenio = patient.convenio?.trim() || "Particular";
  const procedimento = patient.procedimento?.trim() || patient.cirurgia?.trim() || "";
  const hospital = patient.hospital?.trim() || "";
  const { data: rules } = await admin
    .from("convenio_valores")
    .select("id,procedimento,hospital,valor,repasse_percentual")
    .eq("institution_id", actor.institution_id)
    .eq("convenio", convenio)
    .eq("ativo", true);

  const rule = (rules ?? [])
    .filter((item) =>
      (!item.procedimento || item.procedimento === procedimento) &&
      (!item.hospital || item.hospital === hospital),
    )
    .sort((a, b) =>
      Number(Boolean(b.procedimento)) + Number(Boolean(b.hospital)) -
      Number(Boolean(a.procedimento)) - Number(Boolean(a.hospital)),
    )[0];

  const valor = Number(rule?.valor ?? 0);
  const repassePercentual = Number(rule?.repasse_percentual ?? 0);
  const referenceDate =
    patient.data_consulta || assessment.concluida_at?.slice(0, 10) || hoje();

  // A RECEPÇÃO PODE TER CHEGADO PRIMEIRO. Um particular que pagou no balcão já
  // tem lançamento aberto, com o valor real e a forma de pagamento — e sem
  // `avaliacao_id`, porque a avaliação ainda não existia. Inserir outra linha
  // aqui contaria o mesmo paciente duas vezes no mês, e a chave única não
  // impede: `(institution_id, patient_id, avaliacao_id)` aceita as duas,
  // porque uma tem nulo e a outra não.
  //
  // O valor da recepção PREVALECE. Ele é o que a pessoa efetivamente pagou; o
  // daqui é o da tabela de convênios, que para particular é uma referência.
  const { data: jaAberto } = await admin
    .rpc("atendimento_aberto_do_paciente", {
      p_institution_id: actor.institution_id,
      p_patient_id: patient.id,
    });

  if (jaAberto) {
    const { data: amarrado } = await admin
      .from("financeiro_atendimentos")
      .update({
        avaliacao_id: assessment.id,
        medico_id: assessment.created_by || actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jaAberto)
      .select("id,valor")
      .single();
    if (amarrado) {
      await admin.from("auditoria").insert({
        institution_id: actor.institution_id, actor_id: actor.id,
        entidade: "financeiro_atendimento", entidade_id: amarrado.id,
        acao: "avaliacao_amarrada_ao_recebimento_da_recepcao",
        detalhes: { avaliacao_id: assessment.id },
      });
      return NextResponse.json({ ok: true, created: false, atendimento: amarrado });
    }
  }

  const { data: atendimento, error } = await admin
    .from("financeiro_atendimentos")
    .insert({
      institution_id: actor.institution_id,
      patient_id: patient.id,
      avaliacao_id: assessment.id,
      medico_id: assessment.created_by || actor.id,
      convenio,
      hospital: hospital || null,
      valor,
      recebido: 0,
      status: "aguardando",
      repasse_valor: valor * repassePercentual / 100,
      repasse_status: "pendente",
      periodo: referenceDate.slice(0, 7),
      observacoes: valor > 0
        ? "Lançamento automático após conclusão da avaliação."
        : "Lançamento automático sem valor configurado para este convênio.",
    })
    .select("id,valor")
    .single();

  if (error) {
    const { data: concurrentEntry } = await admin
      .from("financeiro_atendimentos")
      .select("id,valor")
      .eq("institution_id", actor.institution_id)
      .eq("avaliacao_id", id)
      .maybeSingle();
    if (concurrentEntry) {
      return NextResponse.json({ ok: true, created: false, atendimento: concurrentEntry });
    }
    return NextResponse.json({ error: "Não foi possível gerar o lançamento financeiro." }, { status: 500 });
  }

  await admin.from("auditoria").insert({
    institution_id: actor.institution_id,
    actor_id: actor.id,
    entidade: "financeiro_atendimento",
    entidade_id: atendimento.id,
    acao: "lancamento_automatico",
    detalhes: { avaliacao_id: id, convenio, valor },
  });

  return NextResponse.json({ ok: true, created: true, atendimento });
}
