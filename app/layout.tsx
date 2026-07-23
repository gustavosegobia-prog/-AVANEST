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
  return <html lang="pt-BR"><body>{children}</body></html>;
}
