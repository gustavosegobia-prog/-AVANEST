"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  EIXO_Y, marcasDeTempo, pontoDoToque, tempoParaX, valorParaY, type Escala,
} from "@/lib/evolucao/grafico";
import {
  EM_LINHA, NO_GRAFICO, PARAMETROS, lacunaPadrao, periodosSemMonitorizacao, pontosDe, trechos,
  type Parametro,
} from "@/lib/evolucao/sinais";
import { linhasDeGas, linhasDeLiquido, marcasDeEvento, pistasDeEventos } from "@/lib/evolucao/impressao";
import { montarInfusoes, type Infusao } from "@/lib/evolucao/infusoes";
import { conferirAlergia } from "@/lib/evolucao/alergias";
import { horaLocal } from "@/lib/data-local";
import type { Registro } from "@/lib/evolucao/registros";

// O registro anestésico da folha: o quadriculado do papel, só que cada toque
// vira registro.
//
// A ordem das faixas é a da folha impressa (components/evolucao/
// registro-impresso.tsx): hora no alto; gases, infusões e líquidos; SpO₂,
// EtCO₂ e temperatura; os eventos; e o gráfico de 0 a 240 — tudo na mesma
// régua de tempo. A geometria é a de lib/evolucao/grafico.ts, a mesma do
// papel: o ponto tocado aqui às 10:35 em 120 mmHg sai impresso no mesmo
// cruzamento.
//
// Tocar numa faixa registra NAQUELE horário (abre a janela já com a hora);
// tocar num valor já lançado abre o registro dele, para ver o histórico,
// corrigir a hora ou excluir.

const FAIXA_HORAS = 22;
const LINHA = 24;          // cada faixa: gases, infusões, líquidos, SpO₂, EtCO₂, temperatura
const FAIXA_EVENTOS = 30;  // duas pistas de marcas
const TIRA = 16;           // a tira vertical com o nome da seção, como no papel
const TOQUE = 18;          // raio de acerto num ponto (dedo com luva)

export type Toque = { ms: number; valor: number };
export type AlvoDaFaixa =
  | { tipo: "gas"; ms: number }
  | { tipo: "infusao"; infusao: Infusao | null; ms: number }
  | { tipo: "liquido"; sentido: "entrada" | "saida"; nome: string; categoria: string; ms: number };

type Marca = { id: string; ms: number; texto: string; ligado: boolean };
type Faixa = {
  chave: string;
  secao: "Gases" | "Infusões" | "Líquidos" | null;
  rotulo: string;
  detalhe: string;
  alerta: boolean;
  /** passos: o valor vale até o próximo (gás, infusão); pontos: um valor por registro (líquido). */
  modo: "passos" | "pontos" | "sinal";
  marcas: Marca[];
  ateMs: number | null;
  /** Infusão ainda correndo na folha aberta: tracejado do último registro até agora. */
  tracejadoAte: number | null;
  parametro?: Parametro;
  alvo: ((ms: number) => AlvoDaFaixa) | null;
};

const fmt = (v: number, casas = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
/** Corta o texto para caber em `px` (fonte de ~`fonte` px). SVG não tem reticências sozinho. */
const caber = (t: string, px: number, fonte = 11) => {
  const max = Math.max(3, Math.floor(px / (fonte * 0.58)));
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const CURTO: Record<string, string> = { Gases: "Gás", Infusões: "Inf.", Líquidos: "Líq." };
const ROTULO_GAS: Record<string, string> = { o2: "O₂ L/min", ar: "Ar L/min", n2o: "N₂O L/min", sevo: "Sevoflurano %" };

export function GraficoSinais({
  atuais, idsPendentes, cabecalho, fimMs, agoraMs, aberta, intervalo, janelaInicio, janelaMinutos,
  alturaGrade, somenteLeitura, onTocar, onTocarLinha, onTocarFaixa, onAbrirPonto, onAbrirRegistro, onMover,
}: {
  atuais: Registro[];
  idsPendentes: Set<string>;
  /** O cabeçalho da folha — para marcar a infusão que coincide com alergia. */
  cabecalho: Record<string, unknown>;
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
  onTocarFaixa: (alvo: AlvoDaFaixa) => void;
  onAbrirPonto: (r: Registro) => void;
  onAbrirRegistro: (r: Registro) => void;
  onMover: (r: Registro, t: Toque) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [largura, setLargura] = useState(800);
  const [arraste, setArraste] = useState<{ registro: Registro; x: number; y: number; ativo: boolean; x0: number; y0: number } | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setLargura(Math.max(520, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A coluna dos rótulos: larga como a do papel quando há espaço.
  const CALHA = largura >= 760 ? 156 : 108;
  const e: Escala = { inicio: janelaInicio, minutos: janelaMinutos, largura: largura - CALHA, altura: alturaGrade };
  const fimJanela = janelaInicio + janelaMinutos * 60000;
  const x = (ms: number) => CALHA + tempoParaX(ms, e);
  const visivel = (ms: number) => ms >= janelaInicio - 60000 && ms <= fimJanela + 60000;
  const porId = useMemo(() => new Map(atuais.map((r) => [r.id, r])), [atuais]);

  // ---- As faixas, na ordem do papel ------------------------------------
  const faixas = useMemo<Faixa[]>(() => {
    const ate = fimMs ?? agoraMs;
    const lista: Faixa[] = [];
    for (const g of linhasDeGas(atuais)) {
      lista.push({
        chave: `gas-${g.chave}`, secao: "Gases", rotulo: ROTULO_GAS[g.chave], detalhe: "", alerta: false, modo: "passos",
        marcas: g.passos.map((p) => ({ id: p.id, ms: Date.parse(p.momento), texto: fmt(p.valor), ligado: p.valor > 0 })),
        ateMs: ate, tracejadoAte: null, alvo: (ms) => ({ tipo: "gas", ms }),
      });
    }
    const infusoes = montarInfusoes(atuais);
    for (const inf of infusoes) {
      const unidade = inf.passos[0]?.unidade ?? "";
      lista.push({
        chave: `inf-${inf.id}`, secao: "Infusões", rotulo: inf.nome, detalhe: "",
        alerta: conferirAlergia(cabecalho, inf.nome) !== null, modo: "passos",
        marcas: [
          ...inf.passos.map((p, k) => ({
            id: p.id ?? inf.id, ms: Date.parse(p.momento), ligado: p.valor > 0,
            texto: `${fmt(p.valor, 3)}${k === 0 || p.unidade !== unidade ? ` ${p.unidade}` : ""}`,
          })),
          ...(inf.fim ? [{ id: inf.fimId ?? inf.id, ms: Date.parse(inf.fim), texto: "fim", ligado: false }] : []),
        ],
        ateMs: Date.parse(inf.fim ?? inf.ultimoRegistro),
        tracejadoAte: !inf.fim && aberta ? agoraMs : null,
        alvo: inf.fim ? null : (ms) => ({ tipo: "infusao", infusao: inf, ms }),
      });
    }
    if (!infusoes.length) {
      lista.push({
        chave: "inf-nenhuma", secao: "Infusões", rotulo: aberta ? "Toque para iniciar" : "Nenhuma", detalhe: "",
        alerta: false, modo: "passos", marcas: [], ateMs: null, tracejadoAte: null,
        alvo: (ms) => ({ tipo: "infusao", infusao: null, ms }),
      });
    }
    for (const l of linhasDeLiquido(atuais)) {
      lista.push({
        chave: `liq-${l.sentido}-${l.rotulo}`, secao: "Líquidos", rotulo: l.rotulo,
        detalhe: l.total > 0 ? `${fmt(l.total, 0)} mL` : "", alerta: false, modo: "pontos",
        marcas: l.itens.map((i) => ({ id: i.id, ms: Date.parse(i.momento), texto: fmt(i.volume, 0), ligado: true })),
        ateMs: null, tracejadoAte: null,
        alvo: (ms) => ({
          tipo: "liquido", sentido: l.sentido, nome: l.rotulo, ms,
          categoria: l.categoria || (l.sentido === "saida" ? "diurese" : "cristaloide"),
        }),
      });
    }
    for (const p of EM_LINHA) {
      lista.push({
        chave: `sinal-${p}`, secao: null, rotulo: `${PARAMETROS[p].curto} ${PARAMETROS[p].unidade}`, detalhe: "",
        alerta: false, modo: "sinal", parametro: p, ateMs: null, tracejadoAte: null, alvo: null,
        marcas: pontosDe(atuais, p).map((pt) => ({
          id: pt.id, ms: Date.parse(pt.momento), ligado: true,
          texto: p === "temp" ? fmt(pt.valor, 1) : String(pt.valor),
        })),
      });
    }
    return lista;
  }, [atuais, cabecalho, fimMs, agoraMs, aberta]);

  const topoEventos = FAIXA_HORAS + faixas.length * LINHA;
  const topoGrade = topoEventos + FAIXA_EVENTOS;
  const altura = topoGrade + alturaGrade + 6;
  const y = (v: number) => topoGrade + valorParaY(v, e);

  const marcasFinas = useMemo(() => marcasDeTempo(janelaInicio, fimJanela, intervalo), [janelaInicio, fimJanela, intervalo]);
  const marcasFortes = useMemo(() => marcasDeTempo(janelaInicio, fimJanela, intervalo * 3), [janelaInicio, fimJanela, intervalo]);
  const series = useMemo(() => NO_GRAFICO.map((p) => ({ p, pontos: pontosDe(atuais, p) })), [atuais]);

  const lacunas = useMemo(() => {
    const primeiro = atuais.find((r) => r.tipo === "sinal" && NO_GRAFICO.includes(r.dados.parametro as Parametro));
    if (!primeiro) return [];
    return periodosSemMonitorizacao(atuais, primeiro.momento, new Date(fimMs ?? agoraMs).toISOString(), lacunaPadrao(intervalo));
  }, [atuais, fimMs, agoraMs, intervalo]);

  // Eventos: X para a anestesia, O para a operação, números para o resto — o código do papel.
  const eventos = marcasDeEvento(atuais).filter((ev) => visivel(Date.parse(ev.momento)));
  const pistas = pistasDeEventos(eventos.map((ev) => x(Date.parse(ev.momento))), 24);

  // As seções (Gases, Infusões, Líquidos) e onde cada uma começa.
  const secoes: Array<{ nome: string; y: number; h: number }> = [];
  faixas.forEach((f, i) => {
    if (!f.secao) return;
    const ult = secoes[secoes.length - 1];
    if (ult && ult.nome === f.secao) ult.h += LINHA;
    else secoes.push({ nome: f.secao, y: FAIXA_HORAS + i * LINHA, h: LINHA });
  });

  function local(ev: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    return { lx: ev.clientX - r.left, ly: ev.clientY - r.top };
  }
  const tempoDoX = (lx: number) => janelaInicio + ((lx - CALHA) / e.largura) * janelaMinutos * 60000;
  const minutoDoX = (lx: number) => Math.min(Math.round(tempoDoX(lx) / 60000) * 60000, agoraMs);

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
    const { lx, ly } = local(ev);
    if (lx < CALHA) return;

    // O gráfico de pressão e FC
    if (ly >= topoGrade) {
      const alvo = pontoNoToque(lx, ly);
      if (alvo) {
        if (somenteLeitura) { onAbrirPonto(alvo); return; }
        (ev.target as Element).setPointerCapture?.(ev.pointerId);
        setArraste({ registro: alvo, x: lx, y: ly, x0: lx, y0: ly, ativo: false });
        return;
      }
      if (!somenteLeitura) onTocar(pontoDoToque(lx - CALHA, ly - topoGrade, e));
      return;
    }

    // A faixa dos eventos: tocar na marca abre o evento
    if (ly >= topoEventos) {
      const perto = eventos.map((m) => ({ m, d: Math.abs(x(Date.parse(m.momento)) - lx) }))
        .filter((o) => o.d <= 14).sort((a, b) => a.d - b.d)[0];
      const r = perto && porId.get(perto.m.id);
      if (r) onAbrirRegistro(r);
      return;
    }

    // As faixas de cima
    if (ly < FAIXA_HORAS) return;
    const f = faixas[Math.floor((ly - FAIXA_HORAS) / LINHA)];
    if (!f) return;
    const perto = f.marcas.filter((m) => visivel(m.ms))
      .map((m) => ({ m, d: Math.abs(x(m.ms) + (f.modo === "passos" ? 10 : 0) - lx) }))
      .filter((o) => o.d <= 16).sort((a, b) => a.d - b.d)[0];
    const r = perto && porId.get(perto.m.id);
    if (r) {
      if (f.modo === "sinal") onAbrirPonto(r); else onAbrirRegistro(r);
      return;
    }
    if (somenteLeitura) return;
    if (f.modo === "sinal" && f.parametro) {
      // A coluna tocada: o meio do intervalo, nunca depois de agora.
      const t0 = Math.floor(tempoDoX(lx) / (intervalo * 60000)) * intervalo * 60000;
      onTocarLinha(f.parametro, Math.round(Math.min(t0 + (intervalo * 60000) / 2, agoraMs) / 60000) * 60000);
      return;
    }
    if (f.alvo) onTocarFaixa(f.alvo(minutoDoX(lx)));
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

  return (
    <div className="evoGraficoCaixa" ref={caixa}>
      <svg
        ref={svg}
        className={`evoGrafico${somenteLeitura ? " leitura" : ""}`}
        width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`}
        onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar}
        onPointerCancel={() => setArraste(null)}
        role="img"
        aria-label="Registro anestésico: gases, infusões, líquidos e sinais vitais no tempo. Toque numa faixa para registrar naquele horário."
      >
        <defs>
          <clipPath id="evoClipArea"><rect x={CALHA} y={0} width={largura - CALHA} height={altura} /></clipPath>
        </defs>

        {/* Fundo das faixas e os rótulos, como na coluna da esquerda do papel */}
        {faixas.map((f, i) => {
          const y0 = FAIXA_HORAS + i * LINHA;
          const x0 = f.secao ? TIRA + 6 : 6;
          const detalheLarg = f.detalhe ? f.detalhe.length * 6 + 6 : 0;
          return (
            <g key={f.chave}>
              <rect className={f.modo === "sinal" ? "evoLinhaFundo" : "evoFaixaFundo"} x={0} y={y0} width={largura} height={LINHA} />
              <line className="evoFaixaDivisa" x1={0} x2={largura} y1={y0 + LINHA} y2={y0 + LINHA} />
              <text className={`evoRotuloLinha${f.alerta ? " alerta" : ""}${f.alvo && !f.marcas.length && f.modo !== "sinal" ? " vazio" : ""}`}
                x={x0} y={y0 + LINHA / 2 + 4}>
                {caber(f.rotulo, CALHA - x0 - 6 - detalheLarg)}
              </text>
              {f.detalhe && <text className="evoDetalheLinha" x={CALHA - 6} y={y0 + LINHA / 2 + 4} textAnchor="end">{f.detalhe}</text>}
            </g>
          );
        })}
        {secoes.map((s) => (
          <g key={s.nome}>
            <rect className="evoTira" x={0} y={s.y} width={TIRA} height={s.h} />
            <text className="evoTiraTexto" x={TIRA / 2 + 4} y={s.y + s.h / 2} textAnchor="middle"
              transform={`rotate(-90 ${TIRA / 2 + 4} ${s.y + s.h / 2})`}>
              {s.h >= 52 ? s.nome : CURTO[s.nome]}
            </text>
          </g>
        ))}
        <line className="evoFaixaDivisa forte" x1={0} x2={largura} y1={topoEventos} y2={topoEventos} />
        <line className="evoFaixaDivisa forte" x1={0} x2={largura} y1={topoGrade} y2={topoGrade} />
        <text className="evoRotuloLinha" x={6} y={FAIXA_HORAS - 7}>Registro anestésico</text>

        <g clipPath="url(#evoClipArea)">
          {/* Sem monitorização: a lacuna aparece, não é preenchida. */}
          {lacunas.map((l) => (
            <rect key={l.de} className="evoLacuna" x={x(Date.parse(l.de))} y={topoGrade}
              width={Math.max(0, x(Date.parse(l.ate)) - x(Date.parse(l.de)))} height={alturaGrade} />
          ))}

          {marcasFinas.map((t) => (
            <line key={`f${t}`} className="evoGradeFina" x1={x(t)} x2={x(t)} y1={FAIXA_HORAS} y2={topoGrade + alturaGrade} />
          ))}
          {marcasFortes.map((t) => (
            <g key={`F${t}`}>
              <line className="evoGradeForte" x1={x(t)} x2={x(t)} y1={FAIXA_HORAS} y2={topoGrade + alturaGrade} />
              <text className="evoHora" x={x(t) + 3} y={FAIXA_HORAS - 7}>{horaLocal(new Date(t))}</text>
            </g>
          ))}

          {/* Gases e infusões: o valor escrito na mudança, e um traço enquanto vale */}
          {faixas.map((f, i) => {
            const y0 = FAIXA_HORAS + i * LINHA;
            if (f.modo === "passos") {
              const ult = f.marcas[f.marcas.length - 1];
              return (
                <g key={`m${f.chave}`} className="evoPassos">
                  {f.marcas.map((m, k) => {
                    const ate = k + 1 < f.marcas.length ? f.marcas[k + 1].ms : f.ateMs ?? m.ms;
                    // Começou antes da janela e ainda vale: o valor fica escrito na borda,
                    // para não ver um traço sem saber de quanto.
                    const emVigorNaBorda = m.ms < janelaInicio && ate > janelaInicio && m.ligado;
                    return (
                      <g key={m.id + k} className={idsPendentes.has(m.id) ? "pendente" : ""}>
                        {m.ligado && <line className="evoPassoTraco" x1={x(m.ms)} x2={x(ate)} y1={y0 + LINHA - 5} y2={y0 + LINHA - 5} />}
                        <line className="evoPassoMarca" x1={x(m.ms)} x2={x(m.ms)} y1={y0 + 4} y2={y0 + LINHA - 3} />
                        <text className={`evoValorLinha${emVigorNaBorda ? " emVigor" : ""}`}
                          x={emVigorNaBorda ? CALHA + 4 : x(m.ms) + 4} y={y0 + LINHA / 2 + 3}>{m.texto}</text>
                      </g>
                    );
                  })}
                  {ult?.ligado && f.tracejadoAte !== null && f.ateMs !== null && f.tracejadoAte > f.ateMs && (
                    <line className="evoPassoTraco aberto" x1={x(f.ateMs)} x2={x(f.tracejadoAte)} y1={y0 + LINHA - 5} y2={y0 + LINHA - 5} />
                  )}
                </g>
              );
            }
            if (f.modo === "pontos") {
              return f.marcas.filter((m) => visivel(m.ms)).map((m) => (
                <text key={m.id} className={`evoValorLinha${idsPendentes.has(m.id) ? " pendente" : ""}`}
                  x={x(m.ms)} y={y0 + LINHA / 2 + 4} textAnchor="middle">{m.texto}</text>
              ));
            }
            // SpO₂, EtCO₂, temperatura: um número por coluna; com o zoom aberto, um a cada tanto.
            return espacados(f.marcas.filter((m) => visivel(m.ms)), (m) => x(m.ms), f.parametro === "temp" ? 34 : 24)
              .filter((m) => x(m.ms) >= CALHA + 12 && x(m.ms) <= largura - 12)
              .map((m) => (
                <text key={m.id} className={`evoValorLinha${idsPendentes.has(m.id) ? " pendente" : ""}`}
                  x={x(m.ms)} y={y0 + LINHA / 2 + 4} textAnchor="middle">{m.texto}</text>
              ));
          })}

          {/* Eventos: as marcas na faixa e a linha dos marcos descendo pelo gráfico */}
          {eventos.map((ev, i) => {
            const ex = x(Date.parse(ev.momento));
            const cy = topoEventos + 9 + pistas[i] * 12;
            const marco = ev.simbolo === "X" || ev.simbolo === "O";
            return (
              <g key={ev.id} className={`evoEvento${idsPendentes.has(ev.id) ? " pendente" : ""}`}>
                {marco && <line x1={ex} x2={ex} y1={topoGrade} y2={topoGrade + alturaGrade} />}
                {marco
                  ? <text className="evoEventoMarco" x={ex} y={cy + 5} textAnchor="middle">{ev.simbolo}</text>
                  : <>
                    <circle className="evoEventoBola" cx={ex} cy={cy} r={7.5} />
                    <text className="evoEventoNumero" x={ex} y={cy + 3.5} textAnchor="middle">{ev.simbolo}</text>
                  </>}
                <title>{`${horaLocal(new Date(ev.momento))} ${ev.rotulo}`}</title>
              </g>
            );
          })}

          {aberta && visivel(agoraMs) && (
            <line className="evoAgora" x1={x(agoraMs)} x2={x(agoraMs)} y1={FAIXA_HORAS} y2={topoGrade + alturaGrade} />
          )}
        </g>

        {/* Eixo vertical do papel: forte a cada 30 */}
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

        {/* O código dos símbolos, na coluna da esquerda como no papel */}
        <g className="evoCodigo">
          <text x={6} y={topoGrade + 16} className="titulo">Código</text>
          {([["pas", "PAS"], ["pad", "PAD"], ["pam", "PAM"], ["fc", "FC"]] as const).map(([p, t], i) => (
            <g key={p}>
              <text x={6} y={topoGrade + 38 + i * 20}>{t}</text>
              <g className={`evoSerie ${p}`}>
                <Simbolo p={p} cx={58} cy={topoGrade + 34 + i * 20 - (p === "pad" ? 3 : p === "pas" ? -3 : 0)} pendente={false} estimado={false} />
              </g>
            </g>
          ))}
          <text x={6} y={topoGrade + 118}>PAM est.</text>
          <g className="evoSerie pam">
            <Simbolo p="pam" cx={72} cy={topoGrade + 114} pendente={false} estimado />
          </g>
          {CALHA >= 140 && <>
            <text x={6} y={topoGrade + 142}>Anestesia <tspan className="forte">X</tspan></text>
            <text x={6} y={topoGrade + 160}>Operação <tspan className="forte">O</tspan></text>
            <rect className="evoLacuna" x={6} y={topoGrade + 172} width={14} height={10} />
            <text x={24} y={topoGrade + 181}>sem registro</text>
          </>}
        </g>

        <g clipPath="url(#evoClipArea)">
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
        <line className="evoBorda" x1={CALHA} x2={CALHA} y1={0} y2={topoGrade + alturaGrade} />
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
