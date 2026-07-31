import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { AcceptInviteForm } from "./accept-invite-form";

const PAPEIS: Record<string, string> = {
  admin: "Administrador", medico: "Anestesiologista",
  recepcao: "Recepção", financeiro: "Financeiro",
};

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data } = await supabase.rpc("convite_info", { p_token: token });
  const convite = Array.isArray(data) ? data[0] : data;
  const { data: { user } } = await supabase.auth.getUser();

  // Quem já pertence a uma organização não precisa de convite.
  if (user) {
    const { data: perfil } = await supabase
      .from("perfis").select("id").eq("id", user.id).maybeSingle();
    if (perfil) redirect("/dashboard");
  }

  const invalido = !convite || convite.valido !== true;
  const emailDiferente = Boolean(user?.email && convite &&
    user.email.toLowerCase() !== String(convite.email).toLowerCase());

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnOnboardingCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>Ao aceitar, você passa a fazer parte apenas desta organização.</p>
        </div>
        <div className="avnLoginContent">
          {invalido ? (
            <>
              <h1>Convite indisponível</h1>
              <p>Este convite não existe, já foi utilizado ou passou da validade. Peça um novo ao responsável pelo grupo.</p>
              <Link className="avnLoginCancel" href="/login">Voltar para o login</Link>
            </>
          ) : (
            <>
              <h1>Convite para {convite.organizacao}</h1>
              <p>
                Você foi convidado como <b>{PAPEIS[convite.papel] ?? convite.papel}</b>,
                no e-mail <b>{convite.email}</b>.
              </p>
              {!user ? (
                <>
                  <p className="avnOnboardingEmail">
                    Entre ou crie sua conta usando <b>{convite.email}</b> para aceitar.
                  </p>
                  <Link className="avnLoginSubmit avnInviteAction" href={`/login?convite=${encodeURIComponent(token)}`}>
                    Entrar e aceitar
                  </Link>
                </>
              ) : emailDiferente ? (
                <>
                  <p className="loginError" role="alert">
                    Você está conectado como <b>{user.email}</b>, mas o convite é para <b>{convite.email}</b>.
                    Saia desta conta e entre com o e-mail convidado.
                  </p>
                  <Link className="avnLoginCancel" href="/login">Trocar de conta</Link>
                </>
              ) : (
                <AcceptInviteForm token={token} papel={PAPEIS[convite.papel] ?? convite.papel} />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
