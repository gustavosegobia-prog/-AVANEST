import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { OrganizacoesClient } from "./organizacoes-client";

export default async function OrganizacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis").select("id, nome, super_admin, status").eq("id", user.id).maybeSingle();
  // A função no banco também recusa quem não é super-admin; aqui é só para não
  // mostrar uma tela vazia a quem não deveria vê-la.
  if (!perfil || perfil.status !== "ativo" || perfil.super_admin !== true) redirect("/dashboard");

  const { data: organizacoes } = await supabase.rpc("listar_organizacoes");

  return <OrganizacoesClient nome={perfil.nome} organizacoes={organizacoes ?? []} />;
}
