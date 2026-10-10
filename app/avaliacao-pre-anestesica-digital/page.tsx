import type { Metadata } from "next";
import Link from "next/link";
import { paginaPublica } from "@/lib/metadados";
import { comoJson, migalhas, paginaDeConteudo } from "@/lib/schema";
import { PaginaDeConteudo } from "@/components/pagina-de-conteudo";

// A AVALIAÇÃO PRÉ-ANESTÉSICA COMO PRODUTO — a página de destino dos anúncios.
//
// Existe ao lado do guia (/avaliacao-pre-anestesica), e não no lugar dele,
// porque as duas buscas querem coisas diferentes. Quem digita "avaliação
// pré-anestésica" quer saber o que ela é e o que registrar: o guia responde. Quem
// digita "avaliação pré-anestésica digital" ou "software de avaliação
// pré-anestésica" quer um sistema, e mandar essa pessoa para um texto sobre a
// resolução do CFM, com o botão de cadastro só no fim, é pagar pelo clique e
// perder o cadastro. Aqui o título repete a busca e o teste grátis está no topo.
//
// Cada item abaixo existe no sistema hoje (a régua de app/recursos/page.tsx). O
// que ainda não existe está dito como "ainda não": a ficha do intraoperatório.

const CAMINHO = "/avaliacao-pre-anestesica-digital";
const REVISADO_EM = "2026-10-10";

const TITULO = "Avaliação pré-anestésica digital no celular";
const DESCRICAO =
  "Avaliação pré-anestésica em nove etapas, com Lee, STOP-Bang e Apfel calculados e ficha, "
  + "termo e orientações impressos. 2 meses grátis.";

export const metadata: Metadata = paginaPublica({
  titulo: `${TITULO} | AVANEST`,
  descricao: DESCRICAO,
  caminho: CAMINHO,
});

const TRILHA = [
  { nome: "Início", caminho: "/" },
  { nome: "Avaliação pré-anestésica digital", caminho: CAMINHO },
];

const NA_CONSULTA: [string, React.ReactNode][] = [
  ["Nove etapas, salvas enquanto você digita",
    "Identificação, procedimento, anamnese, medicamentos, exame físico, via aérea, exames, "
    + "escores e conclusão. O texto é salvo sozinho: fechar a tela no meio não perde nada."],
  ["Os escores sem marcar critério à mão",
    <>Idade, sexo, IMC, circunferência cervical e o que foi respondido na anamnese preenchem
      os critérios do <Link href="/escores/indice-de-lee">índice de Lee</Link>, do{" "}
      <Link href="/escores/stop-bang">STOP-Bang</Link> e do{" "}
      <Link href="/escores/apfel">Apfel</Link>. A{" "}
      <Link href="/escores/classificacao-asa">classificação ASA</Link> é sua, com a definição de
      cada classe na tela.</>],
  ["Via aérea com os preditores que mudam a conduta",
    "Mallampati, distância tireomentoniana, abertura bucal, mobilidade cervical e histórico de "
    + "intubação difícil. O resumo sai escrito, do jeito que vai para a ficha."],
  ["Os exames lidos do laudo",
    "Anexe a foto ou o PDF do laboratório e os valores entram nos campos. Valor fora do que "
    + "existe em ser humano é descartado, e o que você já digitou nunca é sobrescrito."],
  ["Medicamentos com orientação de suspensão",
    "A base diz quantos dias antes suspender cada antitrombótico e quando reintroduzir. Você "
    + "ajusta, e a orientação sai escrita para o paciente levar."],
  ["Via aérea pediátrica por idade, e por peso no neonato",
    "Acima de um ano, a fórmula da idade. Abaixo de um ano o tubo sai de tabela por peso, "
    + "porque a fórmula de criança maior erra para cima no recém-nascido."],
];

const NO_PAPEL: [string, string][] = [
  ["Ficha, termo de consentimento e orientações",
    "Os três documentos saem com o logo e o nome do hospital do atendimento. Reimprimir hoje "
    + "uma ficha de março traz o hospital de março."],
  ["A sua assinatura, com CRM e RQE",
    "No rodapé de cada documento. Quem tem o registro da especialidade assina como especialista."],
  ["A ficha do tamanho do caso",
    "Pergunta sem resposta não vai para o papel: o paciente hígido não sai com três páginas de "
    + "campos em branco."],
];

export default function AvaliacaoDigitalPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: comoJson(paginaDeConteudo({
          nome: TITULO, descricao: DESCRICAO, caminho: CAMINHO, revisadoEm: REVISADO_EM, medica: false,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: comoJson(migalhas(TRILHA)) }}
      />
      <PaginaDeConteudo
        sobretitulo="AVALIAÇÃO PRÉ-ANESTÉSICA NO AVANEST"
        titulo="Avaliação pré-anestésica digital"
        resumo={"A consulta pré-anestésica inteira no celular ou no computador: nove etapas salvas "
          + "enquanto você digita, os escores calculados a partir do que já foi respondido e a "
          + "ficha, o termo de consentimento e as orientações impressos no timbre do hospital."}
        comAcao
        origem="avaliacao-digital"
        atual={CAMINHO}
        fim={{
          titulo: "Faça a próxima avaliação pré-anestésica no AVANEST.",
          texto: "Os dois primeiros meses são grátis, sem cartão de crédito, sem cobrança "
            + "automática e sem fidelidade. A ficha anestésica e a escala ficam liberadas desde o "
            + "primeiro dia.",
          link: { href: "/avaliacao-pre-anestesica", rotulo: "Ler o guia da avaliação" },
        }}
      >
        <section className="recBloco">
          <h2>Na consulta</h2>
          <div className="recGrade">
            {NA_CONSULTA.map(([titulo, texto]) => (
              <article key={titulo}><h3>{titulo}</h3><p>{texto}</p></article>
            ))}
          </div>
        </section>

        <section className="recBloco">
          <h2>No papel</h2>
          <div className="recGrade">
            {NO_PAPEL.map(([titulo, texto]) => (
              <article key={titulo}><h3>{titulo}</h3><p>{texto}</p></article>
            ))}
          </div>
        </section>

        <section className="recBloco">
          <h2>Sigilo</h2>
          <div className="recGrade">
            <article>
              <h3>Os dados de um serviço não se misturam com os de outro</h3>
              <p>A trava fica no banco de dados, e não só na tela: quem não é da organização não
                recebe resposta.</p>
            </article>
            <article>
              <h3>A recepção não abre a avaliação</h3>
              <p>Ela conduz a fila do dia sem ver o conteúdo clínico. Menos gente com acesso ao dado
                do paciente é menos risco para ele e para você.</p>
            </article>
            <article>
              <h3>Fica registrado quem fez o quê</h3>
              <p>Cada cadastro, alteração e exclusão guarda o autor, a data e a hora.</p>
            </article>
          </div>
        </section>

        <section className="recBloco">
          <h2>Perguntas frequentes</h2>
          <div className="conteudoPerguntas">
            <article>
              <h3>Quanto custa?</h3>
              <p>Os dois primeiros meses são grátis e sem cartão de crédito. Depois disso, os
                valores estão em <Link href="/planos">planos e preços</Link>, do anestesiologista
                que trabalha sozinho ao grupo inteiro.</p>
            </article>
            <article>
              <h3>Funciona no celular?</h3>
              <p>Sim. Abre no navegador e pode ser{" "}
                <Link href="/app">instalado na tela de início</Link> do iPhone e do Android.</p>
            </article>
            <article>
              <h3>Segue a Resolução CFM 2.174/2017?</h3>
              <p>A avaliação foi montada sobre a documentação que a resolução pede: via aérea, jejum,
                sinais vitais, medicamentos, alergias, exames e estado físico. O que cada item exige
                está no <Link href="/avaliacao-pre-anestesica">guia da avaliação
                pré-anestésica</Link>.</p>
            </article>
            <article>
              <h3>Posso usar sozinho, sem um grupo?</h3>
              <p>Pode. O anestesiologista que trabalha por conta própria usa a avaliação e a escala
                com todos os hospitais em que atende, no mesmo lugar.</p>
            </article>
            <article>
              <h3>A ficha do intraoperatório está incluída?</h3>
              <p>Ainda não. Hoje o AVANEST faz a parte pré-anestésica: avaliação, termo e
                orientações. A diferença entre as fichas está na página da{" "}
                <Link href="/ficha-anestesica">ficha anestésica</Link>.</p>
            </article>
          </div>
        </section>
      </PaginaDeConteudo>
    </>
  );
}
