/**
 * BRONCOESPASMO GRAVE — adulto, gestante e criança.
 *
 * Doses do Manual de Crises (protocolo 14, lido no livro: adrenalina em bolus
 * e infusão, salbutamol IV no adulto e na criança de 2 a 12 anos) e do QRH
 * 3-4 da Association of Anaesthetists (aberto e lido: nebulização, bolus
 * pediátrico de salbutamol, magnésio e hidrocortisona, que o Manual cita sem
 * dose). As duas fontes divergem bastante no salbutamol IV: as posições
 * ficam em `divergencias`. O texto é do AVANEST.
 */

import type { ApresentacaoDoProtocolo, Protocolo } from "../tipos.ts";
import { ADRENALINA_10, ADRENALINA_100, ADRENALINA_60, MAGNESIO_10, MAGNESIO_50, SALBUTAMOL_NEBULIZACAO } from "./comum.ts";

const SALBUTAMOL_500: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 0,5 mg em 1 mL — 500 mcg/mL", quantidade: 500, unidade: "mcg", mL: 1, vias: ["IV"],
};
const SALBUTAMOL_50: ApresentacaoDoProtocolo = {
  rotulo: "0,5 mg em 10 mL — 50 mcg/mL", quantidade: 50, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (0,5 mg) + 9 mL de SF 0,9%",
};
const SALBUTAMOL_100: ApresentacaoDoProtocolo = {
  rotulo: "5 mg em 50 mL — 100 mcg/mL", quantidade: 100, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "10 ampolas (5 mg) completando 50 mL com SF 0,9%",
};
const IPRATROPIO_NEBULIZACAO: ApresentacaoDoProtocolo = {
  rotulo: "Solução para nebulização 0,25 mg/mL", quantidade: 0.25, unidade: "mg", mL: 1, vias: ["Inalatória"],
};
const HIDROCORTISONA_50: ApresentacaoDoProtocolo = {
  rotulo: "100 mg em 2 mL de diluente — 50 mg/mL", quantidade: 50, unidade: "mg", mL: 1, vias: ["IV", "IM"],
};

const NEBULIZACAO = "Inalatória, nebulização no circuito";
const INFUSAO = "IV, infusão contínua";

export const BRONCOESPASMO: Protocolo = {
  id: "broncoespasmo-grave",
  titulo: "Broncoespasmo grave",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["broncoespasmo", "broncospasmo", "asma", "crise de asma", "sibilância"],
  sinais: ["chiado", "sibilo", "expiração prolongada", "pressão de pico alta", "capnografia em rampa", "capnografia em barbatana",
    "tórax silencioso", "hipercapnia", "dessaturação"],
  resumo: "Ventilar à mão com O2 a 100%, aprofundar, broncodilatador no circuito, expiração longa; sem resposta, adrenalina IV em bolus e infusão, magnésio e corticoide.",
  reconhecer: [
    "Sibilo expiratório, expiração prolongada, pressão de insuflação alta, dessaturação e hipercapnia.",
    "Capnografia com subida inclinada, sem platô. Tórax silencioso é sinal de gravidade: não há fluxo.",
    "Ventilar à mão mostra na hora a complacência e o tamanho do espasmo.",
    "Causas: asma, anafilaxia, via aérea mal posicionada, corpo estranho, broncoaspiração.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda e avisar a equipe; parar o estímulo cirúrgico." },
    { texto: "Revisar posição e permeabilidade da via aérea.", detalhe: "Tubo seletivo, dobrado, obstruído ou no esôfago." },
    { texto: "Ventilar à mão com O2 a 100% e aprofundar a anestesia.",
      detalhe: "O halogenado broncodilata; não subir rápido isoflurano e desflurano (irritam a via aérea). Adiar o aprofundamento se anafilaxia não foi afastada ou se a hemodinâmica não permite." },
    { texto: "Salbutamol e ipratrópio no circuito." },
    { texto: "Acompanhar a curva de EtCO2 e as pressões da via aérea." },
    { texto: "Expiração longa (relação I:E), desconectar de tempos em tempos e PEEP baixa para reduzir a hiperinsuflação.",
      detalhe: "Desconectar deixa sair o CO2 e o ar retido. Hipercapnia permissiva pode ser necessária; pressão controlada pode ser melhor." },
    { texto: "Considerar volume, linha arterial e gasometrias seriadas." },
    { texto: "Adrenalina (ou salbutamol) em bolus IV; se o espasmo persistir, infusão." },
    { texto: "Hidrocortisona e magnésio como adjuvantes." },
    { texto: "Suspeita de anafilaxia: seguir o protocolo de anafilaxia." },
    { texto: "Conforme a gravidade e a resposta, decidir se a cirurgia continua e avisar a UTI." },
  ],
  medicamentos: [
    {
      id: "adrenalina-bolus-bronco", farmaco: "Adrenalina", indicacao: "Espasmo que não responde — bolus",
      populacao: "todas", via: "IV",
      dose: { min: 0.1, max: 1, unidade: "mcg", por: "kg" }, apresentacoes: [ADRENALINA_10, ADRENALINA_100], altoRisco: true,
      repeticao: "Titular pela hemodinâmica e pela resposta.",
      referencias: ["manual-14", "qrh-3-4"],
    },
    {
      id: "adrenalina-infusao-bronco", farmaco: "Adrenalina", indicacao: "Espasmo que persiste — infusão",
      populacao: "todas", via: INFUSAO,
      dose: { usual: 0.1, unidade: "mcg", por: "kg/min" }, apresentacoes: [ADRENALINA_60], altoRisco: true,
      velocidade: "Com 3 mg em 50 mL, cada mL/h é 1 mcg/min: 7 mL/h no adulto de 70 kg.",
      referencias: ["manual-14"],
    },
    {
      id: "salbutamol-nebulizacao-bronco", farmaco: "Salbutamol", indicacao: "Primeira linha, no circuito",
      populacao: "todas", idadeAnos: { min: 5 }, via: NEBULIZACAO,
      dose: { usual: 5, unidade: "mg", por: "fixa" }, apresentacoes: [SALBUTAMOL_NEBULIZACAO],
      referencias: ["qrh-3-4", "manual-14"],
    },
    {
      id: "salbutamol-nebulizacao-bronco-menor-5", farmaco: "Salbutamol", indicacao: "Primeira linha, no circuito (menos de 5 anos)",
      populacao: "pediatrico", idadeAnos: { max: 5 }, via: NEBULIZACAO,
      dose: { usual: 2.5, unidade: "mg", por: "fixa" }, apresentacoes: [SALBUTAMOL_NEBULIZACAO],
      referencias: ["qrh-3-4"],
    },
    {
      id: "ipratropio-bronco-adulto", farmaco: "Brometo de ipratrópio", indicacao: "Com o salbutamol, no circuito",
      populacao: "adulto", via: NEBULIZACAO,
      dose: { usual: 0.5, unidade: "mg", por: "fixa" }, apresentacoes: [IPRATROPIO_NEBULIZACAO],
      par: "ipratropio-bronco-ped", referencias: ["qrh-3-4", "manual-14"],
    },
    {
      id: "ipratropio-bronco-ped", farmaco: "Brometo de ipratrópio", indicacao: "Com o salbutamol, no circuito (2 a 12 anos)",
      populacao: "pediatrico", idadeAnos: { min: 2 }, via: NEBULIZACAO,
      dose: { usual: 0.25, unidade: "mg", por: "fixa" }, apresentacoes: [IPRATROPIO_NEBULIZACAO],
      par: "ipratropio-bronco-adulto", referencias: ["qrh-3-4"],
    },
    {
      id: "salbutamol-bolus-bronco-adulto", farmaco: "Salbutamol", indicacao: "IV em bolus",
      populacao: "adulto", via: "IV",
      dose: { usual: 250, unidade: "mcg", por: "fixa" }, apresentacoes: [SALBUTAMOL_50, SALBUTAMOL_500],
      velocidade: "Em 5 minutos.",
      referencias: ["manual-14", "qrh-3-4"],
    },
    {
      id: "salbutamol-infusao-bronco-adulto", farmaco: "Salbutamol", indicacao: "IV em infusão",
      populacao: "adulto", via: INFUSAO,
      dose: { min: 5, max: 25, unidade: "mcg", por: "min" }, apresentacoes: [SALBUTAMOL_100, SALBUTAMOL_500],
      velocidade: "Carga de 200 mcg em 1 minuto; depois 5 a 25 mcg/min.",
      referencias: ["manual-14"],
    },
    {
      id: "salbutamol-bolus-bronco-lactente", farmaco: "Salbutamol", indicacao: "IV em bolus (1 a 23 meses)",
      populacao: "pediatrico", idadeAnos: { max: 2 }, via: "IV",
      dose: { usual: 5, unidade: "mcg", por: "kg" }, apresentacoes: [SALBUTAMOL_50],
      velocidade: "Uma vez, em 5 minutos.",
      referencias: ["qrh-3-4"],
    },
    {
      id: "salbutamol-bolus-bronco-ped", farmaco: "Salbutamol", indicacao: "IV em bolus (2 anos ou mais)",
      populacao: "pediatrico", idadeAnos: { min: 2 }, via: "IV",
      dose: { usual: 15, unidade: "mcg", por: "kg" }, tetoAbsoluto: { valor: 250, unidade: "mcg" },
      apresentacoes: [SALBUTAMOL_50],
      velocidade: "Uma vez, em 5 minutos. Máximo de 250 mcg.",
      referencias: ["qrh-3-4"],
    },
    {
      id: "salbutamol-carga-bronco-ped", farmaco: "Salbutamol", indicacao: "IV — carga por 1 hora (2 a 12 anos)",
      populacao: "pediatrico", idadeAnos: { min: 2 }, via: INFUSAO,
      dose: { usual: 5, unidade: "mcg", por: "kg/min" }, tetoAbsoluto: { valor: 200, unidade: "mcg" },
      apresentacoes: [SALBUTAMOL_100, SALBUTAMOL_500],
      velocidade: "Por 1 hora. Máximo de 200 mcg/min.",
      referencias: ["manual-14"],
    },
    {
      id: "salbutamol-manutencao-bronco-ped", farmaco: "Salbutamol", indicacao: "IV — depois da carga (2 a 12 anos)",
      populacao: "pediatrico", idadeAnos: { min: 2 }, via: INFUSAO,
      dose: { min: 1, max: 2, unidade: "mcg", por: "kg/min" }, tetoAbsoluto: { valor: 80, unidade: "mcg" },
      apresentacoes: [SALBUTAMOL_100, SALBUTAMOL_500],
      velocidade: "Máximo de 80 mcg/min.",
      referencias: ["manual-14"],
    },
    {
      id: "magnesio-bronco-adulto", farmaco: "Sulfato de magnésio", indicacao: "Adjuvante",
      populacao: "adulto", via: "IV",
      dose: { usual: 2, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_50, MAGNESIO_10],
      velocidade: "Em 20 minutos.",
      par: "magnesio-bronco-ped", referencias: ["qrh-3-4"],
    },
    {
      id: "magnesio-bronco-ped", farmaco: "Sulfato de magnésio", indicacao: "Adjuvante",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 50, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 2, unidade: "g" },
      apresentacoes: [MAGNESIO_10, MAGNESIO_50],
      velocidade: "Em 20 minutos.",
      par: "magnesio-bronco-adulto", referencias: ["qrh-3-4"],
    },
    {
      id: "hidrocortisona-bronco-adulto", farmaco: "Hidrocortisona", indicacao: "Adjuvante",
      populacao: "adulto", via: "IV",
      dose: { usual: 200, unidade: "mg", por: "fixa" }, apresentacoes: [HIDROCORTISONA_50],
      par: "hidrocortisona-bronco-ped", referencias: ["qrh-3-4"],
    },
    {
      id: "hidrocortisona-bronco-ped", farmaco: "Hidrocortisona", indicacao: "Adjuvante",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 4, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 200, unidade: "mg" },
      apresentacoes: [HIDROCORTISONA_50],
      par: "hidrocortisona-bronco-adulto", referencias: ["qrh-3-4"],
    },
  ],
  volumes: [],
  pensarEm: [
    "Anafilaxia: hipotensão, eritema e urticária junto com o broncoespasmo.",
    "Via aérea: tubo seletivo, dobrado, obstruído ou mal posicionado; laringoespasmo.",
    "Imitam broncoespasmo: edema pulmonar, SDRA, pneumotórax, obstrução do circuito, corpo estranho.",
    "Broncoaspiração.",
  ],
  depois: [
    "Radiografia de tórax assim que for seguro.",
    "UTI ou recuperação monitorizada conforme a gravidade e a resposta.",
    "Registrar na ficha as doses, os horários e a evolução das pressões e da gasometria.",
  ],
  divergencias: [
    {
      tema: "Salbutamol IV no adulto",
      posicoes: [
        { texto: "Bolus de 250 mcg em 5 minutos; infusão com carga de 200 mcg em 1 minuto e depois 5 a 25 mcg/min.", referencia: "manual-14" },
        { texto: "Bolus de 250 mcg diluído, lento; infusão de 5 a 20 mcg/min.", referencia: "qrh-3-4" },
      ],
      escolha: "O protocolo segue a faixa do Manual; o teto do QRH é menor (20 mcg/min).",
    },
    {
      tema: "Salbutamol IV na criança",
      posicoes: [
        { texto: "2 a 12 anos: carga de 5 mcg/kg/min (máximo 200 mcg/min) por 1 hora, depois 1 a 2 mcg/kg/min (máximo 80 mcg/min).", referencia: "manual-14" },
        { texto: "Bolus de 5 mcg/kg (1 a 23 meses) ou 15 mcg/kg (2 a 17 anos, máximo 250 mcg) em 5 minutos; infusão de 0,5 a 1 mcg/kg/min (máximo 20 mcg/min).", referencia: "qrh-3-4" },
      ],
      escolha: "O protocolo mostra o bolus do QRH e a infusão do Manual. As infusões diferem muito — a do Manual chega a quatro vezes a do QRH. Confira com a rotina do seu serviço.",
    },
    {
      tema: "Bolus de adrenalina no adulto",
      posicoes: [
        { texto: "0,1 a 1 mcg/kg, titulado pela hemodinâmica (7 a 70 mcg para 70 kg).", referencia: "manual-14" },
        { texto: "10 a 100 mcg IV lento (criança: 0,1 a 1 mcg/kg).", referencia: "qrh-3-4" },
      ],
      escolha: "Faixas próximas; o protocolo calcula por kg, como o Manual, o que vale também para a criança.",
    },
  ],
  referencias: ["manual-14", "qrh-3-4"],
  relacionados: [
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};
