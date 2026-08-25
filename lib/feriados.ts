// ===========================================================================
// Feriados nacionais brasileiros
// ===========================================================================
// Numa escala de plantão o feriado não é enfeite de calendário: é o dia que
// paga diferente, que a equipe disputa e que o coordenador esquece de cobrir.
// Ver "25/12" e ter de lembrar sozinho que é Natal é exatamente o tipo de
// esforço que a tela existe para poupar.
//
// Nada aqui vem de serviço externo. Feriado nacional é lei publicada, não
// dado que muda: o cálculo é o mesmo para 2026 e para 2040, e uma escala que
// depende de rede para saber que 1º de maio é feriado deixa de funcionar
// exatamente no plantão em que a internet do hospital cai.
// ===========================================================================

export type TipoDeFeriado = "nacional" | "facultativo";

export type Feriado = { nome: string; tipo: TipoDeFeriado };

/** Fixos, com a lei que os criou onde ela importa. */
const FIXOS: Array<[number, number, string]> = [
  [1, 1, "Confraternização Universal"],
  [4, 21, "Tiradentes"],
  [5, 1, "Dia do Trabalho"],
  [9, 7, "Independência do Brasil"],
  [10, 12, "Nossa Senhora Aparecida"],
  [11, 2, "Finados"],
  [11, 15, "Proclamação da República"],
  // Feriado nacional desde a Lei 14.759/2023 — antes disso era municipal em
  // parte do país. O ano de corte está no código porque a escala de 2023 não
  // pode ganhar um feriado que não existia quando foi montada.
  [11, 20, "Consciência Negra"],
  [12, 25, "Natal"],
];

/**
 * Domingo de Páscoa, pelo algoritmo de Meeus/Butcher (calendário gregoriano).
 *
 * Dele saem os quatro dias móveis do ano. As contas são inteiras e sem data
 * nenhuma no meio: fuso horário não participa, e o resultado é o mesmo no
 * servidor e no celular do anestesiologista.
 */
export function domingoDePascoa(ano: number): { mes: number; dia: number } {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

/** Soma dias a uma data, sem passar por fuso: meio-dia trava o horário de verão. */
function somarDias(ano: number, mes: number, dia: number, dias: number): string {
  const d = new Date(Date.UTC(ano, mes - 1, dia, 12));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Todos os feriados do ano, por data.
 *
 * Carnaval e Corpus Christi entram como FACULTATIVO, que é o que eles são na
 * lei federal — e entram porque numa escala hospitalar eles pesam como
 * feriado: o centro cirúrgico roda em escala reduzida e a disputa por quem
 * cobre é a mesma. Chamá-los de feriado seria dizer uma coisa que a lei não
 * diz; escondê-los seria esconder o dia mais difícil de cobrir do ano.
 */
export function feriadosDoAno(ano: number): Map<string, Feriado> {
  const mapa = new Map<string, Feriado>();

  for (const [mes, dia, nome] of FIXOS) {
    if (nome === "Consciência Negra" && ano < 2024) continue;
    mapa.set(iso(ano, mes, dia), { nome, tipo: "nacional" });
  }

  const { mes, dia } = domingoDePascoa(ano);
  const moveis: Array<[number, string, TipoDeFeriado]> = [
    [-48, "Carnaval", "facultativo"],
    [-47, "Carnaval", "facultativo"],
    [-2, "Sexta-feira Santa", "nacional"],
    [60, "Corpus Christi", "facultativo"],
  ];
  for (const [desloca, nome, tipo] of moveis) {
    mapa.set(somarDias(ano, mes, dia, desloca), { nome, tipo });
  }

  return mapa;
}

/**
 * Os feriados que interessam a um mês "AAAA-MM".
 *
 * Recebe o mês, e não o ano, porque o calendário desenha um mês por vez — e
 * porque a virada de dezembro para janeiro exige os dois anos: um plantão de
 * 31/12 que atravessa a meia-noite encosta no 1º de janeiro.
 */
export function feriadosDoMes(mes: string): Map<string, Feriado> {
  const ano = Number(mes.slice(0, 4));
  if (!Number.isFinite(ano) || ano < 1900 || ano > 2200) return new Map();
  const todos = new Map([...feriadosDoAno(ano - 1), ...feriadosDoAno(ano), ...feriadosDoAno(ano + 1)]);
  const doMes = new Map<string, Feriado>();
  for (const [data, feriado] of todos) {
    if (data.startsWith(mes)) doMes.set(data, feriado);
  }
  return doMes;
}
