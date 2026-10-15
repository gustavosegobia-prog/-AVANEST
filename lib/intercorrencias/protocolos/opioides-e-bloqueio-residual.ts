/**
 * DEPRESSÃO RESPIRATÓRIA POR OPIOIDES E BLOQUEIO NEUROMUSCULAR RESIDUAL —
 * cartões 12 e 13 da minuta preliminar “Protocolos de crise” (outubro de 2026,
 * para validação médica).
 *
 * Base: Tratado SAESP (opioides; cap. 53, tabela 53.9, bloqueadores
 * neuromusculares). Atualização: diretriz ASA 2023 de monitorização e reversão
 * do bloqueio neuromuscular. A neostigmina fica sem número no cartão: a dose
 * depende da profundidade medida, e a calculadora de doses só a calcula com
 * monitorização. O texto é do AVANEST. Versão 1, sem aprovação registrada até
 * a validação.
 */

import type { Protocolo } from "../tipos.ts";
import { NALOXONA_004, NALOXONA_04, SUGAMADEX_100 } from "./comum.ts";

export const DEPRESSAO_OPIOIDES: Protocolo = {
  id: "depressao-respiratoria-opioides",
  titulo: "Depressão respiratória por opioides",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["naloxona", "apneia por opioide", "sedação excessiva", "overdose de opioide", "reversão de opioide"],
  sinais: ["apneia", "bradipneia", "FR baixa", "miose", "sonolência", "EtCO2 alto", "dessaturação", "despertar demorado", "morfina", "fentanil"],
  resumo: "Estimular, abrir a via aérea e ventilar; parar o opioide e titular naloxona em pequenas doses, sem reverter tudo de uma vez — ela dura menos que o opioide.",
  reconhecer: [
    "Frequência respiratória baixa ou apneia, sonolência, miose, hipercapnia ou dessaturação depois de opioide.",
  ],
  agirAgora: [
    { texto: "Avaliar a resposta, a via aérea, a ventilação e a circulação." },
    { texto: "Suspender os opioides em curso (bomba, PCA, peridural)." },
    { texto: "Abrir a via aérea e ventilar com bolsa e máscara, se necessário." },
    { texto: "O2, oximetria e capnografia." },
    { texto: "Naloxona quando a depressão for clinicamente relevante." },
    { texto: "Titular até a ventilação adequada, sem buscar a reversão completa." },
    { texto: "Sem resposta: manter o suporte e procurar outras causas." },
  ],
  medicamentos: [
    {
      id: "naloxona-opioides-adulto", farmaco: "Naloxona", indicacao: "Dose inicial — titular pela resposta", populacao: "adulto", via: "IV",
      dose: { usual: 0.04, unidade: "mg", por: "fixa" }, apresentacoes: [NALOXONA_004, NALOXONA_04], altoRisco: true,
      repeticao: "Repetir ou aumentar conforme a resposta.",
      cuidados: [
        "As apresentações variam: confirmar a concentração antes de aspirar.",
        "Dura menos que muitos opioides: vigiar a volta da depressão; pode ser preciso infusão.",
      ],
      referencias: ["saesp-tratado"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Criança: a dose da naloxona é a do protocolo pediátrico do serviço; o cartão traz a dose inicial do adulto.",
    "Reversão brusca causa dor, agitação, abstinência, hipertensão, arritmia e edema pulmonar.",
  ],
  pensarEm: [
    "Bloqueio neuromuscular residual, apneia obstrutiva do sono, benzodiazepínicos, hipoglicemia, causa neurológica e outros anestésicos.",
  ],
  depois: [
    "Monitorização contínua pelo tempo de ação do opioide; rever a analgesia.",
    "Internação ou unidade monitorizada quando houve infusão de naloxona ou opioide de ação longa.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado"],
  relacionados: [
    { protocolo: "bloqueio-neuromuscular-residual", texto: "Bloqueio neuromuscular residual" },
    { protocolo: "dessaturacao", texto: "Dessaturação súbita" },
  ],
};

export const BNM_RESIDUAL: Protocolo = {
  id: "bloqueio-neuromuscular-residual",
  titulo: "Bloqueio neuromuscular residual",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["curarização residual", "TOF", "sequência de quatro", "reversão do bloqueio", "sugamadex", "neostigmina"],
  sinais: ["fraqueza", "TOF baixo", "hipoventilação", "dessaturação", "obstrução", "não sustenta a cabeça", "movimentos descoordenados", "depois da extubação"],
  resumo: "Ventilar e medir: monitorização quantitativa no adutor do polegar, reverter pela profundidade (sugamadex 2, 4 ou 16 mg/kg no rocurônio) e extubar só com TOF de 0,9 ou mais.",
  reconhecer: [
    "Fraqueza, hipoventilação, obstrução ou dessaturação depois de bloqueador neuromuscular.",
    "TOF abaixo de 0,9 na monitorização quantitativa.",
    "Quatro respostas vistas ou sentidas no TOF não garantem a recuperação: só a medida quantitativa confirma.",
  ],
  agirAgora: [
    { texto: "Garantir ventilação e oxigenação." },
    { texto: "Monitorização quantitativa no adutor do polegar." },
    { texto: "Identificar o bloqueador, a hora da última dose e a profundidade do bloqueio." },
    { texto: "Corrigir o que prolonga o bloqueio: hipotermia, magnésio, distúrbios metabólicos, disfunção renal ou hepática e interações." },
    { texto: "Reverter pela profundidade medida." },
    { texto: "Manter o suporte ventilatório até a recuperação completa." },
  ],
  medicamentos: [
    {
      id: "sugamadex-bnm-t2", farmaco: "Sugamadex", indicacao: "Rocurônio ou vecurônio — bloqueio moderado (reaparecimento de T2)", populacao: "todas", via: "IV",
      dose: { usual: 2, unidade: "mg", por: "kg" }, apresentacoes: [SUGAMADEX_100],
      cuidados: ["Criança: conferir na bula a idade mínima aprovada."],
      referencias: ["saesp-tratado", "asa-2023-bnm"],
    },
    {
      id: "sugamadex-bnm-ptc", farmaco: "Sugamadex", indicacao: "Rocurônio ou vecurônio — bloqueio profundo (contagem pós-tetânica de 1 a 2)", populacao: "todas", via: "IV",
      dose: { usual: 4, unidade: "mg", por: "kg" }, apresentacoes: [SUGAMADEX_100],
      cuidados: ["Criança: conferir na bula a idade mínima aprovada."],
      referencias: ["saesp-tratado", "asa-2023-bnm"],
    },
    {
      id: "sugamadex-bnm-imediata", farmaco: "Sugamadex", indicacao: "Reversão imediata depois do rocurônio", populacao: "adulto", via: "IV",
      dose: { usual: 16, unidade: "mg", por: "kg" }, apresentacoes: [SUGAMADEX_100],
      referencias: ["saesp-tratado"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Sugamadex não reverte benzilisoquinolínicos (cisatracúrio, atracúrio).",
    "Neostigmina: alternativa só no bloqueio mínimo ou superficial, com antimuscarínico; a dose depende da profundidade medida (a calculadora de doses só a calcula com monitorização).",
  ],
  pensarEm: ["Opioide, benzodiazepínico, hipotermia, magnésio, aminoglicosídeo, distúrbio eletrolítico e insuficiência renal ou hepática."],
  depois: [
    "Reavaliar depois da reversão: TOF de 0,9 ou mais antes de extubar, e de novo se piorar.",
    "Documentar o bloqueador, as doses, a monitorização e a reversão.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "asa-2023-bnm"],
  relacionados: [
    { protocolo: "depressao-respiratoria-opioides", texto: "Depressão respiratória por opioides" },
    { protocolo: "hipotermia-perioperatoria", texto: "Hipotermia perioperatória" },
  ],
};
