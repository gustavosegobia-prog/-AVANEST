"use client";

import { useEffect, useRef } from "react";
import { Icone } from "@/components/icone";
import type {
  Composicao, EstadoDoFechamento, Pendencia, TipoDeComposicao,
} from "@/lib/painel-financeiro";
import { nomeDaCompetencia } from "@/lib/painel-financeiro";

// As peças do "Resumo" do Financeiro.
//
// Nenhuma conta mora aqui: tudo chega pronto de lib/painel-financeiro.ts, e
// o que estes componentes decidem é só COMO mostrar. `valor` é a função que
// formata dinheiro já passando pelo olho de esconder números — nenhum valor
// deste arquivo aparece sem passar por ela.

type Formatar = (n: number) => string;

const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
/** "2026-09" → "09/2026". */
const mesBr = (competencia: string) => competencia.split("-").reverse().join("/");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// ── Contexto da competência ────────────────────────────────────────────────

const HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

/**
 * A linha que diz de ONDE são os números: organização, escopo, competência,
 * situação do mês e a hora em que os dados foram lidos.
 *
 * "Todos os hospitais", e não um hospital: o Financeiro soma a organização
 * inteira — a produção anestésica nem guarda o hospital. Escrever o nome do
 * local ativo aqui poria um rótulo de hospital em cima de números que não
 * são daquele hospital.
 *
 * A hora vem do servidor (o momento em que a página leu o banco) e é
 * formatada no fuso de Brasília dos dois lados, para o HTML do servidor e o
 * do navegador saírem iguais.
 */
export function ContextoDaCompetencia({
  organizacao, competencia, estado, carregadoEm, onAtualizar,
}: {
  organizacao: string | null;
  competencia: string;
  estado: EstadoDoFechamento;
  carregadoEm: string | null;
  onAtualizar: () => void;
}) {
  const situacao = {
    "fechado": { texto: "Mês fechado", classe: "ok" },
    "sem-movimento": { texto: "Sem movimento", classe: "neutro" },
    "em-andamento": { texto: "Em andamento", classe: "info" },
    "perto-do-fim": { texto: "Fechamento próximo", classe: "atencao" },
    "atrasado": { texto: "Fechamento atrasado", classe: "perigo" },
  }[estado.tipo];
  return (
    <div className="pfContexto" aria-label="Contexto dos números">
      {organizacao && <span className="pfContextoItem"><small>Organização</small><b>{organizacao}</b></span>}
      <span className="pfContextoItem"><small>Hospitais</small><b>Todos</b></span>
      <span className="pfContextoItem"><small>Competência</small><b>{nomeDaCompetencia(competencia)}</b></span>
      <span className={`pfSituacao ${situacao.classe}`}>{situacao.texto}</span>
      {carregadoEm && (
        <span className="pfAtualizado">
          Atualizado em {HORA.format(new Date(carregadoEm))}
          <button type="button" onClick={onAtualizar}>Atualizar</button>
        </span>
      )}
    </div>
  );
}

// ── Os quatro números ──────────────────────────────────────────────────────

export type Indicador = {
  tipo: TipoDeComposicao;
  rotulo: string;
  valor: number;
  secundaria: string;
  /** O estado lido pela cor da borda e pelo selo — nunca só pela cor. */
  estado: "ok" | "info" | "atencao" | "perigo" | "neutro";
  selo?: string;
  extra?: React.ReactNode;
};

/**
 * Recebido | A receber | Vencido | Faturado.
 *
 * Cada cartão é um botão, mas não se veste de botão: o realce só aparece ao
 * passar o mouse ou focar pelo teclado. Clicar abre a composição do número.
 */
export function IndicadoresPrincipais({
  indicadores, valor, onAbrir,
}: {
  indicadores: Indicador[];
  valor: Formatar;
  onAbrir: (tipo: TipoDeComposicao) => void;
}) {
  return (
    <section className="pfKpis" aria-label="Indicadores da competência">
      {indicadores.map((k) => (
        <button type="button" key={k.tipo} className={`pfKpi ${k.estado}`} onClick={() => onAbrir(k.tipo)}
          aria-label={`${k.rotulo}: ${valor(k.valor)}. ${k.secundaria}. Abrir a composição.`}>
          <span className="pfKpiTopo">
            <span>{k.rotulo}</span>
            {k.selo && <i className={`pfSelo ${k.estado}`}>{k.selo}</i>}
          </span>
          <strong>{valor(k.valor)}</strong>
          <small>{k.secundaria}</small>
          {k.extra}
        </button>
      ))}
    </section>
  );
}

// ── Atenção hoje ──────────────────────────────────────────────────────────

const ROTULO_PRIORIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;

/**
 * As pendências acionáveis — uma linha cada, com prioridade, o que está em
 * jogo e o botão da ação. Tudo em dia vira uma linha só, não um bloco.
 */
export function AtencaoHoje({
  pendencias, valor, onIr,
}: {
  pendencias: Pendencia[];
  valor: Formatar;
  onIr: (tarefa: string, periodo?: string) => void;
}) {
  if (pendencias.length === 0) {
    return (
      <section className="pfCartao pfAtencaoVazia" aria-label="Atenção hoje">
        <Icone nome="confirmado" tamanho={18} />
        <span><strong>Tudo em dia.</strong> Nenhuma pendência nas contas, notas ou fechamento.</span>
      </section>
    );
  }
  return (
    <section className="pfCartao pfAtencao" aria-labelledby="pf-atencao-titulo">
      <header className="pfCartaoTopo">
        <h2 id="pf-atencao-titulo">Atenção hoje</h2>
        <span>{plural(pendencias.length, "pendência", "pendências")}</span>
      </header>
      <ul>
        {pendencias.map((p) => (
          <li key={p.chave} className={`pfPendencia ${p.prioridade}`}>
            <i className={`pfPrioridade ${p.prioridade}`}>{ROTULO_PRIORIDADE[p.prioridade]}</i>
            <span className="pfPendenciaTexto">
              <strong>{p.titulo}</strong>
              <small>
                {p.detalhe}{" "}
                <b className="pfImpacto">
                  {p.impacto.valor !== null ? `${valor(p.impacto.valor)} ` : ""}{p.impacto.texto}
                </b>
              </small>
            </span>
            <button type="button" className="outlineClinical" onClick={() => onIr(p.tarefa, p.periodo)}>{p.acao}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Recebimento da competência ────────────────────────────────────────────

export function RecebimentoDaCompetencia({
  faturado, recebido, glosado, valor, onVerRecebimentos,
}: {
  faturado: number; recebido: number; glosado: number;
  valor: Formatar;
  onVerRecebimentos: () => void;
}) {
  const falta = Math.max(0, faturado - recebido);
  // A largura usa a fração exata: 99,6% não pode desenhar a barra cheia.
  const fracao = faturado > 0 ? Math.min(1, recebido / faturado) : 0;
  const pct = faturado > 0 ? Math.floor(fracao * 100) : null;
  return (
    <section className="pfCartao pfRecebimento" aria-labelledby="pf-receb-titulo">
      <header className="pfCartaoTopo">
        <h2 id="pf-receb-titulo">Recebimento da competência</h2>
        <button type="button" className="outlineClinical" onClick={onVerRecebimentos}>Ver recebimentos</button>
      </header>
      {pct === null ? (
        <p className="pfVazio">Sem faturamento nesta competência.</p>
      ) : (
        <div className="pfRecebimentoCorpo">
          <p className="pfRecebimentoValor"><strong>{valor(recebido)}</strong> de {valor(faturado)}</p>
          <div className="pfMedidor" role="img" aria-label={`${pct}% recebido`}>
            <div style={{ width: `${fracao * 100}%` }} />
          </div>
          <p className="pfRecebimentoLegenda">
            <b>{pct}% recebido</b>
            <span>
              {falta > 0 ? `${valor(falta)} pendente` : "Nada pendente"}
              {glosado > 0 ? ` · ${valor(glosado)} em glosa` : ""}
            </span>
          </p>
        </div>
      )}
    </section>
  );
}

// ── Área inferior ─────────────────────────────────────────────────────────

type Vencimentos = {
  linhas: { id: string; descricao: string; pagador: string; vencimento: string; saldo: number }[];
  quantidade: number; total: number;
  semVencimento: { quantidade: number; total: number };
};

function CartaoInferior({ titulo, acao, onAcao, children }: {
  titulo: string; acao: string; onAcao: () => void; children: React.ReactNode;
}) {
  return (
    <section className="pfCartao pfInferior">
      <h3>{titulo}</h3>
      <div className="pfInferiorCorpo">{children}</div>
      <button type="button" className="pfLink" onClick={onAcao}>{acao} <span aria-hidden="true">→</span></button>
    </section>
  );
}

export function AreaInferior({
  vencimentos, glosa, repasses, fechamento, competencia, valor, onIr,
}: {
  vencimentos: Vencimentos;
  glosa: { valor: number; percentual: number | null; paraRecurso: number; prazoVencendo: number };
  repasses: { quantidade: number; valor: number };
  fechamento: EstadoDoFechamento;
  competencia: string;
  valor: Formatar;
  onIr: (tarefa: string, periodo?: string) => void;
}) {
  const textoFechamento = {
    "fechado": "Conferido e fechado. Lançamentos travados.",
    "sem-movimento": "Nada lançado nesta competência ainda.",
    "em-andamento": "Mês em andamento — fecha depois que terminar.",
    "perto-do-fim": "O mês está terminando: confira notas e glosas.",
    "atrasado": "O mês terminou e ainda não foi fechado.",
  }[fechamento.tipo];
  return (
    <section className="pfInferiores" aria-label="Acompanhamento">
      <CartaoInferior titulo="Próximos vencimentos" acao="Abrir recebimentos" onAcao={() => onIr("recebimentos")}>
        {vencimentos.quantidade === 0 ? (
          <p className="pfVazio">Nada vence nos próximos 30 dias.</p>
        ) : (
          <>
            <p className="pfNumero">{valor(vencimentos.total)} <small>em {plural(vencimentos.quantidade, "lançamento", "lançamentos")}</small></p>
            <ul className="pfMiniLista">
              {vencimentos.linhas.slice(0, 3).map((l) => (
                <li key={l.id}><span>{dataBr(l.vencimento)} · {l.pagador}</span><b>{valor(l.saldo)}</b></li>
              ))}
            </ul>
          </>
        )}
        {vencimentos.semVencimento.quantidade > 0 && (
          <p className="pfNota">
            {valor(vencimentos.semVencimento.total)} a receber sem vencimento declarado
            ({plural(vencimentos.semVencimento.quantidade, "lançamento", "lançamentos")}).
          </p>
        )}
      </CartaoInferior>

      <CartaoInferior titulo="Glosas" acao="Acompanhar glosas" onAcao={() => onIr("glosas")}>
        <p className="pfNumero">
          {valor(glosa.valor)}{" "}
          <small>{glosa.percentual === null ? "na competência" : `${glosa.percentual.toFixed(1).replace(".", ",")}% do faturado`}</small>
        </p>
        <p className="pfNota">
          {glosa.paraRecurso === 0
            ? "Nenhuma glosa esperando recurso."
            : `${plural(glosa.paraRecurso, "glosa", "glosas")} em acompanhamento${glosa.prazoVencendo ? ` · ${glosa.prazoVencendo} com prazo em até 7 dias` : ""}.`}
        </p>
      </CartaoInferior>

      <CartaoInferior titulo="Repasses" acao="Abrir repasses" onAcao={() => onIr("repasses")}>
        {repasses.quantidade === 0 ? (
          <p className="pfVazio">Nenhum repasse pendente.</p>
        ) : (
          <p className="pfNumero">{valor(repasses.valor)} <small>em {plural(repasses.quantidade, "repasse pendente", "repasses pendentes")}</small></p>
        )}
      </CartaoInferior>

      <CartaoInferior titulo="Fechamento" acao={fechamento.tipo === "fechado" ? "Abrir o fechamento" : "Ir para o fechamento"}
        onAcao={() => onIr("fechamento", competencia)}>
        <p className="pfNumero pfNumeroTexto">{nomeDaCompetencia(competencia)}</p>
        <p className="pfNota">{textoFechamento}</p>
      </CartaoInferior>
    </section>
  );
}

// ── A composição de um número ─────────────────────────────────────────────

const TITULO_COMPOSICAO: Record<TipoDeComposicao, (t: string) => string> = {
  recebido: (t) => `Composição dos ${t} recebidos`,
  aReceber: (t) => `Composição dos ${t} a receber`,
  vencido: (t) => `Composição dos ${t} vencidos`,
  faturado: (t) => `Composição dos ${t} faturados`,
};
const ESCOPO_COMPOSICAO: Record<TipoDeComposicao, string> = {
  recebido: "O que já entrou dos lançamentos desta competência.",
  aReceber: "Saldo em aberto de todos os meses, não só desta competência.",
  vencido: "Saldo cujo vencimento declarado já passou, de todos os meses.",
  faturado: "Consultas e produção lançadas nesta competência.",
};
const ACAO_COMPOSICAO: Record<TipoDeComposicao, [string, string]> = {
  recebido: ["Ver recebimentos", "recebimentos"],
  aReceber: ["Ver recebimentos em aberto", "recebimentos"],
  vencido: ["Ver cobranças em atraso", "idade"],
  faturado: ["Ver lançamentos", "lancamentos"],
};
const MAXIMO_DE_LINHAS = 60;

/**
 * O painel lateral que abre ao clicar num número: quantos, de quem, de
 * quando e quais linhas exatamente somam aquele total.
 */
export function DetalheDaComposicao({
  composicao, valor, recebimentos, recebidoSemMetodo = 0, onFechar, onIr,
}: {
  composicao: Composicao;
  valor: Formatar;
  /**
   * Pagamentos registrados das linhas da composição, por forma de pagamento.
   * CONSULTA-ONLY: só a consulta passa pelo registro de pagamento (PIX,
   * dinheiro, cartão). A produção é marcada recebida sem método — inventar um
   * seria mostrar um dado que não existe.
   */
  recebimentos: { metodo: string; valor: number; quantidade: number }[] | null;
  /** O recebido que não passa pelo registro de pagamento (a produção) — para a soma fechar. */
  recebidoSemMetodo?: number;
  onFechar: () => void;
  onIr: (tarefa: string) => void;
}) {
  const fechar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    fechar.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onFechar]);

  const c = composicao;
  const temProducao = c.linhas.some((l) => l.id.startsWith("producao:"));
  const [rotuloAcao, tarefaAcao] = ACAO_COMPOSICAO[c.tipo];
  return (
    <div className="pfGaveta" role="presentation" onClick={onFechar}>
      <aside className="pfGavetaPainel" role="dialog" aria-modal="true" aria-labelledby="pf-gaveta-titulo"
        onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h2 id="pf-gaveta-titulo">{TITULO_COMPOSICAO[c.tipo](valor(c.total))}</h2>
            <p>{ESCOPO_COMPOSICAO[c.tipo]}</p>
          </div>
          <button type="button" ref={fechar} className="pfGavetaFechar" onClick={onFechar} aria-label="Fechar">
            <Icone nome="fechar" tamanho={18} />
          </button>
        </header>

        <div className="pfGavetaCorpo">
          <dl className="pfResumo">
            <div><dt>Lançamentos</dt><dd>{c.linhas.length}</dd></div>
            <div><dt>Pagadores</dt><dd>{c.pagadores.length}</dd></div>
            <div><dt>Competência</dt><dd>{c.periodo ? (c.periodo.de === c.periodo.ate ? mesBr(c.periodo.de) : `${mesBr(c.periodo.de)} a ${mesBr(c.periodo.ate)}`) : "—"}</dd></div>
          </dl>

          {c.linhas.length === 0 ? (
            <p className="pfVazio">Nenhum lançamento compõe este número agora.</p>
          ) : (
            <>
              <h3>Por convênio ou pagador</h3>
              <ul className="pfMiniLista">
                {c.pagadores.map((p) => (
                  <li key={p.rotulo}><span>{p.rotulo} <small>· {plural(p.linhas, "lançamento", "lançamentos")}</small></span><b>{valor(p.valor)}</b></li>
                ))}
              </ul>

              {recebimentos && (
                <>
                  <h3>Recebimentos registrados</h3>
                  {recebimentos.length > 0 && (
                    <ul className="pfMiniLista">
                      {recebimentos.map((m) => (
                        <li key={m.metodo}><span>{m.metodo} <small>· {m.quantidade}</small></span><b>{valor(m.valor)}</b></li>
                      ))}
                    </ul>
                  )}
                  {recebidoSemMetodo > 0 && (
                    <p className="pfNota">
                      Mais {valor(recebidoSemMetodo)} da produção marcada como recebida — a produção não
                      registra a forma de pagamento.
                    </p>
                  )}
                  {recebimentos.length === 0 && recebidoSemMetodo === 0 && (
                    <p className="pfNota">Nenhum pagamento registrado com forma de pagamento.</p>
                  )}
                </>
              )}

              <h3>Lançamentos relacionados</h3>
              <div className="pfTabelaRolavel">
                <table className="pfTabela">
                  <thead><tr><th>Quando</th><th>Descrição</th><th>Pagador</th><th className="num">Neste total</th></tr></thead>
                  <tbody>
                    {c.linhas.slice(0, MAXIMO_DE_LINHAS).map((l) => (
                      <tr key={l.id}>
                        {/* Produção tem o dia; consulta, só a competência — ver `periodo`. */}
                        <td>{l.id.startsWith("producao:") ? dataBr(l.data) : mesBr(l.competencia)}</td>
                        <td>
                          {l.descricao}
                          <small>{l.id.startsWith("producao:") ? "Produção" : "Consulta"}{l.vencimento ? ` · vence ${dataBr(l.vencimento)}` : ""}</small>
                        </td>
                        <td>{l.pagador}</td>
                        <td className="num">{valor(l.parte)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {c.linhas.length > MAXIMO_DE_LINHAS && (
                <p className="pfNota">Mostrando {MAXIMO_DE_LINHAS} de {c.linhas.length}. A lista completa está na aba.</p>
              )}
            </>
          )}
        </div>

        {/* div, e não <footer>: a regra global de footer é o rodapé preto do site. */}
        <div className="pfGavetaRodape">
          <button type="button" className="primaryClinical compact" onClick={() => onIr(tarefaAcao)}>{rotuloAcao}</button>
          {temProducao && <button type="button" className="outlineClinical" onClick={() => onIr("producao")}>Ver produção da equipe</button>}
        </div>
      </aside>
    </div>
  );
}
