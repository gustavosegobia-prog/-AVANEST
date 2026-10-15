/**
 * PARADA CARDÍACA NO ADULTO — ritmo chocável (FV/TV sem pulso) e não chocável
 * (AESP/assistolia).
 *
 * Doses do Manual de Crises (protocolos 01 e 02, lidos no livro) e do QRH 2-1
 * da Association of Anaesthetists (aberto e lido). O texto das condutas é do
 * AVANEST. A criança tem protocolo próprio (sav-pediatrico.ts).
 */

import type { DoseDoProtocolo, Protocolo, RitmoDoProtocolo, VejaTambem } from "../tipos.ts";
import {
  ADRENALINA_100, ADRENALINA_PURA_PCR, AMIODARONA_50, ATROPINA_025, ATROPINA_05, BICARBONATO_84, CAUSAS_DA_SALA,
  CLORETO_DE_CALCIO_10, LIDOCAINA_20, MAGNESIO_10, MAGNESIO_50, QUATRO_H_QUATRO_T,
} from "./comum.ts";

const VEJA_CRIANCA: VejaTambem[] = [{
  protocolo: "sav-pediatrico", quando: ["pediatrico", "neonatal"],
  texto: "Criança: doses por kg e choque de 4 J/kg no Suporte avançado de vida pediátrico.",
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
  id: "adrenalina-pcr", farmaco: "Adrenalina", indicacao: "PCR", populacao: "adulto", via: "IV ou IO",
  dose: { usual: 1, unidade: "mg", por: "fixa" },
  apresentacoes: [ADRENALINA_PURA_PCR, ADRENALINA_100], altoRisco: true,
  repeticao: "A cada 2 ciclos de RCP (cerca de 4 minutos).",
  referencias: ["manual-01", "qrh-2-1"],
};

const CALCIO: DoseDoProtocolo = {
  id: "cloreto-de-calcio-pcr", farmaco: "Cloreto de cálcio",
  indicacao: "Hipercalemia, hipocalcemia, intoxicação por bloqueador de canal de cálcio ou por magnésio",
  populacao: "adulto", via: "IV",
  dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [CLORETO_DE_CALCIO_10],
  repeticao: "10 mL da solução a 10%; repetir se indicado.",
  cuidados: ["Em veia calibrosa: extravasamento causa necrose."],
  referencias: ["manual-01", "qrh-2-1"],
};

const BICARBONATO: DoseDoProtocolo = {
  id: "bicarbonato-pcr", farmaco: "Bicarbonato de sódio",
  indicacao: "Hipercalemia, intoxicação por antidepressivo tricíclico, RCP prolongada",
  populacao: "adulto", via: "IV",
  dose: { min: 1, max: 2, unidade: "mEq", por: "kg" }, apresentacoes: [BICARBONATO_84],
  cuidados: ["Não misturar na mesma via com cálcio ou adrenalina."],
  referencias: ["manual-01"],
};

const MAGNESIO: DoseDoProtocolo = {
  id: "magnesio-pcr", farmaco: "Sulfato de magnésio", indicacao: "Torsades de pointes ou hipomagnesemia",
  populacao: "adulto", via: "IV",
  dose: { min: 1, max: 2, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_50, MAGNESIO_10],
  velocidade: "Em 3 minutos.",
  referencias: ["manual-01", "qrh-2-1"],
};

const POS_RCE = "Depois do retorno da circulação: retomar a anestesia, controlar a temperatura entre 32 e 36 °C e evitar febre, hiperglicemia, hipercapnia e hiperóxia.";

export const PCR_FV_TV: Protocolo = {
  id: "pcr-fv-tv",
  titulo: "PCR — FV/TV sem pulso",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["parada cardíaca", "PCR", "fibrilação ventricular", "taquicardia ventricular sem pulso", "ritmo chocável", "desfibrilação"],
  sinais: ["sem pulso", "FV", "TV", "EtCO2 caindo", "perdeu a curva da PA", "parada", "choque"],
  resumo: "Ritmo chocável: choque o quanto antes, RCP sem pausas, adrenalina a cada 2 ciclos e amiodarona depois do 3º choque.",
  reconhecer: [
    "Sem pulso central, com FV ou TV no monitor — confirme no paciente, não só no traçado.",
    "Queda súbita do EtCO2 e perda da curva de pressão arterial e da pletismografia.",
    "Descarte artefato: eletrodo solto, movimento, interferência do bisturi elétrico.",
  ],
  agirAgora: [
    { texto: "Confirmar: sem pulso e ritmo chocável. Anunciar “parada” e anotar a hora." },
    { texto: "Compressões já, 100 a 120 por minuto, e O2 a 100%.", detalhe: "Pausas sempre menores que 5 segundos." },
    { texto: "Pedir ajuda e o desfibrilador; dividir as funções.",
      detalhe: "Quem comprime, quem cuida da via aérea, quem dá os fármacos, quem anota, quem lê o protocolo." },
    { texto: "Desligar o agente anestésico e garantir a via aérea; colar as pás sem parar as compressões.",
      detalhe: "Ventilar 10 vezes por minuto. Sem curva de capnografia, pense em intubação esofágica." },
    { texto: "Chocar e voltar às compressões na hora, sem checar pulso nem ritmo.",
      detalhe: "Bifásico: 120 a 200 J no primeiro choque, igual ou mais nos seguintes. Monofásico: 360 J. Carregar com a RCP correndo." },
    { texto: "A cada 2 minutos: checar o ritmo em menos de 5 segundos, chocar se ainda FV/TV e trocar quem comprime." },
    { texto: "Adrenalina 1 mg depois do choque dos 2 minutos; depois, a cada 2 ciclos." },
    { texto: "Amiodarona 300 mg depois do choque dos 4 minutos (3º choque); mais 150 mg depois do 5º ciclo." },
    { texto: "Procurar a causa (4 H e 4 T) e fazer o ecocardiograma na checagem do ritmo." },
    { texto: "Gestante: deslocar o útero para a esquerda com a mão e intubar cedo; sem retorno da circulação, cesárea perimortem a partir do 4º minuto.",
      detalhe: "Ver o protocolo de colapso materno.", so: ["gestante"] },
    { texto: "Considerar cateterismo ou ECMO, conforme o caso.", detalhe: POS_RCE },
  ],
  medicamentos: [
    ADRENALINA_PCR,
    {
      id: "amiodarona-pcr-300", farmaco: "Amiodarona", indicacao: "Depois do 3º choque (o dos 4 minutos)",
      populacao: "adulto", via: "IV ou IO",
      dose: { usual: 300, unidade: "mg", por: "fixa" }, apresentacoes: [AMIODARONA_50],
      repeticao: "Em bolus, na PCR.",
      referencias: ["manual-01", "qrh-2-1"],
    },
    {
      id: "amiodarona-pcr-150", farmaco: "Amiodarona", indicacao: "Segunda dose, depois do 5º ciclo",
      populacao: "adulto", via: "IV ou IO",
      dose: { usual: 150, unidade: "mg", por: "fixa" }, apresentacoes: [AMIODARONA_50],
      referencias: ["manual-01"],
    },
    {
      id: "lidocaina-pcr", farmaco: "Lidocaína", indicacao: "Se não houver amiodarona",
      populacao: "adulto", via: "IV ou IO",
      dose: { usual: 1, unidade: "mg", por: "kg" }, apresentacoes: [LIDOCAINA_20],
      referencias: ["manual-01"],
    },
    MAGNESIO, CALCIO, BICARBONATO,
  ],
  volumes: [
    { id: "choque-bifasico", rotulo: "Choque — desfibrilador bifásico", indicacao: "Primeiro choque; depois, igual ou maior",
      populacao: "adulto", unidade: "J", fixo: { min: 120, max: 200 }, referencias: ["manual-01"] },
    { id: "choque-monofasico", rotulo: "Choque — desfibrilador monofásico", indicacao: "Todos os choques",
      populacao: "adulto", unidade: "J", fixo: { min: 360 }, referencias: ["manual-01"] },
  ],
  pensarEm: [...QUATRO_H_QUATRO_T, ...CAUSAS_DA_SALA, "Artefato que imita FV: eletrodo solto, tremor, bisturi elétrico."],
  depois: [
    POS_RCE,
    "ECG de 12 derivações, ecocardiograma, gasometria e eletrólitos; tratar a causa encontrada.",
    "Transferir para a UTI; acionar o cateterismo se houver suspeita de causa coronária.",
    "Registrar na ficha os horários de cada choque, de cada dose e do retorno da circulação.",
    "Conversar com a família e fazer a revisão do caso com a equipe.",
  ],
  divergencias: [
    {
      tema: "Carga do choque bifásico no adulto",
      posicoes: [
        { texto: "120 a 200 J no primeiro choque; igual ou mais nos seguintes.", referencia: "manual-01" },
        { texto: "150 a 200 J.", referencia: "qrh-2-1" },
      ],
      escolha: "O protocolo mostra a faixa do Manual; a recomendação do fabricante do desfibrilador vale acima das duas.",
    },
    {
      tema: "Sulfato de magnésio",
      posicoes: [
        { texto: "1 a 2 g em 3 minutos, para torsades de pointes ou hipomagnesemia.", referencia: "manual-01" },
        { texto: "2 g, para TV polimórfica ou hipomagnesemia.", referencia: "qrh-2-1" },
      ],
      escolha: "Faixa de 1 a 2 g; os 2 g do QRH estão nela.",
    },
  ],
  referencias: ["manual-01", "qrh-2-1", "aha-2020-adulto", "anzaag-diretriz-2022"],
  veja: VEJA_CRIANCA,
  ritmos: [RITMO_FV, RITMO_TV],
  relacionados: [{ protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" }],
};

export const PCR_AESP: Protocolo = {
  id: "pcr-aesp-assistolia",
  titulo: "PCR — AESP/assistolia",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["parada cardíaca", "PCR", "atividade elétrica sem pulso", "AESP", "assistolia", "ritmo não chocável"],
  sinais: ["sem pulso", "linha reta", "ritmo no monitor sem pulso", "EtCO2 caindo", "perdeu a curva da PA", "parada"],
  resumo: "Ritmo não chocável: RCP sem pausas, adrenalina logo e a cada 2 ciclos, e procurar a causa — na sala, quase sempre há uma.",
  reconhecer: [
    "Sem pulso central, com ritmo organizado no monitor (AESP) ou linha quase reta (assistolia).",
    "Olhe todos os monitores — ECG, curva da pressão arterial, SpO2 e EtCO2 — para separar artefato ou transdutor de parada de verdade.",
    "Na assistolia, confira os eletrodos, o ganho e outra derivação: FV fina pode parecer linha reta.",
  ],
  agirAgora: [
    { texto: "Confirmar: sem pulso, ritmo não chocável, em todos os monitores." },
    { texto: "Interromper qualquer estímulo vagal e passar para O2 a 100%.",
      detalhe: "Desinsuflar o pneumoperitônio, soltar a tração, parar a manipulação." },
    { texto: "Pedir ajuda e dividir as funções." },
    { texto: "Compressões já, 100 a 120 por minuto, e adrenalina 1 mg IV.", detalhe: "Pausas sempre menores que 5 segundos." },
    { texto: "Desligar o agente anestésico e considerar intubar na próxima checagem do ritmo.", detalhe: "Ventilar 10 vezes por minuto." },
    { texto: "Procurar a causa (4 H e 4 T) e fazer o ecocardiograma subxifoide na pausa de menos de 5 segundos." },
    { texto: "Adrenalina 1 mg a cada 2 ciclos." },
    { texto: "Se o ritmo virar FV/TV: chocar e seguir o protocolo de FV/TV." },
    { texto: "Na assistolia, marca-passo só para bloqueio AV de alto grau." },
    { texto: "Gestante: deslocar o útero para a esquerda com a mão e intubar cedo; sem retorno da circulação, cesárea perimortem a partir do 4º minuto.",
      detalhe: "Ver o protocolo de colapso materno.", so: ["gestante"] },
    { texto: "Considerar cateterismo ou ECMO, conforme o caso.", detalhe: POS_RCE },
  ],
  medicamentos: [
    { ...ADRENALINA_PCR, id: "adrenalina-pcr-aesp", indicacao: "Logo, e a cada 2 ciclos", referencias: ["manual-02", "qrh-2-1"] },
    {
      id: "atropina-pcr-vagal", farmaco: "Atropina", indicacao: "Se o tônus vagal é a causa provável",
      populacao: "adulto", via: "IV",
      dose: { min: 0.5, max: 1, unidade: "mg", por: "fixa" }, apresentacoes: [ATROPINA_05, ATROPINA_025],
      referencias: ["qrh-2-1"],
    },
    { ...CALCIO, id: "cloreto-de-calcio-aesp" },
    { ...BICARBONATO, id: "bicarbonato-aesp" },
    { ...MAGNESIO, id: "magnesio-aesp" },
  ],
  volumes: [
    { id: "cristaloide-pcr", indicacao: "Bolus, se hipovolemia", populacao: "adulto", fixo: { min: 500 },
      repeticao: "Sem hipovolemia, evite volume em excesso: o alvo é a normovolemia.", referencias: ["qrh-2-1", "manual-02"] },
  ],
  pensarEm: [
    "Na sala: hipovolemia, anafilaxia e raqui alta; sangramento não reconhecido, principalmente na laparoscopia.",
    ...QUATRO_H_QUATRO_T,
    "Tamponamento, pneumotórax hipertensivo e embolia: o ultrassom ajuda a ver.",
    ...CAUSAS_DA_SALA,
  ],
  depois: [
    POS_RCE,
    "Corrigir eletrólitos (cálcio, potássio, magnésio) pelas doses deste protocolo.",
    "Transferir para a UTI; tratar a causa encontrada.",
    "Registrar na ficha os horários de cada dose, das checagens de ritmo e do retorno da circulação.",
    "Conversar com a família e fazer a revisão do caso com a equipe.",
  ],
  divergencias: [],
  referencias: ["manual-02", "manual-01", "qrh-2-1", "aha-2020-adulto"],
  veja: VEJA_CRIANCA,
  ritmos: [RITMO_AESP, RITMO_ASSISTOLIA],
  relacionados: [{ protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" }],
};

/** Usadas pelo SAV pediátrico, que mostra os quatro ritmos. */
export const RITMOS_DE_PCR = [RITMO_FV, RITMO_TV, RITMO_AESP, RITMO_ASSISTOLIA];
