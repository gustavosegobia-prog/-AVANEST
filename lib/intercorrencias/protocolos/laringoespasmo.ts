/**
 * LARINGOESPASMO — adulto e criança.
 *
 * A sequência e as doses por kg vêm do QRH 3-6 da Association of
 * Anaesthetists (aberto e lido). As doses do algoritmo pediátrico de
 * consenso (Hampson-Evans, 2008) não foram conferidas no texto e por isso não
 * entram como número; a prática francesa (inquérito de 2017) aparece só como
 * divergência, porque inquérito não é recomendação.
 */

import type { ApresentacaoDoProtocolo, Protocolo } from "../tipos.ts";

const PROPOFOL_10: ApresentacaoDoProtocolo = { rotulo: "10 mg/mL (1%)", quantidade: 10, unidade: "mg", mL: 1, vias: ["IV"] };
const SUCCINILCOLINA_50: ApresentacaoDoProtocolo = { rotulo: "50 mg/mL", quantidade: 50, unidade: "mg", mL: 1, vias: ["IV", "IM"] };
const SUCCINILCOLINA_10: ApresentacaoDoProtocolo = {
  rotulo: "100 mg em 10 mL — 10 mg/mL", quantidade: 10, unidade: "mg", mL: 1, vias: ["IV", "IM"],
  preparo: "Frasco de 100 mg reconstituído em 10 mL",
};
const ROCURONIO_10: ApresentacaoDoProtocolo = { rotulo: "10 mg/mL", quantidade: 10, unidade: "mg", mL: 1, vias: ["IV"] };
const ATROPINA_025: ApresentacaoDoProtocolo = { rotulo: "0,25 mg/mL", quantidade: 0.25, unidade: "mg", mL: 1, vias: ["IV", "IM"] };
const ATROPINA_05: ApresentacaoDoProtocolo = { rotulo: "0,5 mg/mL", quantidade: 0.5, unidade: "mg", mL: 1, vias: ["IV", "IM"] };

const CUIDADOS_SUCCINILCOLINA = [
  "Contraindicada na hipercalemia, no grande queimado ou politraumatizado depois de 24 a 48 h, na desnervação e nas miopatias e distrofias (inclusive a criança com distrofia ainda não diagnosticada).",
  "Desencadeante de hipertermia maligna.",
  "Bradicardia, sobretudo na criança e na dose repetida.",
];

export const LARINGOESPASMO: Protocolo = {
  id: "laringoespasmo",
  titulo: "Laringoespasmo",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["laringoespasmo", "espasmo de laringe", "espasmo de glote", "estridor", "obstrução de via aérea"],
  sinais: [
    "estridor", "ruído inspiratório", "silêncio", "não ventila", "não consigo ventilar", "máscara difícil",
    "tiragem", "respiração paradoxal", "sem curva de capnografia", "capnografia obstrutiva", "dessaturação",
    "bradicardia", "extubação", "indução inalatória", "plano superficial",
  ],
  resumo: "Fechamento da glote em plano superficial: tirar o estímulo, CPAP com O2 a 100%, aprofundar e, se não abrir, bloqueador.",
  reconhecer: [
    "Estridor inspiratório (espasmo parcial) ou silêncio sem fluxo (espasmo completo).",
    "Esforço respiratório com tiragem e movimento paradoxal de tórax e abdome, sem expansão.",
    "Ventilação sob máscara difícil ou impossível; capnografia ausente ou obstrutiva.",
    "Dessaturação; na criança, bradicardia logo em seguida.",
    "Momentos típicos: indução inalatória, plano superficial, estímulo cirúrgico, secreção ou sangue na via aérea, extubação.",
  ],
  agirAgora: [
    { texto: "Chamar ajuda, avisar a equipe e parar o estímulo.", detalhe: "Cirurgia, aspiração, manipulação da via aérea." },
    { texto: "Tração da mandíbula.", detalhe: "Muitos associam a manobra de Larson: pressão firme no entalhe atrás do ramo da mandíbula." },
    { texto: "Retirar o que obstrui ou estimula: dispositivos, secreção, sangue, vômito.",
      detalhe: "Aspirar sob visão, na dúvida. Tubo traqueal bem posicionado afasta laringoespasmo." },
    { texto: "CPAP com O2 a 100% sob máscara bem acoplada.",
      detalhe: "Evitar insuflação vigorosa (enche o estômago). Cânula oro ou nasofaríngea se a obstrução for acima da laringe." },
    { texto: "Não abriu: manter o CPAP e aprofundar a anestesia com propofol." },
    { texto: "Persiste ou dessatura: bloqueador neuromuscular e ventilar.",
      detalhe: "Succinilcolina IV; sem acesso venoso, IM (inclusive na língua). Considerar intubar, sobretudo se pode voltar." },
    { texto: "Criança com bradicardia: oxigenar e ventilar é o tratamento; atropina se a bradicardia persistir.",
      detalhe: "FC abaixo de 60 com má perfusão apesar de oxigenar e ventilar: compressões.",
      so: ["pediatrico", "neonatal"] },
    { texto: "Descomprimir o estômago com sonda gástrica." },
    { texto: "Planejar o despertar e o local de recuperação; vigiar edema pulmonar por pressão negativa e aspiração." },
  ],
  medicamentos: [
    {
      id: "propofol-laringoespasmo", farmaco: "Propofol", indicacao: "Aprofundar a anestesia",
      populacao: "todas", via: "IV",
      dose: { min: 0.25, max: 0.5, unidade: "mg", por: "kg" },
      apresentacoes: [PROPOFOL_10],
      cuidados: ["Hipotensão e apneia: manter o CPAP."],
      referencias: ["qrh-3-6"],
    },
    {
      id: "succinilcolina-iv-laringoespasmo", farmaco: "Succinilcolina", indicacao: "Laringoespasmo que persiste ou com dessaturação",
      populacao: "todas", via: "IV",
      dose: { min: 0.25, max: 0.5, unidade: "mg", por: "kg" },
      apresentacoes: [SUCCINILCOLINA_10, SUCCINILCOLINA_50], altoRisco: true,
      cuidados: [...CUIDADOS_SUCCINILCOLINA, "Dose para desfazer o espasmo. Para intubar, a dose de intubação da calculadora."],
      referencias: ["qrh-3-6"],
    },
    {
      id: "succinilcolina-im-laringoespasmo", farmaco: "Succinilcolina", indicacao: "Sem acesso venoso",
      populacao: "todas", via: "IM (inclusive na língua)",
      dose: { usual: 4, unidade: "mg", por: "kg" },
      apresentacoes: [SUCCINILCOLINA_50, SUCCINILCOLINA_10], altoRisco: true,
      cuidados: [...CUIDADOS_SUCCINILCOLINA, "Começa a agir mais devagar que pela via IV."],
      referencias: ["qrh-3-6"],
    },
    {
      id: "rocuronio-laringoespasmo", farmaco: "Rocurônio", indicacao: "Alternativa quando a succinilcolina é contraindicada",
      populacao: "todas", via: "IV",
      dose: { min: 0.25, max: 0.5, unidade: "mg", por: "kg" },
      apresentacoes: [ROCURONIO_10],
      cuidados: ["Bloqueio prolongado: ter plano de via aérea e sugamadex à mão."],
      referencias: ["qrh-3-6"],
    },
    {
      id: "atropina-laringoespasmo-ped", farmaco: "Atropina", indicacao: "Bradicardia que persiste apesar de oxigenar e ventilar",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 0.02, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 0.5, unidade: "mg" },
      apresentacoes: [ATROPINA_025, ATROPINA_05],
      repeticao: "Pode repetir uma vez. Máximo de 0,5 mg por dose.",
      par: "atropina-laringoespasmo-adulto", referencias: ["aha-2020-pediatrico"],
    },
    {
      id: "atropina-laringoespasmo-adulto", farmaco: "Atropina", indicacao: "Bradicardia que persiste apesar de oxigenar e ventilar",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "mg", por: "fixa" },
      apresentacoes: [ATROPINA_05, ATROPINA_025],
      repeticao: "A cada 3 a 5 minutos, até 3 mg.",
      par: "atropina-laringoespasmo-ped", referencias: ["aha-2020-adulto"],
    },
  ],
  volumes: [],
  pensarEm: [
    "Obstrução acima da laringe (língua, partes moles): melhora com tração da mandíbula e cânula.",
    "Secreção, sangue, corpo estranho ou vômito na via aérea; aspiração.",
    "Broncoespasmo (sibilos, capnografia em barbatana).",
    "Edema de glote, angioedema ou anafilaxia.",
    "Paralisia de prega vocal (cirurgia de tireoide ou de pescoço), laringomalácia.",
    "Se intubado: tubo dobrado, mordido ou obstruído.",
  ],
  depois: [
    "Vigiar a SpO2 em ar ambiente antes da alta da recuperação.",
    "Edema pulmonar por pressão negativa pode aparecer nas horas seguintes: tosse, secreção rósea, dessaturação.",
    "Se houve vômito ou regurgitação, conduzir como broncoaspiração.",
    "Registrar na ficha o episódio, as doses e o tempo de dessaturação; anotar no plano das próximas anestesias.",
    "Criança: conversar com a família.",
  ],
  divergencias: [
    {
      tema: "Dose de propofol",
      posicoes: [
        { texto: "0,25 a 0,5 mg/kg IV.", referencia: "qrh-3-6" },
        { texto: "Na prática dos anestesiologistas pediátricos franceses, a dose mais usada foi 2 mg/kg (inquérito).", referencia: "michelet-2017" },
      ],
      escolha: "O protocolo segue o QRH; o inquérito descreve prática, não recomenda.",
    },
    {
      tema: "Dose IV de succinilcolina",
      posicoes: [
        { texto: "0,25 a 0,5 mg/kg IV para desfazer o espasmo.", referencia: "qrh-3-6" },
        { texto: "Na prática francesa (inquérito), 1 a 2 mg/kg conforme a idade.", referencia: "michelet-2017" },
      ],
      escolha: "O protocolo segue o QRH para desfazer o espasmo; a dose de intubação fica na calculadora.",
    },
  ],
  referencias: ["qrh-3-6", "gavel-2014", "hampson-evans-2008", "alalami-2008", "michelet-2017", "aha-2020-pediatrico", "aha-2020-adulto"],
};
