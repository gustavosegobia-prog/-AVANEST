import type { Metadata } from "next";
import { paginaPublica } from "@/lib/metadados";
import Link from "next/link";
import { comoJson, migalhas, paginaDeConteudo } from "@/lib/schema";
import { PaginaDeConteudo } from "@/components/pagina-de-conteudo";

// O GUIA DA AVALIAÇÃO PRÉ-ANESTÉSICA.
//
// "Avaliação pré-anestésica" é a busca mais disputada do assunto, e quem está
// na frente são aulas de faculdade, artigos e páginas de hospital — todos
// explicando o que ela é. Uma página de venda não entra nessa disputa: o Google
// mostra para essa busca quem a RESPONDE. Por isso o texto é o guia completo,
// com a norma lida item por item, e o sistema aparece só no fim.
//
// TUDO O QUE É NORMA VEM DO TEXTO DA RESOLUÇÃO CFM Nº 2.174/2017, conferido no
// PDF oficial do CFM: o artigo 1º, os itens do Anexo II e os critérios do
// Anexo V. Nada foi arredondado nem completado de cabeça — numa página que o
// colega vai usar para preencher prontuário, um item inventado é pior do que um
// item faltando.

const CAMINHO = "/avaliacao-pre-anestesica";
const REVISADO_EM = "2026-10-10";
const RESOLUCAO = "https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2017/2174_2017.pdf";

const TITULO = "Avaliação pré-anestésica: o que é e o que registrar";
const DESCRICAO =
  "O que a avaliação pré-anestésica deve conter segundo a Resolução CFM 2.174/2017: "
  + "ficha, via aérea, jejum, escores de risco e consentimento.";

export const metadata: Metadata = paginaPublica({
  titulo: `${TITULO} | AVANEST`,
  descricao: DESCRICAO,
  caminho: CAMINHO,
  artigo: true,
});

const TRILHA = [
  { nome: "Início", caminho: "/" },
  { nome: "Avaliação pré-anestésica", caminho: CAMINHO },
];

const INDICE = [
  { id: "o-que-e", titulo: "O que é" },
  { id: "consulta-ou-avaliacao", titulo: "Consulta ou avaliação" },
  { id: "ficha", titulo: "O que a ficha deve conter" },
  { id: "jejum", titulo: "Tempo de jejum" },
  { id: "risco", titulo: "Estratificação de risco" },
  { id: "exames", titulo: "Exames e medicamentos" },
  { id: "perguntas", titulo: "Perguntas frequentes" },
];

// Anexo II, item 3: a ficha de consulta e/ou avaliação pré-anestésica. As
// letras são as da resolução, para quem for conferir no original.
const ITENS_DA_FICHA: [string, string, string][] = [
  ["a", "Anestesista", "Identificação do médico anestesista responsável pela avaliação."],
  ["b", "Paciente e data", "Identificação do paciente e data da avaliação."],
  ["c", "Procedimento", "A intervenção cirúrgica ou o procedimento proposto."],
  ["d", "Antropometria", "Altura, peso e índice de massa corpórea (IMC)."],
  ["e", "Antecedentes", "Antecedentes pessoais e familiares."],
  ["f", "Exame físico e via aérea",
    "Abertura de boca e mandíbula, Mallampati, mobilidade atlanto-occipital, distância "
    + "tireomentoniana, condições dentárias, prótese dentária e circunferência cervical."],
  ["g", "Jejum", "O tempo de jejum, seguindo a tabela da própria resolução (logo abaixo)."],
  ["h", "Sinais vitais",
    "Pressão arterial, frequência cardíaca, temperatura, frequência respiratória e escala "
    + "de dor: de 0 a 10 no adulto e de faces na criança."],
  ["i", "Diagnóstico", "Diagnóstico cirúrgico e doenças associadas."],
  ["j", "Tratamento", "Fármacos de uso atual ou recente."],
  ["k", "Alergias e história anestésica",
    "Alergias, com ênfase em fármacos e látex, história familiar de efeitos adversos em "
    + "anestesia e hipertermia."],
  ["l", "Hábitos",
    "Tabagismo (cigarros por dia e há quanto tempo), etilismo (frequência e quantidade), "
    + "entre outros."],
  ["m", "Exames e pareceres",
    "Resultados dos exames complementares pedidos e a opinião de outros especialistas, "
    + "quando houver."],
  ["n", "Estado físico",
    "Avaliação dos sistemas cardiovascular e respiratório, e dos outros que tiverem "
    + "alteração clínica relevante."],
  ["o", "Medicação pré-anestésica", "A prescrição, quando indicada."],
];

const JEJUM: [string, string][] = [
  ["Líquidos claros sem resíduos (água, chá)", "2 horas"],
  ["Leite materno", "4 horas"],
  ["Leite não humano ou fórmula", "6 horas"],
  ["Refeições leves", "6 horas"],
  ["Dieta geral", "8 horas"],
];

// Anexo V, na ordem e com as palavras do original.
const CRITERIOS_MAIORES = [
  "Idade acima de 70 anos, com doença crônica descompensada.",
  "Doença cardiovascular, cerebrovascular ou respiratória grave descompensada.",
  "Doença vascular grave ou doença neurológica crônica descompensada.",
  "Abdome agudo descompensado.",
  "Previsão de grandes perdas sanguíneas: mais de 20% da volemia ou mais de 1.000 ml no "
    + "adulto; mais de 7 ml/kg ou mais de 10% da volemia na criança.",
  "Choque de qualquer etiologia.",
  "Insuficiência respiratória.",
  "Insuficiência renal, aguda ou crônica descompensada.",
  "Cirurgia oncológica extensa.",
  "Insuficiência hepática descompensada.",
  "Cirurgia de urgência ou emergência.",
];
const CRITERIOS_MENORES = [
  "História de doença cardiovascular, cerebrovascular ou respiratória grave compensada.",
  "Insuficiência renal crônica dialítica compensada.",
  "Diabetes mellitus insulinodependente.",
  "Síndrome da apneia obstrutiva do sono grave.",
  "Obesidade grau II ou maior (IMC a partir de 35 kg/m²).",
];

export default function AvaliacaoPreAnestesicaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: comoJson(paginaDeConteudo({
          nome: TITULO, descricao: DESCRICAO, caminho: CAMINHO, revisadoEm: REVISADO_EM, medica: true,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: comoJson(migalhas(TRILHA)) }}
      />
      <PaginaDeConteudo
        sobretitulo="GUIA PARA ANESTESIOLOGISTAS"
        titulo="Avaliação pré-anestésica"
        resumo={"A avaliação pré-anestésica é a consulta em que o anestesiologista conhece o "
          + "paciente antes da anestesia: história, medicamentos, exame físico, via aérea e risco "
          + "do procedimento. Ela é obrigatória antes de qualquer anestesia, exceto em urgência e "
          + "emergência, e precisa ficar registrada. Abaixo, o que a Resolução CFM nº 2.174/2017 "
          + "pede em cada item."}
        revisadoEm={REVISADO_EM}
        indice={INDICE}
        origem="avaliacao-pre-anestesica"
        atual={CAMINHO}
        fim={{
          titulo: "A avaliação pré-anestésica inteira, no celular ou no computador.",
          texto: "No AVANEST a avaliação tem nove etapas: identificação, procedimento, anamnese, "
            + "medicamentos, exame físico, via aérea, exames, escores e conclusão. ASA, índice de "
            + "Lee, STOP-Bang e Apfel saem calculados do que já foi respondido. A ficha, o termo de "
            + "consentimento e as orientações ao paciente saem impressos no timbre do hospital, "
            + "com a sua assinatura, CRM e RQE.",
        }}
      >
        <section className="recBloco" id="o-que-e">
          <h2>O que é a avaliação pré-anestésica</h2>
          <p>
            É o momento em que o anestesiologista reúne o que precisa para decidir a anestesia:
            doenças e medicamentos do paciente, anestesias anteriores, alergias, exame da via
            aérea e o risco do procedimento proposto. Dela saem a classificação de risco, o plano
            anestésico, as orientações de jejum e de medicamentos e o termo de consentimento.
          </p>
          <p>
            A resolução do CFM diz que, antes de qualquer anestesia fora de urgência e emergência,
            &quot;é indispensável conhecer, com a devida antecedência, as condições clínicas do
            paciente, cabendo ao médico anestesista decidir sobre a realização ou não do ato
            anestésico&quot;. A avaliação é o registro dessa decisão.
          </p>
        </section>

        <section className="recBloco" id="consulta-ou-avaliacao">
          <h2>Consulta pré-anestésica ou avaliação pré-anestésica?</h2>
          <p>
            A resolução usa os dois nomes, para dois momentos diferentes. A diferença está em
            quando e onde o paciente é visto.
          </p>
          <div className="escTabela">
            <table>
              <thead>
                <tr><th></th><th>Consulta pré-anestésica</th><th>Avaliação pré-anestésica</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>Quando</strong></td>
                  <td>Antes da internação, em consultório. É a recomendada para os procedimentos
                      eletivos.</td>
                  <td>Antes da entrada no centro cirúrgico, quando a consulta não foi possível.</td></tr>
                <tr><td><strong>Exames</strong></td>
                  <td colSpan={2}>Nos dois casos o anestesista pode pedir exames complementares e
                      avaliação de outros especialistas, com base na condição clínica e no
                      procedimento proposto.</td></tr>
                <tr><td><strong>Quem faz</strong></td>
                  <td colSpan={2}>O médico anestesista. Ele não precisa ser o mesmo que vai
                      administrar a anestesia.</td></tr>
              </tbody>
            </table>
          </div>
          <p className="escNota">
            Resolução CFM nº 2.174/2017, artigo 1º, inciso I, alíneas a, b e c.
          </p>
        </section>

        <section className="recBloco" id="ficha">
          <h2>O que a ficha de avaliação pré-anestésica deve conter</h2>
          <p>
            O Anexo II da resolução define a documentação da anestesia no pré-operatório. São
            três peças: a <strong>estratificação do risco</strong> do paciente, o{" "}
            <strong>termo de consentimento livre e esclarecido</strong> (dispensável em urgência e
            emergência) e a <strong>ficha de consulta ou avaliação pré-anestésica</strong>, que
            deve ter estes itens:
          </p>
          <div className="escTabela">
            <table>
              <thead>
                <tr><th>Item</th><th>O que registrar</th></tr>
              </thead>
              <tbody>
                {ITENS_DA_FICHA.map(([letra, nome, texto]) => (
                  <tr key={letra}><td><strong>{letra}) {nome}</strong></td><td>{texto}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="escNota">
            A lista é o mínimo exigido. O termo de consentimento, pelo Anexo I, explica as técnicas
            de anestesia, as vantagens, as desvantagens e os riscos em linguagem clara, e tem campos
            para a assinatura do paciente ou do responsável, a data e a assinatura e o nome legível
            do anestesista. Há um <Link href="/ficha-anestesica#modelo">modelo da ficha em branco
            para imprimir</Link> na página da ficha anestésica.
          </p>
        </section>

        <section className="recBloco" id="jejum">
          <h2>Quanto tempo de jejum antes da anestesia?</h2>
          <p>
            A própria resolução traz a tabela, dentro do item de jejum da ficha:
          </p>
          <div className="escTabela">
            <table>
              <thead>
                <tr><th>Alimento</th><th>Jejum mínimo</th></tr>
              </thead>
              <tbody>
                {JEJUM.map(([alimento, tempo]) => (
                  <tr key={alimento}><td>{alimento}</td><td><strong>{tempo}</strong></td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="escNota">
            São tempos mínimos. Gastroparesia, obstrução intestinal e uso de agonistas de GLP-1
            são situações em que o esvaziamento gástrico pode atrasar, e o jejum precisa ser
            decidido caso a caso na avaliação.
          </p>
        </section>

        <section className="recBloco" id="risco">
          <h2>Estratificação de risco: ASA, escores e o critério do CFM</h2>
          <p>
            A estratificação do risco é a primeira peça da documentação pré-operatória. Na
            prática ela junta a classificação do estado físico com escores feitos para riscos
            específicos:
          </p>
          <ul className="recLista">
            <li><Link href="/escores/classificacao-asa">Classificação ASA</Link>: o estado
              físico do paciente, de I a VI, com o sufixo E na emergência.</li>
            <li><Link href="/escores/indice-de-lee">Índice de Lee (RCRI)</Link>: risco de
              evento cardíaco maior em cirurgia não cardíaca.</li>
            <li><Link href="/escores/stop-bang">STOP-Bang</Link>: rastreio de apneia obstrutiva
              do sono, que muda a via aérea e o pós-operatório.</li>
            <li><Link href="/escores/apfel">Escore de Apfel</Link>: risco de náusea e vômito no
              pós-operatório, para decidir a profilaxia.</li>
          </ul>
          <p className="conteudoDepoisDaLista">
            O Anexo V da resolução traz ainda uma classificação do risco do paciente pelo número de
            critérios maiores e menores. É ela que a resolução usa para recomendar monitorização
            hemodinâmica avançada no paciente de alto risco e no de risco intermediário.
          </p>
          <div className="escTabela">
            <table>
              <thead>
                <tr><th>Risco</th><th>Critérios</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>Alto</strong></td><td>3 ou mais critérios maiores, ou 4 ou mais menores.</td></tr>
                <tr><td><strong>Intermediário</strong></td><td>2 critérios maiores, ou 3 menores.</td></tr>
                <tr><td><strong>Baixo</strong></td><td>Os que não se enquadram acima.</td></tr>
              </tbody>
            </table>
          </div>
          <div className="conteudoDuasColunas">
            <div>
              <h3>Critérios maiores</h3>
              <ol>{CRITERIOS_MAIORES.map((c) => <li key={c}>{c}</li>)}</ol>
            </div>
            <div>
              <h3>Critérios menores</h3>
              <ol>{CRITERIOS_MENORES.map((c) => <li key={c}>{c}</li>)}</ol>
            </div>
          </div>
          <p className="escNota">
            O porte da cirurgia entra sempre junto com os critérios clínicos, e os transplantes de
            alta complexidade são estratificados como de alto risco.
          </p>
        </section>

        <section className="recBloco" id="exames">
          <h2>Quais exames pedir e o que fazer com os medicamentos</h2>
          <p>
            A resolução não traz uma bateria obrigatória de exames. Ela autoriza o anestesista a
            pedir exames complementares e avaliação de outros especialistas &quot;desde que baseado
            na condição clínica do paciente e no procedimento proposto&quot;. Exame sem indicação
            clínica raramente muda a conduta e costuma atrasar a cirurgia. Os resultados entram na
            ficha, com a data da coleta.
          </p>
          <p>
            Cada medicamento de uso contínuo sai da avaliação com uma conduta: manter, suspender ou
            individualizar, e a orientação precisa chegar escrita ao paciente. Os antitrombóticos
            são onde o erro custa mais: suspensão curta demais aumenta o sangramento, e longa
            demais expõe o paciente a trombose.
          </p>
        </section>

        <section className="recBloco" id="perguntas">
          <h2>Perguntas frequentes</h2>
          <div className="conteudoPerguntas">
            <article>
              <h3>A avaliação pré-anestésica é obrigatória?</h3>
              <p>Sim. Antes de qualquer anestesia, exceto em urgência e emergência, o anestesista
                precisa conhecer as condições clínicas do paciente com a devida antecedência.</p>
            </article>
            <article>
              <h3>Quem pode fazer a avaliação pré-anestésica?</h3>
              <p>O médico anestesista. Pode ser um colega do serviço: quem avalia não precisa ser
                quem vai anestesiar.</p>
            </article>
            <article>
              <h3>Com quanto tempo de antecedência?</h3>
              <p>A resolução não fixa um número de dias. Ela pede &quot;a devida antecedência&quot;
                e recomenda, para cirurgia eletiva, a consulta em consultório antes da internação.</p>
            </article>
            <article>
              <h3>O termo de consentimento é obrigatório?</h3>
              <p>Faz parte da documentação pré-operatória e só pode faltar em urgência e
                emergência. A resolução pede um termo específico para a anestesia.</p>
            </article>
            <article>
              <h3>Qual resolução do CFM regula a avaliação pré-anestésica?</h3>
              <p>A Resolução CFM nº 2.174/2017, publicada no Diário Oficial da União em 27 de
                fevereiro de 2018. Ela revogou a Resolução CFM nº 1.802/2006.</p>
            </article>
            <article>
              <h3>A avaliação vale para a ficha anestésica do intraoperatório?</h3>
              <p>São documentos diferentes. A ficha de anestesia registra o que acontece durante o
                procedimento e tem itens próprios, explicados na página da{" "}
                <Link href="/ficha-anestesica">ficha anestésica</Link>.</p>
            </article>
          </div>
        </section>

        <section className="recBloco">
          <h2>Referência</h2>
          <p className="escNota">
            Conselho Federal de Medicina. <a href={RESOLUCAO} target="_blank" rel="noreferrer">
            Resolução CFM nº 2.174, de 14 de dezembro de 2017</a>. Dispõe sobre a prática do ato
            anestésico. Diário Oficial da União, 27 fev. 2018, Seção I, p. 82.
          </p>
        </section>
      </PaginaDeConteudo>
    </>
  );
}
