import { AppLogo } from "@/components/app-logo";
import { RecoveryForm } from "./recovery-form";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const query = await searchParams;
  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <div className="avnLoginMonitor" aria-hidden="true">
            <svg viewBox="0 0 190 42"><path d="M0 27 H56 L66 27 73 9 83 37 91 18 97 27 H190" /></svg>
            <div className="avnMonitorScreen"><i /><i /><i /></div>
            <div className="avnMonitorFeet"><i /><i /></div>
          </div>
          <p>Recupere seu acesso com segurança pelo e-mail cadastrado.</p>
        </div>
        <div className="avnLoginContent">
          <h1>Recuperar senha</h1>
          <p>Digite o e-mail usado no AVANEST. Enviaremos um link para você criar uma nova senha.</p>
          <RecoveryForm invalidLink={query.erro === "link-invalido"} />
          <a className="avnLoginCancel" href="/login">Voltar ao login</a>
        </div>
      </section>
    </main>
  );
}
