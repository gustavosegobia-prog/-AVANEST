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

/** A lacuna padrão: três intervalos da folha (15 min na folha de 5 em 5). */
export const lacunaPadrao = (intervaloMin: number) => intervaloMin * 3;

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
