/**
 * BRONCOASPIRAÇÃO — cartão 16 da minuta de validação de 15/10/2026.
 *
 * Base: Manual de Crises (aba 15). Antibiótico, corticoide e alta são
 * decisões individualizadas: sem regra automática de 2 horas. O texto é do
 * AVANEST.
 */

import type { Protocolo } from "../tipos.ts";

export const BRONCOASPIRACAO: Protocolo = {
  id: "broncoaspiracao",
  titulo: "Broncoaspiração",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["aspiração", "aspiração pulmonar", "regurgitação", "vômito", "Mendelson"],
  sinais: ["vômito", "regurgitação", "conteúdo gástrico na faringe", "secreção no tubo", "dessaturação", "broncoespasmo", "pressão alta"],
  resumo: "Evitar mais aspiração, aspirar sob visão e proteger a via aérea sem tirar o tubo bem posicionado; corticoide e antibiótico não são rotina.",
  reconhecer: [
    "Regurgitação ou material na via aérea, hipoxemia, broncoespasmo, secreção e pressão alta.",
    "A apresentação pode ser tardia ou inicialmente discreta.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda e avisar a cirurgia. Evitar aspiração adicional.", detalhe: "Posição lateral ou cabeça baixa, se viável e segura." },
    { texto: "Aspirar a orofaringe sob visão e proteger a via aérea.", detalhe: "Não retirar por rotina o tubo bem posicionado e com cuff." },
    { texto: "O2 e ventilação conforme a necessidade.", detalhe: "Na hipóxia grave, não adiar a oxigenação para completar a aspiração." },
    { texto: "Aspirar o tubo e a árvore brônquica quando indicado.",
      detalhe: "Material particulado ou obstrução: considerar broncoscopia; não lavar os pulmões indiscriminadamente." },
    { texto: "Avaliar a continuidade da cirurgia, o suporte pulmonar e o destino.",
      detalhe: "Descomprimir o estômago depois de proteger a via aérea, se indicado." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Broncodilatador se houver broncoespasmo.",
    "Corticoide e antibiótico não são rotina da pneumonite química imediata; tratar infecção ou contaminação específica conforme a evolução e a avaliação clínica.",
  ],
  pensarEm: [
    "Edema pulmonar, laringoespasmo, anafilaxia, intubação seletiva, pneumotórax e obstrução do tubo.",
  ],
  depois: [
    "Observação e reavaliação respiratória seriada.",
    "Radiografia inicial normal ou 2 horas sem sintomas não garantem a alta.",
    "Escalonar para a UTI conforme a oxigenação, a ventilação e a evolução; registrar o evento e comunicar o paciente.",
  ],
  divergencias: [
    {
      tema: "Alta depois de aspiração leve",
      posicoes: [{ texto: "Sem sintomas em 2 horas, com radiografia e SpO2 normais, pode dispensar a UTI.", referencia: "manual-15" }],
      escolha: "O protocolo não usa regra automática de 2 horas: a alta e o antibiótico são decisões individualizadas.",
    },
  ],
  referencias: ["manual-15"],
  relacionados: [
    { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" },
    { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" },
    { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" },
  ],
};
