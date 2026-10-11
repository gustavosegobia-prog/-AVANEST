import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Quem entra nas telas da ficha anestésica.
//
// A mesma pergunta que as políticas do banco fazem: pode_evolucao() — ficha
// liberada (super-admin, liberada para a organização ou para todas), acesso
// clínico (médico, administrador, proprietário) e a própria instituição. A
// trava de verdade está no banco; esta só evita mostrar uma tela que o banco
// vai recusar. Liberar para outra organização é uma linha em
// `recursos_por_instituicao`.
export async function exigirAcessoAEvolucao() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, nome, crm, rqe, role, status, super_admin, institution_id, permissoes")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || perfil.status !== "ativo") redirect("/dashboard");
  const { data: pode } = await supabase.rpc("pode_evolucao", { p_institution_id: perfil.institution_id });
  if (pode !== true) redirect("/dashboard");
  return { supabase, perfil };
}
