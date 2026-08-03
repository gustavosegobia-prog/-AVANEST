import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ senha?: string; convite?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    if (query.convite) redirect(`/convite/${encodeURIComponent(query.convite)}`);
    // Mesma regra do formulário: sem contrato, a porta de entrada é a tela
    // de assinatura; cortesia e plano pago seguem para o painel.
    const { data } = await supabase.rpc("minha_assinatura");
    const assinatura = Array.isArray(data) ? data[0] : data;
    const precisaContratar = ["trial", "cancelado"].includes(String(assinatura?.plano ?? ""));
    redirect(precisaContratar ? "/assinatura" : "/dashboard");
  }

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
          <LoginForm passwordChanged={query.senha === "alterada"} convite={query.convite ?? ""} />
          <Link className="avnLoginCancel" href="/">Cancelar</Link>
        </div>
      </section>
    </main>
  );
}
