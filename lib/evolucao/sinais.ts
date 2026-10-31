// Sinais vitais: parâmetros, PAM estimada e as séries do gráfico.

import { minutosEntre, num, type Registro } from "./registros.ts";

export type Parametro = "pas" | "pad" | "pam" | "fc" | "spo2" | "etco2" | "temp";

/**
 * Os parâmetros e como aparecem. Os símbolos são os da folha de papel — V para
 * a sistólica, Λ para a diastólica, X para a média —, porque é a leitura que o
 * anestesiologista faz sem pensar. A FC fica num ponto cheio, que é o que mais
 * se usa nas folhas.
 *
 * As faixas são as MESMAS da validação no banco (valida_registro_evolucao):
 * fora delas o valor não é fisiologicamente possível e nem chega a gravar.
 */
export const PARAMETROS: Record<Parametro, {
  nome: string; curto: string; simbolo: string; unidade: string;
  min: number; max: number; noGrafico: boolean;
}> = {
  pas: { nome: "Pressão sistólica", curto: "PAS", simbolo: "V", unidade: "mmHg", min: 20, max: 300, noGrafico: true },
  pad: { nome: "Pressão diastólica", curto: "PAD", simbolo: "Λ", unidade: "mmHg", min: 10, max: 200, noGrafico: true },
  pam: { nome: "Pressão média", curto: "PAM", simbolo: "X", unidade: "mmHg", min: 15, max: 250, noGrafico: true },
  fc: { nome: "Frequência cardíaca", curto: "FC", simbolo: "•", unidade: "bpm", min: 10, max: 300, noGrafico: true },
  spo2: { nome: "Saturação", curto: "SpO₂", simbolo: "", unidade: "%", min: 30, max: 100, noGrafico: false },
  etco2: { nome: "CO₂ expirado", curto: "EtCO₂", simbolo: "", unidade: "mmHg", min: 0, max: 150, noGrafico: false },
  temp: { nome: "Temperatura", curto: "Temp.", simbolo: "", unidade: "°C", min: 25, max: 45, noGrafico: false },
};

export const NO_GRAFICO = (Object.keys(PARAMETROS) as Parametro[]).filter((p) => PARAMETROS[p].noGrafico);
export const EM_LINHA = (Object.keys(PARAMETROS) as Parametro[]).filter((p) => !PARAMETROS[p].noGrafico);

export function valorPlausivel(p: Parametro, v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= PARAMETROS[p].min && v <= PARAMETROS[p].max;
}

/**
 * PAM estimada = (PAS + 2 × PAD) / 3, arredondada.
 *
 * É ESTIMATIVA, e sai marcada assim: grava com origem "estimado" e aparece com
 * símbolo vazado. Nunca toma o lugar de uma PAM medida pelo monitor no mesmo
 * horário — quem decide isso é `pamEstimadaCabe`.
 */
export function pamEstimada(pas: number, pad: number): number | null {
  if (!valorPlausivel("pas", pas) || !valorPlausivel("pad", pad) || pad >= pas) return null;
  return Math.round((pas + 2 * pad) / 3);
}

/** A estimada só entra onde não há PAM medida no mesmo minuto. */
export function pamEstimadaCabe(vigentes: readonly Registro[], momento: string): boolean {
  return !vigentes.some((r) => r.tipo === "sinal" && r.dados.parametro === "pam"
    && r.origem !== "estimado" && Math.abs(minutosEntre(r.momento, momento)) < 1);
}

export type Ponto = { id: string; momento: string; valor: number; origem: Registro["origem"] };

/** Os pontos de um parâmetro, em ordem de horário. */
export function pontosDe(vigentes: readonly Registro[], p: Parametro): Ponto[] {
  return vigentes
    .filter((r) => r.tipo === "sinal" && r.dados.parametro === p && num(r.dados.valor) !== null)
    .map((r) => ({ id: r.id, momento: r.momento, valor: num(r.dados.valor)!, origem: r.origem }))
    .sort((a, b) => Date.parse(a.momento) - Date.parse(b.momento));
}

/**
 * Os trechos de linha de um parâmetro.
 *
 * Dois pontos seguidos só se ligam se estiverem a até `lacunaMin` minutos um
 * do outro. Acima disso a linha QUEBRA: ligar uma PA das 10:00 a uma das 10:45
 * desenharia 45 minutos de pressão que ninguém mediu — a interpolação
 * enganosa que a folha não pode fazer.
 */
export function trechos(pontos: readonly Ponto[], lacunaMin: number): Ponto[][] {
  const saida: Ponto[][] = [];
  let atual: Ponto[] = [];
  for (const p of pontos) {
    const ultimo = atual[atual.length - 1];
    if (ultimo && minutosEntre(ultimo.momento, p.momento) > lacunaMin) {
      saida.push(atual);
      atual = [];
    }
    atual.push(p);
  }
  if (atual.length) saida.push(atual);
  return saida;
}

/**
 * A lacuna padrão: três intervalos da folha (15 min na folha de 5 em 5),
 * nunca menos de 15 min — na folha de 3 em 3, uma PA a cada 5 min ainda é
 * monitorização contínua.
 */
export const lacunaPadrao = (intervaloMin: number) => Math.max(15, intervaloMin * 3);

/** Os intervalos que a folha aceita (o banco confere o mesmo). */
export const INTERVALOS = [3, 5, 10, 15] as const;

/** A grade forte do gráfico, com a hora escrita: de 15 em 15 nas folhas de 3 e 5 min. */
export const marcaForte = (intervaloMin: number) => (intervaloMin <= 5 ? 15 : intervaloMin * 3);

/**
 * Os períodos sem nenhum registro de PA nem FC maiores que a lacuna — para o
 * gráfico sombrear e a conferência de encerramento apontar.
 */
export function periodosSemMonitorizacao(
  vigentes: readonly Registro[], inicio: string, fim: string, lacunaMin: number,
): Array<{ de: string; ate: string }> {
  const horarios = vigentes
    .filter((r) => r.tipo === "sinal" && NO_GRAFICO.includes(r.dados.parametro as Parametro))
    .map((r) => r.momento)
    .filter((m) => Date.parse(m) >= Date.parse(inicio) && Date.parse(m) <= Date.parse(fim))
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const marcos = [inicio, ...horarios, fim];
  const saida: Array<{ de: string; ate: string }> = [];
  for (let i = 1; i < marcos.length; i++) {
    if (minutosEntre(marcos[i - 1], marcos[i]) > lacunaMin) saida.push({ de: marcos[i - 1], ate: marcos[i] });
  }
  return saida;
}

// ---------------------------------------------------------------------------
// A linha pronta do gráfico
// ---------------------------------------------------------------------------
/**
 * O gráfico já deixa a linha lançada, como no papel: em cada coluna do
 * intervalo da folha (3, 5, 10 ou 15 min), do começo até agora — ou até o fim
 * da anestesia —, PAS, PAD e FC que ainda não têm ponto ali aparecem
 * tracejadas, com o último valor conhecido antes da coluna; sem nenhum, a PA e
 * o pulso da avaliação pré-anestésica; sem esses, o ponto neutro. O médico
 * arrasta cada ponto até o valor do monitor e solta: vira registro no horário
 * da coluna. Nada grava sozinho.
 */
/**
 * De onde vem o valor do ponto pronto: o último lançado antes da coluna, a
 * avaliação pré-anestésica, o primeiro lançado depois (para completar uma
 * coluna para trás) ou o ponto neutro.
 */
export type Rascunho = {
  parametro: Parametro; valor: number; origem: "anterior" | "pre" | "seguinte" | "padrao";
  /** PAM calculada da PAS e da PAD: lançada sem arrastar, grava como estimada. */
  estimada?: true;
};
export type ColunaPronta = { ms: number; itens: Rascunho[] };

/**
 * Sem valor anterior nem pré-anestésica (ficha em branco), a linha pronta
 * começa num ponto neutro do gráfico — só para ter o que arrastar. Esse ponto
 * NUNCA vira registro sem ser arrastado: um toque nele abre a janela de
 * sinais, e o "✓ Igual" não o inclui.
 */
export const PONTO_NEUTRO: Partial<Record<Parametro, number>> = { pas: 120, pad: 70, pam: 85, fc: 100 };

export function colunasProntas(vigentes: readonly Registro[], pre: { pa?: string; pulso?: string },
  o: { inicioMs: number; ateMs: number; intervaloMin: number }): ColunaPronta[] {
  const passo = o.intervaloMin * 60000;
  const [, preS, preD] = (pre.pa ?? "").match(/(\d{2,3})\s*[/xX×]\s*(\d{2,3})/) ?? [];
  const preFc = (pre.pulso ?? "").match(/\d{2,3}/)?.[0];
  const doPre: Partial<Record<Parametro, number>> = {
    pas: Number(preS), pad: Number(preD), fc: Number(preFc), pam: pamEstimada(Number(preS), Number(preD)) ?? undefined,
  };
  // Quem só registra a PAM (monitor invasivo, por exemplo) recebe só a PAM;
  // os outros, PAS, PAD, PAM e FC.
  const soPam = !pontosDe(vigentes, "pas").length && pontosDe(vigentes, "pam").length > 0;
  const parametros: Parametro[] = soPam ? ["pam", "fc"] : ["pas", "pad", "pam", "fc"];
  const series = new Map(parametros.map((p) => [p, pontosDe(vigentes, p).map((pt) => ({ t: Date.parse(pt.momento), v: pt.valor }))]));
  // A primeira coluna é a do começo; a última, a que já chegou (nunca no futuro).
  const primeira = Math.ceil(o.inicioMs / passo) * passo;
  const ultima = Math.floor((o.ateMs + 30000) / passo) * passo;
  const saida: ColunaPronta[] = [];
  for (let t = primeira; t <= ultima; t += passo) {
    const itens: Rascunho[] = [];
    // O valor de cada parâmetro nesta coluna: o lançado nela, ou o do ponto pronto.
    const naColuna = new Map<Parametro, { v: number; lancado: boolean; origem: Rascunho["origem"] | null }>();
    for (const p of parametros) {
      const pts = series.get(p)!;
      // Já tem ponto nesta coluna (meio intervalo para cada lado): nada a lançar.
      const lancado = pts.find((x) => Math.abs(x.t - t) < passo / 2);
      if (lancado) { naColuna.set(p, { v: lancado.v, lancado: true, origem: null }); continue; }
      const antes = pts.filter((x) => x.t < t).pop();
      const depois = pts.find((x) => x.t > t);
      const pas = naColuna.get("pas"), pad = naColuna.get("pad");
      const estimada = pas && pad ? pamEstimada(pas.v, pad.v) : null;
      let item: Rascunho | null = null;
      // A PAM pronta: com PAS e PAD lançadas na coluna, a estimada delas
      // (o médico arrasta até a do monitor); senão a última PAM; senão a
      // estimada da PAS e da PAD prontas.
      if (p === "pam" && estimada !== null && pas!.lancado && pad!.lancado) item = { parametro: p, valor: estimada, origem: "anterior", estimada: true };
      else if (antes) item = { parametro: p, valor: antes.v, origem: "anterior" };
      else if (p === "pam" && estimada !== null && pas!.origem !== "padrao" && pad!.origem !== "padrao") {
        item = { parametro: p, valor: estimada, origem: pas!.origem === "pre" || pad!.origem === "pre" ? "pre" : pas!.origem ?? "anterior", estimada: true };
      } else if (valorPlausivel(p, doPre[p])) item = { parametro: p, valor: doPre[p]!, origem: "pre", ...(p === "pam" ? { estimada: true as const } : {}) };
      else if (depois) item = { parametro: p, valor: depois.v, origem: "seguinte" };
      else if (PONTO_NEUTRO[p] !== undefined) item = { parametro: p, valor: PONTO_NEUTRO[p]!, origem: "padrao" };
      if (!item) continue;
      itens.push(item);
      naColuna.set(p, { v: item.valor, lancado: false, origem: item.origem });
    }
    if (itens.length) saida.push({ ms: t, itens });
  }
  return saida;
}

// ---------------------------------------------------------------------------
// A linha pronta de SpO₂, EtCO₂ e temperatura
// ---------------------------------------------------------------------------
/**
 * Um valor pronto numa faixa de SpO₂, EtCO₂ ou temperatura: o último lançado,
 * repetido na coluna que ainda não tem valor. `valor: null` é a coluna de
 * agora de um sinal que nunca foi lançado — ali a folha pede o valor.
 */
export type ProntoDaLinha = { parametro: Parametro; ms: number; valor: number | null };

/**
 * Por onde começa o arraste de um sinal que nunca foi lançado ("?"). Como o
 * ponto neutro do gráfico, só serve para ter o que arrastar: nunca vira
 * registro sem o dedo levar o valor até o do monitor.
 */
export const PONTO_NEUTRO_DA_LINHA: Partial<Record<Parametro, number>> = { spo2: 98, etco2: 35, temp: 36 };

/** O quanto um passo do arraste muda o valor: 1 % de SpO₂, 1 mmHg de EtCO₂, 0,1 °C. */
export const PASSO_DA_LINHA: Partial<Record<Parametro, number>> = { spo2: 1, etco2: 1, temp: 0.1 };

/**
 * O valor depois de arrastar `passos` para cima (positivo) ou para baixo
 * (negativo), dentro da faixa possível do sinal. A temperatura anda de 0,1 em
 * 0,1 e sai sem o erro de vírgula flutuante (36,1, e não 36,099999).
 */
export function ajustarNaLinha(p: Parametro, base: number, passos: number): number {
  const passo = PASSO_DA_LINHA[p] ?? 1;
  const casas = passo < 1 ? 1 : 0;
  const v = Number((base + passos * passo).toFixed(casas));
  return Math.min(PARAMETROS[p].max, Math.max(PARAMETROS[p].min, v));
}

/**
 * A linha pronta das faixas de SpO₂, EtCO₂ e temperatura (pedido de
 * 31/10/2026): em cada coluna do intervalo que ainda não tem aquele sinal, o
 * último valor lançado aparece repetido, tracejado. Um toque lança o mesmo
 * valor; arrastar para cima aumenta, para baixo diminui, e soltar lança.
 *
 * As colunas são as da própria faixa — as de `colunasParaRepetir` em
 * lib/evolucao/grafico.ts —, e o horário de cada uma é o mesmo do toque na
 * linha: o meio da coluna, nunca depois de `ateMs`.
 *
 * Antes do primeiro valor não há o que repetir, e a coluna fica vazia. A
 * exceção é a coluna de agora de um sinal ainda sem valor nenhum: ali vai o
 * "?", que pede o valor. Como na pressão, nada grava sozinho.
 */
export function linhasProntas(vigentes: readonly Registro[],
  o: { inicioMs: number; ateMs: number; intervaloMin: number }): ProntoDaLinha[] {
  const passo = o.intervaloMin * 60000;
  const primeira = Math.floor(o.inicioMs / passo);
  const ultima = Math.floor(o.ateMs / passo);
  const saida: ProntoDaLinha[] = [];
  for (const p of EM_LINHA) {
    const pts = pontosDe(vigentes, p).map((pt) => ({ t: Date.parse(pt.momento), v: pt.valor }));
    const ocupadas = new Set(pts.map((x) => Math.floor(x.t / passo)));
    for (let c = primeira; c <= ultima; c++) {
      if (ocupadas.has(c)) continue;
      const inicio = c * passo;
      const ms = Math.round(Math.min(inicio + passo / 2, o.ateMs) / 60000) * 60000;
      const antes = pts.filter((x) => x.t < inicio).pop();
      if (antes) saida.push({ parametro: p, ms, valor: antes.v });
      else if (c === ultima && pts.length === 0) saida.push({ parametro: p, ms, valor: null });
    }
  }
  return saida;
}
