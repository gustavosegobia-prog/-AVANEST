/**
 * ISQUEMIA MIOCÁRDICA INTRAOPERATÓRIA — cartão 03 da minuta de validação de
 * 15/10/2026.
 *
 * Base: Manual de Crises (aba 04 e tabela da aba 34). As metas hemodinâmicas
 * são individualizadas pela diretriz perioperatória ACC/AHA 2024, e não
 * impostas a todos. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { METOPROLOL_1, NITROGLICERINA_200 } from "./comum.ts";

export const ISQUEMIA: Protocolo = {
  id: "isquemia-miocardica",
  titulo: "Isquemia miocárdica intraoperatória",
  categoria: "cardiovascular",
  populacoes: ["adulto"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["isquemia", "infarto", "síndrome coronária aguda", "angina", "supra de ST", "infra de ST"],
  sinais: ["supra de ST", "infra de ST", "ST", "onda T", "ECG", "arritmia nova", "taquicardia", "hipotensão", "edema pulmonar"],
  resumo: "Corrigir o que piora a oferta e a demanda, metas individualizadas, ECG e eco sem atrasar a reperfusão; metoprolol ou nitroglicerina só quando a perfusão permite.",
  reconhecer: [
    "Alteração nova de ST/T, arritmia, instabilidade ou alteração segmentar ao eco.",
    "Confirmar o traçado com ECG; considerar infarto tipo 1 e desequilíbrio entre oferta e demanda.",
  ],
  agirAgora: [
    { texto: "Avisar a cirurgia e pedir ajuda ou a cardiologia; deixar o desfibrilador disponível.",
      detalhe: "Reduzir ou interromper o estímulo, se viável." },
    { texto: "Corrigir hipoxemia, ventilação, dor, plano anestésico, temperatura e arritmia." },
    { texto: "Avaliar perfusão, sangramento, Hb e função ventricular; tratar a hipotensão.",
      detalhe: "Individualizar as metas, sem impor FC de 50 a 60, PAM acima de 75 ou Ht acima de 30% a todos." },
    { texto: "ECG de 12 derivações e eco, quando disponíveis.", detalhe: "Não atrasar a reperfusão indicada por exame complementar." },
    { texto: "Supra persistente ou instabilidade: decisão urgente de reperfusão.",
      detalhe: "Antiagregação e anticoagulação com a cardiologia e a cirurgia, ponderando o sangramento." },
  ],
  medicamentos: [
    {
      id: "metoprolol-isquemia", farmaco: "Metoprolol", indicacao: "Se a taquicardia contribui e a perfusão permite",
      populacao: "adulto", via: "IV",
      dose: { usual: 2.5, unidade: "mg", por: "fixa" }, apresentacoes: [METOPROLOL_1],
      repeticao: "Reavaliar antes de repetir.",
      cuidados: ["Evitar em choque, bloqueio AV significativo, broncoespasmo ou insuficiência cardíaca descompensada."],
      referencias: ["manual-34", "acc-aha-2024-perioperatorio"],
    },
    {
      id: "nitroglicerina-isquemia", farmaco: "Nitroglicerina", indicacao: "Se a pressão e o contexto permitem — início, depois titular",
      populacao: "adulto", via: "IV",
      dose: { usual: 5, unidade: "mcg", por: "min" }, apresentacoes: [NITROGLICERINA_200],
      velocidade: "Iniciar em 5 mcg/min e titular.",
      cuidados: [
        "Evitar hipotensão e o paciente dependente de pré-carga.",
        "Interação com inibidor da PDE5: conferir o intervalo específico do fármaco.",
      ],
      referencias: ["manual-04", "manual-34"],
    },
  ],
  volumes: [],
  notasDeDose: ["Transfusão conforme anemia, hemorragia e isquemia; não por Ht de 30% isolado."],
  pensarEm: [
    "Hipovolemia, baixo débito, anemia, hipoxemia, taquicardia, espasmo ou trombose coronária, embolia gasosa, erro de monitorização e distúrbio eletrolítico.",
  ],
  depois: [
    "Troponina e ECG seriados e investigação da causa.",
    "Nível de cuidado monitorizado ou UTI; registrar as decisões terapêuticas.",
  ],
  divergencias: [
    {
      tema: "Metas hemodinâmicas",
      posicoes: [
        { texto: "Frequência entre 50 e 60, PAM acima de 75 mmHg e hematócrito acima de 30%.", referencia: "manual-04" },
        { texto: "Metas individualizadas pelo paciente e pelo mecanismo.", referencia: "acc-aha-2024-perioperatorio" },
      ],
      escolha: "O protocolo individualiza as metas e não impõe os números a todos os pacientes.",
    },
    {
      tema: "Início da nitroglicerina",
      posicoes: [
        { texto: "50 mg em 50 mL de SF 0,9%; começar com 3 a 5 mL/h e titular.", referencia: "manual-04" },
        { texto: "Tabela de infusões: 50 mg em 250 mL, a partir de 5 mcg/min.", referencia: "manual-34" },
      ],
      escolha: "O protocolo usa 50 mg em 250 mL finais (200 mcg/mL) e começa em 5 mcg/min: 1,5 mL/h.",
    },
  ],
  referencias: ["manual-04", "manual-34", "acc-aha-2024-perioperatorio"],
  relacionados: [{ protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" }],
};
