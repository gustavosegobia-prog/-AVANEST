import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { PAGINAS_DE_CONTEUDO, RodapePublico } from "@/components/rodape-publico";
import { CAMINHO_DA_CAMPANHA } from "@/lib/link-da-campanha";
import { dataPorExtenso, nomeCompleto, registro } from "@/lib/autoria";

// A moldura das páginas que respondem a uma busca — avaliação pré-anestésica,
// ficha anestésica, escala médica.
//
// Quem chega aqui digitou o assunto no Google, e não o nome AVANEST. A página
// responde o assunto primeiro, por inteiro, e fala do sistema no fim. Página
// que troca a resposta por um formulário de cadastro devolve a pessoa ao
// buscador — e o Google aprende com essa volta que o resultado não servia.
//
// O ÍNDICE no topo não é só navegação: as âncoras com nome viram os atalhos
// "Ir para" que o Google mostra embaixo do resultado, e cada atalho é mais uma
// linha do resultado ocupada por esta página.

export type Topico = { id: string; titulo: string };

export function PaginaDeConteudo({
  sobretitulo, titulo, resumo, revisadoEm, indice, comAcao, origem, atual, fim, children,
}: {
  sobretitulo: string;
  titulo: string;
  resumo: string;
  /** AAAA-MM-DD. Presente só no texto clínico, que leva assinatura médica. */
  revisadoEm?: string;
  indice?: Topico[];
  /** Botão do teste grátis já no topo — na página de quem veio comprar. */
  comAcao?: boolean;
  /** Vai no `?de=` do link da campanha, para saber qual página converteu. */
  origem: string;
  /** O href desta página, para não se listar em "Leia também". */
  atual: string;
  /** `link` troca o segundo botão do fim, que por padrão leva ao /recursos. */
  fim: { titulo: string; texto: string; link?: { href: string; rotulo: string } };
  children: React.ReactNode;
}) {
  const teste = `${CAMINHO_DA_CAMPANHA}?de=${origem}`;
  return (
    <main className="avnLanding">
      <header className="avnNav">
        <Link href="/" aria-label="AVANEST"><AppLogo /></Link>
        <nav>
          <a className="avnLogin" href="/recursos">
            <span className="avnSoLargo">O que o sistema faz</span>
            <span className="avnSoEstreito">Recursos</span>
          </a>
          <a className="avnPrimary" href="/planos">Ver planos</a>
        </nav>
      </header>

      <section className="recHero">
        <p className="avnEyebrow">{sobretitulo}</p>
        <h1>{titulo}</h1>
        <p className="avnLead">{resumo}</p>
        {revisadoEm && (
          <p className="escAutoria">
            <span>Escrito e revisado por <b>{nomeCompleto()}</b></span>
            <span className="escAutoriaCrm">{registro()}</span>
            <span>Última revisão em {dataPorExtenso(revisadoEm)}</span>
          </p>
        )}
        {comAcao && (
          <div className="conteudoAcao">
            <div className="avnActions">
              <a className="avnPrimary" href={teste}>Começar 2 meses grátis</a>
              <a className="avnSecondary" href="/planos">Ver planos</a>
            </div>
            <p>Sem cartão de crédito e sem compromisso.</p>
          </div>
        )}
        {indice && (
          <nav className="conteudoIndice" aria-label="Nesta página">
            <b>Nesta página</b>
            <ol>
              {indice.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.titulo}</a></li>)}
            </ol>
          </nav>
        )}
      </section>

      {children}

      <section className="recFim">
        <h2>{fim.titulo}</h2>
        <p>{fim.texto}</p>
        <div className="avnActions">
          <a className="avnPrimary" href={teste}>Começar 2 meses grátis</a>
          <a className="avnSecondary" href={fim.link?.href ?? "/recursos"}>
            {fim.link?.rotulo ?? "Ver todos os recursos"}
          </a>
        </div>
      </section>

      <section className="escOutros">
        <h2>Leia também</h2>
        <nav className="escOutrosLinks">
          {PAGINAS_DE_CONTEUDO.filter((p) => p.href !== atual).map((p) => (
            <Link key={p.href} href={p.href}>{p.nome}</Link>
          ))}
        </nav>
      </section>

      <RodapePublico />
    </main>
  );
}
