import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.avanest.com.br"),
  title: "AVANEST | Gestão em anestesiologia",
  description: "Escala, avaliação pré-anestésica, produção do plantão e recebimento — o dia inteiro do anestesiologista em um sistema só.",
  openGraph: {
    title: "AVANEST | Gestão em anestesiologia",
    description: "Escala, avaliação pré-anestésica, produção e recebimento em um sistema só.",
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Declarado à mão, apontando para /public, em vez de depender do
            arquivo chamar-se exatamente "apple-icon.png" na pasta app. O
            caminho explícito funciona com qualquer nome de arquivo. */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icone192.png" />
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
