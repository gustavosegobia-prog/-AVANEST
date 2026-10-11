import { EIXO_Y } from "@/lib/evolucao/grafico";
import {
  NO_GRAFICO, PARAMETROS, lacunaPadrao, periodosSemMonitorizacao, pontosDe, trechos, type Parametro,
} from "@/lib/evolucao/sinais";
import { montarInfusoes } from "@/lib/evolucao/infusoes";
import {
  COLUNAS_POR_FOLHA, COLUNA_MIN, colunasDeValores, hora, linhasDeGas, linhasDeLiquido, marcasDeEvento, numero,
  pistasDeEventos, textoDaColuna, type Janela,
} from "@/lib/evolucao/impressao";
import type { Registro } from "@/lib/evolucao/registros";

// O bloco do tempo da folha impressa — gases, infusões, líquidos, as linhas de
// SpO₂/EtCO₂/temperatura e o gráfico de 0 a 240 — num SVG só, medido em
// MILÍMETROS. Vetor puro: sai nítido em qualquer impressora e no PDF, e cada
// ponto cai no cruzamento exato de horário e valor, pela mesma régua da tela.
//
// Componente de servidor: nada aqui roda no navegador.

const W = 146;           // largura do bloco
const ROT = 34;          // coluna dos rótulos
const FAIXA = 4.6;       // a tira vertical com o nome da seção (Gases, Infusões…)
const AREA = W - ROT;
const COL = AREA / COLUNAS_POR_FOLHA;
const LINHA = 3.9;
const CAB = 5;
const EVENTOS = 7;          // duas pistas
const GRAFICO = 70;      // 0,29 mm por mmHg

const COR = { pa: "#1d4f91", pam: "#1f2933", fc: "#b42318", estimada: "#8a94a0", grade: "#c9ced6", gradeForte: "#7d8794", texto: "#111" };

export function RegistroImpresso({ vigentes, janela, fimMs, intervalo, chave }: {
  vigentes: readonly Registro[];
  janela: Janela;
  /** Fim da anestesia, ou o horário da impressão com a folha aberta. */
  fimMs: number;
  intervalo: number;
  /** Distingue os ids internos do SVG quando há mais de uma folha na página. */
  chave: string;
}) {
  const x = (ms: number) => ROT + ((ms - janela.inicio) / 60000) * (AREA / (COLUNAS_POR_FOLHA * COLUNA_MIN));
  const dentro = (ms: number) => ms >= janela.inicio && ms < janela.fim;

  const gases = linhasDeGas(vigentes);
  const infusoes = montarInfusoes(vigentes);
  const liquidos = linhasDeLiquido(vigentes);
  const linhasDeInfusao = Math.max(2, infusoes.length);

  // As faixas, de cima para baixo.
  const yGases = CAB;
  const yInf = yGases + gases.length * LINHA;
  const yLiq = yInf + linhasDeInfusao * LINHA;
  const ySinais = yLiq + liquidos.length * LINHA;
  const yEventos = ySinais + 3 * LINHA;
  const yGrafico = yEventos + EVENTOS;
  const H = yGrafico + GRAFICO;
  const y = (v: number) => yGrafico + GRAFICO - ((v - EIXO_Y.min) / (EIXO_Y.max - EIXO_Y.min)) * GRAFICO;

  const colunas = Array.from({ length: COLUNAS_POR_FOLHA + 1 }, (_, i) => janela.inicio + i * COLUNA_MIN * 60000);
  const cincoMin = Array.from({ length: COLUNAS_POR_FOLHA * 3 + 1 }, (_, i) => janela.inicio + i * 5 * 60000);
  const eventos = marcasDeEvento(vigentes).filter((e) => dentro(Date.parse(e.momento)));
  const pistas = pistasDeEventos(eventos.map((e) => x(Date.parse(e.momento))), 3.4);

  const primeiroSinal = vigentes.find((r) => r.tipo === "sinal" && NO_GRAFICO.includes(r.dados.parametro as Parametro));
  const lacunas = primeiroSinal
    ? periodosSemMonitorizacao(vigentes, primeiroSinal.momento, new Date(fimMs).toISOString(), lacunaPadrao(intervalo))
    : [];

  const clip = `impr-area-${chave}`, hachura = `impr-hachura-${chave}`;

  function tira(y0: number, linhas: number, nome: string) {
    const h = linhas * LINHA;
    return (
      <g>
        <line x1={FAIXA} x2={FAIXA} y1={y0} y2={y0 + h} stroke={COR.gradeForte} strokeWidth={0.2} />
        <text x={FAIXA / 2 + 0.6} y={y0 + h / 2} fontSize={1.75} textAnchor="middle" transform={`rotate(-90 ${FAIXA / 2 + 0.6} ${y0 + h / 2})`}>{nome}</text>
      </g>
    );
  }

  /** Um passo que vale até o próximo: o valor escrito na mudança e um traço embaixo. */
  function passos(y0: number, lista: Array<{ ms: number; texto: string; ligado: boolean }>, ate: number, aberto: boolean) {
    return lista.map((p, i) => {
      const fim = i + 1 < lista.length ? lista[i + 1].ms : ate;
      return (
        <g key={`${p.ms}-${i}`}>
          {p.ligado && (
            <line x1={x(p.ms)} x2={x(fim)} y1={y0 + LINHA - 0.6} y2={y0 + LINHA - 0.6} stroke={COR.texto} strokeWidth={0.25}
              strokeDasharray={aberto && i === lista.length - 1 ? "0.8 0.6" : undefined} />
          )}
          <line x1={x(p.ms)} x2={x(p.ms)} y1={y0 + 0.7} y2={y0 + LINHA - 0.35} stroke={COR.texto} strokeWidth={0.25} />
          <text x={x(p.ms) + 0.5} y={y0 + 2.45} fontSize={1.9}>{p.texto}</text>
        </g>
      );
    });
  }

  return (
    <svg className="imprRegistro" width={`${W}mm`} height={`${H}mm`} viewBox={`0 0 ${W} ${H}`}
      role="img" aria-label="Registro anestésico: gases, infusões, líquidos e sinais vitais no tempo"
      fontFamily="Arial, Helvetica, sans-serif" fill={COR.texto}>
      <defs>
        <clipPath id={clip}><rect x={ROT} y={0} width={AREA} height={H} /></clipPath>
        <pattern id={hachura} width={1.4} height={1.4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={1.4} stroke="#b9c0c9" strokeWidth={0.3} />
        </pattern>
      </defs>

      {/* Cabeçalho do tempo */}
      <text x={1} y={3.4} fontSize={2.1} fontWeight={700}>REGISTRO ANESTÉSICO</text>
      <text x={ROT - 1} y={3.4} fontSize={1.9} textAnchor="end">Hora</text>
      {colunas.slice(0, -1).map((ms) => (
        <text key={ms} x={x(ms) + 0.5} y={3.5} fontSize={2} fontWeight={new Date(ms).getUTCMinutes() === 0 ? 700 : 400}>{hora(ms)}</text>
      ))}

      {/* Linhas horizontais das faixas */}
      {Array.from({ length: (yEventos - CAB) / LINHA + 1 }, (_, i) => CAB + i * LINHA).map((yy) => (
        <line key={yy} x1={0} x2={W} y1={yy} y2={yy} stroke={COR.grade} strokeWidth={0.15} />
      ))}
      {[yInf, yLiq, ySinais, yEventos, yGrafico].map((yy) => (
        <line key={`s${yy}`} x1={0} x2={W} y1={yy} y2={yy} stroke={COR.gradeForte} strokeWidth={0.3} />
      ))}

      {/* Gases */}
      {tira(yGases, gases.length, "Gases")}
      {gases.map((g, i) => (
        <text key={g.chave} x={FAIXA + 1} y={yGases + i * LINHA + 2.75} fontSize={2}>{g.rotulo}</text>
      ))}

      {/* Infusões */}
      {tira(yInf, linhasDeInfusao, "Infusões")}
      {infusoes.map((inf, i) => (
        <text key={inf.id} x={FAIXA + 1} y={yInf + i * LINHA + 2.75} fontSize={2}>
          {inf.nome.slice(0, 18)}<tspan fontSize={1.6} fill="#4a5563"> {inf.passos[0]?.unidade ?? ""}</tspan>
        </text>
      ))}

      {/* Líquidos */}
      {tira(yLiq, liquidos.length, "Líquidos")}
      {liquidos.map((l, i) => (
        <g key={`${l.sentido}${l.rotulo}`}>
          <text x={FAIXA + 1} y={yLiq + i * LINHA + 2.75} fontSize={2}>{l.rotulo.slice(0, 20)}</text>
          {l.total > 0 && <text x={ROT - 1} y={yLiq + i * LINHA + 2.75} fontSize={1.8} textAnchor="end">{numero(l.total, 0)} mL</text>}
        </g>
      ))}

      {/* SpO₂, EtCO₂, temperatura */}
      {(["spo2", "etco2", "temp"] as const).map((p, i) => (
        <text key={p} x={1} y={ySinais + i * LINHA + 2.75} fontSize={2}>
          {p === "temp" ? "Temperatura (°C)" : `${PARAMETROS[p].curto} (${PARAMETROS[p].unidade})`}
        </text>
      ))}

      {/* Eixo do gráfico e o código dos símbolos, como no papel */}
      {Array.from({ length: (EIXO_Y.max - EIXO_Y.min) / EIXO_Y.passoFino + 1 }, (_, i) => EIXO_Y.min + i * EIXO_Y.passoFino).map((v) => (
        <g key={`y${v}`}>
          <line x1={ROT} x2={W} y1={y(v)} y2={y(v)} stroke={v % EIXO_Y.passoForte === 0 ? COR.gradeForte : COR.grade}
            strokeWidth={v % EIXO_Y.passoForte === 0 ? 0.2 : 0.08} />
          {v % EIXO_Y.passoForte === 0 && v > 0 && (
            <text x={ROT - 1} y={y(v) + 0.7} fontSize={1.9} textAnchor="end">{v}</text>
          )}
        </g>
      ))}
      <g fontSize={1.9}>
        <text x={1} y={yGrafico + 4} fontWeight={700}>Código</text>
        {[
          { cor: COR.pa, s: "pas" as Parametro, t: "PAS" },
          { cor: COR.pa, s: "pad" as Parametro, t: "PAD" },
          { cor: COR.pam, s: "pam" as Parametro, t: "PAM" },
          { cor: COR.fc, s: "fc" as Parametro, t: "FC" },
        ].map((l, i) => (
          <g key={l.t}>
            <text x={1} y={yGrafico + 8 + i * 4}>{l.t}</text>
            <Simbolo p={l.s} cx={9} cy={yGrafico + 7.3 + i * 4} cor={l.cor} />
          </g>
        ))}
        <text x={1} y={yGrafico + 25}>PAM estimada</text>
        <Simbolo p="pam" cx={20} cy={yGrafico + 24.3} cor={COR.estimada} />
        <text x={1} y={yGrafico + 31}>Anestesia <tspan fontWeight={700}>X</tspan></text>
        <text x={1} y={yGrafico + 35}>Operação <tspan fontWeight={700}>O</tspan></text>
        <rect x={1} y={yGrafico + 38} width={4} height={2.6} fill={`url(#${hachura})`} stroke={COR.grade} strokeWidth={0.1} />
        <text x={6} y={yGrafico + 40.2} fontSize={1.7}>sem registro</text>
      </g>

      <g clipPath={`url(#${clip})`}>
        {lacunas.map((l) => (
          <rect key={l.de} x={x(Date.parse(l.de))} y={yGrafico} width={Math.max(0, x(Date.parse(l.ate)) - x(Date.parse(l.de)))}
            height={GRAFICO} fill={`url(#${hachura})`} />
        ))}

        {/* Grade do tempo: 5 em 5 no gráfico, coluna de 15 em tudo, hora cheia mais forte */}
        {cincoMin.map((ms) => (
          <line key={`m${ms}`} x1={x(ms)} x2={x(ms)} y1={yGrafico} y2={H} stroke={COR.grade} strokeWidth={0.08} />
        ))}
        {colunas.map((ms) => {
          const cheia = new Date(ms).getUTCMinutes() === 0;
          return <line key={`c${ms}`} x1={x(ms)} x2={x(ms)} y1={0} y2={H} stroke={cheia ? COR.gradeForte : COR.grade} strokeWidth={cheia ? 0.3 : 0.18} />;
        })}

        {/* Gases: o valor na mudança */}
        {gases.map((g, i) => passos(
          yGases + i * LINHA,
          g.passos.map((p) => ({ ms: Date.parse(p.momento), texto: numero(p.valor, 1), ligado: p.valor > 0 })),
          fimMs, false,
        ))}

        {/* Infusões: do início ao término confirmado; sem término, tracejado até o último registro */}
        {infusoes.map((inf, i) => {
          const unidade = inf.passos[0]?.unidade;
          return (
            <g key={inf.id}>
              {passos(
                yInf + i * LINHA,
                inf.passos.map((p) => ({ ms: Date.parse(p.momento), texto: `${numero(p.valor, 3)}${p.unidade !== unidade ? ` ${p.unidade}` : ""}`, ligado: p.valor > 0 })),
                Date.parse(inf.fim ?? inf.ultimoRegistro),
                inf.fim === null,
              )}
              {inf.fim
                ? <text x={x(Date.parse(inf.fim)) + 0.4} y={yInf + i * LINHA + 2.45} fontSize={1.6}>fim</text>
                : <text x={x(Date.parse(inf.ultimoRegistro)) + 0.4} y={yInf + i * LINHA + 2.45} fontSize={1.6}>sem término</text>}
            </g>
          );
        })}

        {/* Líquidos: o volume na coluna do horário */}
        {liquidos.map((l, i) => {
          const porColuna = new Map<number, number>();
          for (const it of l.itens) {
            const ms = Date.parse(it.momento);
            if (!dentro(ms)) continue;
            const c = Math.floor((ms - janela.inicio) / (COLUNA_MIN * 60000));
            porColuna.set(c, (porColuna.get(c) ?? 0) + it.volume);
          }
          return [...porColuna].map(([c, v]) => (
            <text key={`${l.rotulo}${c}`} x={ROT + c * COL + COL / 2} y={yLiq + i * LINHA + 2.75} fontSize={2} textAnchor="middle">{numero(v, 0)}</text>
          ));
        })}

        {/* SpO₂, EtCO₂, temperatura: um texto por coluna */}
        {(["spo2", "etco2", "temp"] as const).map((p, i) => colunasDeValores(vigentes, p, janela).map((vals, c) => vals.length > 0 && (
          <text key={`${p}${c}`} x={ROT + c * COL + COL / 2} y={ySinais + i * LINHA + 2.75}
            fontSize={vals.length > 1 ? 1.75 : 2} textAnchor="middle">{textoDaColuna(vals, p === "temp" ? 1 : 0)}</text>
        )))}

        {/* Eventos: X e O dos marcos, números para o resto (a legenda vem embaixo) */}
        {eventos.map((ev, i) => {
          const ex = x(Date.parse(ev.momento));
          const cy = yEventos + 1.9 + pistas[i] * 3.3;
          const marco = ev.simbolo === "X" || ev.simbolo === "O";
          return (
            <g key={ev.id}>
              {marco && <line x1={ex} x2={ex} y1={yGrafico} y2={H} stroke={COR.gradeForte} strokeWidth={0.2} strokeDasharray="0.7 0.7" />}
              {marco
                ? <text x={ex} y={cy + 1} fontSize={2.8} fontWeight={700} textAnchor="middle">{ev.simbolo}</text>
                : (
                  <g>
                    <circle cx={ex} cy={cy} r={1.35} fill="#fff" stroke={COR.texto} strokeWidth={0.2} />
                    <text x={ex} y={cy + 0.6} fontSize={1.7} textAnchor="middle">{ev.simbolo}</text>
                  </g>
                )}
            </g>
          );
        })}

        {/* As curvas: quebram na lacuna, nunca inventam o trecho que ninguém mediu */}
        {NO_GRAFICO.map((p) => {
          const pontos = pontosDe(vigentes, p);
          const cor = p === "fc" ? COR.fc : p === "pam" ? COR.pam : COR.pa;
          const medidos = pontos.filter((pt) => pt.origem !== "estimado");
          return (
            <g key={p}>
              {trechos(p === "pam" ? medidos : pontos, lacunaPadrao(intervalo)).map((tr) => tr.length > 1 && (
                <polyline key={tr[0].id} fill="none" stroke={cor} strokeWidth={0.25} strokeOpacity={0.75}
                  points={tr.map((pt) => `${x(Date.parse(pt.momento))},${y(pt.valor)}`).join(" ")} />
              ))}
              {pontos.filter((pt) => dentro(Date.parse(pt.momento))).map((pt) => (
                <Simbolo key={pt.id} p={p} cx={x(Date.parse(pt.momento))} cy={y(pt.valor)}
                  cor={pt.origem === "estimado" ? COR.estimada : cor} />
              ))}
            </g>
          );
        })}
      </g>

      {/* Moldura */}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke={COR.texto} strokeWidth={0.35} />
      <line x1={ROT} x2={ROT} y1={0} y2={H} stroke={COR.texto} strokeWidth={0.3} />
    </svg>
  );
}

function Simbolo({ p, cx, cy, cor }: { p: Parametro; cx: number; cy: number; cor: string }) {
  const traco = { fill: "none", stroke: cor, strokeWidth: 0.32, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (p === "pas") return <path {...traco} d={`M${cx - 1.1},${cy - 1.4} L${cx},${cy} L${cx + 1.1},${cy - 1.4}`} />;
  if (p === "pad") return <path {...traco} d={`M${cx - 1.1},${cy + 1.4} L${cx},${cy} L${cx + 1.1},${cy + 1.4}`} />;
  if (p === "pam") return <path {...traco} d={`M${cx - 0.9},${cy - 0.9} L${cx + 0.9},${cy + 0.9} M${cx + 0.9},${cy - 0.9} L${cx - 0.9},${cy + 0.9}`} />;
  return <circle cx={cx} cy={cy} r={0.7} fill={cor} />;
}
