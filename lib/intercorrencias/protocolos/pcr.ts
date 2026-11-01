/**
 * PARADA CARDÍACA NO ADULTO — ritmo chocável (FV/TV sem pulso) e não chocável
 * (AESP/assistolia). Cartões 01 e 02 da minuta de validação de 15/10/2026.
 *
 * Base: Manual de Crises (abas 01 e 02). A sequência operacional e as doses
 * seguem a AHA 2025, sem alternar famílias de diretriz durante o algoritmo.
 * O texto é do AVANEST. A criança tem protocolo próprio (sav-pediatrico.ts).
 */

import type { DoseDoProtocolo, Protocolo, RitmoDoProtocolo, VejaTambem } from "../tipos.ts";
import { ADRENALINA_100, ADRENALINA_PURA_PCR, AMIODARONA_50, LIDOCAINA_20 } from "./comum.ts";

const VEJA_CRIANCA: VejaTambem[] = [{
  protocolo: "sav-pediatrico", quando: ["pediatrico", "neonatal"],
  texto: "Criança: doses por kg e choque de 2 J/kg, depois 4 J/kg, no Suporte avançado de vida pediátrico.",
}];

export const RITMO_FV: RitmoDoProtocolo = {
  ritmo: "fv", nome: "Fibrilação ventricular", chocavel: true,
  legenda: "Ondas caóticas, sem QRS reconhecível. Antes de chocar, confirme que não é eletrodo solto ou artefato de movimento.",
};
export const RITMO_TV: RitmoDoProtocolo = {
  ritmo: "tv", nome: "Taquicardia ventricular sem pulso", chocavel: true,
  legenda: "QRS largos, rápidos e iguais. Só é parada se não houver pulso: com pulso, é outro protocolo.",
};
export const RITMO_AESP: RitmoDoProtocolo = {
  ritmo: "aesp", nome: "Atividade elétrica sem pulso", chocavel: false,
  legenda: "O monitor mostra um ritmo organizado, mas não há pulso nem curva de pressão arterial nem de pletismografia.",
};
export const RITMO_ASSISTOLIA: RitmoDoProtocolo = {
  ritmo: "assistolia", nome: "Assistolia", chocavel: false,
  legenda: "Linha quase reta. Confira os eletrodos, aumente o ganho e veja outra derivação: FV fina pode parecer assistolia.",
};

const ADRENALINA_PCR: DoseDoProtocolo = {
  id: "adrenalina-pcr", farmaco: "Adrenalina", indicacao: "Depois do segundo choque", populacao: "adulto", via: "IV ou IO",
  dose: { usual: 1, unidade: "mg", por: "fixa" },
  apresentacoes: [ADRENALINA_100, ADRENALINA_PURA_PCR], altoRisco: true,
  repeticao: "A cada 3 a 5 minutos.",
  referencias: ["manual-01", "aha-2025-acls-pcr"],
};

const DEPOIS_DA_PCR = [
  "Depois do retorno da circulação: tratar a causa, evitar hipotensão e ajustar O2 e ventilação.",
  "Se não obedece a comandos: controle protocolizado de temperatura, entre 32 e 37,5 °C. Não resfriar automaticamente o paciente desperto.",
  "UTI, ECG e exames; registro e comunicação.",
];

export const PCR_FV_TV: Protocolo = {
  id: "pcr-fv-tv",
  titulo: "PCR — FV/TV sem pulso",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["parada cardíaca", "PCR", "fibrilação ventricular", "taquicardia ventricular sem pulso", "ritmo chocável", "desfibrilação"],
  sinais: ["sem pulso", "FV", "TV", "EtCO2 caindo", "perdeu a curva da PA", "parada", "choque"],
  resumo: "Ritmo chocável: RCP de qualidade e choque; adrenalina depois do segundo choque e amiodarona ou lidocaína depois do terceiro.",
  reconhecer: [
    "Ausência de pulso com FV ou TV; queda abrupta do EtCO2 e desaparecimento da onda arterial reforçam o diagnóstico.",
    "Excluir artefato rapidamente; não retardar compressões e choque para completar exames.",
  ],
  agirAgora: [
    { texto: "Anunciar a PCR, chamar ajuda e o desfibrilador e iniciar a RCP.",
      detalhe: "O2 a 100%; suspender a administração de anestésicos depressores durante a PCR." },
    { texto: "Comprimir 100 a 120 por minuto, 5 a 6 cm, com retorno completo do tórax.",
      detalhe: "Sem via aérea avançada: 30:2. Com via aérea avançada: 10 ventilações por minuto e compressões contínuas." },
    { texto: "Desfibrilar e reiniciar a RCP imediatamente, por 2 minutos.",
      detalhe: "Bifásico: energia conforme o fabricante, em geral 120 a 200 J; se desconhecida, a máxima disponível. Monofásico: 360 J." },
    { texto: "Reavaliar o ritmo a cada 2 minutos, com pausa mínima. FV/TV persistente: novo choque.",
      detalhe: "Acesso IV; IO se o IV for inviável ou atrasar." },
    { texto: "Depois do segundo choque: adrenalina. Depois do terceiro: amiodarona ou lidocaína.",
      detalhe: "Repetir choques e RCP e tratar as causas reversíveis." },
    { texto: "Ultrassom somente sem prolongar as pausas." },
    { texto: "Gestante: deslocar o útero quando indicado e preparar o parto ressuscitativo.",
      detalhe: "Ver o protocolo de colapso materno.", so: ["gestante"] },
  ],
  medicamentos: [
    ADRENALINA_PCR,
    {
      id: "amiodarona-pcr-300", farmaco: "Amiodarona", indicacao: "Depois do terceiro choque", populacao: "adulto", via: "IV ou IO",
      dose: { usual: 300, unidade: "mg", por: "fixa" }, apresentacoes: [AMIODARONA_50],
      cuidados: ["Bolus somente na PCR."],
      referencias: ["manual-01", "aha-2025-acls-pcr"],
    },
    {
      id: "amiodarona-pcr-150", farmaco: "Amiodarona", indicacao: "Segunda dose", populacao: "adulto", via: "IV ou IO",
      dose: { usual: 150, unidade: "mg", por: "fixa" }, apresentacoes: [AMIODARONA_50],
      cuidados: ["Bolus somente na PCR."],
      referencias: ["manual-01", "aha-2025-acls-pcr"],
    },
    {
      id: "lidocaina-pcr", farmaco: "Lidocaína", indicacao: "Alternativa à amiodarona", populacao: "adulto", via: "IV ou IO",
      dose: { min: 1, max: 1.5, unidade: "mg", por: "kg" }, apresentacoes: [LIDOCAINA_20],
      referencias: ["aha-2025-acls-pcr"],
    },
    {
      id: "lidocaina-pcr-2", farmaco: "Lidocaína", indicacao: "Segunda dose da alternativa", populacao: "adulto", via: "IV ou IO",
      dose: { min: 0.5, max: 0.75, unidade: "mg", por: "kg" }, apresentacoes: [LIDOCAINA_20],
      referencias: ["aha-2025-acls-pcr"],
    },
  ],
  volumes: [
    { id: "choque-bifasico", rotulo: "Choque — desfibrilador bifásico", indicacao: "Conforme o fabricante; se desconhecida, a energia máxima disponível",
      populacao: "adulto", unidade: "J", fixo: { min: 120, max: 200 }, referencias: ["manual-01", "aha-2025-acls-pcr"] },
    { id: "choque-monofasico", rotulo: "Choque — desfibrilador monofásico", indicacao: "Todos os choques",
      populacao: "adulto", unidade: "J", fixo: { min: 360 }, referencias: ["manual-01", "aha-2025-acls-pcr"] },
  ],
  notasDeDose: [
    "Cálcio, bicarbonato e magnésio não são rotina. Usar quando houver indicação específica, como hipercalemia, intoxicação ou torsades; não usar bicarbonato apenas pelo tempo de RCP.",
  ],
  pensarEm: [
    "Hipóxia, hipovolemia, acidose, alterações do potássio, hipotermia; tensão, tamponamento, tóxicos e trombose coronária ou pulmonar.",
    "Na anestesia: anafilaxia, toxicidade por anestésico local, bloqueio alto, reflexo vagal, erro de fármaco e hemorragia oculta.",
  ],
  depois: DEPOIS_DA_PCR,
  divergencias: [],
  referencias: ["manual-01", "aha-2025-acls-pcr", "aha-2025-pos-pcr"],
  veja: VEJA_CRIANCA,
  ritmos: [RITMO_FV, RITMO_TV],
  relacionados: [{ protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" }],
};

export const PCR_AESP: Protocolo = {
  id: "pcr-aesp-assistolia",
  titulo: "PCR — AESP/assistolia",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["parada cardíaca", "PCR", "atividade elétrica sem pulso", "AESP", "assistolia", "ritmo não chocável"],
  sinais: ["sem pulso", "linha reta", "ritmo no monitor sem pulso", "EtCO2 caindo", "perdeu a curva da PA", "parada"],
  resumo: "Ritmo não chocável: RCP de qualidade, adrenalina assim que possível e a busca da causa em paralelo.",
  reconhecer: [
    "Ausência de pulso com ritmo organizado ou assistolia.",
    "Confirmar eletrodos, ganho e outra derivação quando houver dúvida, sem interromper a RCP desnecessariamente.",
  ],
  agirAgora: [
    { texto: "Anunciar a PCR, pedir ajuda e iniciar as compressões; O2 a 100% e ventilação adequada." },
    { texto: "Retirar o estímulo vagal; interromper a tração ou o pneumoperitônio, se relacionados." },
    { texto: "Adrenalina assim que possível.", detalhe: "Obter o acesso e identificar a causa em paralelo." },
    { texto: "RCP em ciclos de 2 minutos, com os parâmetros de compressão e ventilação do protocolo de FV/TV." },
    { texto: "Rever as causas reversíveis; ultrassom por operador habilitado, sem aumentar as interrupções." },
    { texto: "Se passar a FV/TV sem pulso: desfibrilar e seguir o protocolo de FV/TV. Se houver retorno da circulação: cuidados pós-PCR." },
  ],
  medicamentos: [
    { ...ADRENALINA_PCR, id: "adrenalina-pcr-aesp", indicacao: "Assim que possível", referencias: ["manual-02", "aha-2025-acls-pcr"] },
  ],
  volumes: [],
  notasDeDose: [
    "Não indicar atropina nem marca-passo como tratamento de rotina da assistolia ou da AESP. Bradicardia com pulso é outro ramo.",
    "Cálcio e bicarbonato somente por causa específica.",
    "Reposição volêmica se hipovolemia; não infundir grandes volumes indiscriminadamente.",
  ],
  pensarEm: [
    "Hemorragia, hipóxia, anafilaxia, raqui alta, toxicidade por anestésico local, tensão, tamponamento, embolia, distúrbio metabólico e erro de fármaco.",
  ],
  depois: [
    "Depois do retorno da circulação, tratar a causa e seguir os cuidados do protocolo de FV/TV.",
    "Registrar o tempo, o ritmo, as doses, a resposta e o destino.",
  ],
  divergencias: [],
  referencias: ["manual-02", "aha-2025-acls-pcr", "aha-2025-als"],
  veja: VEJA_CRIANCA,
  ritmos: [RITMO_AESP, RITMO_ASSISTOLIA],
  relacionados: [
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" },
  ],
};

/** Usadas pelo SAV pediátrico, que mostra os quatro ritmos. */
export const RITMOS_DE_PCR = [RITMO_FV, RITMO_TV, RITMO_AESP, RITMO_ASSISTOLIA];
