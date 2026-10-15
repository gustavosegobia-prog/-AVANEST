/**
 * OUTRAS EMERGÊNCIAS — cartões 01 a 07 da minuta preliminar “Protocolos de
 * crise” (outubro de 2026, para validação médica): hipoglicemia grave,
 * hipotermia perioperatória, crise adrenal, convulsão perioperatória, incêndio
 * na sala, falha de oxigênio ou energia e delírio grave ao despertar.
 *
 * Base: Tratado SAESP (páginas no cadastro da referência). Atualizações: ISPAD
 * 2022 (hipoglicemia), NICE CG65 (hipotermia), Endocrine Society 2016 e
 * Society for Endocrinology 2016 (crise adrenal), AES 2016 e ESETT
 * (convulsão), ASA (incêndio e verificação do aparelho), ESAIC (delírio). O
 * texto é do AVANEST. Versão 1, sem aprovação registrada até a validação.
 */

import type { Protocolo } from "../tipos.ts";
import { DIAZEPAM_5, GLICOSE_10, LEVETIRACETAM_100, MIDAZOLAM_5_IM } from "./comum.ts";

export const HIPOGLICEMIA: Protocolo = {
  id: "hipoglicemia-grave",
  titulo: "Hipoglicemia grave",
  categoria: "outras",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["glicose baixa", "glicemia baixa", "hipoglicemia", "neuroglicopenia"],
  sinais: ["glicemia baixa", "rebaixamento", "confusão", "convulsão", "sudorese", "taquicardia", "despertar demorado", "insulina"],
  resumo: "Glicemia baixa com consciência alterada: glicose 10% IV, reavaliar em 10 a 15 minutos e manter a oferta de glicose; sob anestesia, os sinais autonômicos podem faltar.",
  reconhecer: [
    "Glicemia baixa com alteração da consciência, convulsão, incapacidade de deglutir ou necessidade de ajuda de outra pessoa.",
    "Sob anestesia, sedação ou betabloqueio, sudorese e taquicardia podem não aparecer: medir a glicemia no despertar demorado ou na convulsão.",
  ],
  agirAgora: [
    { texto: "Via aérea, respiração, circulação e nível de consciência." },
    { texto: "Glicemia capilar agora; confirmar no laboratório sem atrasar o tratamento." },
    { texto: "Suspender a insulina em curso e rever hipoglicemiantes orais e outros fármacos." },
    { texto: "Consciência comprometida ou sem via oral segura: glicose IV.", detalhe: "Sem acesso venoso: glucagon IM." },
    { texto: "Nova glicemia em 10 a 15 minutos; repetir a glicose se continuar baixa." },
    { texto: "Depois da correção, manter oferta contínua de glicose ou alimentação, conforme o caso." },
  ],
  medicamentos: [
    {
      id: "glicose-hipoglicemia-adulto", farmaco: "Glicose 10%", indicacao: "Hipoglicemia grave — titular pela resposta", populacao: "adulto", via: "IV",
      dose: { min: 15, max: 25, unidade: "g", por: "fixa" }, apresentacoes: [GLICOSE_10],
      repeticao: "Glicemia em 10 a 15 minutos; repetir se continuar baixa.",
      par: "glicose-hipoglicemia-ped",
      referencias: ["saesp-tratado"],
    },
    {
      id: "glicose-hipoglicemia-ped", farmaco: "Glicose 10%", indicacao: "Hipoglicemia grave", populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 0.2, unidade: "g", por: "kg" }, apresentacoes: [GLICOSE_10],
      repeticao: "Glicemia em 10 a 15 minutos; repetir se continuar baixa.",
      par: "glicose-hipoglicemia-adulto",
      referencias: ["ispad-2022-hipoglicemia", "saesp-tratado"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Sem acesso venoso: glucagon IM, com a dose pela idade, pelo peso e pela apresentação disponível, conforme o protocolo do serviço.",
  ],
  pensarEm: ["Insulina, sulfonilureia, jejum prolongado, insuficiência renal ou hepática, sepse, insuficiência adrenal e desnutrição."],
  depois: [
    "Vigiar a recorrência e rever a terapia que causou o episódio; infusão de glicose quando indicada.",
    "Hipoglicemiante de ação longa (sulfonilureia, insulina de depósito): observação prolongada.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "ispad-2022-hipoglicemia"],
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
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["temperatura baixa", "hipotermia", "paciente frio", "reaquecimento"],
  sinais: ["temperatura baixa", "tremor", "despertar demorado", "sangramento", "coagulopatia", "arritmia", "bloqueio prolongado"],
  resumo: "Temperatura central abaixo de 36 °C: confirmar, cobrir e aquecer com ar forçado, aquecer fluidos e hemocomponentes e rever anestésicos e bloqueador; meta de 36 °C ou mais.",
  reconhecer: [
    "Temperatura central abaixo de 36 °C.",
    "Tremor, recuperação prolongada, sangramento por coagulopatia, arritmia e bloqueio neuromuscular prolongado.",
  ],
  agirAgora: [
    { texto: "Confirmar com medida de temperatura central." },
    { texto: "Reduzir a exposição: cobrir o que não está no campo." },
    { texto: "Aquecimento ativo com manta de ar forçado." },
    { texto: "Aquecedor de fluidos nos volumes relevantes e em todo hemocomponente." },
    { texto: "Ajustar a temperatura da sala." },
    { texto: "Monitorizar ECG, oxigenação, glicemia, eletrólitos e coagulação." },
    { texto: "Rever a dose dos anestésicos e a recuperação do bloqueio antes de extubar." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Sem fármaco próprio: o tratamento é aquecer. Meta de 36 °C ou mais.",
    "Hemocomponente só pelo aquecedor próprio para sangue.",
    "Hipotermia profunda ou com instabilidade: UTI e protocolo de reaquecimento.",
  ],
  pensarEm: [
    "Exposição extensa, anestesia geral ou neuraxial, fluidos frios, cirurgia longa, hemorragia e hipotireoidismo.",
  ],
  depois: [
    "Manter o aquecimento na recuperação e medir até a normotermia.",
    "Conferir a recuperação respiratória e neuromuscular antes da alta da sala.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "nice-cg65"],
  relacionados: [
    { protocolo: "bloqueio-neuromuscular-residual", texto: "Bloqueio neuromuscular residual" },
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
  ],
};

export const CRISE_ADRENAL: Protocolo = {
  id: "crise-adrenal",
  titulo: "Crise adrenal",
  categoria: "outras",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["insuficiência adrenal", "insuficiência suprarrenal", "choque por corticoide", "hidrocortisona", "Addison"],
  sinais: ["hipotensão refratária", "choque", "corticoide", "vômitos", "hipoglicemia", "hiponatremia", "hipercalemia", "rebaixamento"],
  resumo: "Choque que não responde, em quem usa ou usou corticoide: hidrocortisona IV imediata, sem esperar o cortisol, cristaloide pela resposta e glicemia.",
  reconhecer: [
    "Hipotensão ou choque refratário, fraqueza, vômitos, dor abdominal, rebaixamento, hipoglicemia, hiponatremia; hipercalemia na insuficiência primária.",
    "Suspeitar na insuficiência adrenal conhecida, no uso prolongado de corticoide e na suspensão recente.",
  ],
  agirAgora: [
    { texto: "Ajuda; via aérea, respiração e circulação." },
    { texto: "Hidrocortisona agora, sem aguardar a dosagem de cortisol.", detalhe: "Se for colher, colher antes, sem atrasar a dose." },
    { texto: "Cristaloide isotônico guiado pela resposta." },
    { texto: "Glicemia, e corrigir se baixa." },
    { texto: "Procurar o desencadeante: infecção, cirurgia, sangramento, suspensão do corticoide." },
    { texto: "Choque persistente depois da hidrocortisona e do volume: vasopressor." },
  ],
  medicamentos: [
    {
      id: "hidrocortisona-crise-adulto", farmaco: "Hidrocortisona", indicacao: "Dose inicial", populacao: "adulto", via: "IV",
      dose: { usual: 100, unidade: "mg", por: "fixa" }, apresentacoes: [],
      semVolume: "Conforme o frasco reconstituído",
      referencias: ["saesp-tratado", "es-2016-insuficiencia-adrenal", "sfe-2016-crise-adrenal"],
    },
    {
      id: "hidrocortisona-crise-infusao", farmaco: "Hidrocortisona", indicacao: "Manutenção — infusão contínua", populacao: "adulto", via: "IV",
      dose: { usual: 200, unidade: "mg", por: "fixa" }, apresentacoes: [],
      velocidade: "Em 24 horas.",
      semVolume: "Conforme o preparo do serviço",
      referencias: ["es-2016-insuficiencia-adrenal", "sfe-2016-crise-adrenal"],
    },
    {
      id: "hidrocortisona-crise-6h", farmaco: "Hidrocortisona", indicacao: "Manutenção — alternativa em bolus", populacao: "adulto", via: "IV",
      dose: { usual: 50, unidade: "mg", por: "fixa" }, apresentacoes: [],
      repeticao: "A cada 6 horas.",
      semVolume: "Conforme o frasco reconstituído",
      referencias: ["sfe-2016-crise-adrenal"],
    },
    {
      id: "hidrocortisona-crise-ped-menor-1", farmaco: "Hidrocortisona", indicacao: "Criança até 1 ano — dose inicial", populacao: "pediatrico",
      idadeAnos: { max: 1 }, via: "IV ou IM",
      dose: { usual: 25, unidade: "mg", por: "fixa" }, apresentacoes: [],
      semVolume: "Conforme o frasco reconstituído",
      referencias: ["saesp-tratado"],
    },
    {
      id: "hidrocortisona-crise-ped-1-5", farmaco: "Hidrocortisona", indicacao: "Criança de 1 a 5 anos — dose inicial", populacao: "pediatrico",
      idadeAnos: { min: 1, max: 6 }, via: "IV ou IM",
      dose: { usual: 50, unidade: "mg", por: "fixa" }, apresentacoes: [],
      semVolume: "Conforme o frasco reconstituído",
      referencias: ["saesp-tratado"],
    },
    {
      id: "hidrocortisona-crise-ped-6", farmaco: "Hidrocortisona", indicacao: "Criança de 6 anos ou mais — dose inicial", populacao: "pediatrico",
      idadeAnos: { min: 6 }, via: "IV ou IM",
      dose: { usual: 100, unidade: "mg", por: "fixa" }, apresentacoes: [],
      semVolume: "Conforme o frasco reconstituído",
      referencias: ["saesp-tratado"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Criança: a referência é 50 mg/m² IV ou IM; as doses por faixa de idade são a forma prática.",
    "A dose de cobertura cirúrgica (estresse) não é o tratamento da crise.",
  ],
  pensarEm: ["Sepse, hipovolemia, anafilaxia, causas cardíacas e o desencadeante da crise."],
  depois: [
    "Vigiar glicemia, sódio, potássio, pressão e perfusão.",
    "Reduzir a hidrocortisona só depois da avaliação especializada.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "es-2016-insuficiencia-adrenal", "sfe-2016-crise-adrenal"],
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
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["crise convulsiva", "convulsão", "estado de mal epiléptico", "crise epiléptica", "status epilepticus"],
  sinais: ["convulsão", "abalos", "crise tônico-clônica", "rebaixamento", "desvio do olhar", "depois do bloqueio"],
  resumo: "Proteger e oxigenar, medir a glicemia e procurar a causa (hipóxia, anestésico local, eclâmpsia); benzodiazepínico e, sem resposta, levetiracetam.",
  reconhecer: [
    "Crise de 5 minutos ou mais, ou crises repetidas sem recuperação entre elas: possível estado de mal epiléptico.",
  ],
  agirAgora: [
    { texto: "Proteger o paciente, interromper o que pode estar causando e pedir ajuda." },
    { texto: "Oxigenação, ventilação e circulação." },
    { texto: "Glicemia." },
    { texto: "Procurar hipóxia, hipercapnia, toxicidade por anestésico local, eclâmpsia e distúrbio eletrolítico.",
      detalhe: "Anestésico local: protocolo próprio. Gestante ou puérpera: magnésio, pelo protocolo de eclâmpsia." },
    { texto: "Benzodiazepínico." },
    { texto: "Persistindo: segunda linha, UTI e neurologia." },
    { texto: "Suspeita de crise não convulsiva ou sem recuperação da consciência: EEG." },
  ],
  medicamentos: [
    {
      id: "lorazepam-convulsao", farmaco: "Lorazepam", indicacao: "Primeira linha", populacao: "todas", via: "IV",
      dose: { usual: 0.1, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 4, unidade: "mg" }, apresentacoes: [],
      repeticao: "Repetir uma vez, se a crise continuar.",
      semVolume: "Sem apresentação injetável no Brasil: usar midazolam IM ou diazepam IV",
      referencias: ["aes-2016-estado-de-mal", "saesp-tratado"],
    },
    {
      id: "midazolam-im-convulsao-adulto", farmaco: "Midazolam", indicacao: "Primeira linha, sem acesso venoso — acima de 40 kg", populacao: "adulto", via: "IM",
      dose: { usual: 10, unidade: "mg", por: "fixa" }, apresentacoes: [MIDAZOLAM_5_IM],
      cuidados: ["De 13 a 40 kg: 5 mg."],
      par: "midazolam-im-convulsao-ped",
      referencias: ["aes-2016-estado-de-mal"],
    },
    {
      id: "midazolam-im-convulsao-ped", farmaco: "Midazolam", indicacao: "Primeira linha, sem acesso venoso — de 13 a 40 kg", populacao: "pediatrico", via: "IM",
      dose: { usual: 5, unidade: "mg", por: "fixa" }, apresentacoes: [MIDAZOLAM_5_IM],
      cuidados: ["Acima de 40 kg: 10 mg. Abaixo de 13 kg, a fonte não dá dose IM."],
      par: "midazolam-im-convulsao-adulto",
      referencias: ["aes-2016-estado-de-mal"],
    },
    {
      id: "diazepam-convulsao", farmaco: "Diazepam", indicacao: "Primeira linha, com acesso venoso", populacao: "todas", via: "IV",
      dose: { min: 0.15, max: 0.2, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 10, unidade: "mg" }, apresentacoes: [DIAZEPAM_5],
      repeticao: "Repetir uma vez, se a crise continuar.",
      cuidados: ["Não diluir em soro."],
      referencias: ["aes-2016-estado-de-mal"],
    },
    {
      id: "levetiracetam-convulsao", farmaco: "Levetiracetam", indicacao: "Segunda linha, se persistir depois do benzodiazepínico", populacao: "todas", via: "IV",
      dose: { usual: 60, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 4500, unidade: "mg" }, apresentacoes: [LEVETIRACETAM_100],
      velocidade: "Em 10 a 15 minutos.",
      referencias: ["esett-2019", "saesp-tratado"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "O lorazepam injetável não está disponível no Brasil: sem acesso, midazolam IM; com acesso, diazepam IV — doses da mesma fonte.",
    "Toxicidade por anestésico local: protocolo próprio. Eclâmpsia: o tratamento é o sulfato de magnésio.",
  ],
  pensarEm: [
    "Hipóxia, hipercapnia, hipoglicemia, distúrbio eletrolítico, toxicidade por anestésico local, eclâmpsia, abstinência e lesão neurológica.",
  ],
  depois: [
    "Tratar a causa, garantir a ventilação e corrigir o metabolismo.",
    "Neuroimagem e EEG conforme o quadro.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "aes-2016-estado-de-mal", "esett-2019"],
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
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["fogo", "incêndio", "fogo na via aérea", "fogo no campo", "queimadura"],
  sinais: ["chama", "fumaça", "cheiro de queimado", "faísca", "campo aquecido", "fogo no tubo", "bisturi elétrico", "laser"],
  resumo: "Anunciar “incêndio”, parar o procedimento e o fluxo de gases; na via aérea, tirar o tubo e apagar com soro ou água, depois ventilar sem enriquecer de oxigênio.",
  reconhecer: [
    "Chama, fumaça, faísca, odor de queimado ou aquecimento no campo, no tubo ou no circuito.",
  ],
  agirAgora: [
    { texto: "Anunciar em voz alta: “INCÊNDIO!”." },
    { texto: "Parar o procedimento." },
    { texto: "Fogo na via aérea: fechar o fluxo de oxigênio e de outros gases; retirar o tubo e o material inflamável.",
      detalhe: "Apagar com soro fisiológico ou água." },
    { texto: "Restabelecer a ventilação evitando atmosfera enriquecida de oxigênio; depois, titular a FiO2." },
    { texto: "Inspecionar o tubo retirado e procurar fragmentos; avaliar lesão térmica e broncoscopia." },
    { texto: "Fogo fora da via aérea: interromper os gases, retirar os campos e materiais em chamas, apagar e proteger o paciente.",
      detalhe: "Não controlado: plano de evacuação da instituição." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Não há fármaco no combate ao fogo.",
    "Prevenção: evitar atmosfera enriquecida de oxigênio na cabeça e no pescoço; combinar com a equipe o uso de bisturi elétrico e laser e o tempo de secagem do antisséptico alcoólico.",
  ],
  pensarEm: ["O triângulo do fogo: oxidante (oxigênio, óxido nitroso), fonte de ignição (bisturi elétrico, laser, fonte de luz) e combustível (campos, antisséptico, tubo, gaze)."],
  depois: [
    "Avaliar e tratar lesões de via aérea e de pele.",
    "Guardar o material, documentar e comunicar à segurança do paciente.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "asa-2013-incendio"],
};

export const FALHA_O2_ENERGIA: Protocolo = {
  id: "falha-oxigenio-energia",
  titulo: "Falha de fornecimento de oxigênio ou energia",
  categoria: "outras",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["falta de oxigênio", "falta de energia", "queda de energia", "falha da rede de gases", "apagão", "aparelho desligou"],
  sinais: ["FiO2 caindo", "alarme de pressão de gases", "ventilador parado", "monitor desligado", "sem energia", "cilindro vazio"],
  resumo: "Primeiro o paciente: ventilar com ressuscitador autoinflável e uma fonte de oxigênio que funcione, depois procurar a falha (cilindro, rede, energia) e chamar a engenharia.",
  reconhecer: [
    "Queda da FiO2, alarme de pressão de gases, ventilador parado ou monitores desligando.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda e anunciar a falha à equipe." },
    { texto: "Checar o paciente: oxigenação, ventilação e circulação." },
    { texto: "Ventilar com ressuscitador autoinflável, independente do aparelho." },
    { texto: "Conectar uma fonte alternativa de oxigênio que funcione." },
    { texto: "Abrir o cilindro de reserva, conferir pressão e conexões; verificar a rede central." },
    { texto: "Falta de energia: energia de emergência e baterias do aparelho." },
    { texto: "Monitores independentes ou a bateria." },
    { texto: "Garantir a manutenção da anestesia; decidir se interrompe ou adia o procedimento.",
      detalhe: "Sem fluxo de gás, o vaporizador não entrega o anestésico." },
    { texto: "Acionar engenharia clínica, manutenção e coordenação." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Sem fármaco próprio.",
    "Usar só cilindro com conteúdo confirmado; o circuito do aparelho pode estar comprometido.",
    "Sem oxigênio disponível, o ar ambiente pelo ressuscitador autoinflável permite ventilar até restabelecer.",
  ],
  pensarEm: ["Troca de conexões ou de gases na rede, cilindro vazio ou fechado, desconexão, falha do aparelho e queda de energia do prédio."],
  depois: [
    "Reparar e testar antes de voltar a usar o aparelho.",
    "Registrar o evento e as medidas de prevenção.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "asa-2008-checkout"],
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
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["agitação ao despertar", "delirium", "agitação psicomotora", "despertar agitado", "emergence delirium"],
  sinais: ["agitação", "confusão", "desorientação", "arrancando acessos", "combativo", "despertar"],
  resumo: "Proteger, e antes de sedar excluir o que mata: hipóxia, hipercapnia, obstrução, bloqueio residual, hipoglicemia; depois dor, bexiga, frio e dispositivos.",
  reconhecer: [
    "Agitação, confusão ou desorientação ao despertar, com risco para o paciente ou a equipe.",
  ],
  agirAgora: [
    { texto: "Proteger o paciente, os acessos e a via aérea." },
    { texto: "Oxigênio, ventilação, pressão arterial e glicemia." },
    { texto: "Procurar hipercapnia, hipoxemia, obstrução da via aérea e bloqueio neuromuscular residual." },
    { texto: "Dor, retenção urinária, hipotermia e incômodo de dispositivos." },
    { texto: "Reduzir estímulos e reorientar." },
    { texto: "Tratar a causa encontrada." },
    { texto: "Fármaco só quando necessário, individualizado e com monitorização." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Não sedar antes de excluir as causas reversíveis.",
    "Sem dose padronizada neste cartão: a escolha do fármaco é individual.",
  ],
  pensarEm: [
    "AVC, convulsão, hipoglicemia, hipoxemia, hipercapnia, dor, retenção urinária, abstinência e reação medicamentosa.",
  ],
  depois: [
    "Reavaliar a cognição e procurar déficits neurológicos.",
    "Observação prolongada ou UTI, conforme a causa.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "esaic-2024-delirium"],
  relacionados: [
    { protocolo: "bloqueio-neuromuscular-residual", texto: "Bloqueio neuromuscular residual" },
    { protocolo: "depressao-respiratoria-opioides", texto: "Depressão respiratória por opioides" },
    { protocolo: "hipoglicemia-grave", texto: "Hipoglicemia grave" },
  ],
};
