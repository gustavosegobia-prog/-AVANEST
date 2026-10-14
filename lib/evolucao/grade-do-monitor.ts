// A TABELA DO MONITOR, PELA POSIÇÃO DE CADA PALAVRA.
//
// A foto da tela de tendências não chega como texto em linhas: o OCR devolve
// palavras soltas, cada uma com o seu retângulo, e lê mal o número miúdo no
// meio do reflexo e da grade. Então a leitura vai em duas etapas:
//
// 1. `planejar`: das palavras da foto inteira, acha o desenho da tabela —
//    onde estão os horários, os nomes dos parâmetros e as colunas — e devolve
//    a lista de células a reler, cada uma com o seu retângulo.
// 2. `montar`: com o texto relido de cada célula (recortada, ampliada, só com
//    os caracteres que cabem nela — foto-do-monitor.ts), monta as linhas
//    hora → valores, conferindo o que é plausível.
//
// Dois desenhos de tela:
//
// - DEITADA: os horários no alto, um por coluna, e um parâmetro por linha
//   (FC, SpO₂, PNI…), com o nome na margem esquerda. É a "Tend tabulares".
//   Na PNI, a hora da aferição costuma vir num selo embaixo do valor
//   ("[08:05]"): a PA vai para essa hora, e não para a da coluna.
// - EM LINHAS: uma medida por linha, com as colunas nomeadas no alto
//   (SIS DIA PAM FP HORA) e a data e a hora na própria linha. É a "Revisão
//   de PNI".
//
// Tudo em coordenadas de 0 a 1 da foto: não depende do tamanho da imagem.

import type { LinhaDoMonitor } from "./monitor.ts";
import { valorPlausivel, type Parametro } from "./sinais.ts";

/**
 * O que a releitura devolve quando o recorte da hora tem o selo escuro da PNI
 * mas a hora dentro dele não se lê: há selo, só não dá para saber a hora.
 */
export const SELO_ILEGIVEL = "[selo]";

export type Palavra = { t: string; x0: number; y0: number; x1: number; y1: number; c: number };
export type Caixa = { x0: number; y0: number; x1: number; y1: number };
/** O que pode aparecer na célula: só algarismos, a pressão (120/80(93)), a hora, ou o nome do parâmetro. */
export type Alfabeto = "numero" | "pressao" | "hora" | "rotulo";
export type Celula = { id: string; caixa: Caixa; alfabeto: Alfabeto; primeiraLeitura: string };
type OQue = Parametro | "pressao" | "pulso";
export type LinhaDoPlano = {
  hora: string | null;
  celulaDaHora?: string;
  /** Na tabela deitada: a coluna (horário do alto) de onde a linha veio. */
  coluna?: number;
  /** Linha a mais na ponta da tabela, por via das dúvidas: só fica se a hora for lida. */
  especulativa?: boolean;
  valores: Array<{ oque: OQue; celula: string }>;
};
export type Plano = {
  forma: "deitada" | "em-linhas";
  celulas: Celula[];
  linhas: LinhaDoPlano[];
  /** Na tabela deitada: os horários do alto, na ordem (null onde não deu para ler). */
  colunas?: Array<string | null>;
  /**
   * Nomes da margem que a foto inteira não leu ("o" no lugar de "PNI"): a
   * releitura deles volta em `planejar(palavras, rotulos)`, que refaz o plano.
   */
  rotulosDuvidosos?: Celula[];
};

const cx = (w: Caixa) => (w.x0 + w.x1) / 2;
const cy = (w: Caixa) => (w.y0 + w.y1) / 2;
const alt = (w: Caixa) => w.y1 - w.y0;
const mediana = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};
const quantil = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * q)))];
};
const limitar = (c: Caixa): Caixa => ({
  x0: Math.max(0, c.x0), y0: Math.max(0, c.y0), x1: Math.min(1, c.x1), y1: Math.min(1, c.y1),
});

// ---- O texto de cada palavra ------------------------------------------------

/** A hora escrita na palavra ("08:15", "[08:25]", "08.35"). Sem separador só quando `solta`. */
export function horaDoTexto(t: string, solta = false): string | null {
  // A data na mesma célula ("2026-03-02 09:42") sai antes: "03-02" não é hora.
  const s = t.replace(/[Oo]/g, "0").replace(/[lI|]/g, "1")
    .replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|20\d\d[-/.]\d{0,2}[-/.]?\d{0,2}/g, " ")
    .replace(/\s+/g, " ");
  // Com dois-pontos, os dois algarismos colados antes dele são a hora — mesmo
  // grudados no resto da data ("-03-0209:39"). Com ponto, vírgula ou traço
  // ("[08-25", "08.35"), só a hora solta: senão pega data e decimal.
  const comDoisPontos = [...s.matchAll(/(\d{1,2}) ?[:;h] ?(\d{2})(?!\d)/g)];
  const outras = [...s.matchAll(/(?:^|[^\d])(\d{1,2})[.,-](\d{2})(?![\d])/g)];
  let m: RegExpMatchArray | undefined = comDoisPontos[comDoisPontos.length - 1] ?? outras[outras.length - 1];
  // Sem separador ("1015"), só a célula que é só hora.
  if (!m && solta) m = s.match(/^\D*(\d{2})(\d{2})\D*$/) ?? undefined;
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** A data na linha ("2026-03-02", "02/03/2026", ou o começo dela, "2026-0"). */
const ehData = (t: string) => /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(t) || /^20\d\d([-/.]\d{0,2})*$/.test(t);

/** O que o OCR troca nos algarismos de tela. */
const algarismos = (t: string) => t.replace(/[OoDQ]/g, "0").replace(/[lI|!]/g, "1").replace(/[Ss]/g, "5")
  .replace(/B/g, "8").replace(/[Zz]/g, "2").replace(/G/g, "6");

const limpo = (t: string) => t.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

/** O nome do parâmetro na margem da tabela deitada. */
function rotuloDaLinha(t: string): OQue | "outro" | null {
  const s = limpo(t);
  if (!s) return null;
  if (/^(fc|hr|fcard)$/.test(s)) return "fc";
  if (/^(fp|pr|pulso|pulse)$/.test(s)) return "pulso";
  if (/^sp[o0][2z]?$|^sat(o2)?$/.test(s)) return "spo2";
  if (/^(pni|nibp|nbp|pani|art|ibp|abp|pai|pa)$/.test(s)) return "pressao";
  if (/^(etco2|co2|etc02|eco2|etco)$/.test(s)) return "etco2";
  if (/^(t|t1|temp|tc|tmp)$/.test(s)) return "temp";
  if (/^(ip|pi|fr|rr|resp|awrr|bis|mac|st|pvc|ecg)$/.test(s)) return "outro";
  return null;
}

/** A unidade embaixo do nome (bpm, %, mmHg) ou a fonte do sinal: não é linha da tabela. */
const ehUnidade = (t: string) => {
  const s = limpo(t);
  return !s || /^(bpm|mmhg|mmh|mm|rpm|ipm|kpa|fonte.*|c)$/.test(s);
};

/** O nome da coluna na tabela em linhas. */
function rotuloDaColuna(t: string): OQue | "hora" | null {
  const s = limpo(t);
  if (/^(sis|sys|pas|sist|sistolica)$/.test(s)) return "pas";
  if (/^(dia|pad|diast|diastolica)$/.test(s)) return "pad";
  if (/^(pam|map|med|mean|media)$/.test(s)) return "pam";
  if (/^(fp|pr|pulso|pulse)$/.test(s)) return "pulso";
  if (/^(fc|hr)$/.test(s)) return "fc";
  if (/^sp[o0][2z]?$/.test(s)) return "spo2";
  if (/^(hora|time|horario|data|date)$/.test(s)) return "hora";
  return null;
}

// ---- As duas leituras da foto, numa lista só ---------------------------------

const sobrepoe = (a: Caixa, b: Caixa) => {
  const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (ix <= 0 || iy <= 0) return 0;
  const area = (c: Caixa) => (c.x1 - c.x0) * (c.y1 - c.y0);
  return (ix * iy) / Math.min(area(a), area(b));
};
const pesoDaPalavra = (w: Palavra) => w.c + (horaDoTexto(w.t) ? 40 : 0)
  + (/^[\d/():.,\[\]-]+$/.test(w.t) ? 15 : /\d/.test(w.t) ? 5 : 0);

/**
 * A foto lida duas vezes (como veio e tratada) dá duas listas. A mesma
 * palavra lida nas duas fica uma vez só — a de mais confiança, e a que é hora
 * ou número antes de um rabisco no mesmo lugar.
 */
export function juntarPalavras(...listas: Palavra[][]): Palavra[] {
  const saida: Palavra[] = [];
  for (const lista of listas) {
    for (const w of lista) {
      if (!w.t.trim() || w.x1 <= w.x0 || w.y1 <= w.y0) continue;
      const i = saida.findIndex((o) => sobrepoe(o, w) > 0.6);
      if (i < 0) saida.push(w);
      else if (pesoDaPalavra(w) > pesoDaPalavra(saida[i])) saida[i] = w;
    }
  }
  return saida;
}

// ---- O desenho da tabela -------------------------------------------------------

/** A reta y = a + b·x pelos pontos (mínimos quadrados); sem pontos que bastem, a altura dada. */
function retaPor(pontos: Array<[number, number]>, padrao: number): (x: number) => number {
  if (!pontos.length) return () => padrao;
  const mx = pontos.reduce((s, p) => s + p[0], 0) / pontos.length;
  const my = pontos.reduce((s, p) => s + p[1], 0) / pontos.length;
  const vx = pontos.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
  if (pontos.length < 2 || vx < 0.01) return () => my;
  const b = Math.max(-0.1, Math.min(0.1, pontos.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / vx));
  return (x) => my + b * (x - mx);
}

/** Agrupa pela chave (y para uma linha, x para uma coluna): vizinhos a menos de `tol`. */
function grupos<T>(itens: T[], chave: (t: T) => number, tol: number): T[][] {
  const ord = [...itens].sort((a, b) => chave(a) - chave(b));
  const saida: T[][] = [];
  for (const it of ord) {
    const g = saida[saida.length - 1];
    if (g && chave(it) - chave(g[g.length - 1]) <= tol) g.push(it);
    else saida.push([it]);
  }
  return saida;
}

type Hora = { w: Palavra; h: string };

export function planejar(entrada: Palavra[], rotulos?: Record<string, string[]>): Plano | null {
  const palavras = entrada.filter((w) => w.t.trim() && w.x1 > w.x0 && w.y1 > w.y0);
  if (palavras.length < 4) return null;
  const altura = mediana(palavras.map(alt)) || 0.02;
  const horas: Hora[] = palavras.flatMap((w) => {
    const h = horaDoTexto(w.t);
    return h && !ehData(w.t) ? [{ w, h }] : [];
  });

  // Horários lado a lado (mesma altura) ou um embaixo do outro (mesmo x).
  const distintas = (g: Hora[]) => new Set(g.map((o) => o.h)).size;
  const naLinha = grupos(horas, (o) => cy(o.w), altura * 0.8)
    .filter((g) => distintas(g) >= 2 && Math.max(...g.map((o) => cx(o.w))) - Math.min(...g.map((o) => cx(o.w))) > 0.2)
    .sort((a, b) => distintas(b) - distintas(a) || cy(a[0].w) - cy(b[0].w))[0];
  const ancoras = palavras.filter((w) => horaDoTexto(w.t) || ehData(w.t));
  const naColuna = grupos(ancoras, (w) => cx(w), 0.05)
    .filter((g) => grupos(g, (w) => cy(w), altura * 0.8).length >= 2)
    .sort((a, b) => b.length - a.length)[0];
  const linhasNaColuna = naColuna ? grupos(naColuna, (w) => cy(w), altura * 0.8).length : 0;

  if (naLinha && distintas(naLinha) >= linhasNaColuna) return planoDeitado(palavras, naLinha, altura, rotulos);
  if (naColuna) return planoEmLinhas(palavras, naColuna, altura);
  return null;
}

function planoDeitado(palavras: Palavra[], cabecalho: Hora[], altura: number, rotulos?: Record<string, string[]>): Plano | null {
  // Uma coluna por horário (as duas leituras da mesma hora viram uma).
  const lidas: Array<{ hora: string | null; xc: number; yc: number; h: number }> = grupos(cabecalho, (o) => cx(o.w), 0.03).map((g) => ({
    hora: g[0].h, xc: mediana(g.map((o) => cx(o.w))), yc: mediana(g.map((o) => cy(o.w))), h: mediana(g.map((o) => alt(o.w))),
  }));
  if (lidas.length < 2) return null;
  // O passo entre as colunas: pelos horários do alto — e, faltando um no
  // meio, pelos números do corpo, que formam as mesmas colunas.
  const doAlto = quantil(lidas.slice(1).map((c, i) => c.xc - lidas[i].xc), 0.25);
  const yAlto = mediana(lidas.map((c) => c.yc));
  const doCorpo = grupos(palavras.filter((w) => /\d\d/.test(w.t) && !horaDoTexto(w.t) && cy(w) > yAlto + altura
    && cx(w) > lidas[0].xc - doAlto * 0.6), (w) => cx(w), 0.025)
    .filter((g) => g.length >= 2).map((g) => mediana(g.map(cx)));
  const passosDoCorpo = doCorpo.slice(1).map((x, i) => x - doCorpo[i]).filter((d) => d > altura * 2);
  const candidato = passosDoCorpo.length ? quantil(passosDoCorpo, 0.5) : doAlto;
  const razao = doAlto / candidato;
  const passo = razao > 1.6 && Math.abs(razao - Math.round(razao)) < 0.2 ? doAlto / Math.round(razao) : doAlto;
  // O horário do alto que o OCR pulou: a coluna existe, no passo das outras.
  const colunas = [lidas[0]];
  for (const c of lidas.slice(1)) {
    const ant = colunas[colunas.length - 1];
    const n = Math.round((c.xc - ant.xc) / passo);
    for (let i = 1; i < n && n <= 4; i++) colunas.push({ ...ant, hora: null, xc: ant.xc + ((c.xc - ant.xc) * i) / n });
    colunas.push(c);
  }
  // A coluna da ponta cujo horário não foi lido: há números onde ela estaria.
  const yCab0 = mediana(lidas.map((c) => c.yc)), hCab0 = mediana(lidas.map((c) => c.h)) || altura;
  const numerosEm = (xc: number) => palavras.filter((w) => /\d\d/.test(w.t) && !horaDoTexto(w.t)
    && Math.abs(cx(w) - xc) < passo * 0.45 && cy(w) > yCab0 + hCab0).length;
  const ultima = colunas[colunas.length - 1];
  if (ultima.xc + passo * 0.75 < 1 && numerosEm(ultima.xc + passo) >= 2) colunas.push({ ...ultima, hora: null, xc: ultima.xc + passo });
  const primeiraCol = colunas[0];
  const rotulosAntes = palavras.some((w) => rotuloDaLinha(w.t) && Math.abs(cx(w) - (primeiraCol.xc - passo)) < passo * 0.45);
  if (!rotulosAntes && numerosEm(primeiraCol.xc - passo) >= 2) colunas.unshift({ ...primeiraCol, hora: null, xc: primeiraCol.xc - passo });
  const yCab = mediana(colunas.map((c) => c.yc));
  const hCab = mediana(colunas.map((c) => c.h)) || altura;
  const xDados = colunas[0].xc - 0.62 * passo;

  // Os nomes dos parâmetros, na margem esquerda, abaixo dos horários. O que
  // a foto inteira não reconheceu (e não é unidade) vai para releitura.
  const naMargem = grupos(palavras.filter((w) => cx(w) < xDados && cy(w) > yCab + hCab * 0.8), (w) => cy(w), altura * 0.8);
  const duvidosos: Celula[] = [];
  const linhas: Array<{ tipo: OQue | "outro"; y: number }> = [];
  for (const g of naMargem) {
    const y = mediana(g.map(cy));
    let tipo = g.map((w) => rotuloDaLinha(w.t)).find(Boolean) ?? null;
    if (!tipo && !g.every((w) => ehUnidade(w.t))) {
      const id = `rotulo-${Math.round(y * 1000)}`;
      if (rotulos) tipo = (rotulos[id] ?? []).flatMap((t) => [t, ...t.split(/\s+/)]).map(rotuloDaLinha).find(Boolean) ?? null;
      else {
        duvidosos.push({
          id, alfabeto: "rotulo", primeiraLeitura: g.map((w) => w.t).join(" "),
          caixa: limitar({ x0: Math.min(...g.map((w) => w.x0)) - altura * 1.5, x1: xDados - altura * 0.3, y0: y - altura * 0.8, y1: y + altura * 0.8 }),
        });
      }
    }
    if (tipo) linhas.push({ tipo, y });
  }
  // Sem o nome da pressão, a linha dela se acha pelos valores: "120/80" não é outra coisa.
  if (!linhas.some((l) => l.tipo === "pressao")) {
    const barras = palavras.filter((w) => cx(w) > xDados && cy(w) > yCab + hCab && /\d{2,3}\s*\/|\/\s*\d{2,3}|^\/$/.test(w.t));
    const g = grupos(barras, (w) => cy(w), altura * 0.8).filter((x) => x.length >= 2).sort((a, b) => b.length - a.length)[0];
    if (g) {
      const y = mediana(g.map(cy));
      const i = linhas.findIndex((l) => Math.abs(l.y - y) < altura);
      if (i >= 0) linhas[i] = { tipo: "pressao", y }; else linhas.push({ tipo: "pressao", y });
      linhas.sort((a, b) => a.y - b.y);
    }
  }
  if (!linhas.length) return null;
  const intervalos = linhas.slice(1).map((l, i) => l.y - linhas[i].y);
  // A altura da linha da tabela: o passo entre os nomes — mas, faltando
  // nomes, o passo dobra; nunca mais que umas três alturas de letra.
  const altLinha = Math.min(intervalos.length ? quantil(intervalos, 0.25) : Infinity, hCab * 3.2);

  const celulas: Celula[] = [];
  // Nada sobe até a linha dos horários do alto.
  const topo = yCab + hCab * 0.6;
  const nasCelulas = (c: Caixa, alfabeto: Alfabeto) => palavras
    .filter((w) => cx(w) > c.x0 && cx(w) < c.x1 && cy(w) > c.y0 && cy(w) < c.y1)
    .filter((w) => alfabeto === "hora" || !horaDoTexto(w.t))
    .sort((a, b) => a.x0 - b.x0);
  const nova = (id: string, area: Caixa, alfabeto: Alfabeto) => {
    const padrao = { ...area, y0: Math.max(area.y0, topo) };
    // O retângulo das palavras já lidas ali, folgado; sem nada lido, a célula inteira.
    const dentro = nasCelulas(padrao, alfabeto);
    const folga = altura * 0.35;
    const caixa = dentro.length
      ? limitar({
        x0: Math.max(padrao.x0, Math.min(...dentro.map((w) => w.x0)) - folga),
        x1: Math.min(padrao.x1, Math.max(...dentro.map((w) => w.x1)) + folga),
        y0: Math.max(padrao.y0, Math.min(...dentro.map((w) => w.y0)) - folga),
        y1: Math.min(padrao.y1, Math.max(...dentro.map((w) => w.y1)) + folga),
      })
      : limitar(padrao);
    celulas.push({ id, caixa, alfabeto, primeiraLeitura: dentro.map((w) => w.t).join(" ") });
    return id;
  };

  // Só uma linha de cada coisa: a primeira pressão (PNI antes de outra) e o pulso só sem FC.
  const usadas = new Set<OQue>();
  const doPlano: LinhaDoPlano[] = colunas.flatMap((col, k) => [
    { hora: col.hora, coluna: k, valores: [] as LinhaDoPlano["valores"] },
    { hora: col.hora, coluna: k, valores: [] as LinhaDoPlano["valores"] },
  ]);
  for (const l of linhas) {
    if (l.tipo === "outro" || usadas.has(l.tipo)) continue;
    usadas.add(l.tipo);
    // A linha dos valores, coluna a coluna: a foto ainda um pouco torta (ou
    // em perspectiva) faz o valor da ponta subir ou descer. Uma reta pelos
    // números lidos nessa linha diz a altura de cada coluna.
    const daLinha = palavras.filter((w) => cx(w) > xDados && /\d/.test(w.t) && !horaDoTexto(w.t)
      && Math.abs(cy(w) - l.y) < altLinha * 0.4);
    const yNaColuna = retaPor(daLinha.map((w) => [cx(w), cy(w)]), l.y);
    colunas.forEach((col, k) => {
      const x = { x0: col.xc - 0.6 * passo, x1: col.xc + 0.42 * passo };
      const yc = yNaColuna(col.xc);
      const valor = nova(`${k}-${l.tipo}`, { ...x, y0: yc - 0.34 * altLinha, y1: yc + 0.3 * altLinha },
        l.tipo === "pressao" ? "pressao" : "numero");
      if (l.tipo === "pressao") {
        const linha = doPlano[k * 2 + 1];
        linha.valores.push({ oque: "pressao", celula: valor });
        linha.celulaDaHora = nova(`${k}-hora`, { ...x, y0: yc + 0.26 * altLinha, y1: yc + 0.74 * altLinha }, "hora");
      } else {
        doPlano[k * 2].valores.push({ oque: l.tipo as Exclude<OQue, "pressao">, celula: valor });
      }
    });
  }
  if (!celulas.length) return null;
  return {
    forma: "deitada", celulas, linhas: doPlano.filter((l) => l.valores.length), colunas: colunas.map((c) => c.hora),
    ...(duvidosos.length ? { rotulosDuvidosos: duvidosos } : {}),
  };
}

function planoEmLinhas(palavras: Palavra[], coluna: Palavra[], altura: number): Plano | null {
  // As linhas. A tabela tem passo fixo: o passo e o começo são os que mais
  // encostam nas datas, horas e números lidos (ninguém lê todos), e as linhas
  // vão da primeira à última com alguma coisa — com as do meio que o OCR pulou.
  const ysAnc = grupos(coluna, (w) => cy(w), altura * 0.6).map((g) => mediana(g.map(cy)));
  const difs = ysAnc.slice(1).map((y, i) => y - ysAnc[i]).filter((d) => d > altura * 1.2);
  if (!difs.length) return null;
  const passo0 = Math.min(...difs);
  const ehValor = (w: Palavra) => /^\d{2,3}$/.test(algarismos(w.t).replace(/[^\d]/g, "")) && /\d\d/.test(w.t);
  const pontos = palavras
    .filter((w) => (horaDoTexto(w.t) || ehData(w.t) || ehValor(w))
      && cy(w) > ysAnc[0] - passo0 * 1.5 && cy(w) < ysAnc[ysAnc.length - 1] + passo0 * 1.5)
    .map(cy);
  let rede = { passo: passo0, inicio: ysAnc[0], nota: -1 };
  for (let f = 0.8; f <= 1.2; f += 0.01) {
    const p = passo0 * f;
    for (let o = -0.5; o < 0.5; o += 0.04) {
      const inicio = ysAnc[0] + o * p;
      let nota = 0;
      for (const y of pontos) {
        const r = (y - inicio) / p;
        const d = Math.abs(r - Math.round(r));
        if (d < 0.25) nota += 1 - d * 4;
      }
      if (nota > rede.nota) rede = { passo: p, inicio, nota };
    }
  }
  const passo = rede.passo;
  const apoio = new Map<number, number>();
  for (const y of pontos) {
    const k = Math.round((y - rede.inicio) / passo);
    if (Math.abs((y - rede.inicio) / passo - k) < 0.3) apoio.set(k, (apoio.get(k) ?? 0) + 1);
  }
  const comApoio = [...apoio].filter(([, n]) => n >= 2).map(([k]) => k);
  if (comApoio.length < 2) return null;
  const kMin = Math.min(...comApoio), kMax = Math.max(...comApoio);
  // As linhas da ponta que o OCR leu mal entram por via das dúvidas (duas de
  // cada lado, abaixo do cabeçalho SIS/DIA… e dentro da foto): só ficam se a
  // hora delas for lida.
  const yCabecalho = mediana(palavras.filter((w) => rotuloDaColuna(w.t) && cy(w) < rede.inicio + (kMin - 0.4) * passo).map(cy));
  const ys: number[] = [];
  const especulativas = new Set<number>();
  for (let k = kMin - 2; k <= kMax + 2; k++) {
    const yk = rede.inicio + k * passo;
    const ponta = k < kMin || k > kMax;
    if (ponta && (yk - passo * 0.45 < 0 || yk + passo * 0.45 > 1 || (yCabecalho && yk < yCabecalho + passo * 0.6))) continue;
    // O centro da linha: a média do que foi lido perto dela, ou a rede.
    const perto = pontos.filter((y) => Math.abs(y - yk) < passo * 0.3);
    if (ponta) especulativas.add(ys.length);
    ys.push(perto.length ? perto.reduce((a, b) => a + b, 0) / perto.length : yk);
  }
  // A data e a hora da mesma linha nem sempre se alinham na mesma coluna
  // ("2026-03-02" e "09:42" lado a lado): entram todas as da altura da linha.
  const ancoras = palavras.filter((w) => (horaDoTexto(w.t) || ehData(w.t)) && ys.some((y) => Math.abs(cy(w) - y) < passo * 0.4));
  const ancX0 = Math.min(...ancoras.map((w) => w.x0)) - altura * 0.6;
  const ancX1 = Math.max(...ancoras.map((w) => w.x1)) + altura * 0.6;
  // A hora fica à direita da data, quando as duas estão na célula.
  const soHoras = ancoras.filter((w) => horaDoTexto(w.t) && !ehData(w.t));
  const horaX0 = soHoras.length ? Math.min(...soHoras.map((w) => w.x0)) - altura * 0.6 : ancX0;

  // As colunas de valores: os números lidos, agrupados pelo x; e os nomes no alto.
  // Só os de 2 ou 3 algarismos de verdade: um traço da grade lido como "1" não abre coluna.
  const numeros = palavras.filter((w) => ehValor(w)
    && (cx(w) < ancX0 || cx(w) > ancX1) && cy(w) > ys[0] - passo * 0.5 && cy(w) < ys[ys.length - 1] + passo * 0.5);
  const nomes = palavras
    .filter((w) => cy(w) < ys[0] - passo * 0.4 && cy(w) > ys[0] - passo * 2.5)
    .map((w) => ({ w, tipo: rotuloDaColuna(w.t) }))
    .filter((o): o is { w: Palavra; tipo: OQue } => o.tipo !== null && o.tipo !== "hora");
  type Col = { xc: number; tipo: OQue | null; ws: Palavra[] };
  let cols: Col[] = grupos(numeros, (w) => cx(w), 0.035)
    .filter((g) => g.length >= 2 || nomes.some((n) => Math.abs(cx(n.w) - cx(g[0])) < 0.05))
    .map((g) => ({ xc: mediana(g.map(cx)), tipo: null, ws: g }));
  // A primeira coluna de números pequenos e em sequência é o número da linha.
  if (cols[0] && cols[0].ws.every((w) => Number(algarismos(w.t)) < 30)) cols = cols.slice(1);
  for (const n of nomes) {
    const perto = cols.filter((c) => Math.abs(c.xc - cx(n.w)) < 0.06).sort((a, b) => Math.abs(a.xc - cx(n.w)) - Math.abs(b.xc - cx(n.w)))[0];
    if (perto) perto.tipo ??= n.tipo;
    else if (!cols.some((c) => c.tipo === n.tipo)) cols.push({ xc: cx(n.w), tipo: n.tipo, ws: [] });
  }
  cols.sort((a, b) => a.xc - b.xc);
  // Sem nome, a ordem de sempre dessas telas: SIS, DIA, PAM e o pulso.
  const ORDEM: OQue[] = ["pas", "pad", "pam", "pulso", "spo2"];
  for (let volta = 0; volta < cols.length; volta++) {
    cols.forEach((c, i) => {
      if (c.tipo) return;
      const usados = new Set(cols.map((x) => x.tipo));
      const esq = cols[i - 1]?.tipo, dir = cols[i + 1]?.tipo;
      const pelaEsq = esq ? ORDEM[ORDEM.indexOf(esq) + 1] : undefined;
      const pelaDir = dir ? ORDEM[ORDEM.indexOf(dir) - 1] : undefined;
      const t = pelaEsq ?? pelaDir;
      if (t && !usados.has(t)) c.tipo = t;
    });
  }
  if (!cols.some((c) => c.tipo)) cols.forEach((c, i) => { c.tipo = ORDEM[i] ?? null; });
  const validas = cols.filter((c): c is Col & { tipo: OQue } => c.tipo !== null);
  if (!validas.length) return null;
  const largura = Math.min(...validas.slice(1).map((c, i) => c.xc - validas[i].xc), 0.2);

  // A foto torta: o x de cada coluna anda um pouco de linha em linha.
  const xNaLinha = (c: Col, y: number) => {
    if (c.ws.length < 2) return c.xc;
    const my = c.ws.reduce((s, w) => s + cy(w), 0) / c.ws.length;
    const mx = c.ws.reduce((s, w) => s + cx(w), 0) / c.ws.length;
    const vy = c.ws.reduce((s, w) => s + (cy(w) - my) ** 2, 0);
    if (vy < 1e-6) return c.xc;
    const b = c.ws.reduce((s, w) => s + (cy(w) - my) * (cx(w) - mx), 0) / vy;
    return mx + Math.max(-0.2, Math.min(0.2, b)) * (y - my);
  };

  const celulas: Celula[] = [];
  const primeira = (c: Caixa) => palavras
    .filter((w) => cx(w) > c.x0 && cx(w) < c.x1 && cy(w) > c.y0 && cy(w) < c.y1)
    .sort((a, b) => a.x0 - b.x0).map((w) => w.t).join(" ");
  const linhas: LinhaDoPlano[] = ys.map((y, r) => {
    const yy = { y0: y - passo * 0.42, y1: y + passo * 0.42 };
    const caixaHora = limitar({ x0: horaX0, x1: ancX1, ...yy });
    celulas.push({ id: `${r}-hora`, caixa: caixaHora, alfabeto: "hora", primeiraLeitura: primeira(caixaHora) });
    const lida = ancoras.filter((w) => Math.abs(cy(w) - y) < passo * 0.4).map((w) => horaDoTexto(w.t)).find(Boolean) ?? null;
    return {
      hora: lida, celulaDaHora: `${r}-hora`, ...(especulativas.has(r) ? { especulativa: true } : {}),
      valores: validas.map((c) => {
        const xc = xNaLinha(c, y);
        const caixa = limitar({ x0: xc - largura * 0.42, x1: xc + largura * 0.42, ...yy });
        const id = `${r}-${c.tipo}`;
        celulas.push({ id, caixa, alfabeto: "numero", primeiraLeitura: primeira(caixa) });
        return { oque: c.tipo, celula: id };
      }),
    };
  });
  return { forma: "em-linhas", celulas, linhas };
}

// ---- As linhas, com o texto relido de cada célula ---------------------------------

function numeroDe(t: string, p: Parametro): number | undefined {
  const s = algarismos(t).replace(/,/g, ".");
  for (const m of s.matchAll(/\d+(?:\.\d+)?/g)) {
    const v = Number(m[0]);
    if (valorPlausivel(p, v)) return p === "temp" ? v : Math.round(v);
  }
  return undefined;
}

/**
 * A PAM do monitor (oscilométrica) fica perto de (PAS + 2·PAD)/3 — a poucos
 * mmHg nas telas reais. Longe disso, algum dos três foi mal lido.
 */
const pamCoerente = (pas: number, pad: number, pam: number) => pam > pad && pam < pas && Math.abs(pam - (pas + 2 * pad) / 3) <= 15;

function pressaoDe(t: string): { pas: number; pad: number; pam?: number } | undefined {
  const s = algarismos(t).replace(/\s+/g, "");
  const tentativas: number[][] = [];
  // Do jeito certo, "120/80(93)"; o "(" lido como "1" ("120/80193)") ou
  // perdido ("120/8093)"); sem a PAM. Cada leitura só vale se fizer sentido
  // (PAD abaixo da PAS, PAM entre as duas).
  for (const re of [
    /(\d{2,3})\/(\d{2,3})\((\d{2,3})\)/,
    /(\d{2,3})\/(\d{2,3}?)[1(\[{](\d{2,3})\)/,
    /(\d{2,3})\/(\d{2})(\d{2,3})\)/,
    /(\d{2,3})\/(\d{3})(\d{2,3})\)/,
    /(\d{2,3})[/|\\]+(\d{2,3})(?!\d)/,
  ]) {
    const m = s.match(re);
    if (m) tentativas.push([Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : NaN]);
  }
  const soltos = [...s.matchAll(/\d{2,3}/g)].map((x) => Number(x[0]));
  if (soltos.length >= 2) tentativas.push([soltos[0], soltos[1], soltos[2] ?? NaN]);
  for (const [pas, pad, pam] of tentativas) {
    if (!valorPlausivel("pas", pas) || !valorPlausivel("pad", pad) || pad >= pas) continue;
    return { pas, pad, ...(valorPlausivel("pam", pam) && pamCoerente(pas, pad, pam) ? { pam } : {}) };
  }
  return undefined;
}

/**
 * O que a leitura diz, para comparar duas leituras da mesma célula: o número,
 * a pressão ou a hora. `null` quando não diz nada que preste.
 */
export function chaveDaLeitura(alfabeto: Alfabeto, t: string): string | null {
  if (alfabeto === "hora") return horaDoTexto(t, true);
  if (alfabeto === "rotulo") return [t, ...t.split(/\s+/)].map(rotuloDaLinha).find(Boolean) ?? null;
  if (alfabeto === "pressao") {
    const pa = pressaoDe(t);
    return pa ? `${pa.pas}/${pa.pad}/${pa.pam ?? ""}` : null;
  }
  return algarismos(t).replace(/,/g, ".").match(/\d+(?:\.\d+)?/)?.[0] ?? null;
}

/** A leitura diz algo inteiro? (sinal vital tem pelo menos dois algarismos) */
export const leituraBoa = (alfabeto: Alfabeto, t: string) => {
  const k = chaveDaLeitura(alfabeto, t);
  return k !== null && (alfabeto !== "numero" || /^\d{2,3}(\.\d)?$/.test(k));
};

const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const paraHora = (m: number) => {
  const d = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(d / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`;
};
/** A diferença b − a em minutos, atravessando a meia-noite pelo caminho curto. */
const diferenca = (a: string, b: string) => ((minutos(b) - minutos(a) + 2160) % 1440) - 720;

/** O mais lido entre as leituras; no empate, o que veio primeiro. */
function votar<T>(textos: string[], ler: (t: string) => T | undefined, chave: (v: T) => string = String): T | undefined {
  const conta = new Map<string, { v: T; n: number; i: number }>();
  textos.forEach((t, i) => {
    const v = ler(t);
    if (v === undefined) return;
    const k = chave(v);
    const o = conta.get(k);
    if (o) o.n++; else conta.set(k, { v, n: 1, i });
  });
  return [...conta.values()].sort((a, b) => b.n - a.n || a.i - b.i)[0]?.v;
}

/**
 * Os horários do alto andam num passo só (de 10 em 10, de 5 em 5): o que não
 * cabe no passo das vizinhas foi mal lido, e o que faltou se completa.
 */
export function consertarSequencia(horas: ReadonlyArray<string | null>): Array<string | null> {
  // O passo: de cada par de horários lidos, a diferença dividida pela
  // distância entre as colunas — o par vizinho mal lido não decide sozinho.
  const passos: number[] = [];
  horas.forEach((a, i) => horas.forEach((b, j) => {
    if (!a || !b || j <= i) return;
    const d = diferenca(a, b) / (j - i);
    if (Number.isInteger(d)) passos.push(d);
  }));
  const passo = votar(passos.map(String), (t) => (Number(t) !== 0 ? Number(t) : undefined));
  if (passo === undefined) return [...horas];
  // A âncora: a coluna que mais concorda com as outras pelo passo.
  let melhor = -1, ancora = -1;
  horas.forEach((h, i) => {
    if (!h) return;
    const acordo = horas.filter((o, j) => o && diferenca(h, o) === (j - i) * passo).length;
    if (acordo > melhor) { melhor = acordo; ancora = i; }
  });
  if (melhor < 2) return [...horas];
  return horas.map((_, j) => paraHora(minutos(horas[ancora]!) + (j - ancora) * passo));
}

/**
 * As linhas lidas: `lidos` tem, para cada célula, os textos relidos. Junto
 * com o que a foto inteira leu ali, vence o valor lido mais vezes.
 */
export function montar(plano: Plano, lidos: Record<string, string[]>): LinhaDoMonitor[] {
  const porId = new Map(plano.celulas.map((c) => [c.id, c]));
  // No empate, a ordem decide: a releitura em cinza, a foto inteira, as outras releituras.
  const textos = (id: string) => {
    const [primeira, ...outras] = lidos[id] ?? [];
    return [primeira, porId.get(id)?.primeiraLeitura, ...outras].filter((t): t is string => Boolean(t));
  };

  // A hora de cada linha.
  const horas = new Map<LinhaDoPlano, string | null>();
  if (plano.forma === "deitada") {
    const doAlto = consertarSequencia(plano.colunas ?? []);
    // O selo da PNI: a hora da aferição, entre a coluna anterior e a sua.
    // O selo ilegível ganha a distância que os outros têm da coluna.
    const passo = doAlto[0] && doAlto[1] ? diferenca(doAlto[0], doAlto[1]) : 0;
    const selos = new Map<LinhaDoPlano, string>();
    for (const l of plano.linhas) {
      const col = l.coluna !== undefined ? doAlto[l.coluna] : l.hora;
      if (!l.celulaDaHora || !col) continue;
      const lida = votar(textos(l.celulaDaHora), (t) => horaDoTexto(t, true) ?? undefined);
      if (lida && diferenca(col, lida) <= 0 && (!passo || diferenca(col, lida) >= -Math.abs(passo))) selos.set(l, lida);
    }
    const afastamento = votar([...selos].map(([l, h]) => String(diferenca(doAlto[l.coluna!]!, h))), (t) => Number(t));
    // Se as outras aferições têm a mesma distância da coluna e essa hora está
    // entre as leituras do selo, é ela ("08:15" lido uma vez e "08:14" duas).
    if (afastamento !== undefined) {
      for (const l of plano.linhas) {
        const col = l.coluna !== undefined ? doAlto[l.coluna] : null;
        if (!l.celulaDaHora || !col) continue;
        const esperada = paraHora(minutos(col) + afastamento);
        const lidas = textos(l.celulaDaHora).map((t) => horaDoTexto(t, true)).filter((h): h is string => Boolean(h));
        // Um minuto de diferença é o 5 lido 6 (ou 4): fica a do padrão.
        // Mais que isso pode ser uma PNI feita à mão: fica a lida.
        if (lidas.some((h) => Math.abs(diferenca(esperada, h)) <= 1)) selos.set(l, esperada);
      }
    }
    // Há selo (algarismos lidos ali) mas nenhum legível: a PA fica sem hora,
    // para o médico escrever — a hora da coluna seria a errada.
    const haSelo = plano.linhas.some((l) => l.celulaDaHora
      && textos(l.celulaDaHora).some((t) => t === SELO_ILEGIVEL || /\d{3}/.test(t.replace(/\D/g, ""))));
    for (const l of plano.linhas) {
      const col = l.coluna !== undefined ? doAlto[l.coluna] : l.hora;
      let hora = col ?? null;
      if (l.celulaDaHora) {
        if (selos.has(l)) hora = selos.get(l)!;
        else if (col && afastamento !== undefined) hora = paraHora(minutos(col) + afastamento);
        else if (haSelo) hora = null;
      }
      horas.set(l, hora);
    }
  } else {
    const lidas = plano.linhas.map((l) => (l.celulaDaHora ? votar(textos(l.celulaDaHora), (t) => horaDoTexto(t, true) ?? undefined) : undefined) ?? l.hora);
    // Uma medida por linha, em ordem: a hora que briga com as duas vizinhas foi mal lida.
    const sentido = Math.sign(lidas.reduce((s, h, i) => {
      const ant = lidas[i - 1];
      return s + (h && ant ? Math.sign(diferenca(ant, h)) : 0);
    }, 0));
    plano.linhas.forEach((l, i) => {
      const h = lidas[i];
      const fora = (o: string | null | undefined, depois: boolean) => o && h && Math.sign(depois ? diferenca(h, o) : diferenca(o, h)) === -sentido;
      horas.set(l, h && sentido && fora(lidas[i - 1], false) && fora(lidas[i + 1], true) ? null : h ?? null);
    });
  }

  /** As leituras de uma célula como valores do parâmetro, a mais votada primeiro. */
  const opcoes = (id: string, p: Parametro) => {
    const conta = new Map<number, number>();
    for (const t of textos(id)) {
      const v = numeroDe(t, p);
      if (v !== undefined) conta.set(v, (conta.get(v) ?? 0) + 1);
    }
    return [...conta].sort((a, b) => b[1] - a[1]);
  };

  const saida: LinhaDoMonitor[] = [];
  const porHora = new Map<string, LinhaDoMonitor>();
  for (const l of plano.linhas) {
    const hora = horas.get(l) ?? "";
    if (l.especulativa && !hora) continue;
    const linha: LinhaDoMonitor = { hora };
    let pulso: number | undefined;
    for (const v of l.valores) {
      if (v.oque === "pressao") {
        // PAS/PAD primeiro; a PAM, entre as leituras que concordam com elas.
        const lidas = textos(v.celula).map(pressaoDe);
        const pa = votar(lidas.map((x) => (x ? `${x.pas}/${x.pad}` : "")), (t) => t || undefined);
        if (pa) {
          const [pas, pad] = pa.split("/").map(Number);
          const pam = votar(lidas.filter((x) => x && x.pas === pas && x.pad === pad && x.pam !== undefined).map((x) => String(x!.pam)), Number);
          Object.assign(linha, { pas, pad }, pam !== undefined ? { pam } : {});
        }
      } else if (v.oque === "pulso") {
        pulso = votar(textos(v.celula), (t) => numeroDe(t, "fc"));
      } else {
        const p = v.oque;
        const n = votar(textos(v.celula), (t) => numeroDe(t, p));
        if (n !== undefined) linha[p] = n;
      }
    }
    if (linha.fc === undefined && pulso !== undefined) linha.fc = pulso;
    // PAS, PAD e PAM em colunas separadas que não fecham entre si: procura,
    // entre as leituras de cada célula, a combinação que fecha (a mais votada).
    // Nenhuma fecha: a pressão dessa linha fica de fora — melhor faltar que errar.
    const celulaDe = (p: Parametro) => l.valores.find((v) => v.oque === p)?.celula;
    const [cPas, cPad, cPam] = [celulaDe("pas"), celulaDe("pad"), celulaDe("pam")];
    if (cPas && cPad && cPam && linha.pas !== undefined && linha.pad !== undefined && linha.pam !== undefined
      && !pamCoerente(linha.pas, linha.pad, linha.pam)) {
      let melhor: { pas: number; pad: number; pam: number; n: number } | null = null;
      for (const [pas, a] of opcoes(cPas, "pas")) {
        for (const [pad, b] of opcoes(cPad, "pad")) {
          for (const [pam, c] of opcoes(cPam, "pam")) {
            if (pad < pas && pamCoerente(pas, pad, pam) && (!melhor || a + b + c > melhor.n)) melhor = { pas, pad, pam, n: a + b + c };
          }
        }
      }
      delete linha.pas; delete linha.pad; delete linha.pam;
      if (melhor) Object.assign(linha, { pas: melhor.pas, pad: melhor.pad, pam: melhor.pam });
    }
    // Pressão em colunas separadas: a PAD abaixo da PAS, e a PAM entre as duas.
    if (linha.pas !== undefined && linha.pad !== undefined && linha.pad >= linha.pas) { delete linha.pas; delete linha.pad; }
    if (linha.pam !== undefined && ((linha.pas !== undefined && linha.pam >= linha.pas) || (linha.pad !== undefined && linha.pam <= linha.pad))) delete linha.pam;
    if (Object.keys(linha).length <= 1) continue;
    // Sem hora legível, a linha vem assim mesmo, para o médico escrever a hora.
    if (!hora) { saida.push(linha); continue; }
    porHora.set(hora, { ...porHora.get(hora), ...linha });
  }
  return [...[...porHora.values()].sort((a, b) => a.hora.localeCompare(b.hora)), ...saida];
}
