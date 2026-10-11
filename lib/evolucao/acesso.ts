import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Quem entra nas telas da Evolução Anestésica.
//
// Enquanto o módulo amadurece, só o super-admin — o mesmo arranjo de
// /calculos. A trava de verdade está no banco (evolucao_liberada() nas
// políticas); esta só evita mostrar uma tela que o banco vai recusar. Liberar
// para todos é virar `recursos_liberados.liberado` no banco e trocar esta
// verificação pela função `evolucao_liberada`.
export async function exigirAcessoAEvolucao() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, nome, crm, rqe, role, status, super_admin, institution_id, permissoes")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || perfil.status !== "ativo" || perfil.super_admin !== true) redirect("/dashboard");
  return { supabase, perfil };
}
