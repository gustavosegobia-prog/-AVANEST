/**
 * O CATÁLOGO: as seis categorias, os protocolos escritos e os que ainda vêm.
 *
 * Um protocolo novo é um arquivo em protocolos/ e uma linha em PROTOCOLOS. A
 * lista de previstos é só o índice: aparece na categoria como "em preparação"
 * e some sozinha quando o protocolo de mesmo título entra.
 */

import type { Categoria, Previsto, Protocolo } from "./tipos.ts";
import { ANAFILAXIA } from "./protocolos/anafilaxia.ts";
import { COLEGA_AFETADO, DEPOIS_DA_CRISE, DEZ_TS, PRE_INDUCAO, VERIFICACAO_APARELHO } from "./protocolos/apoio.ts";
import { BRONCOASPIRACAO } from "./protocolos/broncoaspiracao.ts";
import { BRONCOESPASMO } from "./protocolos/broncoespasmo.ts";
import {
  AUMENTO_ETCO2, BRADICARDIA, DESSATURACAO, HIPERTENSAO, HIPOTENSAO, QUEDA_ETCO2, TAQUIARRITMIA,
} from "./protocolos/diagnostico.ts";
import { HIPERCALEMIA, HIPERTERMIA_MALIGNA, TOXICIDADE_AL } from "./protocolos/diversos.ts";
import { EMBOLIA_GASOSA } from "./protocolos/embolia-gasosa.ts";
import { HEMORRAGIA } from "./protocolos/hemorragia.ts";
import { COLAPSO_MATERNO, HEMORRAGIA_POS_PARTO, RAQUI_TOTAL } from "./protocolos/obstetricia.ts";
import { ISQUEMIA } from "./protocolos/isquemia.ts";
import { LARINGOESPASMO } from "./protocolos/laringoespasmo.ts";
import { PCR_AESP, PCR_FV_TV } from "./protocolos/pcr.ts";
import { PRESSAO_VIAS_AEREAS } from "./protocolos/pressao-vias-aereas.ts";
import { REACAO_HEMOLITICA } from "./protocolos/reacao-hemolitica.ts";
import { REANIMACAO_NEONATAL } from "./protocolos/reanimacao-neonatal.ts";
import { SAV_PEDIATRICO } from "./protocolos/sav-pediatrico.ts";
import { INTUBACAO_DIFICIL, NAO_VENTILO_NAO_INTUBO, VENTILACAO_MASCARA } from "./protocolos/via-aerea.ts";

/** Na ordem do Manual de Crises: as paradas primeiro. */
export const PROTOCOLOS: Protocolo[] = [
  PCR_FV_TV, PCR_AESP, SAV_PEDIATRICO, ISQUEMIA, HEMORRAGIA, ANAFILAXIA, REACAO_HEMOLITICA, EMBOLIA_GASOSA,
  VENTILACAO_MASCARA, INTUBACAO_DIFICIL, NAO_VENTILO_NAO_INTUBO, LARINGOESPASMO, PRESSAO_VIAS_AEREAS, BRONCOESPASMO,
  BRONCOASPIRACAO, RAQUI_TOTAL, HEMORRAGIA_POS_PARTO, COLAPSO_MATERNO, REANIMACAO_NEONATAL, TOXICIDADE_AL, HIPERCALEMIA,
  HIPERTERMIA_MALIGNA, DEZ_TS, DEPOIS_DA_CRISE, COLEGA_AFETADO,
  DESSATURACAO, HIPERTENSAO, HIPOTENSAO, TAQUIARRITMIA, BRADICARDIA, AUMENTO_ETCO2, QUEDA_ETCO2,
  VERIFICACAO_APARELHO, PRE_INDUCAO,
];

export const CATEGORIAS: Array<{ id: Categoria; nome: string; letra: string }> = [
  { id: "cardiovascular", nome: "Cardiovascular", letra: "A" },
  { id: "respiratorio", nome: "Respiratório e via aérea", letra: "B" },
  { id: "medicamentos", nome: "Medicamentos e reações", letra: "C" },
  { id: "obstetricia", nome: "Obstetrícia", letra: "D" },
  { id: "pediatria", nome: "Pediatria", letra: "E" },
  { id: "outras", nome: "Outras emergências", letra: "F" },
  { id: "apoio", nome: "Antes e depois da crise", letra: "G" },
];

const p = (categoria: Categoria, titulo: string, sinonimos: string[] = []): Previsto => ({ categoria, titulo, sinonimos });

export const PREVISTOS: Previsto[] = [
  p("cardiovascular", "PCR — FV/TV sem pulso", ["parada", "fibrilação ventricular", "choque"]),
  p("cardiovascular", "PCR — AESP/assistolia", ["parada", "atividade elétrica sem pulso"]),
  p("cardiovascular", "Bradicardia grave", ["bradicardia", "FC baixa"]),
  p("cardiovascular", "Taquiarritmia instável", ["taquicardia", "FA", "TSV", "cardioversão"]),
  p("cardiovascular", "Hipotensão grave", ["hipotensão", "PA caindo", "choque"]),
  p("cardiovascular", "Crise hipertensiva", ["hipertensão", "PA alta"]),
  p("cardiovascular", "Isquemia miocárdica intraoperatória", ["infarto", "supra de ST", "ECG"]),
  p("cardiovascular", "Hemorragia maciça", ["sangramento", "transfusão maciça", "choque hemorrágico"]),
  p("cardiovascular", "Embolia pulmonar", ["TEP", "EtCO2 caindo"]),
  p("cardiovascular", "Embolia gasosa venosa", ["embolia aérea", "EtCO2 caindo"]),
  p("respiratorio", "Dificuldade de ventilação com máscara", ["não ventila", "máscara difícil"]),
  p("respiratorio", "Intubação difícil não prevista", ["via aérea difícil", "não intubo"]),
  p("respiratorio", "Não ventilo, não intubo", ["não intubo, não oxigeno", "CICO", "cricotireoidostomia", "via aérea cirúrgica"]),
  p("respiratorio", "Laringoespasmo"),
  p("respiratorio", "Broncoespasmo grave", ["chiado", "sibilo", "asma"]),
  p("respiratorio", "Broncoaspiração", ["aspiração", "vômito"]),
  p("respiratorio", "Dessaturação súbita", ["hipoxemia", "SpO2 caindo"]),
  p("respiratorio", "Pressão elevada das vias aéreas", ["pressão de pico alta"]),
  p("respiratorio", "Pneumotórax hipertensivo", ["pneumotórax"]),
  p("respiratorio", "Intubação esofágica ou seletiva", ["tubo no esôfago", "seletiva"]),
  p("medicamentos", "Anafilaxia perioperatória"),
  p("medicamentos", "Toxicidade sistêmica por anestésicos locais", ["LAST", "emulsão lipídica"]),
  p("medicamentos", "Hipertermia maligna", ["dantroleno", "EtCO2 subindo", "rigidez"]),
  p("medicamentos", "Hipercalemia", ["potássio alto"]),
  p("medicamentos", "Reação hemolítica transfusional", ["transfusão"]),
  p("medicamentos", "Depressão respiratória por opioides", ["naloxona", "apneia"]),
  p("medicamentos", "Bloqueio neuromuscular residual", ["curarização residual", "TOF"]),
  p("obstetricia", "Bloqueio raquidiano alto ou total", ["raqui total", "raqui alta"]),
  p("obstetricia", "Hemorragia pós-parto", ["atonia", "HPP"]),
  p("obstetricia", "Eclâmpsia", ["convulsão na gestante", "magnésio"]),
  p("obstetricia", "Colapso materno e PCR na gestante", ["cesárea perimortem"]),
  p("obstetricia", "Embolia amniótica", ["embolia de líquido amniótico"]),
  p("obstetricia", "Via aérea difícil na gestante"),
  p("pediatria", "Suporte avançado de vida pediátrico", ["PCR na criança"]),
  p("pediatria", "Laringoespasmo pediátrico", ["laringoespasmo na criança"]),
  p("pediatria", "Bradicardia pediátrica", ["bradicardia na criança"]),
  p("pediatria", "Reanimação neonatal", ["recém-nascido"]),
  p("outras", "Hipoglicemia grave", ["glicose baixa"]),
  p("outras", "Hipotermia", ["temperatura baixa"]),
  p("outras", "Crise adrenal", ["insuficiência adrenal"]),
  p("outras", "Convulsão", ["crise convulsiva"]),
  p("outras", "Incêndio na sala cirúrgica", ["fogo"]),
  p("outras", "Falha de fornecimento de oxigênio ou energia", ["falta de oxigênio", "falta de energia"]),
  p("outras", "Delírio grave ao despertar", ["agitação ao despertar"]),
];

/**
 * Os protocolos que valem em mais de uma categoria: o laringoespasmo é um só
 * para adulto e criança, e aparece também em Pediatria — no lugar do
 * "Laringoespasmo pediátrico" previsto.
 */
const TAMBEM_EM: Record<string, { categoria: Categoria; noLugarDe: string }[]> = {
  laringoespasmo: [{ categoria: "pediatria", noLugarDe: "Laringoespasmo pediátrico" }],
  "reanimacao-neonatal": [{ categoria: "obstetricia", noLugarDe: "Reanimação neonatal" }],
};

export const acharProtocolo = (id: string) => PROTOCOLOS.find((x) => x.id === id);

export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Os títulos previstos que já têm protocolo (o próprio, ou o que ocupa o lugar dele). */
const cobertos = (protocolos: readonly Protocolo[]) => new Set(protocolos.flatMap((x) => [
  semAcento(x.titulo), ...(TAMBEM_EM[x.id] ?? []).map((t) => semAcento(t.noLugarDe)),
]));

/** O que uma categoria mostra: os protocolos prontos e os previstos ainda sem protocolo. */
export function itensDaCategoria(categoria: Categoria, protocolos: readonly Protocolo[] = PROTOCOLOS) {
  const prontos = protocolos.filter((x) => x.categoria === categoria
    || (TAMBEM_EM[x.id] ?? []).some((t) => t.categoria === categoria));
  const jaTem = cobertos(protocolos);
  const previstos = PREVISTOS.filter((x) => x.categoria === categoria && !jaTem.has(semAcento(x.titulo)));
  return { prontos, previstos };
}

export type Achado =
  | { tipo: "protocolo"; protocolo: Protocolo; porque: string }
  | { tipo: "previsto"; previsto: Previsto };

/**
 * A busca da sala: pelo nome, por sinônimo ou pelo que se vê no monitor.
 * Sem acento e sem diferença de maiúscula; cada palavra digitada tem de
 * aparecer em algum lugar. O título casa antes do sinal.
 */
export function buscar(texto: string, protocolos: readonly Protocolo[] = PROTOCOLOS): Achado[] {
  const palavras = semAcento(texto).split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w));
  if (!palavras.length) return [];
  const casa = (alvos: string[]) => palavras.every((w) => alvos.some((a) => semAcento(a).includes(w)));

  const achados: Array<{ pontos: number; achado: Achado }> = [];
  for (const x of protocolos) {
    const titulo = casa([x.titulo]);
    const sinonimo = !titulo && casa([x.titulo, ...x.sinonimos]);
    const sinal = !titulo && !sinonimo && casa([x.titulo, ...x.sinonimos, ...x.sinais, x.resumo]);
    if (!titulo && !sinonimo && !sinal) continue;
    const qual = sinal ? x.sinais.find((s) => palavras.some((w) => semAcento(s).includes(w))) : undefined;
    achados.push({
      pontos: titulo ? 0 : sinonimo ? 1 : 2,
      achado: { tipo: "protocolo", protocolo: x, porque: titulo ? "nome" : sinonimo ? "sinônimo" : `sinal: ${qual ?? "descrição"}` },
    });
  }
  const jaTem = cobertos(protocolos);
  for (const x of PREVISTOS) {
    if (jaTem.has(semAcento(x.titulo))) continue;
    if (casa([x.titulo, ...(x.sinonimos ?? [])])) achados.push({ pontos: 3, achado: { tipo: "previsto", previsto: x } });
  }
  return achados.sort((a, b) => a.pontos - b.pontos).map((a) => a.achado);
}
