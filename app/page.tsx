import { AppLogo } from "@/components/app-logo";
import { AbrirNoLogin } from "@/components/abrir-no-login";

// O que o site é, em linguagem de máquina.
//
// O buscador lê o texto da página e adivinha o resto. Isto tira a adivinhação
// de cima dele: que se trata de um programa, que a categoria é saúde, para que
// serve, de quem é a empresa e onde ela fica.
//
// Não muda posição sozinho — nenhuma marcação muda. O que ela muda é o que o
// Google mostra QUANDO já resolveu mostrar, e o quanto ele acerta ao decidir
// para qual busca esta página serve. "Sistema de avaliação pré-anestésica"
// escrito num campo chamado `applicationSubCategory` é uma afirmação; a mesma
// frase solta no meio de um parágrafo é um palpite.
//
// `offers` sem preço de propósito: o valor vem do banco e muda com a campanha,
// e preço escrito à mão aqui viraria mentira no primeiro reajuste — com o
// agravante de o Google mostrar o número velho no resultado da busca.
const DADOS_ESTRUTURADOS = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AVANEST",
  applicationCategory: "HealthApplication",
  applicationSubCategory: "Sistema de avaliação pré-anestésica e gestão de serviços de anestesiologia",
  operatingSystem: "Web",
  url: "https://www.avanest.com.br",
  inLanguage: "pt-BR",
  description:
    "Sistema para anestesiologistas: avaliação pré-anestésica em nove etapas com "
    + "escores de risco, escala de plantões por hospital, registro da produção do dia "
    + "e controle do que foi faturado e recebido.",
  featureList: [
    "Avaliação pré-anestésica digital com ficha para impressão",
    "Escores de risco: ASA, STOP-BANG, Apfel e índice de Lee (RCRI)",
    "Escala de plantões por instituição, com troca entre colegas",
    "Registro da produção do plantão e do que foi faturado",
    "Leitura da ficha de internação por foto",
  ],
  offers: {
    "@type": "Offer",
    priceCurrency: "BRL",
    availability: "https://schema.org/InStock",
    url: "https://www.avanest.com.br/planos",
  },
  provider: {
    "@type": "Organization",
    name: "G. Segobia Serviços Médicos Ltda.",
    alternateName: "AVANEST",
    url: "https://www.avanest.com.br",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Campo Mourão",
      addressRegion: "PR",
      addressCountry: "BR",
    },
  },
};

export default function HomePage() {
  const whatsappUrl =
    "https://wa.me/5541997870810?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20conversa%20de%2015%20minutos%20sobre%20o%20AVANEST.";

  return (
    <main className="avnLanding">
      {/* Aberto pelo atalho da tela de início, vai direto para o login. */}
      <AbrirNoLogin />
      <script
        type="application/ld+json"
        // O conteúdo é a constante logo acima, escrita à mão neste arquivo:
        // nada aqui vem de usuário, de banco ou de URL, então não há entrada
        // externa para escapar.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DADOS_ESTRUTURADOS) }}
      />
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
          <p className="avnEyebrow">GESTÃO EM ANESTESIOLOGIA</p>
          <h1>
            Da avaliação pré-anestésica ao fluxo de caixa do serviço.
          </h1>
          <p className="avnLead">
            Para quem trabalha sozinho e para o grupo de anestesia. De
            anestesiologista para anestesiologista.
          </p>
          {/* Três, e não quatro. "Gestão de clínica" e "gestão de grupo" não são
              uma quarta função: são para QUEM o sistema serve, e isso já está na
              frase acima. Postas aqui, dividiriam a atenção com as três que de
              fato descrevem o produto. */}
          <ul className="avnBenefits">
            <li>Avaliação pré-anestésica<span>nove etapas e quatro escores validados</span></li>
            <li>Gestão de escala<span>uma por instituição, e a sua reunindo todas</span></li>
            <li>Gestão financeira<span>produção, faturamento e fluxo de caixa</span></li>
          </ul>
          <div className="avnActions">
            <a className="avnPrimary" href={whatsappUrl} target="_blank" rel="noreferrer">
              Agendar uma conversa de 15 minutos
            </a>
            <a className="avnSecondary" href="/planos">Ver planos e preços</a>
          </div>
        </div>
      </section>

      <section className="avnInfo" id="como-funciona">
        <p>O QUE O SISTEMA COBRE</p>
        <h2>Três frentes que hoje vivem separadas.</h2>
        <div className="avnGrid">
          {[
            /* A avaliação vem primeiro: é o que o colega reconhece de imediato
               e o que ele faz antes de o paciente entrar. Depois a escala e o
               dinheiro, que são o que ele não esperava encontrar no mesmo
               lugar — e é aí que o sistema deixa de ser mais um. */
            [
              "01",
              "Avaliação pré-anestésica",
              "Nove etapas, com ASA, índice de Lee, STOP-Bang e Apfel calculados a partir do que já foi respondido. Ao final saem a ficha, o termo de consentimento e as orientações ao paciente, impressos no timbre do hospital em que ele foi atendido.",
            ],
            [
              "02",
              "Escala do serviço",
              "Uma escala por instituição, e a do profissional reunindo todas em um calendário. O plantão do grupo não se apaga: é transferido a um colega, com autor, data e resposta registrados.",
            ],
            [
              "03",
              "Controle de caixa",
              "A produção do dia registrada em uma linha, ainda no hospital. O fechamento do mês sai pronto para o financeiro, e o sistema aponta o que foi faturado e ainda não foi recebido.",
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
            Ver todos os recursos
          </a>
        </div>
      </section>
      <footer className="avnFooter">
        <span>G. Segobia Serviços Médicos Ltda. — CNPJ 55.965.276/0001-04</span>
        <nav className="avnFooterLinks">
          {/* A seção de escores é ligada daqui, e não só pelo sitemap: página
              que nenhuma outra aponta o buscador trata como periferia, por mais
              bem escrita que seja. */}
          <a href="/escores">Escores da avaliação</a>
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
