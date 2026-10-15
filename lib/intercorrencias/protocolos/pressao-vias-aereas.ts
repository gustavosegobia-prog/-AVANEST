/**
 * PRESSÃO ELEVADA DAS VIAS AÉREAS — qualquer idade.
 *
 * Sequência do Manual de Crises (protocolo 13, lido no livro) e do QRH 2-3 da
 * Association of Anaesthetists (aberto e lido): isolar o aparelho, depois a
 * via aérea, depois o paciente. Não tem dose: as causas levam aos protocolos
 * próprios. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";

export const PRESSAO_VIAS_AEREAS: Protocolo = {
  id: "pressao-vias-aereas",
  titulo: "Pressão elevada das vias aéreas",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["pressão de pico alta", "pressão alta na via aérea", "alarme de pressão", "complacência baixa"],
  sinais: ["pressão de pico alta", "alarme de pressão", "bolsa dura", "volume corrente caindo", "capnografia obstrutiva", "dessaturação"],
  resumo: "Ventilar à mão, olhar a capnografia e isolar o problema: primeiro o aparelho (ressuscitador direto no tubo), depois a via aérea (aspirar, broncoscópio, trocar), depois o paciente.",
  reconhecer: [
    "Alarme de pressão alta ou bolsa dura na ventilação manual; volume corrente caindo.",
    "A curva de capnografia aponta a causa: fenda de relaxamento muscular, subida inclinada do broncoespasmo.",
    "No paciente não intubado, a causa mais comum é o laringoespasmo.",
    "Trocou o circuito pelo ressuscitador autoinflável e a pressão continua alta: o problema está na via aérea ou no paciente.",
  ],
  agirAgora: [
    { texto: "Ventilar à mão para confirmar a pressão alta; olhar a curva de EtCO2 e a via aérea.",
      detalhe: "Conferir tubos, válvulas, conexões e filtros; ver se o aparelho não está dobrando o tubo." },
    { texto: "Afastar plano superficial e relaxamento muscular insuficiente." },
    { texto: "Inspecionar o circuito, a válvula e o ventilador." },
    { texto: "Suspeita de auto-PEEP: pressão alveolar alta no fim da expiração, ou fluxo expiratório que não termina antes da próxima inspiração." },
    { texto: "Trocar o circuito por ressuscitador autoinflável ligado direto à via aérea.",
      detalhe: "Sem filtro e sem conector angulado. Se a pressão cair, o problema era o aparelho ou o circuito." },
    { texto: "Conferir posição e permeabilidade da via aérea: aspirar todo o comprimento do tubo e confirmar com broncoscópio." },
    { texto: "Pressão ainda alta: examinar o tórax e considerar pedir ajuda." },
    { texto: "Na dúvida, trocar o dispositivo; ventilando com máscara laríngea, considerar trocá-la por tubo traqueal." },
    { texto: "Laparoscopia: desinsuflar o pneumoperitônio e nivelar a mesa." },
    { texto: "Rever as causas do paciente (em “Pensar em”)." },
  ],
  medicamentos: [],
  volumes: [],
  pensarEm: [
    "Laringoespasmo, broncoespasmo, edema.",
    "Pneumotórax, hemotórax, rigidez da parede torácica.",
    "Anafilaxia, embolia, broncoaspiração, edema pulmonar, intubação seletiva, corpo estranho.",
    "O momento do evento: punção venosa central, fármaco recém-dado, ajuste do tubo, mudança de posição, pneumoperitônio, manobra cirúrgica.",
  ],
  depois: [
    "Sem resolver: gasometria arterial, ECG de 12 derivações e radiografia de tórax.",
    "Registrar na ficha a causa encontrada e as condutas.",
  ],
  divergencias: [],
  referencias: ["manual-13", "qrh-2-3"],
  relacionados: [
    { protocolo: "laringoespasmo", texto: "Laringoespasmo" },
    { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" },
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
    { protocolo: "embolia-gasosa-venosa", texto: "Embolia gasosa venosa" },
  ],
};
