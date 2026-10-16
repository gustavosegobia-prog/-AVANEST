/**
 * OUTRAS EMERGÊNCIAS — cartões 01 a 07 da minuta preliminar “Protocolos de
 * crise” (outubro de 2026): hipoglicemia grave, hipotermia perioperatória,
 * crise adrenal, convulsão perioperatória, incêndio na sala, falha de
 * oxigênio, energia ou aparelho e delírio grave ao despertar.
 *
 * Versão 2: revisão científica de 16/10/2026, com cada número conferido no
 * texto da fonte citada ao lado (JBDS 2023, ISPAD 2022, PES 2015, ADA 2026,
 * NICE CG65, WMS 2019, Society for Endocrinology 2016, BSPED 2023, Surviving
 * Sepsis 2021, AES 2016, ASA 2013, QRH, ESAIC 2024). O Tratado SAESP e o
 * livro de Medicina Intensiva da USP não estavam acessíveis na revisão: nada
 * aqui é atribuído a eles. Sem aprovação registrada, o cartão só aparece na
 * prévia do responsável médico. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { DIAZEPAM_5, GLICOSE_10, LEVETIRACETAM_100, MIDAZOLAM_5_IM } from "./comum.ts";

const REVISAO = "2026-10-16";

export const HIPOGLICEMIA: Protocolo = {
  id: "hipoglicemia-grave",
  titulo: "Hipoglicemia grave",
  categoria: "outras",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["glicose baixa", "glicemia baixa", "hipoglicemia", "neuroglicopenia"],
  sinais: ["glicemia baixa", "rebaixamento", "confusão", "convulsão", "sudorese", "taquicardia", "despertar demorado", "insulina", "sulfonilureia"],
  resumo: "Glicemia baixa com alteração neurológica, ou sob anestesia: glicose 10% IV (adulto 20 g; criança e recém-nascido 0,2 g/kg), nova glicemia em 10 a 15 minutos e oferta contínua de glicose.",
  reconhecer: [
    "Hipoglicemia: abaixo de 70 mg/dL; abaixo de 54 mg/dL é clinicamente importante.",
    "Grave: alteração neurológica (confusão, rebaixamento, convulsão) ou necessidade de ajuda para tratar.",
    "Sob anestesia, sedação ou betabloqueio, sudorese e taquicardia podem faltar: medir no despertar demorado, na convulsão e no paciente de risco.",
    "Recém-nascido: manter acima de 50 mg/dL nas primeiras 48 horas e acima de 60 mg/dL depois.",
  ],
  agirAgora: [
    { texto: "Glicemia capilar agora; confirmar no laboratório sem atrasar o tratamento." },
    { texto: "Suspender a insulina em curso e rever hipoglicemiantes.", detalhe: "Infusão de insulina: parar e só reiniciar depois de corrigir e rever a dose." },
    { texto: "Consciente, deglute e pode comer: 15 a 20 g de carboidrato rápido por via oral.", caminho: "A. Consciência preservada" },
    { texto: "Nova glicemia em 15 minutos; repetir até ficar acima de 70 mg/dL.", caminho: "A. Consciência preservada" },
    { texto: "Via aérea, ventilação e circulação.", caminho: "B. Alteração neurológica, jejum ou anestesia" },
    { texto: "Glicose 10% IV.", detalhe: "Adulto: 200 mL em 15 minutos. Criança e recém-nascido: 2 mL/kg.", caminho: "B. Alteração neurológica, jejum ou anestesia" },
    { texto: "Sem acesso venoso: glucagon IM e insistir no acesso.", detalhe: "Glucagon rende pouco com sulfonilureia, jejum longo, desnutrição, álcool ou hepatopatia: nesses casos, glicose IV.", caminho: "B. Alteração neurológica, jejum ou anestesia" },
    { texto: "Nova glicemia em 10 a 15 minutos; abaixo de 70 mg/dL, repetir a glicose.", caminho: "B. Alteração neurológica, jejum ou anestesia" },
    { texto: "Corrigida: manter glicose 10% em infusão enquanto em jejum, ou alimentar.", caminho: "B. Alteração neurológica, jejum ou anestesia" },
  ],
  medicamentos: [
    {
      id: "glicose-hipo-adulto", farmaco: "Glicose 10%", indicacao: "Hipoglicemia grave ou paciente anestesiado", populacao: "adulto", via: "IV",
      dose: { usual: 20, unidade: "g", por: "fixa" }, apresentacoes: [GLICOSE_10],
      velocidade: "Em 15 minutos (800 mL/h); em bomba, conferir o volume programado para não infundir a bolsa inteira.",
      repeticao: "Glicemia em 10 minutos; abaixo de 70 mg/dL, repetir.",
      cuidados: [
        "Glicose 50% é desaconselhada em veia periférica: hiperosmolar e lesiva no extravasamento.",
        "Insuficiência renal ou cardíaca: o menor volume possível.",
      ],
      par: "glicose-hipo-ped",
      referencias: ["jbds-2023-hipoglicemia"],
    },
    {
      id: "glicose-hipo-ped", farmaco: "Glicose 10%", indicacao: "Hipoglicemia grave", populacao: "pediatrico", idadeAnos: { min: 1 / 12 },
      via: "IV ou IO",
      dose: { usual: 0.2, unidade: "g", por: "kg" }, apresentacoes: [GLICOSE_10],
      velocidade: "Em alguns minutos, por pessoa treinada.",
      repeticao: "Glicemia em 10 a 15 minutos; repetir se baixa. Máximo de 0,5 g/kg (5 mL/kg) por vez.",
      cuidados: ["Veia periférica: no máximo glicose 25%; glicose 50% traz risco de lesão osmótica cerebral."],
      par: "glicose-hipo-adulto",
      referencias: ["ispad-2022-hipoglicemia"],
    },
    {
      id: "glicose-hipo-rn", farmaco: "Glicose 10%", indicacao: "Recém-nascido com hipoglicemia sintomática grave", populacao: "pediatrico",
      idadeAnos: { max: 1 / 12 }, via: "IV",
      dose: { usual: 0.2, unidade: "g", por: "kg" }, apresentacoes: [GLICOSE_10],
      repeticao: "Seguir com glicose 10% em infusão na taxa de manutenção para a idade.",
      referencias: ["pes-2015-hipoglicemia"],
    },
    {
      id: "glucagon-hipo-menor-25", farmaco: "Glucagon", indicacao: "Sem acesso venoso — criança abaixo de 25 kg", populacao: "pediatrico",
      faixaDePeso: { abaixoDe: 25 }, via: "IM ou SC",
      dose: { usual: 0.5, unidade: "mg", por: "fixa" }, apresentacoes: [],
      semVolume: "Frasco de 1 mg reconstituído a 1 mg/mL: conferir a apresentação",
      cuidados: ["A partir de 25 kg: 1 mg."],
      referencias: ["ispad-2022-hipoglicemia"],
    },
    {
      id: "glucagon-hipo-adulto", farmaco: "Glucagon", indicacao: "Sem acesso venoso — adulto ou criança a partir de 25 kg", populacao: "todas",
      faixaDePeso: { aPartirDe: 25 }, via: "IM",
      dose: { usual: 1, unidade: "mg", por: "fixa" }, apresentacoes: [],
      semVolume: "Frasco de 1 mg reconstituído a 1 mg/mL: conferir a apresentação",
      cuidados: ["Pode levar até 15 minutos para agir; náusea e vômito ao acordar."],
      referencias: ["jbds-2023-hipoglicemia", "ispad-2022-hipoglicemia"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Recorrência na criança: glicose 10% a 2–5 mg/kg/min (1,2–3 mL/kg/h).",
    "Sulfonilureia ou insulina de ação longa: o risco persiste por 24 a 36 horas depois da última dose.",
  ],
  pensarEm: [
    "Insulina (dose, infusão esquecida), sulfonilureia, jejum prolongado, insuficiência renal ou hepática, sepse, insuficiência adrenal, álcool e desnutrição.",
    "Recém-nascido asfixiado ou com restrição de crescimento.",
    "Convulsão ou rebaixamento sem hipoglicemia: outro protocolo.",
  ],
  depois: [
    "Glicemia seriada por 24 a 48 horas nos de risco; infusão de glicose enquanto em jejum.",
    "Sulfonilureia ou insulina de ação longa: observação prolongada.",
    "Rever o tratamento que causou o episódio e registrar a causa, as doses e a resposta.",
  ],
  divergencias: [
    {
      tema: "Dose de glicose IV no adulto",
      posicoes: [
        { texto: "20 g em 15 minutos: 200 mL de glicose 10% ou 100 mL de glicose 20%.", referencia: "jbds-2023-hipoglicemia" },
        { texto: "Algoritmo de convulsão: 50 mL de glicose 50% (com tiamina 100 mg) se glicemia abaixo de 60 mg/dL.", referencia: "aes-2016-estado-de-mal" },
      ],
      escolha: "O cartão usa glicose 10% (JBDS): mesma quantidade de glicose, sem a solução hiperosmolar na veia periférica. A versão anterior trazia 15–25 g sem fonte localizada.",
    },
  ],
  referencias: ["jbds-2023-hipoglicemia", "ada-2026-hospital", "ispad-2022-hipoglicemia", "pes-2015-hipoglicemia", "aes-2016-estado-de-mal"],
  relacionados: [
    { protocolo: "convulsao-perioperatoria", texto: "Convulsão perioperatória" },
    { protocolo: "crise-adrenal", texto: "Crise adrenal" },
  ],
};

export const HIPOTERMIA: Protocolo = {
  id: "hipotermia-perioperatoria",
  titulo: "Hipotermia perioperatória",
  categoria: "outras",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["temperatura baixa", "hipotermia", "paciente frio", "reaquecimento", "hipotermia acidental"],
  sinais: ["temperatura baixa", "tremor", "despertar demorado", "sangramento", "coagulopatia", "arritmia", "bloqueio prolongado", "FV"],
  resumo: "Perioperatória (abaixo de 36 °C): medir a temperatura central e aquecer com ar forçado, fluidos e hemocomponentes aquecidos. Acidental grave (abaixo de 28 °C ou instável): outro algoritmo — manuseio cuidadoso, ECLS e regras próprias de choque e fármacos.",
  reconhecer: [
    "Perioperatória inadvertida: temperatura central abaixo de 36,0 °C.",
    "Medir em local central: esôfago distal, bexiga, artéria pulmonar ou fluxo de calor zero; axila, boca e reto têm ressalvas; não usar termômetro infravermelho.",
    "Acidental (classificação suíça): HT I 35–32 °C, consciente e tremendo; HT II 32–28 °C, consciência alterada; HT III 28–24 °C, inconsciente; HT IV abaixo de 24 °C.",
    "Tremor, recuperação lenta, coagulopatia, arritmias e bloqueio neuromuscular prolongado. Abaixo de 28 °C, alto risco de FV.",
  ],
  agirAgora: [
    { texto: "Confirmar com temperatura central.", caminho: "A. Perioperatória inadvertida" },
    { texto: "Cobrir o que não está no campo; sala a pelo menos 21 °C enquanto exposto.", caminho: "A. Perioperatória inadvertida" },
    { texto: "Manta de ar forçado no máximo, ajustando para manter 36,5 °C ou mais.", caminho: "A. Perioperatória inadvertida" },
    { texto: "Aquecer a 37 °C todo fluido de 500 mL ou mais e todo hemocomponente, com aquecedor próprio; irrigação a 38–40 °C.", caminho: "A. Perioperatória inadvertida" },
    { texto: "Medir a cada 30 minutos; rever doses de anestésico e o bloqueio antes de extubar.", caminho: "A. Perioperatória inadvertida" },
    { texto: "Pedir ajuda; ECG e temperatura central contínuos; manter horizontal e mobilizar o mínimo.", detalhe: "Movimento brusco e extremidades frias podem desencadear FV.", caminho: "B. Acidental moderada ou grave" },
    { texto: "Ventilar sem hiperventilar (guiar pelo EtCO2); O2.", caminho: "B. Acidental moderada ou grave" },
    { texto: "Fluidos aquecidos a 40–42 °C, em bolus de 500 mL, sem sobrecarregar.", caminho: "B. Acidental moderada ou grave" },
    { texto: "Instável ou abaixo de 28 °C: hospital com UTI e ECLS (ECMO preferível).", caminho: "B. Acidental moderada ou grave" },
    { texto: "PCR: RCP; abaixo de 30 °C, um só choque e o próximo depois de 30 °C; vasoativo só a partir de 30 °C.", detalhe: "Potássio acima de 12 mmol/L no adulto encerra a RCP.", caminho: "B. Acidental moderada ou grave" },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Sem fármaco próprio: o tratamento é aquecer.",
    "PCR na hipotermia acidental: vasoativos só a partir de 30 °C; entre 30 e 35 °C, dose usual com o dobro do intervalo.",
    "O frio prolonga o efeito de anestésicos e bloqueadores neuromusculares: monitorar o bloqueio e titular as doses.",
    "Prevenir queimadura: nada quente direto na pele fria; inspecionar a pele aquecida a cada 20–30 minutos.",
  ],
  pensarEm: [
    "Exposição extensa, anestesia geral ou neuraxial, fluidos frios, cirurgia longa, hemorragia e hipotireoidismo.",
    "Trauma: hipotermia, acidose e coagulopatia agravam o sangramento.",
  ],
  depois: [
    "Recuperação: medir a cada 15 minutos; alta da sala só com 36,0 °C ou mais, mantendo o ar forçado.",
    "Conferir a recuperação respiratória e neuromuscular; vigiar arritmias e coagulação.",
    "Acidental grave: UTI, eletrólitos, glicemia e coagulação seriados; registrar a temperatura inicial e o método de reaquecimento.",
  ],
  divergencias: [],
  referencias: ["nice-cg65", "wms-2019-hipotermia"],
  relacionados: [
    { protocolo: "bloqueio-neuromuscular-residual", texto: "Bloqueio neuromuscular residual" },
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
  ],
};

export const CRISE_ADRENAL: Protocolo = {
  id: "crise-adrenal",
  titulo: "Crise adrenal",
  categoria: "outras",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["insuficiência adrenal", "insuficiência suprarrenal", "choque por corticoide", "hidrocortisona", "Addison"],
  sinais: ["hipotensão refratária", "choque", "corticoide", "vômitos", "hipoglicemia", "hiponatremia", "hipercalemia", "rebaixamento"],
  resumo: "Choque que não responde em quem tem, ou pode ter, insuficiência adrenal: hidrocortisona IV ou IM imediata, sem esperar o cortisol, SF 0,9% e correção da glicemia.",
  reconhecer: [
    "Hipotensão ou choque refratário, vômitos, dor abdominal, fraqueza, rebaixamento; hipoglicemia (sobretudo na criança), hiponatremia; hipercalemia na insuficiência primária.",
    "Suspeitar na insuficiência adrenal conhecida, no corticoide prolongado ou suspenso há pouco e em quem não recebeu a cobertura cirúrgica.",
    "Não é a cobertura perioperatória: essa é prevenção, no paciente estável que tem insuficiência adrenal.",
  ],
  agirAgora: [
    { texto: "Ajuda; via aérea, ventilação e circulação." },
    { texto: "Hidrocortisona agora, IV ou IM.", detalhe: "Caso novo: colher cortisol e eletrólitos antes, se não atrasar. O diagnóstico nunca atrasa o tratamento." },
    { texto: "SF 0,9%: adulto 1.000 mL na primeira hora; criança 10 mL/kg, repetindo se preciso." },
    { texto: "Glicemia; baixa, glicose IV." },
    { texto: "Sódio, potássio e glicemia seriados; procurar o desencadeante (infecção, cirurgia, sangramento, suspensão do corticoide)." },
    { texto: "Choque persistente depois da hidrocortisona e do volume: vasopressor e UTI." },
  ],
  medicamentos: [
    {
      id: "hidrocortisona-crise-adulto", farmaco: "Hidrocortisona", indicacao: "Dose inicial", populacao: "adulto", via: "IV ou IM",
      dose: { usual: 100, unidade: "mg", por: "fixa" }, apresentacoes: [], semVolume: "Conforme o frasco reconstituído",
      referencias: ["sfe-2016-crise-adrenal"],
    },
    {
      id: "hidrocortisona-crise-infusao", farmaco: "Hidrocortisona", indicacao: "Depois — infusão contínua", populacao: "adulto", via: "IV",
      dose: { usual: 200, unidade: "mg", por: "fixa" }, apresentacoes: [], semVolume: "Conforme o preparo do serviço",
      velocidade: "Em 24 horas.",
      referencias: ["sfe-2016-crise-adrenal"],
    },
    {
      id: "hidrocortisona-crise-6h", farmaco: "Hidrocortisona", indicacao: "Depois — alternativa em bolus", populacao: "adulto", via: "IV ou IM",
      dose: { usual: 50, unidade: "mg", por: "fixa" }, apresentacoes: [], semVolume: "Conforme o frasco reconstituído",
      repeticao: "A cada 6 horas.",
      referencias: ["sfe-2016-crise-adrenal"],
    },
    {
      id: "hidrocortisona-crise-ped", farmaco: "Hidrocortisona", indicacao: "Criança — dose inicial", populacao: "pediatrico", idadeAnos: { min: 1 / 12 },
      via: "IV ou IM",
      dose: { usual: 2, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 100, unidade: "mg" }, apresentacoes: [],
      semVolume: "Conforme o frasco reconstituído",
      repeticao: "A cada 6 horas; estável e melhorando, 1 mg/kg (máximo de 50 mg) a cada 6 horas.",
      cuidados: ["Sem peso: abaixo de 1 ano 25 mg; 1 a 5 anos 50 mg; 6 anos ou mais 100 mg."],
      par: "hidrocortisona-crise-adulto",
      referencias: ["bsped-2023-adrenal"],
    },
    {
      id: "hidrocortisona-crise-rn", farmaco: "Hidrocortisona", indicacao: "Recém-nascido — dose inicial", populacao: "pediatrico", idadeAnos: { max: 1 / 12 },
      via: "IV",
      dose: { usual: 4, unidade: "mg", por: "kg" }, apresentacoes: [], semVolume: "Conforme o frasco reconstituído",
      repeticao: "A cada 6 horas; estável, 2 mg/kg a cada 6 horas.",
      referencias: ["bsped-2023-adrenal"],
    },
    {
      id: "glicose-crise-adrenal-ped", farmaco: "Glicose 10%", indicacao: "Criança com glicemia abaixo de 54 mg/dL (3 mmol/L)", populacao: "pediatrico", via: "IV",
      dose: { usual: 0.2, unidade: "g", por: "kg" }, apresentacoes: [GLICOSE_10],
      repeticao: "Glicemia em 15 minutos; repetir se preciso.",
      referencias: ["bsped-2023-adrenal"],
    },
  ],
  volumes: [
    { id: "sf-crise-adrenal-adulto", rotulo: "SF 0,9%", indicacao: "Na primeira hora; depois, em geral 4 a 6 L em 24 horas, com cuidado no renal e no idoso",
      populacao: "adulto", fixo: { min: 1000 }, referencias: ["sfe-2016-crise-adrenal"] },
    { id: "sf-crise-adrenal-ped", rotulo: "SF 0,9%", indicacao: "Choque ou desidratação; repetir se preciso",
      populacao: "pediatrico", porKg: { min: 10 }, referencias: ["bsped-2023-adrenal"] },
  ],
  notasDeDose: [
    "Glicemia baixa no adulto: protocolo de hipoglicemia.",
    "Reduzir a hidrocortisona só depois da melhora, com o endocrinologista.",
  ],
  pensarEm: [
    "Choque séptico refratário: a hidrocortisona do choque séptico (200 mg/dia) é para quem segue com noradrenalina de 0,25 mcg/kg/min ou mais por 4 horas; na suspeita de crise adrenal, a dose de 100 mg é imediata.",
    "Hipovolemia, anafilaxia e causas cardíacas.",
  ],
  depois: [
    "Vigiar glicemia, sódio, potássio, pressão e perfusão; UTI se instável.",
    "Insuficiência primária: fludrocortisona quando a hidrocortisona cair abaixo de 50 mg/dia.",
    "Registrar e orientar o cartão de emergência e as doses de estresse.",
  ],
  divergencias: [
    {
      tema: "Dose inicial na criança",
      posicoes: [
        { texto: "Por idade: abaixo de 1 ano 25 mg; 1 a 5 anos 50 mg; 6 anos ou mais 100 mg. Ou por peso: 2 mg/kg, máximo de 100 mg; recém-nascido 4 mg/kg.", referencia: "bsped-2023-adrenal" },
      ],
      escolha: "O cálculo usa o peso (2 mg/kg, teto de 100 mg; recém-nascido 4 mg/kg), e a dose por idade fica para quando não há peso. A versão anterior tinha só a dose por idade, sem fonte localizada.",
    },
  ],
  referencias: ["sfe-2016-crise-adrenal", "bsped-2023-adrenal", "ssc-2021-sepse"],
  relacionados: [
    { protocolo: "hipotensao", texto: "Hipotensão grave" },
    { protocolo: "hipoglicemia-grave", texto: "Hipoglicemia grave" },
  ],
};

export const CONVULSAO: Protocolo = {
  id: "convulsao-perioperatoria",
  titulo: "Convulsão perioperatória",
  categoria: "outras",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["crise convulsiva", "convulsão", "estado de mal epiléptico", "crise epiléptica", "status epilepticus"],
  sinais: ["convulsão", "abalos", "crise tônico-clônica", "rebaixamento", "desvio do olhar", "depois do bloqueio"],
  resumo: "Estabilizar e medir a glicemia; com 5 minutos de crise, benzodiazepínico em dose cheia; aos 20 minutos, levetiracetam; aos 40, anestesia geral com EEG. Toxicidade por anestésico local e eclâmpsia têm protocolo próprio.",
  reconhecer: [
    "Estado de mal: crise de 5 minutos ou mais, ou crises repetidas sem recuperação entre elas.",
    "Sob bloqueio neuromuscular, a crise motora não aparece: na suspeita, EEG.",
  ],
  agirAgora: [
    { texto: "Proteger, pedir ajuda e marcar o tempo de crise.", caminho: "0–5 min: estabilizar" },
    { texto: "Via aérea, O2 e ventilação; ECG e pressão.", detalhe: "Intubar se a ventilação não for adequada.", caminho: "0–5 min: estabilizar" },
    { texto: "Glicemia; baixa, tratar (protocolo de hipoglicemia).", caminho: "0–5 min: estabilizar" },
    { texto: "Procurar hipóxia, anestésico local, eclâmpsia e eletrólitos.", detalhe: "Anestésico local: protocolo de toxicidade. Gestante ou puérpera: sulfato de magnésio.", caminho: "0–5 min: estabilizar" },
    { texto: "Benzodiazepínico em dose única cheia, sem fracionar.", detalhe: "Com acesso: diazepam IV. Sem acesso: midazolam IM.", caminho: "5–20 min: primeira linha" },
    { texto: "Persistindo: segunda linha, em dose única.", detalhe: "Levetiracetam IV; alternativas nas notas.", caminho: "20–40 min: segunda linha" },
    { texto: "Persistindo: anestesia geral (tiopental, midazolam ou propofol) com via aérea definitiva e EEG contínuo; UTI e neurologia.", caminho: "40 min ou mais: refratária" },
  ],
  medicamentos: [
    {
      id: "diazepam-convulsao", farmaco: "Diazepam", indicacao: "Primeira linha, com acesso venoso", populacao: "todas", via: "IV",
      dose: { min: 0.15, max: 0.2, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 10, unidade: "mg" }, apresentacoes: [DIAZEPAM_5],
      repeticao: "Pode repetir uma vez.",
      cuidados: ["Depressão respiratória: ter ventilação pronta."],
      referencias: ["aes-2016-estado-de-mal"],
    },
    {
      id: "midazolam-im-convulsao-adulto", farmaco: "Midazolam", indicacao: "Primeira linha, sem acesso — acima de 40 kg", populacao: "todas",
      faixaDePeso: { acimaDe: 40 }, via: "IM",
      dose: { usual: 10, unidade: "mg", por: "fixa" }, apresentacoes: [MIDAZOLAM_5_IM],
      repeticao: "Dose única.",
      cuidados: ["De 13 a 40 kg: 5 mg."],
      referencias: ["aes-2016-estado-de-mal"],
    },
    {
      id: "midazolam-im-convulsao-ped", farmaco: "Midazolam", indicacao: "Primeira linha, sem acesso — 13 a 40 kg", populacao: "pediatrico",
      faixaDePeso: { aPartirDe: 13, ate: 40 }, via: "IM",
      dose: { usual: 5, unidade: "mg", por: "fixa" }, apresentacoes: [MIDAZOLAM_5_IM],
      repeticao: "Dose única.",
      cuidados: ["Acima de 40 kg: 10 mg. Abaixo de 13 kg, a fonte não dá dose IM."],
      referencias: ["aes-2016-estado-de-mal"],
    },
    {
      id: "levetiracetam-convulsao", farmaco: "Levetiracetam", indicacao: "Segunda linha", populacao: "todas", via: "IV",
      dose: { usual: 60, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 4500, unidade: "mg" }, apresentacoes: [LEVETIRACETAM_100],
      repeticao: "Dose única.",
      cuidados: ["Velocidade e diluição: conferir na bula do produto disponível."],
      referencias: ["aes-2016-estado-de-mal", "esett-2019"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Lorazepam IV (0,1 mg/kg, máximo de 4 mg) é a outra opção da fonte, mas não tem apresentação injetável no Brasil.",
    "Segunda linha, alternativas da mesma fonte (dose única): fosfenitoína 20 mg EF/kg (máximo de 1.500 mg EF), ácido valproico 40 mg/kg (máximo de 3.000 mg); sem nenhuma delas, fenobarbital 15 mg/kg. Apresentação e velocidade a conferir com a farmácia.",
    "Eclâmpsia: o tratamento é o sulfato de magnésio, e não benzodiazepínico ou fenitoína no lugar dele.",
  ],
  pensarEm: [
    "Hipóxia, hipercapnia, hipoglicemia, hiponatremia e outros distúrbios eletrolíticos, toxicidade por anestésico local, eclâmpsia, abstinência, lesão neurológica aguda.",
    "Mudar de algoritmo: anestésico local → toxicidade por anestésico local; gestante ou puérpera → eclâmpsia; glicemia baixa → hipoglicemia.",
  ],
  depois: [
    "EEG se não recupera a consciência (crise não convulsiva) ou se recebeu bloqueador neuromuscular.",
    "Causa: eletrólitos, glicemia, gasometria; neuroimagem conforme o quadro; UTI no estado de mal.",
    "Registrar o horário de início, as doses e a resposta.",
  ],
  divergencias: [],
  referencias: ["aes-2016-estado-de-mal", "esett-2019", "nice-ng133"],
  relacionados: [
    { protocolo: "toxicidade-anestesico-local", texto: "Toxicidade por anestésico local" },
    { protocolo: "eclampsia", texto: "Eclâmpsia" },
    { protocolo: "hipoglicemia-grave", texto: "Hipoglicemia grave" },
  ],
};

export const INCENDIO: Protocolo = {
  id: "incendio-sala-cirurgica",
  titulo: "Incêndio na sala cirúrgica",
  categoria: "outras",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["fogo", "incêndio", "fogo na via aérea", "fogo no campo", "queimadura"],
  sinais: ["chama", "fumaça", "cheiro de queimado", "estalo", "faísca", "campo descolorido", "fogo no tubo", "bisturi elétrico", "laser"],
  resumo: "Anunciar e parar o procedimento. Na via aérea: tirar o tubo, parar os gases, retirar o inflamável e jogar soro. No campo: parar os gases, retirar os campos e apagar. Persistindo: extintor de CO2, alarme e evacuação.",
  reconhecer: [
    "Chama, fumaça, faísca, estalo, odor de queimado, calor, campo que se mexe ou descolore, no paciente, no tubo ou no circuito.",
  ],
  agirAgora: [
    { texto: "Anunciar “INCÊNDIO” e parar o procedimento, o laser e o bisturi elétrico." },
    { texto: "Ao mesmo tempo: retirar o tubo e parar todos os gases da via aérea.", caminho: "A. Fogo na via aérea ou no circuito" },
    { texto: "Retirar compressas e material inflamável da via aérea; jogar soro fisiológico ou água na via aérea.", caminho: "A. Fogo na via aérea ou no circuito" },
    { texto: "Apagado: ventilar por máscara evitando O2 suplementar e óxido nitroso, se possível; reintubar.", caminho: "A. Fogo na via aérea ou no circuito" },
    { texto: "Examinar o tubo retirado; broncoscopia (de preferência rígida) para fragmentos, lesão e resíduos.", caminho: "A. Fogo na via aérea ou no circuito" },
    { texto: "Parar todos os gases da via aérea.", caminho: "B. Fogo no campo ou no paciente" },
    { texto: "Retirar campos e todo material em chamas ou inflamável.", caminho: "B. Fogo no campo ou no paciente" },
    { texto: "Apagar com soro, água ou abafando; manter a ventilação.", caminho: "B. Fogo no campo ou no paciente" },
    { texto: "Apagado: avaliar queimaduras e lesão inalatória se não estava intubado.", caminho: "B. Fogo no campo ou no paciente" },
    { texto: "Extintor de CO2 no paciente e ao redor.", caminho: "C. Não apagou na primeira tentativa" },
    { texto: "Persistindo: acionar o alarme, evacuar o paciente, fechar a porta sem reabrir e cortar os gases da sala.", caminho: "C. Não apagou na primeira tentativa" },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Não há fármaco no combate ao fogo.",
    "Prevenção (cirurgia de cabeça e pescoço com fonte de ignição): menor FiO2 que evite hipóxia e 1 a 3 minutos de espera antes do bisturi; sem óxido nitroso; antisséptico alcoólico seco; compressas úmidas; tubo com balonete ou máscara laríngea na sedação dependente de O2.",
  ],
  pensarEm: [
    "O triângulo do fogo: oxidante (O2, N2O), fonte de ignição (bisturi elétrico, laser, fonte de luz) e combustível (campos, antisséptico, tubo, gaze).",
  ],
  depois: [
    "Tratar queimaduras e lesão de via aérea; UTI conforme a extensão.",
    "Guardar o material envolvido, documentar e notificar (segurança do paciente, vigilância sanitária).",
    "Revisar com a equipe; avaliar o risco de fumaça para o paciente e a equipe.",
  ],
  divergencias: [],
  referencias: ["asa-2013-incendio", "qrh-3-7"],
};

export const FALHA_O2_ENERGIA: Protocolo = {
  id: "falha-oxigenio-energia",
  titulo: "Falha de fornecimento de oxigênio ou energia",
  categoria: "outras",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["falta de oxigênio", "falta de energia", "queda de energia", "falha da rede de gases", "apagão", "aparelho desligou", "falha do ventilador"],
  sinais: ["FiO2 caindo", "alarme de pressão de gases", "ventilador parado", "monitor desligado", "sem energia", "cilindro vazio", "sem curva de capnografia"],
  resumo: "Primeiro o paciente: ressuscitador autoinflável com fonte de O2 que funcione (ou ar ambiente) e anestesia mantida. Depois, o caminho da falha: rede de O2, energia ou aparelho.",
  reconhecer: [
    "Rede de O2: alarme de pressão de gás, FiO2 medida caindo, fole ou bolsa sem encher.",
    "Energia: luz, monitores ou bombas apagando; aparelho passando à bateria.",
    "Aparelho ou ventilador: ventilador parado, sem curva de capnografia ou de pressão, volumes que não chegam ao paciente.",
  ],
  agirAgora: [
    { texto: "Anunciar a falha e pedir ajuda; checar o paciente (SpO2, EtCO2, pulso)." },
    { texto: "Ventilar com ressuscitador autoinflável ligado direto no tubo, independente do aparelho.", detalhe: "Na dúvida sobre o circuito, não continuar a usá-lo. Sem O2, o autoinflável ventila com ar ambiente." },
    { texto: "Garantir a anestesia: sem fluxo de gás, o vaporizador não entrega o agente — passar para venosa se preciso." },
    { texto: "Abrir o cilindro de reserva do aparelho e conferir o conteúdo; ter outro cilindro à mão.", caminho: "A. Falha da rede de O2" },
    { texto: "Poupar O2: sistema circular, menor fluxo e menor FiO2 seguros; ventilador movido a gás gasta O2 — ventilar à mão.", caminho: "A. Falha da rede de O2" },
    { texto: "Desconectar das saídas da parede que falharam e não reconectar até a engenharia confirmar o gás.", caminho: "A. Falha da rede de O2" },
    { texto: "Luz extra (portas, lanternas, celulares, laringoscópio).", caminho: "B. Falha elétrica" },
    { texto: "Manter ventilação e anestesia; pulso e pressão manuais se os monitores caírem.", caminho: "B. Falha elétrica" },
    { texto: "Só o essencial nas tomadas de energia garantida; a bateria do aparelho pode não manter todas as funções.", caminho: "B. Falha elétrica" },
    { texto: "Conferir se o O2 também caiu.", caminho: "B. Falha elétrica" },
    { texto: "Isolar: autoinflável direto no tubo; melhorou, o problema está no aparelho ou no circuito.", caminho: "C. Falha do aparelho ou do ventilador" },
    { texto: "Trocar circuito, filtro e conexões, ou o aparelho; ventilar à mão até resolver.", caminho: "C. Falha do aparelho ou do ventilador" },
    { texto: "Não começar caso novo; decidir com o cirurgião entre parar, fechar e terminar ou evacuar para outra sala.", caminho: "Em qualquer caminho" },
    { texto: "Acionar engenharia clínica, manutenção e coordenação.", caminho: "Em qualquer caminho" },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: ["Sem fármaco próprio; anestesia venosa enquanto o vaporizador não puder ser usado."],
  pensarEm: [
    "Cilindro vazio ou fechado, saída de parede trocada ou contaminada, desconexão, vazamento, falha do aparelho e queda de energia do prédio.",
  ],
  depois: [
    "Só voltar ao aparelho ou à rede depois de testados e liberados.",
    "Registrar o evento e notificar; revisar a checagem diária (cilindro de reserva e autoinflável na sala).",
  ],
  divergencias: [],
  referencias: ["qrh-4-1", "qrh-4-2", "qrh-2-2", "manual-26", "manual-35"],
  relacionados: [
    { protocolo: "verificacao-aparelho", texto: "Verificação do aparelho de anestesia" },
    { protocolo: "dessaturacao", texto: "Dessaturação súbita" },
  ],
};

export const DELIRIO: Protocolo = {
  id: "delirio-ao-despertar",
  titulo: "Delírio grave ao despertar",
  categoria: "outras",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["agitação ao despertar", "delirium", "agitação psicomotora", "despertar agitado", "emergence delirium", "delírio pós-operatório"],
  sinais: ["agitação", "confusão", "desorientação", "arrancando acessos", "combativo", "despertar"],
  resumo: "Proteger e, antes de sedar, excluir o que mata: hipóxia, hipercapnia, obstrução, bloqueio residual, hipoglicemia. Depois dor, bexiga, frio e dispositivos. Fármaco só se o resto falha.",
  reconhecer: [
    "Criança (delírio do despertar): agitação e desorientação logo ao acordar da anestesia.",
    "Adulto (agitação pós-anestésica): agitação ao despertar, a ser explicada por uma causa tratável antes de qualquer sedação.",
    "Adulto (delirium pós-operatório): alteração aguda e flutuante da atenção e da consciência, sobretudo no idoso, nos primeiros dias.",
  ],
  agirAgora: [
    { texto: "Proteger o paciente, os acessos, o tubo e a ferida; chamar ajuda." },
    { texto: "Oxigenação, ventilação (EtCO2), via aérea e pressão." },
    { texto: "Excluir hipoxemia, hipercapnia, obstrução, bloqueio neuromuscular residual e hipoglicemia." },
    { texto: "Tratar dor, retenção urinária, hipotermia e dispositivos incômodos." },
    { texto: "Ambiente calmo, reorientar; acompanhante (criança, idoso)." },
    { texto: "Déficit focal, convulsão ou rebaixamento: avaliar evento neurológico." },
    { texto: "Fármaco só se persistir e houver risco, em pequenas doses e com monitorização." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Não sedar antes de excluir as causas reversíveis.",
    "Delirium do adulto, se as medidas falham: haloperidol em dose baixa, em bolus (idoso: começar com 0,125–0,25 mg; menos de 3 mg/dia); evitar em Parkinson e demência com corpos de Lewy. Benzodiazepínico não é sugerido, exceto na abstinência alcoólica.",
    "Criança: sem dose validada nesta revisão; sedação pelo protocolo pediátrico do serviço.",
  ],
  pensarEm: [
    "Hipoxemia, hipercapnia, dor, hipoglicemia, retenção urinária, hipotermia, bloqueio residual, AVC, convulsão, abstinência (álcool, benzodiazepínico) e reação a fármacos.",
  ],
  depois: [
    "Reavaliar cognição e déficits neurológicos; rastrear delirium nos dias seguintes no adulto de risco.",
    "Observação prolongada ou UTI conforme a causa; registrar o episódio e o que foi dado.",
  ],
  divergencias: [],
  referencias: ["esaic-2024-delirium"],
  relacionados: [
    { protocolo: "bloqueio-neuromuscular-residual", texto: "Bloqueio neuromuscular residual" },
    { protocolo: "depressao-respiratoria-opioides", texto: "Depressão respiratória por opioides" },
    { protocolo: "hipoglicemia-grave", texto: "Hipoglicemia grave" },
  ],
};
