import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://avanest-avaliacao-segura.gustavosegobia.chatgpt.site"),
  title: "AvaNEST | Avaliação pré-anestésica digital",
  description: "Antes da cirurgia, segurança. Faça sua avaliação pré-anestésica de forma simples e orientada.",
  openGraph: {
    title: "AvaNEST | Antes da cirurgia, segurança.",
    description: "Avaliação pré-anestésica digital, simples e segura.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "AvaNEST — Antes da cirurgia, segurança." }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
