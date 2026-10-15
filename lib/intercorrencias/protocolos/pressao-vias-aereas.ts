/**
 * PRESSÃO ELEVADA DAS VIAS AÉREAS — cartão 14 da minuta de validação de
 * 15/10/2026.
 *
 * Base: Manual de Crises (abas 13 e 33). Complemento operacional: QRH 2-3 da
 * Association of Anaesthetists. Não há dose universal: broncoespasmo,
 * laringoespasmo e anafilaxia têm protocolos próprios. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";

export const PRESSAO_VIAS_AEREAS: Protocolo = {
  id: "pressao-vias-aereas",
  titulo: "Pressão elevada das vias aéreas",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["pressão de pico alta", "pressão alta na via aérea", "alarme de pressão", "complacência baixa"],
  sinais: ["pressão de pico alta", "alarme de pressão", "bolsa dura", "volume corrente caindo", "capnografia obstrutiva", "dessaturação"],
  resumo: "Ventilar à mão e separar paciente de equipamento: tubo, circuito, filtro e ventilador primeiro; hiperinsuflação com colapso pede expiração, tensão instável pede descompressão.",
  reconhecer: [
    "Aumento de pressão ou resistência, redução de volume, dificuldade à ventilação manual ou expiração incompleta.",
    "Pico elevado com platô preservado sugere resistência; os dois elevados sugerem baixa complacência, com interpretação clínica.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda se grave; O2, ventilação manual e avaliação hemodinâmica." },
    { texto: "Revisar tubo, circuito, filtro, conexões, válvulas e ventilador.", detalhe: "Se houver dúvida, ressuscitador direto na via aérea." },
    { texto: "Conferir a profundidade e a permeabilidade do tubo; aspirar.", detalhe: "Broncoscopia quando necessária, sem atrasar o resgate." },
    { texto: "Suspeita de hiperinsuflação com colapso: permitir a expiração, inclusive com desconexão breve, e ajustar frequência e tempo expiratório." },
    { texto: "Examinar o tórax; tratar broncoespasmo ou anafilaxia.",
      detalhe: "Tensão com instabilidade exige descompressão por equipe habilitada, sem aguardar radiografia." },
    { texto: "Corrigir posição, pneumoperitônio, plano e tônus, quando contribuem." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Não há dose universal. Broncoespasmo, laringoespasmo e anafilaxia: protocolos próprios.",
    "Não administrar bloqueador antes de avaliar rapidamente uma causa mecânica corrigível, salvo necessidade do plano de resgate.",
  ],
  pensarEm: [
    "Tubo dobrado, mordido, obstruído ou seletivo; filtro; válvula APL ou ventilador; auto-PEEP; tensão; aspiração; edema; compressão e rigidez torácica.",
  ],
  depois: [
    "Gasometria e imagem conforme a gravidade e a causa.",
    "Registrar pressões, volumes e a intervenção eficaz.",
  ],
  divergencias: [],
  referencias: ["manual-13", "manual-33", "qrh-2-3"],
  relacionados: [
    { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" },
    { protocolo: "laringoespasmo", texto: "Laringoespasmo" },
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};
