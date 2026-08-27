import type { Metadata } from "next";
import { CalculadoraDeEscore } from "@/components/calculadora-de-escore";
import { PaginaDeEscore, dadosDeEscore } from "@/components/pagina-de-escore";

const CAMINHO = "/escores/apfel";
const REVISADO_EM = "2026-08-27";

export const metadata: Metadata = {
  title: "Escore de Apfel: risco de náusea e vômito pós-operatório | AVANEST",
  description:
    "Calculadora do escore de Apfel para NVPO: os quatro fatores, a incidência esperada "
    + "de cada total e como a profilaxia costuma acompanhar o número.",
  alternates: { canonical: CAMINHO },
};

export default function ApfelPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosDeEscore({
          nome: "Escore de Apfel — calculadora e interpretação",
          descricao: "Risco de náusea e vômito no pós-operatório (NVPO).",
          caminho: CAMINHO,
          revisadoEm: REVISADO_EM,
        })) }}
      />
      <PaginaDeEscore
        sobretitulo="ESCORES NA AVALIAÇÃO PRÉ-ANESTÉSICA"
        titulo="Escore de Apfel"
        resumo="Risco de náusea e vômito no pós-operatório. Marque os fatores presentes — a conta é feita no seu navegador e nada é enviado nem guardado."
        atual={CAMINHO}
      >
        <section className="escCorpo">
          <CalculadoraDeEscore qual="apfel" />
        </section>

        <section className="recBloco">
          <h2>Para que serve</h2>
          <p>
            Náusea e vômito no pós-operatório é a queixa que mais estraga a lembrança de
            uma anestesia bem conduzida. Para o paciente, foi o pior da cirurgia. O escore
            de Apfel serve para decidir <em>antes</em> quanta profilaxia vale a pena — em
            vez de tratar depois, com o paciente já vomitando na recuperação.
          </p>
          <p>
            São quatro fatores, cada um valendo um ponto, e a graça do escore está na
            simplicidade: nenhum deles depende de exame.
          </p>
        </section>

        <section className="recBloco">
          <h2>Como ler o resultado</h2>
          <div className="escTabela">
            <table>
              <thead>
                <tr><th>Fatores</th><th>Incidência esperada de NVPO</th></tr>
              </thead>
              <tbody>
                <tr><td>0</td><td>≈ 10%</td></tr>
                <tr><td>1</td><td>≈ 21%</td></tr>
                <tr><td>2</td><td>≈ 39%</td></tr>
                <tr><td>3</td><td>≈ 61%</td></tr>
                <tr><td>4</td><td>≈ 79%</td></tr>
              </tbody>
            </table>
          </div>
          <p className="escNota">
            A regra prática que acompanha o escore na literatura é somar um antiemético de
            classe diferente por fator de risco. Dois e três fatores costumam pedir
            profilaxia combinada; quatro fatores costumam pedir, além dela, revisar a
            própria técnica anestésica — anestesia venosa total com propofol e economia de
            opioide reduzem o risco de base, coisa que nenhum antiemético faz.
          </p>
        </section>

        <section className="recBloco">
          <h2>Dois dos quatro fatores o sistema já sabe</h2>
          <p>
            Sexo feminino vem do cadastro; não ser tabagista vem dos hábitos, na anamnese.
            No AVANEST esses dois se marcam sozinhos e aparecem travados, dizendo de onde
            vieram. Sobram os dois que dependem do caso: história prévia de NVPO ou
            cinetose, e a previsão de opioide no pós-operatório.
          </p>
        </section>

        <section className="recBloco">
          <h2>Referência</h2>
          <p className="escNota">
            Apfel CC, Läärä E, Koivuranta M, Greim CA, Roewer N. A simplified risk score
            for predicting postoperative nausea and vomiting. <em>Anesthesiology</em>.
            1999;91(3):693–700.
          </p>
        </section>
      </PaginaDeEscore>
    </>
  );
}
