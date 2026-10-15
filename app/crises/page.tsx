import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { CrisesClient } from "./crises-client";

export const metadata: Metadata = {
  title: "Manejo de crises em anestesia | AVANEST",
  robots: { index: false, follow: false },
};

// Manejo de crises em anestesia: os protocolos de intercorrência, em tela
// própria, a partir do menu da área médica.
//
// Quem entra: quem tem acesso clínico (médico, administrador, proprietário) e
// o super-admin. Todos veem os mesmos protocolos. Nada aqui lê ou grava dado
// de paciente.
export default async function CrisesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis").select("role, status, super_admin, permissoes, atuacao_medica").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo") redirect("/dashboard");
  const permissoes = Array.isArray(perfil.permissoes) ? (perfil.permissoes as string[]) : [];
  const clinico = ["medico", "admin", "owner"].includes(String(perfil.role)) || perfil.atuacao_medica === true
    || permissoes.includes("medico") || permissoes.includes("todos");
  if (!clinico && perfil.super_admin !== true) redirect("/dashboard");

  return <CrisesClient superAdmin={perfil.super_admin === true} />;
}
