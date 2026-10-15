/**
 * REAÇÃO HEMOLÍTICA TRANSFUSIONAL — cartão 21 da minuta de validação de
 * 15/10/2026.
 *
 * Base: Manual de Crises (aba 07). Investigação e conduta transfusional:
 * Australian Red Cross Lifeblood; hemoterapia e hemovigilância seguem o
 * fluxo brasileiro local. O suporte renal é individualizado, e não deduzido
 * da antiga tabela de diuréticos. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";

export const REACAO_HEMOLITICA: Protocolo = {
  id: "reacao-hemolitica-transfusional",
  titulo: "Reação hemolítica transfusional",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["reação transfusional", "transfusão incompatível", "incompatibilidade ABO", "hemólise", "reação hemolítica aguda"],
  sinais: ["hipotensão", "taquicardia", "broncoespasmo", "sibilância", "urticária", "hipóxia", "colúria", "urina escura", "sangramento difuso", "sangramento em mucosas", "transfusão"],
  resumo: "Parar a transfusão e não reiniciar a bolsa suspeita; avisar a hemoterapia, sustentar oxigenação e perfusão e guardar bolsa e equipo para a investigação.",
  reconhecer: [
    "Durante ou depois da transfusão: hipotensão, febre, hemoglobinúria, sangramento, broncoespasmo ou colapso.",
    "Na anestesia, os sinais podem ser inespecíficos.",
  ],
  agirAgora: [
    { texto: "Parar a transfusão; não reiniciar a bolsa suspeita.", detalhe: "Manter o acesso com SF e equipo novo." },
    { texto: "Pedir ajuda, checar a identificação e avisar a hemoterapia imediatamente." },
    { texto: "Suportar oxigenação e perfusão; tratar o choque e a coagulopatia com a equipe." },
    { texto: "Guardar bolsa e equipo e colher amostras de sangue e urina conforme o protocolo.",
      detalhe: "Investigar hemólise, incompatibilidade e contaminação." },
    { texto: "Monitorizar diurese, potássio, função renal e coagulação.",
      detalhe: "A necessidade de nova transfusão é discutida com o banco de sangue." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Vasoativo conforme o mecanismo e o protocolo de hipotensão; hemocomponentes conforme a hemoterapia.",
    "Manitol e furosemida não são sequência automática para prevenir lesão renal.",
    "Diurético apenas pela avaliação de volemia, congestão e diurese, sem insistir na anúria nem provocar sobrecarga para perseguir diurese.",
  ],
  pensarEm: [
    "Reação febril, contaminação bacteriana, anafilaxia, TRALI, TACO e outra causa de choque.",
  ],
  depois: [
    "UTI conforme a gravidade; investigação transfusional e hemovigilância.",
    "Registrar o número das bolsas, os tempos, as doses e os resultados.",
  ],
  divergencias: [
    {
      tema: "Diurético e meta de diurese",
      posicoes: [
        { texto: "Duas linhas de furosemida (0,5 mg/kg EV e 1 a 3 mg/kg EV) e diurese de 0,5 a 1,5 mL/kg/h.", referencia: "manual-07" },
      ],
      escolha: "O protocolo não deduz o suporte renal da tabela de diuréticos: diurético só pela avaliação de volemia, congestão e diurese.",
    },
  ],
  referencias: ["manual-07", "lifeblood-hemolitica"],
  relacionados: [
    { protocolo: "hipotensao", texto: "Hipotensão grave" },
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
  ],
};
