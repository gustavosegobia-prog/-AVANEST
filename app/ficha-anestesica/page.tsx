import type { Metadata } from "next";
import { paginaPublica } from "@/lib/metadados";
import Link from "next/link";
import { comoJson, migalhas, paginaDeConteudo } from "@/lib/schema";
import { PaginaDeConteudo } from "@/components/pagina-de-conteudo";
import { BotaoImprimir } from "@/components/botao-imprimir";

// A FICHA ANESTÉSICA.
//
// O termo é ambíguo, e a página assume isso em vez de escolher um lado. Na
// Resolução CFM nº 2.174/2017, "ficha anestésica" é a do intraoperatório
// (artigo 7º, §4º, e Anexo III). No dia a dia muita gente chama assim também a
// ficha de avaliação pré-anestésica — e é esse o nome do módulo no próprio
// AVANEST (lib/modulos.ts). Quem pesquisa pode querer qualquer uma das duas.
//
// O QUE O SISTEMA FAZ ESTÁ DITO COM TODAS AS LETRAS: a parte pré-anestésica.
// A ficha do intraoperatório continua no prontuário do hospital. Página que
// deixa o colega achar que vai encontrar o registro do intraoperatório no
// sistema vira cancelamento na primeira semana.
//
// O MODELO PARA IMPRIMIR é o que faz esta página merecer o primeiro resultado:
// quem pesquisa "ficha anestésica" muitas vezes quer a folha, e a folha está
// aqui, com os itens do Anexo II, sem cadastro.

const CAMINHO = "/ficha-anestesica";
const REVISADO_EM = "2026-10-10";
const RESOLUCAO = "https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2017/2174_2017.pdf";

const TITULO = "Ficha anestésica: o que deve conter, com modelo";
const DESCRICAO =
  "As três fichas da anestesia segundo a Resolução CFM 2.174/2017 (pré, intra e "
  + "pós-operatório) e um modelo de ficha pré-anestésica para imprimir.";

export const metadata: Metadata = paginaPublica({
  titulo: `${TITULO} | AVANEST`,
  descricao: DESCRICAO,
  caminho: CAMINHO,
  artigo: true,
});

const TRILHA = [
  { nome: "Início", caminho: "/" },
  { nome: "Ficha anestésica", caminho: CAMINHO },
];

const INDICE = [
  { id: "tres-fichas", titulo: "As três fichas" },
  { id: "intraoperatorio", titulo: "Ficha de anestesia" },
  { id: "recuperacao", titulo: "Recuperação pós-anestésica" },
  { id: "pre-anestesica", titulo: "Ficha pré-anestésica" },
  { id: "modelo", titulo: "Modelo para imprimir" },
  { id: "papel-ou-sistema", titulo: "Papel ou sistema" },
];

// Anexo III, letras e conteúdo do original.
const INTRAOPERATORIO: [string, string][] = [
  ["a", "Identificação do anestesista responsável e, se houver, o momento da transferência de responsabilidade durante o procedimento."],
  ["b", "Identificação do paciente."],
  ["c", "Horários de início e término do procedimento anestésico e do cirúrgico."],
  ["d", "Técnica de anestesia empregada."],
  ["e", "Equipamentos de monitorização utilizados e os resultados aferidos."],
  ["f", "Registro numérico dos parâmetros monitorizados, nos intervalos da tabela abaixo."],
  ["g", "Soluções e fármacos administrados, com momento, via e dose."],
  ["h", "Descrição sucinta das intercorrências e eventos adversos, associados ou não à anestesia, e das condutas tomadas."],
];

// Anexo IV.
const RECUPERACAO = [
  "Identificação do anestesiologista responsável e, se houver, o momento da transferência de responsabilidade na admissão à SRPA.",
  "Identificação do paciente.",
  "Horários da admissão e da alta.",
  "Recursos de monitorização adotados, por prescrição do anestesista.",
  "Consciência, pressão arterial, frequência cardíaca, saturação de oxigênio, temperatura, atividade motora e intensidade da dor, a intervalos de no máximo 15 minutos na primeira hora.",
  "Outros parâmetros, por prescrição do anestesista.",
  "Soluções e fármacos administrados, com momento, via e dose.",
  "Conduta do anestesista e intercorrências ou eventos adversos ocorridos na SRPA.",
];

/** Uma linha de preencher, com o rótulo em cima. */
function Campo({ rotulo, classe = "" }: { rotulo: string; classe?: string }) {
  return <div className={`fmCampo ${classe}`}><span>{rotulo}</span></div>;
}

/** Um bloco de várias linhas em branco, para texto corrido. */
function Bloco({ rotulo, linhas }: { rotulo: string; linhas: number }) {
  return (
    <div className="fmBloco">
      <span>{rotulo}</span>
      {Array.from({ length: linhas }, (_, i) => <i key={i} />)}
    </div>
  );
}

/** Opções para circular: "I  II  III  IV". */
function Opcoes({ rotulo, opcoes }: { rotulo: string; opcoes: string[] }) {
  return (
    <div className="fmOpcoes">
      <span>{rotulo}</span>
      {opcoes.map((o) => <b key={o}>{o}</b>)}
    </div>
  );
}

function ModeloDeFicha() {
  return (
    <div className="fichaModelo" aria-label="Modelo de ficha de avaliação pré-anestésica em branco">
      <div className="fmTopo">
        <strong>Ficha de avaliação pré-anestésica</strong>
        <span>Data da avaliação: ____/____/______</span>
      </div>

      <div className="fmLinha">
        <Campo rotulo="Paciente" classe="fmLargo" />
        <Campo rotulo="Nascimento" />
        <Campo rotulo="Sexo" classe="fmCurto" />
      </div>
      <div className="fmLinha">
        <Campo rotulo="Procedimento proposto" classe="fmLargo" />
        <Campo rotulo="Cirurgião" />
      </div>
      <div className="fmLinha">
        <Campo rotulo="Peso (kg)" /><Campo rotulo="Altura (m)" /><Campo rotulo="IMC (kg/m²)" />
        <Campo rotulo="PA (mmHg)" /><Campo rotulo="FC (bpm)" /><Campo rotulo="FR (irpm)" />
        <Campo rotulo="Temp. (°C)" /><Campo rotulo="Dor (0–10)" />
      </div>

      <Bloco rotulo="Diagnóstico cirúrgico e doenças associadas" linhas={2} />
      <Bloco rotulo="Antecedentes pessoais e familiares · cirurgias e anestesias anteriores" linhas={2} />
      <Bloco rotulo="Medicamentos de uso atual ou recente · conduta (manter / suspender em __ / __)" linhas={3} />
      <Bloco rotulo="Alergias (fármacos, látex) · efeitos adversos em anestesia na família · hipertermia" linhas={1} />
      <div className="fmLinha">
        <Campo rotulo="Tabagismo (cigarros/dia · anos)" /><Campo rotulo="Etilismo (frequência · quantidade)" />
        <Campo rotulo="Outros hábitos" />
      </div>

      <div className="fmSecao">Via aérea</div>
      <div className="fmLinha">
        <Opcoes rotulo="Mallampati" opcoes={["I", "II", "III", "IV"]} />
        <Campo rotulo="Abertura de boca (cm)" /><Campo rotulo="Dist. tireomentoniana (cm)" />
      </div>
      <div className="fmLinha">
        <Campo rotulo="Mobilidade atlanto-occipital" /><Campo rotulo="Dentes · prótese dentária" />
        <Campo rotulo="Circunferência cervical (cm)" />
      </div>

      <Bloco rotulo="Exame físico: cardiovascular · respiratório · outros sistemas com alteração" linhas={3} />
      <Bloco rotulo="Exames complementares (com data) e pareceres de especialistas" linhas={2} />

      <div className="fmLinha">
        <Opcoes rotulo="ASA" opcoes={["I", "II", "III", "IV", "V", "VI", "E"]} />
        <Campo rotulo="Jejum de sólidos (h)" /><Campo rotulo="Líquidos claros (h)" />
      </div>
      <Bloco rotulo="Medicação pré-anestésica · plano anestésico · orientações" linhas={2} />

      <div className="fmLinha fmAssinatura">
        <Campo rotulo="Anestesista" classe="fmLargo" /><Campo rotulo="CRM" /><Campo rotulo="RQE" />
        <Campo rotulo="Assinatura" classe="fmLargo" />
      </div>

      <p className="fmRodape">
        Itens do Anexo II da Resolução CFM nº 2.174/2017. Jejum mínimo: líquidos claros 2 h ·
        leite materno 4 h · leite não humano ou fórmula 6 h · refeição leve 6 h · dieta geral 8 h.
        Modelo livre de avanest.com.br.
      </p>
    </div>
  );
}

export default function FichaAnestesicaPage() {
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
        sobretitulo="DOCUMENTAÇÃO DA ANESTESIA"
        titulo="Ficha anestésica"
        resumo={"A anestesia é documentada em três fichas: a de avaliação pré-anestésica, a ficha "
          + "de anestesia do intraoperatório e a de recuperação pós-anestésica. Abaixo, o que a "
          + "Resolução CFM nº 2.174/2017 exige em cada uma, e um modelo da ficha pré-anestésica "
          + "para imprimir."}
        revisadoEm={REVISADO_EM}
        indice={INDICE}
        origem="ficha-anestesica"
        atual={CAMINHO}
        fim={{
          titulo: "A ficha pré-anestésica preenchida no celular e impressa no timbre do hospital.",
          texto: "O AVANEST faz a parte pré-anestésica da documentação: a ficha de avaliação, o "
            + "termo de consentimento e as orientações ao paciente. Tudo é salvo enquanto você "
            + "digita, os escores saem calculados e cada documento é impresso com o logo do "
            + "hospital do atendimento e a sua assinatura com CRM e RQE.",
        }}
      >
        <section className="recBloco" id="tres-fichas">
          <h2>As três fichas da anestesia</h2>
          <p>
            A resolução do CFM exige que a documentação mínima do procedimento anestésico registre
            a avaliação e a prescrição pré-anestésicas, a evolução clínica e o tratamento intra e
            pós-anestésico. Cada fase tem a sua ficha:
          </p>
          <div className="escTabela">
            <table>
              <thead>
                <tr><th>Ficha</th><th>Quando</th><th>O que registra</th><th>Norma</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>Avaliação pré-anestésica</strong></td>
                  <td>Antes da internação ou da entrada no centro cirúrgico</td>
                  <td>História, exame físico, via aérea, jejum, risco e prescrição pré-anestésica</td>
                  <td>Anexo II</td></tr>
                <tr><td><strong>Ficha de anestesia</strong></td>
                  <td>Durante o procedimento</td>
                  <td>Técnica, monitorização, parâmetros, fármacos e intercorrências</td>
                  <td>Anexo III</td></tr>
                <tr><td><strong>Recuperação pós-anestésica</strong></td>
                  <td>Da admissão à alta da SRPA</td>
                  <td>Consciência, sinais vitais, dor, atividade motora e condutas</td>
                  <td>Anexo IV</td></tr>
              </tbody>
            </table>
          </div>
          <p className="escNota">
            No texto da resolução, &quot;ficha anestésica&quot; é a do intraoperatório: é onde o
            anestesista registra o que a equipe da SRPA ou do CTI precisa para continuar o
            cuidado. No dia a dia o nome também é usado para a ficha de avaliação, e as duas fazem
            parte do mesmo prontuário.
          </p>
        </section>

        <section className="recBloco" id="intraoperatorio">
          <h2>O que a ficha de anestesia do intraoperatório deve conter</h2>
          <p>O Anexo III lista o conteúdo mínimo da ficha de anestesia:</p>
          <div className="escTabela">
            <table>
              <thead><tr><th>Item</th><th>O que registrar</th></tr></thead>
              <tbody>
                {INTRAOPERATORIO.map(([letra, texto]) => (
                  <tr key={letra}><td><strong>{letra})</strong></td><td>{texto}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="conteudoSubtitulo">De quanto em quanto tempo registrar</h3>
          <div className="escTabela">
            <table>
              <thead><tr><th>Intervalo máximo</th><th>Parâmetros</th></tr></thead>
              <tbody>
                <tr><td><strong>10 minutos</strong></td>
                  <td>Saturação da hemoglobina, gás carbônico expirado (quando usado), pressão
                      arterial, frequência cardíaca, temperatura e profundidade anestésica, quando
                      monitorizada pela atividade elétrica cerebral.</td></tr>
                <tr><td><strong>15 minutos</strong></td>
                  <td>Monitorização invasiva: pressão arterial média, pressão venosa central,
                      índice cardíaco, volume sistólico, variação do volume sistólico, delta PP e
                      outros dados hemodinâmicos.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="recBloco" id="recuperacao">
          <h2>Ficha de recuperação pós-anestésica</h2>
          <p>
            Pelo Anexo IV, a ficha da SRPA registra da admissão à alta, que é responsabilidade
            exclusiva de um anestesista ou do plantonista da sala de recuperação:
          </p>
          <ul className="recLista">
            {RECUPERACAO.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="recBloco" id="pre-anestesica">
          <h2>Ficha de avaliação pré-anestésica</h2>
          <p>
            É a mais longa das três e a única que pode ser feita antes do dia da cirurgia. São
            quinze itens no Anexo II, da identificação do anestesista à prescrição da medicação
            pré-anestésica, e ela anda junto com a estratificação de risco e o termo de
            consentimento. Os itens um a um, a tabela de jejum e os escores estão no guia de{" "}
            <Link href="/avaliacao-pre-anestesica">avaliação pré-anestésica</Link>.
          </p>
        </section>

        <section className="recBloco blocoDoModelo" id="modelo">
          <h2>Modelo de ficha de avaliação pré-anestésica para imprimir</h2>
          <p>
            Uma folha A4 com os itens do Anexo II, para usar no consultório ou no serviço. É livre:
            imprima, copie e adapte ao seu timbre.
          </p>
          <div className="avnActions fmAcoes">
            <BotaoImprimir rotulo="Imprimir o modelo" />
          </div>
          <ModeloDeFicha />
        </section>

        <section className="recBloco" id="papel-ou-sistema">
          <h2>Ficha anestésica no papel ou no sistema?</h2>
          <p>
            O papel funciona até o dia em que alguém precisa ler a ficha de outro colega, achar a
            de março ou reimprimir a orientação que o paciente perdeu. No sistema a ficha é
            legível, fica guardada no prontuário do paciente e sai de novo igual à original.
          </p>
          <p>
            O AVANEST cuida da parte pré-anestésica: a avaliação em nove etapas, com ASA, índice de
            Lee, STOP-Bang e Apfel calculados a partir do que já foi respondido; o termo de
            consentimento; e as orientações de jejum e de medicamentos que o paciente leva para
            casa. A ficha de anestesia do intraoperatório e a da recuperação continuam no
            prontuário do hospital.
          </p>
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
