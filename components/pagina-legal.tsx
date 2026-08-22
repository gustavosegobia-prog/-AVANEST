import Link from "next/link";
import { AppLogo } from "@/components/app-logo";

// Moldura compartilhada de /termos e /privacidade. Os dois documentos têm a
// mesma estrutura de leitura — cabeçalho, data de vigência, corpo em seções
// numeradas e rodapé com a identificação da empresa —, então a moldura mora
// aqui e cada página cuida só do próprio texto.

export function PaginaLegal({
  titulo,
  resumo,
  vigencia,
  children,
}: {
  titulo: string;
  resumo: string;
  vigencia: string;
  children: React.ReactNode;
}) {
  return (
    <main className="legalPage">
      <header className="avnNav">
        <Link href="/"><AppLogo /></Link>
        <nav>
          <a className="avnLogin" href="/planos">Planos</a>
          <a className="avnPrimary" href="/login">Login</a>
        </nav>
      </header>

      <article className="legalCorpo">
        <h1>{titulo}</h1>
        <p className="legalResumo">{resumo}</p>
        <p className="legalVigencia">Em vigor desde {vigencia}.</p>
        {children}
        <nav className="legalOutros">
          <Link href="/termos">Termos de Uso</Link>
          <Link href="/privacidade">Política de Privacidade</Link>
          <Link href="/planos">Planos e preços</Link>
        </nav>
      </article>

      <footer className="avnFooter">
        <span>G. Segobia Serviços Médicos Ltda. — CNPJ 55.965.276/0001-04</span>
      </footer>
    </main>
  );
}
