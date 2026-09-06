import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { autorEmSchema, dataPorExtenso, nomeCompleto, registro } from "@/lib/autoria";

// A moldura das páginas públicas de escore.
//
// Cabeçalho, rodapé, aviso clínico e o convite do fim são iguais nas quatro.
// Repetir isso em cada arquivo faria a próxima página nascer com a versão velha
// do aviso — e o aviso é a parte que não pode variar.
//
// Quem chega aqui vem do Google procurando o escore, não o AVANEST. Então a
// página entrega o escore primeiro e fala do sistema no fim, uma vez. Página que
// esconde a calculadora atrás de um cadastro perde o visitante e, junto, o
// motivo de existir: ele volta para o buscador e clica no resultado seguinte.

export const ESCORES_DO_MENU = [
  { href: "/escores/stop-bang", nome: "STOP-Bang" },
  { href: "/escores/apfel", nome: "Apfel (NVPO)" },
  { href: "/escores/indice-de-lee", nome: "Índice de Lee (RCRI)" },
  { href: "/escores/classificacao-asa", nome: "Classificação ASA" },
];

export function PaginaDeEscore({
  sobretitulo, titulo, resumo, atual, revisadoEm, children,
}: {
  sobretitulo: string;
  titulo: string;
  resumo: string;
  /** O href desta página, para não se auto-listar no rodapé de navegação. */
  atual?: string;
  /** AAAA-MM-DD da última revisão clínica. A mesma data que vai no schema. */
  revisadoEm?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="avnLanding">
      <header className="avnNav">
        <Link href="/" aria-label="AVANEST"><AppLogo /></Link>
        <nav>
          {/* Dois rótulos, e o CSS escolhe — o mesmo arranjo da capa. O texto
              longo não cabe em 390px junto com "Ver planos", e a barra passava
              a empurrar a página inteira 25px para o lado. */}
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
        {/* A ASSINATURA FICA NA TELA, e não só na marcação invisível.
            Conteúdo que influencia decisão de saúde é avaliado por quem
            escreveu, com que credencial e quando foi revisado — e a orientação
            do Google é explícita em querer isso visível na página, não apenas
            no JSON-LD. Declarar só na marcação é sinal não corroborado.
            Fica logo abaixo do resumo, antes da calculadora: é o que responde
            "posso confiar nisto?" antes de a pessoa usar a conta. */}
        {revisadoEm && (
          <p className="escAutoria">
            <span>Escrito e revisado por <b>{nomeCompleto()}</b></span>
            <span className="escAutoriaCrm">{registro()}</span>
            <span>Última revisão em {dataPorExtenso(revisadoEm)}</span>
          </p>
        )}
      </section>

      {children}

      <section className="escAviso">
        <p>
          <strong>Apoio à decisão, não substituto dela.</strong> Estes escores estimam
          risco em populações; quem avalia o paciente à sua frente é você. Confirme
          sempre com a história, o exame e os exames complementares.
        </p>
      </section>

      <section className="recFim">
        <h2>Estes escores já vêm calculados dentro do AVANEST.</h2>
        <p>
          No sistema você não marca nada disso à mão: o que já foi respondido na
          anamnese, no cadastro e no exame físico preenche os critérios sozinho — idade,
          sexo, IMC, circunferência cervical, diabetes em uso de insulina. O que sobra
          para você é conferir.
        </p>
        <div className="avnActions">
          <a className="avnPrimary" href="/recursos">Ver o que o sistema faz</a>
          <a className="avnSecondary" href="/planos">Planos e preços</a>
        </div>
      </section>

      <section className="escOutros">
        <h2>Outros escores</h2>
        <nav className="escOutrosLinks">
          {ESCORES_DO_MENU.filter((e) => e.href !== atual).map((e) => (
            <Link key={e.href} href={e.href}>{e.nome}</Link>
          ))}
        </nav>
      </section>

      <footer className="avnFooter">
        <span>G. Segobia Serviços Médicos Ltda. — CNPJ 55.965.276/0001-04</span>
        <nav className="avnFooterLinks">
          <Link href="/">Início</Link>
          <Link href="/escores">Escores</Link>
          <a href="/termos">Termos de Uso</a>
          <a href="/privacidade">Política de Privacidade</a>
        </nav>
      </footer>
    </main>
  );
}

/**
 * A marcação que diz ao buscador que esta página é uma referência médica.
 *
 * `MedicalWebPage` com `lastReviewed` é o que separa, aos olhos do Google, uma
 * página de conteúdo de saúde escrita e revisada de um texto qualquer que cita
 * as mesmas palavras. Não é enfeite: conteúdo médico é avaliado com régua mais
 * dura, e declarar autor e data de revisão é parte da régua.
 */
export function dadosDeEscore(a: {
  nome: string; descricao: string; caminho: string; revisadoEm: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: a.nome,
    description: a.descricao,
    url: `https://www.avanest.com.br${a.caminho}`,
    inLanguage: "pt-BR",
    lastReviewed: a.revisadoEm,
    // AUTOR E REVISOR SÃO A MESMA PESSOA aqui, e os dois campos existem porque
    // respondem a perguntas diferentes: `author` diz quem escreveu, e
    // `reviewedBy` diz quem se responsabiliza pelo que está escrito. Num texto
    // clínico o segundo é o que pesa — é ele que o Google lê como revisão
    // profissional. Omitir um dos dois deixa metade da pergunta sem resposta.
    author: autorEmSchema(),
    reviewedBy: autorEmSchema(),
    // A data em `reviewedBy` não existe no vocabulário; a de revisão é esta, e
    // `lastReviewed` acima é a mesma que aparece escrita na página.
    dateModified: a.revisadoEm,
    audience: { "@type": "MedicalAudience", audienceType: "Anestesiologistas" },
    isPartOf: {
      "@type": "WebSite",
      name: "AVANEST",
      url: "https://www.avanest.com.br",
    },
  };
}
