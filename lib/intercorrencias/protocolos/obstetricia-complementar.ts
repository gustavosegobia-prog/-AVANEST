/**
 * OBSTETRÍCIA — cartões 09 a 11 da minuta preliminar “Protocolos de crise”
 * (outubro de 2026): eclâmpsia, embolia amniótica e via aérea difícil na
 * gestante.
 *
 * Versão 2: revisão científica de 16/10/2026. Conferidos no texto: NICE NG133
 * e Manual de Crises (abas 18 e 34) para o magnésio; Manual de Gestação de
 * Alto Risco (MS 2022), já conferido no cadastro; SMFM 2026 (lista de
 * verificação da embolia amniótica); OAA/DAS 2015 (via aérea obstétrica);
 * bula do sugamadex. O preparo de 124 mL do Tratado SAESP vem da minuta e não
 * foi localizado no livro: segue como opção, pendente de conferência. Todo
 * cálculo de magnésio pede a confirmação da concentração antes do volume. O
 * texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import {
  GLUCONATO_DE_CALCIO_10, MAGNESIO_50, MAGNESIO_80, MAGNESIO_SAESP_124, NORADRENALINA_80, SUGAMADEX_100, TRANEXAMICO_50,
} from "./comum.ts";

const REVISAO = "2026-10-16";

export const ECLAMPSIA: Protocolo = {
  id: "eclampsia",
  titulo: "Eclâmpsia",
  categoria: "obstetricia",
  populacoes: ["gestante"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["convulsão na gestante", "convulsão na puérpera", "sulfato de magnésio", "magnésio", "pré-eclâmpsia grave", "HELLP"],
  sinais: ["convulsão", "gestante", "puérpera", "hipertensão", "cefaleia", "escotomas", "rebaixamento"],
  resumo: "Convulsão em gestante ou puérpera com doença hipertensiva: proteger e oxigenar; sulfato de magnésio 4 g em 15 minutos e 1 g/h por 24 horas; tratar a hipertensão grave; parto depois de estabilizar.",
  reconhecer: [
    "Convulsão em gestante ou puérpera com pré-eclâmpsia ou hipertensão; pode ocorrer sem hipertensão grave.",
    "Sinais de iminência: cefaleia persistente, escotomas, náusea ou vômito, dor epigástrica, oligúria com hipertensão grave, piora de plaquetas, creatinina ou transaminases.",
  ],
  agirAgora: [
    { texto: "Chamar anestesia, obstetrícia e UTI; proteger e posicionar em decúbito lateral." },
    { texto: "Via aérea, O2 e ventilação; monitorizar mãe e feto." },
    { texto: "Sulfato de magnésio: ataque e manutenção em bomba.", detalhe: "É o anticonvulsivante da eclâmpsia: não usar diazepam nem fenitoína no lugar dele." },
    { texto: "Conferir em voz alta, com outra pessoa: concentração do frasco, gramas, mL e velocidade da bomba." },
    { texto: "Nova convulsão: dose adicional de magnésio." },
    { texto: "Hipertensão grave: tratar já (hidralazina IV, nifedipino oral ou labetalol), pelo protocolo obstétrico." },
    { texto: "Exames: hemograma com plaquetas, creatinina, enzimas hepáticas, eletrólitos e coagulação." },
    { texto: "Parto depois da estabilização materna." },
  ],
  medicamentos: [
    {
      id: "magnesio-eclampsia-ataque", farmaco: "Sulfato de magnésio", indicacao: "Ataque", populacao: "adulto", via: "IV",
      dose: { usual: 4, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_80, MAGNESIO_50], altoRisco: true,
      velocidade: "Em 15 minutos (na solução de 80 mg/mL, 200 mL/h).",
      cuidados: ["Na ampola de 50%, 4 g são 8 mL: diluir antes."],
      referencias: ["nice-ng133", "manual-34", "manual-18"],
    },
    {
      id: "magnesio-eclampsia-manutencao", farmaco: "Sulfato de magnésio", indicacao: "Manutenção, em bomba de infusão", populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "h" }, apresentacoes: [MAGNESIO_80, MAGNESIO_SAESP_124], altoRisco: true,
      repeticao: "Por 24 horas depois do parto ou da última convulsão, o que vier por último.",
      cuidados: [
        "Vigiar reflexo patelar, frequência respiratória, consciência e diurese.",
        "Oligúria ou creatinina subindo: magnésio sérico e revisão da manutenção com a obstetrícia.",
      ],
      referencias: ["nice-ng133", "manual-34"],
    },
    {
      id: "magnesio-eclampsia-recorrencia", farmaco: "Sulfato de magnésio", indicacao: "Nova convulsão — dose adicional", populacao: "adulto", via: "IV",
      dose: { min: 2, max: 4, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_80, MAGNESIO_50], altoRisco: true,
      velocidade: "Em 5 a 15 minutos.",
      cuidados: ["Na ampola de 50%: diluir antes."],
      referencias: ["nice-ng133", "ms-2022-alto-risco"],
    },
    {
      id: "gluconato-eclampsia", farmaco: "Gluconato de cálcio 10%", indicacao: "Intoxicação por magnésio, junto do suporte ventilatório", populacao: "adulto",
      via: "IV lento",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      cuidados: ["Parar a infusão de magnésio."],
      referencias: ["ms-2022-alto-risco"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Preparo do Manual de Crises: 16 mL de sulfato de magnésio 50% (8 g) completados para 100 mL de SF 0,9% = 80 mg/mL; ataque de 4 g = 50 mL a 200 mL/h por 15 minutos; manutenção de 1 g/h = 12,5 mL/h.",
    "Intoxicação por magnésio (perda do reflexo patelar, depressão respiratória, rebaixamento): parar a infusão, ventilar e dar gluconato de cálcio.",
    "Fluidos na pré-eclâmpsia grave: manutenção limitada a 80 mL/h, salvo perdas.",
  ],
  pensarEm: [
    "Outras causas de convulsão na gestante: hipoglicemia, toxicidade por anestésico local, AVC ou trombose venosa cerebral, epilepsia.",
  ],
  depois: [
    "Manter o magnésio por 24 horas depois do parto ou da última convulsão; UTI ou unidade de cuidado materno.",
    "Vigiar reflexos, frequência respiratória, consciência, diurese e função renal; magnésio sérico se oligúria.",
    "Uso de magnésio por mais de 5 a 7 dias na gestação: avisar a neonatologia (cálcio, magnésio e ossos do recém-nascido).",
  ],
  divergencias: [
    {
      tema: "Tempo do ataque e ritmo da manutenção",
      posicoes: [
        { texto: "4 g IV em 5 a 15 minutos; 1 g/h por 24 horas; recorrência, 2 a 4 g em 5 a 15 minutos.", referencia: "nice-ng133" },
        { texto: "4 g em 15 minutos (200 mL/h da solução de 8 g em 100 mL); 1 g/h (12,5 mL/h); 2 g se as convulsões persistirem.", referencia: "manual-34" },
        { texto: "Ataque de 4 g EV em 5 a 10 minutos; manutenção de 1 a 2 g/h; nova convulsão, 2 g.", referencia: "ms-2022-alto-risco" },
      ],
      escolha: "O cartão usa 4 g em 15 minutos e 1 g/h: o ponto comum ao NICE e ao Manual, com o preparo do Manual. A minuta citava o Tratado SAESP (10 a 20 minutos; 12 g em 124 mL), sem página localizada. O cartão Colapso materno (versão 2, aprovado) ainda traz 20 a 30 minutos e 1 a 2 g/h: precisa ser alinhado numa nova aprovação.",
    },
  ],
  referencias: ["nice-ng133", "manual-18", "manual-34", "ms-2022-alto-risco"],
  relacionados: [
    { protocolo: "hipertensao", texto: "Crise hipertensiva" },
    { protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" },
    { protocolo: "convulsao-perioperatoria", texto: "Convulsão perioperatória" },
  ],
};

export const EMBOLIA_AMNIOTICA: Protocolo = {
  id: "embolia-amniotica",
  titulo: "Embolia amniótica",
  categoria: "obstetricia",
  populacoes: ["gestante"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["embolia de líquido amniótico", "EmLA", "síndrome anafilactoide da gravidez", "colapso no parto"],
  sinais: ["colapso", "hipóxia", "dessaturação", "hipotensão", "PCR", "coagulopatia", "sangramento", "parto", "cesárea"],
  resumo: "Colapso cardiorrespiratório no parto ou logo depois: RCP com deslocamento uterino e parto em até 4 minutos se sem pulso; suporte do ventrículo direito sem sobrecarga de volume; transfusão maciça cedo, com crioprecipitado e ácido tranexâmico.",
  reconhecer: [
    "Colapso súbito durante o trabalho de parto, a cesárea ou até 30 minutos depois da saída da placenta.",
    "Diagnóstico clínico: PCR ou hipotensão com comprometimento respiratório, CIVD franca e ausência de febre.",
    "Hipoxemia, hipotensão e disfunção de ventrículo direito; a CIVD aparece em mais de 80% e costuma confirmar o diagnóstico.",
  ],
  agirAgora: [
    { texto: "Declarar a emergência; via aérea, O2 e ventilação; designar quem marca o tempo a cada minuto." },
    { texto: "Sem pulso: RCP de qualidade, prancha e deslocamento manual do útero para a esquerda; retirar os monitores fetais." },
    { texto: "Sem retorno da circulação em 4 minutos: parto imediato (histerotomia ressuscitativa) no local.", detalhe: "Só ir ao centro cirúrgico se levar menos de 2 minutos. Antissepsia rápida, sem esperar antibiótico." },
    { texto: "Ativar cedo o protocolo de transfusão maciça; prever atonia, CIVD e hemorragia." },
    { texto: "Ventrículo direito: ecocardiograma; volume em bolus pequenos e reavaliar; vasopressor e inotrópico; vasodilatador pulmonar." },
    { texto: "Coagulação guiada por tromboelastometria se disponível; crioprecipitado preferido ao plasma; ácido tranexâmico se CIVD ou hemorragia." },
    { texto: "Refratária (RCP prolongada ou falência de ventrículo direito): ECMO, mesmo com coagulopatia." },
    { texto: "Depois do retorno: reduzir a FiO2 para SpO2 de 94 a 98%." },
  ],
  medicamentos: [
    {
      id: "tranexamico-afe", farmaco: "Ácido tranexâmico", indicacao: "CIVD ou hemorragia", populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [TRANEXAMICO_50],
      velocidade: "Em 10 minutos.",
      referencias: ["smfm-2026-embolia-amniotica"],
    },
    {
      id: "noradrenalina-afe", farmaco: "Noradrenalina", indicacao: "Vasopressor — dose inicial, titular", populacao: "adulto", via: "IV",
      dose: { usual: 0.05, unidade: "mcg", por: "kg/min" }, apresentacoes: [NORADRENALINA_80], altoRisco: true,
      cuidados: ["Faixa da fonte: 0,05 a 3,3 mcg/kg/min, titulada pela pressão."],
      referencias: ["smfm-2026-embolia-amniotica"],
    },
    {
      id: "dobutamina-afe", farmaco: "Dobutamina", indicacao: "Inotrópico, se necessário", populacao: "adulto", via: "IV",
      dose: { min: 2.5, max: 5, unidade: "mcg", por: "kg/min" }, apresentacoes: [],
      semVolume: "Pela diluição padronizada do serviço",
      referencias: ["smfm-2026-embolia-amniotica"],
    },
    {
      id: "milrinona-afe", farmaco: "Milrinona", indicacao: "Inotrópico, alternativa à dobutamina", populacao: "adulto", via: "IV",
      dose: { min: 0.25, max: 0.75, unidade: "mcg", por: "kg/min" }, apresentacoes: [],
      semVolume: "Pela diluição padronizada do serviço",
      referencias: ["smfm-2026-embolia-amniotica"],
    },
  ],
  volumes: [
    { id: "volume-afe", rotulo: "Bolus", indicacao: "Por vez, e reavaliar; para repor volume, preferir hemocomponentes a cristaloide ou coloide",
      populacao: "adulto", fixo: { min: 500 }, referencias: ["smfm-2026-embolia-amniotica"] },
  ],
  notasDeDose: [
    "Vasodilatador pulmonar para aliviar o ventrículo direito: óxido nítrico inalatório 5–40 ppm; epoprostenol inalatório 10–50 ng/kg/min ou IV 1–2 ng/kg/min (acesso central); sildenafila 20 mg VO se acordada.",
    "Ocitocina e outros uterotônicos pelo protocolo de hemorragia pós-parto do serviço.",
    "Não usar de rotina a combinação atropina, ondansetrona e cetorolaco: evidência só de relatos de caso, com risco renal, de sangramento e arritmia.",
    "Na PCR, as doses e energias do adulto (protocolos de PCR).",
  ],
  pensarEm: [
    "Tromboembolia pulmonar, infarto, embolia gasosa, bloqueio neuraxial alto, sepse, hemorragia, anafilaxia e toxicidade por anestésico local.",
  ],
  depois: [
    "UTI materna; coagulação, gasometria e ecocardiograma seriados.",
    "Debriefing da equipe; apoio à família e à equipe; registrar a cronologia (colapso, RCP, nascimento, retorno, hemocomponentes).",
  ],
  divergencias: [],
  referencias: ["smfm-2026-embolia-amniotica", "aha-2025-pcr-gestante"],
  relacionados: [
    { protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" },
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "hemorragia-pos-parto", texto: "Hemorragia pós-parto" },
  ],
};

export const VIA_AEREA_GESTANTE: Protocolo = {
  id: "via-aerea-dificil-gestante",
  titulo: "Via aérea difícil na gestante",
  categoria: "obstetricia",
  populacoes: ["gestante"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["intubação difícil na gestante", "intubação falha obstétrica", "via aérea obstétrica", "cesárea sob anestesia geral"],
  sinais: ["não intubo", "dessaturação", "gestante", "cesárea", "anestesia geral", "laringoscopia difícil"],
  resumo: "Oxigenação materna acima de tudo: no máximo duas tentativas de intubação, aliviar a cricoide, supraglótico de segunda geração cedo e decidir com a obstetrícia entre acordar e prosseguir. Não oxigena: acesso frontal do pescoço.",
  reconhecer: [
    "Laringoscopia difícil ou intubação falha em gestante sob anestesia geral.",
    "A gestante dessatura rápido e tem mais risco de aspiração; edema de via aérea na pré-eclâmpsia.",
  ],
  agirAgora: [
    { texto: "Antes da indução: cabeceira elevada 20–30° (rampa na obesa), deslocamento uterino, pré-oxigenação e O2 nasal a 5 L/min; plano de falha combinado com a obstetrícia." },
    { texto: "Ventilar suavemente sob máscara depois da indução (abaixo de 20 cmH2O)." },
    { texto: "Videolaringoscópio; tubo pequeno (7,0); cricoide reduzida ou aliviada se atrapalha." },
    { texto: "No máximo duas tentativas; a segunda pelo mais experiente, com outro equipamento.", detalhe: "Terceira só por anestesiologista experiente. Entre tentativas, ventilar sob máscara." },
    { texto: "Falhou: declarar “intubação falhou”, pedir ajuda e manter a oxigenação.", caminho: "1. Intubação falhou, mas oxigena e ventila" },
    { texto: "Decidir com a obstetrícia: acordar ou prosseguir com a via aérea alternativa.", detalhe: "Prosseguir: comprometimento materno que não responde ou sofrimento fetal agudo. Acordar: edema de glote ou obstrução persistente.", caminho: "1. Intubação falhou, mas oxigena e ventila" },
    { texto: "Acordar: reverter o rocurônio com sugamadex; lateral ou cabeceira elevada; anestesia regional ou intubação acordada depois.", caminho: "1. Intubação falhou, mas oxigena e ventila" },
    { texto: "Supraglótico de segunda geração, soltando a cricoide na inserção; no máximo duas tentativas.", caminho: "2. Intubação falhou e não ventila bem" },
    { texto: "Máscara a quatro mãos com cânula, cricoide solta.", caminho: "2. Intubação falhou e não ventila bem" },
    { texto: "Voltou a oxigenar: decidir acordar ou prosseguir (caminho 1).", caminho: "2. Intubação falhou e não ventila bem" },
    { texto: "Declarar “não intubo, não oxigeno”: acesso frontal do pescoço com bisturi, pelo algoritmo do serviço.", caminho: "3. Não intubo, não oxigeno" },
    { texto: "Sem pulso: RCP com deslocamento uterino e parto ressuscitativo.", caminho: "3. Não intubo, não oxigeno" },
  ],
  medicamentos: [
    {
      id: "sugamadex-gestante", farmaco: "Sugamadex", indicacao: "Acordar depois de rocurônio 1,2 mg/kg há cerca de 3 minutos", populacao: "adulto", via: "IV",
      dose: { usual: 16, unidade: "mg", por: "kg" }, apresentacoes: [SUGAMADEX_100],
      cuidados: [
        "Não é tratamento do não intubo, não oxigeno: não atrasa o acesso frontal.",
        "Peso real; bradicardia acentuada e anafilaxia descritas.",
      ],
      referencias: ["fda-sugamadex", "oaa-das-2015"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Prosseguindo sem tubo: manter a anestesia e, com supraglótico de segunda geração, aspirar o estômago pelo canal de drenagem.",
  ],
  pensarEm: [
    "Edema de via aérea, obesidade, mamas volumosas, posicionamento ruim, cricoide mal aplicada e laringoespasmo ao acordar.",
  ],
  depois: [
    "Extubar acordada, em cabeceira elevada, com o plano de reintubação pronto.",
    "Registrar a dificuldade e o que funcionou; orientar a paciente e emitir alerta de via aérea difícil.",
  ],
  divergencias: [],
  referencias: ["oaa-das-2015", "fda-sugamadex"],
  relacionados: [
    { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" },
    { protocolo: "nao-ventilo-nao-intubo", texto: "Não ventilo, não intubo" },
    { protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};
