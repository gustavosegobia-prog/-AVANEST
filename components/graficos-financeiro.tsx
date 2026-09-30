"use client";

import { useMemo } from "react";
import { doMes as doMesDeReceita, type Receita } from "@/lib/receitas";
import {
  evolucaoFinanceira, recebimentosPorConvenio, situacaoDosAtendimentos, type MesDaEvolucao,
} from "@/lib/painel-financeiro";

// A área de análise do Resumo do Financeiro: três cartões.
//
// Sem biblioteca de gráficos, e não por economia: as três que serviriam pesam
// mais do que todo o resto do painel junto, e o que se desenha aqui é barra e
// coluna. Barra é uma div com largura em porcentagem. Em HTML ela é
// responsiva de graça, herda o tema escuro pelos mesmos tokens do resto do
// sistema e não exige medir texto na mão.
//
// As cores não foram escolhidas por gosto. Faturado, recebido e saldo usam
// --graf-1, --graf-2 e --graf-3, conferidas (claro e escuro) contra as três
// formas de daltonismo e contra o fundo pelo validador de paleta. Vermelho
// não aparece como série — fica reservado para estado. E todo valor vem
// escrito ou no tooltip e na tabela: cor sozinha nunca é a única leitura.
//
// Todas as contas vêm de lib/painel-financeiro.ts. `valor` formata dinheiro
// já pelo olho de esconder números.

const SERIES = [
  { chave: "faturado", rotulo: "Faturado", cor: "var(--graf-1)" },
  { chave: "recebido", rotulo: "Recebido", cor: "var(--graf-2)" },
  { chave: "saldo", rotulo: "Saldo", cor: "var(--graf-3)" },
] as const;

type Formatar = (n: number) => string;

function Legenda() {
  return (
    <div className="grafLegenda">
      {SERIES.map((s) => (
        <span key={s.chave}><i style={{ background: s.cor }} aria-hidden="true" />{s.rotulo}</span>
      ))}
    </div>
  );
}

// ── Recebimentos por convênio ──────────────────────────────────────────────

function RecebimentosPorConvenio({ receitasDoMes, valor }: { receitasDoMes: Receita[]; valor: Formatar }) {
  const linhas = recebimentosPorConvenio(receitasDoMes);
  return (
    <section className="grafCartao">
      <header>
        <h3>Recebimentos por convênio</h3>
        <p>Compare faturado, recebido e saldo pendente.</p>
      </header>
      {linhas.length === 0 ? (
        <div className="emptyClinical compactEmpty">Sem lançamentos nesta competência.</div>
      ) : (
        <ul className="pfConvenios">
          {linhas.map((l) => (
            <li key={l.rotulo}>
              <div className="pfConvenioNome">
                <strong title={l.rotulo}>{l.rotulo}</strong>
                <small>
                  {l.lancamentos} {l.lancamentos === 1 ? "lançamento" : "lançamentos"}
                  {l.semValor > 0 && <em className="pfSemValor"> · {l.semValor} sem valor</em>}
                </small>
              </div>
              {/* A pista mostra o quanto do faturado já entrou; os três números
                  ao lado dão a leitura exata. */}
              <div className="pfMedidor pequeno" role="img"
                aria-label={l.faturado > 0 ? `${Math.floor(Math.min(1, l.recebido / l.faturado) * 100)}% recebido` : "sem valor faturado"}>
                <div style={{ width: `${l.faturado > 0 ? Math.min(1, l.recebido / l.faturado) * 100 : 0}%` }} />
              </div>
              <dl className="pfConvenioNumeros">
                <div><dt>Faturado</dt><dd>{valor(l.faturado)}</dd></div>
                <div><dt>Recebido</dt><dd>{valor(l.recebido)}</dd></div>
                <div className={l.saldo > 0 ? "pendente" : ""}><dt>Saldo</dt><dd>{valor(l.saldo)}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Evolução financeira ────────────────────────────────────────────────────

function EvolucaoFinanceira({ meses, valor }: { meses: MesDaEvolucao[]; valor: Formatar }) {
  const maior = Math.max(...meses.map((m) => Math.max(m.faturado, m.recebido, m.saldo)), 0);
  const algumDado = meses.some((m) => m.estado !== "sem-dados");
  return (
    <section className="grafCartao">
      <header>
        <h3>Evolução financeira — últimos 6 meses</h3>
        <p>Faturado, recebido e saldo de cada competência.</p>
      </header>
      {!algumDado ? (
        <div className="emptyClinical compactEmpty">Ainda não há meses com registro para comparar.</div>
      ) : (
        <>
          <Legenda />
          <div className="grafColunas pfEvolucao">
            {meses.map((m) => {
              const resumo = m.estado === "sem-dados"
                ? `${m.rotuloLongo}: sem dados`
                : `${m.rotuloLongo}: faturado ${valor(m.faturado)}, recebido ${valor(m.recebido)}, saldo ${valor(m.saldo)}`;
              return (
                // O mês inteiro é o alvo do tooltip — maior que as colunas, e
                // alcançável pelo teclado.
                <div className={`grafMes ${m.estado}`} key={m.competencia} tabIndex={0} aria-label={resumo}>
                  <div className="grafPar">
                    {m.estado === "sem-dados" ? (
                      <span className="pfSemDados">sem dados</span>
                    ) : maior === 0 || m.estado === "sem-movimento" ? (
                      <span className="pfZero">R$ 0</span>
                    ) : (
                      SERIES.map((s) => {
                        const v = m[s.chave];
                        return <div className="grafColuna" key={s.chave}
                          style={{ height: `${v > 0 ? Math.max(2, (v / maior) * 100) : 0}%`, background: s.cor }} />;
                      })
                    )}
                  </div>
                  <span>{m.rotulo}</span>
                  <div className="pfTooltip" role="tooltip">
                    <b>{m.rotuloLongo}</b>
                    {m.estado === "sem-dados" ? (
                      <span>Nenhum registro neste mês</span>
                    ) : (
                      SERIES.map((s) => (
                        <span key={s.chave}><i style={{ background: s.cor }} aria-hidden="true" />
                          <strong>{valor(m[s.chave])}</strong> {s.rotulo.toLowerCase()}</span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <details className="pfComoTabela">
            <summary>Ver em tabela</summary>
            <table className="pfTabela">
              <thead><tr><th>Mês</th><th className="num">Faturado</th><th className="num">Recebido</th><th className="num">Saldo</th></tr></thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.competencia}>
                    <td>{m.rotuloLongo}</td>
                    {m.estado === "sem-dados"
                      ? <td className="num" colSpan={3}>sem dados</td>
                      : <><td className="num">{valor(m.faturado)}</td><td className="num">{valor(m.recebido)}</td><td className="num">{valor(m.saldo)}</td></>}
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

// ── Situação dos atendimentos ─────────────────────────────────────────────

/**
 * Realizados, faturados, quitados e o percentual concluído — mais a barra de
 * estados. Aqui a cor é estado, não série: verde quitado, âmbar parcial,
 * vermelho em aberto, cinza sem valor ou esperando lançamento. Cada faixa vai
 * com rótulo escrito.
 */
function SituacaoDosAtendimentos({ receitasDoMes, aguardandoLancamento }: {
  receitasDoMes: Receita[]; aguardandoLancamento: number;
}) {
  const s = situacaoDosAtendimentos(receitasDoMes, aguardandoLancamento);
  const faixas = [
    { rotulo: "Quitados", n: s.quitados, cor: "var(--cor-sucesso)" },
    { rotulo: "Parciais", n: s.parciais, cor: "var(--cor-atencao)" },
    { rotulo: "Em aberto", n: s.emAberto, cor: "var(--cor-perigo)" },
    { rotulo: "Sem valor", n: s.semValor, cor: "var(--cor-tinta-fraca)" },
    { rotulo: "Aguardando lançamento", n: s.aguardandoLancamento, cor: "var(--cor-borda-forte)" },
  ].filter((f) => f.n > 0);
  return (
    <section className="grafCartao">
      <header>
        <h3>Situação dos atendimentos</h3>
        <p>Do atendimento realizado até o dinheiro recebido.</p>
      </header>
      {s.realizados === 0 ? (
        <div className="emptyClinical compactEmpty">Nenhum atendimento nesta competência.</div>
      ) : (
        <>
          <dl className="pfEtapas">
            <div><dt>Realizados</dt><dd>{s.realizados}</dd></div>
            <div><dt>Faturados</dt><dd>{s.faturados}</dd></div>
            <div><dt>Quitados</dt><dd>{s.quitados}</dd></div>
            <div className="destaque"><dt>Concluído</dt><dd>{s.percentualConcluido}%</dd></div>
          </dl>
          <div className="grafPilha" role="img"
            aria-label={faixas.map((f) => `${f.rotulo}: ${f.n}`).join(", ")}>
            {faixas.map((f) => (
              <div key={f.rotulo} style={{ width: `${(f.n / s.realizados) * 100}%`, background: f.cor }}
                title={`${f.rotulo}: ${f.n} de ${s.realizados}`} />
            ))}
          </div>
          <div className="grafLegenda">
            {faixas.map((f) => (
              <span key={f.rotulo}><i style={{ background: f.cor }} aria-hidden="true" />{f.rotulo} · <b>{f.n}</b></span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function GraficosFinanceiro({
  receitas, periodo, competenciasComRegistro, aguardandoLancamento, valor,
}: {
  /**
   * TODAS as receitas do serviço — consulta e produção juntas —, de todos os
   * meses que existirem, e não só o período selecionado: a evolução olha
   * para trás do período. `Receita` é a fonte única que o resto do
   * Financeiro usa (lib/receitas.ts), para as telas não discordarem sobre o
   * mesmo mês.
   */
  receitas: Receita[];
  periodo: string;
  /** Meses que existem no sistema sem receita (período, despesa): esses são R$ 0, não "sem dados". */
  competenciasComRegistro: Set<string>;
  /** Atendimentos concluídos na competência que ainda não viraram lançamento. */
  aguardandoLancamento: number;
  valor: Formatar;
}) {
  const receitasDoMes = useMemo(() => doMesDeReceita(receitas, periodo), [receitas, periodo]);
  const meses = useMemo(
    () => evolucaoFinanceira(receitas, periodo, competenciasComRegistro),
    [receitas, periodo, competenciasComRegistro],
  );
  return (
    <div className="grafGrade pfAnalise">
      <RecebimentosPorConvenio receitasDoMes={receitasDoMes} valor={valor} />
      <EvolucaoFinanceira meses={meses} valor={valor} />
      <SituacaoDosAtendimentos receitasDoMes={receitasDoMes} aguardandoLancamento={aguardandoLancamento} />
    </div>
  );
}
