/**
 * PNEUMOTÓRAX HIPERTENSIVO E INTUBAÇÃO ESOFÁGICA OU SELETIVA — cartões 14 e 15
 * da minuta preliminar “Protocolos de crise” (outubro de 2026, para validação
 * médica).
 *
 * Base: Tratado SAESP. Atualizações: diretriz WSES-AAST 2025 de trauma
 * torácico (pneumotórax) e consenso PUMA de 2022 sobre intubação esofágica não
 * reconhecida. O texto é do AVANEST. Versão 1, sem aprovação registrada até a
 * validação.
 */

import type { Protocolo } from "../tipos.ts";

export const PNEUMOTORAX: Protocolo = {
  id: "pneumotorax-hipertensivo",
  titulo: "Pneumotórax hipertensivo",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["pneumotórax", "pneumotórax sob tensão", "descompressão torácica", "drenagem de tórax"],
  sinais: ["pressão de pico alta", "dessaturação", "hipotensão", "murmúrio abolido", "tórax assimétrico", "enfisema subcutâneo",
    "turgência jugular", "desvio de traqueia", "depois de acesso central", "depois de bloqueio"],
  resumo: "Ventilação difícil com hipotensão e tórax assimétrico: no paciente instável, descomprimir já, sem esperar imagem; depois, drenagem definitiva.",
  reconhecer: [
    "Pressão de via aérea subindo, dessaturação e hipotensão, com expansão ou murmúrio assimétricos.",
    "Enfisema subcutâneo, turgência jugular e desvio da traqueia podem faltar.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda; checar o sistema de ventilação e o tubo." },
    { texto: "O2 a 100% e suporte hemodinâmico." },
    { texto: "Suspeitar diante de achados assimétricos, sobretudo depois de punção central, bloqueio, trauma ou ventilação com pressão alta." },
    { texto: "Instável: descompressão imediata, por profissional habilitado.",
      detalhe: "Toracostomia no 4º ou 5º espaço intercostal, na linha axilar adequada; a agulha é medida temporária em cenários específicos." },
    { texto: "Não aguardar a imagem para descomprimir o paciente instável." },
    { texto: "Drenagem torácica definitiva." },
    { texto: "Reavaliar ventilação e hemodinâmica depois de cada passo." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: ["Sem fármaco próprio: o tratamento é a descompressão."],
  pensarEm: ["Intubação seletiva, tubo obstruído, broncoespasmo, tamponamento cardíaco e embolia gasosa."],
  depois: [
    "Confirmar a expansão pulmonar e o funcionamento do dreno.",
    "Investigar e registrar a causa.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "wses-aast-2025-torax"],
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
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["tubo no esôfago", "intubação seletiva", "intubação brônquica", "tubo deslocado", "sem capnografia"],
  sinais: ["sem curva de capnografia", "EtCO2 ausente", "dessaturação", "pressão de pico alta", "murmúrio assimétrico", "distensão gástrica",
    "tubo profundo", "mudança de posição"],
  resumo: "Sem capnografia sustentada, o tubo está no lugar errado: parar de ventilar por ele, oxigenar por máscara ou supraglótico e reintubar. Seletiva: recuar o tubo aos poucos e confirmar.",
  reconhecer: [
    "Esofágica: ausência de capnografia sustentada, dessaturação, distensão gástrica.",
    "Seletiva: dessaturação, pressão de pico alta, expansão e murmúrio assimétricos, tubo além da marca habitual.",
    "Ausculta isolada não confirma a posição do tubo.",
  ],
  agirAgora: [
    { texto: "Suspeita de esofágica: parar de ventilar pelo tubo e pedir ajuda." },
    { texto: "Garantir oxigenação e ventilação." },
    { texto: "Procurar capnografia sustentada (várias curvas)." },
    { texto: "Não confirmada: retirar o tubo e ventilar por máscara ou supraglótico." },
    { texto: "Reintubar e confirmar pela capnografia." },
    { texto: "Suspeita de seletiva: conferir profundidade e fixação do tubo.", detalhe: "Posição da cabeça, expansão e ausculta dos dois lados." },
    { texto: "Recuar o tubo em pequenos incrementos." },
    { texto: "Confirmar por capnografia, ausculta e, se disponível, broncoscopia." },
    { texto: "Sem melhora: procurar outras causas." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: ["Sem fármaco próprio: fármacos conforme o plano de via aérea."],
  pensarEm: [
    "A posição cirúrgica e a mobilização da cabeça podem deslocar o tubo; pneumotórax, broncoespasmo e obstrução do tubo.",
  ],
  depois: [
    "Capnografia contínua até a extubação.",
    "Avaliar broncoaspiração depois da intubação esofágica.",
    "Documentar e vigiar o paciente.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "chrimes-2022"],
  relacionados: [
    { protocolo: "dessaturacao", texto: "Dessaturação súbita" },
    { protocolo: "pneumotorax-hipertensivo", texto: "Pneumotórax hipertensivo" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};
