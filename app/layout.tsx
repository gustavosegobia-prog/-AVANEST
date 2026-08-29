import type { Metadata } from "next";
import {
  TELAS_DE_ABERTURA, arquivoDaAbertura, consultaDaAbertura,
} from "@/lib/tela-de-abertura";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.avanest.com.br"),
  title: "AVANEST | Gestão em anestesiologia",
  description: "Sistema de gestão para serviços de anestesiologia: avaliação pré-anestésica em nove etapas, escala por instituição e controle do que foi produzido, faturado e recebido.",
  openGraph: {
    title: "AVANEST | Gestão em anestesiologia",
    description: "Da avaliação pré-anestésica ao fluxo de caixa do serviço. Desenvolvido por anestesiologista, dentro de um serviço em atividade.",
  },
  twitter: { card: "summary" },
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
