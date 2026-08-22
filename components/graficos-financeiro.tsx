"use client";

import { useMemo } from "react";

// Gráficos do Financeiro.
//
// Sem biblioteca de gráficos, e não por economia: as três que serviriam pesam
// mais do que todo o resto do painel junto, e o que se desenha aqui é barra e
// coluna. Barra é uma div com largura em porcentagem. Em HTML ela é
// responsiva de graça, herda o tema escuro pelos mesmos tokens do resto do
// sistema e não exige medir texto na mão — coisas que em SVG dariam trabalho
// para ficar pior.
//
// As cores não foram escolhidas por gosto. Foram conferidas contra as três
// formas de daltonismo e contra o fundo, no claro e no escuro: nenhuma dupla
// vizinha fica indistinguível para quem não enxerga cor por completo. Por isso
// vermelho não aparece como série — ele fica reservado para glosa, que é
// estado, não categoria. E toda barra leva o valor escrito ao lado: cor sozinha
// nunca é a única forma de ler o gráfico.

const AZUL = "var(--graf-1)";
const VERDE = "var(--graf-2)";
const CATEGORIAS = ["var(--graf-1)", "var(--graf-2)", "var(--graf-3)", "var(--graf-4)"];

const money = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Lancamento = {
  convenio: string;
  valor: number;
  recebido: number;
  glosa_valor?: number;
  periodo?: string | null;
  created_at: string;
};
type Pagamento = { metodo: string; valor: number; paid_at: string };

function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="emptyClinical compactEmpty">{children}</div>;
}

function Legenda({ itens }: { itens: { rotulo: string; cor: string }[] }) {
  return (
    <div className="grafLegenda">
      {itens.map((i) => (
        <span key={i.rotulo}>
          <i style={{ background: i.cor }} aria-hidden="true" />
          {i.rotulo}
        </span>
      ))}
    </div>
  );
}

/**
 * Barras horizontais agrupadas: duas séries por linha.
 *
 * Horizontal, e não vertical, porque o rótulo é nome de convênio — "CISCOMCAM"
 * na vertical viraria texto deitado ou cortado.
 */
function BarrasPorCategoria({
  dados,
}: {
  dados: { rotulo: string; faturado: number; recebido: number }[];
}) {
  const maior = Math.max(...dados.map((d) => Math.max(d.faturado, d.recebido)), 0);
  if (!maior) return <Vazio>Sem valores lançados nesta competência.</Vazio>;

  return (
    <>
      <Legenda itens={[{ rotulo: "Faturado", cor: AZUL }, { rotulo: "Recebido", cor: VERDE }]} />
      <div className="grafBarras">
        {dados.map((d) => (
          <div className="grafLinha" key={d.rotulo}>
            <span className="grafRotulo" title={d.rotulo}>{d.rotulo}</span>
            <div className="grafTrilhas">
              {([["Faturado", d.faturado, AZUL], ["Recebido", d.recebido, VERDE]] as const).map(
                ([nome, valor, cor]) => (
                  <div className="grafTrilha" key={nome}>
                    {/* A pista existe para o valor ter coluna própria. Sem ela a
                        largura da barra era medida contra a linha inteira, e a
                        barra de 100% empurrava o número para fora da tela. */}
                    <div className="grafPista">
                      <div
                        className="grafBarra"
                        // minWidth 0 no zero: a barra tem um mínimo de 3px para
                        // que valor pequeno não suma, e sem esta linha o próprio
                        // zero ganhava um traço — "R$ 0,00" com barra desenhada.
                        style={{ width: `${maior ? (valor / maior) * 100 : 0}%`, background: cor, minWidth: valor > 0 ? undefined : 0 }}
                        // O título dá o detalhe no hover sem precisar de tooltip
                        // próprio, e é o que o leitor de tela anuncia.
                        title={`${nome}: ${money(valor)}`}
                      />
                    </div>
                    <b>{money(valor)}</b>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Colunas por mês, duas séries. Tempo lido da esquerda para a direita. */
function ColunasPorMes({
  dados,
}: {
  dados: { rotulo: string; faturado: number; recebido: number }[];
}) {
  const maior = Math.max(...dados.map((d) => Math.max(d.faturado, d.recebido)), 0);
  if (!maior) return <Vazio>Ainda não há meses com lançamento para comparar.</Vazio>;

  return (
    <>
      <Legenda itens={[{ rotulo: "Faturado", cor: AZUL }, { rotulo: "Recebido", cor: VERDE }]} />
      <div className="grafColunas">
        {dados.map((d) => (
          <div className="grafMes" key={d.rotulo}>
            <div className="grafPar">
              {([["Faturado", d.faturado, AZUL], ["Recebido", d.recebido, VERDE]] as const).map(
                ([nome, valor, cor]) => (
                  <div
                    className="grafColuna"
                    key={nome}
                    // min-height 2px: uma coluna de valor baixo mas não zero
                    // precisa aparecer, senão o mês parece vazio quando não é.
                    style={{
                      height: `${valor > 0 ? Math.max(2, (valor / maior) * 100) : 0}%`,
                      background: cor,
                    }}
                    title={`${nome} em ${d.rotulo}: ${money(valor)}`}
                  />
                ),
              )}
            </div>
            <span>{d.rotulo}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/** Uma série, várias categorias — aqui cada categoria ganha cor própria. */
function BarrasSimples({ dados }: { dados: { rotulo: string; valor: number }[] }) {
  const maior = Math.max(...dados.map((d) => d.valor), 0);
  if (!maior) return <Vazio>Nenhum recebimento registrado ainda.</Vazio>;

  return (
    <div className="grafBarras">
      {dados.map((d, i) => (
        <div className="grafLinha" key={d.rotulo}>
          <span className="grafRotulo">{d.rotulo}</span>
          <div className="grafTrilhas">
            <div className="grafTrilha">
              <div className="grafPista">
                <div
                  className="grafBarra"
                  style={{
                    width: `${(d.valor / maior) * 100}%`,
                    minWidth: d.valor > 0 ? undefined : 0,
                    // Cor por posição fixa, nunca ciclada: a quinta forma de
                    // pagamento não inventa um tom novo, cai no último.
                    background: CATEGORIAS[Math.min(i, CATEGORIAS.length - 1)],
                  }}
                  title={`${d.rotulo}: ${money(d.valor)}`}
                />
              </div>
              <b>{money(d.valor)}</b>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Situação da carteira numa barra só.
 *
 * Aqui a cor é estado, não categoria: verde quitado, âmbar parcial, vermelho em
 * aberto. Por isso usa a paleta de status do sistema e não a das séries — e por
 * isso cada faixa vai com rótulo escrito, nunca só a cor.
 */
function FaixaSituacao({ quitado, parcial, aberto }: { quitado: number; parcial: number; aberto: number }) {
  const total = quitado + parcial + aberto;
  if (!total) return <Vazio>Nenhum atendimento lançado.</Vazio>;

  const faixas = [
    { rotulo: "Quitados", n: quitado, cor: "var(--cor-sucesso)" },
    { rotulo: "Parciais", n: parcial, cor: "var(--cor-atencao)" },
    { rotulo: "Em aberto", n: aberto, cor: "var(--cor-perigo)" },
  ].filter((f) => f.n > 0);

  return (
    <>
      <div className="grafPilha">
        {faixas.map((f) => (
          <div
            key={f.rotulo}
            style={{ width: `${(f.n / total) * 100}%`, background: f.cor }}
            title={`${f.rotulo}: ${f.n} de ${total}`}
          />
        ))}
      </div>
      <div className="grafLegenda">
        {faixas.map((f) => (
          <span key={f.rotulo}>
            <i style={{ background: f.cor }} aria-hidden="true" />
            {f.rotulo} · <b>{f.n}</b> ({Math.round((f.n / total) * 100)}%)
          </span>
        ))}
      </div>
    </>
  );
}

export function GraficosFinanceiro({
  financeiro,
  pagamentos,
  periodo,
}: {
  financeiro: Lancamento[];
  pagamentos: Pagamento[];
  periodo: string;
}) {
  const dados = useMemo(() => {
    const doMes = financeiro.filter(
      (i) => (i.periodo || i.created_at.slice(0, 7)) === periodo,
    );

    // Por convênio, só os que têm valor — convênio zerado ocupa linha e não
    // informa nada.
    const porConvenio = Object.values(
      doMes.reduce<Record<string, { rotulo: string; faturado: number; recebido: number }>>((acc, i) => {
        const nome = i.convenio || "Particular";
        acc[nome] ??= { rotulo: nome, faturado: 0, recebido: 0 };
        acc[nome].faturado += Number(i.valor) || 0;
        acc[nome].recebido += Number(i.recebido) || 0;
        return acc;
      }, {}),
    )
      .filter((d) => d.faturado > 0 || d.recebido > 0)
      .sort((a, b) => b.faturado - a.faturado);

    // Últimos 6 meses terminando no que está selecionado, inclusive os vazios:
    // mês sem faturamento é informação, e pular faria a linha do tempo mentir.
    const [ano, mes] = periodo.split("-").map(Number);
    const meses: { rotulo: string; faturado: number; recebido: number; chave: string }[] = [];
    for (let k = 5; k >= 0; k--) {
      const d = new Date(Date.UTC(ano, (mes - 1) - k, 1));
      const chave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      meses.push({ chave, rotulo: MES_CURTO[d.getUTCMonth()], faturado: 0, recebido: 0 });
    }
    const indice = new Map(meses.map((m) => [m.chave, m]));
    for (const i of financeiro) {
      const alvo = indice.get(i.periodo || i.created_at.slice(0, 7));
      if (!alvo) continue;
      alvo.faturado += Number(i.valor) || 0;
      alvo.recebido += Number(i.recebido) || 0;
    }

    const porMetodo = Object.values(
      pagamentos
        .filter((p) => p.paid_at.slice(0, 7) === periodo)
        .reduce<Record<string, { rotulo: string; valor: number }>>((acc, p) => {
          const nome = p.metodo || "Outro";
          acc[nome] ??= { rotulo: nome, valor: 0 };
          acc[nome].valor += Number(p.valor) || 0;
          return acc;
        }, {}),
    ).sort((a, b) => b.valor - a.valor);

    let quitado = 0, parcial = 0, aberto = 0;
    for (const i of doMes) {
      const saldo = Number(i.valor) - Number(i.recebido);
      if (saldo <= 0) quitado++;
      else if (Number(i.recebido) > 0) parcial++;
      else aberto++;
    }

    const glosas = doMes.reduce((s, i) => s + (Number(i.glosa_valor) || 0), 0);
    const faturado = doMes.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const recebido = doMes.reduce((s, i) => s + (Number(i.recebido) || 0), 0);

    return { porConvenio, meses, porMetodo, quitado, parcial, aberto, glosas, faturado, recebido };
  }, [financeiro, pagamentos, periodo]);

  // A taxa de recebimento é a pergunta que o gráfico de convênio responde de
  // relance, então ela vem escrita antes dele em vez de precisar ser calculada
  // de cabeça a partir das barras.
  const taxa = dados.faturado > 0 ? Math.round((dados.recebido / dados.faturado) * 100) : null;

  return (
    <div className="grafGrade">
      <section className="grafCartao grafDestaque">
        <header>
          <h3>Quanto do faturado já entrou</h3>
          <p>Competência selecionada.</p>
        </header>
        {taxa === null ? (
          <Vazio>Sem faturamento nesta competência.</Vazio>
        ) : (
          <div className="grafNumeroHeroi">
            <strong>{taxa}%</strong>
            <span>
              {money(dados.recebido)} recebidos de {money(dados.faturado)} faturados
              {dados.glosas > 0 ? ` · ${money(dados.glosas)} em glosa` : ""}
            </span>
          </div>
        )}
      </section>

      <section className="grafCartao">
        <header>
          <h3>Faturado e recebido por convênio</h3>
          <p>Onde o dinheiro está preso.</p>
        </header>
        <BarrasPorCategoria dados={dados.porConvenio} />
      </section>

      <section className="grafCartao">
        <header>
          <h3>Últimos 6 meses</h3>
          <p>Faturamento e recebimento mês a mês.</p>
        </header>
        <ColunasPorMes dados={dados.meses} />
      </section>

      <section className="grafCartao">
        <header>
          <h3>Situação dos atendimentos</h3>
          <p>Quantos já foram quitados na competência.</p>
        </header>
        <FaixaSituacao quitado={dados.quitado} parcial={dados.parcial} aberto={dados.aberto} />
      </section>

      <section className="grafCartao">
        <header>
          <h3>Formas de recebimento</h3>
          <p>Como o dinheiro entrou na competência.</p>
        </header>
        <BarrasSimples dados={dados.porMetodo} />
      </section>
    </div>
  );
}
