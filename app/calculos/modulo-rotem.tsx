"use client";

import { useMemo, useState } from "react";
import estilos from "./calculos.module.css";
import {
  achados,
  acharCenario,
  AVISO_CONDUTA,
  AVISO_MODULO,
  AVISO_PASSO_ZERO,
  AVISO_REFERENCIA,
  BARREIRA,
  CENARIOS,
  chave,
  citar,
  COMPARACOES,
  condutasAplicaveis,
  ENSAIOS,
  NAO_DEFINIDO,
  PARAMETROS,
  PASSO_ZERO,
  PRE_ANALITICO,
  quantosClassificados,
  SEM_CONSENSO,
  SEQUENCIA,
  type CenarioId,
  type Contexto,
  type EnsaioId,
  type Leitura,
  type ParametroId,
  type Situacao,
} from "@/lib/calculos/rotem";

/**
 * ROTEM. A ordem da tela é a ordem da decisão, e não a ordem do laudo.
 *
 * Por isso o contexto vem antes do traçado: um ROTEM alterado sem sangramento
 * não indica hemocomponente, e quem lê o número primeiro já está decidindo
 * com a pergunta errada. As classes de conduta só aparecem quando o
 * sangramento está declarado — é a barreira que a própria fonte exige, aqui
 * transformada em comportamento, e não em aviso que ninguém lê.
 *
 * A classificação de cada parâmetro é da pessoa, não do sistema: a faixa de
 * referência do ROTEM muda com a plataforma e o reagente, e cravá-la aqui
 * seria inventar fonte.
 */

const SITUACOES: Situacao[] = ["abaixo", "normal", "acima"];

export function Rotem() {
  const [contexto, setContexto] = useState<Contexto>({});
  const [leitura, setLeitura] = useState<Leitura>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [referencia, setReferencia] = useState(false);

  const resultado = useMemo(() => achados(leitura, contexto), [leitura, contexto]);
  const condutas = useMemo(() => condutasAplicaveis(resultado, contexto), [resultado, contexto]);
  const classificados = quantosClassificados(leitura);
  const cenario = contexto.cenario ? acharCenario(contexto.cenario) : undefined;

  const classificar = (e: EnsaioId, p: ParametroId, s: Situacao) =>
    setLeitura((v) => {
      const k = chave(e, p);
      // Clicar de novo no mesmo botão desmarca: dá para desfazer uma
      // classificação errada sem recarregar a tela.
      return { ...v, [k]: v[k] === s ? undefined : s };
    });

  const responder = (campo: keyof Contexto, valor: boolean) =>
    setContexto((c) => ({ ...c, [campo]: c[campo] === valor ? undefined : valor }));

  return (
    <>
      <h1 className={estilos.titulo}>ROTEM</h1>
      <p className={estilos.subtitulo}>
        Você classifica cada parâmetro pelo seu laudo; o módulo faz a leitura cruzada
        entre os canais e aponta o fenótipo. A conduta continua sendo do seu protocolo.
      </p>
      <p className={estilos.confira}>{AVISO_MODULO}</p>

      {/* Passo 0 — antes do traçado, sempre. */}
      <section className={estilos.correcao}>
        <strong>Passo 0 — antes de olhar o traçado</strong>
        <p className={estilos.dica}>{AVISO_PASSO_ZERO}</p>

        {PASSO_ZERO.map((q) => {
          const atual = contexto[q.chave];
          return (
            <div key={q.chave} className={estilos.pergunta}>
              <div className={estilos.perguntaTexto}>
                <b>{q.pergunta}</b>
                {atual === false && <small>{q.seNao}</small>}
              </div>
              <div className={estilos.parametroBotoes} role="group" aria-label={q.pergunta}>
                <button type="button" aria-pressed={atual === true}
                  className={atual === true ? estilos.tresAtivo : estilos.tresBotao}
                  onClick={() => responder(q.chave, true)}>Sim</button>
                <button type="button" aria-pressed={atual === false}
                  className={atual === false ? estilos.tresAtivo : estilos.tresBotao}
                  onClick={() => responder(q.chave, false)}>Não</button>
              </div>
            </div>
          );
        })}

        <label className={estilos.campo}>
          <span>Cenário</span>
          <select className={estilos.seletor} value={contexto.cenario ?? ""}
            onChange={(e) => setContexto((c) => ({ ...c, cenario: (e.target.value || undefined) as CenarioId }))}>
            <option value="">Não informado</option>
            {CENARIOS.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>

        {cenario && (
          <div className={`${estilos.bloco} ${estilos.blocoFonte}`}>
            <strong>{cenario.nome}</strong>
            <p>{cenario.utilidade}</p>
            <p className={estilos.aviso}>{cenario.limite}</p>
          </div>
        )}
      </section>

      <p className={estilos.aviso}>{AVISO_REFERENCIA}</p>

      {ENSAIOS.map((e) => (
        <section key={e.id} className={estilos.correcao}>
          <strong>{e.sigla}</strong>
          <p className={estilos.dica}>{e.ativacao} {e.uso}</p>

          {e.parametros.map((p) => {
            const par = PARAMETROS[p];
            const k = chave(e.id, p);
            return (
              <div key={p} className={estilos.parametro}>
                <div className={estilos.parametroNome}>
                  <b>{par.sigla}</b>
                  <small>{par.nome} ({par.unidade})</small>
                </div>
                <input className={estilos.parametroValor} type="number" inputMode="decimal"
                  placeholder="valor" value={valores[k] ?? ""}
                  aria-label={`${e.sigla} ${par.sigla}, valor`}
                  onChange={(ev) => setValores((v) => ({ ...v, [k]: ev.target.value }))} />
                <div className={estilos.parametroBotoes} role="group" aria-label={`${e.sigla} ${par.sigla}`}>
                  {SITUACOES.map((s) => (
                    <button key={s} type="button"
                      className={leitura[k] === s ? estilos.tresAtivo : estilos.tresBotao}
                      aria-pressed={leitura[k] === s}
                      onClick={() => classificar(e.id, p, s)}>
                      {s === "normal" ? "Normal" : s === "abaixo" ? par.rotulos.abaixo : par.rotulos.acima}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}

      <section className={estilos.resultado} aria-live="polite">
        <h2 className={estilos.resultadoTitulo}>Leitura cruzada</h2>
        {classificados === 0 ? (
          <p className={estilos.dica}>
            Classifique ao menos um parâmetro. Enquanto nada estiver marcado, não há o que ler.
          </p>
        ) : resultado.length === 0 ? (
          <p className={estilos.veredito}>
            Nenhum dos padrões conhecidos fechou com o que está marcado ({classificados}{" "}
            {classificados === 1 ? "parâmetro" : "parâmetros"}). Isso não quer dizer traçado normal:
            pode faltar o canal que confirma — o HEPTEM para a heparina, o APTEM para a fibrinólise,
            o FIBTEM para separar fibrina de plaqueta.
          </p>
        ) : (
          <div className={estilos.completa}>
            {resultado.map((a) => (
              <div key={a.titulo} className={`${estilos.bloco} ${a.fenotipo ? estilos.blocoAtencao : ""}`}>
                <strong>{a.titulo}</strong>
                <p className={estilos.veredito}>{a.hipotese}</p>
                <p>{a.base}</p>
                {a.aSeguir && <p className={estilos.aviso}>{a.aSeguir}</p>}
              </div>
            ))}
          </div>
        )}

        {/* A camada de conduta é presa ao sangramento, e não por escolha de
            estilo: é a condição que a fonte exige para sequer considerar
            hemocomponente. */}
        {resultado.some((a) => a.fenotipo) && condutas.length === 0 && (
          <p className={estilos.confira}>
            As classes de intervenção só aparecem com sangramento clinicamente relevante
            declarado no Passo 0. Resultado alterado sem sangramento não é indicação
            automática de hemocomponente ou concentrado de fator.
          </p>
        )}

        {condutas.length > 0 && (
          <div className={estilos.correcao}>
            <strong>Classes de intervenção a considerar</strong>
            <p className={estilos.confira}>{AVISO_CONDUTA}</p>
            {condutas.map((c) => (
              <div key={c.fenotipo} className={estilos.bloco}>
                <strong>{c.nome}</strong>
                <p>{c.considerar}</p>
                <p className={estilos.aviso}><b>Verificações obrigatórias:</b> {c.verificar}</p>
              </div>
            ))}
            <p className={estilos.confira}>{BARREIRA}</p>
          </div>
        )}
      </section>

      <button type="button" className={estilos.verMais} onClick={() => setReferencia((v) => !v)}>
        {referencia ? "Ocultar referência e limites" : "Ver referência e limites"}
      </button>

      {referencia && (
        <div className={estilos.completa}>
          <div className={estilos.correcao}>
            <strong>Sequência de interpretação</strong>
            {SEQUENCIA.map((s) => (
              <div key={s.etapa} className={estilos.bloco}>
                <strong>{s.etapa}</strong>
                <p>{s.pergunta}</p>
                <p className={estilos.aviso}>{s.decisao}</p>
              </div>
            ))}
          </div>

          <div className={estilos.correcao}>
            <strong>Comparações que geram informação</strong>
            {COMPARACOES.map((c) => (
              <div key={c.par} className={estilos.bloco}>
                <strong>{c.par}</strong>
                <p>{c.inferencia}</p>
                <p className={estilos.aviso}><b>Cuidado:</b> {c.cuidado}</p>
              </div>
            ))}
          </div>

          <div className={estilos.correcao}>
            <strong>Condições pré-analíticas e fisiológicas</strong>
            <ul className={estilos.lista}>
              {PRE_ANALITICO.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>

          <div className={estilos.correcao}>
            <strong>O que não está definido nas fontes</strong>
            {NAO_DEFINIDO.map((n) => (
              <div key={n.campo} className={estilos.bloco}>
                <strong>{n.campo}</strong>
                <p>{n.situacao}</p>
                <p className={estilos.aviso}>{n.conduta}</p>
              </div>
            ))}
          </div>

          <div className={`${estilos.bloco} ${estilos.blocoFonte}`}>
            <strong>Por que não há algoritmo fechado aqui</strong>
            <p>{SEM_CONSENSO.texto}</p>
            {SEM_CONSENSO.fontes.map((f) => (
              <p key={f.local} className={estilos.fonte}>{citar(f)}</p>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
