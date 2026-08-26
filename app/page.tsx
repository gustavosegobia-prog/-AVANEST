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
          <p className="avnEyebrow">O DIA INTEIRO DO ANESTESIOLOGISTA</p>
          <h1>
            Escala, avaliação, produção e recebimento em um sistema só.
          </h1>
          <p className="avnLead">
            Do plantão que você assume à cobrança que entra no fim do mês — com a
            avaliação pré-anestésica, a ficha e o termo saindo prontos no meio do caminho.
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
        <p>UMA VISÃO CLARA DO SISTEMA</p>
        <h2>Veja como o AVANEST organiza o dia.</h2>
        <div className="avnGrid">
          {[
            /* Os três cartões seguem o DIA, e não o menu do sistema: é assim
               que o colega reconhece o próprio trabalho no texto. A escala vem
               antes porque é por ela que a maioria entra — o plantão é o que
               já existe, com ou sem sistema. */
            [
              "01",
              "A escala de todos os hospitais num calendário só",
              "Cada lugar onde você está escalado, o valor combinado de cada turno, e a troca com um colega registrada — com dono, data e resposta.",
            ],
            [
              "02",
              "A avaliação pré-anestésica antes de o paciente entrar",
              "Nove etapas salvas enquanto você digita, cálculos e escores automáticos, e ficha, termo e orientações prontos para imprimir com o logo do hospital.",
            ],
            [
              "03",
              "A produção do dia vira o que você tem a receber",
              "Paciente, convênio e cirurgia numa linha. O sistema acompanha o que foi faturado, o que foi recebido, e avisa o que ficou para trás.",
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
