import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PrintDocuments } from "./print-documents";

export default async function DocumentsPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login");
  const [{data:avaliacao},{data:perfil}]=await Promise.all([
    supabase.from("avaliacoes").select("id,institution_id,patient_id,status,versao,dados,snapshot_conclusao,created_at,updated_at,concluida_at").eq("id",id).single(),
    supabase.from("perfis").select("id,nome,crm,rqe,role,permissoes").eq("id",user.id).single(),
  ]);
  if(!avaliacao)notFound();
  const {data:paciente}=await supabase.from("pacientes").select("*").eq("id",avaliacao.patient_id).single();
  if(!paciente||!perfil)notFound();
  // O papel impresso leva o nome de quem atende, não o da plataforma.
  const {data:organizacao}=await supabase.from("instituicoes")
    .select("nome,tipo,telefone").eq("id",avaliacao.institution_id).maybeSingle();
  return <PrintDocuments avaliacao={avaliacao} paciente={paciente} perfil={perfil} organizacao={organizacao??null}/>;
}
