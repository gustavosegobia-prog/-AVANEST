/**
 * SUPORTE AVANÇADO DE VIDA PEDIÁTRICO — cartão 28 da minuta de validação de
 * 15/10/2026.
 *
 * Base: Manual de Crises (aba 03). Sequência operacional atualizada: AHA/AAP
 * 2025 — que substitui, de forma explícita, os 4 J/kg em todo choque do
 * Manual. Fora da transição ao nascer (sala de parto: reanimação neonatal).
 * O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { ADRENALINA_100, AMIODARONA_50, LIDOCAINA_20 } from "./comum.ts";
import { RITMOS_DE_PCR } from "./pcr.ts";

export const SAV_PEDIATRICO: Protocolo = {
  id: "sav-pediatrico",
  titulo: "Suporte avançado de vida pediátrico",
  categoria: "pediatria",
  populacoes: ["pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["PCR na criança", "parada cardíaca pediátrica", "SAV pediátrico", "PALS", "reanimação pediátrica"],
  sinais: ["sem pulso", "bradicardia", "FV", "TV", "AESP", "assistolia", "linha reta", "EtCO2 caindo", "parada"],
  resumo: "RCP de qualidade; FV/TV: choque de 2 J/kg, depois 4 J/kg; adrenalina 10 mcg/kg depois do segundo choque, ou imediata na AESP e na assistolia.",
  reconhecer: [
    "Sem pulso, ou FC abaixo de 60 com hipoperfusão apesar de oxigenação e ventilação.",
    "Fora da transição ao nascer: na sala de parto, reanimação neonatal.",
  ],
  agirAgora: [
    { texto: "Ajuda, O2, RCP, monitor ou desfibrilador e acesso." },
    { texto: "Compressões de 100 a 120 por minuto, com pelo menos 1/3 do diâmetro do tórax.",
      detalhe: "Sem via aérea avançada: 15:2 com dois socorristas antes da puberdade; um socorrista, 30:2. Com via aérea avançada: 20 a 30 ventilações por minuto e compressões contínuas." },
    { texto: "FV/TV: choque de 2 J/kg; o segundo de 4 J/kg; os seguintes de 4 J/kg ou mais, até 10 J/kg ou a dose do adulto.",
      detalhe: "Retomar a RCP por 2 minutos." },
    { texto: "Adrenalina depois do segundo choque; amiodarona ou lidocaína depois do terceiro.",
      detalhe: "AESP ou assistolia: adrenalina imediata." },
    { texto: "Corrigir as causas e reavaliar a cada 2 minutos." },
  ],
  medicamentos: [
    {
      id: "adrenalina-sav-ped", farmaco: "Adrenalina", indicacao: "FV/TV depois do segundo choque; AESP e assistolia, imediata",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 10, unidade: "mcg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "mg" }, apresentacoes: [ADRENALINA_100], altoRisco: true,
      repeticao: "A cada 3 a 5 minutos.",
      referencias: ["manual-03", "aha-2025-pals-pcr"],
    },
    {
      id: "amiodarona-sav-ped", farmaco: "Amiodarona", indicacao: "Depois do terceiro choque — primeira dose",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 5, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 300, unidade: "mg" }, apresentacoes: [AMIODARONA_50],
      referencias: ["manual-03", "aha-2025-pals-pcr"],
    },
    {
      id: "amiodarona-sav-ped-2", farmaco: "Amiodarona", indicacao: "Doses seguintes",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 5, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 150, unidade: "mg" }, apresentacoes: [AMIODARONA_50],
      referencias: ["aha-2025-pals-pcr"],
    },
    {
      id: "lidocaina-sav-ped", farmaco: "Lidocaína", indicacao: "Alternativa à amiodarona",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 1, unidade: "mg", por: "kg" }, apresentacoes: [LIDOCAINA_20],
      referencias: ["aha-2025-pals-pcr"],
    },
  ],
  volumes: [
    { id: "choque-ped-1", rotulo: "Choque — primeiro", indicacao: "FV/TV sem pulso", populacao: "pediatrico", unidade: "J",
      porKg: { min: 2 }, referencias: ["aha-2025-pals-pcr"] },
    { id: "choque-ped-2", rotulo: "Choque — segundo", indicacao: "FV/TV persistente", populacao: "pediatrico", unidade: "J",
      porKg: { min: 4 }, referencias: ["aha-2025-pals-pcr"] },
    { id: "choque-ped-seguintes", rotulo: "Choques seguintes", indicacao: "4 J/kg ou mais, até 10 J/kg ou a dose do adulto (em geral até 200 J no bifásico)",
      populacao: "pediatrico", unidade: "J", porKg: { min: 4, max: 10 }, maximo: 200, referencias: ["aha-2025-pals-pcr"] },
  ],
  notasDeDose: [
    "Não usar atropina, cálcio ou bicarbonato de rotina.",
    "A via traqueal saiu do fluxo padrão: priorizar IV ou IO.",
  ],
  pensarEm: [
    "Hipóxia, hipovolemia, acidose, glicemia, potássio, temperatura, tensão, tamponamento, tóxicos e trombose; causas anestésicas.",
  ],
  depois: [
    "UTI pediátrica, prevenção de lesão secundária e tratamento da causa.",
    "Registro e conversa com a família.",
  ],
  divergencias: [
    {
      tema: "Carga do choque",
      posicoes: [
        { texto: "4 J/kg em todos os choques.", referencia: "manual-03" },
        { texto: "2 J/kg no primeiro, 4 J/kg no segundo e 4 a 10 J/kg nos seguintes.", referencia: "aha-2025-pals-pcr" },
      ],
      escolha: "O protocolo segue a AHA 2025, de forma explícita, e não alterna as duas sequências durante o algoritmo.",
    },
  ],
  referencias: ["manual-03", "aha-2025-pals-pcr"],
  veja: [
    { protocolo: "pcr-fv-tv", quando: ["adulto", "gestante"], texto: "Adulto com ritmo chocável: doses fixas e choque de 120 a 200 J na PCR — FV/TV sem pulso." },
    { protocolo: "pcr-aesp-assistolia", quando: ["adulto", "gestante"], texto: "Adulto com ritmo não chocável: PCR — AESP/assistolia." },
  ],
  ritmos: RITMOS_DE_PCR,
  relacionados: [
    { protocolo: "bradicardia", texto: "Bradicardia grave" },
    { protocolo: "reanimacao-neonatal", texto: "Reanimação neonatal (sala de parto)" },
  ],
};
