import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { OnboardingForm } from "./onboarding-form";

export default async function ComecarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Quem já pertence a uma organização não passa por aqui.
  const { data: perfil } = await supabase
    .from("perfis").select("id").eq("id", user.id).maybeSingle();
  if (perfil) redirect("/dashboard");

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnOnboardingCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>Cada organização tem seus próprios pacientes, avaliações e documentos, sem qualquer acesso aos dados das demais.</p>
        </div>
        <div className="avnLoginContent">
          <h1>Como você vai usar o AVANEST?</h1>
          <p>Escolha uma opção para concluir seu cadastro.</p>
          <OnboardingForm email={user.email ?? ""} />
        </div>
      </section>
    </main>
  );
}
