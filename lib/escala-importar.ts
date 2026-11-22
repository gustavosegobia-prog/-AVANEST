// IMPORTAR A ESCALA QUE O MÉDICO RECEBE (20/11/2026: "se o dr receber algum
// arquivo de escala com os plantões dele, ele consegue enviar para o site e o
// site jogar para a escala dele?").
//
// O arquivo é lido no próprio aparelho — planilha, PDF ou foto, pelo mesmo
// leitor do mapa cirúrgico (components/centro/ler-arquivo.ts) — e chega aqui
// como LINHAS de células com posição. As escalas que circulam vêm de três
// jeitos, e os três entram:
//
//  1. GRADE: os médicos nas linhas, os dias do mês nas colunas e, na célula, o
//     turno ("D", "N", "M", "T", "24", "7-19"). Também deitada: os dias nas
//     linhas e os médicos nas colunas.
//  2. POR DIA: uma linha por dia (a data na primeira coluna), os turnos nas
//     colunas e, nas células, o NOME de quem está em cada um.
//  3. LISTA: cada linha um plantão — data, nome e horário.
//
// Nada aqui grava. A tela mostra o que foi lido, a pessoa diz qual nome é o
// dela, confere o horário de cada sigla e escolhe o que entra.

import { distancia, normalizar, type Palavra } from "./centro-importar.ts";

export type Celula = { t: string; x0: number; x1: number };
export type Linha = Celula[];
export type Horario = { inicio: string; fim: string };

/** A planilha (.xlsx ou .csv): a posição da célula é a coluna. */
export function linhasDaGrade(grade: readonly (readonly string[])[]): Linha[] {
  return grade
    .map((l) => l.map((t, c) => ({ t: String(t ?? "").replace(/\s+/g, " ").trim(), x0: c, x1: c + 1 })).filter((c) => c.t))
    .filter((l) => l.length > 0);
}

/**
 * O PDF e a foto: palavras soltas. Viram linhas pela altura (o centro dentro
 * de meia letra da linha) e células pelo vão — palavras a menos de 0,6 letra
 * uma da outra são a mesma célula ("Dr." "Fulano"), mais longe que isso são a
 * coluna seguinte.
 */
export function linhasDePalavras(palavras: readonly Palavra[]): Linha[] {
  const ps = palavras.filter((p) => p.t.trim())
    .map((p) => ({ ...p, yc: (p.y0 + p.y1) / 2, h: Math.max(1, p.y1 - p.y0) }))
    .sort((a, b) => a.yc - b.yc);
  const grupos: (typeof ps)[] = [];
  for (const p of ps) {
    const g = grupos[grupos.length - 1];
    if (g) {
      const yc = g.reduce((s, x) => s + x.yc, 0) / g.length;
      const h = g.reduce((s, x) => s + x.h, 0) / g.length;
      if (Math.abs(p.yc - yc) <= Math.max(h, p.h) * 0.5) { g.push(p); continue; }
    }
    grupos.push([p]);
  }
  return grupos.map((g) => {
    const ordem = [...g].sort((a, b) => a.x0 - b.x0);
    const h = ordem.reduce((s, x) => s + x.h, 0) / ordem.length;
    const celulas: Celula[] = [];
    for (const p of ordem) {
      const ultima = celulas[celulas.length - 1];
      if (ultima && p.x0 - ultima.x1 < h * 0.6) {
        ultima.t = `${ultima.t} ${p.t.trim()}`;
        ultima.x1 = Math.max(ultima.x1, p.x1);
      } else celulas.push({ t: p.t.trim(), x0: p.x0, x1: p.x1 });
    }
    return celulas;
  });
}

// ─── Turnos e horários ──────────────────────────────────────────────────────

const hh = (h: number, m = 0) => `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/**
 * Um horário escrito: "07-19", "7h às 19h", "19x7", "07:00 - 13:00",
 * "19h/07h". Devolve nulo para o que não é horário (inclusive datas: "05/11"
 * não é das 5 às 11).
 */
export function horarioDoTexto(texto: string): Horario | null {
  const t = normalizar(texto);
  const m = t.match(/(?:^|[^\d/])(\d{1,2})(?:[:h](\d{2}))?\s*h?\s*(?:[-–—x]|\s(?:as|a|ate)\s|h\/)\s*(\d{1,2})(?:[:h](\d{2}))?\s*h?(?![\d/])/);
  if (!m) return null;
  const [h1, m1, h2, m2] = [Number(m[1]), Number(m[2] ?? 0), Number(m[3]), Number(m[4] ?? 0)];
  if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return null;
  return { inicio: hh(h1, m1), fim: hh(h2, m2) };
}

/** As siglas e os nomes de turno que as escalas usam, com o horário de costume. */
const SIGLAS: Array<[RegExp, Horario]> = [
  [/^(24|24h|24hs|24 ?horas|p24|plantao 24h?|dn|d\/n|d\+n|mtn)$/, { inicio: "07:00", fim: "07:00" }],
  [/^(d|dia|diurno|diurna|sd|pd|md|mt|m\/t|12|12h|12hs|p|pl|plantao|plantao diurno|plantao dia)$/, { inicio: "07:00", fim: "19:00" }],
  [/^(n|noite|noturno|noturna|sn|pn|nt|plantao noturno|plantao noite)$/, { inicio: "19:00", fim: "07:00" }],
  [/^(m|manha|mat|matutino|matutina)$/, { inicio: "07:00", fim: "13:00" }],
  [/^(t|tarde|vesp|vespertino|vespertina)$/, { inicio: "13:00", fim: "19:00" }],
  [/^(tn|t\/n|tarde e noite|tarde\/noite)$/, { inicio: "13:00", fim: "07:00" }],
];

/** Folga, férias, atestado, traço: o dia em branco da escala. */
const FOLGA = /^(f|fo|fl|fg|folga|fe|fer|ferias|off|at|atestado|lic|licenca|ausente|-+|—|–|\.|0|\*)$/;

const sigla = (t: string) => normalizar(t).replace(/[()]/g, "").replace(/\s+/g, " ").trim();

/** O horário de costume de uma sigla ("N" → 19:00–07:00), ou nulo se a sigla não é conhecida. */
export function horarioDaSigla(codigo: string, legenda: Readonly<Record<string, Horario>> = {}): Horario | null {
  const s = sigla(codigo);
  if (legenda[s]) return legenda[s];
  const escrito = horarioDoTexto(codigo);
  if (escrito) return escrito;
  for (const [re, h] of SIGLAS) if (re.test(s)) return h;
  // "Diurno (07-19)", "Noturno 12h": a primeira palavra decide.
  const primeira = s.split(" ")[0];
  for (const [re, h] of SIGLAS) if (primeira && primeira !== s && primeira.length > 1 && re.test(primeira)) return h;
  return null;
}

export const ehFolga = (t: string) => FOLGA.test(sigla(t)) || /^(folga|ferias|atestado|licenca)\b/.test(sigla(t));

/**
 * A legenda que a própria escala traz embaixo ("D = 07h às 19h", "N: 19-7").
 * Ela manda sobre o costume: cada serviço tem o seu.
 */
export function legendaDasLinhas(linhas: readonly Linha[]): Record<string, Horario> {
  const legenda: Record<string, Horario> = {};
  for (const l of linhas) {
    for (const c of [...l.map((x) => x.t), l.map((x) => x.t).join(" ")]) {
      const re = /(?:^|[\s;,|])([a-z]{1,3}\d{0,2})\s*[=:]\s*([^;,|=]*?\d{1,2}(?:[:h]\d{2})?\s*h?\s*(?:[-–—x]|\s(?:as|a|ate)\s)\s*\d{1,2}(?:[:h]\d{2})?\s*h?)/g;
      for (const m of normalizar(c).matchAll(re)) {
        const h = horarioDoTexto(m[2]);
        if (h && !legenda[m[1]]) legenda[m[1]] = h;
      }
    }
  }
  return legenda;
}

/**
 * Os turnos de uma célula. Uma célula pode ter dois ("D/N", "M T") — e turnos
 * emendados viram um só: "D/N" é o plantão de 24 horas, e não dois plantões
 * que começam e terminam às 19:00.
 */
export function turnosDaCelula(texto: string, legenda: Readonly<Record<string, Horario>> = {}): Array<{ codigo: string; horario: Horario | null }> {
  let t = texto.trim();
  if (!t || ehFolga(t)) return [];
  // A foto lê a barra de "D/N" como I, l, 1 ou |: "DIN" é "D/N".
  if (!horarioDaSigla(t, legenda) && /^[a-z][il1|][a-z]$/i.test(t)) t = `${t[0]}/${t[2]}`;
  const inteiro = horarioDaSigla(t, legenda);
  if (inteiro) return [{ codigo: t, horario: inteiro }];
  const partes = t.split(/[\s/+,;&]+/).filter((p) => p && !ehFolga(p));
  if (partes.length <= 1) return [{ codigo: t, horario: null }];
  const lidas = partes.map((p) => ({ codigo: p, horario: horarioDaSigla(p, legenda) }));
  if (lidas.some((x) => !x.horario)) return [{ codigo: t, horario: null }];
  const juntas: Array<{ codigo: string; horario: Horario }> = [];
  for (const x of lidas as Array<{ codigo: string; horario: Horario }>) {
    const ultimo = juntas[juntas.length - 1];
    if (ultimo && ultimo.horario.fim === x.horario.inicio) {
      ultimo.codigo = `${ultimo.codigo}/${x.codigo}`;
      ultimo.horario = { inicio: ultimo.horario.inicio, fim: x.horario.fim };
    } else juntas.push({ ...x });
  }
  return juntas;
}

// ─── Nomes ──────────────────────────────────────────────────────────────────

const FORA_DO_NOME = new Set(["dr", "dra", "de", "da", "do", "das", "dos", "e"]);
const palavrasDoNome = (s: string) =>
  normalizar(s).replace(/[^a-z0-9 ]/g, " ").split(" ").filter((w) => w && !FORA_DO_NOME.has(w));

/**
 * O nome bate? Toda palavra de quem se procura precisa aparecer — inteira, com
 * uma letra trocada (a foto erra) ou como inicial ("Fulano S.") —, e ao menos
 * uma inteira.
 */
export function casaNome(texto: string, pessoa: string): boolean {
  const alvo = palavrasDoNome(pessoa);
  const ws = palavrasDoNome(texto);
  if (!alvo.length || !ws.length) return false;
  let inteiras = 0;
  for (const a of alvo) {
    if (ws.some((w) => w === a || (a.length >= 5 && w.length >= 5 && distancia(w, a) <= 1))) { inteiras++; continue; }
    if (ws.some((w) => (w.length === 1 && w === a[0]) || (a.length === 1 && w[0] === a))) continue;
    return false;
  }
  return inteiras > 0;
}

/** Os nomes de uma célula que tem mais de um ("Ana / Bruno", "Ana e Bruno"). */
export function nomesDaCelula(texto: string): string[] {
  return texto.split(/\s*(?:\/|,|;|\+|\||\s-\s|\se\s)\s*/i).map((s) => s.trim()).filter((s) => parecerNome(s));
}

function parecerNome(s: string): boolean {
  const n = normalizar(s);
  if (n.length < 3 || !/[a-z]{2}/.test(n)) return false;
  if (horarioDaSigla(s) || ehFolga(s) || dataDaCelula(s)) return false;
  return !/^(data|dia|dias|plantao|plantoes|escala|turno|turnos|horario|inicio|fim|medico|medicos|medico\(a\)|nome|nomes|anestesista|anestesistas|plantonista|plantonistas|profissional|profissionais|responsavel|local|hospital|setor|obs|observacao|observacoes|total|semana|mes)$/.test(n);
}

/**
 * O quanto um nome da escala parece o nome de um cadastro. Conta as palavras
 * da escala que estão no cadastro (inteiras valem 1, iniciais meio, uma letra
 * trocada 0,8) e desconta as que sobram — "Fulano Beltrano" não é "Fulano
 * Ciclano". O apelido da escala do grupo, quando bate inteiro, vale mais que
 * qualquer nome.
 */
export function notaDoNome(daEscala: string, nome: string, apelido?: string | null): number {
  if (apelido && normalizar(apelido) === normalizar(daEscala)) return 100;
  const doCadastro = palavrasDoNome(nome);
  let n = 0;
  for (const w of palavrasDoNome(daEscala)) {
    if (doCadastro.includes(w)) n += 1;
    else if (w.length === 1 && doCadastro.some((c) => c[0] === w)) n += 0.5;
    else if (w.length >= 5 && doCadastro.some((c) => c.length >= 5 && distancia(c, w) <= 1)) n += 0.8;
    else n -= 0.6;
  }
  return n;
}

/** Qual dos nomes da escala é a pessoa que está importando (nota 1 ou mais), ou nulo. */
export function sugerirPessoa(pessoas: readonly string[], nome: string, apelido?: string | null): string | null {
  let melhor: string | null = null, nota = 0;
  for (const p of pessoas) {
    const n = notaDoNome(p, nome, apelido);
    if (n > nota) { nota = n; melhor = p; }
  }
  return nota >= 1 ? melhor : null;
}

/**
 * A escala do GRUPO (22/11/2026): qual colega do cadastro é cada nome da
 * escala. O de nota maior, desde que 1 ou mais; empate entre dois colegas não
 * escolhe ninguém — "Dr. Fulano" com dois Fulanos na equipe é a pessoa quem
 * decide. Dois nomes da escala podem dar no mesmo colega (ele aparece em duas
 * tabelas, escrito de dois jeitos).
 */
export function colegaDaPessoa(
  pessoa: string, colegas: ReadonlyArray<{ id: string; nome: string; apelido?: string | null }>,
): string | null {
  const notas = colegas.map((c) => ({ id: c.id, n: notaDoNome(pessoa, c.nome, c.apelido) }))
    .filter((x) => x.n >= 1).sort((a, b) => b.n - a.n);
  if (!notas.length || (notas[1] && notas[1].n === notas[0].n)) return null;
  return notas[0].id;
}

// ─── Datas ──────────────────────────────────────────────────────────────────

type DataLida = { dia: number; mes: number | null; ano: number | null; resto: string };

const SEMANA = "(?:dom|seg|ter|qua|qui|sex|sab)[a-z]*(?:-feira)?";

/** A data no começo de uma célula: "05/11", "05/11/2026", "seg 05", "05 seg", ou a data da planilha (46331). */
export function dataDaCelula(texto: string): DataLida | null {
  const t = normalizar(texto);
  const serial = t.match(/^(\d{5})(?:\.0+)?$/);
  if (serial) {
    const n = Number(serial[1]);
    if (n < 40000 || n > 60000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return { dia: d.getUTCDate(), mes: d.getUTCMonth() + 1, ano: d.getUTCFullYear(), resto: "" };
  }
  let m = t.match(new RegExp(`^(?:${SEMANA}[\\s,.-]*)?(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2,4}))?(?![\\d:h])(.*)$`))
    ?? t.match(new RegExp(`^(?:${SEMANA}[\\s,.-]*)?(\\d{1,2})-(\\d{1,2})-(\\d{4})(.*)$`));
  if (m) {
    const [dia, mes] = [Number(m[1]), Number(m[2])];
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
    return { dia, mes, ano, resto: tirarSemana(m[4]) };
  }
  m = t.match(new RegExp(`^${SEMANA}[\\s,.-]*(\\d{1,2})(?![\\d:h/])(.*)$`))
    ?? t.match(new RegExp(`^(\\d{1,2})[\\s,.-]*${SEMANA}\\b(.*)$`));
  if (m) {
    const dia = Number(m[1]);
    return dia >= 1 && dia <= 31 ? { dia, mes: null, ano: null, resto: tirarSemana(m[2]) } : null;
  }
  return null;
}

const tirarSemana = (s: string) => s.replace(new RegExp(`^[\\s,.-]*(?:${SEMANA})?[\\s,.-]*`), "").trim();

const NOMES_DOS_MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** O mês que a escala diz ser ("ESCALA DE DEZEMBRO 2026", "12/2026", "dez/26"), do alto para baixo. */
export function mesDasLinhas(linhas: readonly Linha[]): { mes: number; ano: number | null } | null {
  for (const l of linhas) {
    const t = normalizar(l.map((c) => c.t).join(" "));
    const porNome = t.match(new RegExp(`\\b(${NOMES_DOS_MESES.join("|")})\\b(?:\\D{0,6}(\\d{4}))?`));
    if (porNome) return { mes: NOMES_DOS_MESES.indexOf(porNome[1]) + 1, ano: porNome[2] ? Number(porNome[2]) : null };
    const curto = t.match(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[/\-. ](\d{2}|\d{4})\b/);
    if (curto) {
      const i = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"].indexOf(curto[1]);
      return { mes: i + 1, ano: curto[2].length === 2 ? 2000 + Number(curto[2]) : Number(curto[2]) };
    }
    const numerico = t.match(/(?:^|[^\d/])(\d{1,2})\/(\d{4})(?!\d)/);
    if (numerico && Number(numerico[1]) >= 1 && Number(numerico[1]) <= 12) return { mes: Number(numerico[1]), ano: Number(numerico[2]) };
  }
  return null;
}

/** "2026-12" + 1 mês → "2027-01". */
function somarMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A data inteira, ou nula se o dia não existe naquele mês (31/11). */
function dataISO(ano: number, mes: number, dia: number): string | null {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCMonth() === mes - 1 ? `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}` : null;
}

/** O ano de um dia/mês sem ano: o que deixa a data mais perto do mês da escala. */
function anoMaisPerto(mes: number, base: string): number {
  const [a, m] = base.split("-").map(Number);
  const candidatos = [a - 1, a, a + 1];
  return candidatos.sort((x, y) => Math.abs((x - a) * 12 + mes - m) - Math.abs((y - a) * 12 + mes - m))[0];
}

// ─── A escala lida ──────────────────────────────────────────────────────────

/**
 * Uma célula da escala ligada a um dia. `mesRel` é para a grade que só tem o
 * número do dia: 0 no mês da escala, 1 depois de a numeração voltar a 1 (a
 * escala de 21/11 a 20/12).
 */
type Entrada = {
  pessoa: string | null;
  data: DataLida & { mesRel: number };
  texto: string;
  coluna: string | null;
  /** O turno escrito em outra célula da mesma linha (a lista: "Início", "Fim", "Turno"). */
  daLinha: { codigo: string; horario: Horario } | null;
};

export type EscalaLida = {
  formato: "grade" | "por-dia";
  /** O mês escrito no arquivo, quando há ("2026-12"). */
  mes: string | null;
  /** Como cada nome aparece na escala, do que mais aparece para o que menos. */
  pessoas: string[];
  legenda: Record<string, Horario>;
  entradas: Entrada[];
};

const centro = (c: Celula) => (c.x0 + c.x1) / 2;

/** A célula do cabeçalho de dias: "5", "05", "05/11", "5 seg", "S 5". */
function diaDoCabecalho(t: string): { dia: number; mes: number | null } | null {
  const s = normalizar(t).replace(new RegExp(SEMANA, "g"), " ").replace(/\b[dstqsx]\b/g, " ").replace(/\s+/g, " ").trim();
  const m = s.match(/^(\d{1,2})(?:\/(\d{1,2}))?$/);
  if (!m) return null;
  const dia = Number(m[1]), mes = m[2] ? Number(m[2]) : null;
  if (dia < 1 || dia > 31 || (mes !== null && (mes < 1 || mes > 12))) return null;
  return { dia, mes };
}

/** A linha dos dias da grade: sete ou mais dias em sequência. */
function cabecalhoDeDias(l: Linha): Array<{ x: number; dia: number; mes: number | null; mesRel: number }> | null {
  // "1 2 3" grudados numa célula só (PDF apertado) são separados.
  const pedacos: Celula[] = [];
  for (const c of l) {
    const ts = c.t.split(/\s+/);
    if (ts.length > 1 && ts.every((x) => /^\d{1,2}$/.test(x))) {
      const passo = (c.x1 - c.x0) / ts.length;
      ts.forEach((x, i) => pedacos.push({ t: x, x0: c.x0 + i * passo, x1: c.x0 + (i + 1) * passo }));
    } else pedacos.push(c);
  }
  const dias = pedacos.map((c) => ({ c, d: diaDoCabecalho(c.t) })).filter((x) => x.d);
  if (dias.length < 7) return null;
  let seguidos = 0, mesRel = 0;
  const ancoras = dias.map((x, i) => {
    const ant = dias[i - 1]?.d;
    if (ant && (x.d!.dia === ant.dia + 1 || (ant.dia >= 28 && x.d!.dia === 1))) seguidos++;
    if (ant && x.d!.dia < ant.dia) mesRel++;
    return { x: centro(x.c), dia: x.d!.dia, mes: x.d!.mes, mesRel };
  });
  return seguidos >= (dias.length - 1) * 0.7 ? ancoras : null;
}

function maisPerto<T extends { x: number }>(ancoras: readonly T[], x: number, folga: number): T | null {
  let melhor: T | null = null, d = Infinity;
  for (const a of ancoras) {
    const dx = Math.abs(a.x - x);
    if (dx < d) { d = dx; melhor = a; }
  }
  return d <= folga ? melhor : null;
}

/** A linha "S T Q Q S S D" (ou "seg ter qua…") embaixo dos dias: não é ninguém. */
function linhaDaSemana(celulas: readonly Celula[]): boolean {
  const vs = celulas.map((c) => normalizar(c.t));
  const semana = vs.filter((v) => new RegExp(`^(?:[dstq]|${SEMANA})$`).test(v));
  return vs.length >= 5 && semana.length === vs.length && new Set(semana).size >= 3;
}

/** Um horário solto: "07:00", "7h", "19h30", ou a fração de dia da planilha (0.2916… = 07:00). */
function horaSolta(t: string): string | null {
  const s = normalizar(t);
  const m = s.match(/^(\d{1,2})(?::(\d{2})|h(\d{2})?)$/);
  if (m) {
    const h = Number(m[1]), mi = Number(m[2] ?? m[3] ?? 0);
    return h <= 24 && mi <= 59 ? hh(h, mi) : null;
  }
  const f = s.match(/^0?[.,](\d+)$/);
  if (f) {
    const minutos = Math.round(Number(`0.${f[1]}`) * 1440);
    return hh(Math.floor(minutos / 60), minutos % 60);
  }
  return null;
}

/**
 * O turno de uma linha da lista, escrito fora da célula do nome: um horário
 * inteiro ("07-19"), início e fim em células separadas, ou a sigla do turno.
 */
function turnoDaLinha(celulas: readonly Celula[], legenda: Readonly<Record<string, Horario>>): { codigo: string; horario: Horario } | null {
  for (const c of celulas) {
    const h = horarioDoTexto(c.t);
    if (h) return { codigo: pegarHorario(c.t), horario: h };
  }
  const soltas = celulas.map((c) => horaSolta(c.t)).filter((x): x is string => x !== null);
  if (soltas.length >= 2) return { codigo: `${soltas[0]}–${soltas[1]}`, horario: { inicio: soltas[0], fim: soltas[1] } };
  for (const c of celulas) {
    if (c.t.trim().length > 12) continue;
    const h = horarioDaSigla(c.t, legenda);
    if (h) return { codigo: c.t.trim(), horario: h };
  }
  return null;
}

/**
 * A FOTO EMENDA COLUNAS: o OCR lê "F T D N" de quatro dias vizinhos como uma
 * palavra só, "FTDN". Uma célula sem espaço quase da largura de uma coluna, ou
 * mais, é repartida letra a letra pela coluna em que cada letra cai — e só é
 * repartida se as letras caírem mesmo em colunas diferentes: "12h" dentro de
 * um dia continua "12h". Na planilha nada se reparte, porque lá cada célula é
 * uma coluna.
 */
function separarColunas(celulas: readonly Celula[], ancoras: ReadonlyArray<{ x: number }>, passo: number): Celula[] {
  return celulas.flatMap((c) => {
    const t = c.t.trim();
    if (c.x1 - c.x0 <= passo * 0.9 || t.replace(/\s+/g, "").length < 2) return [c];
    // Os pedaços, cada um na posição que ocupa no texto: com espaço, cada
    // palavra ("D/N D/N", "D D" de dois dias vizinhos que o PDF apertado juntou);
    // sem espaço, cada letra ("FTDN" da foto) — menos a sigla com barra, que é
    // um plantão só.
    const pedacos: Array<{ t: string; i: number }> = [];
    if (/\s/.test(t)) {
      let i = 0;
      for (const w of t.split(/(\s+)/)) { if (w.trim()) pedacos.push({ t: w, i }); i += w.length; }
    } else if (!/[/+]/.test(t)) [...t].forEach((letra, i) => pedacos.push({ t: letra, i }));
    else return [c];
    const largura = (c.x1 - c.x0) / t.length;
    const juntar = /\s/.test(t) ? " " : "";
    const porColuna = new Map<number, Celula>();
    for (const p of pedacos) {
      const x0 = c.x0 + p.i * largura, x1 = x0 + p.t.length * largura;
      const a = maisPerto(ancoras, (x0 + x1) / 2, Infinity);
      if (!a) continue;
      const g = porColuna.get(a.x);
      porColuna.set(a.x, g ? { t: g.t + juntar + p.t, x0: g.x0, x1 } : { t: p.t, x0, x1 });
    }
    return porColuna.size > 1 ? [...porColuna.values()] : [c];
  });
}

/** A grade: médicos nas linhas, dias nas colunas. */
function lerGrade(linhas: readonly Linha[]): Entrada[] | null {
  const entradas: Entrada[] = [];
  let ancoras: ReturnType<typeof cabecalhoDeDias> = null;
  let achou = false;
  for (const l of linhas) {
    const novo = cabecalhoDeDias(l);
    if (novo) { ancoras = novo; achou = true; continue; }
    if (!ancoras) continue;
    const passo = (ancoras[ancoras.length - 1].x - ancoras[0].x) / Math.max(1, ancoras.length - 1);
    const limite = ancoras[0].x - passo * 0.6;
    const rotulo = l.filter((c) => centro(c) < limite).map((c) => c.t).join(" ")
      .replace(/^\d{1,3}[\s.)-]+/, "").trim();
    if (!parecerNome(rotulo) || linhaDaSemana(l.filter((c) => centro(c) >= limite))) continue;
    for (const c of separarColunas(l.filter((c) => centro(c) >= limite), ancoras, passo)) {
      const a = maisPerto(ancoras, centro(c), passo * 0.6);
      if (!a) continue;
      entradas.push({ pessoa: rotulo, data: { dia: a.dia, mes: a.mes, ano: null, resto: "", mesRel: a.mesRel }, texto: c.t, coluna: null, daLinha: null });
    }
  }
  return achou ? entradas : null;
}

/** Por dia (e a lista): uma data no começo da linha. */
function lerPorDia(linhas: readonly Linha[], legenda: Readonly<Record<string, Horario>>): Entrada[] | null {
  const comData = linhas.map((l) => {
    for (let i = 0; i < Math.min(2, l.length); i++) {
      const d = dataDaCelula(l[i].t);
      if (d) {
        // O índice da linha, antes da data, não é célula da escala.
        const celulas = l.slice(i + 1);
        if (d.resto) celulas.unshift({ t: d.resto, x0: l[i].x0, x1: l[i].x1 });
        return { data: d, celulas, x: l[i].x1 };
      }
      if (!/^\d{1,3}$/.test(l[i].t)) break;
    }
    return null;
  });
  if (comData.filter(Boolean).length < 2) return null;

  // O cabeçalho das colunas: a última linha sem data, com duas células ou
  // mais, antes da primeira linha com data.
  const primeira = comData.findIndex(Boolean);
  let cabecalho: Array<{ x: number; t: string }> = [];
  for (let i = primeira - 1; i >= 0; i--) {
    if (linhas[i].length >= 2) {
      cabecalho = linhas[i].filter((c) => !/^(data|dia|dias|datas)$/.test(normalizar(c.t))).map((c) => ({ x: centro(c), t: c.t }));
      break;
    }
  }
  const largura = cabecalho.length > 1
    ? Math.max(...cabecalho.slice(1).map((c, i) => c.x - cabecalho[i].x)) : Infinity;

  const entradas: Entrada[] = [];
  for (const linha of comData) {
    if (!linha) continue;
    const daLinha = turnoDaLinha(linha.celulas, legenda);
    for (const c of linha.celulas) {
      const col = cabecalho.length ? maisPerto(cabecalho, centro(c), largura) : null;
      entradas.push({ pessoa: null, data: { ...linha.data, mesRel: 0 }, texto: c.t, coluna: col?.t ?? null, daLinha });
    }
  }
  return entradas;
}

const ehSigla = (t: string) => {
  const s = sigla(t);
  return ehFolga(t) || Boolean(horarioDaSigla(t)) || (s.length <= 4 && !/\s/.test(s));
};

/** Lê a escala inteira, sem saber ainda quem a pessoa é. */
export function lerEscala(linhas: readonly Linha[]): EscalaLida | null {
  const legenda = legendaDasLinhas(linhas);
  const achado = mesDasLinhas(linhas);
  const mesDoArquivo = achado?.ano ? `${achado.ano}-${String(achado.mes).padStart(2, "0")}` : null;
  const contar = (nomes: string[]) => {
    const n = new Map<string, { nome: string; vezes: number }>();
    for (const nome of nomes) {
      const k = normalizar(nome);
      const atual = n.get(k);
      n.set(k, { nome: atual?.nome ?? nome, vezes: (atual?.vezes ?? 0) + 1 });
    }
    return [...n.values()].sort((a, b) => b.vezes - a.vezes).map((x) => x.nome);
  };

  const grade = lerGrade(linhas);
  if (grade && grade.length) {
    return { formato: "grade", mes: mesDoArquivo, pessoas: contar(grade.map((e) => e.pessoa!)), legenda, entradas: grade };
  }
  const porDia = lerPorDia(linhas, legenda);
  if (!porDia || !porDia.length) return null;
  // Grade deitada: uma coluna cujas células são siglas tem um NOME no
  // cabeçalho; as outras têm o turno no cabeçalho e nomes nas células.
  const colunas = new Map<string, Entrada[]>();
  for (const e of porDia) if (e.coluna) colunas.set(e.coluna, [...(colunas.get(e.coluna) ?? []), e]);
  const nomesDeColuna = [...colunas].filter(([nome, es]) => parecerNome(nome) && !horarioDaSigla(nome)
    && es.filter((e) => ehSigla(e.texto)).length >= es.length * 0.7).map(([nome]) => nome);
  for (const e of porDia) if (e.coluna && nomesDeColuna.includes(e.coluna)) e.pessoa = e.coluna;
  const nomesDasCelulas = porDia.filter((e) => !e.pessoa).flatMap((e) => nomesDaCelula(e.texto));
  return { formato: "por-dia", mes: mesDoArquivo, pessoas: [...contar(nomesDasCelulas), ...nomesDeColuna], legenda, entradas: porDia };
}

export type PlantaoLido = {
  data: string;
  /** Como estava na escala: a sigla, o horário ou o nome da coluna. */
  codigo: string;
  /** O horário que a escala diz; nulo quando a sigla não é conhecida (a tela pergunta). */
  horario: Horario | null;
};

/**
 * Os plantões de uma pessoa. `mesBase` ("2026-12") é o mês da escala — o do
 * arquivo, ou o que a pessoa escolheu — e completa as datas que vêm só com o
 * dia. Quem foi escolhido na lista bate pelo nome exato; quem foi digitado,
 * por `casaNome`.
 */
export function plantoesDaPessoa(escala: EscalaLida, pessoa: string, mesBase: string): PlantaoLido[] {
  const alvo = normalizar(pessoa);
  if (!alvo) return [];
  const daLista = escala.pessoas.some((p) => normalizar(p) === alvo);
  const ehEla = (texto: string) => daLista
    ? normalizar(texto) === alvo || nomesDaCelula(texto).some((n) => normalizar(n) === alvo)
    : casaNome(texto, pessoa);

  const saida: PlantaoLido[] = [];
  const vistos = new Set<string>();
  const por = (data: string | null, codigo: string, horario: Horario | null) => {
    if (!data) return;
    const k = `${data}|${horario?.inicio ?? codigo}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    saida.push({ data, codigo, horario });
  };
  const dataDe = (d: Entrada["data"]): string | null => {
    if (d.mes !== null) return dataISO(d.ano ?? anoMaisPerto(d.mes, mesBase), d.mes, d.dia);
    const [a, m] = somarMes(mesBase, d.mesRel).split("-").map(Number);
    return dataISO(a, m, d.dia);
  };

  for (const e of escala.entradas) {
    if (e.pessoa !== null) {
      // A célula de uma pessoa (grade, ou coluna com o nome dela): a sigla do dia.
      if (!ehEla(e.pessoa)) continue;
      for (const t of turnosDaCelula(e.texto, escala.legenda)) por(dataDe(e.data), t.codigo, t.horario);
      continue;
    }
    // Por dia: o nome dela na célula. O turno vem, nesta ordem, da própria
    // célula ("Fulano 07-19"), do título da coluna ("Noturno"), do resto da
    // linha (a lista com início e fim) — e, sem nada disso, a tela pergunta.
    if (!ehEla(e.texto)) continue;
    const daCelula = horarioDoTexto(e.texto);
    const daColuna = e.coluna ? horarioDaSigla(e.coluna, escala.legenda) : null;
    if (daCelula) por(dataDe(e.data), pegarHorario(e.texto), daCelula);
    else if (daColuna) por(dataDe(e.data), e.coluna!, daColuna);
    else if (e.daLinha) por(dataDe(e.data), e.daLinha.codigo, e.daLinha.horario);
    else por(dataDe(e.data), e.coluna && parecerNome(e.coluna) ? e.coluna : "Plantão", null);
  }
  return saida.sort((a, b) => a.data.localeCompare(b.data) || (a.horario?.inicio ?? "").localeCompare(b.horario?.inicio ?? ""));
}

/** Só o pedaço do horário de um texto ("Dr. Fulano 07h-19h" → "07h-19h"), para a coluna "como estava". */
function pegarHorario(t: string): string {
  const m = t.match(/\d{1,2}(?:[:h]\d{2})?\s*h?\s*(?:[-–—x]|\s(?:às|as|a|até|ate)\s|h\/)\s*\d{1,2}(?:[:h]\d{2})?\s*h?/i);
  return m ? m[0].trim() : t.trim();
}
