import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AssessmentForm } from "./assessment-form";
import type { QuestionarioRespondido } from "@/components/questionario/na-avaliacao";

// O questionário que o paciente respondeu pelo celular entra se for dos
// últimos 4 meses: o de uma cirurgia de anos atrás já não descreve o paciente.
const QUESTIONARIO_VALE_DIAS = 120;

export default async function AssessmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { id } = await params;
  const { editar } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: avaliacao }, { data: perfil }] = await Promise.all([
    supabase.from("avaliacoes").select("id,institution_id,patient_id,status,versao,dados,updated_at,lock_version").eq("id", id).single(),
    supabase.from("perfis").select("id,nome,crm,rqe,role").eq("id", user.id).single(),
  ]);
  if (!avaliacao) notFound();
  if (!perfil) redirect("/login");
  if (avaliacao.status === "concluida" && editar !== "1") redirect(`/avaliacoes/${avaliacao.id}/documentos`);
  const { data: paciente } = await supabase
    .from("pacientes")
    .select("id,nome,cpf,rg,data_nascimento,idade_anos,sexo,telefone,email,hospital,cirurgia,especialidade,procedimento,convenio,data_consulta,horario")
    .eq("id", avaliacao.patient_id)
    .single();
  if (!paciente) notFound();
  const desde = new Date(Date.now() - QUESTIONARIO_VALE_DIAS * 86400000).toISOString();
  const { data: questionario } = await supabase
    .from("questionarios_pre")
    .select("id,respostas,fotos,respondido_em,usado_em")
    .eq("patient_id", paciente.id)
    .eq("status", "respondido")
    .gte("respondido_em", desde)
    .order("respondido_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return <AssessmentForm avaliacao={avaliacao} paciente={paciente} perfil={perfil}
    questionario={(questionario as QuestionarioRespondido | null) ?? null} />;
}
