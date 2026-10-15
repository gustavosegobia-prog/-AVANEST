/**
 * AS VIAS DE DIAGNÓSTICO — cartões 06 a 09 e 17 a 19 da minuta de validação
 * de 15/10/2026: crise hipertensiva, hipotensão grave, taquiarritmia
 * instável, bradicardia grave, dessaturação súbita e as duas alterações do CO2
 * expirado.
 *
 * Base: Manual de Crises (abas 26 a 34). Ritmos com e sem pulso: AHA 2025.
 * Metas perioperatórias: ACC/AHA 2024. Bolus de resgate e contexto: QRH da
 * Association of Anaesthetists. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import {
  ADENOSINA_3, ADRENALINA_10, ADRENALINA_100, ADRENALINA_60, ATROPINA_025, ATROPINA_05, EFEDRINA_5, ESMOLOL_10,
  FENILEFRINA_100, HIDRALAZINA_1, MAGNESIO_10, MAGNESIO_50, NITROGLICERINA_200, NORADRENALINA_80,
} from "./comum.ts";

export const DESSATURACAO: Protocolo = {
  id: "dessaturacao",
  titulo: "Dessaturação súbita",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["hipoxemia", "hipóxia", "SpO2 caindo", "cianose", "dessaturação"],
  sinais: ["SpO2 caindo", "saturação baixa", "cianose", "dessatura"],
  resumo: "O2 a 100% e ventilação manual já; revisar dispositivo, capnograma e tubo, e tratar a causa que o exame do tórax e da hemodinâmica mostrar.",
  reconhecer: [
    "Queda da SpO2 ou sinais clínicos de hipóxia.",
    "Confirmar sensor e perfusão em paralelo ao tratamento, sem presumir artefato.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, O2 a 100%, avaliar pulso e PA e ventilar manualmente; avisar a cirurgia." },
    { texto: "Rever o dispositivo, o capnograma, as conexões, a obstrução e a posição do tubo." },
    { texto: "Suspeita de falha do sistema: ressuscitador autoinflável com fonte independente e confiável, sem filtro obstruído." },
    { texto: "Examinar o tórax e a hemodinâmica; tratar laringoespasmo, broncoespasmo, tensão, aspiração ou PCR conforme o achado." },
    { texto: "Gasometria, ultrassom ou imagem quando necessários e seguros.", detalhe: "Não atrasar a descompressão da tensão por exames." },
    { texto: "Depois de estabilizar, titular a FiO2 e ajustar ventilação e PEEP conforme a causa." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Sem fármaco único: abrir o protocolo da causa.",
    "Oxigênio, ventilação e perfusão têm prioridade sobre medicação empírica sem diagnóstico.",
  ],
  pensarEm: [
    "Fonte de O2, circuito, tubo deslocado, obstruído ou seletivo, hipoventilação, atelectasia, broncoespasmo, tensão, aspiração, edema, embolia, baixo débito e dis-hemoglobinemia, conforme o contexto.",
  ],
  depois: [
    "Registrar o menor valor, a duração e a causa.",
    "Reavaliar a necessidade de suporte e de recuperação monitorizada ou UTI.",
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

export const HIPERTENSAO: Protocolo = {
  id: "hipertensao",
  titulo: "Crise hipertensiva",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["hipertensão", "PA alta", "pressão alta", "hipertensão intraoperatória"],
  sinais: ["PA alta", "pressão subindo", "taquicardia", "hipertensão"],
  resumo: "Confirmar a medida e corrigir dor, plano, ventilação e erro de fármaco antes de tratar; persistindo, anti-hipertensivo titulável, sem queda abrupta universal.",
  reconhecer: [
    "Elevação importante da PA; emergência hipertensiva exige lesão aguda de órgão.",
    "Considerar medida errada, dor ou plano superficial e fármaco antes de atribuir à hipertensão crônica.",
  ],
  agirAgora: [
    { texto: "Confirmar manguito ou transdutor, zero e posição; avaliar o paciente e os sinais de lesão de órgão." },
    { texto: "Corrigir hipóxia ou hipercapnia, dor, anestesia insuficiente, bexiga distendida e estímulo cirúrgico." },
    { texto: "Revisar infusões, injeção de adrenalina, erro de seringa e retirada de anti-hipertensivo." },
    { texto: "Persistente: anti-hipertensivo titulável e monitorização.",
      detalhe: "Meta e velocidade conforme o diagnóstico, sem redução abrupta universal." },
    { texto: "Feocromocitoma ou crise catecolaminérgica: não iniciar bloqueio beta antes do controle alfa ou da vasodilatação apropriada." },
  ],
  medicamentos: [
    {
      id: "esmolol-bolus-hipertensao", farmaco: "Esmolol", indicacao: "Com taquicardia e sem contraindicação — bolus",
      populacao: "adulto", via: "IV",
      dose: { usual: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [ESMOLOL_10],
      velocidade: "Em 1 minuto.",
      cuidados: ["Monitorar bradicardia e baixo débito."],
      referencias: ["manual-34"],
    },
    {
      id: "esmolol-infusao-hipertensao", farmaco: "Esmolol", indicacao: "Infusão inicial, depois titular",
      populacao: "adulto", via: "IV",
      dose: { usual: 50, unidade: "mcg", por: "kg/min" }, apresentacoes: [ESMOLOL_10],
      cuidados: ["Monitorar bradicardia e baixo débito; respeitar o limite institucional."],
      referencias: ["manual-34"],
    },
    {
      id: "nitroglicerina-hipertensao", farmaco: "Nitroglicerina", indicacao: "Quando apropriada — início, depois titular",
      populacao: "adulto", via: "IV",
      dose: { usual: 5, unidade: "mcg", por: "min" }, apresentacoes: [NITROGLICERINA_200],
      velocidade: "Iniciar em 5 mcg/min e titular (mesmo preparo do protocolo de isquemia).",
      cuidados: ["Interação com inibidor da PDE5: conferir o intervalo específico do fármaco."],
      referencias: ["manual-34"],
    },
    {
      id: "hidralazina-hipertensao", farmaco: "Hidralazina", indicacao: "Quando indicada",
      populacao: "adulto", via: "IV lento",
      dose: { usual: 5, unidade: "mg", por: "fixa" }, apresentacoes: [HIDRALAZINA_1],
      repeticao: "Reavaliar antes de nova dose: o efeito é menos titulável.",
      referencias: ["manual-34"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Nitroprussiato, clonidina e doses pediátricas devem seguir o formulário específico do serviço; não usar a tabela adulta por extrapolação.",
  ],
  pensarEm: [
    "Pré-eclâmpsia, isquemia, hipertensão intracraniana, dissecção, feocromocitoma, hipertermia maligna, excesso de volume e interação medicamentosa.",
  ],
  depois: [
    "Reavaliar órgão-alvo, causa e necessidade de UTI.",
    "Registrar a maior PA, o tratamento, a resposta e o plano.",
  ],
  divergencias: [],
  referencias: ["manual-27", "manual-34", "acc-aha-2024-perioperatorio"],
  relacionados: [
    { protocolo: "isquemia-miocardica", texto: "Isquemia miocárdica" },
    { protocolo: "colapso-materno", texto: "Colapso materno (eclâmpsia)" },
    { protocolo: "hipertermia-maligna", texto: "Hipertermia maligna" },
  ],
};

export const HIPOTENSAO: Protocolo = {
  id: "hipotensao",
  titulo: "Hipotensão grave",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["hipotensão", "PA baixa", "pressão caindo", "choque"],
  sinais: ["PA caindo", "pressão baixa", "hipotensão", "taquicardia", "EtCO2 caindo"],
  resumo: "Avaliar pulso, ventilação e sangramento; interromper a causa e dar vasoativo e volume em paralelo, com eco para o mecanismo quando persiste.",
  reconhecer: [
    "Queda da PA com hipoperfusão ou deterioração abrupta. Confirmar a medida sem atrasar o suporte.",
    "Taquicardia não prova hipovolemia; bradicardia isolada não obriga atropina.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda; avaliar pulso e ritmo, oxigenação, ventilação e sangramento. Sem pulso: PCR." },
    { texto: "Interromper a causa precipitante; revisar anestésicos, infusões, posicionamento e pressão intratorácica." },
    { texto: "Vasoativo e reposição da perda em paralelo, quando indicados.",
      detalhe: "Bolus de volume com reavaliação; suspeita de hemorragia: sangue e controle da fonte." },
    { texto: "Persistência ou gravidade: linha arterial, gasometria e eco para o mecanismo.",
      detalhe: "Não usar PVC ou VPP isoladas para decidir volume." },
    { texto: "Vasoplegia: vasopressor. Falência ventricular: suporte inotrópico e causal. Obstrução: tratar tensão, tamponamento ou embolia." },
  ],
  medicamentos: [
    {
      id: "efedrina-hipotensao", farmaco: "Efedrina", indicacao: "Bolus, titular", populacao: "adulto", via: "IV",
      dose: { min: 3, max: 6, unidade: "mg", por: "fixa" }, apresentacoes: [EFEDRINA_5],
      cuidados: ["Conferir a ampola original."],
      referencias: ["manual-28", "manual-34"],
    },
    {
      id: "fenilefrina-hipotensao", farmaco: "Fenilefrina", indicacao: "Bolus, titular", populacao: "adulto", via: "IV",
      dose: { min: 50, max: 100, unidade: "mcg", por: "fixa" }, apresentacoes: [FENILEFRINA_100],
      referencias: ["manual-28", "manual-34"],
    },
    {
      id: "noradrenalina-hipotensao", farmaco: "Noradrenalina", indicacao: "Exemplo de início; titular conforme mecanismo e perfusão",
      populacao: "adulto", via: "IV",
      dose: { usual: 0.05, unidade: "mcg", por: "kg/min" }, apresentacoes: [NORADRENALINA_80], altoRisco: true,
      cuidados: ["Dose em noradrenalina base."],
      referencias: ["manual-34", "qrh-2-4"],
    },
    {
      id: "adrenalina-bolus-hipotensao", farmaco: "Adrenalina", indicacao: "Resgate titulado, com pulso e monitorização, em adulto selecionado",
      populacao: "adulto", via: "IV",
      dose: { min: 10, max: 20, unidade: "mcg", por: "fixa" }, apresentacoes: [ADRENALINA_10], altoRisco: true,
      cuidados: ["Não confundir com 1 mg da PCR."],
      referencias: ["qrh-2-4"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Esses bolus não são uma sequência obrigatória.",
    "A criança necessita de prescrição por kg e pelo contexto; bradicardia grave pediátrica: protocolo de bradicardia, e não pequeno bolus de hipotensão.",
  ],
  pensarEm: [
    "Hemorragia oculta, anafilaxia, raqui alta, toxicidade por anestésico local, isquemia, arritmia, falência do VD ou do VE, embolia, tamponamento, tensão e erro de fármaco.",
  ],
  depois: [
    "Confirmar a resposta e a perfusão, tratar a causa e definir monitorização ou UTI.",
    "Registrar valores, doses e perdas.",
  ],
  divergencias: [],
  referencias: ["manual-28", "manual-34", "qrh-2-4", "acc-aha-2024-perioperatorio"],
  veja: [{ protocolo: "bradicardia", quando: ["pediatrico"], texto: "Criança com bradicardia grave: protocolo de bradicardia, com as doses por kg." }],
  relacionados: [
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto" },
    { protocolo: "taquiarritmia", texto: "Taquiarritmia" },
    { protocolo: "bradicardia", texto: "Bradicardia" },
  ],
};

export const TAQUIARRITMIA: Protocolo = {
  id: "taquiarritmia",
  titulo: "Taquiarritmia instável",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["taquicardia", "taquiarritmia", "FA", "fibrilação atrial", "flutter", "TSV", "TV com pulso", "cardioversão"],
  sinais: ["FC alta", "taquicardia", "QRS estreito", "QRS largo", "irregular", "hipotensão"],
  resumo: "Instável pela arritmia: cardioversão sincronizada imediata. Estável: identificar o ritmo antes do antiarrítmico; FA pré-excitada sem amiodarona nem bloqueador do nó AV.",
  reconhecer: [
    "Taquiarritmia que provoca choque, hipotensão, alteração de consciência, isquemia ou insuficiência cardíaca aguda.",
    "Avaliar pulso, largura e regularidade do QRS e a relação causal; taquicardia sinusal compensatória exige tratar a causa.",
  ],
  agirAgora: [
    { texto: "Monitorizar e garantir acesso, oxigenação e ventilação; sem pulso, PCR." },
    { texto: "Instabilidade atribuível à arritmia: cardioversão imediata.", detalhe: "Sedação, se possível, sem atrasar." },
    { texto: "FA ou flutter: iniciar com 200 J sincronizados; QRS estreito regular ou TV monomórfica: 100 J sincronizados.",
      detalhe: "Conforme a AHA e o aparelho. Conferir o sincronismo antes de cada choque." },
    { texto: "TV polimórfica: desfibrilação não sincronizada.", detalhe: "Se sincronizar atrasa e o quadro é crítico, não postergar o choque." },
    { texto: "Se estável: identificar o ritmo antes do antiarrítmico.",
      detalhe: "FA pré-excitada: não administrar amiodarona IV nem bloqueadores do nó AV; avaliação especializada ou cardioversão." },
  ],
  medicamentos: [
    {
      id: "adenosina-6", farmaco: "Adenosina", indicacao: "QRS estreito regular apropriado — primeira dose", populacao: "adulto", via: "IV",
      dose: { usual: 6, unidade: "mg", por: "fixa" }, apresentacoes: [ADENOSINA_3],
      velocidade: "Rápida, seguida de flush.",
      cuidados: ["Não usar em taquicardia larga irregular ou pré-excitada."],
      par: "adenosina-ped-1",
      referencias: ["manual-34", "aha-2025-als"],
    },
    {
      id: "adenosina-12", farmaco: "Adenosina", indicacao: "Se necessário — segunda dose", populacao: "adulto", via: "IV",
      dose: { usual: 12, unidade: "mg", por: "fixa" }, apresentacoes: [ADENOSINA_3],
      velocidade: "Rápida, seguida de flush.",
      par: "adenosina-ped-2",
      referencias: ["manual-34", "aha-2025-als"],
    },
    {
      id: "adenosina-ped-1", farmaco: "Adenosina", indicacao: "Criança — primeira dose", populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 0.1, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 6, unidade: "mg" }, apresentacoes: [ADENOSINA_3],
      velocidade: "Rápida, seguida de flush.",
      par: "adenosina-6",
      referencias: ["aha-2025-pals-taquiarritmia"],
    },
    {
      id: "adenosina-ped-2", farmaco: "Adenosina", indicacao: "Criança — segunda dose", populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 0.2, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 12, unidade: "mg" }, apresentacoes: [ADENOSINA_3],
      velocidade: "Rápida, seguida de flush.",
      par: "adenosina-12",
      referencias: ["aha-2025-pals-taquiarritmia"],
    },
    {
      id: "magnesio-torsades", farmaco: "Sulfato de magnésio", indicacao: "Torsades de pointes", populacao: "adulto", via: "IV",
      dose: { min: 1, max: 2, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_10, MAGNESIO_50],
      velocidade: "Com pulso, em 5 a 10 minutos.",
      cuidados: ["O choque não deve aguardar o magnésio."],
      par: "magnesio-torsades-ped",
      referencias: ["aha-2025-als"],
    },
    {
      id: "magnesio-torsades-ped", farmaco: "Sulfato de magnésio", indicacao: "Torsades de pointes", populacao: "pediatrico", via: "IV",
      dose: { usual: 50, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 2, unidade: "g" }, apresentacoes: [MAGNESIO_10, MAGNESIO_50],
      velocidade: "Lenta, com monitorização.",
      cuidados: ["O choque não deve aguardar o magnésio."],
      par: "magnesio-torsades",
      referencias: ["aha-2025-pals-taquiarritmia"],
    },
  ],
  volumes: [
    { id: "cardioversao-fa", rotulo: "Cardioversão sincronizada — FA ou flutter", grupo: "Cardioversão", indicacao: "Inicial; conferir o sincronismo",
      populacao: "adulto", unidade: "J", fixo: { min: 200 }, referencias: ["aha-2025-cardioversao"] },
    { id: "cardioversao-estreita", rotulo: "Cardioversão sincronizada — QRS estreito regular ou TV monomórfica", grupo: "Cardioversão",
      indicacao: "Inicial; conferir o sincronismo", populacao: "adulto", unidade: "J", fixo: { min: 100 }, referencias: ["aha-2025-cardioversao"] },
    { id: "cardioversao-ped", rotulo: "Cardioversão sincronizada — criança, primeira", grupo: "Cardioversão", indicacao: "Primeiro choque",
      populacao: "pediatrico", unidade: "J", porKg: { min: 0.5, max: 1 }, referencias: ["aha-2025-pals-taquiarritmia"] },
    { id: "cardioversao-ped-2", rotulo: "Cardioversão sincronizada — criança, seguinte", grupo: "Cardioversão", indicacao: "Choques seguintes",
      populacao: "pediatrico", unidade: "J", porKg: { min: 2 }, referencias: ["aha-2025-pals-taquiarritmia"] },
  ],
  notasDeDose: [
    "Amiodarona com pulso: prescrição por ritmo e por população; não aplicar o bolus da PCR ao paciente perfundido.",
  ],
  pensarEm: [
    "Hipovolemia, dor ou plano superficial, catecolaminas, hipóxia, eletrólitos, isquemia, via acessória e toxicidade.",
  ],
  depois: [
    "ECG, eletrólitos, investigação e cardiologia.",
    "Registrar o traçado, a energia, o sincronismo e a resposta.",
  ],
  divergencias: [
    {
      tema: "Adenosina",
      posicoes: [{ texto: "6 mg; repetir 12 mg duas vezes.", referencia: "manual-34" }],
      escolha: "O protocolo segue a AHA 2025: 6 mg e, se necessário, 12 mg.",
    },
  ],
  referencias: ["manual-29", "manual-34", "aha-2025-als", "aha-2025-pals-taquiarritmia", "aha-2025-cardioversao"],
  relacionados: [
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "hipotensao", texto: "Hipotensão grave" },
    { protocolo: "isquemia-miocardica", texto: "Isquemia miocárdica" },
  ],
};

export const BRADICARDIA: Protocolo = {
  id: "bradicardia",
  titulo: "Bradicardia grave",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["bradicardia", "FC baixa", "bloqueio AV", "bradiarritmia", "marca-passo"],
  sinais: ["FC baixa", "bradicardia", "hipotensão", "bloqueio", "reflexo vagal"],
  resumo: "Adulto instável: atropina e, sem resposta, marca-passo ou vasoativo. Criança com FC abaixo de 60 e má perfusão apesar da ventilação: RCP e adrenalina.",
  reconhecer: [
    "Bradicardia com hipoperfusão, hipotensão, choque ou alteração de consciência.",
    "Avaliar o contexto e a idade; não tratar somente o número da FC ou do EtCO2.",
  ],
  agirAgora: [
    { texto: "Interromper o estímulo vagal; corrigir hipóxia e ventilação; revisar fármacos e ritmo." },
    { texto: "Adulto com pulso e instável: atropina; preparar marca-passo ou vasoativo se a resposta for inadequada.",
      detalhe: "Bloqueio AV avançado pode exigir estimulação precoce.", so: ["adulto", "gestante"] },
    { texto: "Criança com FC abaixo de 60 por minuto e comprometimento, apesar de oxigenação e ventilação adequadas: RCP e adrenalina.",
      detalhe: "Atropina se aumento do tônus vagal ou bloqueio AV primário.", so: ["pediatrico", "neonatal"] },
    { texto: "Sem pulso: algoritmo de PCR.", detalhe: "Não aguardar o EtCO2 cair abaixo de 20." },
  ],
  medicamentos: [
    {
      id: "atropina-bradicardia-adulto", farmaco: "Atropina", indicacao: "Adulto com pulso e instável", populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "mg", por: "fixa" }, apresentacoes: [ATROPINA_05],
      repeticao: "A cada 3 a 5 minutos; máximo de 3 mg no total.",
      par: "atropina-bradicardia-ped",
      referencias: ["aha-2025-acls-bradicardia"],
    },
    {
      id: "adrenalina-infusao-bradicardia", farmaco: "Adrenalina", indicacao: "Adulto — infusão, se a atropina não basta", populacao: "adulto", via: "IV",
      dose: { min: 2, max: 10, unidade: "mcg", por: "min" }, apresentacoes: [ADRENALINA_60], altoRisco: true,
      referencias: ["aha-2025-acls-bradicardia"],
    },
    {
      id: "dopamina-bradicardia", farmaco: "Dopamina", indicacao: "Adulto — alternativa, titular", populacao: "adulto", via: "IV",
      dose: { min: 5, max: 20, unidade: "mcg", por: "kg/min" }, apresentacoes: [],
      semVolume: "Calcular pela concentração selecionada",
      referencias: ["aha-2025-acls-bradicardia"],
    },
    {
      id: "adrenalina-bradicardia-ped", farmaco: "Adrenalina", indicacao: "Criança — FC abaixo de 60 com comprometimento", populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 10, unidade: "mcg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "mg" }, apresentacoes: [ADRENALINA_100], altoRisco: true,
      repeticao: "A cada 3 a 5 minutos, conforme a ressuscitação.",
      referencias: ["aha-2025-pals-bradicardia"],
    },
    {
      id: "atropina-bradicardia-ped", farmaco: "Atropina", indicacao: "Criança — tônus vagal ou bloqueio AV primário", populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 0.02, unidade: "mg", por: "kg" }, doseMinima: { valor: 0.1, unidade: "mg" }, tetoAbsoluto: { valor: 0.5, unidade: "mg" },
      apresentacoes: [ATROPINA_025],
      repeticao: "Repetir uma vez, se indicado.",
      par: "atropina-bradicardia-adulto",
      referencias: ["aha-2025-pals-bradicardia"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Não usar 1 mcg/kg de adrenalina como substituto da dose pediátrica de 10 mcg/kg.",
    "Na intoxicação, usar protocolo específico, com apoio especializado.",
  ],
  pensarEm: [
    "Hipóxia, reflexo vagal, raqui alta, fármacos, hipercalemia, isquemia, bloqueio de condução, hipotermia e toxicidade por anestésico local.",
  ],
  depois: [
    "ECG, eletrólitos e investigação da causa; cardiologia e estimulação quando indicadas.",
    "Registrar a resposta.",
  ],
  divergencias: [
    {
      tema: "Dose de atropina",
      posicoes: [{ texto: "20 mcg/kg, sem separar adulto e criança.", referencia: "manual-30" }],
      escolha: "O protocolo separa: adulto 1 mg (AHA 2025); criança 0,02 mg/kg, com mínimo de 0,1 mg e máximo de 0,5 mg por dose (PALS 2025).",
    },
  ],
  referencias: ["manual-30", "aha-2025-pals-bradicardia", "aha-2025-acls-bradicardia"],
  relacionados: [
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "hipotensao", texto: "Hipotensão grave" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto" },
    { protocolo: "hipercalemia", texto: "Hipercalemia" },
  ],
};

export const AUMENTO_ETCO2: Protocolo = {
  id: "aumento-etco2",
  titulo: "Aumento do CO2 expirado",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["hipercapnia", "EtCO2 alto", "CO2 subindo"],
  sinais: ["EtCO2 subindo", "EtCO2 alto", "hipercapnia", "CO2 inspirado", "cal sodada"],
  resumo: "Rever ventilação, circuito, absorvedor e insuflação de CO2; subida inexplicada com rigidez e taquicardia é hipertermia maligna até prova em contrário.",
  reconhecer: [
    "EtCO2 crescente, especialmente apesar de ventilação antes adequada.",
    "Observar a forma da curva e o CO2 inspirado.",
  ],
  agirAgora: [
    { texto: "Rever o paciente, a circulação, a temperatura, a ventilação e os agentes administrados." },
    { texto: "Conferir frequência e volume, circuito, válvulas e absorvedor. Corrigir hipoventilação ou reinalação." },
    { texto: "Rever com a cirurgia a insuflação de CO2, a reperfusão e bicarbonato recente." },
    { texto: "Aumento inexplicado com rigidez ou taquicardia: suspeitar de hipertermia maligna e tratar sem esperar a febre." },
    { texto: "Persistente ou grave: gasometria, eletrólitos e tratamento causal.", detalhe: "Não estimar a acidose apenas pelo EtCO2." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Conforme a causa. Hipertermia maligna e broncoespasmo: protocolos próprios.",
    "Não administrar bicarbonato para “tratar CO2 alto”.",
  ],
  pensarEm: [
    "Reinalação, absorvedor ou válvula, hipoventilação, insuflação, hipertermia maligna, sepse, tremor e hipermetabolismo.",
  ],
  depois: [
    "Documentar a tendência, os ajustes e a causa.",
    "Confirmar a normalização e o plano de seguimento.",
  ],
  divergencias: [],
  referencias: ["manual-31", "saesp-tratado"],
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
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["diminuição do CO2 expirado", "EtCO2 baixo", "sem capnografia", "perdeu a curva de CO2"],
  sinais: ["EtCO2 caindo", "sem curva de capnografia", "EtCO2 zero", "queda súbita do EtCO2"],
  resumo: "Pulso primeiro: sem pulso, PCR. Depois desconexão, tubo e amostragem; sem CO2 sustentado após intubar, excluir intubação esofágica.",
  reconhecer: [
    "Queda abrupta ou desaparecimento da curva.",
    "Pode representar falha ventilatória, falha da amostragem ou redução do fluxo pulmonar.",
  ],
  agirAgora: [
    { texto: "Avaliar imediatamente pulso, PA, tórax e ventilação. Sem pulso: PCR." },
    { texto: "Conferir desconexão, tubo, ventilador e linha de amostragem." },
    { texto: "Sem CO2 sustentado depois da intubação: excluir intubação esofágica e assegurar a oxigenação por via segura.",
      detalhe: "Baixo débito não dispensa a confirmação." },
    { texto: "Com a ventilação mantida, investigar choque, embolia, tensão, tamponamento e anafilaxia." },
    { texto: "Gasometria e eco conforme o contexto, sem atrasar o tratamento." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Conforme o mecanismo; não tratar o EtCO2 baixo reduzindo a ventilação antes de avaliar a circulação e a via aérea.",
  ],
  pensarEm: [
    "Intubação esofágica ou deslocamento, desconexão, obstrução, falha da amostra, hiperventilação, embolia e baixo débito ou PCR.",
  ],
  depois: [
    "Registrar o valor, a curva, a causa e a resposta.",
    "Manter a capnografia e o acompanhamento hemodinâmico.",
  ],
  divergencias: [],
  referencias: ["manual-32", "chrimes-2022"],
  relacionados: [
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "embolia-gasosa-venosa", texto: "Embolia gasosa venosa" },
  ],
};
