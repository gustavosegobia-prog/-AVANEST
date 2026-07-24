import { AppLogo } from "@/components/app-logo";

export default function HomePage() {
  return (
    <main className="avnLanding">
      <header className="avnNav">
        <AppLogo />
        <nav>
          <a className="avnLogin" href="/login">♟ &nbsp; Login</a>
          <a className="avnPrimary" href="mailto:gustavosegobia@icloud.com?subject=Demonstração AVANEST">
            Solicitar demonstração
          </a>
        </nav>
      </header>

      <section className="avnHero">
        <div className="avnOverlay" />
        <div className="avnHeroContent">
          <p className="avnEyebrow">DO PACIENTE À SALA CIRÚRGICA</p>
          <h1>Segurança começa<br />antes da anestesia.</h1>
          <p className="avnLead">
            O AVANEST conecta recepção e anestesiologista em uma jornada pré-operatória
            organizada, para que cada informação importante acompanhe o paciente até o
            momento da cirurgia.
          </p>
          <div className="avnActions">
            <a className="avnPrimary" href="/login">Conheça o AVANEST</a>
            <a className="avnSecondary" href="#como-funciona">Ver como funciona</a>
          </div>
          <ul className="avnBenefits">
            <li>✓ <span>Informações organizadas para apoiar o cuidado</span></li>
            <li>✓ <span>Um fluxo mais claro para a equipe</span></li>
            <li>✓ <span>Tecnologia para organizar a jornada pré-operatória</span></li>
          </ul>
        </div>
      </section>

      <section className="avnInfo" id="como-funciona">
        <p>UMA JORNADA INTEGRADA</p>
        <h2>Do cadastro à conclusão da avaliação.</h2>
        <div className="avnGrid">
          {[
            ["01", "Recepção", "Cadastro, agenda e organização da fila sem acesso ao conteúdo clínico."],
            ["02", "Avaliação", "Nove etapas clínicas, cálculos automáticos e salvamento contínuo."],
            ["03", "Documentos", "Ficha, termo de consentimento e orientações organizados para impressão."],
          ].map(([n, title, text]) => (
            <article key={n}><b>{n}</b><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>
      <a
        className="avnInstagram"
        href="https://www.instagram.com/avanest/"
        target="_blank"
        rel="noreferrer"
        aria-label="AVANEST no Instagram"
      >
        <span aria-hidden="true">◎</span> @avanest
      </a>
    </main>
  );
}
