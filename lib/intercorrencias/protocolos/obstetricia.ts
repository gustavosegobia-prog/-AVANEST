/**
 * OBSTETRÍCIA — bloqueio raquidiano alto ou total, hemorragia pós-parto e
 * colapso materno.
 *
 * Sequência e doses do Manual de Crises (protocolos 16, 17 e 18, lidos no
 * livro), conferidas com o QRH 3-11 da Association of Anaesthetists, as
 * recomendações da OPAS para hemorragia obstétrica (2018) e o Manual de
 * Gestação de Alto Risco do Ministério da Saúde (2022) — todos abertos e
 * lidos. Onde diferem, as posições ficam em `divergencias`. O texto é do
 * AVANEST.
 */

import type { ApresentacaoDoProtocolo, Protocolo } from "../tipos.ts";
import {
  ADRENALINA_10, ADRENALINA_100, ATROPINA_025, ATROPINA_05, EFEDRINA_5, FENILEFRINA_100, GLUCONATO_DE_CALCIO_10,
  MAGNESIO_50, METARAMINOL_05, QUATRO_H_QUATRO_T, TRANEXAMICO_50, VASOPRESSINA_1,
} from "./comum.ts";

const OCITOCINA_1: ApresentacaoDoProtocolo = {
  rotulo: "10 UI (2 ampolas) em 10 mL — 1 UI/mL", quantidade: 1, unidade: "UI", mL: 1, vias: ["IV"],
};
const OCITOCINA_5: ApresentacaoDoProtocolo = { rotulo: "Ampola de 5 UI em 1 mL", quantidade: 5, unidade: "UI", mL: 1, vias: ["IV", "IM"] };
const OCITOCINA_SORO_20: ApresentacaoDoProtocolo = {
  rotulo: "20 UI em 500 mL — 0,04 UI/mL", quantidade: 0.04, unidade: "UI", mL: 1, vias: ["IV"],
  preparo: "4 ampolas (20 UI) em 500 mL de SF 0,9%",
};
const OCITOCINA_SORO_40: ApresentacaoDoProtocolo = {
  rotulo: "40 UI em 500 mL — 0,08 UI/mL", quantidade: 0.08, unidade: "UI", mL: 1, vias: ["IV"],
  preparo: "8 ampolas (40 UI) em 500 mL de SF 0,9%",
};
const METILERGOMETRINA_02: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 0,2 mg em 1 mL", quantidade: 0.2, unidade: "mg", mL: 1, vias: ["IM", "IV"],
};
const CARBOPROSTA_250: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 250 mcg em 1 mL", quantidade: 250, unidade: "mcg", mL: 1, vias: ["IM", "Intramiometrial"],
};
/** O ataque do Ministério da Saúde: 8 mL do sulfato a 50% + 12 mL de água destilada. */
const MAGNESIO_ATAQUE_20: ApresentacaoDoProtocolo = {
  rotulo: "4 g em 20 mL — 200 mg/mL", quantidade: 200, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "8 mL de sulfato de magnésio a 50% + 12 mL de água destilada",
};
/** A manutenção do Ministério da Saúde: 10 mL a 50% + 240 mL de SF; 1 g/h = 50 mL/h. */
const MAGNESIO_MANUTENCAO_20: ApresentacaoDoProtocolo = {
  rotulo: "5 g em 250 mL — 20 mg/mL", quantidade: 20, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "10 mL de sulfato de magnésio a 50% + 240 mL de SF 0,9%",
};

const DESLOCAR_UTERO = "Deslocar o útero para a esquerda com a mão: a inclinação lateral da mesa não é mais recomendada.";
const PARTO_4_MIN = "Gestação acima de 20 a 24 semanas e sem retorno da circulação: cesárea perimortem a partir do 4º minuto de RCP, na própria sala.";

export const RAQUI_TOTAL: Protocolo = {
  id: "bloqueio-neuroaxial-alto",
  titulo: "Bloqueio raquidiano alto ou total",
  categoria: "obstetricia",
  populacoes: ["adulto", "gestante"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["raqui total", "raqui alta", "bloqueio neuroaxial alto", "peridural total", "injeção subaracnóidea acidental"],
  sinais: ["hipotensão", "bradicardia", "dispneia", "não consegue falar", "mãos dormentes", "fraqueza nos braços", "apneia",
    "perda da consciência", "depois da raqui", "depois da peridural"],
  resumo: "Bloqueio que sobe rápido depois da raqui ou da peridural: O2, volume, vasopressor, atropina, via aérea e, na gestante, útero deslocado e parto se parar.",
  reconhecer: [
    "Parestesia e fraqueza que sobem rápido depois da raqui ou da peridural: mãos, braços, dificuldade para respirar e falar.",
    "Hipotensão e bradicardia primeiro; depois insuficiência respiratória, apneia e perda da consciência.",
    "A paciente pode estar paralisada e acordada: fale com ela e planeje a hipnose assim que der.",
    "Sem ter visto o bloqueio subir, ou na dúvida do diagnóstico: siga o colapso materno.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, avisar a equipe e dividir as funções.",
      detalhe: "Vasopressor, volume e ventilação ao mesmo tempo, não um depois do outro." },
    { texto: "Tranquilizar a paciente acordada enquanto age." },
    { texto: "O2 a 100% e ventilação assistida com delicadeza, se preciso." },
    { texto: "Consciência piorando: proteger a via aérea.",
      detalhe: "Na gestante, intubar (refluxo; pressão cricoide recomendada pelo Manual). Inconsciente e paralisada: intubar com dose reduzida de hipnótico, ou só com relaxante." },
    { texto: "Elevar as pernas e infundir volume rápido.", detalhe: "Não colocar a cabeça para baixo." },
    { texto: DESLOCAR_UTERO, so: ["gestante"] },
    { texto: "Vasopressor em bolus para manter a pressão." },
    { texto: "Bradicardia: atropina; adrenalina se não responder." },
    { texto: "Sem pulso: RCP, adrenalina 1 mg e o protocolo de AESP.",
      detalhe: "Seguir com a RCP até a resposta a volume e vasopressor." },
    { texto: PARTO_4_MIN, so: ["gestante"] },
    { texto: "UTI para ventilação e suporte até o bloqueio regredir." },
  ],
  medicamentos: [
    {
      id: "atropina-raqui", farmaco: "Atropina", indicacao: "Bradicardia",
      populacao: "adulto", via: "IV",
      dose: { min: 0.6, max: 1.2, unidade: "mg", por: "fixa" }, apresentacoes: [ATROPINA_05, ATROPINA_025],
      referencias: ["manual-16", "qrh-3-11"],
    },
    {
      id: "efedrina-raqui", farmaco: "Efedrina", indicacao: "Hipotensão — bolus",
      populacao: "adulto", via: "IV",
      dose: { min: 6, max: 12, unidade: "mg", por: "fixa" }, apresentacoes: [EFEDRINA_5],
      repeticao: "Repetir até 30 mg; perde efeito com doses repetidas (taquifilaxia).",
      referencias: ["qrh-3-11", "manual-16"],
    },
    {
      id: "fenilefrina-raqui", farmaco: "Fenilefrina", indicacao: "Hipotensão — bolus",
      populacao: "adulto", via: "IV",
      dose: { min: 50, max: 100, unidade: "mcg", por: "fixa" }, apresentacoes: [FENILEFRINA_100],
      repeticao: "Repetir ou passar para infusão.",
      referencias: ["manual-16", "qrh-3-11"],
    },
    {
      id: "metaraminol-raqui", farmaco: "Metaraminol", indicacao: "Hipotensão — bolus",
      populacao: "adulto", via: "IV",
      dose: { min: 1, max: 2, unidade: "mg", por: "fixa" }, apresentacoes: [METARAMINOL_05],
      repeticao: "Repetir conforme a pressão.",
      referencias: ["qrh-3-11"],
    },
    {
      id: "adrenalina-raqui", farmaco: "Adrenalina", indicacao: "Hipotensão ou bradicardia sem resposta",
      populacao: "adulto", via: "IV",
      dose: { min: 25, max: 50, unidade: "mcg", por: "fixa" }, apresentacoes: [ADRENALINA_10, ADRENALINA_100], altoRisco: true,
      referencias: ["manual-16"],
    },
  ],
  volumes: [],
  pensarEm: [
    "Reação vasovagal.",
    "Hemorragia.",
    "Toxicidade sistêmica por anestésico local (injeção intravascular).",
    "Compressão aortocava pelo útero.",
    "Embolia (trombo, ar, líquido amniótico).",
  ],
  depois: [
    "UTI até o bloqueio regredir e a função voltar.",
    "Conversar com a paciente: pode ter ficado acordada e paralisada.",
    "Registrar na ficha a técnica, o anestésico e a dose, o nível alcançado, as condutas e os horários.",
  ],
  divergencias: [
    {
      tema: "Bolus de efedrina",
      posicoes: [
        { texto: "12 a 15 mg.", referencia: "manual-16" },
        { texto: "6 a 12 mg, repetidos até 30 mg.", referencia: "qrh-3-11" },
      ],
      escolha: "O protocolo calcula 6 a 12 mg, menor e repetível, com o total de 30 mg do QRH. O revisor decide.",
    },
  ],
  referencias: ["manual-16", "qrh-3-11"],
  relacionados: [
    { protocolo: "colapso-materno", texto: "Colapso materno" },
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "toxicidade-anestesico-local", texto: "Toxicidade por anestésico local" },
  ],
};

export const HEMORRAGIA_POS_PARTO: Protocolo = {
  id: "hemorragia-pos-parto",
  titulo: "Hemorragia pós-parto",
  categoria: "obstetricia",
  populacoes: ["gestante"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["HPP", "atonia uterina", "hemorragia puerperal", "hemorragia obstétrica"],
  sinais: ["sangramento", "útero amolecido", "atonia", "PA caindo", "taquicardia", "depois do parto", "cesárea"],
  resumo: "Ajuda, O2, dois acessos, massagem uterina, uterotônicos e ácido tranexâmico cedo; banco de sangue e transfusão maciça; vasopressor só para a perfusão; controle cirúrgico.",
  reconhecer: [
    "HPP grave: perda acima de 1.000 mL com choque ou sangramento que continua.",
    "A perda costuma ser subestimada; a coagulopatia pode ser desproporcional ao sangramento.",
    "As causas: tônus (atonia), trauma do trato genital, tecido (restos placentários), trombina (coagulopatia).",
    "Marque “gestante” nos dados da paciente para ver as doses certas (a puérpera também).",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, avisar a equipe e dividir as funções." },
    { texto: "O2 a 100%." },
    { texto: "Dois acessos venosos calibrosos." },
    { texto: "Massagem uterina ou compressão bimanual." },
    { texto: "Uterotônicos para a atonia, e ácido tranexâmico assim que se diagnosticar a hemorragia.",
      detalhe: "Ocitocina primeiro; sem resposta, não atrasar o de segunda linha." },
    { texto: "Cristaloide aquecido até chegar o sangue, sem excesso." },
    { texto: "Banco de sangue: prova cruzada e protocolo de transfusão maciça, se indicado.",
      detalhe: "Sem tempo: sangue do grupo específico ou O negativo." },
    { texto: "Avisar o centro cirúrgico para levar a paciente na hora, se preciso." },
    { texto: "Vasopressor só para manter a perfusão dos órgãos." },
    { texto: "Controle cirúrgico: anestesia geral em sequência rápida.",
      detalhe: "Balão de tamponamento, sutura compressiva, ligadura ou embolização (artérias uterinas ou ilíacas), histerectomia." },
    { texto: "Seguir o protocolo de hemorragia maciça.", detalhe: "Fibrinogênio acima de 2 g/L na obstetrícia." },
  ],
  medicamentos: [
    {
      id: "ocitocina-hpp", farmaco: "Ocitocina", indicacao: "Atonia — bolus",
      populacao: "adulto", via: "IV",
      dose: { usual: 5, unidade: "UI", por: "fixa" }, apresentacoes: [OCITOCINA_1, OCITOCINA_5],
      velocidade: "Lento, em 3 minutos: bolus rápido derruba a pressão.",
      referencias: ["manual-17", "opas-2018-hpp"],
    },
    {
      id: "ocitocina-infusao-hpp", farmaco: "Ocitocina", indicacao: "Atonia — infusão depois do bolus",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { usual: 10, unidade: "UI", por: "h" }, apresentacoes: [OCITOCINA_SORO_20, OCITOCINA_SORO_40],
      cuidados: ["Infusão longa: risco de intoxicação hídrica."],
      referencias: ["manual-17", "opas-2018-hpp"],
    },
    {
      id: "metilergometrina-hpp", farmaco: "Metilergometrina", indicacao: "Atonia — segunda linha",
      populacao: "adulto", via: "IM",
      dose: { usual: 0.2, unidade: "mg", por: "fixa" }, apresentacoes: [METILERGOMETRINA_02],
      repeticao: "Repetir em 20 minutos, se preciso; sangramento grave: mais 3 doses a cada 4 horas. Máximo de 1 mg em 24 horas.",
      cuidados: ["Contraindicada na hipertensão e na pré-eclâmpsia.", "Se a primeira dose falhar, a segunda raramente funciona."],
      referencias: ["opas-2018-hpp"],
    },
    {
      id: "misoprostol-hpp", farmaco: "Misoprostol", indicacao: "Atonia — segunda linha",
      populacao: "adulto", via: "Retal ou oral",
      dose: { usual: 800, unidade: "mcg", por: "fixa" }, apresentacoes: [],
      semVolume: "Em comprimidos: confira a dosagem do comprimido disponível (200 mcg = 4 comprimidos).",
      cuidados: ["Começa a agir em 15 a 20 minutos pela via retal e em 7 a 11 pela oral."],
      referencias: ["opas-2018-hpp", "manual-17"],
    },
    {
      id: "carboprosta-hpp", farmaco: "Carboprosta", indicacao: "Atonia — se disponível no serviço",
      populacao: "adulto", via: "IM ou intramiometrial",
      dose: { usual: 250, unidade: "mcg", por: "fixa" }, apresentacoes: [CARBOPROSTA_250],
      repeticao: "A cada 15 minutos, até 8 doses.",
      cuidados: ["Pode causar broncoespasmo: cuidado na asma.", "Confira se está disponível no serviço."],
      referencias: ["manual-17"],
    },
    {
      id: "tranexamico-hpp", farmaco: "Ácido tranexâmico", indicacao: "Assim que se diagnosticar a hemorragia",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [TRANEXAMICO_50],
      velocidade: "Em 10 minutos.",
      repeticao: "Repetir se o sangramento continuar 30 minutos depois, ou voltar em até 24 horas.",
      referencias: ["opas-2018-hpp", "qrh-3-2"],
    },
    {
      id: "efedrina-hpp", farmaco: "Efedrina", indicacao: "Só para a perfusão dos órgãos",
      populacao: "adulto", via: "IV",
      dose: { min: 6, max: 12, unidade: "mg", por: "fixa" }, apresentacoes: [EFEDRINA_5],
      referencias: ["manual-17"],
    },
    {
      id: "metaraminol-hpp", farmaco: "Metaraminol", indicacao: "Só para a perfusão dos órgãos",
      populacao: "adulto", via: "IV",
      dose: { min: 0.5, max: 1, unidade: "mg", por: "fixa" }, apresentacoes: [METARAMINOL_05],
      referencias: ["manual-17"],
    },
    {
      id: "fenilefrina-hpp", farmaco: "Fenilefrina", indicacao: "Só para a perfusão dos órgãos",
      populacao: "adulto", via: "IV",
      dose: { min: 25, max: 50, unidade: "mcg", por: "fixa" }, apresentacoes: [FENILEFRINA_100],
      referencias: ["manual-17"],
    },
    {
      id: "vasopressina-hpp", farmaco: "Vasopressina", indicacao: "Só para a perfusão dos órgãos",
      populacao: "adulto", via: "IV",
      dose: { min: 0.5, max: 1, unidade: "UI", por: "fixa" }, apresentacoes: [VASOPRESSINA_1],
      referencias: ["manual-17"],
    },
  ],
  volumes: [
    { id: "cristaloide-hpp", rotulo: "Cristaloide aquecido", grupo: "Volume e plasma", indicacao: "No máximo, enquanto espera o sangue",
      populacao: "adulto", fixo: { max: 3500 }, repeticao: "SF ou Ringer lactato; coloide não tem evidência.",
      referencias: ["manual-17"] },
    { id: "pfc-hpp", rotulo: "Plasma fresco congelado", grupo: "Volume e plasma", indicacao: "Cedo, para evitar a falha da hemostasia",
      populacao: "adulto", porKg: { min: 15 }, repeticao: "Depois, pelos exames de coagulação ou TEG/ROTEM.",
      referencias: ["manual-17"] },
  ],
  pensarEm: [
    "Tônus: atonia uterina, a causa mais comum.",
    "Trauma: laceração do colo, da vagina ou do períneo; rotura uterina.",
    "Tecido: restos placentários, acretismo.",
    "Trombina: coagulopatia, anticoagulante, embolia amniótica.",
  ],
  depois: [
    "UTI conforme a perda, os hemocomponentes e a estabilidade.",
    "Exames em série: hemoglobina, coagulação, fibrinogênio, cálcio e lactato.",
    "Registrar na ficha a perda estimada, os uterotônicos e os horários, os hemocomponentes (número da bolsa) e as condutas.",
    "Conversar com a paciente e a família.",
  ],
  divergencias: [
    {
      tema: "Uterotônico derivado do ergot",
      posicoes: [
        { texto: "“Ergotamina” 500 mcg IM ou EV lento; ou 250 mcg IM ou EV em 5 minutos, até 1 mg.", referencia: "manual-17" },
        { texto: "Metilergometrina 0,2 mg IM, repetir em 20 minutos; até 1 mg em 24 horas.", referencia: "opas-2018-hpp" },
      ],
      escolha: "A dose do Manual é a da ergometrina (o nome na tradução parece trocado — ergotamina é outro fármaco). O protocolo usa a metilergometrina, que é a disponível no Brasil, na dose da OPAS. O revisor confirma.",
    },
    {
      tema: "Infusão de ocitocina",
      posicoes: [
        { texto: "Bolus de 5 UI e infusão de 10 UI por hora.", referencia: "manual-17" },
        { texto: "Bolus de 5 UI em 3 minutos e 20 a 40 UI em 500 mL a 250 mL/h; manutenção a 125 mL/h por 4 horas.", referencia: "opas-2018-hpp" },
      ],
      escolha: "O protocolo calcula 10 UI/h nas duas soluções da OPAS (250 mL/h na de 20 UI; 125 mL/h na de 40 UI).",
    },
    {
      tema: "Volume de cristaloide",
      posicoes: [
        { texto: "Cristaloide aquecido até 3,5 litros enquanto espera o sangue.", referencia: "manual-17" },
        { texto: "Uso racional: sem cargas predeterminadas de cristaloide nem a regra de 3:1.", referencia: "opas-2018-hpp" },
      ],
      escolha: "Os 3,5 litros aparecem como teto, não como meta.",
    },
    {
      tema: "Dose de misoprostol",
      posicoes: [
        { texto: "400 a 1.000 mcg retal ou sublingual.", referencia: "manual-17" },
        { texto: "800 mcg retal ou oral.", referencia: "opas-2018-hpp" },
      ],
      escolha: "O protocolo mostra 800 mcg (OPAS), dentro da faixa do Manual.",
    },
  ],
  referencias: ["manual-17", "opas-2018-hpp", "qrh-3-2", "manual-05"],
  relacionados: [
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "colapso-materno", texto: "Colapso materno" },
  ],
};

export const COLAPSO_MATERNO: Protocolo = {
  id: "colapso-materno",
  titulo: "Colapso materno e PCR na gestante",
  categoria: "obstetricia",
  populacoes: ["gestante"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["colapso materno", "PCR na gestante", "parada na gestante", "cesárea perimortem", "eclâmpsia", "convulsão na gestante"],
  sinais: ["inconsciente", "sem pulso", "convulsão", "hipotensão", "dessaturação", "gestante", "parada"],
  resumo: "Útero para a esquerda, intubação precoce e parto aos 4 minutos de RCP sem retorno; procurar as causas da gravidez; magnésio na eclâmpsia.",
  reconhecer: [
    "Gestante ou puérpera que perde a consciência, a respiração ou o pulso.",
    "Na gestante a reanimação muda: útero deslocado, intubação precoce (reduz a broncoaspiração) e parto precoce.",
    "Causas comuns, em que o parto é menos provável: vasovagal, bloqueio alto, toxicidade por anestésico local, hemorragia, superdose de fármacos, hipoglicemia, doença hipertensiva da gravidez.",
    "Causas incomuns, em que o parto é mais provável: embolia pulmonar, rotura uterina, embolia amniótica, evento cardíaco, evento cerebral, anafilaxia.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda e dividir as funções.",
      detalhe: "Muitas mãos: via aérea, compressões, deslocamento do útero, acesso venoso, tempo e registro." },
    { texto: "Avaliar consciência, respiração e circulação." },
    { texto: "Sem pulso: RCP, " + DESLOCAR_UTERO.charAt(0).toLowerCase() + DESLOCAR_UTERO.slice(1),
      detalhe: "Preparar o parto já: kit de cesárea perimortem no carrinho." },
    { texto: "Monitor: confirmar o ritmo e seguir o protocolo de PCR (chocável ou não)." },
    { texto: "Intubar cedo e ventilar com O2 a 100%." },
    { texto: "Dois acessos venosos calibrosos." },
    { texto: "Rever os 4 H e 4 T, começando pelas causas da gravidez, e tratar logo o que for reversível." },
    { texto: PARTO_4_MIN,
      detalhe: "O médico mais experiente faz a cesárea, com a incisão que permite o nascimento mais rápido." },
    { texto: "Eclâmpsia: sulfato de magnésio, com a paciente em decúbito lateral esquerdo." },
    { texto: "Informar e apoiar a equipe." },
  ],
  medicamentos: [
    {
      id: "magnesio-ataque-eclampsia", farmaco: "Sulfato de magnésio", indicacao: "Eclâmpsia — ataque",
      populacao: "adulto", via: "IV",
      dose: { usual: 4, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_ATAQUE_20, MAGNESIO_50],
      velocidade: "Em 5 a 15 minutos.",
      cuidados: ["Antídoto da intoxicação: gluconato de cálcio.", "Insuficiência renal: metade da dose e dosar o magnésio."],
      referencias: ["manual-18", "ms-2022-alto-risco"],
    },
    {
      id: "magnesio-manutencao-eclampsia", farmaco: "Sulfato de magnésio", indicacao: "Eclâmpsia — manutenção",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 1, max: 2, unidade: "g", por: "h" }, apresentacoes: [MAGNESIO_MANUTENCAO_20],
      repeticao: "Por 24 horas depois do parto ou da última convulsão.",
      cuidados: ["Suspender com frequência respiratória baixa, reflexo patelar abolido ou diurese baixa."],
      referencias: ["manual-18", "ms-2022-alto-risco"],
    },
    {
      id: "magnesio-nova-convulsao", farmaco: "Sulfato de magnésio", indicacao: "Nova convulsão",
      populacao: "adulto", via: "IV",
      dose: { usual: 2, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_ATAQUE_20, MAGNESIO_50],
      repeticao: "Se dois bolus não controlarem, outro anticonvulsivante (diazepam, lorazepam ou midazolam).",
      referencias: ["manual-18", "ms-2022-alto-risco"],
    },
    {
      id: "gluconato-intoxicacao-magnesio", farmaco: "Gluconato de cálcio", indicacao: "Intoxicação por magnésio (depressão respiratória)",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      velocidade: "Lento.",
      referencias: ["ms-2022-alto-risco"],
    },
  ],
  volumes: [],
  pensarEm: [
    ...QUATRO_H_QUATRO_T,
    "Da gravidez: hemorragia, doença hipertensiva (eclâmpsia, HELLP), embolia amniótica, rotura uterina, cardiomiopatia periparto.",
    "Da anestesia: bloqueio alto, toxicidade por anestésico local, via aérea difícil, broncoaspiração.",
    "Hipoglicemia e superdose de fármacos.",
  ],
  depois: [
    "UTI para a mãe; equipe neonatal para o bebê.",
    "Registrar na ficha os horários: parada, cada dose, nascimento e retorno da circulação.",
    "A reanimação materna é traumática para todos: reunião da equipe e apoio profissional.",
    "Treinar a reanimação materna com a equipe regularmente.",
  ],
  divergencias: [
    {
      tema: "Idade gestacional para a cesárea perimortem",
      posicoes: [
        { texto: "Gestação acima de 24 semanas e sem retorno da circulação: parto depois de 4 minutos.", referencia: "manual-18" },
        { texto: "Útero na altura da cicatriz umbilical ou acima (cerca de 20 semanas): cesárea perimortem se não houver retorno em 4 minutos.", referencia: "aha-2020-adulto" },
      ],
      escolha: "O protocolo escreve “acima de 20 a 24 semanas”: o revisor define o corte.",
    },
    {
      tema: "Sulfato de magnésio",
      posicoes: [
        { texto: "Ataque de 4 g em 15 minutos; 1 g/h por 24 horas; 2 g se as convulsões persistirem.", referencia: "manual-18" },
        { texto: "Ataque de 4 g em 5 a 10 minutos; manutenção de 1 a 2 g/h; nova convulsão, mais 2 g.", referencia: "ms-2022-alto-risco" },
      ],
      escolha: "Ataque em 5 a 15 minutos e manutenção de 1 a 2 g/h, com as diluições do Ministério da Saúde (1 g/h = 50 mL/h).",
    },
  ],
  referencias: ["manual-18", "ms-2022-alto-risco", "aha-2020-adulto"],
  relacionados: [
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "hemorragia-pos-parto", texto: "Hemorragia pós-parto" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto ou total" },
    { protocolo: "toxicidade-anestesico-local", texto: "Toxicidade por anestésico local" },
    { protocolo: "reanimacao-neonatal", texto: "Reanimação neonatal" },
  ],
};
