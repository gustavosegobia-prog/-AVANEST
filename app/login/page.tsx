import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ senha?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <div className="avnLoginMonitor" aria-hidden="true">
            <svg viewBox="0 0 190 42">
              <path d="M0 27 H56 L66 27 73 9 83 37 91 18 97 27 H190" />
            </svg>
            <div className="avnMonitorScreen">
              <i /><i /><i />
            </div>
            <div className="avnMonitorFeet"><i /><i /></div>
          </div>
          <p>Segurança e organização em cada etapa da avaliação pré-anestésica.</p>
        </div>
        <div className="avnLoginContent">
          <h1>Entrar no AVANEST</h1>
          <p>Acesso individual, definido pela sua conta.</p>
          <LoginForm passwordChanged={query.senha === "alterada"} />
          <a className="avnLoginCancel" href="/">Cancelar</a>
        </div>
      </section>
    </main>
  );
}
