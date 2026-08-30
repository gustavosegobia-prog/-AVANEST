import type { Metadata } from "next";
import { comoJson, migalhas } from "@/lib/schema";
import { CalculadoraDeEscore } from "@/components/calculadora-de-escore";
import { PaginaDeEscore, dadosDeEscore } from "@/components/pagina-de-escore";

const CAMINHO = "/escores/stop-bang";
const TRILHA = [
  { nome: "Início", caminho: "/" },
  { nome: "Escores", caminho: "/escores" },
  { nome: "STOP-Bang", caminho: CAMINHO },
];
const REVISADO_EM = "2026-08-27";

export const metadata: Metadata = {
  title: "STOP-Bang: calculadora e interpretação | AVANEST",
  description:
    "Calculadora do STOP-Bang para rastreio de apneia obstrutiva do sono antes da "
    + "cirurgia: os oito critérios, os pontos de corte e o que fazer com o resultado.",
  alternates: { canonical: CAMINHO },
};

export default function StopBangPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosDeEscore({
          nome: "STOP-Bang — calculadora e interpretação",
          descricao: "Rastreio de apneia obstrutiva do sono na avaliação pré-anestésica.",
          caminho: CAMINHO,
          revisadoEm: REVISADO_EM,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: comoJson(migalhas(TRILHA)) }}
      />
      <PaginaDeEscore
        sobretitulo="ESCORES NA AVALIAÇÃO PRÉ-ANESTÉSICA"
        titulo="STOP-Bang"
        resumo="Rastreio de apneia obstrutiva do sono. Marque os critérios presentes — a conta é feita no seu navegador e nada é enviado nem guardado."
        atual={CAMINHO}
      >
        <section className="escCorpo">
          <CalculadoraDeEscore qual="stop-bang" />
        </section>

        <section className="recBloco">
          <h2>Para que serve</h2>
          <p>
            A apneia obstrutiva do sono muda a anestesia: aumenta o risco de via aérea
            difícil, de dessaturação na indução e de eventos respiratórios na recuperação
            — e boa parte dos portadores chega ao centro cirúrgico sem diagnóstico. O
            STOP-Bang existe para achar essa gente com oito perguntas, sem exigir
            polissonografia.
          </p>
          <p>
            O nome é a sigla das iniciais em inglês: <strong>S</strong>noring,{" "}
            <strong>T</strong>iredness, <strong>O</strong>bserved apnea,{" "}
            <strong>P</strong>ressure, <strong>B</strong>MI, <strong>A</strong>ge,{" "}
            <strong>N</strong>eck, <strong>G</strong>ender. Cada resposta afirmativa vale
            um ponto.
          </p>
        </section>

        <section className="recBloco">
          <h2>Como ler o resultado</h2>
          <div className="escTabela">
            <table>
              <thead>
                <tr><th>Pontos</th><th>Risco</th><th>O que costuma decorrer</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>0 a 2</td><td>Baixo</td>
                  <td>Conduta habitual.</td>
                </tr>
                <tr>
                  <td>3 a 4</td><td>Intermediário</td>
                  <td>Vale registrar e considerar cuidado extra com via aérea e com
                      opioide no pós-operatório.</td>
                </tr>
                <tr>
                  <td>5 a 8</td><td>Alto</td>
                  <td>Alta probabilidade de apneia moderada a grave. Planejar via aérea,
                      poupar opioide, prever monitorização prolongada na recuperação e
                      pesar investigação antes de cirurgia eletiva.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="escNota">
            Um detalhe que muda a leitura: o escore foi desenhado para ser sensível, não
            específico. Pontuação alta não fecha diagnóstico — ela diz que vale a pena
            tratar o caso como se houvesse apneia até que se prove o contrário. É por isso
            que ele é útil na véspera da cirurgia, quando não dá tempo de investigar.
          </p>
        </section>

        {/* As seções abaixo são escritas em forma de PERGUNTA de propósito.
            A marcação FAQPage não vale mais nada — o Google encerrou o suporte
            em junho de 2026 — mas o formato continua valendo, porque é assim
            que a pessoa digita: ninguém pesquisa "STOP-Bang critérios", pesquisa
            "como calcular stop bang". O título da seção é o que casa com a busca. */}
        <section className="recBloco">
          <h2>Como calcular o STOP-Bang?</h2>
          <p>
            São oito perguntas de sim ou não. Cada &quot;sim&quot; vale um ponto, e o
            total vai de 0 a 8. Quatro vêm da conversa e quatro do próprio cadastro:
          </p>
          <div className="escTabela">
            <table>
              <thead>
                <tr><th>Letra</th><th>Critério</th><th>Como conferir</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>S</strong>noring</td><td>Ronco alto</td>
                  <td>Mais alto que uma conversa, ou audível com a porta fechada. Quem
                      responde melhor é quem dorme junto.</td></tr>
                <tr><td><strong>T</strong>iredness</td><td>Cansaço diurno</td>
                  <td>Sonolência ou fadiga na maior parte dos dias, mesmo dormindo o
                      suficiente.</td></tr>
                <tr><td><strong>O</strong>bserved</td><td>Apneia presenciada</td>
                  <td>Alguém já viu o paciente parar de respirar, engasgar ou sufocar
                      dormindo.</td></tr>
                <tr><td><strong>P</strong>ressure</td><td>Hipertensão</td>
                  <td>Diagnóstico de hipertensão, <em>em tratamento ou não</em>. Estar
                      controlado com remédio não zera o ponto.</td></tr>
                <tr><td><strong>B</strong>MI</td><td>IMC acima de 35 kg/m²</td>
                  <td>Calculado do peso e da altura já registrados.</td></tr>
                <tr><td><strong>A</strong>ge</td><td>Idade acima de 50 anos</td>
                  <td>Do cadastro.</td></tr>
                <tr><td><strong>N</strong>eck</td><td>Circunferência cervical acima de 40 cm</td>
                  <td>Medida na altura da cartilagem tireoide. É a única do bloco que
                      exige a fita — e a mais esquecida.</td></tr>
                <tr><td><strong>G</strong>ender</td><td>Sexo masculino</td>
                  <td>Do cadastro.</td></tr>
              </tbody>
            </table>
          </div>
          <p className="escNota">
            Atenção ao <strong>P</strong>: a pergunta é sobre o diagnóstico, não sobre a
            pressão do dia. Paciente hipertenso com pressão normal na consulta pontua
            igual. É o erro mais comum na aplicação à mão, e some quando o critério é
            lido do cadastro.
          </p>
        </section>

        <section className="recBloco">
          <h2>Quando o STOP-Bang não responde a pergunta</h2>
          <p>
            Ele foi validado em população cirúrgica adulta, para rastrear apneia
            obstrutiva. Fora disso, o número perde sentido:
          </p>
          <ul className="recLista">
            <li>
              <strong>Em quem já tem diagnóstico.</strong> Paciente com polissonografia
              feita ou em uso de CPAP não precisa ser rastreado — a informação que
              importa é a adesão ao aparelho e a pressão usada, não o escore.
            </li>
            <li>
              <strong>Em criança.</strong> Os pontos de corte são de adulto. Apneia
              pediátrica tem outra história natural e outros instrumentos.
            </li>
            <li>
              <strong>Para apneia central.</strong> O escore rastreia obstrução de via
              aérea superior. Apneia de origem central não é o alvo dele.
            </li>
            <li>
              <strong>Como diagnóstico.</strong> Oito respondidas não substituem
              polissonografia — e o escore não foi feito para isso.
            </li>
          </ul>
        </section>

        <section className="recBloco">
          <h2>Resultado alto na véspera: o que muda de verdade</h2>
          <p>
            A pergunta prática raramente é &quot;adia ou não adia&quot;. Na maior parte
            das vezes a cirurgia acontece, e o que o escore alto compra é <em>preparo</em>:
          </p>
          <ul className="recLista">
            <li>
              <strong>Via aérea.</strong> Tratar como potencialmente difícil: plano B
              definido antes da indução, material à mão, e considerar a posição de rampa
              em quem tem IMC alto.
            </li>
            <li>
              <strong>Opioide com parcimônia.</strong> É o ponto de maior impacto no
              pós-operatório. Analgesia multimodal e bloqueio, quando couber, reduzem a
              dose necessária.
            </li>
            <li>
              <strong>Recuperação mais longa e observada.</strong> Os eventos
              respiratórios se concentram nas primeiras horas e no sono do pós-operatório.
            </li>
            <li>
              <strong>CPAP próprio.</strong> Quem já usa em casa deve trazer o aparelho.
              Parece detalhe e é a intervenção mais barata da lista.
            </li>
          </ul>
          <p className="escNota">
            Nada disso é protocolo — é o conjunto de decisões que um escore alto costuma
            antecipar. A conduta é de quem está com o paciente.
          </p>
        </section>

        <section className="recBloco">
          <h2>Os quatro critérios que você não precisa perguntar</h2>
          <p>
            Metade do STOP-Bang já está no cadastro e no exame físico: idade acima de 50,
            sexo masculino, IMC acima de 35 e circunferência cervical acima de 40 cm. No
            AVANEST esses quatro se marcam sozinhos a partir do que já foi preenchido, e
            aparecem travados na tela — mostrando de onde veio cada um. Quem digita duas
            vezes o mesmo dado acaba digitando diferente.
          </p>
        </section>

        <section className="recBloco">
          <h2>Referência</h2>
          <p className="escNota">
            Chung F, Yegneswaran B, Liao P, et al. STOP questionnaire: a tool to screen
            patients for obstructive sleep apnea. <em>Anesthesiology</em>. 2008;108(5):812–821.
          </p>
          <p className="escNota">
            Chung F, Abdullah HR, Liao P. STOP-Bang Questionnaire: a practical approach to
            screen for obstructive sleep apnea. <em>Chest</em>. 2016;149(3):631–638.
          </p>
        </section>

        <section className="recBloco">
          <h2>Sobre esta página</h2>
          <p className="escNota">
            Ferramenta de apoio à decisão, escrita para anestesiologistas. Não substitui
            avaliação clínica, e a conduta é sempre de quem está com o paciente. Os
            pontos de corte seguem as publicações citadas acima; revisada em{" "}
            {new Date(REVISADO_EM).toLocaleDateString("pt-BR")}.
          </p>
        </section>
      </PaginaDeEscore>
    </>
  );
}
