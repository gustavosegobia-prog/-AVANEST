import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { SignUpForm } from "./sign-up-form";

const PAPEIS: Record<string, string> = {
  admin: "Administrador", medico: "Anestesiologista",
  recepcao: "Recepção", financeiro: "Financeiro",
};

export default async function CriarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string }>;
}) {
  const { convite: token } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(token ? `/convite/${encodeURIComponent(token)}` : "/dashboard");

  // Sem convite não há cadastro aberto: as contas nascem de um convite.
  if (!token) {
    return (
      <main className="avnLoginPage">
        <section className="avnLoginCard avnOnboardingCard">
          <div className="avnLoginIllustration"><AppLogo /></div>
          <div className="avnLoginContent">
            <h1>Cadastro por convite</h1>
            <p>O acesso ao AVANEST é criado a partir de um convite enviado pelo responsável da sua organização. Peça o link a quem administra o sistema.</p>
            <Link className="avnLoginCancel" href="/login">Voltar para o login</Link>
          </div>
        </section>
      </main>
    );
  }

  const { data } = await supabase.rpc("convite_info", { p_token: token });
  const convite = Array.isArray(data) ? data[0] : data;
  const invalido = !convite || convite.valido !== true;

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnOnboardingCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>Sua conta dá acesso apenas à organização que convidou você.</p>
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
              <h1>Criar sua conta</h1>
              <p>
                Convite de <b>{convite.organizacao}</b> como{" "}
                <b>{PAPEIS[convite.papel] ?? convite.papel}</b>.
              </p>
              <SignUpForm token={token} email={String(convite.email)} />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
