/**
 * BRONCOESPASMO GRAVE — cartão 15 da minuta de validação de 15/10/2026.
 *
 * Base: Manual de Crises (aba 14). Regime IV escolhido: QRH 3-4 da
 * Association of Anaesthetists, v3 de 2023, que substitui a carga pediátrica
 * elevada do texto anterior. Aminofilina não integra a primeira linha. Na
 * suspeita de anafilaxia, o protocolo de anafilaxia. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { IPRATROPIO_NEBULIZACAO, MAGNESIO_10, MAGNESIO_50, SALBUTAMOL_IV_50, SALBUTAMOL_NEBULIZACAO } from "./comum.ts";

const BETA2_IV = ["Monitorar arritmia, potássio, glicose e lactato com β2 IV.", "Usar apenas a apresentação injetável."];

export const BRONCOESPASMO: Protocolo = {
  id: "broncoespasmo-grave",
  titulo: "Broncoespasmo grave",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["broncoespasmo", "broncospasmo", "asma", "crise de asma", "sibilância"],
  sinais: ["chiado", "sibilo", "expiração prolongada", "pressão de pico alta", "capnografia em rampa", "capnografia em barbatana",
    "tórax silencioso", "hipercapnia", "dessaturação"],
  resumo: "O2 a 100%, confirmar tubo e circuito, salbutamol e ipratrópio inalados e expiração longa; refratário, salbutamol IV e magnésio. Suspeita de anafilaxia: adrenalina.",
  reconhecer: [
    "Sibilos, expiração prolongada, capnograma obstrutivo e pressão alta.",
    "Tórax silencioso pode indicar obstrução extrema.",
    "Anafilaxia pode ocorrer sem lesões cutâneas.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, parar o estímulo e dar O2 a 100%; confirmar tubo e circuito." },
    { texto: "Aprofundar a anestesia, se tolerado.", detalhe: "Suspeita de anafilaxia: adrenalina e protocolo de anafilaxia." },
    { texto: "Salbutamol inalado e ipratrópio.", detalhe: "Nebulizar depois do HME, ou retirar o filtro, para a entrega ser efetiva." },
    { texto: "Alongar a expiração e reduzir o aprisionamento; permitir hipercapnia quando apropriado.",
      detalhe: "Desconexão apenas para hiperinsuflação relevante, e não como rotina periódica." },
    { texto: "Refratário: broncodilatador IV e adjuvantes, com suporte hemodinâmico e monitorização avançada." },
  ],
  medicamentos: [
    {
      id: "salbutamol-neb-adulto", farmaco: "Salbutamol", indicacao: "Nebulizado", populacao: "adulto", via: "Inalatória",
      dose: { usual: 5, unidade: "mg", por: "fixa" }, apresentacoes: [SALBUTAMOL_NEBULIZACAO],
      referencias: ["manual-14", "qrh-3-4"],
    },
    {
      id: "salbutamol-neb-ped", farmaco: "Salbutamol", indicacao: "Nebulizado — abaixo de 5 anos", populacao: "pediatrico", via: "Inalatória",
      idadeAnos: { max: 5 },
      dose: { usual: 2.5, unidade: "mg", por: "fixa" }, apresentacoes: [SALBUTAMOL_NEBULIZACAO],
      referencias: ["qrh-3-4"],
    },
    {
      id: "ipratropio-adulto", farmaco: "Ipratrópio", indicacao: "Nebulizado", populacao: "adulto", via: "Inalatória",
      dose: { usual: 0.5, unidade: "mg", por: "fixa" }, apresentacoes: [IPRATROPIO_NEBULIZACAO],
      referencias: ["qrh-3-4"],
    },
    {
      id: "ipratropio-ped", farmaco: "Ipratrópio", indicacao: "Nebulizado — 2 a 12 anos", populacao: "pediatrico", via: "Inalatória",
      idadeAnos: { min: 2 },
      dose: { usual: 0.25, unidade: "mg", por: "fixa" }, apresentacoes: [IPRATROPIO_NEBULIZACAO],
      referencias: ["qrh-3-4"],
    },
    {
      id: "salbutamol-iv-adulto", farmaco: "Salbutamol", indicacao: "Segunda linha — bolus", populacao: "adulto", via: "IV lento",
      dose: { usual: 250, unidade: "mcg", por: "fixa" }, apresentacoes: [SALBUTAMOL_IV_50],
      cuidados: BETA2_IV,
      referencias: ["qrh-3-4"],
    },
    {
      id: "salbutamol-iv-lactente", farmaco: "Salbutamol", indicacao: "Segunda linha — bolus, 1 a 23 meses", populacao: "pediatrico", via: "IV",
      idadeAnos: { min: 1 / 12, max: 2 },
      dose: { usual: 5, unidade: "mcg", por: "kg" }, apresentacoes: [SALBUTAMOL_IV_50],
      velocidade: "Em 5 minutos.", cuidados: BETA2_IV,
      referencias: ["qrh-3-4"],
    },
    {
      id: "salbutamol-iv-crianca", farmaco: "Salbutamol", indicacao: "Segunda linha — bolus, 2 anos ou mais", populacao: "pediatrico", via: "IV",
      idadeAnos: { min: 2 },
      dose: { usual: 15, unidade: "mcg", por: "kg" }, tetoAbsoluto: { valor: 250, unidade: "mcg" }, apresentacoes: [SALBUTAMOL_IV_50],
      velocidade: "Em 5 minutos.", cuidados: BETA2_IV,
      referencias: ["qrh-3-4"],
    },
    {
      id: "salbutamol-infusao-adulto", farmaco: "Salbutamol", indicacao: "Infusão", populacao: "adulto", via: "IV",
      dose: { min: 5, max: 20, unidade: "mcg", por: "min" }, apresentacoes: [SALBUTAMOL_IV_50],
      cuidados: BETA2_IV,
      referencias: ["qrh-3-4"],
    },
    {
      id: "salbutamol-infusao-ped", farmaco: "Salbutamol", indicacao: "Infusão", populacao: "pediatrico", via: "IV",
      dose: { min: 0.5, max: 1, unidade: "mcg", por: "kg/min" }, tetoAbsoluto: { valor: 20, unidade: "mcg" }, apresentacoes: [SALBUTAMOL_IV_50],
      cuidados: ["Máximo de 20 mcg/min.", ...BETA2_IV],
      referencias: ["qrh-3-4"],
    },
    {
      id: "magnesio-broncoespasmo-adulto", farmaco: "Sulfato de magnésio", indicacao: "Refratário", populacao: "adulto", via: "IV",
      dose: { usual: 2, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_10, MAGNESIO_50],
      velocidade: "Em 20 minutos.",
      par: "magnesio-broncoespasmo-ped",
      referencias: ["qrh-3-4"],
    },
    {
      id: "magnesio-broncoespasmo-ped", farmaco: "Sulfato de magnésio", indicacao: "Refratário", populacao: "pediatrico", via: "IV",
      dose: { usual: 50, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 2, unidade: "g" }, apresentacoes: [MAGNESIO_10, MAGNESIO_50],
      velocidade: "Em 20 minutos.",
      par: "magnesio-broncoespasmo-adulto",
      referencias: ["qrh-3-4"],
    },
    {
      id: "hidrocortisona-adulto", farmaco: "Hidrocortisona", indicacao: "Efeito não imediato", populacao: "adulto", via: "IV",
      dose: { usual: 200, unidade: "mg", por: "fixa" }, apresentacoes: [],
      semVolume: "Conforme o frasco reconstituído",
      par: "hidrocortisona-ped",
      referencias: ["qrh-3-4"],
    },
    {
      id: "hidrocortisona-ped", farmaco: "Hidrocortisona", indicacao: "Efeito não imediato", populacao: "pediatrico", via: "IV",
      dose: { usual: 4, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 200, unidade: "mg" }, apresentacoes: [],
      semVolume: "Conforme o frasco reconstituído",
      par: "hidrocortisona-adulto",
      referencias: ["qrh-3-4"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Criança de 5 anos ou mais: salbutamol nebulizado pelo regime da idade; conferir o limite aos 5 anos no formulário do serviço.",
    "Magnésio a 10%: a dose em mg dividida por 100 dá o volume em mL.",
    "Aminofilina não integra a primeira linha.",
  ],
  pensarEm: ["Anafilaxia, tubo ou circuito, aspiração, tensão, edema e auto-PEEP."],
  depois: [
    "Monitorização ou UTI conforme a resposta.",
    "Imagem e gasometria; registro.",
  ],
  divergencias: [
    {
      tema: "Salbutamol IV no adulto",
      posicoes: [
        { texto: "Bolus de 250 mcg em 5 minutos; infusão com carga de 200 mcg em 1 minuto e depois 5 a 25 mcg/min.", referencia: "manual-14" },
        { texto: "250 mcg lento; infusão de 5 a 20 mcg/min.", referencia: "qrh-3-4" },
      ],
      escolha: "O protocolo segue o regime IV do QRH, v3 de 2023.",
    },
    {
      tema: "Salbutamol IV na criança",
      posicoes: [
        { texto: "2 a 12 anos: carga de 5 mcg/kg/min (máximo 200 mcg/min) por 1 hora, depois 1 a 2 mcg/kg/min (máximo 80 mcg/min).", referencia: "manual-14" },
        { texto: "Bolus de 5 mcg/kg (1 a 23 meses) ou 15 mcg/kg (2 a 17 anos, máximo 250 mcg) em 5 minutos; infusão de 0,5 a 1 mcg/kg/min (máximo 20 mcg/min).", referencia: "qrh-3-4" },
      ],
      escolha: "O protocolo segue o QRH, v3 de 2023, que substitui a carga pediátrica elevada.",
    },
  ],
  referencias: ["manual-14", "qrh-3-4"],
  relacionados: [
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};
