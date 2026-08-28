// Que dia é hoje.
//
// A pergunta parece boba e tem uma resposta errada muito fácil de escrever:
//
//     new Date().toISOString().slice(0, 10)
//
// Isso devolve a data em GREENWICH, não a sua. Às 23h25 do dia 27 no Brasil já
// são 02h25 do dia 28 em Londres — e o calendário da escala passava a noite
// inteira marcando "hoje" no quadradinho de amanhã. Todo dia, das 21h à
// meia-noite, o sistema estava um dia à frente de quem o usa.
//
// O mesmo defeito com sinal trocado mora no servidor: a Vercel roda em UTC, e
// um `new Date()` lá é sempre o relógio de Greenwich. Ou seja, cliente e
// servidor podiam responder dias DIFERENTES para a mesma pergunta, e o painel
// renderizado no servidor discordava do calendário desenhado no navegador.
//
// Por isso o fuso aqui é FIXO em America/Sao_Paulo, e não "o fuso de quem
// abriu a tela". O plantão é no hospital, a competência é do contador
// brasileiro e o feriado é o daqui: se você abrir o sistema de Lisboa às 3h da
// manhã, o dia de trabalho que importa continua sendo o de Campo Mourão. Fuso
// fixo também é o que faz o navegador e o servidor darem a mesma resposta.
//
// O horário de verão não é problema: o Intl carrega a tabela do fuso e sabe
// sozinho quando o Brasil tinha (e deixou de ter) uma hora a mais.

/** O fuso do serviço. Uma constante, para o dia em que alguém operar de outro. */
export const FUSO = "America/Sao_Paulo";

const FORMATADOR = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false,
});

function partes(quando: Date) {
  const mapa: Record<string, string> = {};
  for (const { type, value } of FORMATADOR.formatToParts(quando)) mapa[type] = value;
  // Meia-noite sai como "24" em algumas versões do ICU e como "00" em outras.
  if (mapa.hour === "24") mapa.hour = "00";
  return mapa;
}

/**
 * A data de um instante, no fuso do serviço, em "AAAA-MM-DD".
 *
 * É o formato que o banco guarda e o que se compara com `<=` sem converter
 * nada. Sem argumento, é agora.
 */
export function dataLocal(quando: Date = new Date()) {
  const p = partes(quando);
  return `${p.year}-${p.month}-${p.day}`;
}

/** A hora de um instante, no fuso do serviço, em "HH:MM". */
export function horaLocal(quando: Date = new Date()) {
  const p = partes(quando);
  return `${p.hour}:${p.minute}`;
}

/** Hoje. É esta a função que substitui o `toISOString().slice(0, 10)`. */
export const hoje = () => dataLocal();

/** O mês corrente, em "AAAA-MM" — a competência que as telas abrem por padrão. */
export const mesAtual = () => dataLocal().slice(0, 7);

/**
 * Soma dias a uma data, sem passar por fuso nenhum.
 *
 * O caminho seguro é montar a data ao MEIO-DIA em UTC: somar 24h a uma
 * meia-noite atravessa a virada do horário de verão e cai às 23h do dia
 * anterior. Ao meio-dia sobra meio dia de folga para cada lado, e nenhum
 * país mexe o relógio doze horas.
 */
export function somarDias(iso: string | null | undefined, dias: number) {
  const base = String(iso ?? "").slice(0, 10);
  const [ano, mes, dia] = base.split("-").map(Number);
  // Coluna vazia no banco é caso comum, não erro: a data de emissão da nota só
  // existe depois de a nota sair. Devolver "" deixa a comparação seguinte dar
  // falso, em vez de um "NaN-NaN-NaN" que passaria por data válida.
  if (!ano || !mes || !dia) return base;
  const d = new Date(Date.UTC(ano, mes - 1, dia, 12));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * O último dia de um mês "AAAA-MM", para fechar um intervalo `lte`.
 *
 * `new Date(ano, mes, 0)` devolve o dia certo, mas quem o escrevia terminava a
 * linha com um `toISOString()` — que joga a data no fuso de Greenwich de novo.
 * Aqui a resposta sai do calendário, sem passar por relógio.
 */
export function ultimoDiaDoMes(mes: string) {
  const [ano, m] = String(mes).slice(0, 7).split("-").map(Number);
  if (!ano || !m) return String(mes);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return `${mes.slice(0, 7)}-${String(ultimo).padStart(2, "0")}`;
}

/**
 * Um mês "AAAA-MM" deslocado. Negativo anda para trás.
 *
 * Existe para as janelas de carregamento — "seis meses para trás" — que hoje
 * são montadas com aritmética de mês solta no meio da consulta.
 */
export function somarMeses(mes: string, meses: number) {
  const [ano, m] = String(mes).slice(0, 7).split("-").map(Number);
  if (!ano || !m) return String(mes).slice(0, 7);
  const d = new Date(Date.UTC(ano, m - 1 + meses, 1, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
