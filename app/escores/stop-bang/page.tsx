import type { Metadata } from "next";
import { CalculadoraDeEscore } from "@/components/calculadora-de-escore";
import { PaginaDeEscore, dadosDeEscore } from "@/components/pagina-de-escore";

const CAMINHO = "/escores/stop-bang";
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
        </section>
      </PaginaDeEscore>
    </>
  );
}
