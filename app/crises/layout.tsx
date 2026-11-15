import type { ReactNode } from "react";
// O CSS inteiro do sistema, na ordem de sempre. As páginas públicas carregam
// só app/site.css, o pedaço delas (scripts/gerar-css-do-site.mjs).
import "../globals.css";

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
