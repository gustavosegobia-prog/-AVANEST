import type { Metadata } from "next";
import { ASA_CLASSES, ASA_EMERGENCIA } from "@/lib/escores";
import { PaginaDeEscore, dadosDeEscore } from "@/components/pagina-de-escore";

const CAMINHO = "/escores/classificacao-asa";
const REVISADO_EM = "2026-08-27";

export const metadata: Metadata = {
  title: "Classificação ASA: as seis classes com exemplos | AVANEST",
  description:
    "A classificação do estado físico da ASA, de I a VI, com a definição e exemplos de "
    + "cada classe — e o que o sufixo E de emergência muda (e o que não muda).",
  alternates: { canonical: CAMINHO },
};

export default function ClassificacaoAsaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dadosDeEscore({
          nome: "Classificação ASA do estado físico",
          descricao: "As seis classes da ASA, com definição e exemplos.",
          caminho: CAMINHO,
          revisadoEm: REVISADO_EM,
        })) }}
      />
      <PaginaDeEscore
        sobretitulo="ESCORES NA AVALIAÇÃO PRÉ-ANESTÉSICA"
        titulo="Classificação ASA"
        resumo="O estado físico do paciente em seis classes. Não é escore somado: é um julgamento clínico, e os exemplos servem para que colegas diferentes classifiquem parecido."
        atual={CAMINHO}
      >
        {/* Blocos, e não tabela. Três colunas não cabem em 390px, e a coluna que
            sairia da tela seria justamente a dos exemplos — que é o que a pessoa
            veio ler. Aqui cada classe empilha no celular e volta a ler como
            tabela no computador, sem rolagem lateral em nenhum dos dois. */}
        <section className="escCorpo">
          <dl className="escAsa">
            {ASA_CLASSES.map((c) => (
              <div className="escAsaItem" key={c.classe}>
                <dt>{c.classe}</dt>
                <dd>
                  <strong>{c.definicao}</strong>
                  <span>{c.exemplos}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="recBloco">
          <h2>O sufixo E</h2>
          <p>{ASA_EMERGENCIA}</p>
          <p className="escNota">
            É o ponto que mais se erra ao anotar: o E não sobe a classe. Somar emergência
            como se fosse gravidade transformaria um paciente saudável operado de urgência
            num ASA II, e a classificação deixaria de dizer o que se propõe — o estado
            físico do paciente, independentemente de quando ele vai para a sala.
          </p>
        </section>

        <section className="recBloco">
          <h2>O que a classificação não é</h2>
          <p>
            Ela não prediz risco cirúrgico. É uma descrição do estado físico, e só. Existe
            correlação entre classe alta e desfecho ruim, mas usar o ASA como estimativa
            de risco é forçar a barra: para risco cardíaco existe o{" "}
            <a href="/escores/indice-de-lee">índice de Lee</a>, que foi derivado e validado
            para isso.
          </p>
          <p>
            Ela também não considera o porte da cirurgia. Um ASA II para herniorrafia e um
            ASA II para duodenopancreatectomia recebem a mesma classe — porque a
            classificação fala do paciente, não do procedimento.
          </p>
        </section>

        <section className="recBloco">
          <h2>Por que a padronização importa</h2>
          <p>
            A classe ASA sai na ficha, entra no faturamento e às vezes decide se o caso vai
            para a lista do dia ou espera vaga de UTI. Se cada anestesiologista do serviço
            classificar de um jeito, o número perde a função de comunicar. É para isso que
            servem os exemplos acima, e é por isso que eles aparecem também dentro do
            AVANEST, na tela da avaliação — no momento em que a escolha é feita, não num
            manual que ninguém abre.
          </p>
        </section>

        <section className="recBloco">
          <h2>Referência</h2>
          <p className="escNota">
            American Society of Anesthesiologists. ASA Physical Status Classification
            System. Aprovada em 1962 e revisada; última revisão em 13 de dezembro de 2020.
          </p>
        </section>
      </PaginaDeEscore>
    </>
  );
}
