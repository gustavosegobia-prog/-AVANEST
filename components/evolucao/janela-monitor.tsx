"use client";

import { useState } from "react";
import { Janela } from "@/components/janela";
import { COLUNAS_DO_MONITOR, lerTendencias, type LinhaDoMonitor } from "@/lib/evolucao/monitor";
import { PARAMETROS, valorPlausivel, type Parametro } from "@/lib/evolucao/sinais";
import { minutosEntre, type Registro } from "@/lib/evolucao/registros";
import { momentoDeHora } from "./use-folha";
import { numero } from "./campos";

// A foto do monitor: lê a tela de tendências (foto: lib/evolucao/foto-do-monitor.ts;
// PDF: o texto em lib/evolucao/monitor.ts), mostra a tabela para conferir e
// lança o que o médico deixar marcado. Linha sem hora legível vem com a hora
// em branco, para ele escrever.

type Linha = { chave: number; incluir: boolean; hora: string; valores: Partial<Record<Parametro, string>>; jaTem: boolean };

let proxima = 0;
const paraLinha = (l: LinhaDoMonitor, jaTem: boolean): Linha => ({
  chave: ++proxima, incluir: !jaTem, hora: l.hora, jaTem,
  valores: Object.fromEntries(COLUNAS_DO_MONITOR.filter((p) => l[p] !== undefined).map((p) => [p, String(l[p])])),
});

export type MedidaDoMonitor = { momento: string; itens: Array<{ parametro: Parametro; valor: number }> };

export function JanelaMonitor({ atuais, onLancar, onFechar }: {
  atuais: Registro[];
  onLancar: (medidas: MedidaDoMonitor[]) => void;
  onFechar: () => void;
}) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [lida, setLida] = useState(false);

  // Já há sinal registrado naquele minuto: a linha vem desmarcada, para não duplicar.
  const jaRegistrado = (hora: string) => {
    const m = momentoDeHora(hora);
    return Boolean(m && atuais.some((r) => r.tipo === "sinal" && Math.abs(minutosEntre(r.momento, m)) < 1));
  };

  async function ler(arquivo?: File) {
    if (!arquivo) return;
    setLendo(true); setErro(null); setProgresso(0);
    try {
      let lidas: LinhaDoMonitor[];
      if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) {
        const { textoDoArquivo } = await import("@/lib/texto-do-laudo");
        lidas = lerTendencias(await textoDoArquivo(arquivo));
      } else {
        const { lerFotoDoMonitor } = await import("@/lib/evolucao/foto-do-monitor");
        lidas = await lerFotoDoMonitor(arquivo, setProgresso);
      }
      if (!lidas.length) setErro("Não encontrei horários com valores nesta imagem. Tente outra foto, de frente e sem reflexo, ou digite abaixo.");
      setLinhas((atual) => [...atual, ...lidas.map((l) => paraLinha(l, Boolean(l.hora) && jaRegistrado(l.hora)))]);
    } catch {
      setErro("Não consegui ler este arquivo. Tente uma foto da tela de tendências, ou digite os valores abaixo.");
    } finally {
      setLendo(false); setLida(true);
    }
  }

  const mudar = (chave: number, f: (l: Linha) => Linha) => setLinhas((ls) => ls.map((l) => (l.chave === chave ? f(l) : l)));
  const problema = (l: Linha): string | null => {
    if (!l.hora.trim()) return "Falta a hora";
    if (!momentoDeHora(l.hora)) return "Hora inválida";
    for (const p of COLUNAS_DO_MONITOR) {
      const t = l.valores[p];
      if (t && !valorPlausivel(p, numero(t))) return `${PARAMETROS[p].curto} fora da faixa`;
    }
    if (!COLUNAS_DO_MONITOR.some((p) => l.valores[p])) return "Sem valores";
    return null;
  };
  const prontas = linhas.filter((l) => l.incluir && !problema(l));

  function lancar() {
    onLancar(prontas.map((l) => ({
      momento: momentoDeHora(l.hora)!,
      itens: COLUNAS_DO_MONITOR.filter((p) => l.valores[p]).map((p) => ({ parametro: p, valor: numero(l.valores[p]!)! })),
    })));
  }

  return (
    <Janela titulo="Foto do monitor" largura="larga" onFechar={onFechar}
      subtitulo="Os parâmetros aferidos, lidos da tela de tendências do monitor."
      rodape={<>
        <button type="button" className="evoBotao secundario" onClick={onFechar}>Cancelar</button>
        <button type="button" className="evoBotao" disabled={!prontas.length} onClick={lancar}>
          Lançar {prontas.length} {prontas.length === 1 ? "horário" : "horários"}
        </button>
      </>}>
      <div className="evoForm">
        <label className={`evoFotoMonitor${lendo ? " lendo" : ""}`}>
          <b>{lendo ? `Lendo a foto… ${Math.round(progresso * 100)}%` : lida ? "Ler outra foto" : "Fotografar a tela de tendências"}</b>
          <span>Foto de frente, sem reflexo, com a tabela de horários inteira. Também aceita o relatório em PDF.</span>
          <input type="file" accept="image/*,.pdf" disabled={lendo}
            onChange={(e) => { void ler(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        <p className="evoNota">A foto é lida neste aparelho e não fica guardada. Confira cada valor com o monitor antes de lançar: o que entrar fica marcado como importado.</p>
        {erro && <p className="evoNota atencao" role="alert">{erro}</p>}

        {linhas.length > 0 && (
          <div className="evoMonitorTabelaCaixa">
            <table className="evoMonitorTabela">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Lançar</span></th>
                  <th scope="col">Hora</th>
                  {COLUNAS_DO_MONITOR.map((p) => <th key={p} scope="col">{PARAMETROS[p].curto}</th>)}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const p = problema(l);
                  return (
                    <tr key={l.chave} className={!l.incluir ? "fora" : p ? "problema" : ""}>
                      <td>
                        <input type="checkbox" checked={l.incluir} aria-label={`Lançar o horário ${l.hora}`}
                          onChange={(e) => mudar(l.chave, (x) => ({ ...x, incluir: e.target.checked }))} />
                      </td>
                      <td>
                        <input className="hora" value={l.hora} inputMode="numeric" aria-label="Hora" maxLength={5}
                          onChange={(e) => mudar(l.chave, (x) => ({ ...x, hora: e.target.value }))} />
                        {l.jaTem && <small>já lançado</small>}
                        {p && l.incluir && <small className="erro">{p}</small>}
                      </td>
                      {COLUNAS_DO_MONITOR.map((par) => (
                        <td key={par}>
                          <input value={l.valores[par] ?? ""} inputMode="decimal" aria-label={`${PARAMETROS[par].nome} às ${l.hora}`}
                            onChange={(e) => mudar(l.chave, (x) => ({ ...x, valores: { ...x.valores, [par]: e.target.value } }))} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="evoBotao pequeno secundario evoMonitorMais"
          onClick={() => setLinhas((ls) => [...ls, { chave: ++proxima, incluir: true, hora: "", valores: {}, jaTem: false }])}>
          + Adicionar horário
        </button>
      </div>
    </Janela>
  );
}
