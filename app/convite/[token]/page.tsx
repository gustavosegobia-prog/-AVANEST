import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { NOME_DO_PAPEL_NO_CONVITE } from "@/lib/convite-mensagem";
import { AcceptInviteForm } from "./accept-invite-form";

// O nome da função é o mesmo da mensagem do WhatsApp (lib/convite-mensagem.ts).
// Com a lista copiada aqui, a função Centro cirúrgico aparecia como "centro".
const PAPEIS = NOME_DO_PAPEL_NO_CONVITE;

// O convite mostra o e-mail de quem foi convidado. Link pessoal, nunca busca:
// fora do índice aqui e fora do rastreio em app/robots.ts.
export const metadata: Metadata = {
  title: "Convite para o AVANEST",
  robots: { index: false, follow: false },
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
                    Use o e-mail <b>{convite.email}</b> para aceitar.
                  </p>
                  <Link className="avnLoginSubmit avnInviteAction" href={`/criar-conta?convite=${encodeURIComponent(token)}`}>
                    Criar minha conta
                  </Link>
                  <Link className="avnLoginCancel" href={`/login?convite=${encodeURIComponent(token)}`}>
                    Já tenho conta — entrar
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
