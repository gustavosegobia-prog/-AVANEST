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

  // O local congelado vem numa consulta à parte, e não junto da avaliação, por
  // uma razão prática: esta coluna nasce numa migration, e enquanto ela não
  // tiver rodado o PostgREST recusaria a consulta inteira — a página de
  // documentos sumiria com 404 em vez de imprimir. Separada, o pior caso é o
  // cabeçalho seguir como sempre foi. É o mesmo defeito que logo_url causou
  // aqui em cima; uma vez basta.
  const {data:comLocal}=await supabase.from("avaliacoes")
    .select("local_snapshot").eq("id",avaliacao.id).maybeSingle();
  // O papel impresso leva o nome de quem atende, não o da plataforma.
  //
  // logo_url saiu daqui, e a ausência dela era um defeito silencioso: a coluna
  // nunca existiu em migration nenhuma, e o PostgREST não devolve null para
  // coluna inexistente — ele recusa a consulta inteira. Como o erro não era
  // lido, organizacao ficava null e TODA ficha e TODO termo saíam com
  // "SERVIÇO DE ANESTESIOLOGIA" no lugar do nome da clínica.
  //
  // A marca passa a vir do local de atendimento, que é onde ela faz sentido:
  // quem atende em três hospitais tem três cabeçalhos, não um.
  const {data:organizacao,error:erroOrganizacao}=await supabase.from("instituicoes")
    .select("nome,tipo,telefone").eq("id",avaliacao.institution_id).maybeSingle();
  // Ler o erro em vez de descartá-lo: foi descartá-lo que escondeu o problema
  // acima por meses.
  if(erroOrganizacao)console.error("[documentos] organização",erroOrganizacao);
  return <PrintDocuments avaliacao={{...avaliacao,local_snapshot:comLocal?.local_snapshot??null}} paciente={paciente} perfil={perfil} organizacao={organizacao??null}/>;
}
