import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AssessmentForm } from "./assessment-form";
import type { QuestionarioRespondido } from "@/components/questionario/na-avaliacao";

// O questionário que o paciente respondeu pelo celular entra se for dos
// últimos 4 meses: o de uma cirurgia de anos atrás já não descreve o paciente.
const QUESTIONARIO_VALE_DIAS = 120;
const desdeQuando = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();

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
  const desde = desdeQuando(QUESTIONARIO_VALE_DIAS);
  // O respondido e também o incompleto (o paciente parou no meio): as partes
  // que ele concluiu já foram salvas (migração 202611110001). "*" de
  // propósito, e só os campos abaixo seguem para a tela: o token não sai do
  // servidor, e a página não quebra se a coluna nova ainda não existir.
  const { data: linhas } = await supabase
    .from("questionarios_pre")
    .select("*")
    .eq("patient_id", paciente.id)
    .not("respostas", "is", null)
    .in("status", ["respondido", "enviado"])
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1);
  const q = (linhas ?? [])[0] as Record<string, unknown> | undefined;
  const questionario: QuestionarioRespondido | null = q ? {
    id: String(q.id),
    respostas: (q.respostas ?? {}) as QuestionarioRespondido["respostas"],
    fotos: (q.fotos ?? []) as string[],
    respondido_em: (q.respondido_em as string | null) ?? null,
    salvo_em: (q.salvo_em as string | null) ?? null,
    usado_em: (q.usado_em as string | null) ?? null,
    completo: q.status === "respondido",
    parte: typeof q.parte === "number" ? q.parte : null,
    expires_at: String(q.expires_at),
  } : null;
  return <AssessmentForm avaliacao={avaliacao} paciente={paciente} perfil={perfil} questionario={questionario} />;
}
