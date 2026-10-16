/**
 * PNEUMOTÓRAX HIPERTENSIVO E INTUBAÇÃO ESOFÁGICA OU SELETIVA — cartões 14 e 15
 * da minuta preliminar “Protocolos de crise” (outubro de 2026).
 *
 * Versão 2: revisão científica de 16/10/2026. Conferidos no texto: diretriz
 * WSES-AAST 2025 de trauma torácico; consenso PUMA 2022 (intubação esofágica
 * não reconhecida); QRH 2-2 e 2-3; Manual de Crises, abas 26, 32 e 33. O ATLS
 * 11 e o livro de Medicina Intensiva da USP não estavam acessíveis: o local da
 * descompressão segue a WSES-AAST. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";

const REVISAO = "2026-10-16";

export const PNEUMOTORAX: Protocolo = {
  id: "pneumotorax-hipertensivo",
  titulo: "Pneumotórax hipertensivo",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["pneumotórax", "pneumotórax sob tensão", "descompressão torácica", "drenagem de tórax", "toracostomia"],
  sinais: ["pressão de pico alta", "dessaturação", "hipotensão", "murmúrio abolido", "tórax assimétrico", "enfisema subcutâneo",
    "turgência jugular", "desvio de traqueia", "depois de acesso central", "depois de bloqueio", "laparoscopia"],
  resumo: "Ventilação difícil com hipotensão e tórax assimétrico, sob pressão positiva: descomprimir já no instável, sem esperar imagem, e drenar.",
  reconhecer: [
    "Sob ventilação mecânica: pressão de via aérea subindo, volume corrente caindo, dessaturação e hipotensão, com expansão e murmúrio assimétricos.",
    "Taquicardia, turgência jugular, desvio da traqueia, enfisema subcutâneo e cianose podem estar presentes ou faltar; pode evoluir para PCR.",
    "Ultrassom à beira do leito é o exame mais útil no instável; não atrasar a descompressão por imagem.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda; O2 a 100%; ventilar à mão para sentir a complacência." },
    { texto: "Excluir em segundos o aparelho e o tubo: autoinflável direto no tubo; tubo dobrado, obstruído ou seletivo." },
    { texto: "Instável: descompressão imediata por profissional habilitado.", detalhe: "Toracostomia digital ou agulha no 5º espaço intercostal, linha axilar média, ou no 2º espaço, linha hemiclavicular." },
    { texto: "Dreno torácico: 4º a 6º espaço intercostal, linha axilar anterior ou média.", detalhe: "Sob pressão positiva, a drenagem é praticamente obrigatória." },
    { texto: "Laparoscopia: desinsuflar o pneumoperitônio." },
    { texto: "Reavaliar ventilação e hemodinâmica depois de cada passo; PCR: protocolos de PCR, com a descompressão." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: ["Sem fármaco próprio: o tratamento é a descompressão e a drenagem."],
  pensarEm: [
    "Intubação seletiva, tubo obstruído, broncoespasmo, auto-PEEP, tamponamento cardíaco e embolia gasosa.",
    "Causas anestésicas: punção venosa central, bloqueio do plexo braquial ou paravertebral, barotrauma, laparoscopia e cirurgia perto do diafragma.",
  ],
  depois: [
    "Radiografia ou ultrassom para conferir a expansão e o dreno.",
    "A agulha pode deslocar ou deixar de funcionar: trocar por dreno.",
    "Registrar a causa provável e o procedimento.",
  ],
  divergencias: [
    {
      tema: "Local da descompressão",
      posicoes: [
        { texto: "Dreno no 4º a 6º espaço, linha axilar anterior ou média; sem dreno, agulha no 2º espaço hemiclavicular ou no 5º axilar médio, ou toracostomia digital.", referencia: "wses-aast-2025-torax" },
      ],
      escolha: "O cartão segue a WSES-AAST 2025. A versão anterior citava o 4º ou 5º espaço pelo Tratado SAESP, sem página localizada; o ATLS 11 não pôde ser conferido.",
    },
  ],
  referencias: ["wses-aast-2025-torax", "qrh-2-3", "manual-33"],
  relacionados: [
    { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" },
    { protocolo: "intubacao-esofagica-seletiva", texto: "Intubação esofágica ou seletiva" },
    { protocolo: "dessaturacao", texto: "Dessaturação súbita" },
  ],
};

export const INTUBACAO_ESOFAGICA: Protocolo = {
  id: "intubacao-esofagica-seletiva",
  titulo: "Intubação esofágica ou seletiva",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["tubo no esôfago", "intubação seletiva", "intubação brônquica", "tubo deslocado", "sem capnografia", "no trace wrong place"],
  sinais: ["sem curva de capnografia", "EtCO2 ausente", "dessaturação", "pressão de pico alta", "murmúrio assimétrico", "distensão gástrica",
    "tubo profundo", "mudança de posição"],
  resumo: "Sem CO2 expirado sustentado, o tubo está no lugar errado: tirar, oxigenar por máscara ou supraglótico e reintubar. Seletiva: com CO2 e SpO2 baixa ou pressão alta, recuar o tubo aos poucos e confirmar.",
  reconhecer: [
    "CO2 sustentado exige as quatro: onda que sobe na expiração e cai na inspiração; amplitude constante ou crescente em pelo menos 7 ventilações; pico acima de 7,5 mmHg; leitura compatível com o quadro.",
    "Esofágica: traçado plano, decrescente ou baixo, dessaturação, distensão gástrica. PCR e broncoespasmo não explicam traçado plano.",
    "Seletiva: CO2 presente, mas SpO2 baixa, pressão de pico alta, expansão e murmúrio assimétricos, tubo além da marca habitual.",
    "Ausculta e SpO2 normal não confirmam a posição do tubo.",
  ],
  agirAgora: [
    { texto: "Operador e auxiliar dizem em voz alta se há CO2 sustentado e SpO2 adequada.", caminho: "A. Esofágica: sem CO2 sustentado" },
    { texto: "Sem causa corrigível em segundos (desconexão, zero do capnógrafo, vazamento): retirar o tubo.", detalhe: "Padrão mesmo com intubação que pareceu fácil.", caminho: "A. Esofágica: sem CO2 sustentado" },
    { texto: "O2 a 100% por máscara ou supraglótico; confirmar CO2 sustentado por eles.", caminho: "A. Esofágica: sem CO2 sustentado" },
    { texto: "Reoxigenar e otimizar (videolaringoscópio, posição, operador) antes de reintubar; confirmar de novo pela capnografia.", caminho: "A. Esofágica: sem CO2 sustentado" },
    { texto: "Não ventila por máscara nem supraglótico: resgate de via aérea, até o acesso frontal.", caminho: "A. Esofágica: sem CO2 sustentado" },
    { texto: "Conferir a marca do tubo no dente e a fixação; posição da cabeça.", caminho: "B. Seletiva: CO2 presente, oxigenação ou pressão ruins" },
    { texto: "Expansão, ausculta das axilas e pressões; isolar o aparelho com autoinflável.", caminho: "B. Seletiva: CO2 presente, oxigenação ou pressão ruins" },
    { texto: "Desinsuflar o balonete e recuar o tubo em pequenos incrementos, reavaliando a cada um.", caminho: "B. Seletiva: CO2 presente, oxigenação ou pressão ruins" },
    { texto: "Confirmar por capnografia e expansão simétrica; broncoscopia se disponível ou se persistir.", caminho: "B. Seletiva: CO2 presente, oxigenação ou pressão ruins" },
    { texto: "Sem melhora: pneumotórax, obstrução do tubo, broncoespasmo e outras causas.", caminho: "B. Seletiva: CO2 presente, oxigenação ou pressão ruins" },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: ["Sem fármaco próprio: fármacos conforme o plano de via aérea."],
  pensarEm: [
    "Tubo que migra com a posição cirúrgica, a mobilização da cabeça, o pneumoperitônio ou as compressões, sobretudo na criança.",
    "Pneumotórax, obstrução do tubo (secreção, dobra), broncoespasmo e falha do equipamento.",
  ],
  depois: [
    "Capnografia contínua até a extubação; reconfirmar após mudança de posição, de pressão ou de SpO2.",
    "Depois de intubação esofágica: avaliar broncoaspiração e distensão gástrica.",
    "Documentar e discutir com a equipe.",
  ],
  divergencias: [],
  referencias: ["chrimes-2022", "qrh-2-2", "manual-32", "manual-26"],
  relacionados: [
    { protocolo: "dessaturacao", texto: "Dessaturação súbita" },
    { protocolo: "pneumotorax-hipertensivo", texto: "Pneumotórax hipertensivo" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
    { protocolo: "nao-ventilo-nao-intubo", texto: "Não ventilo, não intubo" },
  ],
};
