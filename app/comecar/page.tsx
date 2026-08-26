import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { OnboardingForm } from "./onboarding-form";

export default async function ComecarPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const { plano } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(plano ? `/login?plano=${encodeURIComponent(plano)}` : "/login");

  // Quem já pertence a uma organização não passa por aqui — mas se veio com um
  // plano escolhido, vai para o pagamento, não para o painel.
  const { data: perfil } = await supabase
    .from("perfis").select("id").eq("id", user.id).maybeSingle();
  if (perfil) redirect(plano ? `/assinatura?plano=${encodeURIComponent(plano)}` : "/dashboard");

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnOnboardingCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>Cada organização tem os seus próprios pacientes, escalas, avaliações e documentos, sem nenhum acesso aos dados das demais.</p>
        </div>
        <div className="avnLoginContent">
          <h1>Como você vai usar o AVANEST?</h1>
          <p>Escolha uma opção para concluir seu cadastro.</p>
          <OnboardingForm email={user.email ?? ""} plano={plano ?? ""} />
        </div>
      </section>
    </main>
  );
}
