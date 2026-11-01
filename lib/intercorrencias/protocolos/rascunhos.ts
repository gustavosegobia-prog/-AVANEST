/**
 * RASCUNHOS — propostas de correção, aguardando validação médica.
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
import { EMBOLIA_PULMONAR } from "./cardiovascular.ts";
import { COLAPSO_MATERNO } from "./obstetricia.ts";
import { DEPRESSAO_OPIOIDES } from "./opioides-e-bloqueio-residual.ts";
import { HIPOTERMIA } from "./outras-emergencias.ts";
import { MAGNESIO_50, MAGNESIO_80 } from "./comum.ts";
import { RESPIRATORIO_V3 } from "./respiratorio.ts";

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
// Colapso materno — o magnésio alinhado ao cartão Eclâmpsia
// ---------------------------------------------------------------------------
// A versão 2 (aprovada em 15/10) diz 4 g em 20 a 30 minutos e 1 a 2 g/h; o
// cartão Eclâmpsia diz 4 g em 15 minutos e 1 g/h. Dois esquemas no mesmo app
// são risco. Proposta: o da Eclâmpsia, ponto comum ao NICE e ao Manual de
// Crises, com o preparo do Manual (8 g em 100 mL = 80 mg/mL).
const dose = (p: Protocolo, id: string) => {
  const d = p.medicamentos.find((m) => m.id === id);
  if (!d) throw new Error(`${p.id}: dose ${id} não existe`);
  return d;
};
export const COLAPSO_MATERNO_V3: Protocolo = {
  ...COLAPSO_MATERNO,
  versao: 3,
  atualizadoEm: PROPOSTA,
  revisadoEm: PROPOSTA,
  medicamentos: COLAPSO_MATERNO.medicamentos.map((d) => {
    if (d.id === "magnesio-ataque") return {
      ...d, apresentacoes: [MAGNESIO_80, MAGNESIO_50], altoRisco: true,
      velocidade: "Em 15 minutos (na solução de 80 mg/mL, 200 mL/h).",
      cuidados: ["Na ampola de 50%, 4 g são 8 mL: diluir antes.", "Conferir em voz alta, com outra pessoa: concentração, gramas, mL e velocidade da bomba."],
      referencias: ["nice-ng133", "manual-18", "manual-34"],
    };
    if (d.id === "magnesio-manutencao") return {
      ...d, dose: { usual: 1, unidade: "g", por: "h" }, apresentacoes: [MAGNESIO_80], altoRisco: true,
      repeticao: "Por 24 horas depois do parto ou da última convulsão, o que vier por último.",
      cuidados: [
        "Vigiar reflexo patelar, frequência respiratória, consciência e diurese.",
        "Oligúria ou creatinina subindo: magnésio sérico e revisão da manutenção com a obstetrícia.",
      ],
      referencias: ["nice-ng133", "manual-34"],
    };
    if (d.id === "magnesio-recorrencia") return {
      ...d, dose: { min: 2, max: 4, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_80, MAGNESIO_50], altoRisco: true,
      velocidade: "Em 5 a 15 minutos.",
      cuidados: ["Na ampola de 50%: diluir antes."],
      referencias: ["nice-ng133", "ms-2022-alto-risco"],
    };
    if (d.id === "gluconato-intoxicacao-magnesio") return { ...d, velocidade: "Em 10 minutos.", cuidados: ["Parar a infusão de magnésio."] };
    return d;
  }),
  divergencias: COLAPSO_MATERNO.divergencias.map((x) => (/magnésio/.test(x.tema) ? {
    ...x,
    posicoes: [
      { texto: "4 g IV em 5 a 15 minutos; 1 g/h por 24 horas; recorrência, 2 a 4 g em 5 a 15 minutos.", referencia: "nice-ng133" },
      { texto: "4 g em 15 minutos (200 mL/h da solução de 8 g em 100 mL); 1 g/h (12,5 mL/h); 2 g se as convulsões persistirem.", referencia: "manual-34" },
      { texto: "Ataque de 4 g EV em 5 a 10 minutos; manutenção de 1 a 2 g/h; nova convulsão, 2 g.", referencia: "ms-2022-alto-risco" },
    ],
    escolha: "O cartão usa o mesmo esquema do cartão Eclâmpsia: 4 g em 15 minutos e 1 g/h, o ponto comum ao NICE e ao Manual de Crises, com o preparo do Manual.",
  } : x)),
  referencias: [...new Set([...COLAPSO_MATERNO.referencias, "nice-ng133", "manual-34"])],
};
// O ataque e a recorrência continuam com a mesma dose; a mudança é de tempo,
// de ritmo e de preparo. Conferido aqui para o rascunho não nascer quebrado.
dose(COLAPSO_MATERNO, "magnesio-ataque");

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

/**
 * Os rascunhos em validação. A prévia do responsável médico os abre no lugar
 * da versão publicada. Os sete respiratórios (09 a 15) vêm da revisão de
 * 01/11/2026, em protocolos/respiratorio.ts.
 */
export const RASCUNHOS: readonly Protocolo[] = [
  EMBOLIA_PULMONAR_V2, COLAPSO_MATERNO_V3, DEPRESSAO_OPIOIDES_V3, HIPOTERMIA_V3, ...RESPIRATORIO_V3,
];
