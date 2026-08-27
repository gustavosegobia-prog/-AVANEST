import type { Metadata } from "next";
import { CalculadoraDeEscore } from "@/components/calculadora-de-escore";
import { PaginaDeEscore, dadosDeEscore } from "@/components/pagina-de-escore";

const CAMINHO = "/escores/indice-de-lee";
const REVISADO_EM = "2026-08-27";

export const metadata: Metadata = {
  title: "Índice de Lee (RCRI): calculadora de risco cardíaco | AVANEST",
  description:
    "Calculadora do índice de Lee para risco cardíaco em cirurgia não cardíaca: os seis "
    + "critérios do RCRI, a classe e a taxa de evento cardíaco maior de cada total.",
  alternates: { canonical: CAMINHO },
};

export default function IndiceDeLeePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosDeEscore({
          nome: "Índice de Lee (RCRI) — calculadora e interpretação",
          descricao: "Risco de evento cardíaco maior em cirurgia não cardíaca.",
          caminho: CAMINHO,
          revisadoEm: REVISADO_EM,
        })) }}
      />
      <PaginaDeEscore
        sobretitulo="ESCORES NA AVALIAÇÃO PRÉ-ANESTÉSICA"
        titulo="Índice de Lee (RCRI)"
        resumo="Risco de evento cardíaco maior em cirurgia não cardíaca. Marque os critérios presentes — a conta é feita no seu navegador e nada é enviado nem guardado."
        atual={CAMINHO}
      >
        <section className="escCorpo">
          <CalculadoraDeEscore qual="lee" />
        </section>

        <section className="recBloco">
          <h2>Para que serve</h2>
          <p>
            O RCRI — <em>Revised Cardiac Risk Index</em>, ou índice de Lee — estima a
            chance de infarto, parada cardíaca ou bloqueio total durante e logo depois de
            uma cirurgia não cardíaca. É o escore que sustenta a conversa com o
            cardiologista: em vez de “o paciente é hipertenso, pode operar?”, ele permite
            dizer “classe III, risco em torno de 6,6%, o que o senhor sugere”.
          </p>
          <p>
            São seis critérios, cada um valendo exatamente um ponto. Nenhum pesa mais que
            os outros — é o que faz o escore ser fácil de somar de cabeça.
          </p>
        </section>

        <section className="recBloco">
          <h2>Como ler o resultado</h2>
          <div className="escTabela">
            <table>
              <thead>
                <tr><th>Pontos</th><th>Classe</th><th>Evento cardíaco maior</th></tr>
              </thead>
              <tbody>
                <tr><td>0</td><td>I</td><td>≈ 0,4%</td></tr>
                <tr><td>1</td><td>II</td><td>≈ 0,9%</td></tr>
                <tr><td>2</td><td>III</td><td>≈ 6,6%</td></tr>
                <tr><td>3 ou mais</td><td>IV</td><td>≈ 11%</td></tr>
              </tbody>
            </table>
          </div>
          <p className="escNota">
            De três pontos em diante tudo cai na classe IV. Não é arredondamento: a coorte
            original não separou três de seis critérios, e uma quinta faixa inventada aqui
            daria a um número um respaldo que ele não tem.
          </p>
        </section>

        <section className="recBloco">
          <h2>O que conta como cirurgia de alto risco</h2>
          <p>
            É o primeiro critério, e o que mais gera dúvida. No RCRI original significa
            cirurgia <strong>intraperitoneal</strong>, <strong>intratorácica</strong> ou{" "}
            <strong>vascular suprainguinal</strong>. Note o que fica de fora: procedimento
            de superfície, endoscopia, catarata e cirurgia de mama não entram, por maior
            que seja o porte aparente.
          </p>
        </section>

        <section className="recBloco">
          <h2>O erro mais comum</h2>
          <p>
            Tratar o parecer do cardiologista como se fosse ponto do escore. Ele não é: o
            RCRI é um índice fechado de seis critérios, e acrescentar “liberado com
            ressalvas” como sétimo item inventa um número que a literatura não sustenta.
            O parecer entra na decisão, não na soma — e é assim que o AVANEST guarda os
            dois: o escore de um lado, o parecer e a observação do cardiologista do outro,
            cada um com o seu peso.
          </p>
        </section>

        <section className="recBloco">
          <h2>Referência</h2>
          <p className="escNota">
            Lee TH, Marcantonio ER, Mangione CM, et al. Derivation and prospective
            validation of a simple index for prediction of cardiac risk of major
            noncardiac surgery. <em>Circulation</em>. 1999;100(10):1043–1049.
          </p>
        </section>
      </PaginaDeEscore>
    </>
  );
}
