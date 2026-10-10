// Infusões contínuas: início, ajustes e fim, e o que dá para somar delas.
//
// A REGRA QUE IMPORTA: a infusão só conta até onde alguém confirmou. Sem um
// "encerrar", o total vai até o último registro dela e sai marcado como
// incompleto — a folha não presume que a bomba seguiu correndo enquanto
// ninguém olhou.

import { minutosEntre, num, type Registro } from "./registros.ts";
import { concentracaoNaUnidade, converterMassa, type UnidadeDeConcentracao } from "./medicamentos.ts";

export type UnidadeDeVelocidade =
  | "mL/h" | "mcg/kg/min" | "mcg/kg/h" | "mg/kg/h" | "mcg/min" | "mg/h" | "UI/h" | "UI/min";

export type Infusao = {
  id: string;
  nome: string;
  diluicao: string;
  concentracao: { valor: number; unidade: UnidadeDeConcentracao } | null;
  passos: Array<{ momento: string; valor: number; unidade: UnidadeDeVelocidade }>;
  inicio: string;
  fim: string | null;
  ultimoRegistro: string;
};

export function montarInfusoes(vigentes: readonly Registro[]): Infusao[] {
  const mapa = new Map<string, Infusao>();
  const ordem = vigentes.filter((r) => r.tipo === "infusao")
    .sort((a, b) => Date.parse(a.momento) - Date.parse(b.momento));
  for (const r of ordem) {
    const acao = r.dados.acao;
    const vel = (r.dados.velocidade ?? {}) as Record<string, unknown>;
    if (acao === "iniciar") {
      const c = r.dados.concentracao as { valor?: unknown; unidade?: unknown } | undefined;
      mapa.set(r.id, {
        id: r.id,
        nome: String(r.dados.nome ?? ""),
        diluicao: String(r.dados.diluicao ?? ""),
        concentracao: c && num(c.valor) ? { valor: num(c.valor)!, unidade: c.unidade as UnidadeDeConcentracao } : null,
        passos: [{ momento: r.momento, valor: num(vel.valor) ?? 0, unidade: vel.unidade as UnidadeDeVelocidade }],
        inicio: r.momento,
        fim: null,
        ultimoRegistro: r.momento,
      });
      continue;
    }
    const inf = mapa.get(String(r.dados.infusao_id ?? ""));
    if (!inf) continue;
    inf.ultimoRegistro = r.momento;
    if (acao === "ajustar") {
      inf.passos.push({ momento: r.momento, valor: num(vel.valor) ?? 0, unidade: vel.unidade as UnidadeDeVelocidade });
    } else if (acao === "encerrar") {
      inf.fim = r.momento;
    }
  }
  return [...mapa.values()];
}

export type TotalDaInfusao = {
  /** mL infundidos, quando dá para saber. */
  volumeMl: number | null;
  /** Quantidade de fármaco, na unidade de massa da concentração (ou UI). */
  quantidade: number | null;
  unidadeQuantidade: string | null;
  ate: string;
  incompleto: boolean;
};

/**
 * O total de uma infusão até o fim confirmado.
 *
 * Com velocidade em mL/h, o volume é direto e a quantidade sai pela
 * concentração. Com velocidade por peso (mcg/kg/min…), a quantidade é direta
 * — precisa do peso — e o volume sai pela concentração.
 */
export function totalDaInfusao(inf: Infusao, pesoKg: number | null): TotalDaInfusao {
  const ate = inf.fim ?? inf.ultimoRegistro;
  let volume: number | null = 0;
  let quantidade: number | null = 0;
  let unidadeQ: string | null = null;
  for (let i = 0; i < inf.passos.length; i++) {
    const p = inf.passos[i];
    const proximo = inf.passos[i + 1]?.momento ?? ate;
    const min = Math.max(0, minutosEntre(p.momento, proximo));
    const r = porMinuto(p.valor, p.unidade, pesoKg, inf.concentracao);
    if (volume !== null) volume = r.ml === null ? null : volume + r.ml * min;
    if (quantidade !== null) {
      if (r.qtd === null || !r.unidade) {
        quantidade = null;
      } else {
        unidadeQ = unidadeQ ?? r.unidade;
        // Um ajuste em mcg/kg/min depois de um em mg/h soma na mesma unidade.
        const q = r.unidade === unidadeQ ? r.qtd : converterMassa(r.qtd, r.unidade, unidadeQ);
        quantidade = q === null ? null : quantidade + q * min;
      }
    }
  }
  const arred = (v: number | null) => v === null ? null : Math.round(v * 100) / 100;
  return {
    volumeMl: arred(volume),
    quantidade: unidadeQ ? arred(quantidade) : null,
    unidadeQuantidade: unidadeQ,
    ate,
    incompleto: inf.fim === null,
  };
}

/** Quanto entra por minuto: mL e quantidade de fármaco. */
function porMinuto(
  valor: number, unidade: UnidadeDeVelocidade, pesoKg: number | null,
  c: Infusao["concentracao"],
): { ml: number | null; qtd: number | null; unidade: string | null } {
  if (unidade === "mL/h") {
    const ml = valor / 60;
    if (!c) return { ml, qtd: null, unidade: null };
    const massa = c.unidade === "%" ? "mg" : c.unidade.split("/")[0];
    const porMl = c.unidade === "%" ? c.valor * 10 : c.valor;
    return { ml, qtd: ml * porMl, unidade: massa };
  }
  const [massa, ...resto] = unidade.split("/");
  const porKg = resto[0] === "kg";
  const tempo = resto[resto.length - 1];
  if (porKg && !(pesoKg && pesoKg > 0)) return { ml: null, qtd: null, unidade: massa };
  const porTempo = valor * (porKg ? pesoKg! : 1);
  const qtdMin = tempo === "h" ? porTempo / 60 : porTempo;
  let ml: number | null = null;
  if (c) {
    const porMl = concentracaoNaUnidade(c, massa as "mg" | "mcg" | "UI");
    ml = porMl ? qtdMin / porMl : null;
  }
  return { ml, qtd: qtdMin, unidade: massa };
}

export { converterMassa };
