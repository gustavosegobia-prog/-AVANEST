"use client";

import { useState } from "react";
import {
  TITULO_DO_CONSUMO, buscarConsumo, itemDoCatalogoDeConsumo, linhasPorGrupo,
  type Consumo, type ItemDoConsumo, type LinhaDeConsumo,
} from "@/lib/evolucao/consumo";

// O verso da ficha na tela (lib/evolucao/consumo.ts): só o que foi usado
// aparece, com a quantidade em − e +. "Trazer da ficha" preenche o que dá para
// tirar dos registros; o resto entra pela busca.

export function ConsumoDaFolha({ consumo, leitura, onMudar, onTrazer, imprimir }: {
  consumo: Consumo;
  leitura: boolean;
  onMudar: (c: Consumo) => void;
  onTrazer: () => void;
  /** O botão de imprimir o verso (vem da ficha, que sabe o id). */
  imprimir: React.ReactNode;
}) {
  const [busca, setBusca] = useState("");
  const achados = buscarConsumo(busca, consumo.itens);
  const grupos = linhasPorGrupo(consumo);
  const igual = (a: LinhaDeConsumo, b: LinhaDeConsumo) => a.nome === b.nome && (a.numero ?? "") === (b.numero ?? "");

  const mudarLinha = (l: LinhaDeConsumo, mudanca: Partial<LinhaDeConsumo>) =>
    onMudar({ ...consumo, itens: consumo.itens.map((x) => (igual(x, l) ? { ...x, ...mudanca } : x)).filter((x) => x.qtd > 0) });
  function adicionar(i: ItemDoConsumo | string) {
    const nome = typeof i === "string" ? i.trim() : i.nome;
    if (!nome) return;
    const ja = consumo.itens.find((x) => x.nome === nome && !x.numero);
    if (ja && !(typeof i !== "string" && i.comNumero)) mudarLinha(ja, { qtd: ja.qtd + 1 });
    else onMudar({ ...consumo, itens: [...consumo.itens, { nome, qtd: 1, ...(typeof i === "string" ? { grupo: "outros" as const } : {}) }] });
    setBusca("");
  }

  return (
    <section className="evoPapel evoConsumo" aria-labelledby="evoConsumoTitulo">
      <header className="evoConsumoTopo">
        <div>
          <h3 id="evoConsumoTitulo">Consumo — verso da ficha</h3>
          <p>Materiais e medicamentos usados na sala, para o faturamento.</p>
        </div>
        <div className="evoConsumoAcoes">
          {!leitura && (
            <button type="button" className="evoBotao pequeno" onClick={onTrazer}
              title="Ampolas pela dose total, soros pelo volume, tubo e agulha da técnica">
              Trazer da ficha
            </button>
          )}
          {imprimir}
        </div>
      </header>

      {!leitura && (
        <div className="evoConsumoBusca">
          <label className="evoCampo"><span>Adicionar item</span>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} autoComplete="off"
              placeholder="Ex.: seringa 10, Ringer, fentanil…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionar(achados[0] ?? busca); } }} />
          </label>
          {busca.trim().length >= 2 && (
            <ul className="evoConsumoAchados">
              {achados.map((i) => (
                <li key={i.nome}><button type="button" onClick={() => adicionar(i)}>
                  <b>{i.nome}</b><small>{TITULO_DO_CONSUMO[i.grupo]}</small>
                </button></li>
              ))}
              <li><button type="button" onClick={() => adicionar(busca)}>
                <b>Usar “{busca.trim()}”</b><small>Item fora da lista</small>
              </button></li>
            </ul>
          )}
        </div>
      )}

      {grupos.length === 0 ? (
        <p className="evoNota">
          {leitura ? "Nenhum consumo registrado." : "Nada lançado ainda. Toque em “Trazer da ficha” ou adicione pela busca."}
        </p>
      ) : grupos.map((g) => (
        <div key={g.grupo} className="evoConsumoGrupo">
          <h4>{TITULO_DO_CONSUMO[g.grupo]}</h4>
          <ul>
            {g.linhas.map((l) => {
              const item = itemDoCatalogoDeConsumo(l.nome);
              return (
                <li key={`${l.nome}|${l.numero ?? ""}`}>
                  <span className="evoConsumoNome">{l.nome}</span>
                  {item?.comNumero && (
                    <label className="evoConsumoNumero"><span>nº</span>
                      <input value={l.numero ?? ""} inputMode="decimal" disabled={leitura} aria-label={`Número de ${l.nome}`}
                        onChange={(e) => mudarLinha(l, { numero: e.target.value.slice(0, 8) })} />
                    </label>
                  )}
                  <span className="evoConsumoQtd">
                    {!leitura && <button type="button" aria-label={`Menos ${l.nome}`} onClick={() => mudarLinha(l, { qtd: l.qtd - 1 })}>−</button>}
                    <b aria-label={`Quantidade de ${l.nome}`}>{l.qtd}</b>
                    {!leitura && <button type="button" aria-label={`Mais ${l.nome}`} onClick={() => mudarLinha(l, { qtd: l.qtd + 1 })}>+</button>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <label className="evoCampo"><span>Observação do consumo</span>
        <textarea rows={2} maxLength={600} disabled={leitura} value={consumo.observacao ?? ""}
          onChange={(e) => onMudar({ ...consumo, observacao: e.target.value })} />
      </label>
    </section>
  );
}
