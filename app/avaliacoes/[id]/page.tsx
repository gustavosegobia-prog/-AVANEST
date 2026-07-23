import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AssessmentForm } from "./assessment-form";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: avaliacao } = await supabase.from("avaliacoes").select("id,institution_id,patient_id,status,versao,dados,updated_at").eq("id", id).single();
  if (!avaliacao) notFound();
  const [{ data: paciente }, { data: perfil }] = await Promise.all([
    supabase.from("pacientes").select("id,nome,cpf,rg,data_nascimento,sexo,telefone,email,hospital,cirurgia,especialidade,procedimento,convenio,data_consulta,horario").eq("id", avaliacao.patient_id).single(),
    supabase.from("perfis").select("id,nome,crm,rqe,role").eq("id", user.id).single(),
  ]);
  if (!paciente) notFound();
  if (!perfil) redirect("/login");
  return <AssessmentForm avaliacao={avaliacao} paciente={paciente} perfil={perfil} />;
}
