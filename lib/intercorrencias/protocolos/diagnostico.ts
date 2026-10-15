/**
 * VIAS DE DIAGNÓSTICO — o que fazer quando o monitor muda e a causa ainda não
 * está clara: dessaturação, hipertensão, hipotensão, taquicardia,
 * bradicardia, CO2 expirado alto ou baixo.
 *
 * Listas de causas e sequência do Manual de Crises (abas 26 a 32, lidas no
 * livro); doses da aba 34 (dosagem de medicamentos e infusões EV), conferidas
 * com os guias 2-2 a 2-7 do QRH da Association of Anaesthetists (abertos e
 * lidos). Onde diferem, as posições ficam em `divergencias`. O texto é do
 * AVANEST.
 */

import type { ApresentacaoDoProtocolo, Protocolo } from "../tipos.ts";
import {
  ADRENALINA_10, ADRENALINA_100, ADRENALINA_60, AMIODARONA_50, ATROPINA_025, ATROPINA_05, CLORETO_DE_CALCIO_10,
  EFEDRINA_5, FENILEFRINA_100, MAGNESIO_10, MAGNESIO_50, METARAMINOL_05, PROPOFOL_10,
} from "./comum.ts";

const POAC = "Conferir o monitor na ordem P-O-A-C: pressão e frequência, oxigenação, agente anestésico, CO2 e frequência respiratória.";

const METOPROLOL_1: ApresentacaoDoProtocolo = { rotulo: "Ampola de 5 mg em 5 mL — 1 mg/mL", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"] };
const ESMOLOL_10: ApresentacaoDoProtocolo = { rotulo: "10 mg/mL (100 mg em 10 mL)", quantidade: 10, unidade: "mg", mL: 1, vias: ["IV"] };
const HIDRALAZINA_1: ApresentacaoDoProtocolo = {
  rotulo: "20 mg em 20 mL — 1 mg/mL", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (20 mg) + 19 mL de SF 0,9%",
};
const NITROGLICERINA_200: ApresentacaoDoProtocolo = {
  rotulo: "50 mg em 250 mL — 200 mcg/mL", quantidade: 200, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "50 mg em 250 mL de SG 5% ou SF 0,9%, frasco de vidro e equipo próprio",
};
const NITROGLICERINA_1: ApresentacaoDoProtocolo = {
  rotulo: "50 mg em 50 mL — 1 mg/mL", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "50 mg em 50 mL de SF 0,9%, em seringa",
};
const NITROPRUSSIATO_200: ApresentacaoDoProtocolo = {
  rotulo: "50 mg em 250 mL de SG 5% — 200 mcg/mL", quantidade: 200, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "Proteger da luz",
};
const CLONIDINA_150: ApresentacaoDoProtocolo = { rotulo: "Ampola de 150 mcg em 1 mL", quantidade: 150, unidade: "mcg", mL: 1, vias: ["IV"] };
const ADENOSINA_3: ApresentacaoDoProtocolo = { rotulo: "Ampola de 6 mg em 2 mL — 3 mg/mL", quantidade: 3, unidade: "mg", mL: 1, vias: ["IV"] };
const AMIODARONA_INFUSAO: ApresentacaoDoProtocolo = {
  rotulo: "900 mg em 500 mL de SG 5% — 1,8 mg/mL", quantidade: 1.8, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "18 mL (900 mg) em 500 mL de SG 5%",
};
const DILTIAZEM_5: ApresentacaoDoProtocolo = {
  rotulo: "25 mg em 5 mL — 5 mg/mL", quantidade: 5, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "Frasco de 25 mg reconstituído em 5 mL",
};
const VERAPAMIL_25: ApresentacaoDoProtocolo = { rotulo: "Ampola de 5 mg em 2 mL — 2,5 mg/mL", quantidade: 2.5, unidade: "mg", mL: 1, vias: ["IV"] };
const NORADRENALINA_80: ApresentacaoDoProtocolo = {
  rotulo: "4 mg em 50 mL — 80 mcg/mL", quantidade: 80, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "4 mg de noradrenalina base em 50 mL de SF 0,9%",
};
const DOPAMINA_1000: ApresentacaoDoProtocolo = {
  rotulo: "250 mg em 250 mL — 1.000 mcg/mL", quantidade: 1000, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "5 ampolas de 50 mg em 200 mL de SF 0,9% (250 mL no total)",
};
const GLUCAGON_1: ApresentacaoDoProtocolo = { rotulo: "1 mg reconstituído em 1 mL — 1 mg/mL", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV", "IM"] };

/* ---------------- Dessaturação ---------------- */

export const DESSATURACAO: Protocolo = {
  id: "dessaturacao",
  titulo: "Dessaturação súbita",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["hipoxemia", "hipóxia", "SpO2 caindo", "cianose", "dessaturação"],
  sinais: ["SpO2 caindo", "saturação baixa", "cianose", "dessatura"],
  resumo: "O2 a 100% e conferir a leitura; a curva de CO2 separa os caminhos: sem curva ou alterada, via aérea e ventilação; curva normal, oferta de O2, seletiva e shunt.",
  reconhecer: [
    "As causas mais comuns: sensor deslocado, apneia ou hipoventilação, posição do tubo, laringoespasmo.",
    "Antes de tratar o número: a leitura é real? Cor, perfusão, temperatura, unhas e posição do sensor.",
    "Ventilar à mão e olhar as curvas de SpO2 e de EtCO2 testa o circuito e a complacência ao mesmo tempo.",
  ],
  agirAgora: [
    { texto: "O2 ligado, FiO2 em 100% e conferir as causas mais comuns.", detalhe: "Pausar a cirurgia, se possível." },
    { texto: "Confirmar a leitura: cor, perfusão, temperatura e sensor." },
    { texto: "Ventilar à mão olhando as curvas de SpO2 e de EtCO2." },
    { texto: "Curva de CO2 ausente ou alterada: afastar intubação esofágica, desconexão e baixo débito.",
      detalhe: "Conferir o dispositivo e se o paciente ventila (balão, modo e ajustes do ventilador). Laringoespasmo, broncoespasmo, tubo dobrado, rolha de secreção: aspirar e considerar broncoscopia." },
    { texto: "Curva de CO2 normal: seguir o O2 da parede ou do cilindro até o paciente e confirmar o fluxo de gás fresco." },
    { texto: "Afastar intubação seletiva." },
    { texto: "Examinar o tórax e as veias do pescoço; radiografia, se houver. Pensar em shunt pulmonar." },
    { texto: "Sem resolver: tirar o paciente do aparelho e ventilar com ressuscitador autoinflável direto no tubo.",
      detalhe: "Sem filtro e sem conector. Se melhorar, o problema era o aparelho ou o circuito." },
    { texto: "Cabeceira elevada, se a cirurgia permitir." },
    { texto: "Persistiu: pedir ajuda, gasometria, ECG e radiografia; rever os passos com quem chegar." },
  ],
  medicamentos: [],
  volumes: [],
  pensarEm: [
    "Menos O2 chegando ao pulmão: falha do O2, desconexão ou obstrução do circuito, fluxo baixo, ventilador mal ajustado, via aérea fora do lugar, intubação seletiva, rolha ou corpo estranho, laringoespasmo ou broncoespasmo, apneia ou hipoventilação.",
    "Menos sangue chegando ao pulmão: parada, insuficiência cardíaca, anafilaxia, embolia pulmonar, cardiopatia congênita com shunt direita-esquerda.",
    "Troca prejudicada: ventilação monopulmonar, edema, broncoaspiração, contusão, atelectasia, pneumotórax, pneumoperitônio, pneumonia, sepse ou SDRA, doença intersticial, DPOC.",
    "Artefato: hipotermia, má perfusão periférica, sensor deslocado.",
  ],
  depois: [
    "Registrar na ficha a causa encontrada, o menor valor e o tempo de dessaturação.",
    "Radiografia de tórax e o nível de cuidado pós-operatório conforme a causa.",
  ],
  divergencias: [],
  referencias: ["manual-26", "qrh-2-2"],
  relacionados: [
    { protocolo: "laringoespasmo", texto: "Laringoespasmo" },
    { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" },
    { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
    { protocolo: "diminuicao-etco2", texto: "Queda do CO2 expirado" },
  ],
};

/* ---------------- Hipertensão ---------------- */

export const HIPERTENSAO: Protocolo = {
  id: "hipertensao",
  titulo: "Crise hipertensiva",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["hipertensão", "PA alta", "pressão alta", "hipertensão intraoperatória"],
  sinais: ["PA alta", "pressão subindo", "taquicardia", "hipertensão"],
  resumo: "Confirmar a leitura, aprofundar a anestesia e a analgesia, procurar a causa; só depois, o anti-hipertensivo.",
  reconhecer: [
    "As causas mais comuns: anestesia ou analgesia insuficiente, medicamentos e hipertensão prévia.",
    "Leitura falsa: transdutor na altura errada ou sem zerar, manguito pequeno.",
  ],
  agirAgora: [
    { texto: "Validar a leitura: altura e zero do transdutor, tamanho do manguito." },
    { texto: POAC, detalhe: "Confirma o paciente oxigenado, ventilado e anestesiado. Afastar hipóxia e hipercapnia." },
    { texto: "Estímulo cirúrgico? Aprofundar a anestesia e dar analgésico." },
    { texto: "Vasopressor sem querer: anestésico local com adrenalina, infusão de vasopressor, erro de fármaco." },
    { texto: "Tempo de torniquete e bexiga cheia." },
    { texto: "Tratadas as causas reversíveis, anti-hipertensivo IV.",
      detalhe: "O Manual lista também labetalol, fentolamina, nicardipina, clevidipina, enalapril e fenoldopam: confira o que o serviço tem." },
    { texto: "Feocromocitoma e outras crises por catecolamina: betabloqueador só depois do bloqueio alfa.",
      detalhe: "Sem a vasodilatação beta-2, o alfa sem oposição causa crise grave ou edema pulmonar." },
  ],
  medicamentos: [
    {
      id: "propofol-has", farmaco: "Propofol", indicacao: "Aprofundar a anestesia",
      populacao: "adulto", via: "IV",
      dose: { min: 50, max: 100, unidade: "mg", por: "fixa" }, apresentacoes: [PROPOFOL_10],
      par: "propofol-has-ped", referencias: ["qrh-2-5"],
    },
    {
      id: "propofol-has-ped", farmaco: "Propofol", indicacao: "Aprofundar a anestesia",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 1, unidade: "mg", por: "kg" }, apresentacoes: [PROPOFOL_10],
      par: "propofol-has", referencias: ["qrh-2-5"],
    },
    {
      id: "metoprolol-has", farmaco: "Metoprolol", indicacao: "Hipertensão com taquicardia",
      populacao: "adulto", via: "IV",
      dose: { min: 2, max: 5, unidade: "mg", por: "fixa" }, apresentacoes: [METOPROLOL_1],
      velocidade: "Em 1 a 2 minutos; repetir até 15 mg.",
      referencias: ["manual-34"],
    },
    {
      id: "esmolol-has", farmaco: "Esmolol", indicacao: "Ataque",
      populacao: "todas", via: "IV",
      dose: { usual: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [ESMOLOL_10],
      repeticao: "Depois, infusão (abaixo).",
      referencias: ["manual-34", "qrh-2-5"],
    },
    {
      id: "esmolol-infusao-has", farmaco: "Esmolol", indicacao: "Infusão depois do ataque",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 50, max: 300, unidade: "mcg", por: "kg/min" }, apresentacoes: [ESMOLOL_10],
      referencias: ["manual-34"],
    },
    {
      id: "hidralazina-has", farmaco: "Hidralazina", indicacao: "Vasodilatador",
      populacao: "adulto", via: "IV",
      dose: { min: 5, max: 10, unidade: "mg", por: "fixa" }, apresentacoes: [HIDRALAZINA_1],
      repeticao: "Repetir em 20 minutos, se preciso.",
      par: "hidralazina-has-ped", referencias: ["qrh-2-5", "manual-34"],
    },
    {
      id: "hidralazina-has-ped", farmaco: "Hidralazina", indicacao: "Vasodilatador",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 0.1, unidade: "mg", por: "kg" }, apresentacoes: [HIDRALAZINA_1],
      par: "hidralazina-has", referencias: ["qrh-2-5"],
    },
    {
      id: "nitroglicerina-has", farmaco: "Nitroglicerina", indicacao: "Vasodilatador — infusão",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 5, max: 100, unidade: "mcg", por: "min" }, apresentacoes: [NITROGLICERINA_200, NITROGLICERINA_1],
      velocidade: "Começar baixo e titular pela PA.",
      referencias: ["manual-34", "qrh-2-5"],
    },
    {
      id: "nitroprussiato-has", farmaco: "Nitroprussiato", indicacao: "Vasodilatador — infusão",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 0.25, max: 0.5, unidade: "mcg", por: "kg/min" }, apresentacoes: [NITROPRUSSIATO_200],
      velocidade: "Início; titular até no máximo 10 mcg/kg/min, ou até toxicidade.",
      cuidados: ["Proteger da luz.", "Dose alta ou por muitas horas: intoxicação por cianeto."],
      referencias: ["manual-34"],
    },
    {
      id: "clonidina-has", farmaco: "Clonidina", indicacao: "Alfa-2 agonista",
      populacao: "adulto", via: "IV",
      dose: { usual: 150, unidade: "mcg", por: "fixa" }, apresentacoes: [CLONIDINA_150],
      repeticao: "Em doses divididas.",
      referencias: ["manual-34"],
    },
  ],
  volumes: [],
  pensarEm: [
    "Da anestesia: intubação ou despertar, plano superficial, analgesia insuficiente, hipóxia, hipercapnia, hipertermia maligna, efeito, dose errada ou interação de fármaco, transdutor.",
    "Da cirurgia: torniquete, pinçamento da aorta, endarterectomia de carótida, estímulo de barorreceptor.",
    "Do paciente: hipertensão prévia (ou anti-hipertensivo suspenso), bexiga cheia, pré-eclâmpsia, doença renal, feocromocitoma, crise tireotóxica, hipertensão intracraniana.",
    "Excesso de volume (síndrome da RTU).",
  ],
  depois: [
    "Registrar na ficha a causa e as doses.",
    "Pré-eclâmpsia: magnésio e o protocolo de colapso materno.",
  ],
  divergencias: [
    {
      tema: "Início da nitroglicerina",
      posicoes: [
        { texto: "50 mg em 50 mL: começar com 3 a 5 mL/h (50 a 83 mcg/min) ou 5 mcg/min; até 100 mcg/min. Na tabela de infusões: 50 mg em 250 mL, 5 a 20 mcg/min (3 a 6 mL/h), até 400.", referencia: "manual-34" },
        { texto: "0,5 a 5 mcg/kg/min; adulto 2 a 20 mL/h da solução de 1 mg/mL.", referencia: "qrh-2-5" },
      ],
      escolha: "As páginas do Manual não fecham entre si (3 a 5 mL/h de 1 mg/mL não é 5 mcg/min). O protocolo mostra 5 a 100 mcg/min para titular; o revisor define o início.",
    },
  ],
  referencias: ["manual-27", "manual-34", "qrh-2-5"],
  relacionados: [
    { protocolo: "isquemia-miocardica", texto: "Isquemia miocárdica" },
    { protocolo: "colapso-materno", texto: "Colapso materno (eclâmpsia)" },
    { protocolo: "hipertermia-maligna", texto: "Hipertermia maligna" },
  ],
};

/* ---------------- Hipotensão ---------------- */

export const HIPOTENSAO: Protocolo = {
  id: "hipotensao",
  titulo: "Hipotensão grave",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["hipotensão", "PA baixa", "pressão caindo", "choque"],
  sinais: ["PA caindo", "pressão baixa", "hipotensão", "taquicardia", "EtCO2 caindo"],
  resumo: "Confirmar pulso e leitura, ver a capnografia; na leve, posição, volume e vasopressor; na grave ou sem causa, monitorização invasiva e eco para separar pré-carga, contratilidade e resistência.",
  reconhecer: [
    "As causas mais comuns: anestésico, analgésico, bloqueio regional, hipovolemia e sangramento, pressão intratorácica alta.",
    "Sem pulso: protocolo de PCR.",
    "Na laparoscopia, pensar logo em lesão por trocarte e sangramento: hemoglobina cedo.",
    "O eco e as variações da pressão de pulso separam pré-carga baixa, falência do VD, resistência baixa e falência do VE.",
  ],
  agirAgora: [
    { texto: "Olhar o paciente, o ritmo, validar a PA e a curva de capnografia para medir a gravidade." },
    { texto: "Sem pulso: protocolo de PCR." },
    { texto: "O2, via aérea e ventilação: pressão intratorácica alta derruba a pressão.",
      detalhe: "Pausar a cirurgia, se possível; FiO2." },
    { texto: "Leve a moderada: cabeça baixa ou pernas elevadas, volume, vasopressor e corrigir as causas comuns." },
    { texto: "FC abaixo de 60: anticolinérgico. FC acima de 100 sinusal: tratar como hipovolemia; não sinusal: taquicardia." },
    { texto: "Plano anestésico e analgesia na medida, pesando o risco de consciência." },
    { texto: "Persistente, inesperada ou grave: linha arterial e ecocardiograma." },
    { texto: "Pré-carga baixa (VDFVE baixo, VPP acima de 12%): hemoglobina, cristaloide ou sangue." },
    { texto: "Falência do VD (VDFVE baixo, PVC subindo, sem resposta a volume): inotrópico, vasodilatador pulmonar, tratar embolia, tamponamento ou pneumotórax." },
    { texto: "Resistência baixa (VDFVE normal, VPP abaixo de 12%): vasopressor e tratar a causa." },
    { texto: "Falência do VE (VDFVE normal ou alto, função caindo): inotrópico e suporte mecânico." },
  ],
  medicamentos: [
    {
      id: "efedrina-hipo", farmaco: "Efedrina", indicacao: "Vasopressor — bolus",
      populacao: "adulto", via: "IV",
      dose: { min: 3, max: 12, unidade: "mg", por: "fixa" }, apresentacoes: [EFEDRINA_5],
      par: "efedrina-hipo-ped", referencias: ["qrh-2-4"],
    },
    {
      id: "efedrina-hipo-ped", farmaco: "Efedrina", indicacao: "Vasopressor — bolus",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 100, unidade: "mcg", por: "kg" }, apresentacoes: [EFEDRINA_5],
      par: "efedrina-hipo", referencias: ["qrh-2-4"],
    },
    {
      id: "fenilefrina-hipo", farmaco: "Fenilefrina", indicacao: "Vasopressor — bolus",
      populacao: "adulto", via: "IV",
      dose: { usual: 100, unidade: "mcg", por: "fixa" }, apresentacoes: [FENILEFRINA_100],
      par: "fenilefrina-hipo-ped", referencias: ["qrh-2-4"],
    },
    {
      id: "fenilefrina-hipo-ped", farmaco: "Fenilefrina", indicacao: "Vasopressor — bolus",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 5, unidade: "mcg", por: "kg" }, apresentacoes: [FENILEFRINA_100],
      par: "fenilefrina-hipo", referencias: ["qrh-2-4"],
    },
    {
      id: "metaraminol-hipo", farmaco: "Metaraminol", indicacao: "Vasopressor — bolus",
      populacao: "adulto", via: "IV",
      dose: { usual: 0.5, unidade: "mg", por: "fixa" }, apresentacoes: [METARAMINOL_05],
      referencias: ["qrh-2-4"],
    },
    {
      id: "adrenalina-hipo", farmaco: "Adrenalina", indicacao: "Só na emergência — bolus",
      populacao: "adulto", via: "IV",
      dose: { min: 10, max: 100, unidade: "mcg", por: "fixa" }, apresentacoes: [ADRENALINA_10, ADRENALINA_100], altoRisco: true,
      par: "adrenalina-hipo-ped", referencias: ["qrh-2-4"],
    },
    {
      id: "adrenalina-hipo-ped", farmaco: "Adrenalina", indicacao: "Só na emergência — bolus",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 1, unidade: "mcg", por: "kg" }, apresentacoes: [ADRENALINA_10], altoRisco: true,
      par: "adrenalina-hipo", referencias: ["qrh-2-4"],
    },
    {
      id: "atropina-hipo", farmaco: "Atropina", indicacao: "FC abaixo de 60",
      populacao: "adulto", via: "IV",
      dose: { min: 0.3, max: 0.6, unidade: "mg", por: "fixa" }, apresentacoes: [ATROPINA_05, ATROPINA_025],
      referencias: ["qrh-2-4"],
    },
    {
      id: "noradrenalina-infusao-hipo", farmaco: "Noradrenalina", indicacao: "Vasopressor — infusão",
      populacao: "todas", via: "IV, infusão contínua",
      dose: { min: 0.1, max: 2, unidade: "mcg", por: "kg/min" }, apresentacoes: [NORADRENALINA_80], altoRisco: true,
      referencias: ["manual-34"],
    },
    {
      id: "adrenalina-infusao-hipo", farmaco: "Adrenalina", indicacao: "Inotrópico e vasopressor — infusão",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 0.05, max: 0.5, unidade: "mcg", por: "kg/min" }, apresentacoes: [ADRENALINA_60], altoRisco: true,
      par: "adrenalina-infusao-hipo-ped", referencias: ["manual-34"],
    },
    {
      id: "adrenalina-infusao-hipo-ped", farmaco: "Adrenalina", indicacao: "Inotrópico e vasopressor — infusão",
      populacao: "pediatrico", via: "IV, infusão contínua",
      dose: { min: 0.1, max: 1, unidade: "mcg", por: "kg/min" }, apresentacoes: [ADRENALINA_60], altoRisco: true,
      par: "adrenalina-infusao-hipo", referencias: ["manual-34"],
    },
  ],
  volumes: [
    { id: "fluido-hipo-adulto", indicacao: "Bolus", populacao: "adulto", fixo: { min: 250 }, referencias: ["qrh-2-4"] },
    { id: "fluido-hipo-ped", indicacao: "Bolus", populacao: "pediatrico", porKg: { min: 10 }, referencias: ["qrh-2-4"] },
  ],
  pensarEm: [
    "Pré-carga baixa: sangramento (oculto, não declarado), retorno venoso (compressão da cava, pneumoperitônio, posição), desidratação, extravasamento capilar, pressão intratorácica alta, tamponamento, embolia, útero da gestante.",
    "Contratilidade: fármacos (inclusive halogenados), isquemia, miocardiopatia, miocardite, arritmia, pós-carga que sobe de repente.",
    "Resistência baixa: halogenados, analgésicos e vasodilatadores, IECA e BRA, bloqueio regional, anafilaxia, sepse, pós-circulação extracorpórea, neuropatia, soltura de torniquete ou pinça, Addison (corticoide), tireoide, cimento ósseo.",
    "Não esquecer: erro de fármaco, pneumotórax, toxicidade por anestésico local.",
  ],
  depois: [
    "Registrar na ficha a causa, o menor valor e as doses.",
    "Hipotensão sem causa clara ou que precisou de infusão: UTI ou recuperação monitorizada.",
  ],
  divergencias: [],
  referencias: ["manual-28", "manual-34", "qrh-2-4"],
  relacionados: [
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto" },
    { protocolo: "taquiarritmia", texto: "Taquiarritmia" },
    { protocolo: "bradicardia", texto: "Bradicardia" },
  ],
};

/* ---------------- Taquicardia ---------------- */

export const TAQUIARRITMIA: Protocolo = {
  id: "taquiarritmia",
  titulo: "Taquiarritmia instável",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["taquicardia", "taquiarritmia", "FA", "fibrilação atrial", "flutter", "TSV", "TV com pulso", "cardioversão"],
  sinais: ["FC alta", "taquicardia", "QRS estreito", "QRS largo", "irregular", "hipotensão"],
  resumo: "Perfusão ruim e dúvida (FC em geral acima de 150): cardioversão sincronizada. Estável: QRS estreito ou largo, regular ou irregular decide o fármaco.",
  reconhecer: [
    "As causas mais comuns: ansiedade, intubação, plano anestésico, medicamentos, hipovolemia.",
    "Pelo ECG: largura do QRS, regularidade e frequência separam taquicardia sinusal de taquiarritmia.",
    "Na dúvida, com perfusão comprometida, não esperar: cardioversão.",
  ],
  agirAgora: [
    { texto: "Parar o estímulo; pulso, ritmo e PA.", detalhe: "Sem pulso: protocolo de PCR." },
    { texto: POAC },
    { texto: "O2 a 100% até a taquicardia resolver e o paciente estabilizar." },
    { texto: "Perfusão comprometida e dúvida no diagnóstico: cardioversão elétrica sincronizada; pedir ajuda especializada.",
      detalhe: "Sedação ou anestesia adequada; sincronizar e conferir as marcas nas ondas R; segurar o botão até o choque sair." },
    { texto: "Taquicardia sinusal: causas comuns primeiro; o cirurgião injetou anestésico local com adrenalina?",
      detalhe: "QRS estreito sem hipotensão: aprofundar a anestesia e a analgesia antes de fármaco." },
    { texto: "QRS estreito regular: manobra vagal e adenosina; alternativas, betabloqueador, diltiazem ou verapamil." },
    { texto: "QRS estreito irregular (FA): controle da frequência (betabloqueador, diltiazem, verapamil, digoxina) ou do ritmo (amiodarona)." },
    { texto: "QRS largo regular (TV): amiodarona. TSV com aberrância: tratar como QRS estreito." },
    { texto: "Torsades de pointes: magnésio. FA com pré-excitação: amiodarona, sem bloqueador do nó AV." },
    { texto: "Corrigir eletrólitos, suspender fármacos que alargam o QT, pensar em intoxicação." },
  ],
  medicamentos: [
    {
      id: "adenosina-taqui", farmaco: "Adenosina", indicacao: "QRS estreito regular — 1ª dose",
      populacao: "adulto", via: "IV rápido",
      dose: { usual: 6, unidade: "mg", por: "fixa" }, apresentacoes: [ADENOSINA_3],
      repeticao: "Sem resposta: 12 mg, até duas vezes. Em bolus rápido, seguido de flush.",
      par: "adenosina-taqui-ped", referencias: ["manual-34", "qrh-2-7"],
    },
    {
      id: "adenosina-taqui-ped", farmaco: "Adenosina", indicacao: "QRS estreito regular",
      populacao: "pediatrico", via: "IV rápido",
      dose: { min: 0.1, max: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [ADENOSINA_3],
      par: "adenosina-taqui", referencias: ["qrh-2-7"],
    },
    {
      id: "amiodarona-taqui", farmaco: "Amiodarona", indicacao: "TV com pulso, FA (controle do ritmo)",
      populacao: "adulto", via: "IV",
      dose: { usual: 300, unidade: "mg", por: "fixa" }, apresentacoes: [AMIODARONA_50],
      velocidade: "Em 20 minutos (Manual); depois 900 mg em 24 horas.",
      cuidados: ["Não usar na TV polimórfica (torsades)."],
      par: "amiodarona-taqui-ped", referencias: ["manual-34", "qrh-2-7"],
    },
    {
      id: "amiodarona-infusao-taqui", farmaco: "Amiodarona", indicacao: "Manutenção: 900 mg em 24 horas",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 30, max: 60, unidade: "mg", por: "h" }, apresentacoes: [AMIODARONA_INFUSAO],
      velocidade: "60 mg/h nas primeiras 6 horas e 30 mg/h nas 18 seguintes: 900 mg em 24 horas.",
      referencias: ["manual-34"],
    },
    {
      id: "amiodarona-taqui-ped", farmaco: "Amiodarona", indicacao: "TV com pulso",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 5, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 300, unidade: "mg" }, apresentacoes: [AMIODARONA_50],
      velocidade: "Em mais de 3 minutos.",
      par: "amiodarona-taqui", referencias: ["qrh-2-7"],
    },
    {
      id: "esmolol-taqui", farmaco: "Esmolol", indicacao: "Controle da frequência",
      populacao: "todas", via: "IV",
      dose: { usual: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [ESMOLOL_10],
      repeticao: "Depois, infusão de 50 a 300 mcg/kg/min.",
      referencias: ["manual-34", "qrh-2-7"],
    },
    {
      id: "metoprolol-taqui", farmaco: "Metoprolol", indicacao: "Controle da frequência",
      populacao: "adulto", via: "IV",
      dose: { min: 2, max: 5, unidade: "mg", por: "fixa" }, apresentacoes: [METOPROLOL_1],
      velocidade: "Em 1 a 2 minutos; repetir até 15 mg.",
      cuidados: ["Não associar a verapamil."],
      referencias: ["manual-34"],
    },
    {
      id: "diltiazem-taqui", farmaco: "Diltiazem", indicacao: "Controle da frequência",
      populacao: "adulto", via: "IV",
      dose: { usual: 0.25, unidade: "mg", por: "kg" }, apresentacoes: [DILTIAZEM_5],
      velocidade: "Em 2 minutos (15 a 20 mg no adulto); segunda dose de 0,35 mg/kg; manutenção de 5 a 15 mg/h.",
      referencias: ["manual-34"],
    },
    {
      id: "verapamil-taqui", farmaco: "Verapamil", indicacao: "Controle da frequência",
      populacao: "adulto", via: "IV",
      dose: { min: 2.5, max: 5, unidade: "mg", por: "fixa" }, apresentacoes: [VERAPAMIL_25],
      velocidade: "Em 2 minutos; depois 5 a 10 mg a cada 15 minutos, até 30 mg.",
      cuidados: ["Não associar a betabloqueador.", "Evitar no QRS largo de diagnóstico incerto."],
      referencias: ["manual-34"],
    },
    {
      id: "magnesio-taqui", farmaco: "Sulfato de magnésio", indicacao: "Torsades de pointes",
      populacao: "adulto", via: "IV",
      dose: { min: 1, max: 2, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_50, MAGNESIO_10],
      velocidade: "Em 5 a 10 minutos; depois 0,5 a 1 g/h, se preciso.",
      par: "magnesio-taqui-ped", referencias: ["manual-34", "qrh-2-7"],
    },
    {
      id: "magnesio-taqui-ped", farmaco: "Sulfato de magnésio", indicacao: "Torsades de pointes",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 50, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 2, unidade: "g" }, apresentacoes: [MAGNESIO_10, MAGNESIO_50],
      velocidade: "Em mais de 10 minutos.",
      par: "magnesio-taqui", referencias: ["qrh-2-7"],
    },
  ],
  volumes: [
    { id: "cardioversao-adulto", rotulo: "Cardioversão sincronizada (bifásico)", grupo: "Cardioversão e volume", indicacao: "Primeiro choque",
      populacao: "adulto", unidade: "J", fixo: { min: 50, max: 100 }, referencias: ["qrh-2-7"] },
    { id: "cardioversao-ped", rotulo: "Cardioversão sincronizada (bifásico)", grupo: "Cardioversão e volume", indicacao: "Primeiro choque",
      populacao: "pediatrico", unidade: "J", porKg: { min: 1 }, referencias: ["qrh-2-7"] },
    { id: "fluido-taqui-adulto", rotulo: "Cristaloide", grupo: "Cardioversão e volume", indicacao: "Bolus, se hipovolemia",
      populacao: "adulto", fixo: { min: 250 }, referencias: ["qrh-2-7"] },
    { id: "fluido-taqui-ped", rotulo: "Cristaloide", grupo: "Cardioversão e volume", indicacao: "Bolus, se hipovolemia",
      populacao: "pediatrico", porKg: { min: 10 }, referencias: ["qrh-2-7"] },
  ],
  pensarEm: [
    "Primárias: isquemia, pós-cirurgia cardíaca, miocardiopatia, via acessória, doença do nó sinusal, insuficiência cardíaca, miocardite, pericardite, doença valvar, cardiopatia congênita.",
    "Secundárias: hipovolemia, plano anestésico, fármacos (anestésico local com adrenalina), ansiedade, anafilaxia, eletrólitos, tamponamento, pneumotórax ou auto-PEEP, sepse, hipertireoidismo, doença pulmonar, hipertermia maligna.",
    "Cateter central ou fio-guia no coração; erro de fármaco; embolia.",
  ],
  depois: [
    "ECG de 12 derivações e eletrólitos (potássio e magnésio).",
    "Cardiologia para a arritmia nova ou que voltou.",
    "Registrar na ficha o traçado, as doses, as cargas e a resposta.",
  ],
  divergencias: [
    {
      tema: "Velocidade da amiodarona com pulso",
      posicoes: [
        { texto: "300 mg em 20 minutos, depois 900 mg em 24 horas.", referencia: "manual-34" },
        { texto: "5 mg/kg (adulto 300 mg) em mais de 3 minutos.", referencia: "qrh-2-7" },
      ],
      escolha: "Com pulso, o protocolo segue os 20 minutos do Manual; o revisor confirma.",
    },
    {
      tema: "Infusão de amiodarona",
      posicoes: [
        { texto: "900 mg em 500 mL de SG 5% a 60 mL/h por 6 horas e 30 mL/h por 18 horas.", referencia: "manual-34" },
      ],
      escolha: "Com 900 mg em 500 mL, essas velocidades somam 900 mL e passariam de 1,5 g no dia. Os números fecham como mg/h (60 e 30 mg/h = 900 mg): o protocolo calcula assim. O revisor confirma.",
    },
    {
      tema: "Adenosina",
      posicoes: [
        { texto: "6 mg; repetir 12 mg duas vezes.", referencia: "manual-34" },
        { texto: "0,1 a 0,5 mg/kg; adulto 3 a 18 mg.", referencia: "qrh-2-7" },
      ],
      escolha: "Adulto em 6 e 12 mg (Manual); criança pela faixa por kg do QRH.",
    },
  ],
  referencias: ["manual-29", "manual-34", "qrh-2-7"],
  relacionados: [
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "hipotensao", texto: "Hipotensão grave" },
    { protocolo: "isquemia-miocardica", texto: "Isquemia miocárdica" },
  ],
};

/* ---------------- Bradicardia ---------------- */

export const BRADICARDIA: Protocolo = {
  id: "bradicardia",
  titulo: "Bradicardia grave",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["bradicardia", "FC baixa", "bloqueio AV", "bradiarritmia", "marca-passo"],
  sinais: ["FC baixa", "bradicardia", "hipotensão", "bloqueio", "reflexo vagal"],
  resumo: "Parar o estímulo, afastar hipóxia; normotenso e bem perfundido, procurar a causa; hipotensão ou má perfusão, atropina, adrenalina e marca-passo; sem resposta e EtCO2 abaixo de 20, RCP.",
  reconhecer: [
    "As causas mais comuns: fármaco, reflexo vagal, raquianestesia, bom preparo físico.",
    "Frequência normal em repouso (acordado): recém-nascido 90–160 (100–205); 1 a 11 meses 90–160 (100–190); 1 a 2 anos 80–120 (100–140); 3 a 5 anos 65–100 (80–120); 6 a 11 anos 60–90 (75–120); acima de 12 anos 50–90 (60–100); atleta 40–60.",
    "Lactente ou recém-nascido com FC abaixo de 60 e má perfusão: compressões.",
  ],
  agirAgora: [
    { texto: "Parar o estímulo (tração, pneumoperitônio, olho); pulso, ritmo e PA." },
    { texto: POAC },
    { texto: "Afastar hipóxia e estímulo vagal; subir a FiO2." },
    { texto: "Comparar com o normal para a idade e o preparo físico." },
    { texto: "Normotenso e bem perfundido: sem tratamento imediato até achar a causa." },
    { texto: "Hipotensão sintomática, má perfusão ou FC abaixo do limite: atropina; sem resposta, adrenalina e marca-passo." },
    { texto: "Betabloqueador: glucagon. Bloqueador de canal de cálcio: cloreto de cálcio." },
    { texto: "Marca-passo transcutâneo: pás e eletrodos, modo de marca-passo, começar em 60 mA e subir até capturar; deixar 10 mA acima do limiar.",
      detalhe: "Confirmar a captura no ECG e no pulso femoral." },
    { texto: "Sem resposta e EtCO2 abaixo de 20 mmHg: RCP e o protocolo de AESP." },
  ],
  medicamentos: [
    {
      id: "atropina-bradi", farmaco: "Atropina", indicacao: "Bradicardia com má perfusão",
      populacao: "adulto", via: "IV",
      dose: { min: 0.5, max: 1, unidade: "mg", por: "fixa" }, apresentacoes: [ATROPINA_05, ATROPINA_025],
      repeticao: "Com flush de soro.",
      par: "atropina-bradi-ped", referencias: ["qrh-2-6", "manual-30"],
    },
    {
      id: "atropina-bradi-ped", farmaco: "Atropina", indicacao: "Bradicardia com má perfusão",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 20, unidade: "mcg", por: "kg" }, tetoAbsoluto: { valor: 0.5, unidade: "mg" }, apresentacoes: [ATROPINA_025, ATROPINA_05],
      repeticao: "Com flush de soro. Máximo de 0,5 mg por dose.",
      par: "atropina-bradi", referencias: ["manual-30", "qrh-2-6", "aha-2020-pediatrico"],
    },
    {
      id: "adrenalina-infusao-bradi", farmaco: "Adrenalina", indicacao: "Sem resposta à atropina — infusão",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 2, max: 10, unidade: "mcg", por: "min" }, apresentacoes: [ADRENALINA_60], altoRisco: true,
      referencias: ["manual-30"],
    },
    {
      id: "adrenalina-bolus-bradi", farmaco: "Adrenalina", indicacao: "Só na emergência — bolus",
      populacao: "adulto", via: "IV",
      dose: { min: 10, max: 100, unidade: "mcg", por: "fixa" }, apresentacoes: [ADRENALINA_10, ADRENALINA_100], altoRisco: true,
      par: "adrenalina-bolus-bradi-ped", referencias: ["qrh-2-6"],
    },
    {
      id: "adrenalina-bolus-bradi-ped", farmaco: "Adrenalina", indicacao: "Só na emergência — bolus",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 1, unidade: "mcg", por: "kg" }, apresentacoes: [ADRENALINA_10], altoRisco: true,
      par: "adrenalina-bolus-bradi", referencias: ["qrh-2-6"],
    },
    {
      id: "dopamina-bradi", farmaco: "Dopamina", indicacao: "Sem resposta à atropina — infusão",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 2, max: 20, unidade: "mcg", por: "kg/min" }, apresentacoes: [DOPAMINA_1000],
      referencias: ["manual-30"],
    },
    {
      id: "efedrina-bradi", farmaco: "Efedrina", indicacao: "Bradicardia com hipotensão",
      populacao: "adulto", via: "IV",
      dose: { min: 3, max: 12, unidade: "mg", por: "fixa" }, apresentacoes: [EFEDRINA_5],
      referencias: ["qrh-2-6"],
    },
    {
      id: "glucagon-bradi", farmaco: "Glucagon", indicacao: "Intoxicação por betabloqueador",
      populacao: "adulto", via: "IV",
      dose: { min: 2, max: 4, unidade: "mg", por: "fixa" }, apresentacoes: [GLUCAGON_1],
      repeticao: "A tabela de infusões do Manual traz bolus de 3 a 5 mg, repetindo até 10 mg, e depois 1 a 5 mg/h.",
      referencias: ["manual-30", "manual-34"],
    },
    {
      id: "cloreto-de-calcio-bradi", farmaco: "Cloreto de cálcio", indicacao: "Intoxicação por bloqueador de canal de cálcio",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [CLORETO_DE_CALCIO_10],
      velocidade: "1 a 2 g em 10 a 20 minutos; repetir em 20 minutos, se preciso (aba 34).",
      cuidados: ["Em veia calibrosa ou central: extravasamento causa necrose."],
      referencias: ["manual-30", "manual-34"],
    },
  ],
  volumes: [],
  pensarEm: [
    "Primárias: isquemia, doença do nó sinusal, degeneração do sistema de condução, doença valvar, miocardite, miocardiopatia, pós-cirurgia cardíaca, distúrbio hereditário da condução, preparo físico.",
    "Secundárias: eletrólitos, antiarrítmico, hipotireoidismo, hipotermia, síncope vasovagal, hipertensão intracraniana.",
    "Da anestesia: hipóxia, halogenado, relaxante (succinilcolina), opioide (remifentanil), anticolinesterásico, raqui ou peridural alta, reflexo do vasopressor.",
    "Erro de fármaco; betabloqueador, bloqueador de canal de cálcio, digoxina; hipercalemia; toxicidade por anestésico local; pressão intratorácica alta e pneumoperitônio.",
  ],
  depois: [
    "ECG de 12 derivações; eletrólitos.",
    "Cardiologia para bloqueio AV de alto grau ou marca-passo.",
    "Registrar na ficha a FC mais baixa, a causa e as doses.",
  ],
  divergencias: [
    {
      tema: "Dose de atropina",
      posicoes: [
        { texto: "20 mcg/kg, sem separar adulto e criança.", referencia: "manual-30" },
        { texto: "Bradicardia crítica: 20 mcg/kg, adulto 0,5 a 1 mg; não crítica: 10 mcg/kg, adulto 300 a 600 mcg.", referencia: "qrh-2-6" },
      ],
      escolha: "Criança: 20 mcg/kg; adulto: 0,5 a 1 mg (a conta por kg daria 1,4 mg em 70 kg).",
    },
    {
      tema: "Glucagon na intoxicação por betabloqueador",
      posicoes: [
        { texto: "2 a 4 mg EV (aba 30); bolus de 3 a 5 mg até 10 mg e infusão de 1 a 5 mg/h (aba 34).", referencia: "manual-30" },
      ],
      escolha: "O cartão mostra 2 a 4 mg e cita a tabela de infusões.",
    },
  ],
  referencias: ["manual-30", "manual-34", "qrh-2-6", "aha-2020-pediatrico"],
  relacionados: [
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "hipotensao", texto: "Hipotensão grave" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto" },
    { protocolo: "hipercalemia", texto: "Hipercalemia" },
  ],
};

/* ---------------- CO2 expirado ---------------- */

export const AUMENTO_ETCO2: Protocolo = {
  id: "aumento-etco2",
  titulo: "Aumento do CO2 expirado",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["hipercapnia", "EtCO2 alto", "CO2 subindo"],
  sinais: ["EtCO2 subindo", "EtCO2 alto", "hipercapnia", "CO2 inspirado", "cal sodada"],
  resumo: "Conferir monitor, plano e doses, cal sodada, temperatura, fluxo e ventilador; se continuar subindo sem explicação, pensar em hipertermia maligna.",
  reconhecer: [
    "As causas mais comuns: hipoventilação espontânea, cal sodada esgotada, fluxo de gás fresco e ajuste do ventilador.",
    "CO2 inspirado acima de zero aponta para reinalação: cal sodada, válvula ou fluxo.",
    "EtCO2 subindo com taquicardia, rigidez e temperatura subindo: hipertermia maligna até prova em contrário.",
  ],
  agirAgora: [
    { texto: POAC, detalhe: "Olhar a forma da curva de CO2." },
    { texto: "Rever as doses dos fármacos e o plano anestésico (hipoventilação espontânea)." },
    { texto: "Cal sodada e temperatura do paciente." },
    { texto: "Fluxo de gás fresco certo para o circuito, o tamanho e o estado do paciente." },
    { texto: "Modo e ajustes do ventilador." },
    { texto: "Continua subindo: percorrer a lista de causas." },
  ],
  medicamentos: [],
  volumes: [],
  pensarEm: [
    "Produção maior: sepse, hipertermia maligna, crise tireotóxica, reperfusão, tremores.",
    "CO2 que entra: bicarbonato, insuflação de CO2 (laparoscopia), nutrição parenteral, CO2 no gás fresco, cal sodada esgotada.",
    "Eliminação menor — circuito: obstrução, fluxo inadequado, válvula, ventilador mal ajustado.",
    "Eliminação menor — pulmão: hipoventilação espontânea, broncoespasmo, DPOC.",
  ],
  depois: ["Registrar na ficha o valor máximo, a causa e a conduta."],
  divergencias: [],
  referencias: ["manual-31"],
  relacionados: [
    { protocolo: "hipertermia-maligna", texto: "Hipertermia maligna" },
    { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" },
  ],
};

export const QUEDA_ETCO2: Protocolo = {
  id: "diminuicao-etco2",
  titulo: "Queda do CO2 expirado",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["diminuição do CO2 expirado", "EtCO2 baixo", "sem capnografia", "perdeu a curva de CO2"],
  sinais: ["EtCO2 caindo", "sem curva de capnografia", "EtCO2 zero", "queda súbita do EtCO2"],
  resumo: "Sem curva: intubação esofágica, desconexão ou falha do ventilador até prova em contrário. Com curva baixa: linha de amostragem, ventilação, e débito cardíaco caindo.",
  reconhecer: [
    "As causas mais comuns: hiperventilação, volume corrente inadequado, laringoespasmo, via aérea mal posicionada, hipotensão.",
    "Queda súbita com hipotensão: débito cardíaco caindo — embolia, anafilaxia, tamponamento, pneumotórax, parada.",
  ],
  agirAgora: [
    { texto: POAC, detalhe: "Confirma oxigenação, anestesia e analgesia, e mostra se há hipotensão importante." },
    { texto: "SEM curva de CO2: agir já para afastar intubação esofágica, desconexão ou falha do ventilador." },
    { texto: "Linha de amostragem conectada e pérvia." },
    { texto: "Examinar o paciente: posição do dispositivo e padrão ventilatório (laringoespasmo, tubo deslocado, volume corrente pequeno)." },
    { texto: "Continua baixo: percorrer a lista de causas." },
  ],
  medicamentos: [],
  volumes: [],
  pensarEm: [
    "Produção menor: hipotermia, hipotireoidismo.",
    "Eliminação maior: hiperventilação espontânea, ventilador mal ajustado.",
    "Ventilação alveolar menor: tubo obstruído, dispositivo mal posicionado, laringoespasmo, broncoespasmo grave, espaço morto.",
    "Fluxo pulmonar menor: hipotensão grave, anafilaxia, parada, tamponamento, embolia pulmonar ou gasosa, pneumotórax hipertensivo.",
    "Amostra diluída: arrastamento de ar, coletor mal posicionado, fluxo de gás fresco alto.",
    "Sem curva: intubação esofágica, desconexão, sem ventilação, sem amostragem.",
  ],
  depois: ["Registrar na ficha o valor, a causa e a conduta."],
  divergencias: [],
  referencias: ["manual-32"],
  relacionados: [
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "embolia-gasosa-venosa", texto: "Embolia gasosa venosa" },
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "laringoespasmo", texto: "Laringoespasmo" },
    { protocolo: "intubacao-dificil", texto: "Intubação difícil" },
  ],
};
