/**
 * RASCUNHOS — as versões novas da prévia. Aprovadas pelo responsável médico em
 * 05/11/2026 (aprovacao.ts): desde então são elas que vão para quem usa.
 *
 * Um rascunho é a versão nova de um protocolo que JÁ ESTÁ no catálogo. Quem usa
 * continua com a versão publicada (aprovada ou não, como estiver); a prévia do
 * responsável médico abre o rascunho no lugar dela, marcado como aguardando
 * validação. Nada aqui tem aprovação: aprovado um rascunho, ele toma o lugar do
 * protocolo no arquivo de origem e sai desta lista, junto com o registro em
 * lib/intercorrencias/aprovacao.ts.
 *
 * Origem: "AVANEST — Correção das pendências científicas" (01/11/2026). Cada
 * item é revisado individualmente; nenhum é aprovado em lote.
 */

import type { Protocolo } from "../tipos.ts";
import { BRADICARDIA, EMBOLIA_GASOSA, EMBOLIA_PULMONAR, HEMORRAGIA, ISQUEMIA, PCR_FV_TV } from "./cardiovascular.ts";
import { ANAFILAXIA } from "./anafilaxia.ts";
import { ECLAMPSIA, EMBOLIA_AMNIOTICA } from "./obstetricia-complementar.ts";
import { SAV_PEDIATRICO } from "./sav-pediatrico.ts";
import { BNM_RESIDUAL, DEPRESSAO_OPIOIDES } from "./opioides-e-bloqueio-residual.ts";
import { CONVULSAO, CRISE_ADRENAL, DELIRIO, HIPOGLICEMIA, HIPOTERMIA } from "./outras-emergencias.ts";
import { RESPIRATORIO_V3 } from "./respiratorio.ts";
import { OBSTETRICIA_NEONATAL_V3 } from "./obstetricia-neonatal.ts";
import { METABOLICAS_APOIO_V3 } from "./metabolicas-apoio.ts";
import { GLUCONATO_DE_CALCIO_10, MAGNESIO_50, MAGNESIO_ATAQUE_MS, MAGNESIO_MANUTENCAO_MS } from "./comum.ts";

const PROPOSTA = "2026-11-01";

/** Troca o passo cujo texto começa com `inicio`; sem ele, erro (o rascunho não pode perder o alvo). */
function trocarPasso(p: Protocolo, inicio: string, novo: Protocolo["agirAgora"][number]): Protocolo["agirAgora"] {
  const i = p.agirAgora.findIndex((x) => x.texto.startsWith(inicio));
  if (i < 0) throw new Error(`${p.id}: passo "${inicio}" não existe`);
  return p.agirAgora.map((x, k) => (k === i ? novo : x));
}

// ---------------------------------------------------------------------------
// Embolia pulmonar aguda — a classificação da diretriz AHA/ACC 2026
// ---------------------------------------------------------------------------
// A versão 1 (aprovada) traz a classificação resumida, de A a E. A diretriz
// subdivide B, C, D e E; a referência e a classificação foram conferidas pelo
// responsável médico nas publicações oficiais. Os modificadores respiratórios
// ficam lembrados no passo: o texto deles não foi transcrito (a página oficial
// recusou o acesso automatizado do AVANEST).
export const EMBOLIA_PULMONAR_V2: Protocolo = {
  ...EMBOLIA_PULMONAR,
  versao: 2,
  atualizadoEm: PROPOSTA,
  revisadoEm: PROPOSTA,
  agirAgora: trocarPasso(
    { ...EMBOLIA_PULMONAR, agirAgora: trocarPasso(EMBOLIA_PULMONAR, "Classifique a gravidade", {
      texto: "Classifique a gravidade conforme a diretriz AHA/ACC 2026.",
      detalhe: "A: embolia pulmonar incidental e assintomática. B1: sintomática, baixa gravidade clínica, subsegmentar. B2: sintomática, baixa gravidade clínica, não subsegmentar. C1: gravidade clínica elevada, ventrículo direito e biomarcadores normais. C2: gravidade elevada, disfunção ventricular direita ou pelo menos um biomarcador anormal. C3: gravidade elevada, disfunção ventricular direita e pelo menos um biomarcador anormal. D1: falência cardiopulmonar incipiente com hipotensão transitória. D2: falência incipiente com choque normotensivo. E1: hipotensão recorrente ou persistente com choque cardiogênico. E2: choque cardiogênico refratário ou parada cardíaca. Registrar também o modificador respiratório previsto pela diretriz.",
    }) },
    "Em embolia com choque ou falência cardiopulmonar",
    {
      texto: "Em embolia com choque ou falência cardiopulmonar, discuta reperfusão urgente.",
      detalhe: "Terapias avançadas são razoáveis em E1 e podem ser consideradas em D1–D2, conforme avaliação especializada; em E2, seguir também as recomendações específicas para PCR. Opções, conforme gravidade e disponibilidade: trombólise sistêmica, trombólise dirigida por cateter, trombectomia mecânica ou embolectomia cirúrgica. Não aplicar trombólise a todos os pacientes automaticamente.",
    },
  ),
};

// ---------------------------------------------------------------------------
// Depressão respiratória por opioides — naloxona começando em 0,04 mg
// ---------------------------------------------------------------------------
// A versão 2 (16/10, aguardando validação) segue a bula: 0,1 a 0,2 mg por dose
// no pós-operatório. A calculadora do serviço começa em 0,04 mg, titulado.
// Proposta: 0,04 mg nos dois lugares, para reverter a depressão sem tirar a
// analgesia de uma vez; a faixa da bula fica escrita nos cuidados.
export const DEPRESSAO_OPIOIDES_V3: Protocolo = {
  ...DEPRESSAO_OPIOIDES,
  versao: 3,
  atualizadoEm: PROPOSTA,
  revisadoEm: PROPOSTA,
  agirAgora: trocarPasso(DEPRESSAO_OPIOIDES, "Naloxona IV em pequenas doses", {
    texto: "Naloxona IV em pequenas doses (0,04 mg) a cada 2 a 3 minutos, até ventilação e alerta adequados sem dor importante.",
    caminho: "A. Pós-operatória",
  }),
  medicamentos: DEPRESSAO_OPIOIDES.medicamentos.map((d) => (d.id === "naloxona-posop-adulto" ? {
    ...d,
    dose: { usual: 0.04, unidade: "mg", por: "fixa" },
    repeticao: "A cada 2 a 3 minutos, até a reversão desejada; nova dose pode ser necessária em 1 a 2 horas.",
    cuidados: [
      "Reversão rápida ou excessiva: dor, náusea, vômito, hipertensão e estresse circulatório.",
      "A bula traz 0,1 a 0,2 mg por dose; o cartão começa com 0,04 mg, a mesma titulação da calculadora do serviço.",
    ],
  } : d)),
  divergencias: DEPRESSAO_OPIOIDES.divergencias.map((x) => (/naloxona/.test(x.tema) ? {
    ...x,
    escolha: "O cartão começa com 0,04 mg, titulado a cada 2 a 3 minutos, como a calculadora do serviço; a bula indica 0,1 a 0,2 mg por dose.",
  } : x)),
};

// ---------------------------------------------------------------------------
// Hipotermia perioperatória — choques abaixo de 30 °C na PCR
// ---------------------------------------------------------------------------
// A versão 2 (16/10, aguardando validação) segue a WMS 2019: um choque e o
// próximo só depois de 30 °C. O ERC 2021 aceita até 3 choques antes de adiar.
// Proposta: as duas posições registradas lado a lado; o passo continua com a
// WMS, que é a fonte já conferida do cartão, até a decisão do responsável.
export const HIPOTERMIA_V3: Protocolo = {
  ...HIPOTERMIA,
  versao: 3,
  atualizadoEm: PROPOSTA,
  revisadoEm: PROPOSTA,
  divergencias: [
    ...HIPOTERMIA.divergencias,
    {
      tema: "Choques abaixo de 30 °C na PCR",
      posicoes: [
        { texto: "Abaixo de 30 °C, um choque; os seguintes só depois de reaquecer acima de 30 °C.", referencia: "wms-2019-hipotermia" },
        { texto: "Abaixo de 30 °C, até 3 choques; persistindo a FV, adiar os seguintes até acima de 30 °C.", referencia: "erc-2021-circunstancias" },
      ],
      escolha: "O cartão segue a WMS 2019, fonte conferida do protocolo; a posição do ERC 2021 fica ao lado para a decisão do responsável médico.",
    },
  ],
  referencias: [...HIPOTERMIA.referencias, "erc-2021-circunstancias"],
};

// ---------------------------------------------------------------------------
// Lidocaína na PCR e no SAV pediátrico — o aviso da LAST
// ---------------------------------------------------------------------------
// A LAST manda evitar lidocaína (é anestésico local) e o botão dela leva à PCR
// — FV/TV, que oferece lidocaína como alternativa. Aprovado o aviso pelo
// responsável médico em 01/11/2026 para entrar como rascunho: o cartão de dose
// da lidocaína ganha o alerta, e o protocolo, o atalho para a LAST.
const AVISO_LIDOCAINA = "Suspeita de toxicidade por anestésico local (LAST): não usar lidocaína; preferir amiodarona.";
function comAvisoLidocaina(p: Protocolo, versao: number): Protocolo {
  if (!p.medicamentos.some((d) => d.farmaco === "Lidocaína")) throw new Error(`${p.id}: sem lidocaína para avisar`);
  const jaLiga = (p.relacionados ?? []).some((r) => r.protocolo === "toxicidade-anestesico-local");
  return {
    ...p,
    versao,
    atualizadoEm: PROPOSTA,
    revisadoEm: PROPOSTA,
    medicamentos: p.medicamentos.map((d) => (d.farmaco === "Lidocaína" ? { ...d, cuidados: [AVISO_LIDOCAINA, ...(d.cuidados ?? [])] } : d)),
    relacionados: [...(p.relacionados ?? []), ...(jaLiga ? [] : [{ protocolo: "toxicidade-anestesico-local", texto: "Toxicidade por anestésico local (LAST)" }])],
  };
}
export const PCR_FV_TV_V4 = comAvisoLidocaina(PCR_FV_TV, 4);
export const SAV_PEDIATRICO_V3 = comAvisoLidocaina(SAV_PEDIATRICO, 3);

// ---------------------------------------------------------------------------
// Acompanhamento na sala; depois, passagem de cuidado
// ---------------------------------------------------------------------------
// Regra do responsável médico (01/11/2026): o anestesiologista acompanha o
// paciente na sala; depois dela, o cuidado é da clínica cirúrgica (na
// gestante, da obstetrícia) ou da UTI. Nos cartões cujo "Depois" passava ao
// anestesiologista um acompanhamento além da sala, o texto vira orientação na
// passagem de cuidado. Só o "Depois" (e um detalhe de etapa) muda; doses e
// etapas ficam como estão.
const PCS = "Na passagem à clínica cirúrgica (ou à UTI), que acompanha o paciente depois da sala: orientar ";

/** Troca itens do "Depois" e detalhes de etapas, exatamente; alvo que não existe é erro. */
function trocarTextos(p: Protocolo, depois: Record<string, string>, detalhes: Record<string, string> = {}): Pick<Protocolo, "depois" | "agirAgora"> {
  for (const k of Object.keys(depois)) if (!p.depois.includes(k)) throw new Error(`${p.id}: o "Depois" não tem "${k}"`);
  for (const k of Object.keys(detalhes)) if (!p.agirAgora.some((x) => x.texto === k)) throw new Error(`${p.id}: não há a etapa "${k}"`);
  return {
    depois: p.depois.map((x) => depois[x] ?? x),
    agirAgora: p.agirAgora.map((x) => (detalhes[x.texto] ? { ...x, detalhe: detalhes[x.texto] } : x)),
  };
}
/** O mesmo rascunho, com a passagem de cuidado no lugar do acompanhamento além da sala. */
const ajustar = (p: Protocolo, depois: Record<string, string>, detalhes?: Record<string, string>): Protocolo => ({ ...p, ...trocarTextos(p, depois, detalhes) });
/** Um rascunho novo de um protocolo publicado, só com a passagem de cuidado. */
const comPassagem = (p: Protocolo, versao: number, depois: Record<string, string>, detalhes?: Record<string, string>): Protocolo => ({
  ...p, versao, atualizadoEm: PROPOSTA, revisadoEm: PROPOSTA, ...trocarTextos(p, depois, detalhes),
});

export const ISQUEMIA_V4 = comPassagem(ISQUEMIA, 4, {
  "ECG seriado, troponina quando indicada, ecocardiografia, avaliação cardiológica e monitorização pós-operatória apropriada.":
    `${PCS}ECG seriado, troponina quando indicada, ecocardiografia, avaliação cardiológica e monitorização pós-operatória apropriada.`,
}, {
  "Planeje acompanhamento pós-operatório intensivo quando necessário.":
    "Solicite ECG e troponina seriados conforme indicação; o acompanhamento depois da sala é da clínica cirúrgica (ou da UTI), com passagem estruturada.",
});
export const HEMORRAGIA_V4 = comPassagem(HEMORRAGIA, 4, {
  "Monitorar função renal, eletrólitos, sangramento residual, temperatura, coagulopatia e possíveis complicações transfusionais.":
    `${PCS}a vigilância de função renal, eletrólitos, sangramento residual, temperatura, coagulopatia e possíveis complicações transfusionais.`,
});
export const ANAFILAXIA_V3 = comPassagem(ANAFILAXIA, 3, {
  "Colher a triptase sem atrasar o suporte; registrar os tempos e obter a basal depois da recuperação.":
    "Colher a triptase sem atrasar o suporte e registrar os tempos; a dosagem basal, depois da recuperação, vai como orientação na passagem de cuidado.",
  "Alergologia, documentação e observação conforme a gravidade.":
    `${PCS}a observação conforme a gravidade e o encaminhamento à alergologia; documentar o evento.`,
});
export const EMBOLIA_GASOSA_V4 = comPassagem(EMBOLIA_GASOSA, 4, {
  "Monitorização intensiva, avaliação neurológica, acompanhamento cardiorrespiratório e investigação da fonte de entrada de gás.":
    "Na passagem à UTI (ou à clínica cirúrgica), que acompanha o paciente depois da sala: orientar monitorização intensiva, avaliação neurológica, acompanhamento cardiorrespiratório e investigação da fonte de entrada de gás.",
});
export const BRADICARDIA_V4 = comPassagem(BRADICARDIA, 4, {
  "Monitorização ECG, avaliação cardiológica, eletrólitos, investigação da causa e necessidade de estimulação definitiva.":
    `${PCS}a monitorização do ECG, a avaliação cardiológica, os eletrólitos e a investigação da causa e da necessidade de estimulação definitiva.`,
});
export const HIPOGLICEMIA_V3 = comPassagem(HIPOGLICEMIA, 3, {
  "Glicemia seriada por 24 a 48 horas nos de risco; infusão de glicose enquanto em jejum.":
    `${PCS}glicemia seriada por 24 a 48 horas nos de risco e infusão de glicose enquanto em jejum.`,
  "Sulfonilureia ou insulina de ação longa: observação prolongada.":
    "Sulfonilureia ou insulina de ação longa: orientar observação prolongada na passagem de cuidado.",
});
export const CRISE_ADRENAL_V3 = comPassagem(CRISE_ADRENAL, 3, {
  "Vigiar glicemia, sódio, potássio, pressão e perfusão; UTI se instável.":
    "Na passagem à clínica cirúrgica (ou à UTI, se instável), que acompanha o paciente depois da sala: orientar a vigilância de glicemia, sódio, potássio, pressão e perfusão.",
});
export const CONVULSAO_V3 = comPassagem(CONVULSAO, 3, {
  "EEG se não recupera a consciência (crise não convulsiva) ou se recebeu bloqueador neuromuscular.":
    "Na passagem de cuidado: orientar EEG se não recupera a consciência (crise não convulsiva) ou se recebeu bloqueador neuromuscular.",
  "Causa: eletrólitos, glicemia, gasometria; neuroimagem conforme o quadro; UTI no estado de mal.":
    "Causa: eletrólitos, glicemia e gasometria na sala; neuroimagem conforme o quadro e UTI no estado de mal, pela passagem de cuidado.",
});
export const DELIRIO_V3 = comPassagem(DELIRIO, 3, {
  "Reavaliar cognição e déficits neurológicos; rastrear delirium nos dias seguintes no adulto de risco.":
    "Reavaliar na sala a cognição e os déficits neurológicos; na passagem, orientar o rastreio de delirium nos dias seguintes no adulto de risco.",
  "Observação prolongada ou UTI conforme a causa; registrar o episódio e o que foi dado.":
    "Orientar na passagem a observação prolongada ou a UTI conforme a causa; registrar o episódio e o que foi dado.",
});
export const ECLAMPSIA_V3 = comPassagem(ECLAMPSIA, 3, {
  "Manter o magnésio por 24 horas depois do parto ou da última convulsão; UTI ou unidade de cuidado materno.":
    "Na passagem à obstetrícia (UTI ou unidade de cuidado materno), que acompanha a paciente depois da sala: manter o magnésio por 24 horas depois do parto ou da última convulsão.",
  "Vigiar reflexos, frequência respiratória, consciência, diurese e função renal; magnésio sérico se oligúria.":
    "Orientar na passagem a vigilância de reflexos, frequência respiratória, consciência, diurese e função renal; magnésio sérico se oligúria.",
});
/**
 * ECLÂMPSIA, VERSÃO 4 (05/11/2026): o magnésio pelas fontes brasileiras.
 *
 * O responsável médico pediu a conferência pelo Ministério da Saúde e pela
 * FEBRASGO. Lidos no texto: o Manual de Gestação de Alto Risco (MS 2022,
 * quadros 7 e 8) e o Protocolo 2023 da RBEHG (Peraçoli et al., o mesmo grupo do
 * protocolo da FEBRASGO). Escolhas do responsável na mesma conversa: o preparo
 * da manutenção do MS (5 g em 250 mL) e a frequência respiratória mínima da
 * RBEHG (≥16 irpm).
 *
 * O que muda da versão 3: sai o preparo de 12 g em 124 mL (não está em nenhuma
 * das duas) e o de 8 g em 100 mL do Manual de Crises; entram os preparos do MS;
 * a nova convulsão passa a 2 g (as duas fontes) com manutenção a 2 g/h; os
 * limites de vigilância e a meia dose no rim entram com número; sai o
 * labetalol (não disponível no Brasil, MS 2022); entra o esquema de Pritchard
 * para sala sem bomba e transporte. A passagem de cuidado da versão 3 fica.
 */
export const ECLAMPSIA_V4: Protocolo = {
  ...ECLAMPSIA_V3,
  versao: 4,
  atualizadoEm: "2026-11-05",
  revisadoEm: "2026-11-05",
  resumo: "Convulsão em gestante ou puérpera com doença hipertensiva: proteger e oxigenar; sulfato de magnésio 4 g IV lento e 1 g/h por 24 horas; tratar a hipertensão grave; parto depois de estabilizar.",
  agirAgora: [
    { texto: "Chamar anestesia, obstetrícia e UTI; proteger e posicionar em decúbito lateral, de preferência esquerdo." },
    { texto: "Via aérea, O2 e ventilação; monitorizar mãe e feto." },
    { texto: "Sulfato de magnésio: ataque e manutenção em bomba de infusão.",
      detalhe: "É o anticonvulsivante da eclâmpsia: não usar diazepam nem fenitoína no lugar dele. Contraindicado na miastenia grave." },
    { texto: "Conferir em voz alta, com outra pessoa: concentração do frasco (50%, 20% ou 10%), gramas, mL e velocidade da bomba.",
      detalhe: "A ampola de 50% com 10 mL tem 5 g; a de 20%, 2 g; a de 10%, 1 g." },
    { texto: "Nova convulsão: mais 2 g IV e manutenção a 2 g/h.",
      detalhe: "Se dois bolus não controlarem: outro anticonvulsivante (MS: diazepam, lorazepam ou midazolam; RBEHG: fenitoína), UTI e investigação de complicação cerebral." },
    { texto: "PA ≥160/110 mmHg: nifedipino 10 mg VO ou, se inconsciente, hidralazina 5 a 10 mg IV, pelo protocolo obstétrico.",
      detalhe: "Sem queda brusca: baixar 15% a 25% na primeira hora. O labetalol IV não está disponível no Brasil." },
    { texto: "Sem bomba de infusão ou para transporte: esquema de Pritchard.",
      detalhe: "4 g IV + 10 g IM (10 mL de MgSO4 50% em cada nádega, agulha 20 de 10 cm); depois 5 g IM de 4 em 4 horas. Não usar IM na HELLP com plaquetopenia." },
    { texto: "Exames: hemograma com plaquetas, creatinina, enzimas hepáticas, eletrólitos e coagulação." },
    { texto: "Parto depois da estabilização materna." },
  ],
  medicamentos: [
    {
      id: "magnesio-eclampsia-ataque", farmaco: "Sulfato de magnésio", indicacao: "Ataque", populacao: "adulto", via: "IV",
      dose: { usual: 4, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_ATAQUE_MS, MAGNESIO_50], altoRisco: true,
      velocidade: "Lentamente, em 15 a 20 minutos.",
      cuidados: ["Na ampola de 50%, 4 g são 8 mL: diluir em 12 mL de água destilada antes (MS 2022)."],
      referencias: ["ms-2022-alto-risco", "rbehg-2023-pe"],
    },
    {
      id: "magnesio-eclampsia-manutencao", farmaco: "Sulfato de magnésio", indicacao: "Manutenção, em bomba de infusão", populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "h" }, apresentacoes: [MAGNESIO_MANUTENCAO_MS], altoRisco: true,
      repeticao: "Por 24 horas depois do parto ou da última convulsão, o que vier por último.",
      cuidados: [
        "Manter só com reflexo patelar presente, frequência respiratória ≥16 irpm e diurese ≥25 mL/h; avaliar a cada 4 horas.",
        "Fora desses limites: reduzir ou parar a infusão e dosar magnésio (terapêutico 4 a 7 mEq/L) e função renal.",
        "Creatinina ≥1,0 mg/dL: manutenção pela metade e magnésio sérico.",
        "Infusão parada por até 2 horas: reiniciar; por mais de 2 horas: novo ataque de 2 g.",
      ],
      referencias: ["ms-2022-alto-risco", "rbehg-2023-pe"],
    },
    {
      id: "magnesio-eclampsia-recorrencia", farmaco: "Sulfato de magnésio", indicacao: "Nova convulsão — dose adicional", populacao: "adulto", via: "IV",
      dose: { usual: 2, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_50], altoRisco: true,
      velocidade: "Em bolus IV lento.",
      cuidados: [
        "Diluir: 4 mL de MgSO4 50% (2 g) em 10 mL de água destilada ou SF (RBEHG 2023).",
        "Depois: manutenção a 2 g/h.",
      ],
      referencias: ["ms-2022-alto-risco", "rbehg-2023-pe"],
    },
    {
      id: "magnesio-eclampsia-manutencao-2g", farmaco: "Sulfato de magnésio", indicacao: "Manutenção depois de nova convulsão, ou se seguir sintomática", populacao: "adulto", via: "IV",
      dose: { usual: 2, unidade: "g", por: "h" }, apresentacoes: [MAGNESIO_MANUTENCAO_MS], altoRisco: true,
      cuidados: ["Os mesmos limites de vigilância da manutenção de 1 g/h."],
      referencias: ["ms-2022-alto-risco", "rbehg-2023-pe"],
    },
    {
      id: "gluconato-eclampsia", farmaco: "Gluconato de cálcio 10%", indicacao: "Intoxicação por magnésio, junto do suporte ventilatório", populacao: "adulto",
      via: "IV lento",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      velocidade: "Lentamente, em 3 minutos.",
      cuidados: ["Parar a infusão de magnésio; O2 por máscara e suporte ventilatório."],
      referencias: ["ms-2022-alto-risco", "rbehg-2023-pe"],
    },
  ],
  notasDeDose: [
    "Preparos do Ministério da Saúde (2022): ataque de 4 g = 8 mL de MgSO4 50% + 12 mL de água destilada; manutenção = 10 mL de MgSO4 50% + 240 mL de SF 0,9% (5 g em 250 mL), em que 1 g/h = 50 mL/h e 2 g/h = 100 mL/h.",
    "Pritchard (sem bomba ou no transporte): 4 g IV + 10 g IM (5 g em cada nádega) e 5 g IM de 4 em 4 horas.",
    "Intoxicação por magnésio (perda do reflexo patelar, depressão respiratória, rebaixamento): parar a infusão, ventilar e dar gluconato de cálcio.",
    "Fluidos na pré-eclâmpsia grave: manutenção limitada a 80 mL/h, salvo perdas.",
  ],
  depois: [
    "Na passagem à obstetrícia (UTI ou unidade de cuidado materno), que acompanha a paciente depois da sala: manter o magnésio por 24 horas depois do parto ou da última convulsão.",
    "Orientar na passagem a vigilância: reflexo patelar presente, frequência respiratória ≥16 irpm, diurese ≥25 mL/h, consciência e função renal; magnésio sérico fora desses limites ou com creatinina ≥1,0 mg/dL.",
    "Uso de magnésio por mais de 5 a 7 dias na gestação: avisar a neonatologia (cálcio, magnésio e ossos do recém-nascido).",
  ],
  divergencias: [
    {
      tema: "Tempo do ataque",
      posicoes: [
        { texto: "4 g EV em 5 a 10 minutos.", referencia: "ms-2022-alto-risco" },
        { texto: "4 g IV lentamente, em 15 a 20 minutos.", referencia: "rbehg-2023-pe" },
        { texto: "4 g IV em 5 a 15 minutos.", referencia: "nice-ng133" },
      ],
      escolha: "O cartão usa 15 a 20 minutos, da RBEHG (o grupo do protocolo da FEBRASGO): o ataque mais lento, com o mesmo preparo de 20 mL do Ministério da Saúde.",
    },
    {
      tema: "Preparo da manutenção",
      posicoes: [
        { texto: "10 mL de MgSO4 50% + 240 mL de SF (5 g em 250 mL); 1 g/h = 50 mL/h.", referencia: "ms-2022-alto-risco" },
        { texto: "10 mL de MgSO4 50% + 490 mL de SF (5 g em 500 mL); 1 g/h = 100 mL/h.", referencia: "rbehg-2023-pe" },
      ],
      escolha: "O do Ministério da Saúde, decisão do responsável médico em 05/11/2026.",
    },
    {
      tema: "Limites para manter o magnésio",
      posicoes: [
        { texto: "Diurese ≥25 mL/h, reflexos presentes, FR ≥12 mpm; creatinina >1,3 mg/dL, metade da dose.", referencia: "ms-2022-alto-risco" },
        { texto: "Reflexo patelar presente, FR ≥16 irpm, diurese ≥25 mL/h; creatinina ≥1,0 mg/dL, metade da manutenção.", referencia: "rbehg-2023-pe" },
      ],
      escolha: "FR ≥16 irpm, da RBEHG, decisão do responsável médico em 05/11/2026; a meia dose a partir de creatinina 1,0 mg/dL segue a mesma fonte.",
    },
  ],
  referencias: ["ms-2022-alto-risco", "rbehg-2023-pe", "nice-ng133"],
};

export const EMBOLIA_AMNIOTICA_V3 = comPassagem(EMBOLIA_AMNIOTICA, 3, {
  "UTI materna; coagulação, gasometria e ecocardiograma seriados.":
    "Passagem à UTI materna, que acompanha a paciente depois da sala, com coagulação, gasometria e ecocardiograma seriados.",
});
export const BNM_RESIDUAL_V3 = comPassagem(BNM_RESIDUAL, 3, {
  "Reavaliar depois da reversão (quantitativo) e de novo se piorar; vigiar a recurarização.":
    "Reavaliar na sala depois da reversão (quantitativo) e de novo se piorar; na passagem, orientar a vigilância da recurarização.",
});

/**
 * Os rascunhos em validação. A prévia do responsável médico os abre no lugar
 * da versão publicada. Os sete respiratórios (09 a 15) e os quatro obstétricos
 * e neonatal (16 a 19) e os seis da revisão 4 (20 a 24) vêm das revisões de
 * 01/11/2026, em protocolos/respiratorio.ts, protocolos/obstetricia-neonatal.ts
 * e protocolos/metabolicas-apoio.ts. O colapso
 * materno de lá substitui a proposta anterior (magnésio igual ao da Eclâmpsia).
 */
export const RASCUNHOS: readonly Protocolo[] = [
  ajustar(EMBOLIA_PULMONAR_V2, {
    "Monitorização intensiva, anticoagulação e duração conforme causa e risco, avaliação de complicações, acompanhamento cardiopulmonar e plano de prevenção secundária.":
      "Na passagem à UTI (ou à clínica cirúrgica), que acompanha o paciente depois da sala: orientar monitorização intensiva, anticoagulação e duração conforme causa e risco, avaliação de complicações, acompanhamento cardiopulmonar e plano de prevenção secundária.",
  }),
  ajustar(DEPRESSAO_OPIOIDES_V3, {
    "Monitorização contínua (SpO2 e, se possível, capnografia) por mais tempo que a ação do opioide.":
      "Na passagem à clínica cirúrgica (ou à unidade monitorizada), que acompanha o paciente depois da sala: orientar monitorização contínua (SpO2 e, se possível, capnografia) por mais tempo que a ação do opioide.",
    "Opioide neuraxial (morfina) ou de ação longa: unidade monitorizada; rever a analgesia multimodal.":
      "Opioide neuraxial (morfina) ou de ação longa: passagem à unidade monitorizada; rever a analgesia multimodal.",
  }),
  ajustar(HIPOTERMIA_V3, {
    "Recuperação: medir a cada 15 minutos; alta da sala só com 36,0 °C ou mais, mantendo o ar forçado.":
      "Na passagem à recuperação anestésica (ou à equipe que assume): orientar a medida da temperatura a cada 15 minutos e a alta só com 36,0 °C ou mais, mantendo o ar forçado.",
    "Conferir a recuperação respiratória e neuromuscular; vigiar arritmias e coagulação.":
      "Antes de sair da sala, conferir a recuperação respiratória e neuromuscular; na passagem, orientar a vigilância de arritmias e coagulação.",
    "Acidental grave: UTI, eletrólitos, glicemia e coagulação seriados; registrar a temperatura inicial e o método de reaquecimento.":
      "Acidental grave: passagem à UTI, com eletrólitos, glicemia e coagulação seriados; registrar a temperatura inicial e o método de reaquecimento.",
  }),
  ...RESPIRATORIO_V3, ...OBSTETRICIA_NEONATAL_V3, ...METABOLICAS_APOIO_V3, PCR_FV_TV_V4, SAV_PEDIATRICO_V3,
  ISQUEMIA_V4, HEMORRAGIA_V4, ANAFILAXIA_V3, EMBOLIA_GASOSA_V4, BRADICARDIA_V4,
  HIPOGLICEMIA_V3, CRISE_ADRENAL_V3, CONVULSAO_V3, DELIRIO_V3, ECLAMPSIA_V3, ECLAMPSIA_V4, EMBOLIA_AMNIOTICA_V3, BNM_RESIDUAL_V3,
];
