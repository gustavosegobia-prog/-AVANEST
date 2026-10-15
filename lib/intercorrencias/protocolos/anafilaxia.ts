/**
 * ANAFILAXIA PERIOPERATÓRIA — cartão 20 da minuta de validação de 15/10/2026.
 *
 * Base: Manual de Crises (aba 06) e Tratado SAESP (p. 1109). Doses e
 * estratégia complementares: cartões ANZAAG-ANZCA de 2022 (1, 2 e 6; o regime
 * refratário completo usa também os cartões 3 e 4). Adrenalina IM da criança
 * pelas faixas do Manual. O texto é do AVANEST: os cartões são protegidos por
 * direito autoral, e o que se aproveita deles são os números e a ordem
 * clínica, com a fonte.
 */

import type { Protocolo } from "../tipos.ts";
import { ADRENALINA_10, ADRENALINA_20, ADRENALINA_60, ADRENALINA_PURA_IM } from "./comum.ts";

const BOLUS_IV = ["Em monitorização, a cada 1 a 2 minutos conforme a resposta.", "Não usar a ampola de 1 mg/mL para pequeno bolus IV."];

export const ANAFILAXIA: Protocolo = {
  id: "anafilaxia",
  titulo: "Anafilaxia perioperatória",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["anafilaxia", "choque anafilático", "reação alérgica grave", "reação anafilactoide", "alergia"],
  sinais: [
    "hipotensão", "PA caindo", "pressão caindo", "taquicardia", "broncoespasmo", "chiado", "sibilo",
    "pressão de via aérea alta", "EtCO2 caindo", "capnografia caindo", "dessaturação", "rash", "eritema",
    "urticária", "vermelhidão", "angioedema", "edema de face", "PCR", "parada",
  ],
  resumo: "Hipotensão, broncoespasmo ou edema depois de uma exposição, com ou sem pele: adrenalina cedo, pela gravidade, e volume; infusão se os bolus se repetem.",
  reconhecer: [
    "Hipotensão ou colapso, broncoespasmo ou edema depois de possível exposição; os sinais cutâneos podem faltar.",
    "Não esperar a triptase.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, parar os desencadeantes possíveis e o procedimento, se viável; O2 e via aérea." },
    { texto: "Adrenalina precoce, pela gravidade; acesso IV calibroso, cristaloide e reavaliação." },
    { texto: "Bolus repetidos ou choque persistente: infusão de adrenalina, monitorização arterial e revisão do volume e do diagnóstico." },
    { texto: "Sem pulso: RCP e a dose da PCR.",
      detalhe: "Instabilidade extrema, com pressão muito baixa: considerar compressões conforme o protocolo perioperatório e avaliação imediata." },
    { texto: "Refratária: especialista, segundo vasopressor e investigação de causas concorrentes." },
    { texto: "Gestante: seguir também o protocolo de colapso materno.", so: ["gestante"] },
  ],
  medicamentos: [
    {
      id: "adrenalina-iv-moderada-adulto", farmaco: "Adrenalina", indicacao: "Reação moderada — titular", populacao: "adulto", via: "IV",
      dose: { min: 10, max: 20, unidade: "mcg", por: "fixa" }, apresentacoes: [ADRENALINA_10, ADRENALINA_20], altoRisco: true,
      cuidados: BOLUS_IV, par: "adrenalina-iv-moderada-ped",
      referencias: ["manual-06", "anzaag-cartao-1"],
    },
    {
      id: "adrenalina-iv-grave-adulto", farmaco: "Adrenalina", indicacao: "Risco de vida — titular", populacao: "adulto", via: "IV",
      dose: { min: 50, max: 100, unidade: "mcg", por: "fixa" }, apresentacoes: [ADRENALINA_10, ADRENALINA_20], altoRisco: true,
      cuidados: BOLUS_IV, par: "adrenalina-iv-grave-ped",
      referencias: ["anzaag-cartao-1"],
    },
    {
      id: "adrenalina-im-adulto", farmaco: "Adrenalina", indicacao: "Sem acesso IV ou sem monitorização adequada", populacao: "adulto", via: "IM",
      dose: { usual: 500, unidade: "mcg", por: "fixa" }, apresentacoes: [ADRENALINA_PURA_IM],
      referencias: ["manual-06", "anzaag-cartao-1"],
    },
    {
      id: "adrenalina-infusao-adulto", farmaco: "Adrenalina", indicacao: "Infusão inicial de referência — titular", populacao: "adulto", via: "IV",
      dose: { usual: 3, unidade: "mcg", por: "min" }, apresentacoes: [ADRENALINA_60], altoRisco: true,
      cuidados: ["Refratariedade e limites seguem os cartões ANZAAG completos."],
      referencias: ["anzaag-cartao-1", "anzaag-cartao-3"],
    },
    {
      id: "adrenalina-iv-moderada-ped", farmaco: "Adrenalina", indicacao: "Reação moderada", populacao: "pediatrico", via: "IV",
      dose: { usual: 2, unidade: "mcg", por: "kg" }, apresentacoes: [ADRENALINA_10, ADRENALINA_20], altoRisco: true,
      cuidados: BOLUS_IV, par: "adrenalina-iv-moderada-adulto",
      referencias: ["anzaag-cartao-2"],
    },
    {
      id: "adrenalina-iv-grave-ped", farmaco: "Adrenalina", indicacao: "Risco de vida", populacao: "pediatrico", via: "IV",
      dose: { min: 4, max: 10, unidade: "mcg", por: "kg" }, apresentacoes: [ADRENALINA_10, ADRENALINA_20], altoRisco: true,
      cuidados: BOLUS_IV, par: "adrenalina-iv-grave-adulto",
      referencias: ["anzaag-cartao-2"],
    },
    {
      id: "adrenalina-im-ped-menor-6", farmaco: "Adrenalina", indicacao: "Sem acesso IV — abaixo de 6 anos", populacao: "pediatrico", via: "IM",
      idadeAnos: { max: 6 },
      dose: { usual: 150, unidade: "mcg", por: "fixa" }, apresentacoes: [ADRENALINA_PURA_IM],
      cuidados: ["Lactentes: usar a política institucional por peso."],
      referencias: ["manual-06"],
    },
    {
      id: "adrenalina-im-ped-6-12", farmaco: "Adrenalina", indicacao: "Sem acesso IV — 6 a 12 anos", populacao: "pediatrico", via: "IM",
      idadeAnos: { min: 6 },
      dose: { usual: 300, unidade: "mcg", por: "fixa" }, apresentacoes: [ADRENALINA_PURA_IM],
      referencias: ["manual-06"],
    },
    {
      id: "adrenalina-infusao-ped", farmaco: "Adrenalina", indicacao: "Infusão inicial de referência — titular", populacao: "pediatrico", via: "IV",
      dose: { usual: 0.1, unidade: "mcg", por: "kg/min" }, apresentacoes: [ADRENALINA_20], altoRisco: true,
      cuidados: ["Refratariedade e limites seguem os cartões ANZAAG completos."],
      referencias: ["anzaag-cartao-2", "anzaag-cartao-4"],
    },
  ],
  volumes: [
    { id: "cristaloide-ped", indicacao: "Bolus; reavaliar", populacao: "pediatrico", porKg: { min: 20 }, referencias: ["anzaag-cartao-2"] },
  ],
  notasDeDose: [
    "Preparo de 10 mcg/mL: 1 mg completado para 100 mL. De 20 mcg/mL: 1 mg completado para 50 mL.",
    "Cristaloide no adulto: bolus pela gravidade e pela resposta.",
  ],
  pensarEm: [
    "Hemorragia, raqui alta, toxicidade por anestésico local, embolia, tensão, fármaco errado e falha da via aérea.",
    "Ausência de curva de capnografia exige investigar tubo, ventilação e fluxo.",
  ],
  depois: [
    "Colher a triptase sem atrasar o suporte; registrar os tempos e obter a basal depois da recuperação.",
    "Alergologia, documentação e observação conforme a gravidade.",
    "Anti-histamínicos e corticoides não substituem a adrenalina nem corrigem o choque; não usar sugamadex como tratamento comprovado de anafilaxia.",
  ],
  divergencias: [
    {
      tema: "Bolus IV de adrenalina no adulto com risco de vida",
      posicoes: [
        { texto: "Grau 2: 20 mcg; grau 3: 100 a 200 mcg, a cada 1 a 2 minutos.", referencia: "manual-06" },
        { texto: "Risco de vida: 50 a 100 mcg, titulados.", referencia: "anzaag-cartao-1" },
      ],
      escolha: "O protocolo segue os cartões ANZAAG: 10 a 20 mcg na reação moderada e 50 a 100 mcg com risco de vida, titulados.",
    },
  ],
  referencias: ["manual-06", "saesp-tratado", "anzaag-cartao-1", "anzaag-cartao-2", "anzaag-cartao-6", "anzaag-cartao-3", "anzaag-cartao-4"],
  relacionados: [
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" },
    { protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" },
  ],
};
