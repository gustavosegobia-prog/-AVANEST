"use client";

import { useMemo, useState } from "react";
import estilos from "./calculos.module.css";
import {
  achados,
  AVISO_MODULO,
  AVISO_REFERENCIA,
  chave,
  ENSAIOS,
  NAO_CONCLUI,
  PARAMETROS,
  quantosClassificados,
  type EnsaioId,
  type Leitura,
  type ParametroId,
  type Situacao,
} from "@/lib/calculos/rotem";

/**
 * ROTEM. A tela pede duas coisas por parâmetro: o valor, que é registro, e a
 * classificação, que é o que o módulo usa para pensar.
 *
 * A classificação é da pessoa, e não do sistema, porque a faixa de
 * normalidade do ROTEM muda com o analisador e o reagente — cravá-la aqui
 * seria inventar referência. O que o módulo faz sozinho é a leitura cruzada
 * entre os canais, que é onde se erra de verdade às três da manhã.
 */

const SITUACOES: Situacao[] = ["abaixo", "normal", "acima"];

export function Rotem() {
  const [leitura, setLeitura] = useState<Leitura>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [limites, setLimites] = useState(false);

  const resultado = useMemo(() => achados(leitura), [leitura]);
  const classificados = quantosClassificados(leitura);

  const classificar = (e: EnsaioId, p: ParametroId, s: Situacao) =>
    setLeitura((v) => {
      const k = chave(e, p);
      // Clicar de novo no mesmo botão desmarca: dá para desfazer uma
      // classificação errada sem recarregar a tela.
      return { ...v, [k]: v[k] === s ? undefined : s };
    });

  return (
    <>
      <h1 className={estilos.titulo}>ROTEM</h1>
      <p className={estilos.subtitulo}>
        Você classifica cada parâmetro pelo seu laudo; o módulo faz a leitura cruzada
        entre os canais e diz qual componente da hemostasia o traçado implica.
      </p>
      <p className={estilos.confira}>{AVISO_MODULO}</p>
      <p className={estilos.aviso}>{AVISO_REFERENCIA}</p>

      {ENSAIOS.map((e) => (
        <section key={e.id} className={estilos.correcao}>
          <strong>{e.sigla}</strong>
          <p className={estilos.dica}>{e.montagem} {e.isola}</p>

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
            o FIBTEM para separar fibrinogênio de plaqueta.
          </p>
        ) : (
          <div className={estilos.completa}>
            {resultado.map((a) => (
              <div key={a.titulo}
                className={`${estilos.bloco} ${a.componente.startsWith("Indefinido") ? "" : estilos.blocoAtencao}`}>
                <strong>{a.titulo}</strong>
                <p className={estilos.veredito}>{a.componente}</p>
                <p>{a.base}</p>
                {a.aSeguir && <p className={estilos.aviso}>{a.aSeguir}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <button type="button" className={estilos.verMais} onClick={() => setLimites((v) => !v)}>
        {limites ? "Ocultar o que este módulo não conclui" : "O que este módulo não conclui"}
      </button>

      {limites && (
        <div className={estilos.correcao}>
          {NAO_CONCLUI.map((n) => (
            <div key={n.item} className={estilos.bloco}>
              <strong>{n.item}</strong>
              <p>{n.motivo}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
