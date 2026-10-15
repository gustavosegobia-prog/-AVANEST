/**
 * BRADICARDIA PEDIÁTRICA — cartão 08 da minuta preliminar “Protocolos de
 * crise” (outubro de 2026, para validação médica).
 *
 * Base: Tratado SAESP; algoritmo de bradicardia com pulso do PALS 2025
 * (AHA/AAP). As doses são as mesmas do cartão Bradicardia grave, na faixa da
 * criança; aqui com o passo a passo pediátrico inteiro. Fora da transição ao
 * nascer (sala de parto: reanimação neonatal). O texto é do AVANEST. Versão 1,
 * sem aprovação registrada até a validação.
 */

import type { Protocolo } from "../tipos.ts";
import { ADRENALINA_100, ATROPINA_025 } from "./comum.ts";

export const BRADICARDIA_PEDIATRICA: Protocolo = {
  id: "bradicardia-pediatrica",
  titulo: "Bradicardia pediátrica",
  categoria: "pediatria",
  populacoes: ["pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["bradicardia na criança", "FC baixa na criança", "bradicardia no lactente", "PALS bradicardia"],
  sinais: ["FC abaixo de 60", "bradicardia", "hipóxia", "má perfusão", "hipotensão", "reflexo vagal", "laringoscopia"],
  resumo: "Na criança, a causa mais comum é hipóxia: oxigenar e ventilar primeiro. FC abaixo de 60 com má perfusão apesar disso: RCP e adrenalina; atropina se vagal ou bloqueio AV primário.",
  reconhecer: [
    "Bradicardia com hipoperfusão, hipotensão ou alteração da consciência.",
    "Hipóxia é causa frequente: a FC costuma subir quando a oxigenação melhora.",
    "Não iniciar RCP só pelo número da FC: o critério é FC abaixo de 60 com comprometimento.",
  ],
  agirAgora: [
    { texto: "Via aérea, oxigenação e ventilação primeiro." },
    { texto: "Interromper o estímulo vagal e rever os fármacos." },
    { texto: "O2 e ventilação com pressão positiva, se necessário." },
    { texto: "ECG, pulso e perfusão." },
    { texto: "FC abaixo de 60 por minuto com comprometimento, apesar de oxigenação e ventilação adequadas: iniciar RCP." },
    { texto: "Acesso IV ou IO; adrenalina." },
    { texto: "Atropina se aumento do tônus vagal ou bloqueio AV primário." },
    { texto: "Refratária: estimulação cardíaca (marca-passo) com apoio especializado." },
  ],
  medicamentos: [
    {
      id: "adrenalina-bradi-ped", farmaco: "Adrenalina", indicacao: "FC abaixo de 60 com comprometimento, apesar de O2 e ventilação", populacao: "pediatrico",
      via: "IV ou IO",
      dose: { usual: 10, unidade: "mcg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "mg" }, apresentacoes: [ADRENALINA_100], altoRisco: true,
      repeticao: "A cada 3 a 5 minutos, conforme a ressuscitação.",
      referencias: ["aha-2025-pals-bradicardia", "saesp-tratado"],
    },
    {
      id: "atropina-bradi-ped", farmaco: "Atropina", indicacao: "Tônus vagal aumentado ou bloqueio AV primário", populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 0.02, unidade: "mg", por: "kg" }, doseMinima: { valor: 0.1, unidade: "mg" }, tetoAbsoluto: { valor: 0.5, unidade: "mg" },
      apresentacoes: [ATROPINA_025],
      repeticao: "Repetir uma vez, se indicado.",
      referencias: ["aha-2025-pals-bradicardia", "saesp-tratado"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Adrenalina 0,01 mg/kg = 0,1 mL/kg da solução a 0,1 mg/mL.",
    "A atropina da pré-medicação não é a dose da bradicardia.",
  ],
  pensarEm: ["Hipóxia, hipotermia, fármacos, distúrbios eletrolíticos, cardiopatia congênita e bloqueio de condução."],
  depois: [
    "Investigar a causa e a condução; ECG e eletrólitos.",
    "UTI pediátrica e cardiologia conforme a resposta.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "aha-2025-pals-bradicardia"],
  veja: [
    { protocolo: "bradicardia", quando: ["adulto", "gestante"], texto: "Adulto: atropina 1 mg e marca-passo ou vasoativo — Bradicardia grave." },
    { protocolo: "reanimacao-neonatal", quando: ["neonatal"], texto: "Recém-nascido na sala de parto: Reanimação neonatal." },
  ],
  relacionados: [
    { protocolo: "sav-pediatrico", texto: "Suporte avançado de vida pediátrico" },
    { protocolo: "laringoespasmo", texto: "Laringoespasmo" },
  ],
};
