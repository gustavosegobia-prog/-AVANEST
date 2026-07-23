import { AppLogo } from "@/components/app-logo";
import { UpdatePasswordForm } from "./update-password-form";

export default function UpdatePasswordPage() {
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
          <p>Crie uma senha exclusiva e mantenha seu acesso protegido.</p>
        </div>
        <div className="avnLoginContent">
          <h1>Criar nova senha</h1>
          <p>Use pelo menos oito caracteres. Evite reutilizar uma senha de outro serviço.</p>
          <UpdatePasswordForm />
        </div>
      </section>
    </main>
  );
}
