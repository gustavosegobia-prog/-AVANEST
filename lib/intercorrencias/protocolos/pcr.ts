/**
 * PARADA CARDÍACA NO ADULTO — ritmo chocável (FV/TV sem pulso) e não chocável
 * (AESP/assistolia). Cartões 01 e 02 da minuta de validação de 15/10/2026.
 *
 * Base: Manual de Crises (abas 01 e 02). A sequência operacional e as doses
 * seguem a AHA 2025, sem alternar famílias de diretriz durante o algoritmo.
 * O texto é do AVANEST. A criança tem protocolo próprio (sav-pediatrico.ts).
 */

import type { DoseDoProtocolo, Protocolo, RitmoDoProtocolo, VejaTambem } from "../tipos.ts";
import {
  ADRENALINA_100, ADRENALINA_PURA_PCR, AMIODARONA_50, BICARBONATO_84, CLORETO_DE_CALCIO_10, LIDOCAINA_20, MAGNESIO_10, MAGNESIO_50,
} from "./comum.ts";

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
  "Depois do retorno da circulação: tratar a causa, evitar hipotensão e ajustar O2 e ventilação; evitar febre, hiperglicemia, hipercapnia e hiperoxemia.",
  "Se não obedece a comandos: controle protocolizado de temperatura, entre 32 e 37,5 °C. Não resfriar automaticamente o paciente desperto.",
  "UTI, ECG e exames; registro e comunicação.",
];

export const PCR_FV_TV: Protocolo = {
  id: "pcr-fv-tv",
  titulo: "PCR — FV/TV sem pulso",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante"],
  versao: 3,
  atualizadoEm: "2026-11-01",
  sinonimos: ["parada cardíaca", "PCR", "fibrilação ventricular", "taquicardia ventricular sem pulso", "ritmo chocável", "desfibrilação"],
  sinais: ["sem pulso", "FV", "TV", "EtCO2 caindo", "perdeu a curva da PA", "parada", "choque"],
  resumo: "Ritmo chocável: RCP o tempo todo, com pausas abaixo de 5 segundos; um choque a cada ciclo de 2 minutos; adrenalina 1 mg depois do 2º choque e a cada 2 ciclos; amiodarona 300 mg depois do 3º e 150 mg depois do 5º ciclo.",
  reconhecer: [
    "Ausência de pulso com FV ou TV; queda abrupta do EtCO2 e desaparecimento da onda arterial reforçam o diagnóstico.",
    "Excluir artefato rapidamente; não retardar compressões e choque para completar exames.",
  ],
  // A SEQUÊNCIA DO MANUAL DE CRISES, ABA 01 (revisão de 01/11/2026): os onze
  // passos na ordem e na numeração do cartão do livro, para quem tem o manual
  // na sala achar no app o mesmo passo com o mesmo número. As palavras são do
  // AVANEST; o detalhe de cada passo traz o que o livro não escreve no cartão
  // (profundidade, relação, energia, alternativa à amiodarona). O passo da
  // gestante vem depois do 11, e só para ela: o número dos outros não muda.
  agirAgora: [
    { texto: "Confirmar a parada pelo pulso e pelos monitores." },
    { texto: "Iniciar a RCP, 100 a 120 compressões por minuto, e passar para O2 a 100%.",
      detalhe: "5 a 6 cm, com retorno completo do tórax, sem se apoiar no peito. Sem via aérea avançada: 30:2. Com via aérea avançada: 10 ventilações por minuto e compressões contínuas. Metas: EtCO2 acima de 20 mmHg, diastólica acima de 20 mmHg e pausas abaixo de 5 a 10 segundos." },
    { texto: "Pedir ajuda, comunicar e delegar.",
      detalhe: "Uma pessoa para cada tarefa: compressões, desfibrilador e material, registro e via aérea. O líder fica livre para coordenar." },
    { texto: "Suspender o anestésico e proteger a via aérea enquanto as pás do desfibrilador são colocadas.",
      detalhe: "Conferir a posição do dispositivo pela capnografia, corrigir a hipóxia e ventilar 10 vezes por minuto. Intubar, se preciso, só depois de começar as compressões: o mais experiente, de preferência na pausa da checagem de ritmo." },
    { texto: "Dar um choque e retomar a RCP na hora, sem pausa para checar o ritmo.",
      detalhe: "Bifásico: 120 a 200 J no primeiro (conforme o fabricante; se desconhecida, a máxima disponível) e a mesma carga ou maior nos seguintes. Monofásico: 360 J em todos. No desfibrilador manual, comprimir enquanto carrega. Até 3 choques seguidos só na FV/TV testemunhada." },
    { texto: "Rever os 4 Hs e os 4 Ts; considerar ecocardiograma transtorácico na próxima checagem de ritmo.",
      detalhe: "Transtorácico (subxifoide) ou transesofágico, sem prolongar a pausa." },
    { texto: "Com 2 minutos: choque, retomar a RCP e adrenalina 1 mg IV.",
      detalhe: "Veia periférica ou central; sem ela, intraóssea umeral ou tibial." },
    { texto: "Com 4 minutos: choque, retomar a RCP e amiodarona 300 mg IV.",
      detalhe: "Sem amiodarona: lidocaína (doses ao lado)." },
    { texto: "Daí em diante: um choque a cada ciclo de RCP e adrenalina a cada 2 ciclos.",
      detalhe: "Pulso, ritmo e troca de quem comprime no fim de cada ciclo de 2 minutos; contar em voz alta ajuda a coordenar. EtCO2 abaixo de 10 mmHg: corrigir a técnica e trocar quem comprime a cada ciclo. Subida súbita do EtCO2: terminar o ciclo e checar o ritmo na troca." },
    { texto: "Depois do 5º ciclo: mais 150 mg de amiodarona.",
      detalhe: "Se estiver usando lidocaína: 0,5 a 0,75 mg/kg." },
    { texto: "Acionar a hemodinâmica ou a equipe de ECMO, conforme o caso." },
    { texto: "Gestante: deslocar o útero quando indicado e preparar o parto ressuscitativo.",
      detalhe: "Ver o protocolo de colapso materno.", so: ["gestante"] },
  ],
  medicamentos: [
    // A cada 2 ciclos, como no passo 9. A da AESP segue com "a cada 3 a 5 minutos".
    { ...ADRENALINA_PCR, repeticao: "A cada 2 ciclos de RCP (cerca de 4 minutos)." },
    {
      id: "amiodarona-pcr-300", farmaco: "Amiodarona", indicacao: "Com 4 minutos, depois do 3º choque", populacao: "adulto", via: "IV ou IO",
      dose: { usual: 300, unidade: "mg", por: "fixa" }, apresentacoes: [AMIODARONA_50],
      cuidados: ["Bolus somente na PCR."],
      referencias: ["manual-01", "aha-2025-acls-pcr"],
    },
    {
      id: "amiodarona-pcr-150", farmaco: "Amiodarona", indicacao: "Depois do 5º ciclo", populacao: "adulto", via: "IV ou IO",
      dose: { usual: 150, unidade: "mg", por: "fixa" }, apresentacoes: [AMIODARONA_50],
      cuidados: ["Bolus somente na PCR."],
      referencias: ["manual-01", "aha-2025-acls-pcr"],
    },
    {
      id: "lidocaina-pcr", farmaco: "Lidocaína", indicacao: "Sem amiodarona disponível", populacao: "adulto", via: "IV ou IO",
      dose: { min: 1, max: 1.5, unidade: "mg", por: "kg" }, apresentacoes: [LIDOCAINA_20],
      referencias: ["manual-01", "aha-2025-acls-pcr"],
    },
    {
      id: "lidocaina-pcr-2", farmaco: "Lidocaína", indicacao: "Segunda dose da alternativa", populacao: "adulto", via: "IV ou IO",
      dose: { min: 0.5, max: 0.75, unidade: "mg", por: "kg" }, apresentacoes: [LIDOCAINA_20],
      referencias: ["aha-2025-acls-pcr"],
    },
    // Os três do verso do cartão 01 do Manual: só com a indicação de cada um.
    {
      id: "magnesio-pcr", farmaco: "Sulfato de magnésio", indicacao: "Torsades de pointes ou hipomagnesemia", populacao: "adulto", via: "IV ou IO",
      dose: { min: 1, max: 2, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_10, MAGNESIO_50], altoRisco: true,
      velocidade: "Em 3 minutos.",
      cuidados: ["O choque não espera o magnésio.", "A 50%, diluir antes."],
      referencias: ["manual-01"],
    },
    {
      id: "cloreto-de-calcio-pcr", farmaco: "Cloreto de cálcio 10%", indicacao: "Hipercalemia, hipocalcemia ou intoxicação por bloqueador de canal de cálcio",
      populacao: "adulto", via: "IV ou IO",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [CLORETO_DE_CALCIO_10],
      repeticao: "Repetir se indicado.",
      cuidados: ["Nunca misturar cálcio e bicarbonato na mesma solução ou na mesma linha sem lavar."],
      referencias: ["manual-01"],
    },
    {
      id: "bicarbonato-pcr", farmaco: "Bicarbonato de sódio 8,4%", indicacao: "Hipercalemia ou intoxicação por antidepressivo tricíclico", populacao: "adulto",
      via: "IV ou IO",
      dose: { min: 1, max: 2, unidade: "mEq", por: "kg" }, apresentacoes: [BICARBONATO_84],
      cuidados: ["Nunca misturar com cálcio na mesma solução.", "Não é rotina da RCP prolongada sem indicação (divergência ao lado)."],
      referencias: ["manual-01"],
    },
  ],
  volumes: [
    { id: "choque-bifasico", rotulo: "Choque — desfibrilador bifásico", indicacao: "Conforme o fabricante; se desconhecida, a energia máxima disponível",
      populacao: "adulto", unidade: "J", fixo: { min: 120, max: 200 }, referencias: ["manual-01", "aha-2025-acls-pcr"] },
    { id: "choque-monofasico", rotulo: "Choque — desfibrilador monofásico", indicacao: "Todos os choques",
      populacao: "adulto", unidade: "J", fixo: { min: 360 }, referencias: ["manual-01", "aha-2025-acls-pcr"] },
  ],
  notasDeDose: [
    "Magnésio, cálcio e bicarbonato não são rotina: só nas indicações escritas em cada um.",
  ],
  pensarEm: [
    "4 Hs: hipóxia, hipovolemia, hipotermia, hipo ou hipercalemia. 4 Ts: tensão (pneumotórax), tamponamento, trombose (coronária ou pulmonar), toxinas. Também acidose.",
    "Na anestesia: anafilaxia, toxicidade por anestésico local, bloqueio alto, reflexo vagal, erro de fármaco e hemorragia oculta.",
  ],
  depois: DEPOIS_DA_PCR,
  divergencias: [
    {
      tema: "Temperatura depois do retorno da circulação",
      posicoes: [
        { texto: "Hipotermia terapêutica de 32 a 36 °C; evitar febre, hiperglicemia, hipercapnia e hiperoxemia.", referencia: "manual-01" },
        { texto: "Controle de temperatura entre 32 e 37,5 °C em quem não obedece a comandos, evitando febre.", referencia: "aha-2025-pos-pcr" },
      ],
      escolha: "O cartão segue a AHA 2025 (32 a 37,5 °C), mais recente que a edição do Manual, e mantém o resto do cuidado do Manual. Decisão do responsável médico.",
    },
    {
      tema: "Bicarbonato na RCP prolongada",
      posicoes: [
        { texto: "1 a 2 mL/kg de bicarbonato 8,4% na hipercalemia, na intoxicação por antidepressivo e na ressuscitação prolongada.", referencia: "manual-01" },
        { texto: "Bicarbonato não é rotina na PCR; só por indicação específica.", referencia: "aha-2025-acls-pcr" },
      ],
      escolha: "O cartão traz a dose do Manual só para hipercalemia e intoxicação por tricíclico, e não pelo tempo de RCP. Decisão do responsável médico.",
    },
    {
      tema: "Lidocaína",
      posicoes: [
        { texto: "1 mg/kg, se a amiodarona não estiver disponível.", referencia: "manual-01" },
        { texto: "1 a 1,5 mg/kg como alternativa à amiodarona; depois, 0,5 a 0,75 mg/kg.", referencia: "aha-2025-acls-pcr" },
      ],
      escolha: "O cartão usa a indicação do Manual (sem amiodarona) e a faixa da AHA, que inclui o 1 mg/kg do Manual.",
    },
  ],
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
