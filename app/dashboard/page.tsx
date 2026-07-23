import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
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
  const [
    { data: pacientes },
    { data: avaliacoes },
    { data: agendamentos },
    { data: financeiro },
    { data: pagamentos },
    { data: perfis },
    { data: auditoria },
    { data: periodos },
  ] = await Promise.all([
    perfil.role === "financeiro"
      ? supabase.rpc("financeiro_listar_pacientes")
      : supabase.from("pacientes").select("*").order("created_at", { ascending: false }),
    supabase.from("avaliacoes").select("id,patient_id,status,versao,updated_at,created_at,dados").order("updated_at", { ascending: false }),
    supabase.from("agendamentos").select("*").order("data", { ascending: true }).order("horario", { ascending: true }),
    canFinance ? supabase.from("financeiro_atendimentos").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    canFinance ? supabase.from("financeiro_pagamentos").select("*").order("paid_at", { ascending: false }) : Promise.resolve({ data: [] }),
    canManage ? supabase.from("perfis").select("id,institution_id,nome,email,role,status,crm,rqe,created_at,updated_at").order("nome") : Promise.resolve({ data: [] }),
    canManage ? supabase.from("auditoria").select("id,actor_id,entidade,entidade_id,acao,detalhes,created_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    canFinance ? supabase.from("financeiro_periodos").select("*").order("periodo", { ascending: false }) : Promise.resolve({ data: [] }),
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
    />
  );
}
