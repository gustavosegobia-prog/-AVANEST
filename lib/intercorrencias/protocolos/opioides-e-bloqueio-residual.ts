/**
 * DEPRESSÃO RESPIRATÓRIA POR OPIOIDES E BLOQUEIO NEUROMUSCULAR RESIDUAL —
 * cartões 12 e 13 da minuta preliminar “Protocolos de crise” (outubro de 2026).
 *
 * Versão 2: revisão científica de 16/10/2026. Doses conferidas nas bulas
 * aprovadas pela FDA (naloxona, sugamadex, neostigmina). A diretriz ASA 2023
 * de bloqueio neuromuscular e a de opioides neuraxiais não puderam ser abertas
 * e ficam citadas como não conferidas. O sugamadex de 16 mg/kg saiu deste
 * cartão: é a reversão imediata depois de rocurônio 1,2 mg/kg, e não dose de
 * bloqueio residual. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { ATROPINA_025, NALOXONA_004, NALOXONA_04, NEOSTIGMINA_05, SUGAMADEX_10, SUGAMADEX_100 } from "./comum.ts";

const REVISAO = "2026-10-16";

export const DEPRESSAO_OPIOIDES: Protocolo = {
  id: "depressao-respiratoria-opioides",
  titulo: "Depressão respiratória por opioides",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["naloxona", "apneia por opioide", "sedação excessiva", "overdose de opioide", "reversão de opioide", "intoxicação por opioide"],
  sinais: ["apneia", "bradipneia", "FR baixa", "miose", "sonolência", "EtCO2 alto", "dessaturação", "despertar demorado", "morfina", "fentanil", "peridural"],
  resumo: "Estimular, abrir a via aérea e ventilar; parar o opioide. Pós-operatório: naloxona em pequenas doses tituladas, sem reverter a analgesia. Intoxicação grave com apneia: doses maiores. A naloxona dura menos que muitos opioides.",
  reconhecer: [
    "Frequência respiratória baixa ou apneia, sonolência, miose, obstrução, EtCO2 subindo ou dessaturação depois de opioide.",
    "Pós-operatória: depois de opioide da anestesia ou da analgesia (venoso, PCA, neuraxial).",
    "Intoxicação grave: apneia ou quase apneia com inconsciência (superdosagem, erro de dose ou de via).",
  ],
  agirAgora: [
    { texto: "Estimular; via aérea (tração mandibular, cânula), O2 e ventilação com bolsa e máscara se preciso." },
    { texto: "Parar opioides em curso (bomba, PCA, peridural); SpO2 e capnografia." },
    { texto: "Naloxona IV em pequenas doses a cada 2 a 3 minutos, até ventilação e alerta adequados sem dor importante.", caminho: "A. Pós-operatória" },
    { texto: "Opioide neuraxial ou de ação longa: vigilância prolongada; pode precisar de nova dose ou de infusão.", caminho: "A. Pós-operatória" },
    { texto: "Ventilar antes e durante: a naloxona não substitui o suporte ventilatório.", caminho: "B. Intoxicação grave" },
    { texto: "Naloxona IV em dose maior, repetindo a cada 2 a 3 minutos; sem acesso, IM.", detalhe: "Sem resposta depois de 10 mg no adulto, rever o diagnóstico.", caminho: "B. Intoxicação grave" },
    { texto: "Sem resposta: manter o suporte e procurar outras causas.", caminho: "Sem resposta à naloxona" },
  ],
  medicamentos: [
    {
      id: "naloxona-posop-adulto", farmaco: "Naloxona", indicacao: "Pós-operatória — titular", populacao: "adulto", via: "IV",
      dose: { min: 0.1, max: 0.2, unidade: "mg", por: "fixa" }, apresentacoes: [NALOXONA_004, NALOXONA_04], altoRisco: true,
      repeticao: "A cada 2 a 3 minutos; nova dose pode ser necessária em 1 a 2 horas.",
      cuidados: [
        "Reversão rápida ou excessiva: dor, náusea, vômito, hipertensão e estresse circulatório.",
        "A lista de doses do serviço (calculadora) começa com 0,04 mg, para titulação mais fina.",
      ],
      par: "naloxona-posop-ped",
      referencias: ["fda-naloxona"],
    },
    {
      id: "naloxona-grave-adulto", farmaco: "Naloxona", indicacao: "Intoxicação grave", populacao: "adulto", via: "IV, ou IM sem acesso",
      dose: { min: 0.4, max: 2, unidade: "mg", por: "fixa" }, apresentacoes: [NALOXONA_04], altoRisco: true,
      repeticao: "A cada 2 a 3 minutos; sem resposta depois de 10 mg, rever o diagnóstico.",
      par: "naloxona-grave-ped",
      referencias: ["fda-naloxona"],
    },
    {
      id: "naloxona-posop-ped", farmaco: "Naloxona", indicacao: "Pós-operatória — titular", populacao: "pediatrico", idadeAnos: { min: 1 / 12 }, via: "IV",
      dose: { min: 0.005, max: 0.01, unidade: "mg", por: "fixa" }, apresentacoes: [NALOXONA_004], altoRisco: true,
      repeticao: "A cada 2 a 3 minutos, até a reversão desejada.",
      par: "naloxona-posop-adulto",
      referencias: ["fda-naloxona"],
    },
    {
      id: "naloxona-grave-ped", farmaco: "Naloxona", indicacao: "Intoxicação — dose inicial", populacao: "pediatrico", idadeAnos: { min: 1 / 12 },
      via: "IV, ou IM sem acesso",
      dose: { usual: 0.01, unidade: "mg", por: "kg" }, apresentacoes: [NALOXONA_004, NALOXONA_04], altoRisco: true,
      repeticao: "Sem melhora: 0,1 mg/kg.",
      par: "naloxona-grave-adulto",
      referencias: ["fda-naloxona"],
    },
    {
      id: "naloxona-rn", farmaco: "Naloxona", indicacao: "Recém-nascido com depressão por opioide", populacao: "pediatrico", idadeAnos: { max: 1 / 12 },
      via: "IV, IM ou SC",
      dose: { usual: 0.01, unidade: "mg", por: "kg" }, apresentacoes: [NALOXONA_004], altoRisco: true,
      cuidados: ["Na sala de parto, a naloxona não é rotina da reanimação neonatal."],
      referencias: ["fda-naloxona"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "As apresentações variam (0,4 mg/mL; também 1 mg/mL): confirmar a concentração antes de aspirar.",
    "Infusão, se a depressão volta: 2 mg em 500 mL (0,004 mg/mL), titulada pela resposta.",
  ],
  pensarEm: [
    "Bloqueio neuromuscular residual, apneia obstrutiva do sono, benzodiazepínico e outros sedativos, hipoglicemia, hipercapnia por outra causa, hipotermia, evento neurológico.",
  ],
  depois: [
    "Monitorização contínua (SpO2 e, se possível, capnografia) por mais tempo que a ação do opioide.",
    "Opioide neuraxial (morfina) ou de ação longa: unidade monitorizada; rever a analgesia multimodal.",
    "Registrar o opioide, as doses de naloxona e a resposta.",
  ],
  divergencias: [
    {
      tema: "Dose inicial de naloxona no pós-operatório do adulto",
      posicoes: [
        { texto: "0,1 a 0,2 mg IV a cada 2 a 3 minutos.", referencia: "fda-naloxona" },
      ],
      escolha: "O cartão segue a bula (0,1–0,2 mg). A versão anterior e a lista de doses do serviço usam 0,04 mg para titulação mais fina: decisão do responsável médico.",
    },
  ],
  referencias: ["fda-naloxona"],
  relacionados: [
    { protocolo: "bloqueio-neuromuscular-residual", texto: "Bloqueio neuromuscular residual" },
    { protocolo: "dessaturacao", texto: "Dessaturação súbita" },
  ],
};

export const BNM_RESIDUAL: Protocolo = {
  id: "bloqueio-neuromuscular-residual",
  titulo: "Bloqueio neuromuscular residual",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["curarização residual", "TOF", "sequência de quatro", "reversão do bloqueio", "sugamadex", "neostigmina"],
  sinais: ["fraqueza", "TOF baixo", "hipoventilação", "dessaturação", "obstrução", "não sustenta a cabeça", "movimentos descoordenados", "depois da extubação"],
  resumo: "Ventilar e medir: TOF quantitativo no adutor do polegar. Rocurônio ou vecurônio: sugamadex 2 mg/kg (T2 presente) ou 4 mg/kg (1–2 respostas pós-tetânicas). Neostigmina só no bloqueio superficial. Extubar com TOF de 0,9 ou mais.",
  reconhecer: [
    "Fraqueza, hipoventilação, obstrução, dessaturação ou movimentos descoordenados depois de bloqueador neuromuscular.",
    "Razão do TOF abaixo de 0,9 na monitorização quantitativa.",
    "Quatro respostas vistas ou sentidas não garantem a recuperação: só a medida quantitativa confirma.",
  ],
  agirAgora: [
    { texto: "Garantir ventilação e oxigenação; manter sedação se ainda paralisado e consciente." },
    { texto: "Monitorização quantitativa no adutor do polegar: profundidade do bloqueio." },
    { texto: "Qual bloqueador, quando e quanto." },
    { texto: "Corrigir o que prolonga: hipotermia, magnésio, acidose, distúrbios eletrolíticos, disfunção renal ou hepática, interações." },
    { texto: "Reverter pela profundidade medida (doses ao lado)." },
    { texto: "Ventilar até a recuperação; extubar só com razão do TOF de 0,9 ou mais e sinais clínicos adequados." },
  ],
  medicamentos: [
    {
      id: "sugamadex-bnm-t2", farmaco: "Sugamadex", indicacao: "Rocurônio ou vecurônio — T2 presente", populacao: "todas", via: "IV",
      dose: { usual: 2, unidade: "mg", por: "kg" }, apresentacoes: [SUGAMADEX_100, SUGAMADEX_10],
      velocidade: "Bolus único, em até 10 segundos.",
      cuidados: [
        "Peso real. Criança: diluir a 10 mg/mL.",
        "Depuração de creatinina abaixo de 30 mL/min: não recomendado.",
        "Bradicardia acentuada e anafilaxia descritas: atropina e preparo para anafilaxia.",
      ],
      referencias: ["fda-sugamadex"],
    },
    {
      id: "sugamadex-bnm-ptc", farmaco: "Sugamadex", indicacao: "Rocurônio ou vecurônio — 1 a 2 respostas pós-tetânicas, nenhuma ao TOF", populacao: "todas", via: "IV",
      dose: { usual: 4, unidade: "mg", por: "kg" }, apresentacoes: [SUGAMADEX_100, SUGAMADEX_10],
      velocidade: "Bolus único, em até 10 segundos.",
      cuidados: ["Peso real. Criança: diluir a 10 mg/mL.", "Depuração de creatinina abaixo de 30 mL/min: não recomendado."],
      referencias: ["fda-sugamadex"],
    },
    {
      id: "neostigmina-bnm", farmaco: "Neostigmina", indicacao: "Bloqueio superficial: T2 presente ou T1 de 10% ou mais", populacao: "adulto", via: "IV",
      dose: { min: 0.03, max: 0.07, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 5, unidade: "mg" }, apresentacoes: [NEOSTIGMINA_05],
      cuidados: [
        "0,03 mg/kg com T2 presente; até 0,07 mg/kg com T1 perto de 10%. Máximo de 0,07 mg/kg ou 5 mg.",
        "Sempre com antimuscarínico, antes ou junto, em seringa separada.",
        "Bloqueio profundo (sem resposta ao TOF): não usar.",
      ],
      referencias: ["fda-neostigmina"],
    },
    {
      id: "atropina-neostigmina-bnm", farmaco: "Atropina", indicacao: "Junto da neostigmina", populacao: "adulto", via: "IV",
      dose: { usual: 0.015, unidade: "mg", por: "kg" }, apresentacoes: [ATROPINA_025],
      cuidados: ["Alternativa: glicopirrolato cerca de 10 mcg/kg."],
      referencias: ["fda-neostigmina"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Sugamadex não reverte benzilisoquinolínicos (cisatracúrio, atracúrio).",
    "16 mg/kg não é dose de bloqueio residual: é a reversão imediata cerca de 3 minutos depois de rocurônio 1,2 mg/kg, só no adulto (protocolos de via aérea).",
    "Neostigmina na criança: dose a validar (não conferida nesta revisão).",
  ],
  pensarEm: [
    "Opioide ou benzodiazepínico, hipotermia, magnésio, aminoglicosídeo, acidose, distúrbio eletrolítico e insuficiência renal ou hepática.",
  ],
  depois: [
    "Reavaliar depois da reversão (quantitativo) e de novo se piorar; vigiar a recurarização.",
    "Documentar o bloqueador, as doses, a monitorização e a reversão.",
  ],
  divergencias: [],
  referencias: ["fda-sugamadex", "fda-neostigmina", "asa-2023-bnm"],
  relacionados: [
    { protocolo: "depressao-respiratoria-opioides", texto: "Depressão respiratória por opioides" },
    { protocolo: "hipotermia-perioperatoria", texto: "Hipotermia perioperatória" },
    { protocolo: "ventilacao-mascara-dificil", texto: "Dificuldade de ventilação com máscara" },
  ],
};
