import type { Metadata } from "next";
import { paginaPublica } from "@/lib/metadados";
import Link from "next/link";
import Image from "next/image";
import { AppLogo } from "@/components/app-logo";
import { GlifoDoPasso } from "@/components/icones-de-instalacao";
import { RodapePublico } from "@/components/rodape-publico";

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

export const metadata: Metadata = paginaPublica({
  titulo: "Instale o AVANEST no seu celular | AVANEST",
  descricao: "O passo a passo para pôr o AVANEST na tela de início do iPhone e do Android — "
    + "e receber os avisos de plantão no aparelho.",
  caminho: "/app",
});

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

/**
 * O Android, em dois toques — e a escolha que decide se virou aplicativo.
 *
 * O CHROME OFERECE DUAS COISAS PARECIDAS, e só uma serve: "Instalar" põe o
 * AVANEST como aplicativo, em tela cheia; "Criar atalho" cria um ícone que
 * abre DENTRO do Chrome, com a barra do navegador por cima. As duas linhas
 * ficam uma embaixo da outra, com o mesmo ícone do AVANEST ao lado, e nada na
 * tela diz qual é qual. Quem escolher a de baixo vai achar que instalou.
 *
 * A captura é de quem abriu o link DE DENTRO de outro aplicativo — do e-mail,
 * do WhatsApp —, que é por onde a maioria vai chegar: o botão do e-mail da
 * escala leva exatamente a esta página. No Chrome aberto direto o menu é
 * parecido e o item pode ter outro nome, e a ressalva diz isso em vez de
 * fingir que só existe um caminho.
 */
const PASSOS_DO_ANDROID = [
  {
    titulo: "Toque nos três pontinhos",
    subtitulo: "No canto superior direito, e depois em “Instalar e criar atalho”",
    nota: "Este é o menu de quem abriu o AVANEST pelo link do e-mail ou do WhatsApp. "
      + "Abrindo pelo Chrome direto o menu é parecido, e o item pode se chamar apenas "
      + "“Instalar aplicativo”.",
    glifo: "mais",
    imagem: "/instalar/5-android-menu.webp",
    alt: "O menu do Chrome no Android aberto, com o item “Instalar e criar atalho”.",
  },
  {
    titulo: "Escolha “Instalar”",
    subtitulo: "E não “Criar atalho”",
    nota: "As duas opções aparecem juntas, com o mesmo ícone do AVANEST ao lado. "
      + "“Instalar” põe o AVANEST como aplicativo, em tela cheia; “Criar atalho” só cria "
      + "um ícone que abre dentro do Chrome, com a barra do navegador por cima.",
    glifo: "adicionar",
    imagem: "/instalar/6-android-instalar.webp",
    alt: "A janela “Instalar e criar atalho” do Chrome, com as opções Instalar e Criar atalho.",
  },
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

/**
 * Um passo: o texto de um lado, a tela do outro.
 *
 * UM COMPONENTE SÓ para o iPhone e o Android. Os dois ensinam caminhos
 * diferentes, mas a peça é a mesma — e duas cópias dela divergiriam no
 * primeiro ajuste de espaçamento, deixando a metade de baixo da página com
 * cara de outro site.
 */
function Passo({ passo, numero, primeiro }: {
  passo: {
    titulo: string; subtitulo: string; nota: string;
    glifo: string | null; imagem: string; alt: string;
  };
  numero: number;
  /** A primeira imagem da página carrega na frente; as outras, sob demanda. */
  primeiro: boolean;
}) {
  return (
    <article className="appCartao">
      <div className="appCartaoTexto">
        <span className="appEtiqueta">PASSO {numero}</span>
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
      {/* A MOLDURA DO TELEFONE É CSS, e a imagem é só a tela. Print com a
          moldura junto sai de um aparelho só — e as capturas do iPhone e as do
          Android são de dois aparelhos diferentes, com molduras diferentes.
          Desenhada, a moldura é a mesma para as seis.

          `next/image` e não `<img>`: são seis capturas de telefone numa página
          que abre no 4G do hospital, e ele entrega AVIF para quem aceita e o
          tamanho certo para cada tela. `priority` só na primeira de todas — as
          outras estão fora da tela quando a página abre, e carregá-las na
          frente atrasaria justamente a que a pessoa está olhando.

          `sizes` é o que o navegador usa para escolher a versão ANTES de o CSS
          existir: 262px é o teto da moldura. Sem ele o Next assume a largura
          da janela inteira e baixa a maior. */}
      <div className="appTelefone">
        <Image src={passo.imagem} alt={passo.alt} width={720} height={1234}
          sizes="262px" priority={primeiro} />
      </div>
    </article>
  );
}

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
            <Passo key={passo.titulo} passo={passo} numero={i + 1} primeiro={i === 0} />
          ))}
        </div>
      </section>

      <section className="recBloco">
        <h2>No Android, em dois toques</h2>
        <p className="appIntro">
          Abra <b>avanest.com.br</b> no Chrome e siga as duas telas abaixo.
        </p>
        <div className="appSequencia">
          {PASSOS_DO_ANDROID.map((passo, i) => (
            <Passo key={passo.titulo} passo={passo} numero={i + 1} primeiro={false} />
          ))}
        </div>
        <p className="appNota appNotaSolta">
          Em alguns aparelhos o Chrome mostra sozinho um aviso de “Instalar” assim que
          você abre o AVANEST. Aceitar aquele aviso faz a mesma coisa.
        </p>
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

      <RodapePublico />
    </main>
  );
}
