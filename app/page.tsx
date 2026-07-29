import { AppLogo } from "@/components/app-logo";

export default function HomePage() {
  const whatsappUrl =
    "https://wa.me/5541997870810?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20conversa%20de%2015%20minutos%20sobre%20o%20AVANEST.";

  return (
    <main className="avnLanding">
      <header className="avnNav">
        <AppLogo />
        <nav>
          <a className="avnLogin" href="/login">Login</a>
          <a className="avnPrimary" href={whatsappUrl} target="_blank" rel="noreferrer">
            Agendar uma conversa de 15 minutos
          </a>
        </nav>
      </header>

      <section className="avnHero">
        <div className="avnOverlay" />
        <div className="avnHeroContent">
          <p className="avnEyebrow">PREPARO PRÉ-OPERATÓRIO MAIS SEGURO</p>
          <h1>
            Cirurgias não deveriam ser suspensas por falhas no preparo.
            <span>O AVANEST organiza o pré-operatório antes do paciente chegar à sala.</span>
          </h1>
          <p className="avnLead">
            Da recepção ao anestesiologista, o AVANEST estrutura a avaliação pré-anestésica,
            organiza exames, orientações e documentos, e ajuda sua clínica a reduzir riscos de
            suspensão cirúrgica por preparo incompleto.
          </p>
          <div className="avnActions">
            <a className="avnPrimary" href={whatsappUrl} target="_blank" rel="noreferrer">
              Agendar uma conversa de 15 minutos
            </a>
            <a className="avnSecondary" href="#como-funciona">Ver o sistema em 90 segundos</a>
          </div>
        </div>
      </section>

      <section className="avnInfo" id="como-funciona">
        <p>UMA VISÃO CLARA DO SISTEMA</p>
        <h2>Veja como o AVANEST organiza o pré-operatório.</h2>
        <div className="avnGrid">
          {[
            [
              "01",
              "A recepção opera a fila sem ver conteúdo clínico",
              "Minimização de acesso a dado sensível, conforme a LGPD, com separação de permissões por perfil.",
            ],
            [
              "02",
              "O anestesiologista recebe o caso organizado antes da cirurgia",
              "Nove etapas clínicas, cálculos automáticos, salvamento contínuo e visão clara dos pacientes do dia.",
            ],
            [
              "03",
              "Ficha, termo e orientações saem prontos",
              "Documentação pré-anestésica, termo de consentimento e orientações ao paciente em um fluxo mais seguro e padronizado.",
            ],
          ].map(([n, title, text]) => (
            <article key={n}><b>{n}</b><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>
      <footer className="avnFooter">
        <span>G. Segobia Serviços Médicos LTDA — CNPJ 55.965.276/0001-04</span>
      </footer>
      <a
        className="avnInstagram"
        href="https://www.instagram.com/useavanest/"
        target="_blank"
        rel="noreferrer"
        aria-label="@useavanest no Instagram"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg><span>@useavanest</span>
      </a>
    </main>
  );
}
