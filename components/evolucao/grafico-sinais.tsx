"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EIXO_Y, marcasDeTempo, pontoDoToque, tempoParaX, valorParaY, type Escala,
} from "@/lib/evolucao/grafico";
import {
  EM_LINHA, NO_GRAFICO, PARAMETROS, lacunaPadrao, periodosSemMonitorizacao, pontosDe, trechos,
  type Parametro,
} from "@/lib/evolucao/sinais";
import { rotuloDoEvento } from "@/lib/evolucao/folha";
import { horaLocal } from "@/lib/data-local";
import type { Registro } from "@/lib/evolucao/registros";

// O gráfico da folha: o quadriculado do papel, só que cada toque vira registro.
//
// A geometria é a de lib/evolucao/grafico.ts — a mesma da impressão. O ponto
// que o médico toca aqui sai no papel no mesmo cruzamento de horário e valor.

const CALHA = 56;          // coluna dos rótulos (SpO₂, EtCO₂) e dos números do eixo
const FAIXA_EVENTOS = 24;
const LINHA = 26;          // SpO₂, EtCO₂, temperatura
const FAIXA_HORAS = 20;
const TOQUE = 18;          // raio de acerto num ponto (dedo com luva)

export type Toque = { ms: number; valor: number };

export function GraficoSinais({
  atuais, idsPendentes, fimMs, agoraMs, aberta, intervalo, janelaInicio, janelaMinutos,
  alturaGrade, somenteLeitura, onTocar, onTocarLinha, onAbrirPonto, onMover,
}: {
  atuais: Registro[];
  idsPendentes: Set<string>;
  fimMs: number | null;
  agoraMs: number;
  aberta: boolean;
  intervalo: number;
  janelaInicio: number;
  janelaMinutos: number;
  alturaGrade: number;
  somenteLeitura: boolean;
  onTocar: (t: Toque) => void;
  onTocarLinha: (p: Parametro, ms: number) => void;
  onAbrirPonto: (r: Registro) => void;
  onMover: (r: Registro, t: Toque) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [largura, setLargura] = useState(800);
  const [arraste, setArraste] = useState<{ registro: Registro; x: number; y: number; ativo: boolean; x0: number; y0: number } | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(480, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const topoLinhas = FAIXA_EVENTOS;
  const topoHoras = topoLinhas + EM_LINHA.length * LINHA;
  const topoGrade = topoHoras + FAIXA_HORAS;
  const altura = topoGrade + alturaGrade + 6;
  const e: Escala = { inicio: janelaInicio, minutos: janelaMinutos, largura: largura - CALHA, altura: alturaGrade };
  const fimJanela = janelaInicio + janelaMinutos * 60000;
  const x = (ms: number) => CALHA + tempoParaX(ms, e);
  const y = (v: number) => topoGrade + valorParaY(v, e);

  const marcasFinas = useMemo(() => marcasDeTempo(janelaInicio, fimJanela, intervalo), [janelaInicio, fimJanela, intervalo]);
  const marcasFortes = useMemo(() => marcasDeTempo(janelaInicio, fimJanela, intervalo * 3), [janelaInicio, fimJanela, intervalo]);

  const series = useMemo(() => NO_GRAFICO.map((p) => ({
    p, pontos: pontosDe(atuais, p),
  })), [atuais]);
  const porId = useMemo(() => new Map(atuais.map((r) => [r.id, r])), [atuais]);

  const lacunas = useMemo(() => {
    const primeiro = atuais.find((r) => r.tipo === "sinal" && NO_GRAFICO.includes(r.dados.parametro as Parametro));
    if (!primeiro) return [];
    const ate = new Date(fimMs ?? agoraMs).toISOString();
    return periodosSemMonitorizacao(atuais, primeiro.momento, ate, lacunaPadrao(intervalo));
  }, [atuais, fimMs, agoraMs, intervalo]);

  const eventos = atuais.filter((r) => r.tipo === "evento");

  function local(ev: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    return { lx: ev.clientX - r.left, ly: ev.clientY - r.top };
  }

  function pontoNoToque(lx: number, ly: number): Registro | null {
    let melhor: { r: Registro; d: number } | null = null;
    for (const s of series) {
      for (const pt of s.pontos) {
        const t = Date.parse(pt.momento);
        if (t < janelaInicio || t > fimJanela) continue;
        const d = Math.hypot(x(t) - lx, y(pt.valor) - ly);
        if (d <= TOQUE && (!melhor || d < melhor.d)) melhor = { r: porId.get(pt.id)!, d };
      }
    }
    return melhor?.r ?? null;
  }

  function aoPressionar(ev: React.PointerEvent<SVGSVGElement>) {
    if (somenteLeitura) return;
    const { lx, ly } = local(ev);
    if (lx < CALHA) return;
    if (ly >= topoGrade) {
      const alvo = pontoNoToque(lx, ly);
      if (alvo) {
        (ev.target as Element).setPointerCapture?.(ev.pointerId);
        setArraste({ registro: alvo, x: lx, y: ly, x0: lx, y0: ly, ativo: false });
        return;
      }
      onTocar(pontoDoToque(lx - CALHA, ly - topoGrade, e));
      return;
    }
    if (ly >= topoLinhas && ly < topoHoras) {
      const p = EM_LINHA[Math.floor((ly - topoLinhas) / LINHA)];
      // A coluna tocada: o meio do intervalo, nunca depois de agora.
      const t0 = Math.floor((janelaInicio + ((lx - CALHA) / e.largura) * janelaMinutos * 60000) / (intervalo * 60000))
        * intervalo * 60000;
      const meio = Math.min(t0 + (intervalo * 60000) / 2, agoraMs);
      onTocarLinha(p, Math.round(meio / 60000) * 60000);
    }
  }

  function aoMover(ev: React.PointerEvent<SVGSVGElement>) {
    if (!arraste) return;
    const { lx, ly } = local(ev);
    const ativo = arraste.ativo || Math.hypot(lx - arraste.x0, ly - arraste.y0) > 6;
    setArraste({ ...arraste, x: lx, y: ly, ativo });
  }

  function aoSoltar() {
    if (!arraste) return;
    if (arraste.ativo) onMover(arraste.registro, pontoDoToque(arraste.x - CALHA, arraste.y - topoGrade, e));
    else onAbrirPonto(arraste.registro);
    setArraste(null);
  }

  const visivel = (ms: number) => ms >= janelaInicio - 60000 && ms <= fimJanela + 60000;

  return (
    <div className="evoGraficoCaixa" ref={caixa}>
      <svg
        ref={svg}
        className={`evoGrafico${somenteLeitura ? " leitura" : ""}`}
        width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`}
        onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar}
        onPointerCancel={() => setArraste(null)}
        role="img"
        aria-label="Gráfico de sinais vitais. Toque para registrar um valor no horário."
      >
        <defs>
          <clipPath id="evoClipGrade">
            <rect x={CALHA} y={0} width={largura - CALHA} height={altura} />
          </clipPath>
        </defs>

        {/* Linhas de SpO₂, EtCO₂ e temperatura — as da folha de papel. */}
        {EM_LINHA.map((p, i) => (
          <g key={p}>
            <rect className="evoLinhaFundo" x={0} y={topoLinhas + i * LINHA} width={largura} height={LINHA} />
            <text className="evoRotuloLinha" x={6} y={topoLinhas + i * LINHA + LINHA / 2 + 4}>{PARAMETROS[p].curto}</text>
          </g>
        ))}

        <g clipPath="url(#evoClipGrade)">
          {/* Sem monitorização: a lacuna aparece, não é preenchida. */}
          {lacunas.map((l) => (
            <rect key={l.de} className="evoLacuna" x={x(Date.parse(l.de))} y={topoGrade}
              width={Math.max(0, x(Date.parse(l.ate)) - x(Date.parse(l.de)))} height={alturaGrade} />
          ))}

          {marcasFinas.map((t) => (
            <line key={`f${t}`} className="evoGradeFina" x1={x(t)} x2={x(t)} y1={topoLinhas} y2={topoGrade + alturaGrade} />
          ))}
          {marcasFortes.map((t) => (
            <g key={`F${t}`}>
              <line className="evoGradeForte" x1={x(t)} x2={x(t)} y1={topoLinhas} y2={topoGrade + alturaGrade} />
              <text className="evoHora" x={x(t)} y={topoHoras + 14} textAnchor="middle">{horaLocal(new Date(t))}</text>
            </g>
          ))}

          {/* Valores das linhas de cima, um por coluna. */}
          {EM_LINHA.map((p, i) => espacados(pontosDe(atuais, p).filter((pt) => visivel(Date.parse(pt.momento))),
            (pt) => x(Date.parse(pt.momento)), p === "temp" ? 34 : 24)
            // Número cortado pela borda não se lê: só os que cabem inteiros.
            .filter((pt) => x(Date.parse(pt.momento)) >= CALHA + 12 && x(Date.parse(pt.momento)) <= largura - 12).map((pt) => (
            <text key={pt.id} className={`evoValorLinha${idsPendentes.has(pt.id) ? " pendente" : ""}`}
              x={x(Date.parse(pt.momento))} y={topoLinhas + i * LINHA + LINHA / 2 + 4} textAnchor="middle">
              {p === "temp" ? pt.valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : pt.valor}
            </text>
          )))}

          {/* Eventos: linha vertical e o nome no alto. */}
          {eventos.filter((r) => visivel(Date.parse(r.momento))).map((r) => (
            <g key={r.id} className={`evoEvento${idsPendentes.has(r.id) ? " pendente" : ""}`}>
              <line x1={x(Date.parse(r.momento))} x2={x(Date.parse(r.momento))} y1={4} y2={topoGrade + alturaGrade} />
              <text x={x(Date.parse(r.momento)) + 4} y={15}>
                {rotuloDoEvento(String(r.dados.codigo), String(r.dados.descricao ?? "")).slice(0, 22)}
              </text>
            </g>
          ))}

          {aberta && visivel(agoraMs) && (
            <line className="evoAgora" x1={x(agoraMs)} x2={x(agoraMs)} y1={topoLinhas} y2={topoGrade + alturaGrade} />
          )}
        </g>

        {/* Eixo vertical, como no papel: forte a cada 30. */}
        {Array.from({ length: (EIXO_Y.max - EIXO_Y.min) / EIXO_Y.passoFino + 1 }, (_, i) => EIXO_Y.min + i * EIXO_Y.passoFino)
          .map((v) => (
            <g key={v}>
              <line className={v % EIXO_Y.passoForte === 0 ? "evoGradeForte" : "evoGradeFina"}
                x1={CALHA} x2={largura} y1={y(v)} y2={y(v)} />
              {v % EIXO_Y.passoForte === 0 && v > 0 && (
                <text className="evoEixo" x={CALHA - 6} y={y(v) + 4} textAnchor="end">{v}</text>
              )}
            </g>
          ))}

        <g clipPath="url(#evoClipGrade)">
          {series.map(({ p, pontos }) => (
            <g key={p} className={`evoSerie ${p}`}>
              {trechos(pontos, lacunaPadrao(intervalo)).map((t) => t.length > 1 && (
                <polyline key={t[0].id} fill="none"
                  points={t.map((pt) => `${x(Date.parse(pt.momento))},${y(pt.valor)}`).join(" ")} />
              ))}
              {pontos.filter((pt) => visivel(Date.parse(pt.momento))).map((pt) => (
                <Simbolo key={pt.id} p={p} cx={x(Date.parse(pt.momento))} cy={y(pt.valor)}
                  pendente={idsPendentes.has(pt.id)} estimado={pt.origem === "estimado"}
                  emArraste={arraste?.ativo === true && arraste.registro.id === pt.id} />
              ))}
            </g>
          ))}
          {arraste?.ativo && (
            <g className={`evoSerie ${arraste.registro.dados.parametro as string} fantasma`}>
              <Simbolo p={arraste.registro.dados.parametro as Parametro} cx={arraste.x} cy={arraste.y} pendente={false} estimado={false} />
            </g>
          )}
        </g>
        <line className="evoBorda" x1={CALHA} x2={CALHA} y1={topoLinhas} y2={topoGrade + alturaGrade} />
      </svg>
    </div>
  );
}

/**
 * Na linha de SpO₂/EtCO₂/temperatura, com o zoom aberto, os números se
 * encostam. Fica um a cada `minPx`, sempre o mais recente por último — e o
 * valor escondido continua no registro: tocar na linha mostra todos.
 */
function espacados<T>(lista: readonly T[], xDe: (t: T) => number, minPx: number): T[] {
  const saida: T[] = [];
  for (let i = lista.length - 1; i >= 0; i--) {
    const ultimo = saida[saida.length - 1];
    if (!ultimo || xDe(ultimo) - xDe(lista[i]) >= minPx) saida.push(lista[i]);
  }
  return saida.reverse();
}

export function Simbolo({ p, cx, cy, pendente, estimado, emArraste = false }: {
  p: Parametro; cx: number; cy: number; pendente: boolean; estimado: boolean; emArraste?: boolean;
}) {
  const classe = `evoSimbolo${pendente ? " pendente" : ""}${estimado ? " estimado" : ""}${emArraste ? " arrastando" : ""}`;
  if (p === "pas") return <path className={classe} d={`M${cx - 5.5},${cy - 7} L${cx},${cy} L${cx + 5.5},${cy - 7}`} />;
  if (p === "pad") return <path className={classe} d={`M${cx - 5.5},${cy + 7} L${cx},${cy} L${cx + 5.5},${cy + 7}`} />;
  if (p === "pam") return <path className={classe} d={`M${cx - 4.5},${cy - 4.5} L${cx + 4.5},${cy + 4.5} M${cx + 4.5},${cy - 4.5} L${cx - 4.5},${cy + 4.5}`} />;
  return <circle className={`${classe} cheio`} cx={cx} cy={cy} r={3.8} />;
}
