/**
 * Apresentações que mais de um protocolo usa. Cada uma com o rótulo inteiro
 * (o que está escrito na ampola e como se dilui): nenhuma concentração é
 * presumida.
 */

import type { ApresentacaoDoProtocolo } from "../tipos.ts";

export const ADRENALINA_PURA_PCR: ApresentacaoDoProtocolo = {
  rotulo: "Ampola pura 1 mg/mL — na PCR", quantidade: 1, unidade: "mg", mL: 1, vias: ["IV"],
};
export const ADRENALINA_100: ApresentacaoDoProtocolo = {
  rotulo: "1 mg em 10 mL — 100 mcg/mL (1:10.000)", quantidade: 100, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (1 mg) + 9 mL de SF 0,9%",
};
export const ADRENALINA_10: ApresentacaoDoProtocolo = {
  rotulo: "1 mg em 100 mL — 10 mcg/mL (1:100.000)", quantidade: 10, unidade: "mcg", mL: 1, vias: ["IV"],
  preparo: "1 ampola (1 mg) em 100 mL de SF 0,9%",
};
export const AMIODARONA_50: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 150 mg em 3 mL — 50 mg/mL", quantidade: 50, unidade: "mg", mL: 1, vias: ["IV"],
};
export const LIDOCAINA_20: ApresentacaoDoProtocolo = {
  rotulo: "Lidocaína 2% sem vasoconstritor — 20 mg/mL", quantidade: 20, unidade: "mg", mL: 1, vias: ["IV"],
};
export const MAGNESIO_50: ApresentacaoDoProtocolo = {
  rotulo: "Sulfato de magnésio 50% — 500 mg/mL", quantidade: 500, unidade: "mg", mL: 1, vias: ["IV"],
};
export const MAGNESIO_10: ApresentacaoDoProtocolo = {
  rotulo: "Sulfato de magnésio 10% — 100 mg/mL", quantidade: 100, unidade: "mg", mL: 1, vias: ["IV"],
};
export const CLORETO_DE_CALCIO_10: ApresentacaoDoProtocolo = {
  rotulo: "Cloreto de cálcio 10% — 100 mg/mL (ampola de 10 mL)", quantidade: 100, unidade: "mg", mL: 1, vias: ["IV"],
};
export const GLUCONATO_DE_CALCIO_10: ApresentacaoDoProtocolo = {
  rotulo: "Gluconato de cálcio 10% — 100 mg/mL (ampola de 10 mL)", quantidade: 100, unidade: "mg", mL: 1, vias: ["IV"],
};
export const BICARBONATO_84: ApresentacaoDoProtocolo = {
  rotulo: "Bicarbonato de sódio 8,4% — 1 mEq/mL", quantidade: 1, unidade: "mEq", mL: 1, vias: ["IV"],
};
export const ATROPINA_05: ApresentacaoDoProtocolo = { rotulo: "0,5 mg/mL", quantidade: 0.5, unidade: "mg", mL: 1, vias: ["IV", "IM"] };
export const ATROPINA_025: ApresentacaoDoProtocolo = { rotulo: "0,25 mg/mL", quantidade: 0.25, unidade: "mg", mL: 1, vias: ["IV", "IM"] };
export const TRANEXAMICO_50: ApresentacaoDoProtocolo = {
  rotulo: "Ampola de 250 mg em 5 mL — 50 mg/mL", quantidade: 50, unidade: "mg", mL: 1, vias: ["IV"],
};

/** As causas reversíveis, na ordem em que se lembram. */
export const QUATRO_H_QUATRO_T = [
  "4 H: hipóxia, hipovolemia, hipotermia, hipo ou hipercalemia (e outros distúrbios metabólicos).",
  "4 T: pneumotórax hipertensivo, tamponamento, trombose (coronária ou pulmonar), tóxicos.",
];

/** O que é próprio da sala cirúrgica (QRH 2-1, quadro A). */
export const CAUSAS_DA_SALA = [
  "Da anestesia: reflexo vagal (pneumoperitônio, tração, olho), erro de fármaco, toxicidade por anestésico local, raqui alta.",
  "Anafilaxia; embolia gasosa, gordurosa ou amniótica; sangramento oculto (principalmente na laparoscopia).",
];
