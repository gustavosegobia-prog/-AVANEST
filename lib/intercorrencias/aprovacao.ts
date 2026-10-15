/**
 * A APROVAÇÃO MÉDICA DOS PROTOCOLOS.
 *
 * A minuta de validação de 15/10/2026 pede que o responsável médico registre
 * nome, CRM, data e a versão aprovada. O registro mora aqui, no código, junto
 * do conteúdo que ele aprova: muda o conteúdo, sobe a versão do protocolo, e a
 * aprovação deixa de valer para ele — a tela passa a dizer "versão nova, sem
 * aprovação registrada" até uma nova aprovação ser escrita aqui.
 */

import type { Protocolo } from "./tipos.ts";

export type Aprovacao = {
  responsavel: string;
  crm: string;
  /** AAAA-MM-DD. */
  data: string;
  /** A versão dos protocolos que foi aprovada. */
  versao: number;
  documento: string;
};

export const APROVACAO: Aprovacao = {
  responsavel: "Gustavo Segobia da Silva",
  crm: "CRM 49131",
  data: "2026-10-15",
  versao: 2,
  documento: "Minuta de validação AVANEST — protocolos de crise em anestesia, revisão de 15/10/2026",
};

/** A aprovação vale para este protocolo? Só para a versão aprovada, com conteúdo até a data da aprovação. */
export const aprovado = (p: Protocolo, a: Aprovacao = APROVACAO): boolean =>
  p.versao === a.versao && p.atualizadoEm <= a.data;
