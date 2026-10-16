/**
 * BRADICARDIA PEDIÁTRICA — cartão 08 da minuta preliminar “Protocolos de
 * crise” (outubro de 2026).
 *
 * Versão 2: revisão científica de 16/10/2026. Conferidos no texto: QRH 2-6
 * (atropina 20 mcg/kg; compressões com FC abaixo de 60 no lactente; marca-passo)
 * e Manual de Crises, aba 30. As doses e limites de adrenalina e atropina são
 * os do cartão Bradicardia grave, já aprovado (PALS 2025); o texto do PALS
 * 2025 não pôde ser aberto na revisão e fica pendente de conferência. Fora da
 * transição ao nascer (sala de parto: reanimação neonatal). O texto é do
 * AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { ADRENALINA_100, ATROPINA_025 } from "./comum.ts";

export const BRADICARDIA_PEDIATRICA: Protocolo = {
  id: "bradicardia-pediatrica",
  titulo: "Bradicardia pediátrica",
  categoria: "pediatria",
  populacoes: ["pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-16",
  revisadoEm: "2026-10-16",
  bibliografiaGeral: false,
  sinonimos: ["bradicardia na criança", "FC baixa na criança", "bradicardia no lactente", "PALS bradicardia"],
  sinais: ["FC abaixo de 60", "bradicardia", "hipóxia", "má perfusão", "hipotensão", "reflexo vagal", "laringoscopia", "laringoespasmo"],
  resumo: "Na criança, a causa mais comum é hipóxia: oxigenar e ventilar primeiro. FC abaixo de 60 com má perfusão apesar disso: RCP e adrenalina. Atropina se vagal ou bloqueio AV primário.",
  reconhecer: [
    "FC baixa para a idade com hipoperfusão, hipotensão ou alteração da consciência.",
    "O número sozinho não indica RCP: o critério é FC abaixo de 60 com comprometimento circulatório apesar de oxigenação e ventilação adequadas.",
    "Hipóxia é a causa mais frequente; a FC costuma subir quando a oxigenação melhora.",
  ],
  agirAgora: [
    { texto: "Interromper o estímulo (laringoscopia, tração, insuflação) e chamar ajuda." },
    { texto: "Via aérea, O2 a 100% e ventilação com pressão positiva se preciso." },
    { texto: "Pulso, ritmo, pressão e perfusão; conferir o equipamento (FiO2, circuito, capnografia)." },
    { texto: "FC abaixo de 60 com comprometimento, apesar de oxigenação e ventilação: compressões torácicas.", detalhe: "Sem pulso: protocolo de suporte avançado de vida pediátrico." },
    { texto: "Acesso IV ou IO: adrenalina; repetir a cada 3 a 5 minutos enquanto persistir." },
    { texto: "Tônus vagal aumentado ou bloqueio AV primário: atropina." },
    { texto: "Refratária: marca-passo transcutâneo, com apoio especializado." },
  ],
  medicamentos: [
    {
      id: "adrenalina-bradi-ped", farmaco: "Adrenalina", indicacao: "FC abaixo de 60 com comprometimento, apesar de O2 e ventilação", populacao: "pediatrico",
      via: "IV ou IO",
      dose: { usual: 10, unidade: "mcg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "mg" }, apresentacoes: [ADRENALINA_100], altoRisco: true,
      repeticao: "A cada 3 a 5 minutos.",
      cuidados: ["0,01 mg/kg = 0,1 mL/kg da solução a 0,1 mg/mL (1 mg em 10 mL)."],
      referencias: ["aha-2025-pals-bradicardia"],
    },
    {
      id: "atropina-bradi-ped", farmaco: "Atropina", indicacao: "Tônus vagal aumentado ou bloqueio AV primário", populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 0.02, unidade: "mg", por: "kg" }, doseMinima: { valor: 0.1, unidade: "mg" }, tetoAbsoluto: { valor: 0.5, unidade: "mg" },
      apresentacoes: [ATROPINA_025],
      repeticao: "Pode repetir uma vez.",
      referencias: ["qrh-2-6", "manual-30", "aha-2025-pals-bradicardia"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Adrenalina de 1 mcg/kg (QRH 2-6, quadro B) é a dose de emergência sem PCR, e não substitui os 10 mcg/kg da bradicardia com comprometimento.",
    "A atropina da pré-medicação não é a dose da bradicardia.",
  ],
  pensarEm: [
    "Hipóxia, estímulo vagal, hipotermia, fármacos (remifentanil, succinilcolina, betabloqueador, bloqueador de canal de cálcio, digoxina), hipercalemia, hipertensão intracraniana, cardiopatia congênita e bloqueio de condução.",
    "Sem pulso: suporte avançado de vida pediátrico. Recém-nascido na sala de parto: reanimação neonatal.",
  ],
  depois: [
    "ECG de 12 derivações, eletrólitos, glicemia e temperatura; procurar a causa.",
    "UTI pediátrica e cardiologia se houve compressões, adrenalina ou bloqueio AV.",
    "Registrar a FC mínima, a duração, as doses e a resposta.",
  ],
  divergencias: [],
  referencias: ["qrh-2-6", "manual-30", "aha-2025-pals-bradicardia"],
  veja: [
    { protocolo: "bradicardia", quando: ["adulto", "gestante"], texto: "Adulto: atropina 1 mg e marca-passo ou vasoativo — Bradicardia grave." },
    { protocolo: "reanimacao-neonatal", quando: ["neonatal"], texto: "Recém-nascido na sala de parto: Reanimação neonatal." },
  ],
  relacionados: [
    { protocolo: "sav-pediatrico", texto: "Suporte avançado de vida pediátrico" },
    { protocolo: "laringoespasmo", texto: "Laringoespasmo" },
  ],
};
