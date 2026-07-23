import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis")
    .select("nome, role, must_reset")
    .eq("id", user.id)
    .single();
  return (
    <main className="dashboardPage">
      <section className="dashboardCard">
        <p className="kicker"><b>✓</b> Conexão segura</p>
        <h1>OLÁ,<br /><span>{perfil?.nome ?? "PROFISSIONAL"}.</span></h1>
        <p>Seu login está funcionando e o perfil <strong>{perfil?.role ?? "autorizado"}</strong> foi reconhecido.</p>
        {perfil?.must_reset && <p className="loginNotice">A troca de senha no primeiro acesso será configurada na próxima etapa.</p>}
        <a className="btn btnYellow" href="/">VOLTAR AO SITE</a>
      </section>
    </main>
  );
}
