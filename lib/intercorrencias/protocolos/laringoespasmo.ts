/**
 * LARINGOESPASMO — cartão 13 da minuta de validação de 15/10/2026.
 *
 * Base: Manual de Crises (aba 12). Separação de vias e doses: QRH 3-6 da
 * Association of Anaesthetists. A dose IM não vale para a via IO, que não foi
 * incorporada sem prescrição própria validada. A bradicardia segue o
 * protocolo de bradicardia. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { PROPOFOL_10, SUCCINILCOLINA_10, SUCCINILCOLINA_50 } from "./comum.ts";

const CUIDADOS_SUCCINILCOLINA = [
  "Contraindicações: suscetibilidade à hipertermia maligna e condições com risco de hipercalemia.",
  "Preparar a alternativa bloqueadora conforme o plano.",
];

export const LARINGOESPASMO: Protocolo = {
  id: "laringoespasmo",
  titulo: "Laringoespasmo",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["laringoespasmo", "espasmo de laringe", "espasmo de glote", "estridor", "obstrução de via aérea"],
  sinais: [
    "estridor", "ruído inspiratório", "silêncio", "não ventila", "não consigo ventilar", "máscara difícil",
    "tiragem", "respiração paradoxal", "sem curva de capnografia", "capnografia obstrutiva", "dessaturação",
    "bradicardia", "extubação", "indução inalatória", "plano superficial",
  ],
  resumo: "Obstrução em plano superficial: parar o estímulo, tração mandibular, O2 a 100% com CPAP; persistindo, aprofundar e bloqueador, sem prolongar o que não funciona.",
  reconhecer: [
    "Obstrução depois de estímulo em plano superficial: estridor se parcial; silêncio, esforço paradoxal, falta de fluxo e dessaturação se completa.",
    "Tubo traqueal corretamente posicionado torna outro diagnóstico mais provável.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, parar o estímulo e tracionar a mandíbula." },
    { texto: "Retirar o estímulo ou a obstrução e aspirar sob visão.",
      detalhe: "O2 a 100%, máscara bem vedada e CPAP; evitar insuflação vigorosa do estômago." },
    { texto: "Persistente: aprofundar a anestesia, se tolerado, e administrar o bloqueador.",
      detalhe: "Na dessaturação ou na bradicardia, não prolongar medidas ineficazes." },
    { texto: "Ventilar depois do relaxamento; intubar se necessário ou se houver risco de recorrência.",
      detalhe: "Falha de oxigenação: protocolo de não ventilo, não intubo." },
    { texto: "Bradicardia com comprometimento: tratar a oxigenação e seguir o protocolo de bradicardia." },
  ],
  medicamentos: [
    {
      id: "propofol-laringoespasmo", farmaco: "Propofol", indicacao: "Se a hemodinâmica permite", populacao: "todas", via: "IV",
      dose: { min: 0.25, max: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [PROPOFOL_10],
      referencias: ["manual-12", "qrh-3-6"],
    },
    {
      id: "succinilcolina-iv-laringoespasmo", farmaco: "Succinilcolina", indicacao: "Alívio do espasmo", populacao: "todas", via: "IV",
      dose: { min: 0.25, max: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [SUCCINILCOLINA_10],
      cuidados: [...CUIDADOS_SUCCINILCOLINA, "Se a intubação imediata exige dose maior, usar o regime de intubação específico."],
      referencias: ["manual-12", "qrh-3-6"],
    },
    {
      id: "succinilcolina-im-laringoespasmo", farmaco: "Succinilcolina", indicacao: "Sem acesso vascular", populacao: "todas", via: "IM",
      dose: { usual: 4, unidade: "mg", por: "kg" }, apresentacoes: [SUCCINILCOLINA_50],
      cuidados: [
        "Conferir o teto na bula ou no formulário do serviço.",
        "Não aplicar esta dose pela via IO.",
        ...CUIDADOS_SUCCINILCOLINA,
      ],
      referencias: ["manual-12", "qrh-3-6"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Não aplicar a dose IM à via IO: o esquema IO não foi incorporado sem prescrição própria validada.",
  ],
  pensarEm: [
    "Obstrução supraglótica, corpo estranho, broncoespasmo, edema, anafilaxia, paralisia de pregas e tubo obstruído.",
  ],
  depois: [
    "Vigiar edema por pressão negativa e aspiração.",
    "Recuperação monitorizada e registro.",
  ],
  divergencias: [
    {
      tema: "Dose IV de succinilcolina",
      posicoes: [{ texto: "0,1 a 1 mg/kg EV.", referencia: "manual-12" }],
      escolha: "O protocolo usa 0,25 a 0,5 mg/kg para aliviar o espasmo (QRH 3-6); para intubar, o regime de intubação.",
    },
    {
      tema: "Succinilcolina sem acesso venoso",
      posicoes: [{ texto: "2 a 4 mg/kg IM, intralingual ou intraóssea.", referencia: "manual-12" }],
      escolha: "O protocolo mostra 4 mg/kg IM; a via IO não foi incorporada sem prescrição própria validada.",
    },
  ],
  referencias: ["manual-12", "qrh-3-6"],
  relacionados: [
    { protocolo: "bradicardia", texto: "Bradicardia grave" },
    { protocolo: "nao-ventilo-nao-intubo", texto: "Não ventilo, não intubo" },
    { protocolo: "ventilacao-mascara-dificil", texto: "Dificuldade de ventilação com máscara" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};
