/**
 * A APROVAÇÃO MÉDICA DOS PROTOCOLOS.
 *
 * A minuta de validação de 15/10/2026 pede que o responsável médico registre
 * nome, CRM, data e a versão aprovada. O registro mora aqui, no código, junto
 * do conteúdo que ele aprova, e diz QUAIS protocolos e em QUAL versão: muda o
 * conteúdo, sobe a versão do protocolo, e a aprovação deixa de valer para ele;
 * protocolo novo entra sem aprovação. Nos dois casos a tela diz "versão nova,
 * sem aprovação registrada" até uma aprovação ser escrita aqui.
 */

import type { Protocolo } from "./tipos.ts";

export type Aprovacao = {
  responsavel: string;
  crm: string;
  /** AAAA-MM-DD. */
  data: string;
  documento: string;
  /** O id de cada protocolo aprovado e a versão dele que foi aprovada. */
  protocolos: Readonly<Record<string, number>>;
};

/** Os 34 cartões da minuta de 15/10/2026, todos na versão 2. */
const MINUTA_DE_15_10_2026 = [
  "pcr-fv-tv", "pcr-aesp-assistolia", "sav-pediatrico", "isquemia-miocardica", "hemorragia-macica", "anafilaxia",
  "reacao-hemolitica-transfusional", "embolia-gasosa-venosa", "ventilacao-mascara-dificil", "intubacao-dificil",
  "nao-ventilo-nao-intubo", "laringoespasmo", "pressao-vias-aereas", "broncoespasmo-grave", "broncoaspiracao",
  "bloqueio-neuroaxial-alto", "hemorragia-pos-parto", "colapso-materno", "reanimacao-neonatal", "toxicidade-anestesico-local",
  "hipercalemia", "hipertermia-maligna", "evento-sem-diagnostico", "depois-da-crise", "colega-afetado", "dessaturacao",
  "hipertensao", "hipotensao", "taquiarritmia", "bradicardia", "aumento-etco2", "diminuicao-etco2", "verificacao-aparelho",
  "verificacao-pre-inducao",
];

export const APROVACOES: readonly Aprovacao[] = [
  {
    responsavel: "Gustavo Segobia da Silva",
    crm: "CRM 49131",
    data: "2026-10-15",
    documento: "Minuta de validação AVANEST — protocolos de crise em anestesia, revisão de 15/10/2026",
    protocolos: Object.fromEntries(MINUTA_DE_15_10_2026.map((id) => [id, 2])),
  },
];

/** A aprovação que vale para este protocolo: a da versão dele, com conteúdo até a data da aprovação. */
export const aprovacaoDe = (p: Protocolo, lista: readonly Aprovacao[] = APROVACOES): Aprovacao | undefined =>
  lista.find((a) => a.protocolos[p.id] === p.versao && p.atualizadoEm <= a.data);

export const aprovado = (p: Protocolo, lista: readonly Aprovacao[] = APROVACOES): boolean => aprovacaoDe(p, lista) !== undefined;

/** "15/10/2026". */
export const dataDaAprovacao = (a: Aprovacao) => a.data.split("-").reverse().join("/");
