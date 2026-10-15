/**
 * ISQUEMIA MIOCÁRDICA INTRAOPERATÓRIA — adulto.
 *
 * Doses do Manual de Crises (protocolo 04, lido no livro; escritas para um
 * adulto de 70 kg) e do QRH 3-12 da Association of Anaesthetists (aberto e
 * lido), que não recomenda a nitroglicerina na criança. O texto das condutas
 * é do AVANEST.
 */

import type { ApresentacaoDoProtocolo, Protocolo } from "../tipos.ts";
import { FENILEFRINA_100, METARAMINOL_05 } from "./comum.ts";

const METOPROLOL_1: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 5 mg em 5 mL — 1 mg/mL", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
};
const ESMOLOL_10: ApresentacaoDoProtocolo = {
  rotulo: "10 mg/mL (100 mg em 10 mL)", quantidade: 10, unidade: "mg", mL: 1, vias: ["IV"],
};
const NITROGLICERINA_1: ApresentacaoDoProtocolo = {
  rotulo: "50 mg em 50 mL — 1 mg/mL", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "50 mg de nitroglicerina em 50 mL de SF 0,9%, em seringa",
};

const PARA_70_KG = "Dose do Manual para um adulto de 70 kg; titular pela resposta.";

export const ISQUEMIA: Protocolo = {
  id: "isquemia-miocardica",
  titulo: "Isquemia miocárdica intraoperatória",
  categoria: "cardiovascular",
  populacoes: ["adulto"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["isquemia", "infarto", "síndrome coronária aguda", "angina", "supra de ST", "infra de ST"],
  sinais: ["supra de ST", "infra de ST", "ST", "onda T", "ECG", "arritmia nova", "taquicardia", "hipotensão", "edema pulmonar"],
  resumo: "Diminuir a demanda e aumentar a oferta de O2 ao miocárdio: frequência entre 50 e 60, PAM acima de 75 mmHg, volume e hemoglobina corrigidos, nitroglicerina com a pressão em ordem.",
  reconhecer: [
    "Supra ou infra do segmento ST, ou onda T nova, no monitor: confirme no traçado ampliado ou no ECG de 12 derivações.",
    "Pode vir com arritmia nova, hipotensão ou edema pulmonar; no ecocardiograma, alteração segmentar da parede.",
    "Duas origens: a placa que rompe e fecha o vaso, ou a pressão de perfusão coronária que não basta para a demanda.",
  ],
  agirAgora: [
    { texto: "O2 para manter a SpO2 normal; garantir ventilação, anestesia e analgesia adequadas.",
      detalhe: "Pedir o carrinho de parada e o eletrocardiógrafo." },
    { texto: "Confirmar o ST: traçado ampliado ou ECG de 12 derivações; monitorar em CM5." },
    { texto: "Supra de ST: chamar o cardiologista, avisar o cirurgião e deixar o desfibrilador à mão.",
      detalhe: "Interromper ou terminar logo a cirurgia; discutir anticoagulação, antiagregante e reperfusão com cardiologia e cirurgia." },
    { texto: "Infra de ST: diminuir a demanda de O2 e, ao mesmo tempo, aumentar a oferta." },
    { texto: "Hipotenso: repor a perda de volume e conferir a hemoglobina; manter a PAM acima de 75 mmHg.",
      detalhe: "Vasodilatado: ajustar o anestésico ou titular o vasoconstritor (fenilefrina ou metaraminol)." },
    { texto: "Hipertenso: titular o betabloqueador e considerar a nitroglicerina em infusão." },
    { texto: "Frequência cardíaca entre 50 e 60 bpm.", detalhe: "Tratar a arritmia; reduzir tremor e febre." },
    { texto: "Com volume e pressão corrigidos, titular a nitroglicerina com cuidado.",
      detalhe: "Com a pressão baixa, a nitroglicerina piora a perfusão coronária." },
    { texto: "Corrigir potássio, magnésio e cálcio; tratar a anemia (hematócrito acima de 30%).",
      detalhe: "Cuidado com a sobrecarga de volume, principalmente na insuficiência cardíaca." },
    { texto: "Linha arterial e ecocardiograma: parede, contratilidade e pressões de enchimento." },
    { texto: "Isquemia que persiste: tratar como síndrome coronária aguda e pedir avaliação cardiológica urgente." },
  ],
  medicamentos: [
    {
      id: "metoprolol-isquemia", farmaco: "Metoprolol", indicacao: "Frequência alta ou hipertensão",
      populacao: "adulto", via: "IV",
      dose: { usual: 2.5, unidade: "mg", por: "fixa" }, apresentacoes: [METOPROLOL_1],
      repeticao: PARA_70_KG,
      cuidados: ["Evitar na hipotensão, no bloqueio AV, na insuficiência cardíaca descompensada e no broncoespasmo."],
      referencias: ["manual-04"],
    },
    {
      id: "esmolol-bolus-isquemia", farmaco: "Esmolol", indicacao: "Frequência alta ou hipertensão — bolus",
      populacao: "adulto", via: "IV",
      dose: { usual: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [ESMOLOL_10],
      cuidados: ["Evitar na hipotensão, no bloqueio AV, na insuficiência cardíaca descompensada e no broncoespasmo."],
      referencias: ["manual-04"],
    },
    {
      id: "esmolol-infusao-isquemia", farmaco: "Esmolol", indicacao: "Frequência alta ou hipertensão — infusão",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 50, max: 200, unidade: "mcg", por: "kg/min" }, apresentacoes: [ESMOLOL_10],
      referencias: ["manual-04"],
    },
    {
      id: "fenilefrina-isquemia", farmaco: "Fenilefrina", indicacao: "Hipotensão por vasodilatação",
      populacao: "adulto", via: "IV",
      dose: { min: 25, max: 50, unidade: "mcg", por: "fixa" }, apresentacoes: [FENILEFRINA_100],
      repeticao: PARA_70_KG,
      referencias: ["manual-04"],
    },
    {
      id: "metaraminol-isquemia", farmaco: "Metaraminol", indicacao: "Hipotensão por vasodilatação",
      populacao: "adulto", via: "IV",
      dose: { min: 0.5, max: 1, unidade: "mg", por: "fixa" }, apresentacoes: [METARAMINOL_05],
      repeticao: PARA_70_KG,
      referencias: ["manual-04"],
    },
    {
      id: "nitroglicerina-isquemia", farmaco: "Nitroglicerina", indicacao: "Hipertensão ou isquemia que persiste, com volume e pressão corrigidos",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { min: 3, max: 5, unidade: "mg", por: "h" }, apresentacoes: [NITROGLICERINA_1],
      velocidade: "Começar com 3 a 5 mL/h da solução de 1 mg/mL e titular pela resposta.",
      cuidados: ["Muito cuidado com a pressão baixa.", "Equipo próprio: o PVC comum adsorve a nitroglicerina."],
      referencias: ["manual-04", "qrh-3-12"],
    },
  ],
  volumes: [],
  pensarEm: [
    "Desequilíbrio entre oferta e demanda: taquicardia, hipertensão ou hipotensão, anemia, hipoxemia, dor ou anestesia superficial.",
    "Perfusão coronária = diastólica − pressão diastólica final do VE: diastólica baixa ou VE muito cheio reduzem a perfusão.",
    "Espasmo ou embolia coronária; anafilaxia (síndrome de Kounis).",
    "Embolia pulmonar, pneumotórax hipertensivo e tamponamento podem imitar o quadro.",
    "ST alterado sem isquemia: eletrodo fora do lugar, filtro do monitor, hipercalemia, hipotermia.",
  ],
  depois: [
    "UTI ou unidade coronariana, com avaliação do cardiologista.",
    "ECG de 12 derivações seriados e troponina.",
    "Cabeceira elevada, se possível.",
    "Discutir com cardiologia e cirurgia anticoagulação, antiagregante e cateterismo, pesando o risco de sangramento da cirurgia.",
    "Registrar na ficha o horário, o traçado, as doses e a evolução.",
  ],
  divergencias: [
    {
      tema: "Velocidade inicial da nitroglicerina",
      posicoes: [
        { texto: "50 mg em 50 mL de SF 0,9%; começar com 3 a 5 mL/h e titular.", referencia: "manual-04" },
        { texto: "Solução de 1 mg/mL; começar com 0,1 mL/kg/h (7 mL/h para 70 kg) e titular. Não recomendada na criança.", referencia: "qrh-3-12" },
      ],
      escolha: "O protocolo mostra o início do Manual, fixo e menor; os dois titulam pela resposta. O revisor decide.",
    },
  ],
  referencias: ["manual-04", "qrh-3-12"],
  relacionados: [{ protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" }],
};
