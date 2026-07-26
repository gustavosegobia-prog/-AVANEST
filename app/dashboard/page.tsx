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
    .select("id, institution_id, nome, role, status, must_reset")
    .eq("id", user.id)
    .single();
  if (!perfil || perfil.status !== "ativo") redirect("/login");

  const canManage = ["admin", "owner"].includes(perfil.role);
  const canFinance = ["financeiro", "admin", "owner"].includes(perfil.role);
  const allowedViews: DashboardView[] =
    perfil.role === "recepcao" ? ["recepcao"]
    : perfil.role === "medico" ? ["medico"]
    : perfil.role === "financeiro" ? ["financeiro"]
    : canManage ? ["recepcao", "medico", "financeiro", "admin"]
    : ["medico"];
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
    needsFinanceData || needsAdminData ? supabase.from("convenio_valores").select("*").order("convenio").order("procedimento") : Promise.resolve({ data: [] }),
  ]);

  return (
    <DashboardClient
      perfil={perfil}
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
