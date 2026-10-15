/**
 * ANAFILAXIA PERIOPERATÓRIA — adulto, gestante e criança.
 *
 * Conferido também com o Manual de Crises em Anestesia (protocolo 06, lido
 * no exemplar do responsável técnico): as doses da criança, a adrenalina IM
 * por idade, a infusão e o manejo refratário coincidem; o bolus IV do adulto
 * no grau 3 diverge e está em `divergencias`.
 *
 * As doses vêm dos cartões ANZAAG-ANZCA de 2022 (abertos e lidos nos PDFs
 * oficiais) e do QRH da Association of Anaesthetists; onde as duas fontes
 * diferem, as duas ficam em `divergencias` e o revisor decide. O texto das
 * condutas é do AVANEST: os cartões são protegidos por direito autoral, e
 * o que se aproveita deles são os números e a ordem clínica, com a fonte.
 */

import type { ApresentacaoDoProtocolo, Protocolo } from "../tipos.ts";

/* Adrenalina: a ampola brasileira é 1 mg/mL (1:1.000). */
const ADRENALINA_PURA_IM: ApresentacaoDoProtocolo = {
  rotulo: "Ampola pura 1 mg/mL (1:1.000)", quantidade: 1, unidade: "mg", mL: 1, vias: ["IM"],
};
const ADRENALINA_PURA_PCR: ApresentacaoDoProtocolo = {
  rotulo: "Ampola pura 1 mg/mL — só na PCR", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
};
const ADRENALINA_100: ApresentacaoDoProtocolo = {
  rotulo: "1 mg em 10 mL — 100 mcg/mL (1:10.000)", quantidade: 100, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (1 mg) + 9 mL de SF 0,9%",
};
const ADRENALINA_20: ApresentacaoDoProtocolo = {
  rotulo: "1 mg em 50 mL — 20 mcg/mL", quantidade: 20, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (1 mg) em 50 mL de SF 0,9%",
};
const ADRENALINA_10: ApresentacaoDoProtocolo = {
  rotulo: "1 mg em 100 mL — 10 mcg/mL (1:100.000)", quantidade: 10, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (1 mg) em 100 mL de SF 0,9%",
};
const ADRENALINA_60: ApresentacaoDoProtocolo = {
  rotulo: "3 mg em 50 mL — 60 mcg/mL", quantidade: 60, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "3 ampolas (3 mg) em 50 mL de SF 0,9%",
};

const NORADRENALINA_16: ApresentacaoDoProtocolo = {
  rotulo: "4 mg em 250 mL — 16 mcg/mL", quantidade: 16, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "1 ampola de 4 mg em 250 mL de SG 5%",
};
const NORADRENALINA_POR_KG: ApresentacaoDoProtocolo = {
  rotulo: "0,15 mg/kg em 50 mL", quantidade: 0.15, unidade: "mg", mL: 50, vias: ["IV"], porPeso: true,
  preparo: "0,15 mg por kg do paciente em 50 mL: 2 a 40 mL/h = 0,1 a 2 mcg/kg/min",
};
const VASOPRESSINA_1: ApresentacaoDoProtocolo = {
  rotulo: "20 UI em 20 mL — 1 UI/mL", quantidade: 1, unidade: "UI", mL: 1, vias: ["IV"],
  preparo: "1 ampola (20 UI) em 20 mL de SF 0,9%",
};
const VASOPRESSINA_02: ApresentacaoDoProtocolo = {
  rotulo: "20 UI em 100 mL — 0,2 UI/mL", quantidade: 0.2, unidade: "UI", mL: 1, vias: ["IV"],
  preparo: "1 ampola (20 UI) em 100 mL de SF 0,9%",
};
const VASOPRESSINA_POR_KG: ApresentacaoDoProtocolo = {
  rotulo: "1 UI/kg em 50 mL", quantidade: 1, unidade: "UI", mL: 50, vias: ["IV"], porPeso: true,
  preparo: "1 UI por kg do paciente em 50 mL: bolus de 2 mL, depois 1 a 3 mL/h",
};
const GLUCAGON_1: ApresentacaoDoProtocolo = {
  rotulo: "1 mg em 1 mL (frasco reconstituído)", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
};
const MAGNESIO_50: ApresentacaoDoProtocolo = {
  rotulo: "Sulfato de magnésio 50% — 500 mg/mL", quantidade: 500, unidade: "mg", mL: 1, vias: ["IV"],
};
const AMINOFILINA_24: ApresentacaoDoProtocolo = {
  rotulo: "240 mg em 10 mL — 24 mg/mL", quantidade: 24, unidade: "mg", mL: 1, vias: ["IV"],
};
const HIDROCORTISONA_50: ApresentacaoDoProtocolo = {
  rotulo: "100 mg em 2 mL de diluente — 50 mg/mL", quantidade: 50, unidade: "mg", mL: 1, vias: ["IV", "IM"],
};

export const ANAFILAXIA: Protocolo = {
  id: "anafilaxia",
  titulo: "Anafilaxia perioperatória",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["anafilaxia", "choque anafilático", "reação alérgica grave", "reação anafilactoide", "alergia"],
  sinais: [
    "hipotensão", "PA caindo", "pressão caindo", "taquicardia", "broncoespasmo", "chiado", "sibilo",
    "pressão de via aérea alta", "EtCO2 caindo", "capnografia caindo", "dessaturação", "rash", "eritema",
    "urticária", "vermelhidão", "angioedema", "edema de face", "PCR", "parada",
  ],
  resumo: "Hipotensão e/ou broncoespasmo minutos depois de um fármaco, com ou sem pele. Adrenalina cedo, pela gravidade.",
  reconhecer: [
    "Gravidade: grau 1, só pele e mucosa; grau 2 (moderada), hipotensão, taquicardia, broncoespasmo, ventilação difícil; grau 3 (risco de vida), hipotensão grave, bradi ou taquiarritmia, broncoespasmo grave ou edema de via aérea; grau 4, PCR.",
    "Hipotensão sem outra explicação, em geral minutos depois do antibiótico, do bloqueador neuromuscular ou de outro fármaco IV.",
    "Taquicardia; às vezes bradicardia.",
    "Broncoespasmo: pressão de via aérea subindo, curva de capnografia obstrutiva, EtCO2 caindo, dessaturação.",
    "Pele: eritema, urticária, angioedema. Podem faltar, principalmente na hipotensão grave.",
    "Clorexidina, látex e corante azul podem dar reação mais tardia.",
    "PCR pode ser a primeira manifestação.",
  ],
  agirAgora: [
    { texto: "Chamar ajuda, anotar a hora e parar a cirurgia (ou não começar).",
      detalhe: "Definir um líder, alguém para anotar e alguém para ler o protocolo. Pedir o carrinho de parada." },
    { texto: "Retirar os desencadeantes possíveis.",
      detalhe: "Antibiótico em curso, coloide sintético, clorexidina (inclusive cateter impregnado), látex, corante. Manter a anestesia com o mínimo necessário." },
    { texto: "O2 a 100%. Garantir a via aérea; intubar cedo se houver edema.",
      detalhe: "Conferir a capnografia: sem curva, o tubo está no lugar errado." },
    { texto: "Hipotensão: elevar as pernas. PA sistólica abaixo de 50 mmHg ou PCR: começar compressões.",
      detalhe: "PCR: adrenalina na dose de PCR e algoritmo de ritmo não chocável." },
    { texto: "Adrenalina IV em bolus pela gravidade, repetindo a cada 1 a 2 minutos.",
      detalhe: "Grau 2 (moderada): dose menor; grau 3 (risco de vida): dose maior. Sem acesso venoso ou sem monitorização: adrenalina IM." },
    { texto: "Cristaloide rápido, em acesso calibroso, repetindo até a pressão responder.",
      detalhe: "Pelo menos 20 mL/kg; pode precisar de um segundo acesso. Considere linha arterial cedo." },
    { texto: "Mais de 3 bolus: iniciar a infusão de adrenalina (pode ser periférica)." },
    { texto: "Gestante: deslocar o útero para a esquerda com a mão. PCR sem retorno em 5 minutos: cesárea perimortem.",
      so: ["gestante"] },
    { texto: "Sem resposta: manejo refratário.",
      detalhe: "Segundo vasopressor (noradrenalina e/ou vasopressina), glucagon se em uso de betabloqueador, mais volume, ecocardiograma; ECMO onde houver." },
    { texto: "Assim que estabilizar, colher triptase.", detalhe: "Sem atrasar a ressuscitação." },
  ],
  medicamentos: [
    /* ---------------- Adulto: imediato ---------------- */
    {
      id: "adrenalina-iv-moderada-adulto", farmaco: "Adrenalina", indicacao: "Grau 2 — reação moderada",
      populacao: "adulto", via: "IV",
      dose: { min: 10, max: 20, unidade: "mcg", por: "fixa" },
      apresentacoes: [ADRENALINA_100, ADRENALINA_10], altoRisco: true,
      repeticao: "A cada 1 a 2 minutos; sem resposta, 50 mcg.",
      par: "adrenalina-iv-moderada-ped", referencias: ["anzaag-cartao-1"],
    },
    {
      id: "adrenalina-iv-grave-adulto", farmaco: "Adrenalina", indicacao: "Grau 3 — risco de vida",
      populacao: "adulto", via: "IV",
      dose: { min: 50, max: 100, unidade: "mcg", por: "fixa" },
      apresentacoes: [ADRENALINA_100, ADRENALINA_10], altoRisco: true,
      repeticao: "A cada 1 a 2 minutos; sem resposta, 200 mcg.",
      par: "adrenalina-iv-grave-ped", referencias: ["anzaag-cartao-1", "qrh-3-1"],
    },
    {
      id: "adrenalina-im-adulto", farmaco: "Adrenalina", indicacao: "Graus 2 e 3 sem acesso venoso ou sem monitorização, ou enquanto prepara a infusão",
      populacao: "adulto", via: "IM",
      dose: { usual: 500, unidade: "mcg", por: "fixa" },
      apresentacoes: [ADRENALINA_PURA_IM], altoRisco: true,
      repeticao: "A cada 5 minutos, se preciso, na face lateral da coxa.",
      referencias: ["anzaag-cartao-1", "qrh-3-1", "manual-06"],
    },
    {
      id: "adrenalina-infusao-adulto", farmaco: "Adrenalina", indicacao: "Depois de 3 bolus",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 3, max: 40, unidade: "mcg", por: "min" },
      apresentacoes: [ADRENALINA_60], altoRisco: true,
      velocidade: "Começar em 3 mcg/min e titular até 40 mcg/min (cerca de 0,05 a 0,5 mcg/kg/min). Pode ser periférica.",
      par: "adrenalina-infusao-ped", referencias: ["anzaag-cartao-1", "qrh-3-1", "manual-06"],
    },
    {
      id: "adrenalina-pcr-adulto", farmaco: "Adrenalina", indicacao: "PCR",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "mg", por: "fixa" },
      apresentacoes: [ADRENALINA_PURA_PCR], altoRisco: true,
      repeticao: "Logo, e a cada 2º ciclo de RCP (Manual, protocolo 02). O cartão ANZAAG admite repetir a cada 1 a 2 minutos na anafilaxia.",
      par: "adrenalina-pcr-ped", referencias: ["anzaag-cartao-1", "manual-02"],
    },

    /* ---------------- Adulto: refratário ---------------- */
    {
      id: "noradrenalina-adulto", farmaco: "Noradrenalina", indicacao: "Hipotensão resistente (segundo vasopressor)",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 3, max: 40, unidade: "mcg", por: "min" },
      apresentacoes: [NORADRENALINA_16], altoRisco: true,
      velocidade: "3 a 40 mcg/min (cerca de 0,05 a 0,5 mcg/kg/min), junto com a adrenalina. O Manual (protocolo 06) indica 0,1 mcg/kg/min.",
      par: "noradrenalina-ped", referencias: ["anzaag-cartao-3"],
      cuidados: ["Não confundir com adrenalina: rótulos e seringas parecidos."],
    },
    {
      id: "vasopressina-bolus-adulto", farmaco: "Vasopressina", indicacao: "Hipotensão resistente — bolus",
      populacao: "adulto", via: "IV",
      dose: { min: 1, max: 2, unidade: "UI", por: "fixa" },
      apresentacoes: [VASOPRESSINA_1],
      repeticao: "Depois, infusão de 2 UI/h.",
      par: "vasopressina-bolus-ped", referencias: ["anzaag-cartao-3", "qrh-3-1", "manual-06"],
    },
    {
      id: "vasopressina-infusao-adulto", farmaco: "Vasopressina", indicacao: "Hipotensão resistente — infusão",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { usual: 2, unidade: "UI", por: "h" },
      apresentacoes: [VASOPRESSINA_02],
      par: "vasopressina-infusao-ped", referencias: ["anzaag-cartao-3", "manual-06"],
    },
    {
      id: "glucagon-adulto", farmaco: "Glucagon", indicacao: "Hipotensão resistente em uso de betabloqueador",
      populacao: "adulto", via: "IV",
      dose: { min: 1, max: 2, unidade: "mg", por: "fixa" },
      apresentacoes: [GLUCAGON_1],
      repeticao: "A cada 5 minutos até responder.",
      cuidados: ["Pode dar náusea e vômito: proteger a via aérea."],
      par: "glucagon-ped", referencias: ["anzaag-cartao-3", "qrh-3-1", "manual-06"],
    },
    {
      id: "magnesio-adulto", farmaco: "Sulfato de magnésio", indicacao: "Broncoespasmo resistente",
      populacao: "adulto", via: "IV",
      dose: { usual: 2, unidade: "g", por: "fixa" },
      apresentacoes: [MAGNESIO_50],
      velocidade: "Em 20 minutos.",
      par: "magnesio-ped", referencias: ["anzaag-cartao-3"],
    },
    {
      id: "hidrocortisona-adulto", farmaco: "Hidrocortisona", indicacao: "Depois de estabilizar (não é tratamento da fase aguda)",
      populacao: "adulto", via: "IV",
      dose: { usual: 200, unidade: "mg", por: "fixa" },
      apresentacoes: [HIDROCORTISONA_50],
      velocidade: "IV lento.",
      par: "hidrocortisona-ped", referencias: ["aagbi-2009", "qrh-3-1"],
    },

    /* ---------------- Criança (0 a 12 anos): imediato ---------------- */
    {
      id: "adrenalina-iv-moderada-ped", farmaco: "Adrenalina", indicacao: "Grau 2 — reação moderada",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 2, unidade: "mcg", por: "kg" },
      apresentacoes: [ADRENALINA_20, ADRENALINA_10], altoRisco: true,
      repeticao: "A cada 1 a 2 minutos; aumentar se não responder.",
      par: "adrenalina-iv-moderada-adulto", referencias: ["anzaag-cartao-2", "manual-06"],
    },
    {
      id: "adrenalina-iv-grave-ped", farmaco: "Adrenalina", indicacao: "Grau 3 — risco de vida",
      populacao: "pediatrico", via: "IV",
      dose: { min: 4, max: 10, unidade: "mcg", por: "kg" },
      apresentacoes: [ADRENALINA_20, ADRENALINA_10], altoRisco: true,
      repeticao: "A cada 1 a 2 minutos; aumentar se não responder.",
      par: "adrenalina-iv-grave-adulto", referencias: ["anzaag-cartao-2", "manual-06"],
    },
    {
      id: "adrenalina-im-ped-menor-6", farmaco: "Adrenalina", indicacao: "Graus 2 e 3 sem acesso venoso — menos de 6 anos",
      populacao: "pediatrico", idadeAnos: { max: 6 }, via: "IM",
      dose: { usual: 150, unidade: "mcg", por: "fixa" },
      apresentacoes: [ADRENALINA_PURA_IM], altoRisco: true,
      repeticao: "A cada 5 minutos, se preciso, na face lateral da coxa.",
      referencias: ["anzaag-cartao-2", "aagbi-2009", "manual-06"],
    },
    {
      id: "adrenalina-im-ped-6-12", farmaco: "Adrenalina", indicacao: "Graus 2 e 3 sem acesso venoso — 6 a 12 anos",
      populacao: "pediatrico", idadeAnos: { min: 6, max: 12 }, via: "IM",
      dose: { usual: 300, unidade: "mcg", por: "fixa" },
      apresentacoes: [ADRENALINA_PURA_IM], altoRisco: true,
      repeticao: "A cada 5 minutos, se preciso, na face lateral da coxa.",
      referencias: ["anzaag-cartao-2", "aagbi-2009", "manual-06"],
    },
    {
      id: "adrenalina-infusao-ped", farmaco: "Adrenalina", indicacao: "Iniciar assim que possível",
      populacao: "pediatrico", via: "IV, infusão contínua",
      dose: { min: 0.1, max: 2, unidade: "mcg", por: "kg/min" },
      apresentacoes: [ADRENALINA_20], altoRisco: true,
      velocidade: "Começar em 0,1 mcg/kg/min (0,3 mL/kg/h da solução de 20 mcg/mL) e titular até 2 mcg/kg/min. Pode ser periférica.",
      par: "adrenalina-infusao-adulto", referencias: ["anzaag-cartao-2"],
    },
    {
      id: "adrenalina-pcr-ped", farmaco: "Adrenalina", indicacao: "PCR",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 10, unidade: "mcg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "mg" },
      apresentacoes: [ADRENALINA_100], altoRisco: true,
      repeticao: "A cada 3 a 5 minutos (Manual, protocolo 03); o cartão ANZAAG admite 1 a 4 minutos. Máximo de 1 mg por dose.",
      par: "adrenalina-pcr-adulto", referencias: ["anzaag-cartao-2", "aha-2020-pediatrico", "manual-03"],
    },

    /* ---------------- Criança: refratário ---------------- */
    {
      id: "noradrenalina-ped", farmaco: "Noradrenalina", indicacao: "Hipotensão resistente (segundo vasopressor)",
      populacao: "pediatrico", via: "IV, infusão contínua",
      dose: { min: 0.1, max: 2, unidade: "mcg", por: "kg/min" },
      apresentacoes: [NORADRENALINA_POR_KG], altoRisco: true,
      velocidade: "2 a 40 mL/h da solução de 0,15 mg/kg em 50 mL.",
      cuidados: ["Não confundir com adrenalina: rótulos e seringas parecidos."],
      par: "noradrenalina-adulto", referencias: ["anzaag-cartao-4"],
    },
    {
      id: "vasopressina-bolus-ped", farmaco: "Vasopressina", indicacao: "Hipotensão resistente — bolus",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 0.04, unidade: "UI", por: "kg" },
      apresentacoes: [VASOPRESSINA_POR_KG],
      repeticao: "2 mL da solução de 1 UI/kg em 50 mL; depois, a infusão.",
      par: "vasopressina-bolus-adulto", referencias: ["anzaag-cartao-4"],
    },
    {
      id: "vasopressina-infusao-ped", farmaco: "Vasopressina", indicacao: "Hipotensão resistente — infusão",
      populacao: "pediatrico", via: "IV, infusão contínua",
      dose: { min: 0.02, max: 0.06, unidade: "UI", por: "kg/h" },
      apresentacoes: [VASOPRESSINA_POR_KG],
      velocidade: "1 a 3 mL/h da solução de 1 UI/kg em 50 mL.",
      par: "vasopressina-infusao-adulto", referencias: ["anzaag-cartao-4"],
    },
    {
      id: "glucagon-ped", farmaco: "Glucagon", indicacao: "Hipotensão resistente em uso de betabloqueador",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 40, unidade: "mcg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "mg" },
      apresentacoes: [GLUCAGON_1],
      par: "glucagon-adulto", referencias: ["anzaag-cartao-4"],
    },
    {
      id: "magnesio-ped", farmaco: "Sulfato de magnésio", indicacao: "Broncoespasmo resistente",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 50, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 2, unidade: "g" },
      apresentacoes: [MAGNESIO_50],
      velocidade: "Em 20 minutos (0,1 mL/kg da solução a 50%).",
      par: "magnesio-adulto", referencias: ["anzaag-cartao-4"],
    },
    {
      id: "aminofilina-ped", farmaco: "Aminofilina", indicacao: "Broncoespasmo resistente",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 10, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 500, unidade: "mg" },
      apresentacoes: [AMINOFILINA_24],
      velocidade: "Em 1 hora.",
      referencias: ["anzaag-cartao-4"],
    },
    {
      id: "hidrocortisona-ped", farmaco: "Hidrocortisona", indicacao: "Depois de estabilizar",
      populacao: "pediatrico", via: "IV",
      dose: { min: 2, max: 4, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 200, unidade: "mg" },
      apresentacoes: [HIDROCORTISONA_50],
      par: "hidrocortisona-adulto", referencias: ["anzaag-cartao-4"],
    },
  ],
  volumes: [
    { id: "cristaloide-kg-adulto", indicacao: "Bolus inicial (pelo menos)", populacao: "adulto",
      mlPorKg: { min: 20 }, repeticao: "Volumes maiores e um segundo acesso podem ser necessários.",
      referencias: ["qrh-3-1", "manual-06"] },
    { id: "cristaloide-moderada-adulto", indicacao: "Grau 2 — reação moderada", populacao: "adulto",
      mlFixo: { min: 500 }, repeticao: "Repetir conforme a pressão.",
      referencias: ["anzaag-cartao-1"] },
    { id: "cristaloide-grave-adulto", indicacao: "Grau 3 — risco de vida", populacao: "adulto",
      mlFixo: { min: 1000 }, repeticao: "Repetir conforme a pressão; PCR: 2 L. Planejar grande volume.",
      referencias: ["anzaag-cartao-1"] },
    { id: "cristaloide-refrataria-adulto", indicacao: "Hipotensão resistente — volume adicional", populacao: "adulto",
      mlPorKg: { min: 50 }, referencias: ["anzaag-cartao-3"] },
    { id: "cristaloide-ped", indicacao: "Bolus inicial", populacao: "pediatrico",
      mlPorKg: { min: 20 }, repeticao: "Repetir até a pressão responder.",
      referencias: ["anzaag-cartao-2", "qrh-3-1"] },
    { id: "cristaloide-refrataria-ped", indicacao: "Hipotensão resistente — volume adicional", populacao: "pediatrico",
      mlPorKg: { min: 20, max: 40 }, referencias: ["anzaag-cartao-4"] },
  ],
  pensarEm: [
    "Hipotensão de outra causa: anestésico em excesso, bloqueio do neuroeixo, hipovolemia ou sangramento.",
    "Via aérea: intubação esofágica ou seletiva, tubo dobrado, falha do circuito ou do aparelho.",
    "Broncoespasmo de outra causa: asma, via aérea irritável, aspiração.",
    "Pneumotórax hipertensivo.",
    "Embolia pulmonar ou gasosa; tamponamento; isquemia miocárdica.",
    "Sepse; reação transfusional; toxicidade por anestésico local.",
    "Angioedema por IECA; mastocitose.",
  ],
  depois: [
    "Triptase: assim que possível depois do início, e de novo em 1 h, 4 h e depois de 24 h (ANZAAG 2022). Anotar o horário de cada amostra.",
    "Corticoide só depois de estabilizar. Anti-histamínico não trata hipotensão nem broncoespasmo; se usar, oral de segunda geração, com o paciente estável (parenteral não recomendado).",
    "Sugamadex não é recomendado para tratar a suspeita de anafilaxia ao rocurônio.",
    "Decidir com o cirurgião se a cirurgia continua; nas reações graves, em geral é adiada.",
    "UTI ou observação monitorizada: a reação pode durar ou voltar.",
    "Registrar na ficha todos os fármacos com os horários, as doses de adrenalina e a evolução.",
    "Marcar a suspeita de alergia no prontuário e na pulseira, avisar o paciente e encaminhar para investigação com alergista.",
    "Notificar à farmacovigilância do hospital.",
  ],
  divergencias: [
    {
      tema: "Primeiro bolus IV de adrenalina no adulto",
      posicoes: [
        { texto: "Pela gravidade: 10 a 20 mcg na moderada (sem resposta, 50 mcg); 50 a 100 mcg com risco de vida (sem resposta, 200 mcg).", referencia: "anzaag-cartao-1" },
        { texto: "50 mcg como dose inicial, repetida conforme a resposta.", referencia: "qrh-3-1" },
        { texto: "Grau 2: 20 mcg; grau 3: 100 a 200 mcg, a cada 1 a 2 minutos.", referencia: "manual-06" },
      ],
      escolha: "O protocolo segue o cartão ANZAAG de 2022, graduado pela gravidade. O Manual dá dose maior no grau 3 (100 a 200 mcg contra 50 a 100 mcg): diferença importante, o revisor decide.",
    },
    {
      tema: "Bolus IV de adrenalina na criança",
      posicoes: [
        { texto: "2 mcg/kg na moderada; 4 a 10 mcg/kg com risco de vida (solução de 20 mcg/mL).", referencia: "anzaag-cartao-2" },
        { texto: "1 mcg/kg, titulando pela resposta (solução de 10 mcg/mL).", referencia: "qrh-3-1" },
      ],
      escolha: "O protocolo segue o cartão ANZAAG; as duas soluções aparecem para o cálculo. Diferença importante: o revisor confirma.",
    },
    {
      tema: "Anti-histamínico",
      posicoes: [
        { texto: "Clorfeniramina IV no manejo secundário (adulto 10 mg).", referencia: "qrh-3-1" },
        { texto: "Sem papel na fase aguda; retirado dos cartões. Prometazina injetável não deve ser usada (piora a hipotensão).", referencia: "anzaag-diretriz-2022" },
        { texto: "Quando estável, anti-histamínico oral de segunda geração (e corticoide); parenteral não recomendado.", referencia: "manual-06" },
      ],
      escolha: "Não entra na lista de doses da crise. Se usar, oral de segunda geração depois de estabilizar (ANZAAG e Manual).",
    },
    {
      tema: "Volume de cristaloide no adulto",
      posicoes: [
        { texto: "Moderada 500 mL; risco de vida 1.000 mL; PCR 2 L.", referencia: "anzaag-cartao-1" },
        { texto: "20 mL/kg em bolus, repetindo até a pressão responder.", referencia: "qrh-3-1" },
        { texto: "Pelo menos 20 mL/kg; volumes maiores e um segundo acesso podem ser necessários.", referencia: "manual-06" },
      ],
      escolha: "Os dois aparecem: o fixo da ANZAAG e o por kg do QRH e do Manual (1.400 mL para 70 kg).",
    },
    {
      tema: "Intervalo da adrenalina na PCR",
      posicoes: [
        { texto: "Adulto: 1 mg, repetindo a cada 1 a 2 minutos se preciso.", referencia: "anzaag-cartao-1" },
        { texto: "Adulto: 1 mg logo, e depois a cada 2º ciclo de RCP.", referencia: "manual-02" },
        { texto: "Criança: 10 mcg/kg logo, e a cada 3 a 5 minutos.", referencia: "manual-03" },
      ],
      escolha: "A dose é a mesma nas fontes; o intervalo segue o algoritmo de PCR. O revisor decide se, na anafilaxia, vale o intervalo mais curto do cartão.",
    },
    {
      tema: "Hidrocortisona na criança",
      posicoes: [
        { texto: "2 a 4 mg/kg, máximo de 200 mg.", referencia: "anzaag-cartao-4" },
        { texto: "Por idade: menos de 6 meses 25 mg; 6 meses a 6 anos 50 mg; 6 a 12 anos 100 mg; acima de 12 anos 200 mg.", referencia: "aagbi-2009" },
      ],
      escolha: "O protocolo calcula por kg (ANZAAG).",
    },
    {
      tema: "Horário das amostras de triptase",
      posicoes: [
        { texto: "Logo depois do início, 1 h, 4 h e depois de 24 h.", referencia: "anzaag-diretriz-2022" },
        { texto: "Em 1, 4 e 24 horas.", referencia: "manual-06" },
        { texto: "Assim que estável, 1 a 2 h e depois de 24 h.", referencia: "qrh-3-1" },
      ],
      escolha: "O protocolo segue o ANZAAG 2022, que inclui as amostras do QRH e do Manual.",
    },
  ],
  referencias: [
    "anzaag-cartao-1", "anzaag-cartao-2", "anzaag-cartao-3", "anzaag-cartao-4", "anzaag-diretriz-2022",
    "qrh-3-1", "aagbi-2009", "manual-06", "manual-02", "manual-03", "nap6", "garvey-2019", "anzaag-2017", "aha-2020-pediatrico",
  ],
};
