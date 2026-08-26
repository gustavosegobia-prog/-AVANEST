import { AppLogo } from "@/components/app-logo";
import { AbrirNoLogin } from "@/components/abrir-no-login";

export default function HomePage() {
  const whatsappUrl =
    "https://wa.me/5541997870810?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20conversa%20de%2015%20minutos%20sobre%20o%20AVANEST.";

  return (
    <main className="avnLanding">
      {/* Aberto pelo atalho da tela de início, vai direto para o login. */}
      <AbrirNoLogin />
      <header className="avnNav">
        <AppLogo />
        <nav>
          {/* Dois rótulos para o mesmo link, e o CSS escolhe. No celular, "O que
              o sistema faz" quebrava em TRÊS linhas e o botão subia por cima do
              logo. Encurtar para todo mundo custaria a frase que explica o
              destino — que é o trabalho do rótulo numa página de venda. */}
          <a className="avnLogin avnNavExplica" href="/recursos">
            <span className="avnSoLargo">O que o sistema faz</span>
            <span className="avnSoEstreito">Recursos</span>
          </a>
          <a className="avnLogin" href="/login">Login</a>
          <a className="avnPrimary" href="/planos">Ver planos</a>
        </nav>
      </header>

      <section className="avnHero">
        <div className="avnOverlay" />
        <div className="avnHeroContent">
          <p className="avnEyebrow">AVALIAÇÃO PRÉ-ANESTÉSICA</p>
          <h1>
            Feita por quem faz avaliação pré-anestésica.
          </h1>
          <p className="avnLead">
            Nove etapas, escores calculados na hora e ficha, termo e orientações
            prontos para imprimir com o logo do hospital. Nasceu dentro do centro
            cirúrgico, e é usada todo dia por anestesiologistas e residentes. No
            mesmo sistema: a escala do serviço, a produção do plantão e o que você
            tem a receber.
          </p>
          <div className="avnActions">
            <a className="avnPrimary" href={whatsappUrl} target="_blank" rel="noreferrer">
              Agendar uma conversa de 15 minutos
            </a>
            <a className="avnSecondary" href="/planos">Ver planos e preços</a>
          </div>
        </div>
      </section>

      <section className="avnInfo" id="como-funciona">
        <p>O QUE O AVANEST FAZ</p>
        <h2>Da avaliação ao dinheiro que entra, sem trocar de sistema.</h2>
        <div className="avnGrid">
          {[
            /* A avaliação vem primeiro: é o que o colega reconhece de imediato
               e o que ele faz antes de o paciente entrar. Depois a escala e o
               dinheiro, que são o que ele não esperava encontrar no mesmo
               lugar — e é aí que o sistema deixa de ser mais um. */
            [
              "01",
              "A avaliação, em nove etapas que seguem a consulta",
              "Anamnese, exame físico, via aérea, exames, medicamentos e escores. O texto é salvo enquanto você digita, e no fim saem a ficha, o termo de consentimento e as orientações do paciente, prontos para imprimir.",
            ],
            [
              "02",
              "A escala do serviço, hospital por hospital",
              "Uma escala por hospital, e a sua reunindo todas num calendário só. Plantão do grupo não se apaga: passa para um colega, com dono, data e resposta registrados.",
            ],
            [
              "03",
              "O dinheiro do plantão, do lançamento ao recebimento",
              "Paciente, convênio e cirurgia numa linha, ainda de jaleco. O fechamento do mês sai pronto para o financeiro, e o sistema avisa o que foi faturado e ainda não voltou.",
            ],
          ].map(([n, title, text]) => (
            <article key={n}><b>{n}</b><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
        {/* Os três cartões acima são o gancho. Quem quer saber de verdade —
            e anestesiologista quer — precisa de um caminho para a lista
            inteira, em vez de decidir por três frases. */}
        <div className="avnActions">
          <a className="avnSecondary avnVerTudo" href="/recursos">
            Ver tudo o que o AVANEST faz
          </a>
        </div>
      </section>
      <footer className="avnFooter">
        <span>G. Segobia Serviços Médicos Ltda. — CNPJ 55.965.276/0001-04</span>
        <nav className="avnFooterLinks">
          <a href="/termos">Termos de Uso</a>
          <a href="/privacidade">Política de Privacidade</a>
        </nav>
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
