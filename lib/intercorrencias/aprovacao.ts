/**
 * A APROVAÇÃO MÉDICA DOS PROTOCOLOS.
 *
 * A minuta de validação de 15/10/2026 pede que o responsável médico registre
 * nome, CRM, data e a versão aprovada. O registro mora aqui, no código, junto
 * do conteúdo que ele aprova, e diz QUAIS protocolos e em QUAL versão: muda o
 * conteúdo, sobe a versão do protocolo, e a aprovação deixa de valer para ele;
 * protocolo novo entra sem aprovação. Nos dois casos a tela diz "versão nova,
 * sem aprovação registrada" até uma aprovação ser escrita aqui.
 */

import type { Protocolo } from "./tipos.ts";

export type Aprovacao = {
  responsavel: string;
  crm: string;
  /** AAAA-MM-DD. */
  data: string;
  documento: string;
  /** O id de cada protocolo aprovado e a versão dele que foi aprovada. */
  protocolos: Readonly<Record<string, number>>;
};

/** Os 34 cartões da minuta de 15/10/2026, todos na versão 2. */
const MINUTA_DE_15_10_2026 = [
  "pcr-fv-tv", "pcr-aesp-assistolia", "sav-pediatrico", "isquemia-miocardica", "hemorragia-macica", "anafilaxia",
  "reacao-hemolitica-transfusional", "embolia-gasosa-venosa", "ventilacao-mascara-dificil", "intubacao-dificil",
  "nao-ventilo-nao-intubo", "laringoespasmo", "pressao-vias-aereas", "broncoespasmo-grave", "broncoaspiracao",
  "bloqueio-neuroaxial-alto", "hemorragia-pos-parto", "colapso-materno", "reanimacao-neonatal", "toxicidade-anestesico-local",
  "hipercalemia", "hipertermia-maligna", "evento-sem-diagnostico", "depois-da-crise", "colega-afetado", "dessaturacao",
  "hipertensao", "hipotensao", "taquiarritmia", "bradicardia", "aumento-etco2", "diminuicao-etco2", "verificacao-aparelho",
  "verificacao-pre-inducao",
];

export const APROVACOES: readonly Aprovacao[] = [
  {
    responsavel: "Gustavo Segobia da Silva",
    crm: "CRM 49131",
    data: "2026-10-15",
    documento: "Minuta de validação AVANEST — protocolos de crise em anestesia, revisão de 15/10/2026",
    protocolos: Object.fromEntries(MINUTA_DE_15_10_2026.map((id) => [id, 2])),
  },
  {
    // Autorizada pelo responsável médico na conversa de 01/11/2026 ("já pode
    // aprovar"), sobre o texto da minuta que ele mesmo enviou. Os 9 que já
    // existiam passam à versão 3; a embolia pulmonar entra na versão 1.
    responsavel: "Gustavo Segobia da Silva",
    crm: "CRM 49131",
    data: "2026-11-01",
    documento: "AVANEST — Implementação dos 10 protocolos cardiovasculares, minuta de 01/11/2026",
    protocolos: {
      "pcr-fv-tv": 3, "pcr-aesp-assistolia": 3, "isquemia-miocardica": 3, "hemorragia-macica": 3, "embolia-gasosa-venosa": 3,
      hipertensao: 3, hipotensao: 3, taquiarritmia: 3, bradicardia: 3, "embolia-pulmonar": 1,
    },
  },
  {
    // Autorizada pelo responsável médico na conversa de 05/11/2026 ("pode
    // validar todos"), sobre os 40 rascunhos que estavam na prévia — todos
    // feitos a partir dos textos que ele mesmo enviou: a minuta preliminar
    // "Protocolos de crise" (outubro de 2026), as revisões respiratória (09 a
    // 15), obstétrica e neonatal (16 a 19) e a revisão 4 (20 a 24), o aviso de
    // lidocaína na suspeita de LAST e a passagem de cuidado à clínica cirúrgica.
    //
    // Duas notas de conferência de fonte seguem declaradas no próprio cartão e
    // não mudam dose: o texto do PALS 2025 na bradicardia pediátrica (as doses
    // são as da Bradicardia grave, já aprovada) e o preparo de 124 mL do
    // magnésio na eclâmpsia (opção vinda da minuta).
    responsavel: "Gustavo Segobia da Silva",
    crm: "CRM 49131",
    data: "2026-11-05",
    documento: "AVANEST — Validação dos rascunhos da prévia (revisões de 01/11/2026 e minuta preliminar de outubro de 2026), 05/11/2026",
    protocolos: {
      // Correções de cartões que já tinham versão aprovada.
      "pcr-fv-tv": 4, "sav-pediatrico": 3, "isquemia-miocardica": 4, "hemorragia-macica": 4, anafilaxia: 3,
      "embolia-gasosa-venosa": 4, bradicardia: 4, "embolia-pulmonar": 2,
      "ventilacao-mascara-dificil": 3, "intubacao-dificil": 3, "nao-ventilo-nao-intubo": 3, laringoespasmo: 3,
      "pressao-vias-aereas": 3, "broncoespasmo-grave": 3, broncoaspiracao: 3,
      "bloqueio-neuroaxial-alto": 3, "hemorragia-pos-parto": 3, "colapso-materno": 3, "reanimacao-neonatal": 3,
      "toxicidade-anestesico-local": 3, hipercalemia: 3, "hipertermia-maligna": 3,
      "evento-sem-diagnostico": 3, "depois-da-crise": 3, "colega-afetado": 3,
      // Cartões da minuta preliminar que ainda não tinham aprovação nenhuma.
      "hipoglicemia-grave": 3, "hipotermia-perioperatoria": 3, "crise-adrenal": 3, "convulsao-perioperatoria": 3,
      "delirio-ao-despertar": 3, eclampsia: 3, "embolia-amniotica": 3, "depressao-respiratoria-opioides": 3,
      "bloqueio-neuromuscular-residual": 3,
      "incendio-sala-cirurgica": 2, "falha-oxigenio-energia": 2, "bradicardia-pediatrica": 2,
      "via-aerea-dificil-gestante": 2, "pneumotorax-hipertensivo": 2, "intubacao-esofagica-seletiva": 2,
    },
  },
  {
    // Autorizada pelo responsável médico na conversa de 05/11/2026 ("Aprovo a
    // v4 como está"), depois da conferência pelo Manual de Gestação de Alto
    // Risco (MS 2022) e pelo Protocolo 2023 da RBEHG. Ele confirmou as duas
    // escolhas da versão: ataque em 15 a 20 minutos e meia dose de manutenção
    // a partir de creatinina 1,0 mg/dL (ambas da RBEHG).
    responsavel: "Gustavo Segobia da Silva",
    crm: "CRM 49131",
    data: "2026-11-05",
    documento: "AVANEST — Eclâmpsia, versão 4: sulfato de magnésio pelo Ministério da Saúde (2022) e pela RBEHG/FEBRASGO (2023), 05/11/2026",
    protocolos: { eclampsia: 4 },
  },
  {
    // Autorizada pelo responsável médico na conversa de 05/11/2026 ("Aprovo a
    // v4 do Colapso"): o ramo "Eclâmpsia com pulso" com o mesmo magnésio da
    // Eclâmpsia 4; o resto do cartão é a versão 3.
    responsavel: "Gustavo Segobia da Silva",
    crm: "CRM 49131",
    data: "2026-11-05",
    documento: "AVANEST — Colapso materno, versão 4: magnésio do ramo da eclâmpsia igual ao da Eclâmpsia 4, 05/11/2026",
    protocolos: { "colapso-materno": 4 },
  },
];

/** A aprovação que vale para este protocolo: a da versão dele, com conteúdo até a data da aprovação. */
export const aprovacaoDe = (p: Protocolo, lista: readonly Aprovacao[] = APROVACOES): Aprovacao | undefined =>
  lista.find((a) => a.protocolos[p.id] === p.versao && p.atualizadoEm <= a.data);

export const aprovado = (p: Protocolo, lista: readonly Aprovacao[] = APROVACOES): boolean => aprovacaoDe(p, lista) !== undefined;

/** "15/10/2026". */
export const dataDaAprovacao = (a: Aprovacao) => a.data.split("-").reverse().join("/");
