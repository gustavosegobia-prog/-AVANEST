/**
 * SUPORTE AVANÇADO DE VIDA PEDIÁTRICO — a parada da criança na anestesia.
 *
 * Doses do Manual de Crises (protocolo 03, lido no livro) e do QRH 2-1 da
 * Association of Anaesthetists (quadro B, coluna por kg). O máximo de cada
 * dose por kg é a dose do adulto da mesma tabela. O texto das condutas é do
 * AVANEST. O adulto tem os protocolos de PCR (pcr.ts).
 */

import type { ApresentacaoDoProtocolo, Protocolo } from "../tipos.ts";
import {
  ADRENALINA_10, ADRENALINA_100, AMIODARONA_50, ATROPINA_025, ATROPINA_05, CLORETO_DE_CALCIO_10, LIDOCAINA_20,
  MAGNESIO_10, MAGNESIO_50, QUATRO_H_QUATRO_T,
} from "./comum.ts";
import { RITMOS_DE_PCR } from "./pcr.ts";

/** Pelo tubo, a dose é dez vezes a da veia: a seringa não pode ir para o acesso. */
const ADRENALINA_PURA_TUBO: ApresentacaoDoProtocolo = {
  rotulo: "Ampola pura 1 mg/mL — só pelo tubo", quantidade: 1, unidade: "mg", mL: 1, vias: ["Tubo"],
};

export const SAV_PEDIATRICO: Protocolo = {
  id: "sav-pediatrico",
  titulo: "Suporte avançado de vida pediátrico",
  categoria: "pediatria",
  populacoes: ["pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["PCR na criança", "parada cardíaca pediátrica", "SAV pediátrico", "PALS", "reanimação pediátrica"],
  sinais: ["sem pulso", "bradicardia", "FV", "TV", "AESP", "assistolia", "linha reta", "EtCO2 caindo", "parada"],
  resumo: "Na criança, a parada vem quase sempre da hipóxia ou do choque: oxigenar, RCP de qualidade, adrenalina 10 mcg/kg e choque de 4 J/kg no ritmo chocável.",
  reconhecer: [
    "Sem pulso central e ritmo de parada no monitor. Confira também a oxigenação e a curva de EtCO2.",
    "Na anestesia, fora da cirurgia cardíaca, a maioria das paradas da criança é assistolia ou AESP.",
    "Raramente o coração é a causa primária: o caminho comum é a asfixia (insuficiência respiratória progressiva) ou o choque.",
    "EtCO2: confirma o tubo e mede a qualidade da RCP; uma subida súbita sugere retorno da circulação.",
  ],
  agirAgora: [
    { texto: "Confirmar a parada: pulso, oxigenação e ritmo no monitor. Anunciar “parada” e anotar a hora.",
      detalhe: "Conferir logo a posição do tubo e corrigir qualquer hipóxia." },
    { texto: "Interromper qualquer estímulo vagal e passar para O2 a 100%." },
    { texto: "Pedir ajuda e dividir as funções." },
    { texto: "Compressões já, 100 a 120 por minuto, afundando 1/3 do tórax com retorno completo.",
      detalhe: "Ventilar 10 vezes por minuto, sem coincidir com a compressão. Metas: EtCO2 e diastólica acima de 20 mmHg; EtCO2 abaixo de 10 mmHg pede ajustar a técnica ou trocar quem comprime." },
    { texto: "FV ou TV sem pulso: choque de 4 J/kg e voltar às compressões; repetir a cada 2 minutos se o ritmo continuar chocável.",
      detalhe: "Adrenalina e amiodarona depois do 3º e do 5º choques. No DEA, use o atenuador de energia abaixo de 8 anos." },
    { texto: "Assistolia ou AESP: adrenalina 10 mcg/kg IV ou IO, logo." },
    { texto: "Desligar o agente anestésico e considerar intubar na checagem do ritmo." },
    { texto: "Na troca de quem comprime: checar ritmo e retorno da circulação em menos de 5 segundos e rever os 4 H e 4 T.",
      detalhe: "Ecocardiograma subxifoide nessa pausa ajuda a achar a causa." },
    { texto: "Adrenalina a cada 3 a 5 minutos (a cada 2 ciclos)." },
    { texto: "Sem acesso IV nem IO: adrenalina pelo tubo, 100 mcg/kg." },
    { texto: "RCP extracorpórea (ECMO) quando apropriado, onde houver equipe treinada e protocolo." },
  ],
  medicamentos: [
    {
      id: "adrenalina-sav-ped", farmaco: "Adrenalina", indicacao: "Assistolia/AESP logo; FV/TV depois do 3º choque",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 10, unidade: "mcg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "mg" },
      apresentacoes: [ADRENALINA_100, ADRENALINA_10], altoRisco: true,
      repeticao: "A cada 3 a 5 minutos. Máximo de 1 mg por dose, a dose do adulto.",
      referencias: ["manual-03", "qrh-2-1"],
    },
    {
      id: "adrenalina-tubo-ped", farmaco: "Adrenalina", indicacao: "Só sem acesso IV nem IO",
      populacao: "pediatrico", via: "Tubo endotraqueal",
      dose: { usual: 100, unidade: "mcg", por: "kg" },
      apresentacoes: [ADRENALINA_PURA_TUBO], altoRisco: true,
      cuidados: ["Dez vezes a dose da veia: identificar a seringa e não usá-la no acesso."],
      referencias: ["manual-03"],
    },
    {
      id: "amiodarona-sav-ped", farmaco: "Amiodarona", indicacao: "FV/TV: depois do 3º e do 5º choques",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 5, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 300, unidade: "mg" },
      apresentacoes: [AMIODARONA_50],
      repeticao: "Em bolus, na PCR. Máximo de 300 mg por dose, a dose do adulto.",
      referencias: ["manual-03", "qrh-2-1"],
    },
    {
      id: "lidocaina-sav-ped", farmaco: "Lidocaína", indicacao: "Alternativa à amiodarona — bolus",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 1, unidade: "mg", por: "kg" }, apresentacoes: [LIDOCAINA_20],
      referencias: ["manual-03"],
    },
    {
      id: "lidocaina-infusao-sav-ped", farmaco: "Lidocaína", indicacao: "Alternativa à amiodarona — infusão",
      populacao: "pediatrico", via: "IV, infusão contínua",
      dose: { min: 20, max: 50, unidade: "mcg", por: "kg/min" }, apresentacoes: [LIDOCAINA_20],
      referencias: ["manual-03"],
    },
    {
      id: "atropina-sav-ped", farmaco: "Atropina", indicacao: "Só se a bradicardia vier do tônus vagal",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 0.02, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 0.5, unidade: "mg" },
      apresentacoes: [ATROPINA_025, ATROPINA_05],
      repeticao: "Não é recomendada na parada sem causa vagal. Máximo de 0,5 mg por dose.",
      referencias: ["manual-03", "aha-2020-pediatrico"],
    },
    {
      id: "magnesio-sav-ped", farmaco: "Sulfato de magnésio", indicacao: "TV polimórfica ou hipomagnesemia",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 50, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 2, unidade: "g" },
      apresentacoes: [MAGNESIO_10, MAGNESIO_50],
      repeticao: "Máximo de 2 g, a dose do adulto.",
      referencias: ["qrh-2-1"],
    },
    {
      id: "cloreto-de-calcio-sav-ped", farmaco: "Cloreto de cálcio",
      indicacao: "Hipercalemia, hipocalcemia ou excesso de magnésio",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 20, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "g" },
      apresentacoes: [CLORETO_DE_CALCIO_10],
      repeticao: "0,2 mL/kg da solução a 10%. Máximo de 1 g (10 mL), a dose do adulto.",
      cuidados: ["Em veia calibrosa: extravasamento causa necrose."],
      referencias: ["qrh-2-1"],
    },
  ],
  volumes: [
    { id: "choque-ped", rotulo: "Choque — desfibrilador", indicacao: "Cada choque, na FV/TV sem pulso",
      populacao: "pediatrico", unidade: "J", porKg: { min: 4 },
      repeticao: "No DEA, atenuador de energia abaixo de 8 anos.", referencias: ["manual-03", "qrh-2-1"] },
    { id: "cristaloide-sav-ped", indicacao: "Bolus, se hipovolemia", populacao: "pediatrico", porKg: { min: 20 },
      referencias: ["qrh-2-1"] },
  ],
  pensarEm: [
    "Hipóxia, estímulo vagal e hipovolemia: as causas reversíveis mais comuns na criança.",
    "Via aérea: tubo deslocado, obstruído ou seletivo; falha do circuito ou do aparelho.",
    ...QUATRO_H_QUATRO_T,
    "Hipercalemia depois de succinilcolina em miopatia não diagnosticada.",
    "Anafilaxia, toxicidade por anestésico local, erro de dose (a conta por kg erra por 10 com facilidade: confira a seringa).",
  ],
  depois: [
    "Depois do retorno da circulação: retomar a anestesia, evitar hipóxia, hiperóxia, hipotensão e febre, e controlar glicemia e temperatura.",
    "UTI pediátrica; gasometria, eletrólitos e glicemia; tratar a causa encontrada.",
    "Registrar na ficha os horários de cada choque, de cada dose e do retorno da circulação.",
    "Conversar com a família e fazer a revisão do caso com a equipe.",
  ],
  divergencias: [
    {
      tema: "Dose de atropina na criança",
      posicoes: [
        { texto: "0,02 mg/kg, só se a bradicardia vier do aumento do tônus vagal.", referencia: "manual-03" },
        { texto: "10 mcg/kg, se o tônus vagal é a causa provável.", referencia: "qrh-2-1" },
      ],
      escolha: "O protocolo calcula 0,02 mg/kg (Manual), com máximo de 0,5 mg por dose; a dose do QRH é a metade.",
    },
  ],
  referencias: ["manual-03", "qrh-2-1", "aha-2020-pediatrico", "manual-01"],
  veja: [
    { protocolo: "pcr-fv-tv", quando: ["adulto", "gestante"], texto: "Adulto com ritmo chocável: doses fixas e choque de 120 a 200 J na PCR — FV/TV sem pulso." },
    { protocolo: "pcr-aesp-assistolia", quando: ["adulto", "gestante"], texto: "Adulto com ritmo não chocável: PCR — AESP/assistolia." },
  ],
  ritmos: RITMOS_DE_PCR,
  relacionados: [{ protocolo: "reanimacao-neonatal", texto: "Reanimação neonatal (sala de parto)" }],
};
