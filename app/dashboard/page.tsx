import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, institution_id, nome, role, must_reset")
    .eq("id", user.id)
    .single();
  if (!perfil) redirect("/login");

  const [{ data: pacientes }, { data: avaliacoes }, { data: financeiro }, { data: pagamentos }] = await Promise.all([
    supabase.from("pacientes").select("*").order("created_at", { ascending: false }),
    supabase.from("avaliacoes").select("id,patient_id,status,updated_at,created_at,dados").order("updated_at", { ascending: false }),
    supabase.from("financeiro_atendimentos").select("*").order("created_at", { ascending: false }),
    supabase.from("financeiro_pagamentos").select("*").order("paid_at", { ascending: false }),
  ]);

  return (
    <DashboardClient
      perfil={perfil}
      pacientes={pacientes ?? []}
      avaliacoes={avaliacoes ?? []}
      financeiro={financeiro ?? []}
      pagamentos={pagamentos ?? []}
    />
  );
}
