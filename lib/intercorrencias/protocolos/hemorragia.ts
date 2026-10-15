/**
 * HEMORRAGIA MACIÇA — cartão 04 da minuta de validação de 15/10/2026.
 *
 * Base: Manual de Crises (aba 05) e Tratado SAESP (cap. 131, obstetrícia).
 * Limiar de fibrinogênio fora da obstetrícia: ESAIC 2022. Componentes e
 * ácido tranexâmico dependem da causa e do protocolo do serviço; o que não é
 * universal fica nas notas, e não vira número. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { CLORETO_DE_CALCIO_10, TRANEXAMICO_50 } from "./comum.ts";

export const HEMORRAGIA: Protocolo = {
  id: "hemorragia-macica",
  titulo: "Hemorragia maciça",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["hemorragia intraoperatória grave", "sangramento", "transfusão maciça", "choque hemorrágico", "hemorragia crítica", "coagulopatia"],
  sinais: ["sangramento", "PA caindo", "taquicardia", "aspirador cheio", "hemoglobina caindo", "lactato alto", "sangramento difuso"],
  resumo: "Ativar o protocolo de hemorragia, controlar a fonte, sangue sem atraso e terapia dirigida por exames; corrigir hipotermia, acidose e hipocalcemia.",
  reconhecer: [
    "Perda rápida ou persistente com repercussão, ou necessidade prevista de transfusão.",
    "Hb inicial normal não exclui sangramento grave.",
    "Não esperar a perda de uma volemia para ativar ajuda.",
  ],
  agirAgora: [
    { texto: "Acionar a equipe, a cirurgia e o protocolo de hemorragia; um comunicador com o banco de sangue." },
    { texto: "Controlar a fonte: compressão, tamponamento, cirurgia ou intervenção.",
      detalhe: "Acesso calibroso, aquecimento, monitorização e infusor conforme a necessidade." },
    { texto: "Hemocomponentes sem atraso quando indicados; liberação emergencial com a hemoterapia.",
      detalhe: "Não esperar o cristaloide atingir um teto para iniciar sangue." },
    { texto: "Coletar e repetir Hb, plaquetas, coagulação, fibrinogênio, cálcio iônico, gasometria e lactato.",
      detalhe: "Testes viscoelásticos, se disponíveis." },
    { texto: "Estratégia inicial de componentes conforme o protocolo institucional; depois, terapia dirigida.",
      detalhe: "Corrigir hipotermia, acidose e hipocalcemia." },
    { texto: "Não aplicar hipotensão permissiva genericamente em gestante, TCE ou toda hemorragia operatória." },
    { texto: "Gestante: seguir também o protocolo de hemorragia pós-parto.", so: ["gestante"] },
  ],
  medicamentos: [
    {
      id: "cloreto-de-calcio-hemorragia-adulto", farmaco: "Cloreto de cálcio 10%", indicacao: "Hipocalcemia — guiado pelo cálcio iônico",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [CLORETO_DE_CALCIO_10],
      repeticao: "Repetir guiado pelo cálcio iônico.",
      cuidados: ["Em acesso seguro: extravasamento causa necrose."],
      par: "cloreto-de-calcio-hemorragia-ped",
      referencias: ["manual-05"],
    },
    {
      id: "cloreto-de-calcio-hemorragia-ped", farmaco: "Cloreto de cálcio 10%", indicacao: "Hipocalcemia — guiado pelo cálcio iônico",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 20, unidade: "mg", por: "kg" }, apresentacoes: [CLORETO_DE_CALCIO_10],
      cuidados: ["Individualizar o teto e a necessidade.", "Em acesso seguro: extravasamento causa necrose."],
      par: "cloreto-de-calcio-hemorragia-adulto",
      referencias: ["manual-05"],
    },
    {
      id: "tranexamico-trauma-bolus", farmaco: "Ácido tranexâmico", indicacao: "Trauma, se indicado precocemente — primeira dose",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [TRANEXAMICO_50],
      velocidade: "Em 10 minutos.",
      referencias: ["manual-05"],
    },
    {
      id: "tranexamico-trauma-infusao", farmaco: "Ácido tranexâmico", indicacao: "Trauma — depois da primeira dose",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [TRANEXAMICO_50],
      velocidade: "Em 8 horas.",
      referencias: ["manual-05"],
    },
  ],
  volumes: [
    { id: "plasma", rotulo: "Plasma", grupo: "Hemocomponentes", indicacao: "Se indicado por coagulopatia ou pelo protocolo; reavaliar",
      populacao: "todas", porKg: { min: 15 }, referencias: ["manual-05"] },
  ],
  notasDeDose: [
    "Plaquetas no adulto: dose terapêutica por aférese ou pool, definida com a hemoterapia; não usar 15 a 20 mL/kg como padrão adulto.",
    "Fibrinogênio: no sangramento com deficiência, concentrado ou crioprecipitado. Fora da obstetrícia, considerar a reposição com Clauss ≤1,5 g/L ou deficiência no teste viscoelástico; na obstetrícia, meta ≥2 g/L.",
    "Ácido tranexâmico: o regime depende da causa. Hemorragia pós-parto: protocolo próprio. Cirurgia e criança: prescrição específica do procedimento.",
    "Complexo protrombínico e fator VIIa recombinante não são degraus automáticos; usar por indicação definida com especialista.",
    "A dose pediátrica de componentes deve corresponder ao produto local.",
  ],
  pensarEm: [
    "Sangramento oculto, CIVD ou fibrinólise, anticoagulantes, hipotermia, reação transfusional e outra causa simultânea de choque.",
  ],
  depois: [
    "Encerrar o protocolo com a hemoterapia depois do controle.",
    "Vigiar TACO, TRALI, eletrólitos, lesão renal e síndrome compartimental.",
    "Registrar bolsas, perdas e exames.",
  ],
  divergencias: [
    {
      tema: "Dose do ácido tranexâmico no adulto",
      posicoes: [{ texto: "“1 mg EV por 10 min, depois 1 mg por 8 h” (tabela do protocolo).", referencia: "manual-05" }],
      escolha: "O protocolo usa 1 g: o “1 mg” é mil vezes menos e parece erro de impressão.",
    },
    {
      tema: "Dose de plaquetas",
      posicoes: [{ texto: "15 a 20 mL/kg, com contagem abaixo de 75 × 10⁹/L.", referencia: "manual-05" }],
      escolha: "No adulto, a dose é a terapêutica por aférese ou pool, definida com a hemoterapia; 15 a 20 mL/kg não é padrão adulto.",
    },
    {
      tema: "Limiar de fibrinogênio fora da obstetrícia",
      posicoes: [{ texto: "Considerar a reposição com Clauss ≤1,5 g/L ou deficiência no teste viscoelástico.", referencia: "esaic-2022-sangramento" }],
      escolha: "O protocolo usa o limiar da ESAIC fora da obstetrícia e a meta de ≥2 g/L na obstetrícia (Tratado SAESP).",
    },
  ],
  referencias: ["manual-05", "saesp-tratado", "esaic-2022-sangramento"],
  veja: [{ protocolo: "hemorragia-pos-parto", quando: ["gestante"], texto: "Gestante: siga também o protocolo de hemorragia pós-parto." }],
};
