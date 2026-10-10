// Consumo estimado de sevoflurano, em mL. Sem preço, sem custo.
//
// A aproximação pelo ajuste do vaporizador:
//
//     mL ≈ 3,26 × fluxo total (L/min) × concentração (%) × minutos / 60
//
// A concentração entra como número percentual (2 para 2%). É a concentração
// AJUSTADA NO VAPORIZADOR — não a inspirada nem a expirada medidas no
// circuito, que são outra coisa e não entram nesta conta.
//
// O resultado é ESTIMATIVA a partir do que foi registrado, e não medição do
// consumo do aparelho. A tela e a impressão dizem isso.
//
// Cada registro de gás é o ajuste completo daquele momento (O₂, ar, N₂O,
// outros, sevoflurano) e vale até o próximo registro ou até o fim da anestesia.
// A mesma conta existe no banco (consumo_sevoflurano_ml) e as duas têm de dar
// o mesmo número — há teste para isso.

import { minutosEntre, num, type Registro } from "./registros.ts";

export const FATOR_SEVOFLURANO = 3.26;

export type AjusteDeGas = {
  momento: string;
  o2: number; ar: number; n2o: number; outro: number;
  sevoPct: number;
};

export function lerAjuste(r: Registro): AjusteDeGas | null {
  if (r.tipo !== "gas") return null;
  return {
    momento: r.momento,
    o2: num(r.dados.o2) ?? 0,
    ar: num(r.dados.ar) ?? 0,
    n2o: num(r.dados.n2o) ?? 0,
    outro: num(r.dados.outro) ?? 0,
    sevoPct: num(r.dados.sevo_pct) ?? 0,
  };
}

export const fluxoTotal = (a: AjusteDeGas) => a.o2 + a.ar + a.n2o + a.outro;

export type IntervaloDeSevo = {
  de: string; ate: string; minutos: number; fgf: number; pct: number; ml: number;
};

export function mlNoIntervalo(fgf: number, pct: number, minutos: number) {
  return (FATOR_SEVOFLURANO * fgf * pct * Math.max(0, minutos)) / 60;
}

/**
 * Os intervalos e o total. `fim` é o fim da anestesia — ou, com a folha
 * aberta, o agora; nesse caso o número é parcial e a tela diz "até agora".
 */
export function consumoSevoflurano(ajustes: readonly AjusteDeGas[], fim: string) {
  const ordem = [...ajustes].sort((a, b) => Date.parse(a.momento) - Date.parse(b.momento));
  const intervalos: IntervaloDeSevo[] = [];
  for (let i = 0; i < ordem.length; i++) {
    const a = ordem[i];
    const proximo = ordem[i + 1]?.momento ?? fim;
    const ate = Date.parse(proximo) < Date.parse(fim) ? proximo : fim;
    const minutos = Math.max(0, minutosEntre(a.momento, ate));
    const fgf = fluxoTotal(a);
    const ml = mlNoIntervalo(fgf, a.sevoPct, minutos);
    intervalos.push({ de: a.momento, ate, minutos, fgf, pct: a.sevoPct, ml });
  }
  const total = Math.round(intervalos.reduce((s, i) => s + i.ml, 0) * 100) / 100;
  return { totalMl: total, intervalos };
}

/** "6,5 mL" — uma casa, vírgula. É o que vai na tela e no papel. */
export const formatarMl = (ml: number) =>
  `${(Math.round(ml * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mL`;
