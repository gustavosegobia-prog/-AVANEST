import type { Metadata } from "next";
import {
  TELAS_DE_ABERTURA, arquivoDaAbertura, consultaDaAbertura,
} from "@/lib/tela-de-abertura";
import { AberturaAnimada, RoteiroDaAbertura } from "@/components/abertura-animada";
import { comoJson, organizacao } from "@/lib/schema";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.avanest.com.br"),
  title: "AVANEST | Gestão em anestesiologia",
  // 155 caracteres, e o número tem motivo: o Google corta a descrição perto de
  // 160 na busca. A versão anterior tinha 168 e terminava em "…faturado e
  // rece…" — a última coisa que a pessoa lia era uma palavra partida.
  description: "Sistema de gestão para serviços de anestesiologia: avaliação pré-anestésica em nove etapas, escala por instituição e controle do que você tem a receber.",
  /* O QUE APARECE QUANDO ALGUÉM COLA UM LINK.
     As doze páginas do site estavam sem `og:image`: um link do avanest.com.br
     no WhatsApp, no Instagram ou no LinkedIn saía como bloco de texto cinza,
     sem imagem. Em campanha de lançamento é o item que mais custa clique — a
     mesma mensagem, com e sem imagem, não recebe o mesmo número de toques.
     Fica no layout, e não página por página: assim as doze herdam de uma vez,
     e a que quiser imagem própria sobrescreve só o que for diferente.
     A imagem é gerada por `scripts/gerar-imagem-de-compartilhamento.mjs` e
     versionada — uma rota que a desenha por chamada gasta computação em toda
     prévia de link e depende do servidor estar de pé justamente quando o link
     mais precisa funcionar. */
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "AVANEST",
    url: "/",
    title: "AVANEST | Gestão em anestesiologia",
    description: "Da avaliação pré-anestésica ao fluxo de caixa do serviço. Desenvolvido por anestesiologista, dentro de um serviço em atividade.",
    images: [{
      url: "/compartilhar.png",
      width: 1200,
      height: 630,
      // O alt não é enfeite: leitor de tela e cliente de e-mail que não baixa
      // imagem mostram este texto no lugar dela.
      alt: "AVANEST — gestão em anestesiologia: avaliação pré-anestésica, escala do serviço e o controle do que você tem a receber.",
    }],
  },
  /* `summary_large_image`, e não `summary`: com `summary` o X e o LinkedIn
     mostram a imagem num quadradinho ao lado do texto, e uma peça 1200×630
     cortada em quadrado perde o nome e a frase. */
  twitter: {
    card: "summary_large_image",
    title: "AVANEST | Gestão em anestesiologia",
    description: "Da avaliação pré-anestésica ao fluxo de caixa do serviço. Desenvolvido por anestesiologista, dentro de um serviço em atividade.",
    images: ["/compartilhar.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A fonte sai daqui, não de um @import dentro do CSS. Import no topo da folha
  // é resolvido em série: enquanto o Google não responde, o navegador segura o
  // estilo inteiro e o sistema aparece cru. Como <link> ela baixa em paralelo,
  // e a pilha de reserva do CSS assume enquanto isso.
  return (
    <html lang="pt-BR">
      <head>
        {/* O rótulo que fica embaixo do ícone na tela de início do iPhone. Sem
            ele o iOS usa o <title> inteiro e corta no meio, virando
            "AvaNEST|Avaliaç...". O ícone em si vem de app/apple-icon.png. */}
        <meta name="apple-mobile-web-app-title" content="AVANEST" />
        {/* Sem isto o iPhone abre o atalho dentro do Safari, com barra de
            endereço e tudo — e aí não é um aplicativo, é um marcador. O
            manifesto já pede standalone, mas o iOS antigo só obedece a esta
            linha. */}
        {/* As DUAS linhas, e não uma. O Chrome avisa no console que a versão
            com prefixo `apple-` está obsoleta e pede a padronizada — mas quem
            obedece só à `apple-` é justamente o Safari do iPhone, que é o
            aparelho por que este trecho existe. Tirar a antiga para calar o
            aviso devolveria o atalho do iOS para dentro do Safari, com barra
            de endereço; e sem a nova o aviso continua. Convivem. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Declarado à mão, apontando para /public, em vez de depender do
            arquivo chamar-se exatamente "apple-icon.png" na pasta app. O
            caminho explícito funciona com qualquer nome de arquivo. */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icone192.png" />
        {/* A tela que o iPhone e o iPad mostram no instante do toque no ícone,
            antes de o site carregar. Sem ela é branco, e um segundo de tela
            vazia faz a pessoa achar que não abriu e tocar de novo.

            Uma por aparelho porque o iOS só usa o arquivo cuja medida bate
            exatamente; medida que não bate ele ignora calado, e a tela volta a
            ser branca. O motivo completo está em lib/tela-de-abertura.ts. */}
        {TELAS_DE_ABERTURA.map((tela) => (
          <link
            key={arquivoDaAbertura(tela)}
            rel="apple-touch-startup-image"
            href={arquivoDaAbertura(tela)}
            media={consultaDaAbertura(tela)}
          />
        ))}
        <meta name="theme-color" content="#0879c9" />
        {/* QUEM OPERA ISTO, para o buscador.
            Fica no layout porque é verdade em qualquer endereço do site — e
            porque o Google costuma entrar por uma calculadora de escore, sem
            nunca passar pela capa. Declarar só na capa deixaria a maior parte
            das visitas sem a empresa. O conteúdo é montado em lib/schema.ts a
            partir de constantes deste repositório; não há entrada externa. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: comoJson(organizacao()) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* A FOLHA DA FONTE NÃO BLOQUEIA MAIS A PRIMEIRA PINTURA.
            Toda <link rel="stylesheet"> no <head> segura o desenho da página
            até chegar inteira — e esta vai buscar noutro domínio: DNS, TLS e
            ida e volta ao Google antes de o navegador pintar o primeiro
            pixel. Numa rede de hospital isso é o tempo em que a abertura da
            marca fica sem começar.

            `media="print"` faz o navegador baixá-la SEM bloquear, porque ela
            não se aplica à tela; o `onLoad` a devolve para `all` assim que
            chega. É o truque padrão, e custa pouco aqui porque a fonte já é
            `display=swap`: o texto sempre apareceu na fonte de reserva antes
            de trocar para a Outfit. O que muda é só quando a troca acontece.

            O <noscript> repõe a versão bloqueante para quem desligou o
            JavaScript — sem ele, esse navegador ficaria com a folha em
            `media="print"` para sempre, e o site inteiro na fonte de reserva. */}
        <link
          id="fonteDoSite"
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap"
          media="print"
        />
        {/* A VOLTA PARA `all` VEM DAQUI, e não de um `onLoad` no <link>.
            Foi tentado: o React descarta esse atributo ao renderizar no
            servidor — conferido no HTML gerado, onde ele simplesmente não
            aparece. A folha ficaria em `media="print"` para sempre e o site
            inteiro rodaria na fonte de reserva, sem nenhum erro no console.

            `l.sheet` cobre o caso de a folha já ter chegado antes deste
            roteiro rodar; o ouvinte cobre o normal. */}
        <script dangerouslySetInnerHTML={{ __html:
          "(function(){var l=document.getElementById('fonteDoSite');if(!l)return;"
          + "var liga=function(){l.media='all'};"
          + "if(l.sheet){liga()}else{l.addEventListener('load',liga,{once:true});"
          + "l.addEventListener('error',liga,{once:true})}})()" }} />
        <noscript>
          {/* O mesmo <link> de cima, e o eslint conta os dois. A regra que ele
              dispara é do Pages Router (`pages/_document.js`), que este projeto
              não usa — e a duplicata aqui é proposital: uma folha por caminho,
              e só um dos dois caminhos existe em cada navegador. */}
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap"
          />
        </noscript>
        {/* Decide se ESTA sessão já viu a abertura, e tem de decidir antes da
            primeira pintura — depois dela a cortina já teria piscado. É o
            único JavaScript da abertura inteira. */}
        <RoteiroDaAbertura />
      </head>
      <body>
        {/* Antes de tudo, e no HTML do servidor: assim a marca está no
            primeiro quadro pintado, e não caindo por cima de um painel que a
            pessoa já começou a ler. Some sozinha, sem JavaScript. */}
        <AberturaAnimada />
        {children}
        {/* REGISTRA O SERVICE WORKER EM TODA VISITA.
            Antes ele só era registrado quando a pessoa ligava as notificações,
            em components/ativar-notificacoes.tsx — e quem nunca ligou não
            tinha service worker nenhum. Como é ele que guarda os arquivos de
            build, o aplicativo abria do zero toda vez.

            No `load`, e não agora: registrar durante o carregamento faz o
            service worker disputar banda com a página que ainda está
            chegando — atrasa exatamente o que ele existe para acelerar.

            `register` é idempotente: chamar de novo devolve o registro que já
            existe, então a chamada das notificações continua valendo. E o
            `catch` vazio é porque navegação privada e alguns navegadores
            recusam registrar — ali o site funciona igual, só sem cache. */}
        <script dangerouslySetInnerHTML={{ __html:
          "if('serviceWorker' in navigator){addEventListener('load',function(){"
          + "navigator.serviceWorker.register('/sw.js').catch(function(){})})}" }} />
      </body>
    </html>
  );
}
