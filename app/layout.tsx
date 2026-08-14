import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.avanest.com.br"),
  title: "AvaNEST | Avaliação pré-anestésica digital",
  description: "Antes da cirurgia, segurança. Faça sua avaliação pré-anestésica de forma simples e orientada.",
  openGraph: {
    title: "AvaNEST | Antes da cirurgia, segurança.",
    description: "Avaliação pré-anestésica digital, simples e segura.",
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
