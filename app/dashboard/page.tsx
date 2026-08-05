import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardClient, type DashboardView } from "./dashboard-client";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; novo?: string; iniciar?: string }>;
}) {
  const { area, novo, iniciar } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, institution_id, nome, role, permissoes, status, must_reset, super_admin")
    .eq("id", user.id)
    .maybeSingle();
  // Conta criada mas ainda sem organização: conclui o cadastro antes de entrar.
  if (!perfil) redirect("/comecar");
  if (perfil.status !== "ativo") redirect("/login");

  const { data: instituicao } = await supabase
    .from("instituicoes")
    .select("nome, tipo, telefone, email")
    .eq("id", perfil.institution_id)
    .maybeSingle();

  // Trava comercial: assinatura vencida ou suspensa impede o uso do sistema.
  // O isolamento entre organizações continua a cargo do RLS.
  const { data: assinaturaData } = await supabase.rpc("minha_assinatura");
  const assinatura = Array.isArray(assinaturaData) ? assinaturaData[0] : assinaturaData;
  if (assinatura && assinatura.liberada === false) redirect("/assinatura");

  const permissionOrder: DashboardView[] = ["recepcao", "medico", "financeiro", "admin"];
  const assignedPermissions = Array.isArray(perfil.permissoes) ? perfil.permissoes : [];
  const hasLegacyFullAccess = ["admin", "owner"].includes(perfil.role) || assignedPermissions.includes("todos");
  const allowedViews: DashboardView[] = hasLegacyFullAccess
    ? permissionOrder
    : permissionOrder.filter((view) => perfil.role === view || assignedPermissions.includes(view));
  if (allowedViews.length === 0) allowedViews.push("medico");
  const canManage = allowedViews.includes("admin");
  const canFinance = allowedViews.includes("financeiro");
  const requestedView = ["recepcao", "medico", "financeiro", "admin"].includes(area ?? "")
    ? area as DashboardView
    : undefined;
  const initialView = requestedView && allowedViews.includes(requestedView)
    ? requestedView
    : allowedViews[0];
  const needsClinicalData = initialView === "recepcao" || initialView === "medico";
  const needsFinanceData = initialView === "financeiro" && canFinance;
  const needsAdminData = initialView === "admin" && canManage;
  const needsProfiles = needsAdminData || (initialView === "medico" && canManage);

  const [
    { data: pacientes },
    { data: avaliacoes },
    { data: agendamentos },
    { data: financeiro },
    { data: pagamentos },
    { data: perfis },
    { data: auditoria },
    { data: periodos },
    { data: convenioValores },
  ] = await Promise.all([
    needsFinanceData && perfil.role === "financeiro"
      ? supabase.rpc("financeiro_listar_pacientes")
      : needsClinicalData || needsFinanceData
        ? supabase.from("pacientes").select("*").order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    needsClinicalData || needsFinanceData
      ? supabase.from("avaliacoes").select("id,patient_id,created_by,status,versao,updated_at,created_at,concluida_at,dados").order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    needsClinicalData
      ? supabase.from("agendamentos").select("*").order("data", { ascending: true }).order("horario", { ascending: true })
      : Promise.resolve({ data: [] }),
    needsFinanceData ? supabase.from("financeiro_atendimentos").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    needsFinanceData ? supabase.from("financeiro_pagamentos").select("*").order("paid_at", { ascending: false }) : Promise.resolve({ data: [] }),
    needsProfiles ? supabase.from("perfis").select("id,institution_id,nome,email,role,status,crm,rqe,created_at,updated_at").order("nome") : Promise.resolve({ data: [] }),
    needsAdminData ? supabase.from("auditoria").select("id,actor_id,entidade,entidade_id,acao,detalhes,created_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    needsFinanceData ? supabase.from("financeiro_periodos").select("*").order("periodo", { ascending: false }) : Promise.resolve({ data: [] }),
    // A recepção também precisa: é a lista de convênios do cadastro do
    // paciente, e um convênio adicionado no financeiro tem de aparecer lá.
    needsClinicalData || needsFinanceData || needsAdminData ? supabase.from("convenio_valores").select("*").order("convenio").order("procedimento") : Promise.resolve({ data: [] }),
  ]);

  return (
    <DashboardClient
      perfil={perfil}
      // Vem do servidor, que já tem a sessão. Buscar no navegador deixaria a
      // tela "carregando..." — e o botão de trocar senha travado — sempre que
      // a chamada demorasse ou falhasse.
      email={user.email ?? ""}
      organizacao={instituicao ?? null}
      pacientes={pacientes ?? []}
      avaliacoes={avaliacoes ?? []}
      agendamentos={agendamentos ?? []}
      financeiro={financeiro ?? []}
      pagamentos={pagamentos ?? []}
      perfis={perfis ?? []}
      auditoria={auditoria ?? []}
      periodos={periodos ?? []}
      convenioValores={convenioValores ?? []}
      initialView={initialView}
      initialNewPatient={novo === "1"}
      autoStartAssessment={novo === "1" && iniciar === "1"}
    />
  );
}
