"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  EIXO_Y, marcasDeTempo, pontoDoToque, tempoParaX, valorParaY, yParaValor, type Escala,
} from "@/lib/evolucao/grafico";
import {
  EM_LINHA, NO_GRAFICO, PARAMETROS, lacunaPadrao, marcaForte, periodosSemMonitorizacao, pontosDe, trechos,
  type ColunaPronta, type Parametro, type Rascunho,
} from "@/lib/evolucao/sinais";
import { linhasDeGas, linhasDeLiquido, marcasDeEvento, pistasDeEventos } from "@/lib/evolucao/impressao";
import { INFUSOES_DA_FOLHA, LIQUIDOS_DA_FOLHA } from "@/lib/evolucao/lista-da-folha";
import { mesmoFarmaco, mesmoMedicamento } from "@/lib/evolucao/medicamentos";
import { LIQUIDOS_RAPIDOS } from "@/lib/evolucao/liquidos";
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
//
// A LINHA PRONTA. Em cada coluna do intervalo da folha (3, 5, 10 ou 15 min)
// que ainda não tem PAS, PAD, PAM ou FC, o ponto já aparece tracejado, com o último
// valor de cada uma (a PAM, com PAS e PAD na coluna, a estimada delas) (lib/evolucao/sinais.ts, `colunasProntas`). O médico
// arrasta o ponto para cima ou para baixo até o valor do monitor e solta: vira
// registro no horário daquela coluna — e a coluna seguinte continua lá para o
// próximo. Tocar sem arrastar lança o mesmo valor. Nada grava antes de soltar.

const FAIXA_HORAS = 22;
const LINHA = 24;          // cada faixa: gases, infusões, líquidos, SpO₂, EtCO₂, temperatura
const FAIXA_EVENTOS = 30;  // duas pistas de marcas
const TIRA = 16;           // a tira vertical com o nome da seção, como no papel
const TOQUE = 18;          // raio de acerto num ponto (dedo com luva)

export type Toque = { ms: number; valor: number };
export type AlvoDaFaixa =
  | { tipo: "gas"; ms: number }
  | { tipo: "infusao"; infusao: Infusao | null; nome?: string; ms: number }
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
  alturaGrade, somenteLeitura, colunas = [], onTocar, onTocarLinha, onTocarFaixa, onAbrirPonto, onAbrirRegistro, onMover,
  onLancar,
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
  /** A linha pronta, coluna a coluna do intervalo (vazia: nada a arrastar). */
  colunas?: ColunaPronta[];
  /**
   * Soltou (ou tocou) um ponto da linha pronta: registra no horário da coluna.
   * `estimada`: a PAM calculada, lançada sem arrastar — grava como estimada.
   */
  onLancar?: (p: Parametro, valor: number, ms: number, estimada: boolean) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [largura, setLargura] = useState(800);
  const [arraste, setArraste] = useState<{ registro: Registro; x: number; y: number; ativo: boolean; x0: number; y0: number } | null>(null);
  const [puxando, setPuxando] = useState<{ p: Parametro; ms: number; y: number; y0: number; ativo: boolean } | null>(null);

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
    // Gases: O₂, ar e sevoflurano sempre, como no papel; N₂O só se usado.
    const gases = linhasDeGas(atuais);
    for (const chave of ["o2", "ar", "n2o", "sevo"] as const) {
      const g = gases.find((x) => x.chave === chave);
      if (!g && chave === "n2o") continue;
      lista.push({
        chave: `gas-${chave}`, secao: "Gases", rotulo: ROTULO_GAS[chave], detalhe: "", alerta: false, modo: "passos",
        marcas: (g?.passos ?? []).map((p) => ({ id: p.id, ms: Date.parse(p.momento), texto: fmt(p.valor), ligado: p.valor > 0 })),
        ateMs: ate, tracejadoAte: null, alvo: (ms) => ({ tipo: "gas", ms }),
      });
    }

    // Infusões: uma faixa por fármaco. As de sempre vêm escritas (folha aberta),
    // como as linhas pré-impressas do papel; as outras entram quando iniciadas.
    const infusoes = montarInfusoes(atuais);
    const nomes = [...(aberta ? INFUSOES_DA_FOLHA : [])];
    for (const inf of infusoes) if (!nomes.some((n) => mesmoFarmaco(n, inf.nome))) nomes.push(inf.nome);
    for (const nome of nomes) {
      const doFarmaco = infusoes.filter((inf) => mesmoFarmaco(inf.nome, nome));
      const correndo = doFarmaco.find((inf) => !inf.fim) ?? null;
      const ultima = doFarmaco[doFarmaco.length - 1];
      const marcas: Marca[] = [];
      for (const inf of doFarmaco) {
        const unidade = inf.passos[0]?.unidade ?? "";
        inf.passos.forEach((p, k) => marcas.push({
          id: p.id ?? inf.id, ms: Date.parse(p.momento), ligado: p.valor > 0,
          texto: `${fmt(p.valor, 3)}${k === 0 || p.unidade !== unidade ? ` ${p.unidade}` : ""}`,
        }));
        if (inf.fim) marcas.push({ id: inf.fimId ?? inf.id, ms: Date.parse(inf.fim), texto: "fim", ligado: false });
      }
      lista.push({
        chave: `inf-${nome}`, secao: "Infusões", rotulo: doFarmaco[0]?.nome ?? nome, detalhe: "",
        alerta: conferirAlergia(cabecalho, nome) !== null, modo: "passos", marcas,
        ateMs: ultima ? Date.parse(ultima.fim ?? ultima.ultimoRegistro) : null,
        tracejadoAte: correndo && aberta ? agoraMs : null,
        alvo: (ms) => (correndo
          ? { tipo: "infusao", infusao: correndo, ms }
          : { tipo: "infusao", infusao: null, nome: doFarmaco[0]?.nome ?? nome, ms }),
      });
    }
    if (!nomes.length) {
      lista.push({
        chave: "inf-nenhuma", secao: "Infusões", rotulo: "Nenhuma", detalhe: "",
        alerta: false, modo: "passos", marcas: [], ateMs: null, tracejadoAte: null, alvo: null,
      });
    }

    // Líquidos: SF 0,9% e Ringer escritos como no papel; as outras soluções e as
    // perdas quando houver. A diurese desce para junto da temperatura.
    const liquidos = linhasDeLiquido(atuais);
    const fixos = aberta ? LIQUIDOS_DA_FOLHA : [];
    const linhasLiq = [
      ...fixos.map((nome) => liquidos.find((l) => l.sentido === "entrada" && mesmoMedicamento(l.rotulo, nome))
        ?? { rotulo: nome, sentido: "entrada" as const, total: 0, categoria: "cristaloide", itens: [] }),
      ...liquidos.filter((l) => l.rotulo !== "Diurese" && !(l.sentido === "entrada" && fixos.some((n) => mesmoMedicamento(n, l.rotulo)))),
    ];
    const faixaDeLiquido = (l: (typeof linhasLiq)[number], secao: Faixa["secao"]): Faixa => ({
      chave: `liq-${l.sentido}-${l.rotulo}`, secao,
      rotulo: LIQUIDOS_RAPIDOS.find((r) => mesmoMedicamento(r.nome, l.rotulo))?.curto ?? l.rotulo,
      detalhe: l.total > 0 ? `${fmt(l.total, 0)} mL` : "", alerta: false, modo: "pontos",
      marcas: l.itens.map((i) => ({ id: i.id, ms: Date.parse(i.momento), texto: fmt(i.volume, 0), ligado: true })),
      ateMs: null, tracejadoAte: null,
      alvo: (ms) => ({
        tipo: "liquido", sentido: l.sentido, nome: l.rotulo, ms,
        categoria: l.categoria || (l.sentido === "saida" ? "diurese" : "cristaloide"),
      }),
    });
    for (const l of linhasLiq) lista.push(faixaDeLiquido(l, "Líquidos"));

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
    const diurese = liquidos.find((l) => l.rotulo === "Diurese")
      ?? { rotulo: "Diurese", sentido: "saida" as const, total: 0, categoria: "diurese", itens: [] };
    lista.push(faixaDeLiquido(diurese, null));
    return lista;
  }, [atuais, cabecalho, fimMs, agoraMs, aberta]);

  const topoEventos = FAIXA_HORAS + faixas.length * LINHA;
  const topoGrade = topoEventos + FAIXA_EVENTOS;
  const altura = topoGrade + alturaGrade + 6;
  const y = (v: number) => topoGrade + valorParaY(v, e);

  const marcasFinas = useMemo(() => marcasDeTempo(janelaInicio, fimJanela, intervalo), [janelaInicio, fimJanela, intervalo]);
  const marcasFortes = useMemo(() => marcasDeTempo(janelaInicio, fimJanela, marcaForte(intervalo)), [janelaInicio, fimJanela, intervalo]);
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
    return pontoMaisPerto(lx, ly)?.r ?? null;
  }
  function pontoMaisPerto(lx: number, ly: number): { r: Registro; d: number } | null {
    let melhor: { r: Registro; d: number } | null = null;
    for (const s of series) {
      for (const pt of s.pontos) {
        const t = Date.parse(pt.momento);
        if (t < janelaInicio || t > fimJanela) continue;
        const d = Math.hypot(x(t) - lx, y(pt.valor) - ly);
        if (d <= TOQUE && (!melhor || d < melhor.d)) melhor = { r: porId.get(pt.id)!, d };
      }
    }
    return melhor;
  }

  // O QUE O DEDO TOCOU. Toque de verdade é o que desce e sobe no mesmo lugar:
  // quem desliza o dedo sobre o gráfico está rolando a página, e antes a janela
  // abria já no primeiro contato — no meio da rolagem, uma "Iniciar infusão"
  // que ninguém pediu. Agora o toque só vale quando o dedo sobe sem ter
  // andado; só um ponto (da linha pronta ou já lançado) segura o dedo para
  // arrastar, e o resto da área rola a página normalmente.
  const toqueSimples = useRef<{ lx: number; ly: number; x0: number; y0: number } | null>(null);
  const segurarDedo = useRef(false);
  const ANDOU = 10;

  // Prende o dedo no próprio gráfico (e não no traço desenhado embaixo dele):
  // o Safari recusa a captura em alguns elementos internos do SVG, e uma
  // recusa aqui não pode derrubar o toque inteiro.
  function prender(ev: React.PointerEvent<SVGSVGElement>) {
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* segue sem captura */ }
  }

  function aoPressionar(ev: React.PointerEvent<SVGSVGElement>) {
    const { lx, ly } = local(ev);
    if (lx < CALHA) return;
    // No mouse, o toque abre janelas: sem isto, o mousedown tira o foco do campo
    // que a janela acabou de focar. No dedo isso fica com o onTouchEnd.
    if (ev.pointerType === "mouse") ev.preventDefault();

    // O gráfico de pressão e FC: os pontos se arrastam desde o primeiro contato.
    // Ponto pronto e ponto lançado lado a lado: vale o mais perto do dedo.
    if (ly >= topoGrade) {
      const pronto = prontoNoToque(lx, ly);
      const lancado = somenteLeitura ? null : pontoMaisPerto(lx, ly);
      if (pronto && (!lancado || pronto.d <= lancado.d)) {
        prender(ev);
        setPuxando({ p: pronto.r.parametro, ms: pronto.ms, y: y(pronto.r.valor), y0: ly, ativo: false });
        return;
      }
      if (lancado) {
        prender(ev);
        setArraste({ registro: lancado.r, x: lx, y: ly, x0: lx, y0: ly, ativo: false });
        return;
      }
    }
    // O resto espera o dedo subir.
    toqueSimples.current = { lx, ly, x0: ev.clientX, y0: ev.clientY };
  }

  /** O toque que desceu e subiu no mesmo lugar: abre o que estava ali. */
  function tocar(lx: number, ly: number) {
    // O gráfico de pressão e FC
    if (ly >= topoGrade) {
      const alvo = pontoNoToque(lx, ly);
      if (alvo) { onAbrirPonto(alvo); return; }
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

  // A linha pronta: em cada coluna do intervalo à vista, um ponto por
  // parâmetro. A última coluna é a de agora — só ela leva os números ao lado.
  const xColuna = (ms: number) => Math.min(Math.max(x(ms), CALHA + 8), largura - 8);
  const prontas = !somenteLeitura && aberta ? colunas.filter((c) => visivel(c.ms)) : [];
  const ultimaPronta = prontas.length && prontas[prontas.length - 1].ms === colunas[colunas.length - 1]?.ms
    ? prontas[prontas.length - 1] : null;
  // O alvo de cada ponto não invade a coluna vizinha (zoom de 4 h, folha de 3 min).
  const passoPx = (intervalo / janelaMinutos) * e.largura;
  const raioAlvo = Math.max(6, Math.min(TOQUE - 4, passoPx / 2 - 1));

  // No celular o gráfico é mais largo que a tela e rola de lado. A coluna de
  // agora — onde está a linha pronta — tem de estar à vista sem o médico
  // procurar: a caixa rola até ela quando a janela muda.
  const xAgora = aberta && visivel(agoraMs) ? Math.round(x(agoraMs)) : null;
  useEffect(() => {
    const el = caixa.current;
    if (!el || xAgora === null || el.scrollWidth <= el.clientWidth + 1) return;
    const alvo = Math.max(0, xAgora - el.clientWidth + 72);
    if (xAgora < el.scrollLeft + CALHA || xAgora > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = alvo;
  }, [xAgora, janelaInicio, janelaMinutos, CALHA]);
  const valorDoY = (p: Parametro, py: number) => {
    const v = Math.round(yParaValor(py - topoGrade, e));
    return Math.min(Math.min(PARAMETROS[p].max, EIXO_Y.max), Math.max(Math.max(PARAMETROS[p].min, EIXO_Y.min), v));
  };
  function prontoNoToque(lx: number, ly: number): { r: Rascunho; ms: number; d: number } | null {
    let melhor: { r: Rascunho; ms: number; d: number } | null = null;
    for (const c of prontas) {
      const cx = xColuna(c.ms);
      if (Math.abs(cx - lx) > TOQUE + 6) continue;
      for (const r of c.itens) {
        const d = Math.hypot(cx - lx, y(r.valor) - ly);
        if (d <= TOQUE + 4 && (!melhor || d < melhor.d)) melhor = { r, ms: c.ms, d };
      }
    }
    return melhor;
  }

  /** Este ponto do gráfico se arrasta? (linha pronta ou ponto já lançado) */
  function arrastavel(lx: number, ly: number): boolean {
    if (somenteLeitura || lx < CALHA || ly < topoGrade) return false;
    return Boolean(prontoNoToque(lx, ly) || pontoNoToque(lx, ly));
  }

  // O dedo que começa num ponto arrastável não rola a página; os outros rolam.
  // Precisa ser ouvinte nativo e não passivo: é o único jeito de o
  // preventDefault segurar a rolagem no iPhone e no Android.
  const ehArrastavel = useEffectEvent((lx: number, ly: number) => arrastavel(lx, ly));
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const inicio = (ev: TouchEvent) => {
      const t = ev.touches[0];
      const r = el.getBoundingClientRect();
      segurarDedo.current = ev.touches.length === 1 && Boolean(t) && ehArrastavel(t.clientX - r.left, t.clientY - r.top);
    };
    const mover = (ev: TouchEvent) => { if (segurarDedo.current && ev.cancelable) ev.preventDefault(); };
    const fim = () => { segurarDedo.current = false; };
    el.addEventListener("touchstart", inicio, { passive: true });
    el.addEventListener("touchmove", mover, { passive: false });
    el.addEventListener("touchend", fim);
    el.addEventListener("touchcancel", fim);
    return () => {
      el.removeEventListener("touchstart", inicio);
      el.removeEventListener("touchmove", mover);
      el.removeEventListener("touchend", fim);
      el.removeEventListener("touchcancel", fim);
    };
  }, []);
  function aoMover(ev: React.PointerEvent<SVGSVGElement>) {
    const t = toqueSimples.current;
    if (t && Math.hypot(ev.clientX - t.x0, ev.clientY - t.y0) > ANDOU) toqueSimples.current = null;
    if (puxando) {
      const { ly } = local(ev);
      const yLimitado = Math.min(topoGrade + alturaGrade, Math.max(topoGrade, ly));
      setPuxando({ ...puxando, y: puxando.ativo ? yLimitado : Math.abs(ly - puxando.y0) > 4 ? yLimitado : puxando.y,
        ativo: puxando.ativo || Math.abs(ly - puxando.y0) > 4 });
      return;
    }
    if (!arraste) return;
    const { lx, ly } = local(ev);
    const ativo = arraste.ativo || Math.hypot(lx - arraste.x0, ly - arraste.y0) > 6;
    setArraste({ ...arraste, x: lx, y: ly, ativo });
  }

  function aoSoltar() {
    const t = toqueSimples.current;
    toqueSimples.current = null;
    if (t) { tocar(t.lx, t.ly); return; }
    if (puxando) {
      const r = prontas.find((c) => c.ms === puxando.ms)?.itens.find((x) => x.parametro === puxando.p);
      // O ponto neutro só vale arrastado; um toque nele abre a janela de sinais.
      if (r && !puxando.ativo && r.origem === "padrao") onTocar({ ms: puxando.ms, valor: r.valor });
      else if (r) onLancar?.(r.parametro, puxando.ativo ? valorDoY(r.parametro, puxando.y) : r.valor, puxando.ms, !puxando.ativo && Boolean(r.estimada));
      setPuxando(null);
      return;
    }
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
        // O navegador assumiu o gesto (rolagem): não era toque nem arraste.
        onPointerCancel={() => { toqueSimples.current = null; setArraste(null); setPuxando(null); }}
        // No toque, o navegador ainda solta um clique no mesmo lugar depois de
        // a janela abrir — e ele caía num campo (ou botão) da janela.
        onTouchEnd={(ev) => { if (ev.cancelable) ev.preventDefault(); }}
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
              <rect className={f.secao === null ? "evoLinhaFundo" : "evoFaixaFundo"} x={0} y={y0} width={largura} height={LINHA} />
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
          {prontas.length > 0 && (() => {
            const puxado = (ms: number, p: Parametro) => puxando?.ms === ms && puxando.p === p;
            const cyDe = (ms: number, r: Rascunho) => (puxado(ms, r.parametro) ? puxando!.y : y(r.valor));
            // Os números ao lado não se encostam: PAD e FC costumam ficar a
            // poucos pixels um do outro, e os rótulos se empurram para longe.
            const yRotulo = new Map<string, number>();
            for (const c of prontas) {
              const alturas = c.itens.map((r) => ({ p: r.parametro, cy: cyDe(c.ms, r) })).sort((a, b) => a.cy - b.cy);
              let acima = -Infinity;
              for (const a of alturas) { const ry = Math.max(a.cy + 4, acima + 13); yRotulo.set(`${c.ms}${a.p}`, ry); acima = ry; }
            }
            // De onde sai o tracejado de cada ponto: o lançado ou o pronto logo antes.
            const antes = (p: Parametro, ms: number): { x: number; y: number } | null => {
              const lancado = series.find((s) => s.p === p)?.pontos.filter((pt) => Date.parse(pt.momento) < ms).pop();
              const tLancado = lancado ? Date.parse(lancado.momento) : -Infinity;
              const pronto = [...prontas].reverse().find((c) => c.ms < ms && c.ms > tLancado && c.itens.some((r) => r.parametro === p));
              if (pronto) return { x: xColuna(pronto.ms), y: cyDe(pronto.ms, pronto.itens.find((r) => r.parametro === p)!) };
              return lancado ? { x: x(tLancado), y: y(lancado.valor) } : null;
            };
            return (
            <g className="evoProntos">
              {ultimaPronta && <line className="evoProntoGuia" x1={xColuna(ultimaPronta.ms)} x2={xColuna(ultimaPronta.ms)} y1={topoGrade} y2={topoGrade + alturaGrade} />}
              {prontas.map((c) => {
                const cx = xColuna(c.ms);
                const ultima = c === ultimaPronta;
                return c.itens.map((r) => {
                  const cy = cyDe(c.ms, r);
                  const arrastando = puxado(c.ms, r.parametro) && puxando!.ativo;
                  // Perto da borda direita o número vai para o lado de dentro
                  // (arrastando, ele leva o nome e fica mais largo).
                  const aEsquerda = cx > largura - (arrastando ? 72 : 44);
                  const valor = arrastando ? valorDoY(r.parametro, cy) : r.valor;
                  const de = antes(r.parametro, c.ms);
                  return (
                    <g key={`${c.ms}${r.parametro}`}
                      className={`evoSerie ${r.parametro} pronto${r.origem === "padrao" ? " neutro" : ""}${ultima ? "" : " antiga"}${arrastando ? " puxando" : ""}`}>
                      {de && <line className="evoProntoLigacao" x1={de.x} y1={de.y} x2={cx} y2={cy} />}
                      <circle className="evoProntoAlvo" cx={cx} cy={cy} r={ultima || arrastando ? TOQUE - 4 : raioAlvo} />
                      <Simbolo p={r.parametro} cx={cx} cy={cy} pendente={false} estimado={false} />
                      {(ultima || arrastando) && (
                        <text className="evoProntoValor" x={aEsquerda ? cx - 16 : cx + 16} y={yRotulo.get(`${c.ms}${r.parametro}`) ?? cy + 4}
                          textAnchor={aEsquerda ? "end" : "start"}>
                          {arrastando ? `${PARAMETROS[r.parametro].curto} ${valor}` : r.origem === "padrao" ? `${PARAMETROS[r.parametro].curto} ?` : valor}
                        </text>
                      )}
                    </g>
                  );
                });
              })}
            </g>
            );
          })()}
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
