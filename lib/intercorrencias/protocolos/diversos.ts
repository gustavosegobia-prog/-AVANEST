/**
 * TOXICIDADE SISTÊMICA POR ANESTÉSICO LOCAL, HIPERCALEMIA E HIPERTERMIA
 * MALIGNA — adulto e criança.
 *
 * Sequência e doses do Manual de Crises (protocolos 20, 21 e 22, lidos no
 * livro), conferidas com o QRH 3-10 e 3-8 da Association of Anaesthetists e
 * com o MSD Manual (hipercalemia) — abertos e lidos. Onde diferem, ou onde a
 * tabela do Manual tem número que não fecha, as posições ficam em
 * `divergencias`. O texto é do AVANEST.
 */

import type { ApresentacaoDoProtocolo, Protocolo, VolumeDoProtocolo } from "../tipos.ts";
import {
  AMIODARONA_50, BICARBONATO_84, CLORETO_DE_CALCIO_10, FUROSEMIDA_10, GLUCONATO_DE_CALCIO_10, LIDOCAINA_20,
  MIDAZOLAM_1, MIDAZOLAM_5, PROPOFOL_10, SALBUTAMOL_NEBULIZACAO,
} from "./comum.ts";

/** 20% = 0,2 g por mL: a dose em g/kg vira o volume em mL/kg do cartão (0,3 g/kg = 1,5 mL/kg). */
const LIPIDICA_20: ApresentacaoDoProtocolo = {
  rotulo: "Emulsão lipídica 20% — 200 mg/mL", quantidade: 200, unidade: "mg", mL: 1, vias: ["IV"],
};
const DIAZEPAM_5: ApresentacaoDoProtocolo = { rotulo: "Ampola de 10 mg em 2 mL — 5 mg/mL", quantidade: 5, unidade: "mg", mL: 1, vias: ["IV"] };
const TIOPENTAL_25: ApresentacaoDoProtocolo = {
  rotulo: "500 mg em 20 mL — 25 mg/mL", quantidade: 25, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "Frasco de 500 mg reconstituído em 20 mL de água destilada",
};
const GLICOSE_50: ApresentacaoDoProtocolo = { rotulo: "Glicose 50% — 500 mg/mL", quantidade: 500, unidade: "mg", mL: 1, vias: ["IV"] };
const GLICOSE_25: ApresentacaoDoProtocolo = {
  rotulo: "Glicose 25% — 250 mg/mL", quantidade: 250, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "Glicose 50% diluída meio a meio em água destilada",
};
const INSULINA_1: ApresentacaoDoProtocolo = {
  rotulo: "100 UI em 100 mL — 1 UI/mL", quantidade: 1, unidade: "UI", mL: 1, vias: ["IV"],
  preparo: "1 mL da insulina regular (100 UI/mL) em 100 mL de SF 0,9%",
};
const INSULINA_100: ApresentacaoDoProtocolo = { rotulo: "Insulina regular 100 UI/mL", quantidade: 100, unidade: "UI", mL: 1, vias: ["IV"] };
const DANTROLENO_20: ApresentacaoDoProtocolo = {
  rotulo: "Frasco de 20 mg em 60 mL de água destilada", quantidade: 20, unidade: "mg", mL: 60, vias: ["IV"],
  preparo: "Cada frasco com 60 mL de água destilada sem conservante, agitando até clarear: uma pessoa só para isso",
};
const DANTROLENO_RYANODEX: ApresentacaoDoProtocolo = {
  rotulo: "Formulação nova: 250 mg em 5 mL — 50 mg/mL (se disponível)", quantidade: 50, unidade: "mg", mL: 1, vias: ["IV"],
};
const METOPROLOL_1: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 5 mg em 5 mL — 1 mg/mL", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
};

/* ---------------- Toxicidade sistêmica por anestésico local ---------------- */

const maximoDeAL = (id: string, rotulo: string, mgKg: number): VolumeDoProtocolo => ({
  id, rotulo, grupo: "Dose máxima de anestésico local para este peso", indicacao: "Para conferir o que já foi dado",
  populacao: "todas", unidade: "mg", porKg: { min: mgKg }, referencias: ["manual-20"],
});

export const TOXICIDADE_AL: Protocolo = {
  id: "toxicidade-anestesico-local",
  titulo: "Toxicidade sistêmica por anestésicos locais",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["LAST", "toxicidade por anestésico local", "intoxicação por anestésico local", "emulsão lipídica", "intralipid"],
  sinais: ["convulsão", "gosto metálico", "zumbido", "agitação", "perda da consciência", "arritmia", "bradicardia", "QRS largo",
    "hipotensão", "parada", "depois do bloqueio"],
  resumo: "Parar o anestésico local, oxigenar, tratar a convulsão e dar emulsão lipídica 20% cedo; na parada, RCP longa e considerar circulação extracorpórea.",
  reconhecer: [
    "Durante ou logo depois de um bloqueio, infiltração ou infusão de anestésico local.",
    "Sistema nervoso: gosto metálico, zumbido, formigamento perioral, agitação, convulsão, perda da consciência.",
    "Coração: bradicardia, bloqueio, QRS largo, arritmia ventricular, hipotensão, parada — às vezes sem sinais neurológicos antes.",
    "A dose máxima varia com o local, a velocidade, o vasoconstritor e o paciente: a tabela é guia, não garantia.",
  ],
  agirAgora: [
    { texto: "Parar o anestésico local, inclusive a bomba de infusão." },
    { texto: "Pedir ajuda, o carrinho de parada e a emulsão lipídica." },
    { texto: "Ritmo e pulso: sem pulso, RCP e acionar a equipe de circulação extracorpórea.",
      detalhe: "Adrenalina em doses pequenas, de até 1 mcg/kg, segundo a ASRA (está na calculadora)." },
    { texto: "Via aérea e O2 a 100%; intubar se indicado.", detalhe: "Hiperventilar ajuda a corrigir a acidose." },
    { texto: "Confirmar o acesso venoso e tratar a convulsão em doses pequenas.",
      detalhe: "Propofol só com a hemodinâmica estável." },
    { texto: "Emulsão lipídica 20%: bolus de 1,5 mL/kg em 1 minuto e já começar a infusão de 15 mL/kg/h." },
    { texto: "Aos 5 minutos, sem resposta: repetir o bolus e dobrar a infusão.",
      detalhe: "Até 3 bolus no total, com 5 minutos entre eles; máximo de 12 mL/kg." },
    { texto: "Hipotensão e arritmia: tratamento habitual, com as mudanças do quadro abaixo.",
      detalhe: "Amiodarona para a arritmia ventricular. Evitar lidocaína e outros antiarrítmicos da classe IB, betabloqueador, bloqueador de canal de cálcio e vasopressina." },
    { texto: "Persistir na RCP: a recuperação pode passar de 1 hora. Sem resposta, circulação extracorpórea." },
  ],
  medicamentos: [
    {
      id: "lipidica-bolus-last", farmaco: "Emulsão lipídica 20%", indicacao: "Bolus — já, e repetir aos 5 e 10 minutos se preciso",
      populacao: "todas", via: "IV",
      dose: { usual: 0.3, unidade: "g", por: "kg" }, tetoAbsoluto: { valor: 20, unidade: "g" },
      apresentacoes: [LIPIDICA_20],
      velocidade: "Em 1 minuto. 1,5 mL/kg; no adulto, cerca de 100 mL.",
      cuidados: ["Propofol não substitui a emulsão lipídica."],
      referencias: ["manual-20", "qrh-3-10"],
    },
    {
      id: "lipidica-infusao-last", farmaco: "Emulsão lipídica 20%", indicacao: "Infusão — junto com o primeiro bolus",
      populacao: "todas", via: "IV, infusão contínua",
      dose: { usual: 3, max: 6, unidade: "g", por: "kg/h" },
      apresentacoes: [LIPIDICA_20],
      velocidade: "15 mL/kg/h; sem resposta aos 5 minutos, dobrar para 30 mL/kg/h. Máximo cumulativo de 12 mL/kg.",
      referencias: ["manual-20", "qrh-3-10"],
    },
    {
      id: "midazolam-last", farmaco: "Midazolam", indicacao: "Convulsão",
      populacao: "todas", via: "IV",
      dose: { min: 0.05, max: 0.1, unidade: "mg", por: "kg" }, apresentacoes: [MIDAZOLAM_1, MIDAZOLAM_5],
      repeticao: "Em doses pequenas; repetir se preciso.",
      referencias: ["manual-20"],
    },
    {
      id: "diazepam-last", farmaco: "Diazepam", indicacao: "Convulsão",
      populacao: "todas", via: "IV",
      dose: { min: 0.1, max: 0.2, unidade: "mg", por: "kg" }, apresentacoes: [DIAZEPAM_5],
      repeticao: "Em doses pequenas; repetir se preciso.",
      referencias: ["manual-20"],
    },
    {
      id: "tiopental-last", farmaco: "Tiopental", indicacao: "Convulsão",
      populacao: "todas", via: "IV",
      dose: { usual: 1, unidade: "mg", por: "kg" }, apresentacoes: [TIOPENTAL_25],
      referencias: ["manual-20"],
    },
    {
      id: "propofol-last", farmaco: "Propofol", indicacao: "Convulsão, com a hemodinâmica estável",
      populacao: "todas", via: "IV",
      dose: { min: 0.5, max: 2, unidade: "mg", por: "kg" }, apresentacoes: [PROPOFOL_10],
      cuidados: ["Evitar na instabilidade cardiovascular."],
      referencias: ["manual-20"],
    },
    {
      id: "amiodarona-last", farmaco: "Amiodarona", indicacao: "Irritabilidade ventricular, sem parada",
      populacao: "todas", via: "IV",
      dose: { usual: 5, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 300, unidade: "mg" }, apresentacoes: [AMIODARONA_50],
      velocidade: "Em mais de 3 minutos.",
      referencias: ["manual-20", "qrh-2-7"],
    },
  ],
  volumes: [
    { id: "lipidica-maximo", rotulo: "Emulsão lipídica 20% — máximo cumulativo", indicacao: "Somando bolus e infusão",
      populacao: "todas", porKg: { min: 12 }, referencias: ["qrh-3-10", "manual-20"] },
    maximoDeAL("max-lidocaina", "Lidocaína sem adrenalina", 3),
    maximoDeAL("max-lidocaina-adr", "Lidocaína com adrenalina", 7),
    maximoDeAL("max-bupivacaina", "Bupivacaína (com ou sem adrenalina)", 2),
    maximoDeAL("max-ropivacaina", "Ropivacaína (com ou sem adrenalina)", 3),
    maximoDeAL("max-mepivacaina", "Mepivacaína (com ou sem adrenalina)", 7),
  ],
  pensarEm: [
    "Bloqueio alto ou total (raqui ou peridural).",
    "Reação vasovagal; anafilaxia.",
    "Convulsão de outra causa: hipoglicemia, eclâmpsia, epilepsia.",
    "Isquemia miocárdica; arritmia primária.",
  ],
  depois: [
    "UTI ou monitorização prolongada: a toxicidade pode voltar.",
    "Afastar pancreatite nos dias seguintes (amilase ou lipase) depois da emulsão lipídica.",
    "Registrar na ficha o anestésico, a dose total, a técnica, os horários, a emulsão e a resposta.",
    "Notificar à farmacovigilância.",
  ],
  divergencias: [
    {
      tema: "Doses de anticonvulsivante na tabela",
      posicoes: [
        { texto: "Diazepam 0,1–0,2 mg/kg (“2–5 mg” para 70 kg) e tiopental 1 mg/kg (“50 mg” para 70 kg): o valor por kg e o valor para 70 kg não fecham.", referencia: "manual-20" },
        { texto: "Benzodiazepínico, tiopental ou propofol em doses pequenas e incrementais, sem número.", referencia: "qrh-3-10" },
      ],
      escolha: "O protocolo calcula pelo kg da tabela e manda titular em doses pequenas. O revisor confirma.",
    },
    {
      tema: "Teto da emulsão lipídica",
      posicoes: [
        { texto: "“Dose cumulativa máxima 8–12 mg/kg”.", referencia: "manual-20" },
        { texto: "Máximo cumulativo de 12 mL/kg (840 mL para 70 kg).", referencia: "qrh-3-10" },
      ],
      escolha: "Lido como 12 mL/kg: “mg/kg” parece erro de impressão (o regime todo é em mL).",
    },
    {
      tema: "Linha repetida na tabela de doses máximas",
      posicoes: [
        { texto: "Ropivacaína aparece duas vezes: 3/3 mg/kg e 6/9 mg/kg (sem e com adrenalina).", referencia: "manual-20" },
      ],
      escolha: "A segunda linha ficou de fora até o revisor dizer qual anestésico é (provavelmente prilocaína).",
    },
  ],
  referencias: ["manual-20", "qrh-3-10", "qrh-2-7"],
  relacionados: [
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto ou total" },
  ],
};

/* ---------------- Hipercalemia ---------------- */

export const HIPERCALEMIA: Protocolo = {
  id: "hipercalemia",
  titulo: "Hipercalemia",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["potássio alto", "hiperpotassemia", "K alto"],
  sinais: ["onda T apiculada", "QRS largo", "bradicardia", "arritmia", "potássio alto", "sinusoide", "depois da succinilcolina"],
  resumo: "Potássio acima de 6,5, ECG alterado ou instável: cálcio para o miocárdio, insulina com glicose e salbutamol para dentro da célula; depois tirar o potássio do corpo.",
  reconhecer: [
    "Potássio acima de 6,5 mmol/L, ou alteração do ECG (T apiculada, P que some, QRS largo, sinusoide), ou instabilidade.",
    "Confirmar com nova amostra de outro local — mas, com potássio muito alto, ECG alterado ou instabilidade, tratar sem esperar.",
    "O ritmo de subida importa tanto quanto o número.",
  ],
  agirAgora: [
    { texto: "Monitor cardíaco e acesso venoso." },
    { texto: "Pensar em erro de coleta e repetir a amostra (sem atrasar o tratamento, se grave)." },
    { texto: "Parar todo potássio: soro, solução de Hartmann, cardioplegia, sangue estocado." },
    { texto: "Rever a história, o potássio anterior, o ECG e a estabilidade para decidir o tratamento imediato." },
    { texto: "Potássio acima de 6,5, ECG alterado ou instabilidade: cálcio para estabilizar o miocárdio, e insulina com glicose para levar o potássio para dentro da célula.",
      detalhe: "Cloreto de cálcio por acesso central; gluconato pode ser periférico (cerca de um terço da potência)." },
    { texto: "Salbutamol nebulizado; em ventilação mecânica, hiperventilar." },
    { texto: "Bicarbonato só se houver acidose." },
    { texto: "Urinando: soro fisiológico com furosemida." },
    { texto: "Potássio e glicose a cada 30 a 60 minutos, por até 6 horas." },
    { texto: "Ainda alto em 60 minutos: repetir o tratamento e considerar hemodiálise de urgência." },
    { texto: "Corrigir a causa." },
  ],
  medicamentos: [
    {
      id: "cloreto-de-calcio-hiperk-adulto", farmaco: "Cloreto de cálcio", indicacao: "Estabilizar o miocárdio (acesso central)",
      populacao: "adulto", via: "IV central",
      dose: { min: 0.5, max: 1, unidade: "g", por: "fixa" }, apresentacoes: [CLORETO_DE_CALCIO_10],
      repeticao: "5 a 10 mL da solução a 10%.",
      cuidados: ["Irritante: em veia central; extravasamento causa necrose."],
      par: "cloreto-de-calcio-hiperk-ped", referencias: ["manual-21"],
    },
    {
      id: "gluconato-hiperk-adulto", farmaco: "Gluconato de cálcio", indicacao: "Estabilizar o miocárdio (acesso periférico)",
      populacao: "adulto", via: "IV",
      dose: { min: 1.5, max: 3, unidade: "g", por: "fixa" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      velocidade: "15 a 30 mL da solução a 10%, em 5 a 10 minutos.",
      par: "gluconato-hiperk-ped", referencias: ["manual-21", "msd-hipercalemia"],
    },
    {
      id: "insulina-hiperk-adulto", farmaco: "Insulina regular", indicacao: "Levar o potássio para a célula (com glicose)",
      populacao: "adulto", via: "IV",
      dose: { usual: 10, unidade: "UI", por: "fixa" }, apresentacoes: [INSULINA_1, INSULINA_100], altoRisco: true,
      cuidados: ["Sempre com glicose; glicemia a cada 30 a 60 minutos."],
      par: "insulina-hiperk-ped", referencias: ["manual-21", "msd-hipercalemia"],
    },
    {
      id: "glicose-hiperk-adulto", farmaco: "Glicose", indicacao: "Com a insulina",
      populacao: "adulto", via: "IV",
      dose: { min: 12.5, max: 25, unidade: "g", por: "fixa" }, apresentacoes: [GLICOSE_50],
      repeticao: "25 a 50 mL de glicose a 50%.",
      par: "glicose-hiperk-ped", referencias: ["manual-21", "msd-hipercalemia"],
    },
    {
      id: "salbutamol-hiperk-adulto", farmaco: "Salbutamol", indicacao: "Levar o potássio para a célula",
      populacao: "adulto", via: "Inalatória, nebulização",
      dose: { min: 10, max: 20, unidade: "mg", por: "fixa" }, apresentacoes: [SALBUTAMOL_NEBULIZACAO],
      cuidados: ["Evitar na angina instável e no infarto agudo."],
      referencias: ["manual-21", "msd-hipercalemia"],
    },
    {
      id: "bicarbonato-hiperk-adulto", farmaco: "Bicarbonato de sódio", indicacao: "Só com acidose",
      populacao: "adulto", via: "IV",
      dose: { usual: 50, unidade: "mEq", por: "fixa" }, apresentacoes: [BICARBONATO_84],
      repeticao: "50 mL a 8,4%; até 200 mEq no adulto, se houver acidose. Não funciona com pH normal.",
      par: "bicarbonato-hiperk-ped", referencias: ["manual-21"],
    },
    {
      id: "furosemida-hiperk", farmaco: "Furosemida", indicacao: "Paciente urinando, com soro fisiológico",
      populacao: "adulto", via: "IV",
      dose: { min: 20, max: 80, unidade: "mg", por: "fixa" }, apresentacoes: [FUROSEMIDA_10],
      referencias: ["manual-21"],
    },
    {
      id: "cloreto-de-calcio-hiperk-ped", farmaco: "Cloreto de cálcio", indicacao: "Estabilizar o miocárdio (acesso central)",
      populacao: "pediatrico", via: "IV central",
      dose: { usual: 20, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "g" }, apresentacoes: [CLORETO_DE_CALCIO_10],
      velocidade: "0,2 mL/kg da solução a 10%, em 5 minutos.",
      par: "cloreto-de-calcio-hiperk-adulto", referencias: ["manual-21"],
    },
    {
      id: "gluconato-hiperk-ped", farmaco: "Gluconato de cálcio", indicacao: "Estabilizar o miocárdio",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 100, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 3, unidade: "g" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      velocidade: "1 mL/kg da solução a 10%, em 3 a 5 minutos.",
      par: "gluconato-hiperk-adulto", referencias: ["manual-21"],
    },
    {
      id: "insulina-hiperk-ped", farmaco: "Insulina regular", indicacao: "Com glicose",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 0.1, unidade: "UI", por: "kg" }, tetoAbsoluto: { valor: 10, unidade: "UI" },
      apresentacoes: [INSULINA_1, INSULINA_100], altoRisco: true,
      cuidados: ["Sempre com glicose; glicemia a cada 30 a 60 minutos."],
      par: "insulina-hiperk-adulto", referencias: ["manual-21"],
    },
    {
      id: "glicose-hiperk-ped", farmaco: "Glicose", indicacao: "Com a insulina",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 0.5, unidade: "g", por: "kg" }, tetoAbsoluto: { valor: 25, unidade: "g" }, apresentacoes: [GLICOSE_25],
      repeticao: "2 mL/kg de glicose a 25%.",
      par: "glicose-hiperk-adulto", referencias: ["manual-21"],
    },
    {
      id: "bicarbonato-hiperk-ped", farmaco: "Bicarbonato de sódio", indicacao: "Só com acidose",
      populacao: "pediatrico", via: "IV",
      dose: { min: 1, max: 2, unidade: "mEq", por: "kg" }, apresentacoes: [BICARBONATO_84],
      par: "bicarbonato-hiperk-adulto", referencias: ["manual-21"],
    },
  ],
  volumes: [],
  pensarEm: [
    "Succinilcolina em queimado, lesão medular, doença neuromuscular ou imobilização prolongada.",
    "Hipertermia maligna; rabdomiólise; trauma e queimadura.",
    "Acidose; insuficiência renal.",
    "Reperfusão depois de soltar a pinça ou o torniquete.",
    "Hemólise e transfusão maciça (sangue estocado).",
    "Fármacos: suplemento de potássio, IECA e BRA, espironolactona, heparina.",
  ],
  depois: [
    "Evitar succinilcolina, acidose respiratória e soluções com potássio (Ringer lactato, Hartmann).",
    "Potássio e glicose em série até estabilizar; ECG contínuo.",
    "Nefrologia se o potássio não cair ou houver insuficiência renal.",
    "Registrar na ficha os valores, os horários e as doses.",
  ],
  divergencias: [
    {
      tema: "Dose de insulina no adulto",
      posicoes: [
        { texto: "10 unidades, com 25 a 50 mL de glicose a 50%.", referencia: "manual-21" },
        { texto: "5 a 10 unidades, com 50 mL de glicose a 50% e depois glicose a 10% a 50 mL/h.", referencia: "msd-hipercalemia" },
      ],
      escolha: "O protocolo calcula 10 UI (Manual); o revisor decide se acrescenta a glicose contínua do MSD.",
    },
    {
      tema: "Gluconato de cálcio no adulto",
      posicoes: [
        { texto: "15 a 30 mL a 10%.", referencia: "manual-21" },
        { texto: "10 a 20 mL a 10% em 5 a 10 minutos.", referencia: "msd-hipercalemia" },
      ],
      escolha: "O protocolo mostra a faixa do Manual (1,5 a 3 g); a do MSD começa mais baixo.",
    },
  ],
  referencias: ["manual-21", "msd-hipercalemia"],
  relacionados: [
    { protocolo: "hipertermia-maligna", texto: "Hipertermia maligna" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
  ],
};

/* ---------------- Hipertermia maligna ---------------- */

export const HIPERTERMIA_MALIGNA: Protocolo = {
  id: "hipertermia-maligna",
  titulo: "Hipertermia maligna",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["HM", "crise de hipertermia maligna", "dantroleno", "dantrolene"],
  sinais: ["EtCO2 subindo", "espasmo de masseter", "trismo", "taquicardia", "arritmia", "rigidez", "temperatura subindo",
    "acidose", "potássio alto", "urina escura", "CK alta"],
  resumo: "Parar o halogenado, hiperventilar com fluxo alto e dar dantroleno 2,5 mg/kg até a crise passar; resfriar, tratar hipercalemia, acidose e arritmia; UTI.",
  reconhecer: [
    "Precoces: EtCO2 subindo apesar de ventilação adequada, espasmo de masseter, taquicardia, arritmia.",
    "Em seguida: acidose, temperatura subindo, instabilidade cardiovascular, hipercalemia.",
    "Tardios: urina escura (mioglobina), CK muito alta, coagulopatia, SpO2 caindo, parada cardíaca.",
    "Desencadeantes: halogenados e succinilcolina.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, a caixa de hipertermia maligna e o dantroleno; anotar a hora.",
      detalhe: "Preparar o dantroleno exige pessoas só para isso." },
    { texto: "Parar todo halogenado e tirar o vaporizador; terminar a cirurgia o quanto antes." },
    { texto: "Distribuir as tarefas (cartões da caixa, se houver)." },
    { texto: "Dantroleno 2,5 mg/kg IV, repetindo até a crise passar." },
    { texto: "Hiperventilar com O2 a 100% em fluxo alto (acima de 10 L/min).",
      detalhe: "Não perder tempo trocando o circuito: filtros de carvão ativado nos dois ramos, se houver." },
    { texto: "Manter a anestesia venosa total." },
    { texto: "Linha arterial; considerar cateter venoso central." },
    { texto: "Temperatura acima de 38,5 °C: resfriar ativamente.",
      detalhe: "Soro gelado na veia e em lavagem (vesical, gástrica, peritoneal), gelo e compressas frias, sala fria." },
    { texto: "Tratar hipercalemia, acidose e arritmia." },
    { texto: "Diurese acima de 2 mL/kg/h." },
    { texto: "Gasometria, eletrólitos e temperatura em série; preparar a UTI." },
  ],
  medicamentos: [
    {
      id: "dantroleno-hm", farmaco: "Dantroleno", indicacao: "Até a crise passar",
      populacao: "todas", via: "IV",
      dose: { usual: 2.5, unidade: "mg", por: "kg" }, apresentacoes: [DANTROLENO_20, DANTROLENO_RYANODEX],
      repeticao: "Repetir a cada 10 a 15 minutos até controlar. Cada dose do adulto pode exigir 8 a 10 frascos de 20 mg: pedir mais cedo.",
      cuidados: [
        "Cada frasco de 20 mg tem 3 g de manitol (a formulação de 250 mg, 125 mg).",
        "Com bloqueador de canal de cálcio: colapso cardiovascular com hipercalemia — não associar.",
      ],
      referencias: ["manual-22", "qrh-3-8"],
    },
    {
      id: "amiodarona-hm", farmaco: "Amiodarona", indicacao: "Arritmia",
      populacao: "adulto", via: "IV",
      dose: { min: 3, max: 4, unidade: "mg", por: "kg" }, apresentacoes: [AMIODARONA_50],
      velocidade: "Lento.",
      referencias: ["manual-22"],
    },
    {
      id: "lidocaina-hm", farmaco: "Lidocaína", indicacao: "Arritmia",
      populacao: "adulto", via: "IV",
      dose: { min: 1, max: 2, unidade: "mg", por: "kg" }, apresentacoes: [LIDOCAINA_20],
      referencias: ["manual-22"],
    },
    {
      id: "metoprolol-hm", farmaco: "Metoprolol", indicacao: "Arritmia, se preciso",
      populacao: "adulto", via: "IV",
      dose: { min: 1, max: 2, unidade: "mg", por: "fixa" }, apresentacoes: [METOPROLOL_1],
      referencias: ["manual-22"],
    },
  ],
  volumes: [
    { id: "lavagem-gelada-hm", rotulo: "Soro gelado", indicacao: "Bolus para lavagem vesical, gástrica ou peritoneal",
      populacao: "todas", porKg: { min: 10 }, referencias: ["qrh-3-8"] },
  ],
  pensarEm: [
    "EtCO2 alto de outra causa: hipoventilação, cal sodada esgotada, insuflação de CO2.",
    "Sepse, crise tireotóxica, feocromocitoma, síndrome neuroléptica maligna.",
    "Hipertermia por aquecimento excessivo.",
  ],
  depois: [
    "UTI por pelo menos 24 horas: a crise pode voltar.",
    "Exames: hemograma, eletrólitos, gasometria, CK, coagulação e mioglobina.",
    "Encaminhar o paciente e a família para investigação da suscetibilidade.",
    "Marcar no prontuário e na pulseira: evitar halogenados e succinilcolina.",
    "Registrar na ficha os horários, as doses de dantroleno, as temperaturas e os exames.",
  ],
  divergencias: [
    {
      tema: "Repetição do dantroleno",
      posicoes: [
        { texto: "2,5 mg/kg, repetindo a cada 10 a 15 minutos até a crise passar.", referencia: "manual-22" },
        { texto: "2,5 mg/kg; depois 1 mg/kg a cada 10 a 15 minutos, até 10 mg/kg.", referencia: "qrh-3-8" },
      ],
      escolha: "O protocolo mostra a dose inicial de 2,5 mg/kg; o revisor decide o tamanho da repetição.",
    },
    {
      tema: "Troca do circuito",
      posicoes: [
        { texto: "Não perder tempo trocando o circuito: filtros de carvão ativado nos dois ramos (as diretrizes do Reino Unido mandam trocar).", referencia: "manual-22" },
        { texto: "Trocar o circuito não é prioridade.", referencia: "qrh-3-8" },
      ],
      escolha: "Sem conflito real: o protocolo não manda trocar e cita os filtros.",
    },
    {
      tema: "Meta de diurese",
      posicoes: [
        { texto: "“> 2 mL/min” na frente do cartão e “> 2 mL/kg/h” no verso.", referencia: "manual-22" },
      ],
      escolha: "O protocolo usa 2 mL/kg/h; o revisor confirma.",
    },
  ],
  referencias: ["manual-22", "qrh-3-8"],
  relacionados: [
    { protocolo: "hipercalemia", texto: "Hipercalemia" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
  ],
};
