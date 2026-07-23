import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrintDocuments } from "./print-documents";

export default async function DocumentsPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const {data:avaliacao}=await supabase.from("avaliacoes").select("id,institution_id,patient_id,status,versao,dados,created_at,updated_at,concluida_at").eq("id",id).single();
  if(!avaliacao)notFound();
  const [{data:paciente},{data:perfil}]=await Promise.all([
    supabase.from("pacientes").select("*").eq("id",avaliacao.patient_id).single(),
    supabase.from("perfis").select("id,nome,crm,rqe,role").eq("id",user.id).single(),
  ]);
  if(!paciente||!perfil)notFound();
  return <PrintDocuments avaliacao={avaliacao} paciente={paciente} perfil={perfil}/>;
}
