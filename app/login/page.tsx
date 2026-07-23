import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { createClient } from "@/utils/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return (
    <main className="loginPage">
      <a className="loginBack" href="/">← Voltar ao site</a>
      <section className="loginCard">
        <p className="kicker"><b>01</b> Área segura</p>
        <h1>ENTRE NO<br /><span>AVANEST.</span></h1>
        <p>Acesso exclusivo para profissionais autorizados.</p>
        <LoginForm />
      </section>
    </main>
  );
}
