/**
 * Orientações e correções da gasometria.
 *
 * Separado das fórmulas de propósito: gasometria.ts calcula, este arquivo
 * interpreta e sugere o que investigar. São coisas que mudam por motivos
 * diferentes — a fórmula de Winter não muda, o rol de causas a considerar
 * pode ser revisto pelo serviço.
 *
 * A régua editorial destes textos é uma só: eles dizem o que CONSIDERAR e o
 * que CONFERIR, nunca o que fazer. "Considerar cetoacidose" ajuda o raciocínio
 * e não decide nada; "fazer bicarbonato" decidiria, e essa decisão depende do
 * paciente, do contexto e de quem está lá — coisas que este código não sabe.
 *
 * Nas correções o alvo é sempre digitado por quem usa. O sistema faz a
 * aritmética, que é onde a máquina erra menos que a gente às pressas, e não
 * escolhe para onde levar o paciente.
 */

// Só tipos: nada daqui existe em tempo de execução, então este arquivo não
// carrega gasometria.ts para rodar. As referências chegam por parâmetro, de
// quem chamou — é uma fonte só de verdade, sem cópia do valor solta aqui.
import type { Gasometria, Interpretacao, Referencias } from "./gasometria";

export type Orientacao = {
  titulo: string;
  itens: string[];
  tom: "causas" | "atencao" | "critico";
};

const informado = (v?: number): v is number => typeof v === "number" && Number.isFinite(v);

/** Causas a considerar por distúrbio. Lista de apoio ao raciocínio, não diagnóstico. */
const CAUSAS: Record<string, { comAgAumentado?: string[]; comAgNormal?: string[]; geral?: string[] }> = {
  "acidose metabólica": {
    comAgAumentado: [
      "Acidose láctica — hipoperfusão, sepse, isquemia mesentérica",
      "Cetoacidose — diabética, alcoólica ou de jejum",
      "Uremia / injúria renal aguda",
      "Intoxicações — metanol, etilenoglicol, salicilato",
    ],
    comAgNormal: [
      "Perdas digestivas baixas — diarreia, fístula, ileostomia de alto débito",
      "Acidose tubular renal",
      "Volume elevado de solução salina 0,9%",
      "Inibidor da anidrase carbônica (acetazolamida)",
    ],
  },
  "alcalose metabólica": {
    geral: [
      "Perdas gástricas — vômitos, sonda nasogástrica aberta",
      "Diuréticos de alça ou tiazídicos",
      "Hipovolemia com contração de volume (responsiva a cloreto)",
      "Hipocalemia, hiperaldosteronismo, uso de corticoide",
    ],
  },
  "acidose respiratória": {
    geral: [
      "Depressão do centro respiratório — opioide, sedativo, anestésico residual",
      "Bloqueio neuromuscular residual ou fraqueza muscular",
      "Obstrução de via aérea, broncoespasmo, rolha de secreção",
      "Ventilação-minuto insuficiente para a demanda; conferir circuito e válvula expiratória",
      "DPOC com retenção crônica",
    ],
  },
  "alcalose respiratória": {
    geral: [
      "Dor, ansiedade, agitação",
      "Hipoxemia — a hiperventilação pode ser resposta, e não causa",
      "Sepse, febre",
      "Tromboembolismo pulmonar",
      "Ventilação-minuto acima da demanda",
      "Gestação e doença hepática, como causas crônicas",
    ],
  },
};

/**
 * Monta as orientações que os dados sustentam. Cada bloco só aparece quando há
 * base para ele — orientação genérica que aparece sempre vira ruído, e ruído
 * numa tela de sala cirúrgica faz o essencial passar batido.
 */
export function orientacoes(g: Gasometria, r: Interpretacao, ref: Referencias): Orientacao[] {
  const lista: Orientacao[] = [];

  // Gravidade primeiro: é o que muda a ordem das coisas.
  const criticos: string[] = [];
  if (informado(g.ph) && g.ph < 7.2) criticos.push(`Acidemia acentuada (pH ${g.ph}) — reavaliar perfusão, ritmo e via aérea`);
  if (informado(g.ph) && g.ph > 7.55) criticos.push(`Alcalemia acentuada (pH ${g.ph}) — atenção a arritmia e a hipocalemia associada`);
  if (informado(g.k) && g.k < 3) criticos.push(`Potássio ${g.k} mEq/L — corrigir antes de nova perda por alcalose`);
  if (informado(g.k) && g.k > 6) criticos.push(`Potássio ${g.k} mEq/L — conferir ECG`);
  if (r.lactato && r.lactato.valor >= 4) criticos.push(`Lactato ${r.lactato.valor} mmol/L — investigar hipoperfusão; isoladamente não fecha diagnóstico`);
  if (criticos.length) lista.push({ titulo: "Atenção imediata", itens: criticos, tom: "critico" });

  // Causas, conforme o distúrbio e o ânion gap.
  const causas = CAUSAS[r.disturbio];
  if (causas) {
    const agParaDecidir = r.anionGapCorrigido ?? r.anionGap;
    let itens = causas.geral ?? [];
    if (r.disturbio === "acidose metabólica" && informado(agParaDecidir)) {
      itens = agParaDecidir > ref.anionGapMax ? causas.comAgAumentado! : causas.comAgNormal!;
    } else if (r.disturbio === "acidose metabólica") {
      itens = [...(causas.comAgAumentado ?? []), ...(causas.comAgNormal ?? [])];
    }
    if (itens.length) {
      lista.push({
        titulo: `Causas a considerar — ${r.disturbio}`,
        itens,
        tom: "causas",
      });
    }
  }

  // Oxigenação, pelos critérios de Berlim. A ressalva da PEEP importa: sem ela
  // a classificação não se aplica, e omitir isso induziria a erro.
  if (informado(r.relacaoPF)) {
    const pf = r.relacaoPF;
    const faixa =
      pf > 300 ? "acima de 300 — sem critério de SDRA pela relação P/F"
      : pf > 200 ? "entre 201 e 300 — faixa de SDRA leve"
      : pf > 100 ? "entre 101 e 200 — faixa de SDRA moderada"
      : "igual ou abaixo de 100 — faixa de SDRA grave";
    const itens = [`P/F ${pf}, ${faixa}`, "A classificação de Berlim exige PEEP ≥ 5 cmH2O; sem ela, a faixa não se aplica"];
    if (r.gradienteAa && r.gradienteAa.gradiente > 20) {
      itens.push(`Gradiente A-a de ${r.gradienteAa.gradiente} mmHg — alargado, sugere shunt ou distúrbio V/Q, e não hipoventilação isolada`);
    } else if (r.gradienteAa) {
      itens.push(`Gradiente A-a de ${r.gradienteAa.gradiente} mmHg — dentro do esperado; hipoxemia com gradiente normal aponta hipoventilação ou FiO2 baixa`);
    }
    lista.push({ titulo: "Oxigenação", itens, tom: "atencao" });
  }

  // Distúrbio misto: o achado que mais passa despercebido.
  if (r.misto) {
    lista.push({
      titulo: "Distúrbio misto",
      itens: [
        "A compensação não fecha com o distúrbio principal — há mais de um processo em curso",
        "Rever o quadro clínico antes de tratar um dos componentes isoladamente",
      ],
      tom: "atencao",
    });
  }

  return lista;
}

/* ------------------------------------------------------------------ */
/* Correções: o alvo é sempre de quem usa. Aqui só se faz a aritmética. */
/* ------------------------------------------------------------------ */

/**
 * Déficit de bicarbonato = 0,3 × peso × (HCO3 desejado − HCO3 medido).
 *
 * O 0,3 é o espaço de distribuição estimado. É estimativa grosseira, e por isso
 * a interface diz para reavaliar com nova gasometria em vez de repor o total de
 * uma vez.
 */
export function deficitBicarbonato(pesoKg: number, hco3Medido: number, hco3Alvo: number): number | undefined {
  if (!informado(pesoKg) || pesoKg <= 0) return undefined;
  if (hco3Alvo <= hco3Medido) return undefined;
  return Math.round(0.3 * pesoKg * (hco3Alvo - hco3Medido));
}

/**
 * Ventilação-minuto necessária para uma PaCO2 alvo, pela relação inversa entre
 * ventilação e PaCO2: VE nova = VE atual × (PaCO2 atual ÷ PaCO2 alvo).
 *
 * Vale como estimativa quando produção de CO2 e espaço morto seguem estáveis —
 * o que nem sempre é verdade, e é por isso que o resultado é um ponto de
 * partida a conferir na próxima gasometria.
 */
export function ventilacaoParaAlvo(veAtual: number, paco2Atual: number, paco2Alvo: number): number | undefined {
  if (!informado(veAtual) || veAtual <= 0) return undefined;
  if (!informado(paco2Alvo) || paco2Alvo <= 0) return undefined;
  return Math.round((veAtual * paco2Atual) / paco2Alvo * 10) / 10;
}

/** Mesma relação, aplicada à frequência respiratória com volume corrente fixo. */
export function frequenciaParaAlvo(frAtual: number, paco2Atual: number, paco2Alvo: number): number | undefined {
  if (!informado(frAtual) || frAtual <= 0) return undefined;
  if (!informado(paco2Alvo) || paco2Alvo <= 0) return undefined;
  return Math.round((frAtual * paco2Atual) / paco2Alvo);
}

export const AVISO_CORRECOES =
  "Contas de apoio, com o alvo definido por você. São estimativas: reavaliar com nova gasometria antes de repetir a intervenção.";

export const AVISO_ORIENTACOES =
  "Lista de apoio ao raciocínio, não diagnóstico. Nenhuma conduta é sugerida automaticamente — a decisão é do médico que está com o paciente.";
