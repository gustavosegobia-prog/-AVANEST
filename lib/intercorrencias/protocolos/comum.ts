/**
 * Apresentações que os protocolos usam. Cada uma com o rótulo inteiro (o que
 * está escrito na ampola e como se dilui): nenhuma concentração é presumida.
 *
 * Todo preparo indica o VOLUME FINAL, e não o volume de diluente a acrescentar
 * (convenção da minuta de validação de 15/10/2026). Noradrenalina é escrita em
 * base. Conferir massa, apresentação, compatibilidade, acesso e rótulo antes
 * de administrar.
 */

import type { ApresentacaoDoProtocolo } from "../tipos.ts";

/* ---------------- Adrenalina ---------------- */
export const ADRENALINA_100: ApresentacaoDoProtocolo = {
  rotulo: "1 mg em 10 mL — 100 mcg/mL (0,1 mg/mL)", quantidade: 100, unidade: "mcg", mL: 1, vias: ["IV", "IO", "Traqueal"],
  preparo: "1 ampola (1 mg) completada para 10 mL de SF 0,9%",
};
export const ADRENALINA_PURA_PCR: ApresentacaoDoProtocolo = {
  rotulo: "Ampola pura 1 mg/mL — só na PCR", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV", "IO"],
};
export const ADRENALINA_PURA_IM: ApresentacaoDoProtocolo = {
  rotulo: "Ampola pura 1 mg/mL (1:1.000) — IM", quantidade: 1, unidade: "mg", mL: 1, vias: ["IM"],
};
export const ADRENALINA_20: ApresentacaoDoProtocolo = {
  rotulo: "1 mg em 50 mL — 20 mcg/mL", quantidade: 20, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (1 mg) completada para 50 mL de SF 0,9%",
};
export const ADRENALINA_10: ApresentacaoDoProtocolo = {
  rotulo: "1 mg em 100 mL — 10 mcg/mL", quantidade: 10, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (1 mg) completada para 100 mL de SF 0,9%",
};
/** Seringa de 50 mL para infusão. */
export const ADRENALINA_60: ApresentacaoDoProtocolo = {
  rotulo: "3 mg em 50 mL — 60 mcg/mL", quantidade: 60, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "3 ampolas (3 mg) completadas para 50 mL de SF 0,9%",
};

/* ---------------- Antiarrítmicos e cardiovasculares ---------------- */
export const AMIODARONA_50: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 150 mg em 3 mL — 50 mg/mL", quantidade: 50, unidade: "mg", mL: 1, vias: ["IV", "IO"],
};
export const LIDOCAINA_20: ApresentacaoDoProtocolo = {
  rotulo: "Lidocaína 2% sem vasoconstritor — 20 mg/mL", quantidade: 20, unidade: "mg", mL: 1, vias: ["IV", "IO"],
};
export const ADENOSINA_3: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 6 mg em 2 mL — 3 mg/mL", quantidade: 3, unidade: "mg", mL: 1, vias: ["IV", "IO"],
};
export const ATROPINA_05: ApresentacaoDoProtocolo = { rotulo: "0,5 mg/mL", quantidade: 0.5, unidade: "mg", mL: 1, vias: ["IV", "IO", "IM"] };
export const ATROPINA_025: ApresentacaoDoProtocolo = { rotulo: "0,25 mg/mL", quantidade: 0.25, unidade: "mg", mL: 1, vias: ["IV", "IO", "IM"] };
export const METOPROLOL_1: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 5 mg em 5 mL — 1 mg/mL", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
};
export const ESMOLOL_10: ApresentacaoDoProtocolo = {
  rotulo: "10 mg/mL (100 mg em 10 mL)", quantidade: 10, unidade: "mg", mL: 1, vias: ["IV"],
};
export const NITROGLICERINA_200: ApresentacaoDoProtocolo = {
  rotulo: "50 mg em 250 mL — 200 mcg/mL", quantidade: 200, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "50 mg completados para 250 mL (volume final); conferir diluente e equipo com a farmácia",
};
export const HIDRALAZINA_1: ApresentacaoDoProtocolo = {
  rotulo: "20 mg em 20 mL — 1 mg/mL", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (20 mg) completada para 20 mL de SF 0,9%",
};

/* ---------------- Vasopressores ---------------- */
export const EFEDRINA_5: ApresentacaoDoProtocolo = {
  rotulo: "50 mg em 10 mL — 5 mg/mL", quantidade: 5, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (50 mg) completada para 10 mL de SF 0,9%; conferir a ampola original",
};
export const FENILEFRINA_100: ApresentacaoDoProtocolo = {
  rotulo: "10 mg em 100 mL — 100 mcg/mL", quantidade: 100, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (10 mg) completada para 100 mL de SF 0,9%",
};
export const NORADRENALINA_80: ApresentacaoDoProtocolo = {
  rotulo: "4 mg de base em 50 mL — 80 mcg/mL", quantidade: 80, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "4 mg de noradrenalina BASE completados para 50 mL; a ampola pode trazer a massa do sal (hemitartarato): conferir a quantidade de base",
};

/* ---------------- Eletrólitos, glicose e insulina ---------------- */
export const MAGNESIO_50: ApresentacaoDoProtocolo = {
  rotulo: "Sulfato de magnésio 50% — 500 mg/mL", quantidade: 500, unidade: "mg", mL: 1, vias: ["IV"],
};
export const MAGNESIO_10: ApresentacaoDoProtocolo = {
  rotulo: "Sulfato de magnésio 10% — 100 mg/mL", quantidade: 100, unidade: "mg", mL: 1, vias: ["IV"],
};
/**
 * Eclâmpsia, preparo do Manual de Crises (aba 34): 8 g em 100 mL finais. O
 * ataque de 4 g em 15 min corre a 200 mL/h; a manutenção de 1 g/h, a 12,5 mL/h.
 */
export const MAGNESIO_80: ApresentacaoDoProtocolo = {
  rotulo: "8 g em 100 mL — 80 mg/mL (preparo do Manual de Crises)", quantidade: 8, unidade: "g", mL: 100, vias: ["IV"],
  preparo: "16 mL de sulfato de magnésio 50% (8 g) completados para 100 mL de SF 0,9%, em bomba de infusão",
};
/** Manutenção da eclâmpsia no preparo do Tratado SAESP: 12 g em 124 mL finais. */
export const MAGNESIO_SAESP_124: ApresentacaoDoProtocolo = {
  rotulo: "12 g em 124 mL — cerca de 97 mg/mL (preparo SAESP)", quantidade: 12, unidade: "g", mL: 124, vias: ["IV"],
  preparo: "24 mL de sulfato de magnésio 50% (12 g) + 100 mL de SG 5% = 124 mL, em bomba de infusão",
};
/** Manutenção da eclâmpsia: 5 g em 250 mL finais. */
export const MAGNESIO_20MG: ApresentacaoDoProtocolo = {
  rotulo: "5 g em 250 mL — 20 mg/mL", quantidade: 20, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "10 mL de sulfato de magnésio 50% (5 g) completados para 250 mL",
};
export const CLORETO_DE_CALCIO_10: ApresentacaoDoProtocolo = {
  rotulo: "Cloreto de cálcio 10% — 100 mg/mL (ampola de 10 mL)", quantidade: 100, unidade: "mg", mL: 1, vias: ["IV", "IO"],
};
export const GLUCONATO_DE_CALCIO_10: ApresentacaoDoProtocolo = {
  rotulo: "Gluconato de cálcio 10% — 100 mg/mL (ampola de 10 mL)", quantidade: 100, unidade: "mg", mL: 1, vias: ["IV", "IO"],
};
export const GLICOSE_50: ApresentacaoDoProtocolo = { rotulo: "Glicose 50% — 0,5 g/mL", quantidade: 0.5, unidade: "g", mL: 1, vias: ["IV"] };
export const GLICOSE_10: ApresentacaoDoProtocolo = { rotulo: "Glicose 10% — 0,1 g/mL", quantidade: 0.1, unidade: "g", mL: 1, vias: ["IV", "IO"] };
export const INSULINA_1: ApresentacaoDoProtocolo = {
  rotulo: "Insulina regular diluída a 1 UI/mL", quantidade: 1, unidade: "UI", mL: 1, vias: ["IV"],
  preparo: "Preparo do serviço, com dupla checagem: a 1 UI/mL, a dose em UI é o volume em mL",
};

/* ---------------- Via aérea e respiratório ---------------- */
export const PROPOFOL_10: ApresentacaoDoProtocolo = { rotulo: "10 mg/mL (1%)", quantidade: 10, unidade: "mg", mL: 1, vias: ["IV"] };
export const SUCCINILCOLINA_10: ApresentacaoDoProtocolo = {
  rotulo: "100 mg em 10 mL — 10 mg/mL", quantidade: 10, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "Frasco de 100 mg reconstituído para 10 mL",
};
export const SUCCINILCOLINA_50: ApresentacaoDoProtocolo = {
  rotulo: "100 mg em 2 mL — 50 mg/mL (IM)", quantidade: 50, unidade: "mg", mL: 1, vias: ["IM"],
  preparo: "Frasco de 100 mg reconstituído para 2 mL",
};
export const SALBUTAMOL_NEBULIZACAO: ApresentacaoDoProtocolo = {
  rotulo: "Solução para nebulização 5 mg/mL", quantidade: 5, unidade: "mg", mL: 1, vias: ["Inalatória"],
};
export const IPRATROPIO_NEBULIZACAO: ApresentacaoDoProtocolo = {
  rotulo: "Solução para nebulização 0,25 mg/mL", quantidade: 0.25, unidade: "mg", mL: 1, vias: ["Inalatória"],
};
/** Só a apresentação injetável. */
export const SALBUTAMOL_IV_50: ApresentacaoDoProtocolo = {
  rotulo: "Salbutamol injetável 0,5 mg em 10 mL — 50 mcg/mL", quantidade: 50, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "0,5 mg da apresentação injetável completados para 10 mL de SF 0,9%",
};

/* ---------------- Reversão ---------------- */
export const SUGAMADEX_100: ApresentacaoDoProtocolo = {
  rotulo: "Frasco de 200 mg em 2 mL — 100 mg/mL (conferir a bula da apresentação utilizada)", quantidade: 100, unidade: "mg", mL: 1, vias: ["IV"],
};
export const NALOXONA_004: ApresentacaoDoProtocolo = {
  rotulo: "0,4 mg em 10 mL — 0,04 mg/mL", quantidade: 0.04, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "1 ampola de 0,4 mg/mL completada para 10 mL de SF 0,9%: cada mL é uma dose inicial",
};
/** Diluição pediátrica da bula do sugamadex. */
export const SUGAMADEX_10: ApresentacaoDoProtocolo = {
  rotulo: "200 mg em 20 mL — 10 mg/mL (diluição pediátrica)", quantidade: 10, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "Frasco de 200 mg em 2 mL (100 mg/mL) + 18 mL de SF 0,9% = 20 mL; usar logo após preparar",
};
export const NEOSTIGMINA_05: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 0,5 mg/mL", quantidade: 0.5, unidade: "mg", mL: 1, vias: ["IV"],
};
export const NALOXONA_04: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 0,4 mg/mL, sem diluir", quantidade: 0.4, unidade: "mg", mL: 1, vias: ["IV", "IM"],
};

/* ---------------- Anticonvulsivantes ---------------- */
/** Para o IM, a ampola concentrada: 15 mg em 3 mL ou 50 mg em 10 mL. */
export const MIDAZOLAM_5_IM: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 5 mg/mL, sem diluir — IM", quantidade: 5, unidade: "mg", mL: 1, vias: ["IM"],
};
export const DIAZEPAM_5: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 10 mg em 2 mL — 5 mg/mL", quantidade: 5, unidade: "mg", mL: 1, vias: ["IV"],
};
export const LEVETIRACETAM_100: ApresentacaoDoProtocolo = {
  rotulo: "100 mg/mL (500 mg em 5 mL)", quantidade: 100, unidade: "mg", mL: 1, vias: ["IV"],
};

/* ---------------- Outros ---------------- */
export const MIDAZOLAM_1: ApresentacaoDoProtocolo = {
  rotulo: "5 mg em 5 mL — 1 mg/mL", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "1 mL da ampola de 5 mg/mL completado para 5 mL de SF 0,9%",
};
export const TRANEXAMICO_50: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 250 mg em 5 mL — 50 mg/mL", quantidade: 50, unidade: "mg", mL: 1, vias: ["IV"],
};
export const DANTROLENO_20: ApresentacaoDoProtocolo = {
  rotulo: "Frasco de 20 mg + 60 mL de água estéril sem conservante — 0,333 mg/mL", quantidade: 20, unidade: "mg", mL: 60, vias: ["IV"],
  preparo: "60 mL de água estéril sem conservante por frasco; agitar até clarear",
};
export const DANTROLENO_250: ApresentacaoDoProtocolo = {
  rotulo: "Formulação de 250 mg em 5 mL — 50 mg/mL (só se disponível)", quantidade: 50, unidade: "mg", mL: 1, vias: ["IV"],
  preparo: "Preparo do próprio fabricante: não usar diluente nem preparo de outro produto",
};
export const METILERGOMETRINA_02: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 0,2 mg/mL", quantidade: 0.2, unidade: "mg", mL: 1, vias: ["IM"],
};
