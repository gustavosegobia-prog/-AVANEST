import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AppLogo } from "@/components/app-logo";
import { GlifoDoPasso } from "@/components/icones-de-instalacao";

// Onde o botão "Baixar o app AVANEST" chega.
//
// O AVANEST NÃO TEM PÁGINA NA APP STORE, e não é descuido: ele é um aplicativo
// web instalável. Instalado na tela de início, ele abre em tela cheia, sem a
// barra do navegador, guarda a sessão e recebe notificação — é o mesmo produto
// que um app baixado da loja entrega, sem o download de 80 MB e sem esperar a
// revisão da Apple a cada correção.
//
// Esta página existe porque a instrução "adicione à tela de início" não se
// explica por si. No iPhone, o botão de compartilhar é um quadrado com uma
// seta que ninguém chama por esse nome, e o item certo está no meio de uma
// lista rolável. É o passo em que a pessoa desiste — e desistir aqui custa o
// produto inteiro: sem o AVANEST na tela de início, o Safari não entrega
// notificação nenhuma, e o lembrete de plantão, o aviso de troca e a escala
// publicada ficam invisíveis para quem mais precisa deles.
//
// PÚBLICA E SEM LOGIN, de propósito: ela é o destino de um link dentro de um
// e-mail, lido no celular, muitas vezes por quem ainda não entrou no sistema
// nenhuma vez. Uma parede de login aqui devolveria a pessoa para o começo.

export const metadata: Metadata = {
  alternates: { canonical: "/app" },
  title: "Instale o AVANEST no seu celular | AVANEST",
  description:
    "O passo a passo para pôr o AVANEST na tela de início do iPhone e do Android — "
    + "e receber os avisos de plantão no aparelho.",
};

/**
 * Os quatro toques do iPhone, cada um com a tela que a pessoa vai ver.
 *
 * AS CAPTURAS SÃO DO AVANEST, num iPhone de verdade, e não montagens. Quem
 * está com o telefone na mão compara o que está na tela dele com o que está na
 * página — e uma tela parecida, mas não igual, é pior que nenhuma: ela faz a
 * pessoa achar que errou algum passo.
 *
 * O CAMINHO MUDOU no Safari recente, e é por isso que o passo 2 existe. Na
 * barra de baixo não há mais o ícone de compartilhar: há o `≡` ao lado do
 * endereço, e "Compartilhar" está DENTRO dele. O passo a passo antigo mandava
 * procurar na barra de baixo um botão que naquele iPhone não está lá — e quem
 * não acha o botão do primeiro passo não faz os outros três.
 */
const PASSOS_DO_IPHONE = [
  {
    titulo: "Abra o AVANEST no Safari",
    subtitulo: "avanest.com.br",
    nota: "Precisa ser o Safari. Se você abriu este link pelo Instagram ou pelo WhatsApp, "
      + "toque nos três pontinhos e escolha “Abrir no Safari” antes de começar.",
    glifo: "mais",
    imagem: "/instalar/1-abrir-no-safari.webp",
    alt: "A página do AVANEST aberta no Safari do iPhone, com a barra de endereço embaixo.",
  },
  {
    titulo: "Toque no ≡ e depois em Compartilhar",
    subtitulo: "O ≡ fica ao lado do endereço, na barra de baixo",
    nota: "É este botão que inicia a instalação. Em iPhones mais antigos o ícone de "
      + "compartilhar aparece direto na barra de baixo — nesse caso, toque nele e pule "
      + "para o passo 3.",
    glifo: "compartilhar",
    imagem: "/instalar/2-menu-compartilhar.webp",
    alt: "O menu do Safari aberto, com a opção Compartilhar em destaque.",
  },
  {
    titulo: "Escolha “Adicionar à Tela de Início”",
    subtitulo: "Role a lista até achar",
    nota: "A lista é longa e a opção fica bem abaixo, depois de “Buscar na Página”. "
      + "É aqui que a maioria desiste — role até o fim.",
    glifo: "adicionar",
    imagem: "/instalar/3-adicionar-a-tela-de-inicio.webp",
    alt: "A folha de compartilhamento do iPhone, com o item Adicionar à Tela de Início.",
  },
  {
    titulo: "Confirme em “Adicionar”",
    subtitulo: "No canto superior direito",
    nota: "Deixe “Abrir como app web” ligado — é esse interruptor que faz o AVANEST abrir "
      + "em tela cheia e receber os avisos de plantão. Ele já vem ligado.",
    glifo: null,
    imagem: "/instalar/4-confirmar-adicionar.webp",
    alt: "A tela de confirmação com o nome AVANEST, o interruptor “Abrir como app web” "
      + "ligado e o botão Adicionar.",
  },
] as const;

// Os três passos do Chrome, no mesmo formato — com o glifo do menu de três
// pontos, que é o botão que ninguém sabe nomear no Android.
const PASSOS_ANDROID = [
  { texto: "Abra o AVANEST no Chrome", icone: null },
  { texto: "Toque nos três pontinhos, no canto superior direito", icone: "mais" },
  { texto: "Toque em “Instalar aplicativo” ou “Adicionar à tela inicial”", icone: "adicionar" },
] as const;

const O_QUE_MUDA: [string, string][] = [
  ["Aviso de plantão no aparelho",
    "Lembrete antes do seu turno, aviso quando a escala do mês sai e quando um plantão seu "
    + "muda de dia, de horário ou é cancelado. No iPhone isso só funciona com o AVANEST na "
    + "tela de início — numa aba do Safari, não chega nada."],
  ["Abre sem digitar senha",
    "A sessão fica guardada no aparelho. Conferir a escala vira um toque, do jeito que "
    + "deveria ser quando se está entrando no centro cirúrgico."],
  ["Tela cheia, sem a barra do navegador",
    "O calendário do mês cabe inteiro na tela, e a escala do grupo se lê sem rolar de lado."],
  ["Troca de plantão pelo celular",
    "Pedir, oferecer e responder — sem depender de alguém ver a mensagem no grupo."],
];

export default function InstalarNoCelular() {
  return (
    <main className="avnLanding">
      <header className="avnNav">
        <Link href="/" aria-label="AVANEST"><AppLogo /></Link>
        <nav>
          <a className="avnLogin" href="/login">Login</a>
        </nav>
      </header>

      <section className="recHero">
        <p className="avnEyebrow">NO SEU CELULAR</p>
        <h1>Tenha sua escala sempre à mão.</h1>
        <p className="avnLead">
          O AVANEST se instala direto pelo navegador, em menos de um minuto. Não passa
          pela App Store nem pela Play Store: você adiciona à tela de início e ele
          abre como qualquer outro aplicativo — em tela cheia, sem senha e recebendo
          os avisos de plantão.
        </p>
      </section>

      <section className="recBloco">
        <h2>No iPhone, em quatro toques</h2>
        <p className="appIntro">
          As telas abaixo são do AVANEST mesmo, num iPhone. Siga na ordem — leva
          menos de um minuto.
        </p>
        <div className="appSequencia">
          {PASSOS_DO_IPHONE.map((passo, i) => (
            <article className="appCartao" key={passo.titulo}>
              <div className="appCartaoTexto">
                <span className="appEtiqueta">PASSO {i + 1}</span>
                <h3>{passo.titulo}</h3>
                <p className="appSub">{passo.subtitulo}</p>
                {passo.nota && (
                  <p className="appBalao">
                    <span className="appBalaoGlifo" aria-hidden="true">
                      <GlifoDoPasso nome={passo.glifo} />
                    </span>
                    <span>{passo.nota}</span>
                  </p>
                )}
              </div>
              {/* A MOLDURA DO TELEFONE É CSS, e a imagem é só a tela. Print com
                  a moldura junto sai de um aparelho só — e no dia em que a
                  captura for de outro modelo, as quatro deixam de combinar.
                  Desenhada, a moldura é a mesma para todas.

                  `next/image` e não `<img>`: são quatro capturas de telefone
                  numa página que abre no 4G do hospital, e ele entrega AVIF
                  para quem aceita e o tamanho certo para cada tela. `priority`
                  só na primeira — as outras três estão fora da tela quando a
                  página abre, e carregá-las na frente atrasaria justamente a
                  que a pessoa está olhando.

                  `sizes` é o que o navegador usa para escolher a versão ANTES
                  de o CSS existir: 280px é o teto da moldura. Sem ele o Next
                  assume a largura da janela inteira e baixa a maior. */}
              <div className="appTelefone">
                <Image src={passo.imagem} alt={passo.alt} width={720} height={1234}
                  sizes="262px" priority={i === 0} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="recBloco">
        <h2>No Android</h2>
        <div className="appPassos">
          <article>
            <h3>Pelo Chrome</h3>
            <ol>
              {PASSOS_ANDROID.map((passo) => (
                <li key={passo.texto}>
                  <span className="appGlifo" aria-hidden="true">
                    <GlifoDoPasso nome={passo.icone} />
                  </span>
                  <span>{passo.texto}</span>
                </li>
              ))}
            </ol>
            <p className="appNota">
              Em alguns aparelhos o Chrome mostra sozinho um aviso de “Instalar” assim que
              você abre o AVANEST. Aceitar aquele aviso faz a mesma coisa.
            </p>
          </article>
        </div>
        <div className="avnActions appAcoes">
          <a className="avnPrimary" href="/login">Abrir o AVANEST agora</a>
        </div>
      </section>

      <section className="recBloco">
        <h2>O que muda depois de instalar</h2>
        <div className="recGrade">
          {O_QUE_MUDA.map(([titulo, texto]) => (
            <article key={titulo}>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="recFim">
        <h2>Sua escala. Seus plantões. Tudo em um só lugar.</h2>
        <p>
          Depois de instalado, o AVANEST fica na tela de início junto com os outros
          aplicativos. Para tirar, é só segurar o ícone e remover — como qualquer um.
        </p>
        <div className="avnActions">
          <a className="avnPrimary" href="/login">Entrar</a>
          <a className="avnSecondary" href="/recursos">Ver o que o AVANEST faz</a>
        </div>
      </section>

      <footer className="avnFooter">
        <span>G. Segobia Serviços Médicos Ltda. — CNPJ 55.965.276/0001-04</span>
        <nav className="avnFooterLinks">
          <Link href="/">Início</Link>
          <Link href="/recursos">O que o AVANEST faz</Link>
          <a href="/termos">Termos de Uso</a>
          <a href="/privacidade">Política de Privacidade</a>
        </nav>
      </footer>
    </main>
  );
}
