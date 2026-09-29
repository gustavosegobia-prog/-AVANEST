import type { Metadata } from "next";
import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { PASSOS_DO_SAFARI } from "@/lib/instalacao";

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

const PASSOS_ANDROID = [
  "Abra o AVANEST no Chrome",
  "Toque nos três pontinhos, no canto superior direito",
  "Toque em “Instalar aplicativo” ou “Adicionar à tela inicial”",
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
        <h2>Como instalar</h2>
        <div className="appPassos">
          <article>
            <h3>iPhone e iPad</h3>
            {/* Os mesmos passos que a faixa dentro do sistema mostra. Vêm do
                mesmo lugar de propósito: duas listas escritas à mão divergem na
                primeira mudança do iOS, e aí uma das duas ensina o caminho
                errado. */}
            <ol>
              {PASSOS_DO_SAFARI.map((passo) => <li key={passo.texto}>{passo.texto}</li>)}
            </ol>
            <p className="appNota">
              Precisa ser o <b>Safari</b>. Se você abriu este link pelo Instagram ou pelo
              WhatsApp, toque nos três pontinhos e escolha “Abrir no Safari” antes de
              começar — no navegador de dentro de outro aplicativo, o item “Adicionar à
              Tela de Início” não existe.
            </p>
          </article>
          <article>
            <h3>Android</h3>
            <ol>
              {PASSOS_ANDROID.map((passo) => <li key={passo}>{passo}</li>)}
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
