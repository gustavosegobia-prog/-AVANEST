/**
 * EMBOLIA GASOSA VENOSA — cartão 05 da minuta de validação de 15/10/2026.
 *
 * Base: Manual de Crises (aba 08). Avaliação hiperbárica: 10ª Conferência
 * Europeia de Consenso em Medicina Hiperbárica, sem janela rígida de 6 h. Não
 * há fármaco que elimine o gás: o suporte segue os protocolos de hipotensão e
 * de PCR. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";

export const EMBOLIA_GASOSA: Protocolo = {
  id: "embolia-gasosa-venosa",
  titulo: "Embolia gasosa venosa",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["embolia aérea", "embolia gasosa", "embolia por CO2", "embolia gasosa paradoxal"],
  sinais: ["EtCO2 caindo", "queda súbita do EtCO2", "SpO2 caindo", "hipotensão súbita", "PVC subindo", "sopro em roda de moinho",
    "craniotomia sentada", "fossa posterior", "laparoscopia", "colapso"],
  resumo: "Parar a entrada de gás, O2 a 100% sem óxido nitroso, suporte de ventilação e circulação e RCP se parar; hiperbárica cedo se arterial ou neurológica.",
  reconhecer: [
    "Queda abrupta do EtCO2, dessaturação e hipotensão em contexto de risco.",
    "Gás ao eco ou ao Doppler, aumento da pressão pulmonar ou colapso podem ocorrer.",
  ],
  agirAgora: [
    { texto: "Avisar a cirurgia, pedir ajuda, suspender o N2O e administrar O2 a 100%." },
    { texto: "Interromper a entrada: parar a insuflação, ocluir ou inundar o campo, cobrir os vasos e revisar infusões e conexões pressurizadas." },
    { texto: "Suportar ventilação e circulação.",
      detalhe: "A posição deve permitir a ressuscitação; Durant ou Trendelenburg apenas se apropriados, sem prejudicar compressões ou perfusão." },
    { texto: "Aspirar pelo cateter venoso central já adequadamente posicionado, se possível.",
      detalhe: "Não atrasar o suporte para inserir um cateter central só com essa finalidade." },
    { texto: "Sem pulso: RCP. Avaliar o eco e as causas concorrentes." },
    { texto: "Acometimento arterial ou neurológico: contato precoce com o centro hiperbárico.",
      detalhe: "O atraso não é exclusão automática da avaliação." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Cristaloide em bolus titulado à perfusão, com reavaliação e atenção à falência do VD.",
    "Vasoativo conforme o protocolo de hipotensão grave; na PCR, a dose do algoritmo de PCR.",
    "Não há fármaco específico que elimine o gás.",
  ],
  pensarEm: [
    "Tromboembolismo, embolia por CO2, tensão, anafilaxia, hemorragia, falha do circuito ou do capnógrafo.",
    "PEEP pode piorar o retorno venoso e a embolização paradoxal; individualizar.",
  ],
  depois: [
    "Monitorização ou UTI e avaliação neurológica.",
    "Registrar a provável porta de entrada e prevenir a recorrência.",
  ],
  divergencias: [
    {
      tema: "Janela para o oxigênio hiperbárico",
      posicoes: [{ texto: "Avaliação especializada da embolia gasosa, sem restringir a uma janela rígida de 6 horas.", referencia: "echm-2017-hiperbarica" }],
      escolha: "O protocolo não restringe a avaliação hiperbárica a 6 horas: o atraso não exclui automaticamente.",
    },
  ],
  referencias: ["manual-08", "echm-2017-hiperbarica"],
  relacionados: [
    { protocolo: "hipotensao", texto: "Hipotensão grave" },
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
  ],
};
