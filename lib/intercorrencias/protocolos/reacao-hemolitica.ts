/**
 * REAÇÃO HEMOLÍTICA TRANSFUSIONAL AGUDA — adulto, gestante e criança.
 *
 * Doses do Manual de Crises (protocolo 07, lido no livro) e do MSD Manual
 * (Sarode, revisão de 2026, aberto e lido), que diverge na furosemida, na
 * meta de diurese e nos vasopressores — as posições ficam lado a lado em
 * `divergencias`. O texto das condutas é do AVANEST.
 *
 * As soluções das infusões são as do Manual, para seringa de 50 mL; no
 * adulto de 70 kg, todas começam em 5 mL/h. Na criança, a mesma solução, com
 * a dose por kg da tabela do Manual.
 */

import type { ApresentacaoDoProtocolo, Protocolo } from "../tipos.ts";
import { ADRENALINA_60, FUROSEMIDA_10 } from "./comum.ts";

const MANITOL_20: ApresentacaoDoProtocolo = {
  rotulo: "Manitol 20% — 200 mg/mL (frasco de 250 mL)", quantidade: 200, unidade: "mg", mL: 1, vias: ["IV"],
};
const MANITOL_25: ApresentacaoDoProtocolo = {
  rotulo: "Manitol 25% — 250 mg/mL (a do Manual)", quantidade: 250, unidade: "mg", mL: 1, vias: ["IV"],
};
const NORADRENALINA_80: ApresentacaoDoProtocolo = {
  rotulo: "4 mg em 50 mL — 80 mcg/mL", quantidade: 80, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "4 mg de noradrenalina base em 50 mL de SF 0,9%",
};
const DOBUTAMINA_5: ApresentacaoDoProtocolo = {
  rotulo: "250 mg em 50 mL — 5 mg/mL", quantidade: 5, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (250 mg) em 50 mL de SF 0,9%",
};

const INICIO_70_KG = "Começar com 5 mL/h (adulto de 70 kg) e titular pela resposta.";
const INFUSAO = "IV, infusão contínua";

export const REACAO_HEMOLITICA: Protocolo = {
  id: "reacao-hemolitica-transfusional",
  titulo: "Reação hemolítica transfusional",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["reação transfusional", "transfusão incompatível", "incompatibilidade ABO", "hemólise", "reação hemolítica aguda"],
  sinais: ["hipotensão", "taquicardia", "broncoespasmo", "sibilância", "urticária", "hipóxia", "colúria", "urina escura", "sangramento difuso", "sangramento em mucosas", "transfusão"],
  resumo: "Parar a transfusão na hora, sustentar circulação e oxigenação, manter a diurese e tratar a coagulopatia; devolver as bolsas e colher amostras novas.",
  reconhecer: [
    "Durante ou logo depois de uma transfusão: hipotensão, taquicardia, hipóxia, broncoespasmo ou sibilância, taquipneia, urticária, edema.",
    "Sob anestesia geral, pode aparecer só como hipotensão, sangramento difuso (mucosas, incisão, locais de punção) ou urina escura (hemoglobinúria).",
    "Pode evoluir para colapso cardiovascular, coagulação intravascular disseminada e insuficiência renal.",
    "É rara, mas mata: na suspeita, pare a transfusão e confira a bolsa e o paciente.",
  ],
  agirAgora: [
    { texto: "Parar a transfusão e trocar o equipo.",
      detalhe: "Manter o acesso com SF 0,9%. Conferir a identificação do paciente e a etiqueta da bolsa." },
    { texto: "Pedir ajuda, avisar a equipe e o banco de sangue." },
    { texto: "Titular a FiO2 para a SpO2; tratar o broncoespasmo." },
    { texto: "Hipotensão: volume e vasoativos.",
      detalhe: "Se parecer anafilaxia, trate também como anafilaxia: os sinais se sobrepõem." },
    { texto: "Linha arterial para gasometria e monitorização." },
    { texto: "Com a hemodinâmica estável: cateter venoso central e sonda vesical de demora." },
    { texto: "Manter a diurese entre 0,5 e 1,5 mL/kg/h, com volume e diurético.",
      detalhe: "Inotrópico se o débito cardíaco não sustentar a diurese." },
    { texto: "Coagulopatia: tratar pelo coagulograma, junto com o banco de sangue.",
      detalhe: "As doses de hemocomponentes e hemostáticos estão no protocolo de hemorragia maciça." },
    { texto: "Devolver todas as bolsas ao banco de sangue e colher amostras novas de sangue e urina." },
    { texto: "Preparar a admissão na UTI." },
  ],
  medicamentos: [
    {
      id: "manitol-rht", farmaco: "Manitol", indicacao: "Diurese osmótica",
      populacao: "todas", via: "IV",
      dose: { min: 0.5, max: 1, unidade: "g", por: "kg" }, apresentacoes: [MANITOL_20, MANITOL_25],
      cuidados: ["Só com o volume reposto. Sem resposta ao diurético, pensar em necrose tubular: não insistir em volume nem diurético."],
      referencias: ["manual-07"],
    },
    {
      id: "furosemida-rht-05", farmaco: "Furosemida", indicacao: "Manter a diurese — 0,5 mg/kg",
      populacao: "todas", via: "IV",
      dose: { usual: 0.5, unidade: "mg", por: "kg" }, apresentacoes: [FUROSEMIDA_10],
      referencias: ["manual-07"],
    },
    {
      id: "furosemida-rht-1-3", farmaco: "Furosemida", indicacao: "Manter a diurese — 1 a 3 mg/kg",
      populacao: "todas", via: "IV",
      dose: { min: 1, max: 3, unidade: "mg", por: "kg" }, apresentacoes: [FUROSEMIDA_10],
      referencias: ["manual-07"],
    },
    {
      id: "adrenalina-infusao-rht-adulto", farmaco: "Adrenalina", indicacao: "Hipotensão — infusão",
      populacao: "adulto", via: INFUSAO,
      dose: { usual: 300, unidade: "mcg", por: "h" }, apresentacoes: [ADRENALINA_60], altoRisco: true,
      velocidade: `${INICIO_70_KG} 5 mL/h = 5 mcg/min.`,
      par: "adrenalina-infusao-rht-ped", referencias: ["manual-07"],
    },
    {
      id: "noradrenalina-infusao-rht-adulto", farmaco: "Noradrenalina", indicacao: "Hipotensão — infusão",
      populacao: "adulto", via: INFUSAO,
      dose: { usual: 400, unidade: "mcg", por: "h" }, apresentacoes: [NORADRENALINA_80], altoRisco: true,
      velocidade: `${INICIO_70_KG} 5 mL/h = cerca de 6,7 mcg/min.`,
      par: "noradrenalina-infusao-rht-ped", referencias: ["manual-07"],
    },
    {
      id: "dobutamina-infusao-rht-adulto", farmaco: "Dobutamina", indicacao: "Baixo débito — inotrópico",
      populacao: "adulto", via: INFUSAO,
      dose: { usual: 25, unidade: "mg", por: "h" }, apresentacoes: [DOBUTAMINA_5],
      velocidade: `${INICIO_70_KG} 5 mL/h = cerca de 6 mcg/kg/min em 70 kg.`,
      par: "dobutamina-infusao-rht-ped", referencias: ["manual-07"],
    },
    {
      id: "adrenalina-infusao-rht-ped", farmaco: "Adrenalina", indicacao: "Hipotensão — infusão",
      populacao: "pediatrico", via: INFUSAO,
      dose: { min: 0.05, max: 0.5, unidade: "mcg", por: "kg/min" }, apresentacoes: [ADRENALINA_60], altoRisco: true,
      par: "adrenalina-infusao-rht-adulto", referencias: ["manual-07"],
    },
    {
      id: "noradrenalina-infusao-rht-ped", farmaco: "Noradrenalina", indicacao: "Hipotensão — infusão",
      populacao: "pediatrico", via: INFUSAO,
      dose: { min: 0.02, max: 1, unidade: "mcg", por: "kg/min" }, apresentacoes: [NORADRENALINA_80], altoRisco: true,
      par: "noradrenalina-infusao-rht-adulto", referencias: ["manual-07"],
    },
    {
      id: "dobutamina-infusao-rht-ped", farmaco: "Dobutamina", indicacao: "Baixo débito — inotrópico",
      populacao: "pediatrico", via: INFUSAO,
      dose: { min: 2, max: 20, unidade: "mcg", por: "kg/min" }, apresentacoes: [DOBUTAMINA_5],
      par: "dobutamina-infusao-rht-adulto", referencias: ["manual-07"],
    },
  ],
  volumes: [],
  pensarEm: [
    "Anafilaxia: hipotensão, broncoespasmo e urticária nas duas; se houver dúvida, trate as duas.",
    "Contaminação bacteriana da bolsa: febre alta e choque.",
    "Lesão pulmonar aguda relacionada à transfusão (TRALI) e sobrecarga circulatória (TACO): hipóxia e edema pulmonar.",
    "Na transfusão maciça: diluição, hipocalcemia, hipotermia e hipercalemia.",
    "Outras causas de hipotensão sob anestesia: anestésico em excesso, hipovolemia, raqui alta.",
  ],
  depois: [
    "Devolver todas as bolsas, inclusive as vazias, e os equipos ao banco de sangue, com a notificação da reação.",
    "Amostras novas: tipagem, Coombs direto, hemograma, bilirrubina, LDH, haptoglobina, coagulograma, fibrinogênio, potássio e função renal; urina para hemoglobina.",
    "Diurese de hora em hora. Sem resposta ao diurético em 2 a 3 horas, chamar o nefrologista: pode ser necrose tubular.",
    "UTI.",
    "Notificar à hemovigilância e registrar na ficha a bolsa, os horários e as condutas.",
    "Conversar com o paciente e a família.",
  ],
  divergencias: [
    {
      tema: "Dose de furosemida",
      posicoes: [
        { texto: "Duas linhas: 0,5 mg/kg EV e 1 a 3 mg/kg EV, sem dizer quando usar cada uma.", referencia: "manual-07" },
        { texto: "40 a 80 mg IV no adulto (1 a 2 mg/kg na criança), ajustando as doses seguintes pela diurese.", referencia: "msd-transfusao" },
      ],
      escolha: "O protocolo mostra as duas doses do Manual (para 70 kg: 35 mg, ou 70 a 210 mg). O revisor define qual usar e quando.",
    },
    {
      tema: "Vasopressor",
      posicoes: [
        { texto: "Adrenalina, noradrenalina e dobutamina em infusão.", referencia: "manual-07" },
        { texto: "Evitar os vasopressores que reduzem o fluxo renal (adrenalina, noradrenalina, dopamina em dose alta); se precisar, dopamina 2 a 5 mcg/kg/min.", referencia: "msd-transfusao" },
      ],
      escolha: "O protocolo segue o Manual: sob anestesia, com choque, a pressão de perfusão vem primeiro. Diferença importante: o revisor decide.",
    },
    {
      tema: "Meta de diurese",
      posicoes: [
        { texto: "0,5 a 1,5 mL/kg/h.", referencia: "manual-07" },
        { texto: "Cerca de 100 mL/h nas primeiras 24 horas.", referencia: "msd-transfusao" },
      ],
      escolha: "O protocolo usa a meta por kg do Manual, que serve também para a criança.",
    },
    {
      tema: "Infusão de adrenalina na criança",
      posicoes: [
        { texto: "“0,05-05 mcg/kg/min” na tabela.", referencia: "manual-07" },
      ],
      escolha: "Lido como 0,05 a 0,5 mcg/kg/min: falta a vírgula do segundo número. O revisor confirma.",
    },
  ],
  referencias: ["manual-07", "msd-transfusao", "manual-05"],
  relacionados: [
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" },
  ],
};
