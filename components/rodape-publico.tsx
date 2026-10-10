import Link from "next/link";

// O rodapé de todas as páginas públicas.
//
// Cada página tinha o seu, escrito à mão, e cada um ligava a um pedaço
// diferente do site: a capa apontava os escores, o /planos só os documentos
// legais, a página legal nada. Para o buscador isso fazia das páginas de
// conteúdo uma periferia — página que só o sitemap aponta é tratada como
// página que ninguém considera importante.
//
// Um rodapé só, com as páginas que respondem às buscas de quem ainda não
// conhece o AVANEST, faz cada endereço do site votar nelas. E o texto do link
// é o nome da busca ("Avaliação pré-anestésica", "Escala médica"), porque é o
// texto da âncora que diz ao Google do que trata a página de destino.

/** As páginas que existem para serem encontradas por quem pesquisa o assunto. */
export const PAGINAS_DE_CONTEUDO = [
  { href: "/avaliacao-pre-anestesica", nome: "Avaliação pré-anestésica" },
  { href: "/ficha-anestesica", nome: "Ficha anestésica" },
  { href: "/escala-medica", nome: "Escala médica" },
  { href: "/escores", nome: "Escores da avaliação" },
] as const;

export function RodapePublico() {
  return (
    <footer className="avnFooter rodapePublico">
      <div className="rodapeColunas">
        <nav aria-label="Para anestesiologistas">
          <b>Para anestesiologistas</b>
          {PAGINAS_DE_CONTEUDO.map((p) => <Link key={p.href} href={p.href}>{p.nome}</Link>)}
        </nav>
        <nav aria-label="O sistema">
          <b>O sistema</b>
          <Link href="/recursos">O que o AVANEST faz</Link>
          <Link href="/planos">Planos e preços</Link>
          <Link href="/2meses">2 meses grátis</Link>
          <Link href="/app">Instalar no celular</Link>
          <Link href="/login">Entrar</Link>
        </nav>
        <nav aria-label="Empresa">
          <b>Empresa</b>
          <Link href="/termos">Termos de Uso</Link>
          <Link href="/privacidade">Política de Privacidade</Link>
          <a href="https://www.instagram.com/useavanest/" target="_blank" rel="noreferrer">Instagram</a>
        </nav>
      </div>
      <p className="rodapeEmpresa">G. Segobia Serviços Médicos Ltda. — CNPJ 55.965.276/0001-04</p>
    </footer>
  );
}
