/**
 * OBSTETRÍCIA E REANIMAÇÃO NEONATAL — a revisão de 01/11/2026, protocolos 16
 * a 19.
 *
 * Origem: "AVANEST — Atualização dos protocolos obstétricos e de reanimação
 * neonatal", texto clínico enviado pelo responsável médico em 01/11/2026,
 * redigido sobre o Manual de Crises (abas 16 a 19), a OMS/FIGO/ICM 2025, a
 * AHA 2025, a FEBRASGO e as Diretrizes 2026 da SBP. O texto de cada etapa é o
 * do documento.
 *
 * Estado: CORRIGIDO — AGUARDANDO VALIDAÇÃO MÉDICA. Os quatro entram como
 * rascunho (protocolos/rascunhos.ts): quem usa continua com a versão 2,
 * aprovada em 15/10/2026. O rascunho anterior do colapso materno (magnésio
 * igual ao do cartão Eclâmpsia) foi substituído por este, que segue o texto
 * novo. Nenhuma aprovação aqui.
 *
 * Doses: as apresentações já cadastradas (protocolos/comum.ts), sem
 * concentração presumida. Ocitocina, misoprostol e carboprosta saem sem
 * volume: a apresentação do serviço ainda não foi informada.
 */

import type { DoseDoProtocolo, Passo, Protocolo } from "../tipos.ts";
import { COLAPSO_MATERNO, HEMORRAGIA_POS_PARTO, RAQUI_TOTAL } from "./obstetricia.ts";
import { REANIMACAO_NEONATAL } from "./reanimacao-neonatal.ts";
import {
  ADRENALINA_100, ADRENALINA_PURA_PCR, GLUCONATO_DE_CALCIO_10, MAGNESIO_20MG, MAGNESIO_50, MAGNESIO_80,
} from "./comum.ts";
import { ALVOS_SPO2 } from "../relogios.ts";

const REVISAO = "2026-11-01";

/** Uma dose da versão 2, com as mudanças desta; sem ela, erro. */
function dose(p: Protocolo, id: string, mudancas: Partial<DoseDoProtocolo> = {}): DoseDoProtocolo {
  const d = p.medicamentos.find((m) => m.id === id);
  if (!d) throw new Error(`${p.id}: dose ${id} não existe`);
  return { ...d, ...mudancas };
}

/** Adrenalina da PCR do adulto: a mesma do protocolo de PCR, 1 mg IV ou IO. */
const adrenalinaPcr = (id: string, indicacao: string, referencias: string[]): DoseDoProtocolo => ({
  id, farmaco: "Adrenalina", indicacao, populacao: "adulto", via: "IV ou IO",
  dose: { usual: 1, unidade: "mg", por: "fixa" }, apresentacoes: [ADRENALINA_100, ADRENALINA_PURA_PCR], altoRisco: true,
  repeticao: "A cada 3 a 5 minutos.",
  cuidados: ["Dose da PCR: não usar em pequenos bolus no paciente com pulso."],
  referencias,
});

// ---------------------------------------------------------------------------
// 16 — Bloqueio raquidiano alto ou total
// ---------------------------------------------------------------------------
export const RAQUI_TOTAL_V3: Protocolo = {
  ...RAQUI_TOTAL,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  sinonimos: [...new Set([...RAQUI_TOTAL.sinonimos, "bloqueio neuraxial total", "raquianestesia total"])],
  resumo: "Parar o neuroeixo, O2 e ventilação, vasopressor precoce e, na gestante, deslocamento uterino. Com pulso, suporte titulado; sem pulso, RCP. Paralisia não é inconsciência.",
  reconhecer: [
    "Bloqueio neuraxial excessivamente alto, com possível comprometimento simpático, motor, respiratório e cardiovascular.",
    "Hipotensão intensa.",
    "Bradicardia.",
    "Parestesia ou fraqueza de membros superiores.",
    "Dificuldade para falar ou respirar.",
    "Fraqueza muscular progressiva.",
    "Apneia.",
    "Rebaixamento de consciência.",
    "Colapso cardiovascular.",
    "Atenção: incapacidade de movimentar-se não significa necessariamente perda de consciência. O paciente pode permanecer consciente durante o bloqueio motor extenso.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda imediatamente.",
      detalhe: "Anuncie a suspeita de bloqueio neuraxial alto ou total, comunique-se com a equipe e interrompa qualquer administração adicional de anestésico pela via neuraxial." },
    { texto: "Mantenha comunicação com o paciente.",
      detalhe: "Se consciente, explique brevemente a situação e ofereça apoio. Avalie fala, força dos braços e capacidade ventilatória." },
    { texto: "Administre oxigênio e avalie a ventilação.",
      detalhe: "Utilize oxigênio suplementar e suporte ventilatório conforme a necessidade. Se houver hipoventilação ou apneia, inicie ventilação assistida sem demora." },
    { texto: "Trate precocemente a hipotensão.",
      detalhe: "Avalie pressão arterial, frequência cardíaca, perfusão e resposta ao tratamento. Administre vasopressor apropriado e fluidos quando indicados, sem sobrecarga indiscriminada." },
    { texto: "Na gestante, alivie a compressão aortocava.",
      detalhe: "Realize deslocamento uterino à esquerda quando o tamanho uterino indicar compressão relevante. Não utilizar Trendelenburg como tratamento automático da hipotensão: o posicionamento pode agravar o comprometimento respiratório e não substitui o suporte hemodinâmico." },
    { texto: "Trate a bradicardia com repercussão.",
      detalhe: "Administre atropina quando indicada, considerando imediatamente outras medidas de suporte se a resposta for inadequada.",
      abre: { protocolo: "bradicardia", texto: "Bradicardia grave" } },
    { texto: "Prepare via aérea avançada quando necessário.",
      detalhe: "Na presença de ventilação inadequada, apneia ou deterioração da consciência, assegure a ventilação e considere intubação traqueal. Individualize hipnose, bloqueio neuromuscular e estratégia de indução conforme a hemodinâmica. Não presumir inconsciência pelo bloqueio motor." },
    { texto: "Se houver perda de pulso, inicie RCP.",
      detalhe: "Siga imediatamente o protocolo de PCR correspondente ao ritmo. Na gestante, aplicar o algoritmo de PCR materna e preparar parto ressuscitativo quando indicado.",
      abre: { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" } },
    { texto: "Mantenha o suporte cardiorrespiratório.",
      detalhe: "Continue monitorizando até a regressão do bloqueio e a recuperação da função respiratória, hemodinâmica e neuromuscular." },
    { texto: "Defina a monitorização após a estabilização.",
      detalhe: "Considere recuperação anestésica prolongada ou UTI conforme gravidade, necessidade de ventilação e uso de vasoativos." },
  ],
  alertas: [
    "Com pulso: vasopressor titulado (fenilefrina, efedrina; adrenalina em pequenos bolus só por equipe experiente, com concentração validada). Sem pulso: RCP e adrenalina 1 mg IV/IO pelo algoritmo de PCR. Não confundir as duas situações.",
    "Não presumir inconsciência pelo bloqueio motor: o paciente pode estar consciente e paralisado.",
  ],
  medicamentos: [
    dose(RAQUI_TOTAL, "atropina-raqui", {
      indicacao: "Bradicardia instável — dose ACLS do adulto",
      repeticao: "A cada 3 a 5 minutos; máximo total de 3 mg.",
      cuidados: ["Não somar diferentes regimes de atropina provenientes de protocolos distintos."],
    }),
    dose(RAQUI_TOTAL, "fenilefrina-raqui", {
      indicacao: "Com pulso — bolus titulado conforme resposta e contexto",
      cuidados: ["Considerar o efeito sobre a frequência cardíaca e o débito cardíaco."],
    }),
    dose(RAQUI_TOTAL, "efedrina-raqui", {
      indicacao: "Com pulso — bolus, titular segundo a resposta hemodinâmica",
      dose: { min: 3, max: 6, unidade: "mg", por: "fixa" },
      cuidados: ["Conferir a apresentação."],
    }),
    dose(RAQUI_TOTAL, "adrenalina-raqui", {
      indicacao: "Com pulso e choque refratário — pequenos bolus titulados por equipe experiente",
      cuidados: ["Concentração validada e monitorização apropriada.", "Na PCR, a dose é 1 mg IV/IO: não confundir as duas situações."],
    }),
    adrenalinaPcr("adrenalina-pcr-raqui", "PCR — sem pulso, pelo algoritmo de ressuscitação", ["aha-2025-acls-pcr"]),
  ],
  notasDeDose: [
    "Cristaloides: administrar conforme a necessidade e a reavaliação da perfusão; evitar reposição excessiva em pacientes com risco de edema pulmonar.",
    "Hipnóticos e bloqueadores: selecionar individualmente conforme a necessidade de via aérea, a situação de consciência e a estabilidade circulatória.",
  ],
  pensarEm: [
    "Bloqueio neuraxial extenso, administração intratecal inadvertida por cateter epidural, toxicidade sistêmica por anestésico local, anafilaxia, hemorragia, reflexo vagal e complicações obstétricas.",
  ],
  depois: [
    "Registrar técnica anestésica, fármaco, concentração, dose, horário, evolução do nível de bloqueio, suporte ventilatório, medicamentos administrados e recuperação.",
    "Investigar a ocorrência de consciência durante a paralisia e informar o paciente.",
  ],
  divergencias: [
    {
      tema: "Bolus de efedrina",
      posicoes: [{ texto: "12 a 15 mg.", referencia: "manual-16" }],
      escolha: "O protocolo usa 3 a 6 mg IV, titulado segundo a resposta hemodinâmica, como no texto clínico de 01/11/2026.",
    },
  ],
  referencias: ["manual-16", "saesp-tratado", "aha-2025-acls-bradicardia", "qrh-3-11"],
  relacionados: [
    { protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" },
    { protocolo: "bradicardia", texto: "Bradicardia grave" },
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "toxicidade-anestesico-local", texto: "Toxicidade por anestésico local" },
  ],
};

// ---------------------------------------------------------------------------
// 17 — Hemorragia pós-parto
// ---------------------------------------------------------------------------
export const HEMORRAGIA_POS_PARTO_V3: Protocolo = {
  ...HEMORRAGIA_POS_PARTO,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "Diagnóstico pela OMS 2025 (≥500 mL, ou ≥300 mL com sinal anormal) e primeira resposta simultânea: massagem, ocitocina, ácido tranexâmico até 3 h, fluidos e a causa (4 Ts).",
  ferramenta: "tranexamico-hpp",
  reconhecer: [
    "Sangramento após o nascimento com risco de deterioração materna.",
    "A OMS recomenda iniciar o conjunto de primeira resposta diante de: perda sanguínea objetivamente mensurada ≥500 mL; ou perda ≥300 mL com pelo menos um sinal hemodinâmico anormal — FC >100/min, índice de choque >1, PAS <100 mmHg ou PAD <60 mmHg.",
    "Utilizar o primeiro critério atingido, com vigilância especial nas duas primeiras horas após o parto.",
    "Não aguardar hemoglobina baixa ou hipotensão profunda para iniciar o tratamento.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda imediatamente.",
      detalhe: "Acione obstetra, anestesiologista, enfermagem, hemoterapia e equipe cirúrgica conforme a gravidade." },
    { texto: "Quantifique a perda sanguínea.",
      detalhe: "Utilize métodos objetivos quando disponíveis. Avalie pressão, frequência cardíaca, índice de choque, perfusão e nível de consciência." },
    { texto: "Estabeleça acessos e monitorização.",
      detalhe: "Providencie dois acessos venosos calibrosos, monitorização hemodinâmica e coleta de exames. Considere acesso arterial e infusão rápida nos casos graves." },
    { texto: "Inicie as medidas de primeira resposta simultaneamente.",
      detalhe: "Não aguarde a conclusão de uma etapa para iniciar as demais. Realize massagem uterina na atonia, administre uterotônico, ácido tranexâmico e fluidos conforme a indicação, enquanto investiga e controla a fonte de sangramento." },
    { texto: "Identifique a causa — os quatro Ts.",
      detalhe: "Tônus: atonia uterina. Trauma: lacerações, hematomas ou rotura. Tecido: retenção placentária e alterações de implantação. Trombina: coagulopatia." },
    { texto: "Administre ocitocina como uterotônico de primeira linha.",
      detalhe: "Utilize o regime validado de tratamento da hemorragia, com administração IV lenta ou infusão. Não confundir com a profilaxia rotineira após o nascimento." },
    { texto: "Administre ácido tranexâmico precocemente.",
      detalhe: "Quando indicado, iniciar dentro de três horas após o nascimento. A administração deve ocorrer juntamente com o tratamento da causa, e não apenas depois da falha de uterotônicos." },
    { texto: "Inicie a ressuscitação circulatória.",
      detalhe: "Utilize cristaloides isotônicos aquecidos conforme a necessidade e a resposta. Se houver hemorragia importante, solicite imediatamente hemocomponentes. Não estabelecer volume fixo de cristaloide que obrigatoriamente precise ser administrado antes do sangue." },
    { texto: "Ative o protocolo de transfusão maciça quando indicado.",
      detalhe: "Avalie hemoglobina, plaquetas, fibrinogênio, INR/TTPa, gasometria, lactato, cálcio ionizado e temperatura. Considere TEG/ROTEM quando disponível.",
      abre: { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" } },
    { texto: "Escalone o controle da hemorragia.",
      detalhe: "Se o sangramento persistir, considere precocemente compressão uterina, tamponamento por balão, suturas hemostáticas e procedimentos vasculares ou cirúrgicos. Não retardar intervenção definitiva em hemorragia ameaçadora à vida." },
    { texto: "Corrija os distúrbios associados.",
      detalhe: "Trate hipotermia, hipocalcemia e coagulopatia. Em hemorragia obstétrica significativa, utilize estratégia de reposição de fibrinogênio que busque concentração de pelo menos 2 g/L, conforme exames e protocolo." },
    { texto: "Reavalie continuamente e planeje a recuperação.",
      detalhe: "Mantenha a quantificação das perdas, a monitorização da perfusão e a avaliação da necessidade de UTI." },
  ],
  medicamentos: [
    {
      id: "ocitocina-hpp-tratamento", farmaco: "Ocitocina", indicacao: "Tratamento — primeira linha", populacao: "adulto", via: "IV lenta",
      dose: { usual: 10, unidade: "UI", por: "fixa" }, apresentacoes: [],
      semVolume: "Conforme a ampola do serviço: conferir UI/mL antes de aspirar",
      velocidade: "Diluída, IV lenta em 1 a 2 minutos; ou diluída em pequeno volume de cristaloide, em 5 a 10 minutos.",
      cuidados: ["Evitar injeção IV rápida: risco de hipotensão e de efeitos cardiovasculares.", "Não confundir com a profilaxia rotineira após o nascimento."],
      referencias: ["oms-figo-icm-2025-hpp"],
    },
    {
      id: "ocitocina-hpp-manutencao", farmaco: "Ocitocina", indicacao: "Manutenção, ajustada à resposta e ao protocolo institucional", populacao: "adulto", via: "IV (infusão)",
      dose: { min: 10, max: 20, unidade: "UI", por: "fixa" }, apresentacoes: [],
      semVolume: "Diluída em cristaloide, conforme o protocolo institucional",
      velocidade: "Ao longo das 4 horas seguintes.",
      referencias: ["oms-figo-icm-2025-hpp"],
    },
    dose(HEMORRAGIA_POS_PARTO, "tranexamico-hpp", {
      indicacao: "O mais cedo possível, até 3 horas do nascimento, junto do tratamento da causa",
      altoRisco: true,
      velocidade: "Em 10 minutos.",
      repeticao: "Repetir 1 g IV se o sangramento persistir depois de 30 minutos ou recomeçar em até 24 horas da primeira dose. Total do regime: até 2 g.",
      cuidados: [
        "Exemplo de apresentação: 50 mg/mL, 20 mL para 1 g. Conferir a apresentação e o preparo antes de liberar o volume.",
        "Não esperar a falha dos uterotônicos nem perda extrema para indicar.",
      ],
      referencias: ["oms-figo-icm-2025-hpp", "oms-2017-txa"],
    }),
    dose(HEMORRAGIA_POS_PARTO, "metilergometrina-hpp", {
      indicacao: "Quando indicada e não contraindicada (ou ergometrina)",
      repeticao: "Repetições, intervalos e limite cumulativo conforme o protocolo obstétrico validado.",
      cuidados: [
        "Contraindicada ou não apropriada na hipertensão, na pré-eclâmpsia e em determinadas cardiopatias.",
        "Só IM: a via IV não está habilitada sem validação específica.",
      ],
      referencias: ["oms-figo-icm-2025-hpp", "manual-17", "saesp-tratado"],
    }),
    dose(HEMORRAGIA_POS_PARTO, "misoprostol-hpp", {
      indicacao: "Alternativa ou adjuvante — regime OMS de tratamento", via: "Sublingual",
      semVolume: "Conferir o comprimido disponível (em comprimidos de 200 mcg: 4)",
      cuidados: ["Vias retal e sublingual não são farmacologicamente idênticas.", "Conferir a dose e a via escolhidas no protocolo institucional."],
      referencias: ["oms-figo-icm-2025-hpp"],
    }),
    {
      id: "carboprosta-hpp", farmaco: "Carboprosta", indicacao: "Quando disponível e indicada", populacao: "adulto", via: "IM",
      dose: { usual: 250, unidade: "mcg", por: "fixa" }, apresentacoes: [],
      semVolume: "Conferir a disponibilidade e o registro do produto utilizado",
      repeticao: "Repetições segundo a resposta, o limite e o protocolo.",
      cuidados: ["Risco de broncoespasmo: evitar em pacientes com asma."],
      referencias: ["manual-17", "saesp-tratado"],
    },
  ],
  notasDeDose: [
    "Hemoterapia: reposição conforme gravidade, fonte de sangramento e exames; protocolos institucionais para plasma, plaquetas, crioprecipitado e concentrados.",
    "Meta de fibrinogênio de 2 g/L ou mais na hemorragia obstétrica.",
    "Corrigir cálcio ionizado e hipotermia.",
  ],
  pensarEm: [
    "Atonia uterina, rotura uterina, lacerações, retenção placentária, acretismo, coagulopatia, CIVD, hemorragia oculta e embolia por líquido amniótico.",
  ],
  depois: [
    "Monitorar sinais vitais, perfusão, diurese, hemoglobina, coagulação, temperatura e complicações transfusionais.",
    "Registrar perda total, tratamentos, hemocomponentes e procedimentos realizados.",
    "Realizar comunicação adequada com a paciente e a família.",
  ],
  divergencias: [
    ...HEMORRAGIA_POS_PARTO.divergencias.filter((d) => /ergot|cristaloide/.test(d.tema)).map((d) => (/ergot/.test(d.tema) ? {
      ...d, escolha: "A dose do Manual é a da ergometrina (ergotamina é outro fármaco). O protocolo usa 0,2 mg IM de metilergometrina; repetições, intervalos e limite seguem o protocolo obstétrico validado.",
    } : d)),
    {
      tema: "Ocitocina no tratamento",
      posicoes: [
        { texto: "Bolus de 5 UI e infusão de 10 UI por hora.", referencia: "manual-17" },
        { texto: "10 UI IV lenta em 1 a 2 minutos, ou diluída em 5 a 10 minutos; manutenção de 10 a 20 UI nas 4 horas seguintes.", referencia: "oms-figo-icm-2025-hpp" },
      ],
      escolha: "O protocolo segue o regime da OMS 2025, como no texto clínico de 01/11/2026.",
    },
    {
      tema: "Dose e via do misoprostol",
      posicoes: [
        { texto: "400 a 1.000 mcg retal ou sublingual.", referencia: "manual-17" },
        { texto: "800 mcg retal, como adjuvante (regime da versão 2).", referencia: "saesp-tratado" },
        { texto: "800 mcg sublingual.", referencia: "oms-figo-icm-2025-hpp" },
      ],
      escolha: "O protocolo segue a OMS 2025: 800 mcg sublingual. As vias não são equivalentes; conferir no protocolo institucional.",
    },
  ],
  referencias: ["oms-figo-icm-2025-hpp", "saesp-tratado", "manual-17", "oms-2017-txa"],
  relacionados: [
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" },
  ],
};

// ---------------------------------------------------------------------------
// 18 — Colapso materno e PCR na gestante
// ---------------------------------------------------------------------------
export const COLAPSO_MATERNO_V3: Protocolo = {
  ...COLAPSO_MATERNO,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "Com pulso, suporte e causa; sem pulso, RCP com deslocamento uterino, doses e energia do adulto e parto ressuscitativo preparado desde o reconhecimento — nascimento até 5 minutos, no local.",
  ferramenta: "cronometro-pcr-materna",
  reconhecer: [
    "Deterioração súbita do estado materno com alteração de consciência, respiração ou circulação, podendo evoluir para parada cardíaca.",
    "Colapso com pulso: suporte circulatório e respiratório, com tratamento causal.",
    "Parada cardíaca: ausência de pulso, exigindo RCP e algoritmo específico para gestante.",
    "Considerar compressão aortocava quando o fundo uterino estiver na altura ou acima do umbigo.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda e ative a equipe de emergência materna.",
      detalhe: "Inclua anestesia, obstetrícia, neonatologia, enfermagem e recursos avançados conforme disponibilidade. Delegue compressões, via aérea, deslocamento uterino, acesso vascular, medicamentos e registro de tempos." },
    { texto: "Avalie consciência, respiração e circulação.",
      detalhe: "Determine rapidamente a presença de pulso. Se houver pulso, estabilize e trate a causa." },
    { texto: "Na ausência de pulso, inicie RCP imediatamente.",
      detalhe: "Utilize superfície firme e compressões de alta qualidade. Quando o fundo uterino estiver na altura ou acima do umbigo, faça deslocamento uterino manual contínuo para a esquerda." },
    { texto: "Identifique o ritmo e siga o algoritmo correspondente.",
      detalhe: "Desfibrile quando indicado. As doses habituais de medicamentos de PCR adulta e a energia de desfibrilação não devem ser reduzidas exclusivamente pela gestação.",
      abre: { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" } },
    { texto: "Priorize a oxigenação e a via aérea adequada.",
      detalhe: "Administre oxigênio e suporte ventilatório. Considere manejo precoce por operador experiente, devido ao maior risco de aspiração e à dificuldade potencial da via aérea. Não interrompa compressões desnecessariamente para intubação.",
      abre: { protocolo: "via-aerea-dificil-gestante", texto: "Via aérea difícil na gestante" } },
    { texto: "Garanta acesso vascular apropriado.",
      detalhe: "Preferir acesso IV ou IO acima do diafragma durante a PCR materna. Retire dispositivos de monitorização fetal que possam dificultar a ressuscitação." },
    { texto: "Prepare imediatamente o parto ressuscitativo quando indicado.",
      detalhe: "Se o fundo uterino estiver na altura ou acima do umbigo e a gestante permanecer sem circulação espontânea, a equipe deve iniciar a preparação desde o reconhecimento da PCR. O objetivo é concluir o nascimento em até cinco minutos, se não houver retorno da circulação. Não aguarde completar quatro minutos para só então começar a preparação. Sempre que possível, realizar no local da PCR, evitando atraso por transporte." },
    { texto: "Identifique e trate causas reversíveis.",
      detalhe: "Investigue complicações anestésicas, hemorragia, embolias, cardiopatias, eclâmpsia, toxicidade por medicamentos e outras causas. Se ocorrer PCR durante infusão de sulfato de magnésio, interrompa a infusão e administre cálcio conforme o algoritmo materno." },
    { texto: "Após o parto ou o retorno da circulação, continue o suporte avançado.",
      detalhe: "Mantenha cuidados maternos e neonatais em paralelo, com equipes próprias quando possível.",
      abre: { protocolo: "reanimacao-neonatal", texto: "Reanimação neonatal" } },
    { texto: "Registre os tempos e organize os cuidados posteriores.",
      detalhe: "Documente horário do colapso, início da RCP, medicamentos, nascimento e retorno da circulação." },
  ],
  alertas: [
    "Fundo uterino na altura do umbigo ou acima: deslocamento uterino manual contínuo para a esquerda durante toda a RCP.",
    "Parto ressuscitativo: preparar desde o reconhecimento da PCR, no local. Sem retorno da circulação, nascimento em até 5 minutos — não esperar 4 minutos para começar o preparo.",
    "Doses de PCR e energia de desfibrilação do adulto: não reduzir pela gestação.",
  ],
  quadros: [
    {
      titulo: "Eclâmpsia com pulso — ramo separado",
      itens: [
        "Sulfato de magnésio: ataque de 4 a 6 g IV em aproximadamente 20 minutos; manutenção de 1 a 2 g/h IV.",
        "Nova convulsão: considerar dose adicional de 2 g IV, conforme avaliação clínica.",
        "Ajustar a manutenção na disfunção renal; monitorar reflexos, frequência respiratória, diurese e sinais de toxicidade.",
        "O magnésio não substitui o tratamento da hipertensão grave: PAS ≥160 mmHg e/ou PAD ≥110 mmHg persistentes — avaliar e tratar pelo protocolo obstétrico específico.",
        "Toxicidade por magnésio: suspender a infusão, garantir oxigenação e suporte ventilatório e administrar gluconato de cálcio 10%, 1 g IV lentamente (10 mL), com monitorização.",
      ],
    },
  ],
  medicamentos: [
    adrenalinaPcr("adrenalina-pcr-materna", "PCR materna, pelo algoritmo do adulto", ["aha-2025-pcr-gestante"]),
    dose(COLAPSO_MATERNO, "magnesio-ataque", {
      indicacao: "Eclâmpsia com pulso — ataque",
      dose: { min: 4, max: 6, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_80, MAGNESIO_50], altoRisco: true,
      velocidade: "Em aproximadamente 20 minutos (na solução de 80 mg/mL: 4 g = 50 mL a 150 mL/h; 6 g = 75 mL a 225 mL/h).",
      cuidados: ["Na ampola de 50%, diluir antes: 4 a 6 g são 8 a 12 mL.", "Conferir em voz alta, com outra pessoa: concentração, gramas, mL e velocidade da bomba."],
      referencias: ["febrasgo-eclampsia", "ms-2022-alto-risco"],
    }),
    dose(COLAPSO_MATERNO, "magnesio-manutencao", {
      indicacao: "Eclâmpsia com pulso — manutenção, em bomba de infusão",
      apresentacoes: [MAGNESIO_80, MAGNESIO_20MG], altoRisco: true,
      cuidados: ["Ajustar na disfunção renal; monitorar reflexos, frequência respiratória, diurese e sinais de toxicidade."],
      referencias: ["febrasgo-eclampsia", "ms-2022-alto-risco"],
    }),
    dose(COLAPSO_MATERNO, "magnesio-recorrencia", {
      indicacao: "Eclâmpsia — nova convulsão, dose adicional conforme avaliação clínica",
      apresentacoes: [MAGNESIO_80, MAGNESIO_50], altoRisco: true,
      cuidados: ["Na ampola de 50%: diluir antes."],
      referencias: ["febrasgo-eclampsia", "ms-2022-alto-risco"],
    }),
    dose(COLAPSO_MATERNO, "gluconato-intoxicacao-magnesio", {
      indicacao: "Toxicidade por magnésio, com suporte ventilatório",
      apresentacoes: [GLUCONATO_DE_CALCIO_10],
      velocidade: "Lentamente, com monitorização.",
      cuidados: ["Suspender a infusão de magnésio."],
      referencias: ["febrasgo-eclampsia", "ms-2022-alto-risco"],
    }),
  ],
  notasDeDose: [
    "PCR materna: seguir os algoritmos de PCR do adulto — adrenalina 1 mg IV/IO a cada 3 a 5 minutos.",
    "Desfibrilação: a mesma energia apropriada para adultos; não reduzir a energia apenas pela gestação.",
    "PCR durante infusão de sulfato de magnésio: interromper a infusão e administrar cálcio conforme o algoritmo materno.",
    "O sulfato de magnésio não substitui o tratamento da hipertensão arterial grave.",
  ],
  pensarEm: [
    "Hemorragia obstétrica, bloqueio neuraxial alto, toxicidade sistêmica por anestésico local, anafilaxia, embolia pulmonar, embolia por líquido amniótico, eclâmpsia, cardiomiopatia periparto, sepse e causas gerais de PCR.",
  ],
  depois: [
    "Monitorização intensiva materna e neonatal.",
    "Avaliação de lesões decorrentes da reanimação, de possíveis disfunções orgânicas e de causas reversíveis.",
    "Debriefing com a equipe e apoio à família.",
  ],
  divergencias: [
    ...COLAPSO_MATERNO.divergencias.filter((d) => /parto ressuscitativo/.test(d.tema)),
    {
      tema: "Esquema do sulfato de magnésio",
      posicoes: [
        { texto: "Ataque de 4 g em 15 minutos; 1 g/h por 24 horas; 2 g se as convulsões persistirem.", referencia: "manual-18" },
        { texto: "Ataque de 4 g EV em 5 a 10 minutos; manutenção de 1 a 2 g/h; nova convulsão, 2 g.", referencia: "ms-2022-alto-risco" },
        { texto: "Ataque de 4 a 6 g IV em cerca de 20 minutos; manutenção de 1 a 2 g/h; nova convulsão, 2 g (texto clínico de 01/11/2026).", referencia: "febrasgo-eclampsia" },
      ],
      escolha: "O cartão segue o texto clínico de 01/11/2026. O cartão Eclâmpsia usa 4 g em 15 minutos e 1 g/h: dois esquemas no mesmo app — decidir qual vale para os dois.",
    },
  ],
  referencias: ["aha-2025-pcr-gestante", "febrasgo-eclampsia", "saesp-tratado", "manual-18", "ms-2022-alto-risco"],
  relacionados: [
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "eclampsia", texto: "Eclâmpsia" },
    { protocolo: "hemorragia-pos-parto", texto: "Hemorragia pós-parto" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto ou total" },
    { protocolo: "reanimacao-neonatal", texto: "Reanimação neonatal" },
  ],
};

// ---------------------------------------------------------------------------
// 19 — Reanimação neonatal: dois algoritmos, por idade gestacional
// ---------------------------------------------------------------------------
const MAIOR = "34-ou-mais";
const MENOR = "menos-de-34";

function algoritmo(ramo: string, caminho: string, termo: boolean): Passo[] {
  const p = (texto: string, detalhe: string): Passo => ({ texto, detalhe, ramo, caminho });
  return [
    p("Inicie o cronômetro e avalie rapidamente o nascimento.",
      "A equipe deve estar preparada previamente, com equipamentos conferidos e funções distribuídas."),
    p("Execute os cuidados iniciais de termorregulação.", termo
      ? "Aqueça, mantenha normotermia, posicione e seque conforme a idade gestacional."
      : "Aqueça, mantenha normotermia, posicione e seque conforme a idade gestacional. Em prematuros muito imaturos, aplicar medidas específicas de proteção térmica previstas pela SBP."),
    p("Avalie respiração, tônus e frequência cardíaca.",
      "Recém-nascido com boa vitalidade deve receber cuidados de rotina e monitorização apropriada. Se houver apneia, gasping, respiração inadequada ou FC <100 bpm, prepare o suporte ventilatório."),
    p("Inicie ventilação com pressão positiva nos primeiros 60 segundos quando indicada.", termo
      ? "No RN de 34 semanas ou mais, iniciar geralmente com ar ambiente, ajustando o oxigênio conforme a evolução e a saturação pré-ductal. Utilize frequência de 30–60 ventilações por minuto, conforme a SBP 2026."
      : "No RN de menos de 34 semanas, iniciar com FiO2 de referência de 60%, titulada pela saturação pré-ductal. Preferir ventilador manual com peça T e mistura oxigênio/ar, com pressão e PEEP conforme o algoritmo da SBP 2026 para menores de 34 semanas. Não extrapolar automaticamente os parâmetros do recém-nascido a termo."),
    p("Monitore frequência cardíaca e SpO2.",
      "Posicione o sensor pré-ductal no membro superior direito. Considere monitor cardíaco para avaliação rápida e contínua da frequência. A melhora da frequência cardíaca é o principal indicador de ventilação efetiva."),
    p("Se não houver melhora, corrija a ventilação.",
      "Revise posição da cabeça, vedação da máscara, permeabilidade da via aérea, pressão utilizada e equipamento. Aspirar somente quando houver obstrução ou indicação específica."),
    p("Se a ventilação permanecer inadequada, considere via aérea alternativa.",
      "Utilize máscara laríngea ou cânula traqueal conforme idade gestacional, peso, indicação e competência do operador. Não insistir em ventilação ineficaz."),
    p("Reavalie após ventilação efetiva.",
      "Se FC ≥100 bpm, ajuste o suporte conforme respiração e SpO2. Se a frequência permanecer <60 bpm após 30 segundos de ventilação adequada com expansão pulmonar, inicie compressões torácicas."),
    p("Inicie compressões coordenadas à ventilação.",
      "Utilize relação 3:1. Objetivo: 90 compressões e 30 ventilações por minuto, totalizando 120 eventos por minuto. Realize compressões no terço inferior do esterno, preferencialmente com dois polegares envolvendo o tórax. Durante as compressões, utilize O2 a 100%, reduzindo após a recuperação conforme a SpO2."),
    p("Se a FC permanecer <60 bpm após pelo menos 60 segundos de compressões e ventilação adequadas, administre adrenalina.",
      "Obtenha acesso vascular, preferencialmente cateter venoso umbilical. A via intraóssea é alternativa em situações apropriadas. Reavalie ventilação, compressões e acesso."),
    p("Considere hipovolemia quando houver suspeita de perda sanguínea.",
      "Avalie sinais de choque, hemorragia e falha de resposta às intervenções. Considere expansão de volume somente quando indicada."),
    p("Após a estabilização, inicie os cuidados pós-reanimação.",
      "Monitorize oxigenação, frequência cardíaca, temperatura, glicemia e sinais neurológicos. Defina necessidade de UTI neonatal, suporte ventilatório e avaliação de encefalopatia hipóxico-isquêmica."),
  ];
}

export const REANIMACAO_NEONATAL_V3: Protocolo = {
  ...REANIMACAO_NEONATAL,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "Escolher a idade gestacional: dois algoritmos. Aquecer, VPP no primeiro minuto (ar ambiente a partir de 34 semanas; FiO2 60% abaixo), FC guia tudo; abaixo de 60, compressões 3:1 e adrenalina 0,02 mg/kg.",
  ramos: {
    campo: "idadeGestacional",
    pergunta: "Idade gestacional",
    opcoes: [{ id: MAIOR, rotulo: "34 semanas ou mais" }, { id: MENOR, rotulo: "Menos de 34 semanas" }],
  },
  ferramenta: "cronometro-nascimento",
  reconhecer: [
    "Avaliar ao nascimento: idade gestacional, respiração ou choro, tônus muscular e frequência cardíaca.",
    "A necessidade de intervenção depende principalmente da respiração e da frequência cardíaca, considerando a condição clínica.",
    "Apneia, respiração irregular/gasping ou FC <100 bpm após os passos iniciais indicam necessidade de ventilação com pressão positiva.",
    "Dois algoritmos independentes, por idade gestacional: 34 semanas ou mais, e menos de 34 semanas.",
  ],
  agirAgora: [...algoritmo(MAIOR, "A. 34 semanas ou mais", true), ...algoritmo(MENOR, "B. Menos de 34 semanas", false)],
  quadros: [
    {
      titulo: "Ventilação e oxigênio — 34 semanas ou mais", ramo: MAIOR,
      itens: [
        "VPP inicial geralmente em ar ambiente (FiO2 21%).",
        "Frequência: 30–60 movimentos por minuto.",
        "Pressão inspiratória inicial de referência: aproximadamente 20–30 cmH2O, ajustada à expansão torácica e à frequência cardíaca.",
        "Peça T: considerar PEEP inicial de 5 cmH2O.",
        "Titular a FiO2 conforme a SpO2 pré-ductal.",
        "Durante as compressões, FiO2 de 100%.",
      ],
    },
    {
      titulo: "Ventilação e oxigênio — menos de 34 semanas", ramo: MENOR,
      itens: [
        "Utilizar o algoritmo específico da SBP 2026.",
        "VPP inicial com FiO2 de referência de 60%, seguida de titulação pela saturação pré-ductal.",
        "Preferir ventilador manual com peça T e mistura oxigênio/ar.",
        "Aplicar medidas rigorosas de termorregulação, pressão e PEEP.",
        "Não extrapolar automaticamente os parâmetros de recém-nascidos a termo.",
      ],
    },
    {
      titulo: "Saturação pré-ductal alvo — SBP 2026",
      itens: ["Não utilizar uma meta fixa de SpO2 de 100% durante toda a reanimação neonatal."],
      tabela: { colunas: ["Tempo após o nascimento", "SpO2"], linhas: ALVOS_SPO2.map((a) => [`${a.minuto} minutos`, a.faixa]) },
    },
  ],
  medicamentos: [
    dose(REANIMACAO_NEONATAL, "adrenalina-rn-iv", {
      indicacao: "FC <60 bpm após 60 s de compressões e ventilação adequadas",
      repeticao: "A cada 3 a 5 minutos, se a FC permanecer <60 bpm apesar de ventilação e compressões adequadas.",
      velocidade: "Intravascular rápida, seguida de flush conforme o protocolo neonatal.",
      cuidados: [
        "Dose operacional da SBP 2026: 0,02 mg/kg (20 mcg/kg) = 0,2 mL/kg da solução de 0,1 mg/mL.",
        "A AHA/AAP 2025 descreve 0,01 a 0,03 mg/kg; o cartão usa a dose padrão de 0,02 mg/kg da SBP 2026.",
        "Não usar a dose traqueal pela via IV/IO.",
      ],
      referencias: ["sbp-2026-rn", "aha-aap-2025-neonatal"],
    }),
    dose(REANIMACAO_NEONATAL, "adrenalina-rn-traqueal", {
      indicacao: "Sem acesso — alternativa temporária enquanto se obtém o acesso intravascular",
      velocidade: "Diretamente pelo tubo traqueal, seguida de ventilação.",
      cuidados: [
        "Dose operacional da SBP 2026: 0,1 mg/kg = 1 mL/kg da solução de 0,1 mg/mL.",
        "Não atrasar o acesso intravascular.",
        "Não aplicar a dose traqueal pela via IV/IO.",
      ],
      referencias: ["sbp-2026-rn"],
    }),
  ],
  volumes: REANIMACAO_NEONATAL.volumes.map((v) => ({
    ...v, indicacao: "Suspeita de hipovolemia ou hemorragia — em 5 a 10 minutos",
    repeticao: "Reavaliar imediatamente. Não administrar de rotina sem evidência de perda sanguínea.",
  })),
  notasDeDose: [
    "Doses por kg só depois de escolher a idade gestacional e informar o peso.",
    "Hemocomponentes conforme a suspeita de anemia fetal grave, hemorragia e o protocolo neonatal.",
  ],
  pensarEm: [
    "Ventilação ineficaz, obstrução de via aérea, apneia, prematuridade, hemorragia fetal, pneumotórax, hipovolemia, cardiopatias congênitas e complicações do nascimento.",
  ],
  depois: [
    "Monitorização neonatal, glicemia, temperatura, sinais de encefalopatia, suporte respiratório e necessidade de UTI.",
    "Hipotermia terapêutica: para RN de idade gestacional ≥36 semanas com encefalopatia hipóxico-isquêmica moderada ou grave e critérios de elegibilidade, considerar tratamento em centro capacitado, iniciado dentro de seis horas e realizado segundo protocolo especializado.",
    "Não iniciar hipotermia terapêutica indiscriminadamente em qualquer recém-nascido submetido a reanimação.",
    "Registrar horários, FC, SpO2, intervenções, medicamentos, resposta e destino.",
  ],
  divergencias: [
    {
      tema: "Dose de adrenalina intravascular",
      posicoes: [
        { texto: "10 mcg/kg, podendo subir para 30 mcg/kg (a frente do cartão diz “10–30 mcg”, sem o por kg).", referencia: "manual-19" },
        { texto: "0,01 a 0,03 mg/kg IV/IO.", referencia: "aha-aap-2025-neonatal" },
        { texto: "0,02 mg/kg IV/IO; traqueal, 0,1 mg/kg.", referencia: "sbp-2026-rn" },
      ],
      escolha: "O protocolo usa a dose operacional padrão de 0,02 mg/kg da SBP 2026, dentro da faixa da AHA/AAP 2025; os parâmetros de 2026 não são atribuídos ao Manual.",
    },
  ],
  referencias: ["sbp-2026-rn", "sbp-2026-rn-pre-termo", "aha-aap-2025-neonatal", "aap-2026-hipotermia-neonatal", "manual-19"],
  relacionados: [
    { protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" },
    { protocolo: "sav-pediatrico", texto: "Suporte avançado de vida pediátrico" },
  ],
};

/** Os quatro, na ordem do Manual (16 a 19). */
export const OBSTETRICIA_NEONATAL_V3: readonly Protocolo[] = [
  RAQUI_TOTAL_V3, HEMORRAGIA_POS_PARTO_V3, COLAPSO_MATERNO_V3, REANIMACAO_NEONATAL_V3,
];
