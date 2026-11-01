/**
 * REVISÃO 4 — EMERGÊNCIAS METABÓLICAS, TOXICIDADE E SEGURANÇA (01/11/2026):
 * toxicidade por anestésico local, hipercalemia, hipertermia maligna, os 10
 * Ts, o resultado da crise e o colega afetado (Manual, abas 20 a 24).
 *
 * Origem: "AVANEST — Revisão 4", texto clínico e operacional enviado pelo
 * responsável médico em 01/11/2026. Fontes principais conferidas por ele:
 * ASRA 2020 (LAST), UK Kidney Association, julho de 2026 (hipercalemia),
 * MHAUS e EMHG 2024 (hipertermia maligna).
 *
 * Estado: CORRIGIDO — AGUARDANDO VALIDAÇÃO MÉDICA. Os seis entram como
 * rascunho (protocolos/rascunhos.ts): quem usa continua com a versão 2,
 * aprovada em 15/10/2026. Nenhuma aprovação aqui.
 *
 * Calculadoras: o lipídio pelo regime do peso (abaixo de 70 kg e a partir de
 * 70 kg), com o volume acumulado contra 12 mL/kg; na criança, pendente de
 * homologação. A hipercalemia sem cálculo pediátrico até a validação. O
 * dantroleno com os frascos de cada formulação, sem misturar preparos.
 */

import type { ApresentacaoDoProtocolo, DoseDoProtocolo, Protocolo, VolumeDoProtocolo } from "../tipos.ts";
import { HIPERCALEMIA, HIPERTERMIA_MALIGNA, TOXICIDADE_AL } from "./diversos.ts";
import { COLEGA_AFETADO, DEPOIS_DA_CRISE, DEZ_TS } from "./apoio.ts";
import { GLICOSE_10, GLICOSE_50 } from "./comum.ts";

const REVISAO = "2026-11-01";

/** Uma dose da versão 2, com as mudanças desta; sem ela, erro. */
function dose(p: Protocolo, id: string, mudancas: Partial<DoseDoProtocolo> = {}): DoseDoProtocolo {
  const d = p.medicamentos.find((m) => m.id === id);
  if (!d) throw new Error(`${p.id}: dose ${id} não existe`);
  return { ...d, ...mudancas };
}

// ---------------------------------------------------------------------------
// 20 — Toxicidade sistêmica por anestésico local (LAST)
// ---------------------------------------------------------------------------
const LIPIDIO = "Emulsão lipídica 20%";
const ABAIXO_70 = { abaixoDe: 70 };
const A_PARTIR_70 = { aPartirDe: 70 };
const lipidio = (v: Omit<VolumeDoProtocolo, "grupo" | "populacao" | "referencias">): VolumeDoProtocolo => ({
  grupo: LIPIDIO, populacao: "adulto", referencias: ["asra-2020-last"], ...v,
});

export const TOXICIDADE_AL_V3: Protocolo = {
  ...TOXICIDADE_AL,
  titulo: "Toxicidade sistêmica por anestésico local (LAST)",
  categoria: "outras",
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  sinonimos: [...new Set([...TOXICIDADE_AL.sinonimos, "toxicidade sistêmica por anestésicos locais", "intoxicação por bupivacaína"])],
  ferramenta: "lipidio-acumulado",
  resumo: "Parar o anestésico local, pedir o kit, oxigenar, benzodiazepínico na convulsão e emulsão lipídica 20% cedo na LAST grave; adrenalina reduzida (até 1 mcg/kg); ECMO se refratária.",
  reconhecer: [
    "Suspeitar de toxicidade sistêmica após administração de anestésico local, inclusive durante bloqueios periféricos, anestesia neuraxial ou infiltração cirúrgica.",
    "A apresentação pode ser imediata ou tardia, com sintomas neurológicos, cardiovasculares ou ambos.",
    "Manifestações neurológicas possíveis: parestesia perioral ou lingual, gosto metálico, zumbido, agitação ou alteração do comportamento, tremores, convulsões e rebaixamento de consciência.",
    "Manifestações cardiovasculares possíveis: hipotensão, alterações de condução, QRS alargado, bradicardia, arritmias ventriculares, choque e parada cardíaca.",
    "Na anestesia geral, as manifestações neurológicas podem não ser percebidas. LAST cardiovascular isolada é possível.",
  ],
  agirAgora: [
    { texto: "Interrompa imediatamente o anestésico local.",
      detalhe: "Suspenda injeções, infiltrações e infusões contínuas, incluindo bombas de cateteres periféricos e epidurais. Não administre doses adicionais de anestésicos locais." },
    { texto: "Solicite ajuda e o kit de resgate LAST.",
      detalhe: "Anuncie a suspeita de LAST, solicite emulsão lipídica IV a 20% e distribua tarefas. Em instabilidade grave ou refratária, considere precocemente a equipe de circulação extracorpórea/ECMO quando disponível." },
    { texto: "Avalie pulso, ritmo cardíaco e circulação.",
      detalhe: "Monitorize ECG, pressão arterial, SpO2 e EtCO2. Se houver PCR, inicie RCP imediatamente. A ressuscitação na LAST exige adaptações em relação ao ACLS habitual.",
      abre: { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" } },
    { texto: "Garanta oxigenação e ventilação adequadas.",
      detalhe: "Administre O2 a 100% no paciente criticamente instável. Ventile e proteja a via aérea conforme a necessidade. Evite hipóxia, hipercapnia e acidemia, que podem agravar a cardiotoxicidade." },
    { texto: "Trate as convulsões prontamente.",
      detalhe: "Benzodiazepínicos são preferíveis. Evite grandes doses de propofol, especialmente em instabilidade cardiovascular.",
      abre: { protocolo: "convulsao-perioperatoria", texto: "Convulsão perioperatória" } },
    { texto: "Administre emulsão lipídica IV a 20% precocemente na LAST grave.",
      detalhe: "Utilize o regime de bolus e infusão conforme o peso e as recomendações ASRA. A terapia lipídica não substitui o suporte ventilatório nem a RCP." },
    { texto: "Trate a instabilidade cardiovascular com as modificações específicas da LAST.",
      detalhe: "Se adrenalina for necessária, utilize doses iniciais reduzidas, conforme a ASRA. Evite vasopressina, betabloqueadores, bloqueadores dos canais de cálcio e novos anestésicos locais. Na arritmia ventricular apropriada, considere amiodarona em vez de lidocaína." },
    { texto: "Continue o suporte até a estabilização.",
      detalhe: "Repita o bolus lipídico ou aumente a infusão conforme a resposta e o limite acumulado. Na PCR refratária, considere suporte circulatório extracorpóreo. Monitore o risco de recorrência pela redistribuição do anestésico." },
  ],
  alertas: [
    "Adrenalina na LAST: dose inicial de até 1 mcg/kg, titulada. Não programar o bolus de 1 mg da PCR comum como primeira dose.",
    "Evitar vasopressina, betabloqueadores, bloqueadores dos canais de cálcio e novos anestésicos locais.",
    "Dose acumulada de emulsão lipídica em mL/kg, nunca em mg/kg.",
    "Criança: calculadora da emulsão lipídica pendente de homologação (ASRA 12 mL/kg × Tratado SAESP 10 mL/kg). Não alternar limites entre fontes.",
  ],
  medicamentos: [
    dose(TOXICIDADE_AL, "adrenalina-last", {
      indicacao: "Instabilidade cardiovascular — dose inicial reduzida, titulada",
      cuidados: ["Iniciar com dose de até 1 mcg/kg quando indicada; titular conforme a resposta e o contexto da ressuscitação.",
        "Não programar automaticamente o bolus de 1 mg da PCR comum como primeira dose."],
    }),
    dose(TOXICIDADE_AL, "midazolam-last", {
      indicacao: "Convulsão — benzodiazepínico preferível, titulado",
      cuidados: ["Titular conforme protocolo institucional, peso, idade, ventilação e hemodinâmica.",
        "Não usar propofol como substituto da emulsão lipídica; evitar grandes doses de propofol."],
    }),
  ],
  volumes: [
    lipidio({ id: "lipidio-bolus", rotulo: "Bolus — abaixo de 70 kg", indicacao: "Em 2 a 3 minutos", porKg: { min: 1.5 }, faixaDePeso: ABAIXO_70,
      repeticao: "Instabilidade persistente: considerar repetir o bolus." }),
    lipidio({ id: "lipidio-infusao-min", rotulo: "Infusão — abaixo de 70 kg", indicacao: "0,25 mL/kg/min", unidade: "mL/min", porKg: { min: 0.25 },
      faixaDePeso: ABAIXO_70 }),
    lipidio({ id: "lipidio-infusao", rotulo: "Infusão — abaixo de 70 kg, na bomba", indicacao: "15 mL/kg/h, o mesmo 0,25 mL/kg/min", unidade: "mL/h",
      porKg: { min: 15 }, faixaDePeso: ABAIXO_70,
      repeticao: "Manter por mais de 15 minutos depois da estabilidade, respeitando o limite acumulado." }),
    lipidio({ id: "lipidio-infusao-dobrada", rotulo: "Infusão dobrada — instabilidade persistente", indicacao: "0,5 mL/kg/min = 30 mL/kg/h", unidade: "mL/h",
      porKg: { min: 30 }, faixaDePeso: ABAIXO_70 }),
    lipidio({ id: "lipidio-bolus-70", rotulo: "Bolus — 70 kg ou mais", indicacao: "Cerca de 100 mL em 2 a 3 minutos (esquema simplificado ASRA)",
      fixo: { min: 100 }, faixaDePeso: A_PARTIR_70, repeticao: "Instabilidade persistente: considerar novo bolus." }),
    lipidio({ id: "lipidio-infusao-70", rotulo: "Infusão — 70 kg ou mais", indicacao: "Cerca de 250 mL em 15 a 20 minutos (750 a 1.000 mL/h)",
      fixo: { min: 250 }, faixaDePeso: A_PARTIR_70, repeticao: "Instabilidade persistente: aumentar a infusão, controlando o total administrado." }),
    lipidio({ id: "lipidio-teto", rotulo: "Limite acumulado adotado (ASRA)", indicacao: "12 mL/kg, somando bolus e infusões — em mL/kg, nunca em mg/kg",
      porKg: { min: 12 } }),
  ],
  notasDeDose: [
    "Emulsão lipídica: adulto pelo regime ASRA do peso — abaixo de 70 kg, por kg; a partir de 70 kg, o esquema simplificado. Limite acumulado adotado: 12 mL/kg (ASRA).",
    "Criança: calculadora da emulsão pendente de homologação — o Tratado SAESP usa 10 mL/kg num regime e a ASRA, 12 mL/kg. Sem cálculo automático até uma política institucional única.",
    "Não apresentar tabela de doses máximas de anestésicos locais como garantia de segurança: a toxicidade depende da dose acumulada, concentração, local de administração, absorção sistêmica, vascularização, idade e comorbidades.",
    "A tabela de doses máximas do Manual traz uma linha duplicada para a ropivacaína, com valores divergentes: não usar sem reconstrução e validação farmacológica.",
  ],
  pensarEm: [
    "Bloqueio neuraxial alto, anafilaxia, reação vasovagal, hipoglicemia, arritmia primária, toxicidade medicamentosa e eclâmpsia.",
  ],
  depois: [
    "Observar após a estabilização, conforme a gravidade: pelo menos 2 horas após convulsão isolada (checklist ASRA); cerca de 4 a 6 horas após instabilidade cardiovascular; observação prolongada e cuidados críticos após PCR.",
    "Registrar anestésico administrado, concentração, dose acumulada, horário, local de injeção, manifestações, emulsão lipídica e resposta.",
  ],
  divergencias: [
    {
      tema: "Limite acumulado da emulsão lipídica",
      posicoes: [
        { texto: "“Dose cumulativa máxima 8–12 mg/kg” (erro de unidade: o regime é em mL/kg).", referencia: "manual-20" },
        { texto: "12 mL/kg.", referencia: "asra-2020-last" },
        { texto: "Num regime pediátrico, 10 mL/kg.", referencia: "saesp-tratado" },
      ],
      escolha: "Adulto: 12 mL/kg (ASRA), sempre em mL/kg. Criança: calculadora pendente de homologação até uma política institucional única; não alternar limites entre fontes.",
    },
  ],
  referencias: ["asra-2020-last", "saesp-tratado", "manual-20", "qrh-3-10"],
  relacionados: [
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "convulsao-perioperatoria", texto: "Convulsão perioperatória" },
    { protocolo: "sav-pediatrico", texto: "Suporte avançado de vida pediátrico" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto ou total" },
  ],
};

// ---------------------------------------------------------------------------
// 21 — Hipercalemia
// ---------------------------------------------------------------------------
/** Glicose 20%, para os 25 g em 125 mL (UKKA). */
const GLICOSE_20: ApresentacaoDoProtocolo = { rotulo: "Glicose 20% — 0,2 g/mL", quantidade: 0.2, unidade: "g", mL: 1, vias: ["IV"] };
const CALCIO_NAO_REDUZ = "Estabiliza a membrana cardíaca, mas não elimina o potássio nem reduz diretamente sua concentração sérica.";
const EQUIVALENCIA = "Cloreto 10% 10 mL e gluconato 10% 30 mL fornecem quantidade aproximada equivalente de cálcio elementar: não converter mL de uma formulação para a outra.";

export const HIPERCALEMIA_V3: Protocolo = {
  ...HIPERCALEMIA,
  categoria: "outras",
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  ferramenta: "agenda-hipercalemia",
  resumo: "ECG alterado ou instabilidade: cálcio para proteger o miocárdio, insulina com glicose para deslocar o potássio, remoção e nefrologia cedo. Glicemia de 0 a 360 minutos. Criança: ramo separado, sem cálculo automático.",
  reconhecer: [
    "Elevação da concentração sérica de potássio, especialmente quando associada a alterações eletrocardiográficas ou instabilidade circulatória.",
    "Classificação do adulto: leve, 5,5–5,9 mmol/L; moderada, 6,0–6,4 mmol/L; grave, ≥6,5 mmol/L.",
    "Considerar a gravidade também pela velocidade de elevação do potássio e pelas manifestações clínicas.",
    "Alterações possíveis no ECG: ondas T apiculadas, achatamento ou desaparecimento das ondas P, alargamento do QRS, bradicardia, arritmias e padrão sinusoidal.",
    "ECG normal não exclui hipercalemia potencialmente grave.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda e estabeleça monitorização contínua.",
      detalhe: "Monitorize ECG, pressão arterial e oxigenação. Garanta acesso venoso adequado." },
    { texto: "Confirme a suspeita laboratorial sem atrasar o tratamento crítico.",
      detalhe: "Investigue possível hemólise da amostra, erro de coleta ou pseudo-hipercalemia. Em instabilidade ou alterações eletrocardiográficas compatíveis, inicie o tratamento sem aguardar nova coleta." },
    { texto: "Interrompa as fontes evitáveis de potássio.",
      detalhe: "Revise soluções, suplementos, medicamentos e causas precipitantes. Não interrompa automaticamente transfusão salvadora apenas pela presença de potássio em hemocomponentes." },
    { texto: "Avalie a gravidade e o ECG.",
      detalhe: "Identifique alterações que indiquem risco arrítmico imediato." },
    { texto: "Proteja o miocárdio quando indicado.",
      detalhe: "Administre cálcio IV conforme o contexto, a formulação e o protocolo. O cálcio estabiliza a membrana cardíaca, mas não elimina potássio do organismo nem reduz diretamente sua concentração sérica." },
    { texto: "Inicie as medidas de deslocamento intracelular do potássio.",
      detalhe: "Administre insulina regular IV associada à glicose, conforme a glicemia e o protocolo. Considere salbutamol nebulizado como tratamento adjuvante." },
    { texto: "Considere bicarbonato apenas em situações apropriadas.",
      detalhe: "Não utilizar bicarbonato de sódio rotineiramente em todo paciente hipercalêmico. Avaliar acidose metabólica significativa e as circunstâncias de PCR por hipercalemia, conforme o protocolo.",
      abre: { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" } },
    { texto: "Inicie a estratégia de remoção do potássio.",
      detalhe: "Avalie diurese, função renal e possibilidade de remoção renal ou gastrointestinal. Considere quelantes apropriados, quando indicados, sem atrasar as medidas emergenciais. Solicite avaliação nefrológica precoce na hipercalemia grave, refratária ou associada à falência renal." },
    { texto: "Reavalie potássio e glicemia seriados.",
      detalhe: "Monitore a recorrência da hipercalemia e a hipoglicemia após a insulina." },
    { texto: "Trate a causa e organize a terapia definitiva.",
      detalhe: "Considere hemodiálise urgente diante de hipercalemia refratária, especialmente em pacientes dialíticos ou com insuficiência renal grave." },
  ],
  alertas: [
    "Nunca administrar cálcio e bicarbonato misturados na mesma solução.",
    "Insulina IV é medicamento de alto risco: conferir a dose em unidades, nunca em mL sem concentração validada.",
    "Bicarbonato não é terapia universal de hipercalemia.",
    "A pequena quantidade de potássio em soluções balanceadas não é contraindicação absoluta em todos os casos.",
    "Diuréticos só com indicação e condições de resposta; não substituem o tratamento emergencial.",
  ],
  quadros: [
    {
      titulo: "Monitorização obrigatória (adulto)",
      itens: [
        "Glicemia após a insulina: 0, 30, 60, 90, 120, 180, 240, 300 e 360 minutos.",
        "Potássio após tratamento de hipercalemia moderada ou grave: pelo menos em 1, 2, 4, 6 e 24 horas, antecipando as coletas se houver instabilidade.",
      ],
    },
    {
      titulo: "Criança — ramo separado, sem cálculo automático",
      itens: [
        "Não extrapolar doses adultas de cálcio, insulina, glicose ou salbutamol para crianças.",
        "A calculadora pediátrica exige peso, idade, indicação e apresentação farmacêutica.",
        "Validar antes, com fonte pediátrica específica: dose do cálcio e limite máximo; via e concentração da glicose; insulina em UI/kg; diluição segura da insulina; monitorização da glicemia; esquema de salbutamol.",
        "Enquanto essa validação não estiver concluída, sem cálculo pediátrico automático: tratar com o especialista e o protocolo pediátrico do serviço.",
      ],
    },
  ],
  medicamentos: [
    dose(HIPERCALEMIA, "cloreto-de-calcio-hipercalemia", {
      indicacao: "Preferencialmente em ressuscitação ou peri-PCR", par: undefined,
      velocidade: "Em aproximadamente 5 minutos.", repeticao: "Reavaliar o ECG e considerar repetir conforme a resposta e o protocolo.",
      cuidados: ["Preferir acesso central ou acesso seguro: irritação tecidual.", CALCIO_NAO_REDUZ, EQUIVALENCIA, "Nunca misturar cálcio e bicarbonato na mesma solução."],
      referencias: ["ukka-2026-hipercalemia", "manual-21"],
    }),
    dose(HIPERCALEMIA, "gluconato-hipercalemia", {
      indicacao: "Fora da parada ou periparada, com alterações de ECG — preferido pela UKKA", par: undefined,
      velocidade: "Em aproximadamente 10 minutos.", repeticao: "Reavaliar o ECG e considerar repetir conforme a resposta e o protocolo.",
      cuidados: [CALCIO_NAO_REDUZ, EQUIVALENCIA, "Nunca misturar cálcio e bicarbonato na mesma solução."],
      referencias: ["ukka-2026-hipercalemia", "mhra-2023-gluconato"],
    }),
    dose(HIPERCALEMIA, "insulina-hipercalemia", {
      indicacao: "Com 25 g de glicose", par: undefined,
      cuidados: [
        "Medicamento de alto risco: dose em unidades; volume só com a concentração validada (a 1 UI/mL, 10 UI = 10 mL).",
        "Dupla checagem do preparo.",
        "Glicemia em 0, 30, 60, 90, 120, 180, 240, 300 e 360 minutos.",
      ],
      referencias: ["ukka-2026-hipercalemia", "manual-21"],
    }),
    dose(HIPERCALEMIA, "glicose-hipercalemia", {
      indicacao: "Junto com a insulina — 25 g", par: undefined,
      apresentacoes: [GLICOSE_50, GLICOSE_20, GLICOSE_10],
      cuidados: ["Escolher a concentração pela via, pela segurança e pela disponibilidade: 50 mL a 50%, 125 mL a 20% ou 250 mL a 10%."],
      referencias: ["ukka-2026-hipercalemia", "manual-21"],
    }),
    {
      id: "glicose-prevencao-hipoglicemia", farmaco: "Glicose 10%", indicacao: "Prevenção de hipoglicemia — glicemia antes do tratamento abaixo de 7 mmol/L (126 mg/dL)",
      populacao: "adulto", via: "IV",
      dose: { usual: 5, unidade: "g", por: "h" }, apresentacoes: [GLICOSE_10],
      repeticao: "Por 5 horas após o regime inicial de insulina e glicose.",
      cuidados: ["Monitorar a glicemia, qualquer que seja a concentração escolhida."],
      referencias: ["ukka-2026-hipercalemia"],
    },
    dose(HIPERCALEMIA, "salbutamol-hipercalemia", {
      indicacao: "Adjuvante ao regime principal — nunca como único tratamento da hipercalemia grave",
      referencias: ["ukka-2026-hipercalemia"],
    }),
  ],
  notasDeDose: [
    "Cloreto 10% 10 mL (cerca de 6,8 mmol de cálcio) e gluconato 10% 30 mL (cerca de 6,7 mmol) são equivalentes em cálcio elementar; não converter mL de uma formulação para a outra.",
    "Bicarbonato de sódio: só na acidose metabólica significativa ou na PCR por hipercalemia, conforme o protocolo; não é rotina.",
    "Remoção do potássio: considerar ciclosilicato de zircônio sódico e outras medidas de eliminação, conforme a função gastrointestinal e o contexto clínico.",
    "O deslocamento intracelular tem efeito temporário: a hemodiálise pode ser necessária para a remoção definitiva do excesso de potássio.",
    "Criança: sem cálculo automático até a validação pediátrica — ver o quadro do ramo pediátrico no Agir agora.",
  ],
  pensarEm: [
    "Insuficiência renal, acidose, rabdomiólise, hipertermia maligna, succinilcolina em pacientes suscetíveis, reperfusão tecidual, transfusão maciça, medicamentos e hemólise.",
  ],
  depois: [
    "Acompanhar ECG, potássio, glicose, função renal e risco de recorrência.",
    "Registrar causa, medicamentos administrados, doses, exames, resposta e necessidade de diálise.",
  ],
  divergencias: [
    {
      tema: "Gluconato de cálcio no adulto",
      posicoes: [
        { texto: "15 a 30 mL a 10%.", referencia: "manual-21" },
        { texto: "30 mL a 10% na hipercalemia grave: doses menores ficam abaixo do necessário.", referencia: "mhra-2023-gluconato" },
        { texto: "30 mL a 10% em cerca de 10 minutos.", referencia: "ukka-2026-hipercalemia" },
      ],
      escolha: "O protocolo usa 30 mL (3 g) em cerca de 10 minutos (UKKA 2026).",
    },
    {
      tema: "Doses pediátricas",
      posicoes: [{ texto: "Cloreto de cálcio 20 mg/kg, gluconato 100 mg/kg, insulina 0,1 UI/kg e glicose 0,5 g/kg (cálculo da versão 2).", referencia: "manual-21" }],
      escolha: "Sem cálculo pediátrico automático até a validação com fonte pediátrica específica, como pede o texto de 01/11/2026.",
    },
  ],
  referencias: ["ukka-2026-hipercalemia", "rcuk-2025-circunstancias", "manual-21", "mhra-2023-gluconato"],
  relacionados: [
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "hipertermia-maligna", texto: "Hipertermia maligna" },
  ],
};

// ---------------------------------------------------------------------------
// 22 — Hipertermia maligna
// ---------------------------------------------------------------------------
/** Dantroleno 20 mg: 60 mL de água estéril por frasco, cerca de 0,333 mg/mL. */
const DANTROLENO_20MG: ApresentacaoDoProtocolo = {
  rotulo: "Dantroleno — frasco de 20 mg + 60 mL de água estéril sem conservante — 0,333 mg/mL",
  quantidade: 20, unidade: "mg", mL: 60, vias: ["IV"],
  preparo: "60 mL de água estéril para injeção, sem conservante, em cada frasco de 20 mg, conforme a bula; agitar até clarear",
  frasco: { quantidade: 20, unidade: "mg", diluenteMl: 60, volumeFinalMl: 60 },
};
/** Ryanodex 250 mg: 5 mL de água estéril por frasco, 50 mg/mL. */
const DANTROLENO_250MG: ApresentacaoDoProtocolo = {
  rotulo: "Ryanodex — frasco de 250 mg + 5 mL de água estéril — 50 mg/mL (conferir disponibilidade e registro)",
  quantidade: 250, unidade: "mg", mL: 5, vias: ["IV"],
  preparo: "5 mL de água estéril em cada frasco de 250 mg, conforme a bula: 50 mg/mL",
  frasco: { quantidade: 250, unidade: "mg", diluenteMl: 5, volumeFinalMl: 5 },
};
const NAO_MISTURAR = "Cada formulação com o próprio preparo: os 60 mL são do frasco de 20 mg; os 5 mL, do frasco de 250 mg. Nunca trocar.";

export const HIPERTERMIA_MALIGNA_V3: Protocolo = {
  ...HIPERTERMIA_MALIGNA,
  categoria: "outras",
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "Ajuda e dantroleno já: suspender halogenados e succinilcolina, 2,5 mg/kg IV repetido até a resposta, hiperventilar com O2 a 100% e resfriar acima de 39 °C. Não esperar a febre.",
  reconhecer: [
    "Síndrome hipermetabólica grave desencadeada por agentes anestésicos voláteis halogenados ou succinilcolina em pacientes suscetíveis.",
    "Sinais precoces: elevação inexplicável do EtCO2, taquicardia, rigidez muscular, espasmo de masseter, aumento do consumo de oxigênio e acidose respiratória.",
    "Manifestações progressivas: acidose metabólica, elevação rápida da temperatura, hipercalemia e instabilidade cardiovascular.",
    "Manifestações tardias: rabdomiólise, elevação importante de CK, mioglobinúria, coagulopatia, arritmias graves e PCR.",
    "Não esperar hipertermia evidente para iniciar o tratamento.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda e ative o protocolo institucional de HM.",
      detalhe: "Peça o carrinho de hipertermia maligna e dantroleno imediatamente. Distribua funções, especialmente preparo do medicamento, ventilação, monitorização e comunicação com a cirurgia." },
    { texto: "Suspenda imediatamente os desencadeantes.",
      detalhe: "Interrompa anestésicos voláteis halogenados e succinilcolina. Desative ou remova o vaporizador. Avise a cirurgia e solicite a interrupção ou o término do procedimento quando possível." },
    { texto: "Mantenha a anestesia com agentes não desencadeantes.",
      detalhe: "Utilize anestesia venosa total quando for necessário continuar a anestesia. Empregue relaxantes não despolarizantes quando indicados." },
    { texto: "Administre dantroleno IV imediatamente.",
      detalhe: "Dose inicial de referência: 2,5 mg/kg IV. Repita conforme a resposta clínica e a persistência do hipermetabolismo. Não aguarde obrigatoriamente 10 a 15 minutos entre doses se a crise continuar ativa." },
    { texto: "Hiperventile com oxigênio a 100%.",
      detalhe: "Utilize alto fluxo de gases frescos, em geral pelo menos 10 L/min, e aumente a ventilação minuto conforme a necessidade para reduzir a hipercapnia." },
    { texto: "Reduza a exposição residual a anestésicos voláteis.",
      detalhe: "Se disponíveis, utilize filtros de carvão ativado nos ramos inspiratório e expiratório. Não atrase o dantroleno para trocar toda a máquina de anestesia." },
    { texto: "Organize a monitorização invasiva conforme a gravidade.",
      detalhe: "Considere linha arterial, acesso venoso adequado, cateter urinário e monitorização de temperatura central." },
    { texto: "Inicie o resfriamento quando indicado.",
      detalhe: "Se a temperatura central estiver acima de 39 °C, ou subindo rapidamente, inicie resfriamento ativo. Interrompa o resfriamento ao atingir temperatura central abaixo de 38 °C, evitando hipotermia (diretriz selecionada: MHAUS)." },
    { texto: "Trate hipercalemia, acidose e arritmias.",
      detalhe: "Utilize o protocolo de hipercalemia quando indicado. Evite bloqueadores dos canais de cálcio em associação com dantroleno. O cálcio administrado para estabilização miocárdica na hipercalemia não deve ser confundido com bloqueadores farmacológicos de canais de cálcio.",
      abre: { protocolo: "hipercalemia", texto: "Hipercalemia" } },
    { texto: "Monitore as complicações metabólicas e musculares.",
      detalhe: "Solicite gasometria, potássio, cálcio, CK, glicemia, função renal, coagulação e exames pertinentes. Avalie mioglobinúria e risco de lesão renal." },
    { texto: "Mantenha a perfusão renal e o controle de volume.",
      detalhe: "Monitorize o débito urinário e trate a rabdomiólise quando presente. Não realizar expansão volêmica ou diurese forçada indiscriminadamente." },
    { texto: "Organize UTI e o tratamento pós-crise.",
      detalhe: "Após a estabilização, continue o dantroleno quando indicado e monitore a recorrência da crise por pelo menos 24 horas." },
  ],
  alertas: [
    "Dantroleno imediatamente: 2,5 mg/kg IV, repetido conforme a resposta, sem esperar obrigatoriamente 10 a 15 minutos.",
    NAO_MISTURAR,
    "Evitar bloqueadores dos canais de cálcio com dantroleno; o cálcio da hipercalemia não é bloqueador de canal de cálcio.",
  ],
  medicamentos: [
    dose(HIPERTERMIA_MALIGNA, "dantroleno-inicial", {
      indicacao: "Dose inicial — peso real", apresentacoes: [DANTROLENO_20MG, DANTROLENO_250MG], altoRisco: true,
      repeticao: "Repetir conforme a resposta clínica e a persistência do hipermetabolismo, sem espera obrigatória de 10 a 15 minutos.",
      cuidados: [
        "10 mg/kg não é teto absoluto na HM confirmada: se forem necessárias doses maiores, reavaliar o diagnóstico e buscar apoio especializado.",
        NAO_MISTURAR,
        "Dupla checagem: formulação, número de frascos, diluente e volume final.",
      ],
      referencias: ["mhaus-crise", "emhg-2024-hm", "manual-22"],
    }),
    dose(HIPERTERMIA_MALIGNA, "dantroleno-manutencao", {
      indicacao: "Manutenção após o controle da crise", apresentacoes: [DANTROLENO_20MG, DANTROLENO_250MG], altoRisco: true,
      repeticao: "A cada 4 a 6 horas por pelo menos 24 horas, reavaliando a evolução e o risco de recrudescência.",
      cuidados: [NAO_MISTURAR],
      referencias: ["mhaus-dantroleno", "mhaus-crise"],
    }),
  ],
  notasDeDose: [
    "Frasco de 20 mg com 60 mL de água estéril sem conservante: cerca de 0,333 mg/mL; a dose inicial é de 7,5 mL/kg. A calculadora mostra os frascos e o volume.",
    "Frasco de 250 mg (Ryanodex) com 5 mL de água estéril: 50 mg/mL; a dose inicial é de 0,05 mL/kg.",
    "Conferir no serviço a disponibilidade e o registro de cada apresentação antes de usá-la.",
  ],
  pensarEm: [
    "Reinalação de CO2, ventilação inadequada, falha de absorvedor, insuflação de CO2 em laparoscopia, sepse, tireotoxicose, síndrome neuroléptica maligna e outras causas de hipercapnia ou hipertermia.",
  ],
  depois: [
    "Monitorização intensiva por pelo menos 24 horas, com atenção a recorrência, rabdomiólise, hipercalemia, insuficiência renal e coagulopatia.",
    "Registrar agentes utilizados, cronologia dos sinais, dose acumulada de dantroleno, tratamentos e resposta.",
    "Informar o paciente e os familiares sobre a suspeita de suscetibilidade à HM e a necessidade de investigação especializada.",
    "Registrar alerta de anestésicos desencadeantes para procedimentos futuros.",
  ],
  divergencias: [
    ...HIPERTERMIA_MALIGNA.divergencias,
    {
      tema: "Quando parar o resfriamento",
      posicoes: [
        { texto: "Abaixo de 38 °C.", referencia: "mhaus-crise" },
        { texto: "Abaixo de 38,5 °C.", referencia: "emhg-2024-hm" },
      ],
      escolha: "O cartão segue a MHAUS (38 °C), como a versão 2; a escolha institucional definitiva é do responsável médico. Os dois valores não valem ao mesmo tempo.",
    },
  ],
  referencias: ["mhaus-crise", "emhg-2024-hm", "saesp-hm", "manual-22", "mhaus-dantroleno", "saesp-tratado"],
  relacionados: [
    { protocolo: "hipercalemia", texto: "Hipercalemia" },
    { protocolo: "taquiarritmia", texto: "Taquiarritmia instável" },
    { protocolo: "aumento-etco2", texto: "Aumento do CO2 expirado" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
  ],
};

// ---------------------------------------------------------------------------
// 23A — Crise sem diagnóstico: os 10 Ts
// ---------------------------------------------------------------------------
export const DEZ_TS_V3: Protocolo = {
  ...DEZ_TS,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "Emergência grave sem causa: verificar os dez Ts, um a um, abrindo o protocolo de cada causa provável. A lista não substitui o suporte avançado de vida.",
  reconhecer: [
    "Emergência anestésica grave ou deterioração súbita cuja causa ainda não foi identificada.",
    "Os 10 Ts são uma lista cognitiva de diagnósticos e mecanismos que podem estar envolvidos em situações críticas.",
    "Não substituem os algoritmos de suporte avançado de vida nem são uma extensão oficial dos 5Hs e 5Ts da AHA.",
  ],
  agirAgora: [
    { texto: "Tubos e sistema ventilatório.",
      detalhe: "Verificar tubo traqueal, profundidade, posicionamento, permeabilidade, conexões, circuito, fonte de oxigênio e capnografia.",
      abre: { protocolo: "intubacao-esofagica-seletiva", texto: "Intubação esofágica ou seletiva" } },
    { texto: "Hemorragia torrencial.",
      detalhe: "Investigar perda sanguínea evidente ou oculta, inclusive em campos cirúrgicos não visíveis ao anestesiologista.",
      abre: { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" } },
    { texto: "Triptase — lembrar anafilaxia.",
      detalhe: "Avaliar anafilaxia, principalmente após medicamentos, antibióticos, bloqueadores neuromusculares ou outros desencadeantes. Triptase é exame de apoio diagnóstico, não medida que deve preceder a administração de adrenalina.",
      abre: { protocolo: "anafilaxia", texto: "Anafilaxia" } },
    { texto: "Ritmo terminal ou doença cardíaca primária.",
      detalhe: "Investigar arritmias, isquemia, falência ventricular e alterações hemodinâmicas primárias.",
      abre: { protocolo: "isquemia-miocardica", texto: "Isquemia miocárdica" } },
    { texto: "Tamponamento cardíaco.",
      detalhe: "Considerar tamponamento traumático, cirúrgico ou associado a procedimentos invasivos." },
    { texto: "Pneumotórax hipertensivo.",
      detalhe: "Avaliar aumento de pressão de via aérea, hipoxemia, redução de retorno venoso e choque obstrutivo.",
      abre: { protocolo: "pneumotorax-hipertensivo", texto: "Pneumotórax hipertensivo" } },
    { texto: "Trombo e embolias.",
      detalhe: "Considerar tromboembolismo pulmonar, embolia coronariana, embolia gasosa, embolia gordurosa e embolia por líquido amniótico. São mecanismos distintos e exigem protocolos próprios.",
      abre: { protocolo: "embolia-pulmonar", texto: "Embolia pulmonar" } },
    { texto: "Tóxicos e distúrbios metabólicos.",
      detalhe: "Investigar erro medicamentoso, toxicidade por anestésicos locais, intoxicações, alterações de potássio, glicose, pH e outros distúrbios.",
      abre: { protocolo: "toxicidade-anestesico-local", texto: "Toxicidade por anestésico local" } },
    { texto: "Bloqueio neuraxial total.",
      detalhe: "Considerar bloqueio simpático, motor e respiratório extenso após anestesia neuraxial.",
      abre: { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto ou total" } },
    { texto: "Tumor ou emergência intracraniana.",
      detalhe: "Investigar hipertensão intracraniana, edema cerebral, herniação, sangramento ou outras causas neurológicas graves." },
  ],
  notasDeDose: ["Não se aplica. Este protocolo é uma lista diagnóstica, não uma prescrição medicamentosa."],
  pensarEm: [
    "Revisar também os 5Hs e 5Ts dos algoritmos de PCR: hipóxia, hipovolemia, acidose, distúrbios eletrolíticos, hipotermia, tromboses, toxinas, tamponamento e pneumotórax hipertensivo.",
  ],
  depois: ["Documentar as hipóteses consideradas, os exames, as intervenções e o diagnóstico final, quando estabelecido."],
  referencias: ["manual-23", "aha-2025-als"],
  relacionados: [
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "pneumotorax-hipertensivo", texto: "Pneumotórax hipertensivo" },
    { protocolo: "embolia-pulmonar", texto: "Embolia pulmonar" },
    { protocolo: "embolia-gasosa-venosa", texto: "Embolia gasosa venosa" },
    { protocolo: "toxicidade-anestesico-local", texto: "Toxicidade por anestésico local" },
    { protocolo: "hipercalemia", texto: "Hipercalemia" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto ou total" },
  ],
};

// ---------------------------------------------------------------------------
// 23B — Resultado da crise: cuidados pós-evento
// ---------------------------------------------------------------------------
export const DEPOIS_DA_CRISE_V3: Protocolo = {
  ...DEPOIS_DA_CRISE,
  titulo: "Resultado da crise — cuidados pós-evento",
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  sinonimos: [...new Set(["depois da crise", "cuidados pós-evento", ...DEPOIS_DA_CRISE.sinonimos])],
  resumo: "Depois da crise: continuidade do cuidado, preservação de evidências, comunicação honesta, debriefing, registro, notificação, apoio à equipe e análise de causa.",
  reconhecer: [
    "Término ou estabilização de evento crítico durante a anestesia, com necessidade de continuidade assistencial, documentação, comunicação e avaliação institucional.",
  ],
  agirAgora: [
    { texto: "Acione apoio médico experiente.",
      detalhe: "Solicite avaliação de profissional sênior ou do responsável pelo serviço quando necessário." },
    { texto: "Garanta a continuidade do cuidado.",
      detalhe: "Defina monitorização, UTI, exames, tratamento adicional e transferência segura." },
    { texto: "Se houver óbito, cumpra os procedimentos legais e institucionais aplicáveis.",
      detalhe: "A documentação, a notificação e o encaminhamento do corpo seguem as regras brasileiras e a natureza do óbito. Não indicar encaminhamento automático ao Instituto Médico-Legal em toda morte hospitalar." },
    { texto: "Preserve os medicamentos e os equipamentos relevantes.",
      detalhe: "Quando houver suspeita de erro de administração ou falha técnica, preserve seringas, rótulos, embalagens, dispositivos e registros de equipamentos de maneira rastreável. Respeitar a cadeia de custódia e a política institucional." },
    { texto: "Informe o paciente quando sua condição permitir.",
      detalhe: "Comunique o ocorrido, as consequências conhecidas e o plano de acompanhamento de forma objetiva e respeitosa." },
    { texto: "Organize a comunicação com familiares ou responsáveis autorizados.",
      detalhe: "A comunicação deve ser clara, coordenada e compatível com a confidencialidade e as regras assistenciais. Evite especulações ou afirmações prematuras sobre causalidade." },
    { texto: "Estabeleça um canal de acompanhamento.",
      detalhe: "Defina o profissional ou a equipe responsável pela comunicação posterior." },
    { texto: "Realize debriefing clínico estruturado.",
      detalhe: "Reúna a equipe para identificar necessidades imediatas, dificuldades técnicas, falhas de processo e medidas preventivas. Não obrigue os profissionais a compartilhar experiências emocionais pessoais em grupo." },
    { texto: "Complete os registros assistenciais.",
      detalhe: "Registre cronologia, sinais, intervenções, medicamentos, doses, respostas e decisões." },
    { texto: "Organize o relato complementar quando necessário.",
      detalhe: "O relato profissional segue a estrutura institucional de gestão de riscos, com controle de acesso e confidencialidade. Não criar prontuário paralelo informal." },
    { texto: "Disponibilize apoio à equipe envolvida.",
      detalhe: "Reconheça as possíveis repercussões emocionais e funcionais após a crise.",
      abre: { protocolo: "colega-afetado", texto: "O colega afetado" } },
    { texto: "Realize as notificações exigidas.",
      detalhe: "Utilize os canais institucionais e regulatórios aplicáveis, respeitando a legislação, a segurança do paciente e a proteção de dados." },
    { texto: "Avalie a capacidade de retorno às atividades.",
      detalhe: "Se houver impacto funcional relevante, considere descanso, substituição temporária, avaliação profissional ou reorganização da escala. Não instituir afastamento obrigatório de 24 horas para todo evento sem avaliação individual e política institucional." },
    { texto: "Realize a análise de causa e a melhoria de processos.",
      detalhe: "Identifique fatores humanos, organizacionais, equipamentos, protocolos e oportunidades de prevenção. Defina responsáveis, prazos e acompanhamento das ações propostas." },
  ],
  notasDeDose: ["Não se aplica."],
  pensarEm: [
    "Segurança do paciente, preservação documental, continuidade assistencial, comunicação ética, LGPD, notificação de incidentes e prevenção de recorrências.",
  ],
  depois: ["Acompanhar as medidas corretivas, comunicar os resultados pertinentes e verificar a efetividade das ações."],
  referencias: ["manual-24"],
  relacionados: [
    { protocolo: "colega-afetado", texto: "O colega afetado" },
    { protocolo: "evento-sem-diagnostico", texto: "Crise sem diagnóstico — os 10 Ts" },
  ],
};

// ---------------------------------------------------------------------------
// 24 — O colega afetado
// ---------------------------------------------------------------------------
export const COLEGA_AFETADO_V3: Protocolo = {
  ...COLEGA_AFETADO,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "Risco imediato: substituir e apoiar. Depois, abordagem reservada e respeitosa, com fatos, escuta e encaminhamento; o processo formal fica separado do cuidado ao profissional.",
  reconhecer: [
    "Profissional envolvido em evento crítico ou apresentando sinais de sofrimento emocional, declínio funcional ou dificuldades que possam comprometer seu bem-estar ou a segurança assistencial.",
    "Distinguir sofrimento psicológico, luto, adoecimento, uso problemático de substâncias e possível conduta profissional inadequada.",
    "Essas condições não devem ser tratadas como diagnósticos equivalentes.",
  ],
  agirAgora: [
    { texto: "Planeje uma abordagem de apoio.",
      detalhe: "Solicite ajuda da liderança clínica ou de profissional capacitado quando apropriado. Escolha um ambiente reservado e seguro." },
    { texto: "Reúna informações objetivas.",
      detalhe: "Registre fatos observáveis, evitando conclusões diagnósticas ou julgamentos precipitados." },
    { texto: "Considere as obrigações profissionais e institucionais.",
      detalhe: "Avalie deveres de segurança assistencial, confidencialidade, medicina do trabalho e regulamentações profissionais aplicáveis." },
    { texto: "Avalie os riscos imediatos.",
      detalhe: "Se houver comprometimento atual da capacidade de prestar assistência com segurança, providencie substituição e suporte imediato." },
    { texto: "Faça a abordagem de forma respeitosa.",
      detalhe: "Demonstre preocupação genuína, mantenha tom não acusatório e evite confronto desnecessário." },
    { texto: "Escute antes de responder.",
      detalhe: "Permita que o profissional explique sua percepção e suas necessidades." },
    { texto: "Utilize comunicação objetiva.",
      detalhe: "Fale de fatos concretos e mantenha frases claras. Evite rótulos, humilhação ou especulações." },
    { texto: "Reconheça o desconforto e ofereça ajuda.",
      detalhe: "Explique que o objetivo é oferecer suporte adequado e preservar a segurança das pessoas envolvidas." },
    { texto: "Disponibilize encaminhamento apropriado.",
      detalhe: "Considere apoio psicológico, psiquiátrico, medicina do trabalho ou outros recursos profissionais conforme a necessidade. Não presumir que conversa informal seja suficiente para condições clínicas relevantes." },
    { texto: "Organize o acompanhamento.",
      detalhe: "Defina contato de apoio e medidas de acompanhamento proporcionais à situação. Quando houver investigação disciplinar ou de segurança, mantenha o processo formal distinto do cuidado clínico ao profissional, respeitando os deveres institucionais." },
  ],
  notasDeDose: ["Não se aplica. Este cartão não tem calculadora medicamentosa."],
  pensarEm: [
    "Risco assistencial, sofrimento psicológico após eventos críticos, fadiga, privação de sono, luto, declínio funcional, uso problemático de substâncias e necessidade de suporte especializado.",
  ],
  depois: ["Realizar o acompanhamento com respeito à confidencialidade e verificar as condições seguras de retorno às atividades, quando pertinente."],
  referencias: ["manual-24"],
  relacionados: [{ protocolo: "depois-da-crise", texto: "Resultado da crise — cuidados pós-evento" }],
};

/** Os seis, na ordem do Manual (20 a 24). */
export const METABOLICAS_APOIO_V3: readonly Protocolo[] = [
  TOXICIDADE_AL_V3, HIPERCALEMIA_V3, HIPERTERMIA_MALIGNA_V3, DEZ_TS_V3, DEPOIS_DA_CRISE_V3, COLEGA_AFETADO_V3,
];
