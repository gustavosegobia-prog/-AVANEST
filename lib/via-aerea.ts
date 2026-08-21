// Contagem de preditores de via aérea difícil.
//
// Isto existe porque a conta estava escrita duas vezes: uma na tela da
// avaliação e outra na hora de imprimir — e as duas discordavam. A tela somava
// os preditores marcados MAIS os achados do exame (Mallampati III/IV, abertura
// oral pequena, distância tireomentoniana curta, mobilidade cervical reduzida,
// prótese ou alterações dentárias). A ficha impressa somava só os preditores
// marcados.
//
// O resultado apareceu numa ficha de verdade: paciente com Mallampati IV,
// mobilidade cervical reduzida e radioterapia cervical prévia. Na tela, três
// preditores e "Alta". No papel, "Moderada (1 preditor)" — porque só a
// radioterapia estava guardada como `via_*`. Quem lesse só a ficha via um
// paciente menos grave do que quem preencheu tinha visto.
//
// Agora a conta mora aqui, e a tela e o papel leem a mesma.
//
// Vale repetir o que a tela já diz em voz alta: isto é apoio, não veredito. A
// resposta que vale é `via_aerea_dificil`, respondida por quem vai intubar.

export type CamposViaAerea = Record<string, unknown>;

// Marcados como caixinhas na tela, gravados como `via_<nome>` = true.
export const PREDITORES_VIA_AEREA = [
  "Retrognatia/micrognatia",
  "Macroglossia",
  "Pescoço curto",
  "Barba",
  "Massa cervical",
  "Radioterapia cervical prévia",
  "Cirurgia cervical prévia",
  "História de intubação difícil",
  "Dificuldade de ventilação prévia",
  "Traqueostomia",
  "Apneia do sono",
] as const;

// Achados do exame da via aérea que contam como preditor. Só as respostas
// listadas contam: Mallampati I e II, abertura oral > 4 cm e mobilidade normal
// não são preditor nenhum.
//
// "Edentado" de propósito fora: falta de dentes atrapalha a ventilação sob
// máscara, mas costuma facilitar a laringoscopia. Somar como preditor de
// intubação difícil seria decidir uma coisa controversa numa tabela.
export const ACHADOS_QUE_CONTAM: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["mallampati", ["Classe III", "Classe IV"]],
  ["abertura_oral", ["< 3 cm"]],
  ["distancia_tireo", ["< 6 cm"]],
  ["mobilidade", ["Reduzida", "Muito reduzida"]],
  ["denticao", ["Prótese removível", "Alterações dentárias"]],
] as const;

// O mesmo nome que a tela usa para gravar a caixinha. Fica junto da lista para
// não haver duas versões da regra de conversão.
export function chavePreditor(item: string): string {
  return `via_${item.toLowerCase().replace(/\W+/g, "_")}`;
}

export function preditoresMarcados(dados: CamposViaAerea): string[] {
  return PREDITORES_VIA_AEREA.filter((item) => dados[chavePreditor(item)] === true);
}

export function achadosQueContam(dados: CamposViaAerea): string[] {
  return ACHADOS_QUE_CONTAM
    .filter(([campo, valores]) => valores.includes(String(dados[campo] ?? "")))
    .map(([campo]) => campo);
}

export function contarPreditores(dados: CamposViaAerea): number {
  return preditoresMarcados(dados).length + achadosQueContam(dados).length;
}

// No feminino porque na tela a palavra que vem depois é "probabilidade":
// "Alta probabilidade sugerida de via aérea difícil".
export type RiscoViaAerea = "Baixa" | "Moderada" | "Alta";

export function riscoViaAerea(quantidade: number): RiscoViaAerea {
  if (quantidade === 0) return "Baixa";
  return quantidade <= 2 ? "Moderada" : "Alta";
}

// Na ficha impressa o rótulo é "Risco sugerido", e risco é masculino: ali sai
// "Alto", não "Alta". É a mesma classificação, escrita para concordar com a
// palavra que a antecede — por isso duas formas, e não duas contas.
const NO_MASCULINO = { Baixa: "Baixo", Moderada: "Moderado", Alta: "Alto" } as const;

export function riscoNoMasculino(risco: RiscoViaAerea): "Baixo" | "Moderado" | "Alto" {
  return NO_MASCULINO[risco];
}

// "3 preditor(es)" é jeito de planilha, não de documento clínico. O número é
// conhecido na hora de escrever a frase, então não há motivo para empurrar a
// escolha do plural para quem lê.
export function frasePreditores(quantidade: number): string {
  return quantidade === 1 ? "1 preditor" : `${quantidade} preditores`;
}

export function frasePreditoresMarcados(quantidade: number): string {
  return quantidade === 1 ? "1 preditor marcado" : `${quantidade} preditores marcados`;
}

export function resumoViaAerea(dados: CamposViaAerea): {
  preditores: string[];
  achados: string[];
  total: number;
  risco: RiscoViaAerea;
} {
  const preditores = preditoresMarcados(dados);
  const achados = achadosQueContam(dados);
  const total = preditores.length + achados.length;
  return { preditores, achados, total, risco: riscoViaAerea(total) };
}
