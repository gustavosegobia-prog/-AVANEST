import type { Metadata } from "next";

// A capa herda título e descrição do layout; o que ela precisa por conta
// própria é o canonical. Sem ele, a capa responde em quatro endereços — com e
// sem www, com e sem barra final, e com qualquer `?utm_...` colado por uma
// campanha — e o buscador reparte entre eles a força que deveria ser de um só.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

import Image from "next/image";
import { AppLogo } from "@/components/app-logo";
import { AbrirNoLogin } from "@/components/abrir-no-login";
import { CAMINHO_DA_CAMPANHA } from "@/lib/link-da-campanha";
import { ID_DA_ORGANIZACAO } from "@/lib/schema";

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
  // SÓ A REFERÊNCIA À EMPRESA, e não uma cópia dela. A organização completa —
  // nome, logo, CNPJ, contato, Instagram — é declarada uma vez no layout, em
  // `lib/schema.ts`. Aqui ficava um segundo objeto com parte dos mesmos dados,
  // e dois objetos homônimos são duas empresas para o buscador: no dia em que
  // um mudasse, ele ficaria com duas versões da mesma marca e escolheria uma.
  provider: { "@id": ID_DA_ORGANIZACAO },
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
      {/* `avnNavCapa`: no computador esta barra acompanha a moldura do hero,
          que é mais larga que a caixa central das outras páginas. Sem a classe,
          o logo nasce à direita do começo do título. */}
      <header className="avnNav avnNavCapa">
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

      {/* A CAPA MOSTRA O SISTEMA DE VERDADE. A foto anterior era uma imagem
          gerada: monitor com o logo antigo de coração, "AVANEST" gravado num
          carrinho de anestesia — como se o produto fosse um aparelho — e um
          texto ilegível com erro ("Solver rascunho") na tela. Para quem vai
          confiar a avaliação pré-anestésica a um sistema, a primeira imagem
          dele não pode ser inventada. Estas são capturas da avaliação real,
          com uma paciente fictícia (public/capa). */}
      <section className="avnHero avnHeroComTelas">
        <div className="avnHeroContent">
          <p className="avnEyebrow">GESTÃO INTELIGENTE EM ANESTESIOLOGIA</p>
          {/* O BENEFÍCIO PRIMEIRO, a lista de funções depois. O título anterior
              ("Da avaliação pré-anestésica ao fluxo de caixa do serviço")
              dizia o que o sistema cobre; este diz o que ele devolve a quem
              usa. O que ele cobre vem logo abaixo, em três linhas. */}
          <h1>Menos burocracia. Mais tempo para o que realmente importa.</h1>
          <p className="avnLead">
            Gestão clínica, escalas e finanças em uma única plataforma,
            desenvolvida por anestesiologista para anestesiologistas.
          </p>
          <ul className="avnBeneficios">
            <li>
              <b>Avaliação pré-anestésica completa</b>
              <span>Mais agilidade e padronização, com nove etapas estruturadas e quatro escores clínicos validados.</span>
            </li>
            <li>
              <b>Escalas organizadas, equipe conectada</b>
              <span>Gerencie plantões por instituição e acompanhe todos os seus compromissos em um só lugar.</span>
            </li>
            <li>
              <b>Controle financeiro sem complicação</b>
              <span>Acompanhe produção, faturamento, recebimentos e fluxo de caixa com mais clareza.</span>
            </li>
          </ul>
          {/* O TESTE GRÁTIS É A AÇÃO PRINCIPAL. Antes o botão de destaque era a
              conversa no WhatsApp e o teste era uma frase pequena embaixo: quem
              queria experimentar tinha de achar a porta. Agora a porta é o
              botão, e a conversa continua a um toque para quem prefere falar
              antes. "Sem cartão de crédito" responde à objeção que nasce
              justamente ao olhar o botão. */}
          <div className="avnOferta">
            <p className="avnOfertaTitulo">Experimente a AVANEST por 2 meses grátis</p>
            <p className="avnOfertaTexto">Conheça a plataforma na prática, sem cartão de crédito e sem compromisso.</p>
            <div className="avnActions">
              <a className="avnPrimary" href={`${CAMINHO_DA_CAMPANHA}?de=site`}>Começar grátis</a>
              <a className="avnSecondary" href="/planos">Conhecer os planos</a>
            </div>
            <p className="avnAjuda">
              Precisa de ajuda? <a href={whatsappUrl} target="_blank" rel="noreferrer">Fale com nossa equipe pelo WhatsApp</a>.
            </p>
          </div>
        </div>
        <div className="avnHeroTelas">
          <figure className="avnTelaComputador">
            <div className="avnTelaBarra" aria-hidden="true"><i /><i /><i /><span>avanest.com.br</span></div>
            <Image
              src="/capa/avaliacao-computador.webp" width={1600} height={1025} priority
              sizes="(min-width: 1101px) 52vw, calc(100vw - 40px)"
              alt="Avaliação pré-anestésica no AVANEST: as nove etapas, a identificação da paciente e o IMC e o peso ideal calculados (dados fictícios)"
            />
          </figure>
          <figure className="avnTelaCelular">
            <Image
              src="/capa/avaliacao-celular.webp" width={780} height={1688}
              sizes="(min-width: 1101px) 200px, 34vw"
              alt="No celular, o Índice de Lee calculado a partir da cirurgia e da creatinina (dados fictícios)"
            />
          </figure>
          <p className="avnTelaLegenda">Telas reais do sistema, com paciente fictícia.</p>
        </div>
      </section>

      {/* DOIS CAMINHOS, logo depois da primeira tela. O AVANEST serve ao
          anestesiologista que trabalha sozinho e ao grupo que tem escala,
          recepção e financeiro — e cada um decide por motivos diferentes. Um
          texto só, para os dois, acabava falando com nenhum. */}
      <section className="avnPerfis" aria-labelledby="avn-perfis-titulo">
        <p className="avnPerfisSobre">PARA QUEM É</p>
        <h2 id="avn-perfis-titulo">Escolha o seu caminho.</h2>
        <div className="avnPerfisGrade">
          <article>
            <h3>Sou anestesiologista</h3>
            <p className="avnPerfilQuem">Trabalho por conta própria, em um ou em vários hospitais.</p>
            <ul>
              <li>A avaliação pré-anestésica no celular, com os escores calculados a partir do que já foi respondido.</li>
              <li>Os plantões de todas as instituições reunidos em uma escala só.</li>
              <li>O que você produziu, faturou e ainda tem a receber, mês a mês.</li>
            </ul>
            <a className="avnPerfilBotao primario" href={`${CAMINHO_DA_CAMPANHA}?de=perfil-individual`}>Começar 2 meses grátis</a>
          </article>
          <article>
            <h3>Gerencio um grupo de anestesia</h3>
            <p className="avnPerfilQuem">Coordeno a escala, a recepção e o financeiro de uma equipe.</p>
            <ul>
              <li>A escala do grupo por instituição, com as trocas entre colegas registradas.</li>
              <li>Recepção, área médica e financeiro com acessos separados por função.</li>
              <li>O fechamento do mês e os repasses, com a composição de cada número.</li>
            </ul>
            <a className="avnPerfilBotao" href="/planos">Ver planos para grupos</a>
            <a className="avnPerfilAlt" href={whatsappUrl} target="_blank" rel="noreferrer">Prefere conversar antes? Fale com a gente</a>
          </article>
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
