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
// O QUE O SISTEMA FAZ ESTÁ DITO COM TODAS AS LETRAS: a avaliação
// pré-anestésica e a ficha de anestesia do intraoperatório, no tablet, com a
// saída da sala. A ficha da recuperação pós-anestésica continua no prontuário
// do hospital. Página que promete o que o sistema não faz vira cancelamento na
// primeira semana.
//
// O MODELO PARA IMPRIMIR é o que faz esta página merecer o primeiro resultado:
// quem pesquisa "ficha anestésica" muitas vezes quer a folha, e as folhas estão
// aqui, sem cadastro: a do intraoperatório (Anexo III) e a pré-anestésica
// (Anexo II), cada uma com o seu botão de imprimir.

const CAMINHO = "/ficha-anestesica";
const REVISADO_EM = "2026-11-15";
const RESOLUCAO = "https://sistemas.cfm.org.br/normas/arquivos/resolucoes/BR/2017/2174_2017.pdf";

// O TÍTULO E A DESCRIÇÃO falam a língua da busca, não a do índice da página.
// No Search Console (90 dias até 15/11/2026) esta página apareceu 817 vezes,
// em média na 6ª posição, e teve 2,6% de cliques. As buscas que a trazem são
// "ficha anestésica", "ficha de anestesia modelo", "pdf para imprimir": quem
// pesquisa quer a folha. O título anterior ("o que deve conter, com modelo")
// prometia uma explicação e deixava o modelo para o fim. Word não entra no
// texto porque não há arquivo Word aqui — só o que a página entrega de fato.
const TITULO = "Ficha anestésica: modelo grátis para imprimir";
const DESCRICAO =
  "Modelos de ficha anestésica grátis (intraoperatório e pré-anestésica) para imprimir "
  + "ou salvar em PDF, sem cadastro, com os itens da Resolução CFM 2.174/2017.";

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
  { id: "modelo-intra", titulo: "Modelo da ficha de anestesia" },
  { id: "recuperacao", titulo: "Recuperação pós-anestésica" },
  { id: "pre-anestesica", titulo: "Ficha pré-anestésica" },
  { id: "modelo", titulo: "Modelo da ficha pré-anestésica" },
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

// A FOLHA DO INTRAOPERATÓRIO. Quem pesquisa "ficha de anestesia" quase sempre
// quer esta, e a página só tinha a da avaliação. Os itens são os do Anexo III
// (a até h); a grade cobre 4 horas em colunas de 10 minutos, que é o intervalo
// máximo da resolução para PA, FC, SpO₂, EtCO₂ e temperatura. Os horários do
// topo da grade ficam em branco: a folha serve para qualquer hora do dia.
const COLUNAS_DA_GRADE = 24;
const ESCALA_DA_GRADE = [220, 200, 180, 160, 140, 120, 100, 80, 60, 40, 20];
const LINHAS_NUMERICAS = ["SpO₂ (%)", "EtCO₂ (mmHg)", "Temp. (°C)", "BIS / profund."];
const LINHAS_DE_FARMACO = 7;

function LinhaDaGrade({ rotulo, classe = "" }: { rotulo: string; classe?: string }) {
  return (
    <tr className={classe}>
      <th scope="row">{rotulo}</th>
      {Array.from({ length: COLUNAS_DA_GRADE }, (_, i) => <td key={i} />)}
    </tr>
  );
}

function ModeloDeFichaIntraoperatoria() {
  return (
    <div className="fichaModelo fichaIntra" aria-label="Modelo de ficha de anestesia do intraoperatório em branco">
      <div className="fmTopo">
        <strong>Ficha de anestesia · intraoperatório</strong>
        <span>Data: ____/____/______ · Sala: ______</span>
      </div>

      <div className="fmLinha">
        <Campo rotulo="Paciente" classe="fmLargo" />
        <Campo rotulo="Nascimento" />
        <Campo rotulo="Sexo" classe="fmCurto" />
        <Campo rotulo="Registro" />
      </div>
      <div className="fmLinha">
        <Campo rotulo="Procedimento" classe="fmLargo" />
        <Campo rotulo="Cirurgião" />
        <Campo rotulo="Peso (kg)" classe="fmCurto" />
        <Opcoes rotulo="ASA" opcoes={["I", "II", "III", "IV", "V", "E"]} />
      </div>
      <div className="fmLinha">
        <Campo rotulo="Anestesista responsável · CRM" classe="fmLargo" />
        <Campo rotulo="Transferência de responsabilidade (hora · para quem)" classe="fmLargo" />
      </div>
      <div className="fmLinha">
        <Campo rotulo="Entrada na sala" /><Campo rotulo="Início anestesia" /><Campo rotulo="Início cirurgia" />
        <Campo rotulo="Fim cirurgia" /><Campo rotulo="Fim anestesia" /><Campo rotulo="Saída da sala" />
      </div>

      <div className="fmLinha">
        <Opcoes rotulo="Técnica" opcoes={["Geral bal.", "TIVA", "Raqui", "Peridural", "Bloqueio", "Sedação", "Local"]} />
      </div>
      <div className="fmLinha">
        <Opcoes rotulo="Via aérea" opcoes={["Máscara", "ML", "IOT", "Videolaring."]} />
        <Campo rotulo="Tubo nº · Cormack" /><Campo rotulo="Punção: nível · agulha" />
      </div>
      <div className="fmLinha">
        <Opcoes rotulo="Monitorização" opcoes={["ECG", "PANI", "PAI", "SpO₂", "EtCO₂", "Temp.", "BIS", "TOF", "PVC", "SVD"]} />
      </div>

      <div className="fmGradeRolagem" tabIndex={0} role="region" aria-label="Grade de registro do intraoperatório">
        <table className="fmGrade">
          <thead>
            <tr><th scope="col">Horário</th>{Array.from({ length: COLUNAS_DA_GRADE }, (_, i) => <th key={i} scope="col" />)}</tr>
          </thead>
          <tbody>
            {ESCALA_DA_GRADE.map((v, i) => (
              <LinhaDaGrade key={v} rotulo={String(v)} classe={i === 0 ? "fmGradeInicio" : ""} />
            ))}
            {LINHAS_NUMERICAS.map((r, i) => (
              <LinhaDaGrade key={r} rotulo={r} classe={i === 0 ? "fmGradeSeparador" : ""} />
            ))}
            {Array.from({ length: LINHAS_DE_FARMACO }, (_, i) => (
              <LinhaDaGrade key={`f${i}`} rotulo={i === 0 ? "Fármacos · infusões" : ""} classe={i === 0 ? "fmGradeSeparador fmGradeFarmaco" : "fmGradeFarmaco"} />
            ))}
            <LinhaDaGrade rotulo="Eventos (nº)" classe="fmGradeSeparador" />
          </tbody>
        </table>
      </div>
      <p className="fmLegenda">PAS ∨ · PAD ∧ · FC • · PAM ✕ — escreva a hora no topo das colunas (uma a cada 10 min).</p>

      <div className="fmLinha">
        <Campo rotulo="Cristaloide (mL)" /><Campo rotulo="Coloide (mL)" /><Campo rotulo="Hemocomponentes" />
        <Campo rotulo="Diurese (mL)" /><Campo rotulo="Sangramento (mL)" />
      </div>
      <Bloco rotulo="Eventos, intercorrências e condutas (nº · hora · descrição)" linhas={3} />
      <div className="fmLinha">
        <Opcoes rotulo="Destino" opcoes={["SRPA", "CTI", "Enfermaria"]} />
        <Campo rotulo="Condições na saída da sala" classe="fmLargo" />
      </div>

      <div className="fmLinha fmAssinatura">
        <Campo rotulo="Anestesista" classe="fmLargo" /><Campo rotulo="CRM" /><Campo rotulo="RQE" />
        <Campo rotulo="Assinatura" classe="fmLargo" />
      </div>

      <p className="fmRodape">
        Itens do Anexo III da Resolução CFM nº 2.174/2017. Registro a no máximo cada 10 min:
        SpO₂, EtCO₂ (quando usado), PA, FC, temperatura e profundidade anestésica (quando
        monitorizada); monitorização invasiva a cada 15 min. Modelo livre de avanest.com.br.
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
          + "Resolução CFM nº 2.174/2017 exige em cada uma, e modelos para imprimir da ficha de "
          + "anestesia do intraoperatório e da ficha pré-anestésica."}
        revisadoEm={REVISADO_EM}
        indice={INDICE}
        origem="ficha-anestesica"
        atual={CAMINHO}
        fim={{
          titulo: "A avaliação no celular e a ficha anestésica no tablet, dentro da sala.",
          texto: "O AVANEST faz a avaliação pré-anestésica, o termo de consentimento e as "
            + "orientações ao paciente, e também a ficha de anestesia do intraoperatório: você "
            + "toca no gráfico para lançar PA e FC e registra medicação, infusões, gases e "
            + "eventos. Tudo é salvo enquanto você trabalha, com autor e horário, e a folha sai "
            + "impressa em A4 no formato da ficha de papel.",
        }}
      >
        <section className="recBloco" id="tres-fichas">
          <h2>As três fichas da anestesia</h2>
          <p>
            A resolução do CFM exige que a documentação mínima do procedimento anestésico registre
            a avaliação e a prescrição pré-anestésicas, a evolução clínica e o tratamento intra e
            pós-anestésico. Cada fase tem a sua ficha:
          </p>
          <div className="escTabela" tabIndex={0} role="region" aria-label="Tabela: As três fichas da anestesia">
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
          <div className="escTabela" tabIndex={0} role="region" aria-label="Tabela: O que a ficha de anestesia do intraoperatório deve conter">
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
          <div className="escTabela" tabIndex={0} role="region" aria-label="Tabela: De quanto em quanto tempo registrar">
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

        <section className="recBloco blocoDoModelo" id="modelo-intra">
          <h2>Modelo de ficha de anestesia do intraoperatório para imprimir</h2>
          <p>
            Uma folha A4 com os itens do Anexo III: horários, técnica, monitorização, a grade de
            4 horas para PA, FC e os parâmetros a cada 10 minutos, fármacos, balanço e
            intercorrências. Livre para imprimir, copiar e adaptar. Para ter em PDF, escolha
            “Salvar como PDF” na janela de impressão.
          </p>
          <div className="avnActions fmAcoes">
            <BotaoImprimir rotulo="Imprimir a ficha de anestesia" alvo="intra" />
          </div>
          <ModeloDeFichaIntraoperatoria />
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
            imprima, copie e adapte ao seu timbre. Para ter em PDF, escolha “Salvar como PDF” na
            janela de impressão.
          </p>
          <div className="avnActions fmAcoes">
            <BotaoImprimir rotulo="Imprimir o modelo" alvo="pre" />
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
            O AVANEST cuida da avaliação pré-anestésica em nove etapas, com índice de Lee,
            STOP-Bang e Apfel calculados a partir do que já foi respondido, do termo de
            consentimento e das orientações de jejum e de medicamentos que o paciente leva para
            casa.
          </p>
          <p>
            A ficha de anestesia do intraoperatório é preenchida no tablet durante o caso e já
            começa com os dados da avaliação. As doses aparecem sugeridas pelo peso e pela idade
            para você conferir antes de registrar, e a saída da sala fica registrada com o destino
            e o Aldrete. A ficha da recuperação pós-anestésica continua no prontuário do hospital.
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
