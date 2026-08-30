import type { Metadata } from "next";
import { comoJson, migalhas } from "@/lib/schema";
import Link from "next/link";
import { AppLogo } from "@/components/app-logo";

const CAMINHO = "/escores";

const TRILHA = [
  { nome: "Início", caminho: "/" },
  { nome: "Escores", caminho: "/escores" },
];

export const metadata: Metadata = {
  title: "Escores da avaliação pré-anestésica | AVANEST",
  description:
    "Calculadoras livres de STOP-Bang, Apfel e índice de Lee (RCRI), e a classificação "
    + "ASA com exemplos. Feitas para a consulta pré-anestésica, por anestesiologista.",
  alternates: { canonical: CAMINHO },
};

// A porta de entrada da seção.
//
// Cada escore tem página própria porque cada um é uma busca diferente: quem
// digita "stop bang" não digita "índice de lee", e uma página só com os quatro
// não ganharia nenhuma das quatro buscas. Esta aqui existe para amarrar as
// quatro entre si e dar ao buscador um lugar de onde todas descendem.

const CARTOES = [
  {
    href: "/escores/stop-bang",
    nome: "STOP-Bang",
    para: "Apneia obstrutiva do sono",
    resumo:
      "Oito critérios para achar, na véspera, o paciente com apneia não diagnosticada — "
      + "que é quem dessatura na indução e faz evento respiratório na recuperação.",
  },
  {
    href: "/escores/apfel",
    nome: "Escore de Apfel",
    para: "Náusea e vômito no pós-operatório",
    resumo:
      "Quatro fatores, nenhum deles dependendo de exame, para decidir quanta profilaxia "
      + "vale a pena antes — em vez de tratar depois.",
  },
  {
    href: "/escores/indice-de-lee",
    nome: "Índice de Lee (RCRI)",
    para: "Risco cardíaco em cirurgia não cardíaca",
    resumo:
      "Seis critérios, um ponto cada. É o escore que sustenta a conversa com o "
      + "cardiologista com um número no lugar de uma impressão.",
  },
  {
    href: "/escores/classificacao-asa",
    nome: "Classificação ASA",
    para: "Estado físico do paciente",
    resumo:
      "As seis classes com definição e exemplos, mais o que o sufixo E de emergência "
      + "muda — e o que ele não muda.",
  },
];

const DADOS_ESTRUTURADOS = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Escores da avaliação pré-anestésica",
  description:
    "Calculadoras de STOP-Bang, Apfel e índice de Lee (RCRI), e a classificação ASA.",
  url: `https://www.avanest.com.br${CAMINHO}`,
  inLanguage: "pt-BR",
  hasPart: CARTOES.map((c) => ({
    "@type": "MedicalWebPage",
    name: c.nome,
    url: `https://www.avanest.com.br${c.href}`,
  })),
};

export default function EscoresPage() {
  return (
    <main className="avnLanding">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(DADOS_ESTRUTURADOS) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: comoJson(migalhas(TRILHA)) }}
      />
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
        <p className="avnEyebrow">REFERÊNCIA LIVRE</p>
        <h1>Os escores da avaliação pré-anestésica.</h1>
        <p className="avnLead">
          Calculadoras que funcionam sem cadastro e sem login. A conta é feita no seu
          navegador: nada é enviado, nada é guardado.
        </p>
      </section>

      <section className="escGrade">
        {CARTOES.map((c) => (
          <Link className="escCartao" key={c.href} href={c.href}>
            <span className="escCartaoPara">{c.para}</span>
            <h2>{c.nome}</h2>
            <p>{c.resumo}</p>
          </Link>
        ))}
      </section>

      <section className="escAviso">
        <p>
          <strong>Apoio à decisão, não substituto dela.</strong> Estes escores estimam
          risco em populações; quem avalia o paciente à sua frente é você.
        </p>
      </section>

      <section className="recFim">
        <h2>No AVANEST, os quatro já vêm preenchidos.</h2>
        <p>
          Idade, sexo, IMC, circunferência cervical, diabetes em uso de insulina, hábitos —
          o que já foi respondido na anamnese e no exame físico marca os critérios sozinho.
          O que sobra para você é conferir, e o resultado sai impresso junto com a ficha.
        </p>
        <div className="avnActions">
          <a className="avnPrimary" href="/recursos">Ver o que o sistema faz</a>
          <a className="avnSecondary" href="/planos">Planos e preços</a>
        </div>
      </section>

      <footer className="avnFooter">
        <span>G. Segobia Serviços Médicos Ltda. — CNPJ 55.965.276/0001-04</span>
        <nav className="avnFooterLinks">
          <Link href="/">Início</Link>
          <a href="/termos">Termos de Uso</a>
          <a href="/privacidade">Política de Privacidade</a>
        </nav>
      </footer>
    </main>
  );
}
