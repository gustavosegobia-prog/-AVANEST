import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AssessmentForm } from "./assessment-form";

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
    .select("id,nome,cpf,rg,data_nascimento,sexo,telefone,email,hospital,cirurgia,especialidade,procedimento,convenio,data_consulta,horario")
    .eq("id", avaliacao.patient_id)
    .single();
  if (!paciente) notFound();
  return <AssessmentForm avaliacao={avaliacao} paciente={paciente} perfil={perfil} />;
}
