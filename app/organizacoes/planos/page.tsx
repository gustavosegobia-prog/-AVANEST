import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PlanosAdminClient } from "./planos-admin-client";

export default async function PlanosAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis").select("id, nome, super_admin, status").eq("id", user.id).maybeSingle();
  // As funções no banco também recusam quem não é super-admin; aqui é só para
  // não mostrar uma tela vazia a quem não deveria vê-la.
  if (!perfil || perfil.status !== "ativo" || perfil.super_admin !== true) redirect("/dashboard");

  const [{ data: planos }, { data: campanha }, { data: vagas }] = await Promise.all([
    supabase.from("planos").select("*").order("ordem"),
    supabase.from("campanha_fundador").select("*").maybeSingle(),
    supabase.rpc("vagas_fundador"),
  ]);

  return (
    <PlanosAdminClient
      nome={perfil.nome}
      planos={planos ?? []}
      campanha={campanha}
      vagas={Array.isArray(vagas) ? vagas[0] : vagas}
    />
  );
}
