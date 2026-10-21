// Importar o mapa cirúrgico que o centro cirúrgico já faz.
//
// O mapa nasce numa planilha — HORA, PACIENTE, IDADE, CONVÊNIO, MÉDICO, SALA,
// PROCEDIMENTO, OBSERVAÇÃO —, vira PDF ou print e vai para o grupo. Em vez de
// redigitar, o enfermeiro sobe o arquivo e confere.
//
// Três caminhos chegam aqui, e todos terminam numa GRADE (linhas de células):
//   - a planilha (.xlsx, .csv) já é grade;
//   - o PDF e a foto dão palavras soltas com posição, e `gradeDePalavras`
//     remonta as linhas e as colunas pela posição dos títulos.
// Da grade, `lerMapa` tira a data, a anestesista do título e os pacientes.
// Tudo aqui é puro: a leitura do arquivo mora em centro-importar-arquivo.ts.

import { CONVENIOS } from "./convenios.ts";

export type Palavra = { t: string; x0: number; x1: number; y0: number; y1: number };

export type Campo = "numero" | "hora" | "paciente" | "idade" | "convenio" | "cirurgiao" | "sala" | "procedimento" | "leito";

/** "Convênio" → "convenio": sem acento, minúsculo, sem espaço sobrando. */
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** O título da coluna, em qualquer grafia que os mapas usam. */
const TITULOS: Array<[Campo, RegExp]> = [
  ["hora", /^(hora|horario|hr)$/],
  ["paciente", /^(paciente|nome|nome do paciente)$/],
  ["idade", /^(idade|id)$/],
  ["convenio", /^(convenio|plano)$/],
  ["cirurgiao", /^(medico|cirurgiao|cirurgia o|equipe)$/],
  ["sala", /^sala$/],
  ["procedimento", /^(procedimento|cirurgia|procedimentos)$/],
  ["leito", /^(observacao|observacoes|obs|leito|quarto|quarto\/leito|acomodacao)$/],
];

/** As palavras de cada título, para a comparação tolerante da leitura de foto. */
const PALAVRAS_DOS_TITULOS: Array<[Campo, string[]]> = [
  ["hora", ["horario"]], ["paciente", ["paciente"]], ["idade", ["idade"]], ["convenio", ["convenio"]],
  ["cirurgiao", ["medico", "cirurgiao"]], ["procedimento", ["procedimento", "procedimentos", "cirurgia"]],
  ["leito", ["observacao", "observacoes", "acomodacao"]],
];

/** Quantas letras trocar, pôr ou tirar para ir de uma palavra à outra. */
export function distancia(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return linha[b.length];
}

/**
 * O campo de um título de coluna. Exato primeiro; depois, para a leitura de
 * foto, tolerante a uma letra trocada — o OCR leu "CONVENTO" no lugar de
 * "CONVENIO" no print do mapa. Só para palavras de cinco letras ou mais: em
 * "SALA" e "HORA" uma letra de diferença já é outra palavra.
 */
export function campoDoTitulo(texto: string): Campo | null {
  const t = normalizar(texto).replace(/[.:]$/, "");
  for (const [campo, re] of TITULOS) if (re.test(t)) return campo;
  if (t.length < 5 || /\s/.test(t)) return null;
  const letras = t.replace(/0/g, "o").replace(/1/g, "i").replace(/5/g, "s");
  for (const [campo, palavras] of PALAVRAS_DOS_TITULOS) {
    if (palavras.some((p) => distancia(letras, p) <= (p.length >= 9 ? 2 : 1))) return campo;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Do PDF e da foto: as palavras soltas viram grade
// ---------------------------------------------------------------------------

const meioY = (p: Palavra) => (p.y0 + p.y1) / 2;
const meioX = (p: Palavra) => (p.x0 + p.x1) / 2;

/** A palavra da foto com a confiança do OCR (0 a 100). */
export type PalavraLida = Palavra & { c: number };

/** As duas caixas dividem mais de 30% da menor delas. */
function sobrepoe(a: Palavra, b: Palavra): boolean {
  const largura = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const altura = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (largura <= 0 || altura <= 0) return false;
  const menor = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return menor > 0 && (largura * altura) / menor > 0.3;
}

/**
 * Junta duas leituras da mesma foto. O OCR tem dois jeitos de achar o texto,
 * e cada um erra num lugar: o automático lê a sala e a idade, mas embaralha a
 * célula com a cirurgia em duas linhas ("FRATURA DE PLATO TIBIAL DE / JOELHO
 * DIREITO" saiu "irradia o"); o de texto esparso lê essa célula inteira, mas
 * perdeu o número da sala no mapa real de 22/10.
 *
 * A primeira leitura é a base, e a palavra firme dela (confiança 40 ou mais)
 * nunca sai. A segunda só entra onde a base não tem palavra firme — e, se
 * também for firme (60 ou mais), tira da base o chute que estava ali.
 */
export function juntarLeituras(base: PalavraLida[], reforco: PalavraLida[]): Palavra[] {
  const firmes = base.filter((p) => p.c >= 40);
  const entram = reforco.filter((r) => r.c >= 60 && !firmes.some((p) => sobrepoe(p, r)));
  const ficam = base.filter((p) => p.c >= 40 || !entram.some((r) => sobrepoe(p, r)));
  return [...ficam, ...entram].map(({ t, x0, x1, y0, y1 }) => ({ t, x0, x1, y0, y1 }));
}

/**
 * Remonta a tabela a partir de palavras com posição.
 *
 * 1. A linha dos títulos é a que tem pelo menos três títulos conhecidos.
 * 2. As colunas vão de um título ao outro, com a divisa no vão vazio entre
 *    elas. O que fica à esquerda do primeiro título é a coluna do número.
 * 3. As linhas da tabela são ancoradas no HORÁRIO (e no nome, quando o
 *    horário não foi lido). Isso resolve a cirurgia que quebra em duas
 *    linhas ("FRATURA DE PLATO TIBIAL DE / JOELHO DIREITO"): cada pedaço vai
 *    para a âncora mais próxima, e não vira um paciente novo.
 *
 * Devolve a grade com o título do mapa (o que está acima dos títulos, numa
 * célula só) e a linha dos títulos no alto, como uma planilha.
 */
export function gradeDePalavras(palavras: Palavra[]): string[][] | null {
  // A linha da borda da tabela, na foto, às vezes é lida como "|" — sozinha
  // ou grudada na palavra ("| PARTICULAR").
  const limpas = palavras.map((p) => ({ ...p, t: p.t.trim().replace(/^[|¦]+|[|¦]+$/g, "") })).filter((p) => p.t);
  if (!limpas.length) return null;
  const alturas = limpas.map((p) => p.y1 - p.y0).sort((a, b) => a - b);
  const alturaTipica = alturas[Math.floor(alturas.length / 2)] || 1;

  // Linhas de texto: palavras com o meio na mesma altura.
  const linhas: Palavra[][] = [];
  for (const p of [...limpas].sort((a, b) => meioY(a) - meioY(b))) {
    const ultima = linhas.at(-1);
    if (ultima && Math.abs(meioY(p) - meioY(ultima[0])) < alturaTipica * 0.6) ultima.push(p);
    else linhas.push([p]);
  }

  // A linha dos títulos. Título de duas palavras ("NOME DO PACIENTE") é lido
  // juntando vizinhas.
  let cabecalho: { y: number; colunas: Array<{ campo: Campo; x: number; x0: number }> } | null = null;
  for (const linha of linhas) {
    const ordenadas = [...linha].sort((a, b) => a.x0 - b.x0);
    const colunas: Array<{ campo: Campo; x: number; x0: number }> = [];
    for (let i = 0; i < ordenadas.length; i++) {
      for (const n of [3, 2, 1]) {
        const grupo = ordenadas.slice(i, i + n);
        if (grupo.length < n) continue;
        const campo = campoDoTitulo(grupo.map((p) => p.t).join(" "));
        if (campo && !colunas.some((c) => c.campo === campo)) {
          colunas.push({ campo, x: (grupo[0].x0 + grupo.at(-1)!.x1) / 2, x0: grupo[0].x0 });
          i += n - 1;
          break;
        }
      }
    }
    if (colunas.length >= 3) { cabecalho = { y: meioY(linha[0]), colunas: colunas.sort((a, b) => a.x - b.x) }; break; }
  }
  if (!cabecalho) return null;
  const cab = cabecalho;
  const colunas = cab.colunas;

  const abaixo = limpas.filter((p) => meioY(p) > cab.y + alturaTipica * 0.6);
  const acima = limpas.filter((p) => meioY(p) < cab.y - alturaTipica * 0.6);

  // As divisas entre colunas: o corredor vazio entre o texto de uma coluna e
  // o da outra, olhando a tabela inteira de cima. O meio do caminho entre os
  // títulos não serve: a coluna do procedimento é larga e a da observação é
  // estreita, e a última palavra de uma cirurgia comprida passava para o leito.
  // Sem corredor (texto encostado), fica o meio do caminho.
  const faixas: Array<[number, number]> = [];
  for (const p of [...abaixo].sort((a, b) => a.x0 - b.x0)) {
    const ultima = faixas.at(-1);
    if (ultima && p.x0 <= ultima[1] + alturaTipica * 0.5) ultima[1] = Math.max(ultima[1], p.x1);
    else faixas.push([p.x0, p.x1]);
  }
  const corredores = faixas.slice(1).map((f, i) => ({ de: faixas[i][1], ate: f[0] }));
  const divisas = colunas.slice(1).map((c, i) => {
    const esquerda = colunas[i].x, direita = c.x;
    const dentro = corredores.filter((g) => (g.de + g.ate) / 2 > esquerda && (g.de + g.ate) / 2 < direita);
    if (!dentro.length) return (esquerda + direita) / 2;
    const largo = dentro.reduce((m, g) => (g.ate - g.de > m.ate - m.de ? g : m));
    return (largo.de + largo.ate) / 2;
  });
  const inicio = colunas[0].x0 - alturaTipica * 0.5;
  const colunaDe = (p: Palavra): Campo => {
    const x = meioX(p);
    if (x < inicio) return "numero";
    let i = 0;
    while (i < divisas.length && x >= divisas[i]) i++;
    return colunas[i].campo;
  };

  // As âncoras de cada linha da tabela.
  const ancorasDe = (campo: Campo, teste: (t: string) => boolean) => {
    const ys: number[] = [];
    for (const p of abaixo.filter((q) => colunaDe(q) === campo && teste(q.t.trim())).sort((a, b) => meioY(a) - meioY(b))) {
      if (!ys.length || meioY(p) - ys.at(-1)! > alturaTipica * 0.9) ys.push(meioY(p));
    }
    return ys;
  };
  // O horário primeiro: uma célula de uma linha só, centrada, que o OCR lê bem
  // ("08:00", "A/S"). O número da linha não serve de primeira: no mapa real o
  // OCR leu os números das linhas VAZIAS do fim (13 a 21) e pulou os das
  // preenchidas — e as âncoras caíam todas onde não havia paciente.
  // Depois, o paciente sem horário lido vira âncora própria, se estiver longe
  // de qualquer horário: a linha não se perde porque o OCR não leu "A/S". O
  // nome quebrado em duas linhas fica a meia linha do horário, e não duplica.
  let ancoras = ancorasDe("hora", (t) => /^(\d{1,2}[:h.]\d{2}|a\/s|as|a\/5|a5)$/i.test(t));
  if (ancoras.length < 2) ancoras = ancorasDe("numero", (t) => /^\d{1,3}$/.test(t));
  const linhasDoPaciente = ancorasDe("paciente", () => true);
  if (ancoras.length < 2) ancoras = linhasDoPaciente;
  else {
    for (const y of linhasDoPaciente) {
      if (ancoras.every((a) => Math.abs(a - y) > alturaTipica * 1.5)) ancoras.push(y);
    }
    ancoras.sort((a, b) => a - b);
  }
  if (!ancoras.length) return null;
  const vao = ancoras.length > 1
    ? Math.min(...ancoras.slice(1).map((y, i) => y - ancoras[i]))
    : alturaTipica * 3;

  const celulas = ancoras.map(() => new Map<Campo, Palavra[]>());
  for (const p of abaixo) {
    let melhor = -1;
    let distancia = Infinity;
    ancoras.forEach((y, i) => { const d = Math.abs(meioY(p) - y); if (d < distancia) { distancia = d; melhor = i; } });
    if (melhor < 0 || distancia > Math.max(vao * 0.75, alturaTipica)) continue;
    const campo = colunaDe(p);
    celulas[melhor].set(campo, [...(celulas[melhor].get(campo) ?? []), p]);
  }
  const texto = (lista: Palavra[] | undefined) => (lista ?? [])
    .sort((a, b) => (Math.abs(meioY(a) - meioY(b)) < alturaTipica * 0.6 ? a.x0 - b.x0 : meioY(a) - meioY(b)))
    .map((p) => p.t).join(" ").replace(/\s+/g, " ").trim();

  const ordem: Campo[] = ["numero", ...colunas.map((c) => c.campo)];
  const titulo = [...acima].sort((a, b) => (Math.abs(meioY(a) - meioY(b)) < alturaTipica * 0.6 ? a.x0 - b.x0 : meioY(a) - meioY(b)))
    .map((p) => p.t).join(" ");
  const grade: string[][] = [];
  if (titulo.trim()) grade.push([titulo.trim()]);
  grade.push(ordem.map((c) => (c === "numero" ? "#" : TITULO_PADRAO[c])));
  for (const linha of celulas) grade.push(ordem.map((c) => texto(linha.get(c))));
  return grade;
}

const TITULO_PADRAO: Record<Campo, string> = {
  numero: "#", hora: "HORA", paciente: "PACIENTE", idade: "IDADE", convenio: "CONVENIO",
  cirurgiao: "MEDICO", sala: "SALA", procedimento: "PROCEDIMENTO", leito: "OBSERVACAO",
};

// ---------------------------------------------------------------------------
// Da grade: os pacientes
// ---------------------------------------------------------------------------

export type LinhaImportada = {
  linha: number;            // a posição no arquivo, para a conferência
  horario: string | null;   // "HH:MM"; nulo é "A/S"
  paciente: string;
  idade: number | null;
  convenio: string | null;
  cirurgiao: string | null;
  sala: string | null;
  procedimento: string;
  leito: string | null;
};

export type MapaImportado = {
  data: string | null;              // "AAAA-MM-DD", do título
  anestesista: string | null;       // como está escrito no título
  linhas: LinhaImportada[];
  ignoradas: number;                // linhas com paciente e sem cirurgia
};

const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e", "di", "du"]);

/** "JOSE DA SILVA" → "José da Silva" não dá (acento não se adivinha), mas → "Jose da Silva". */
export function nomeProprio(s: string): string {
  return s.trim().toLocaleLowerCase("pt-BR").split(/\s+/).map((p, i) =>
    i > 0 && PARTICULAS.has(p) ? p : p.replace(/(^|[-'.])(\p{L})/gu, (_, a, b) => a + b.toLocaleUpperCase("pt-BR")),
  ).join(" ");
}

/** "SALA 4" → "Sala 4"; "4" → "Sala 4". "SALA" sozinho (a foto perdeu o número) não é sala nenhuma. */
export function nomeDaSala(s: string): string | null {
  const t = s.trim();
  if (!t || /^[-_—–]+$/.test(t) || normalizar(t) === "sala") return null;
  if (/^\d+$/.test(t)) return `Sala ${t}`;
  return nomeProprio(t);
}

/** A hora da célula: "07:30", "7h30", "14h", a fração de dia do Excel (0,3125), ou "A/S" (nulo). */
export function horaDaCelula(v: string): string | null {
  const t = v.trim().toLowerCase().replace(",", ".");
  if (!t || /^a\s*\/\s*s$/.test(t) || /^[-_—–]+$/.test(t)) return null;
  let m = t.match(/^(\d{1,2})\s*[:h]\s*(\d{2})?$/);
  if (m) {
    const h = Number(m[1]), min = Number(m[2] ?? 0);
    return h < 24 && min < 60 ? `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` : null;
  }
  if (/^0?\.\d+$/.test(t)) {
    const minutos = Math.round(Number(t) * 1440);
    return `${String(Math.floor(minutos / 60) % 24).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
  }
  m = t.match(/^(\d{1,2}):(\d{2}):\d{2}$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

/** A data do título: "21/10/2026", "21/10/26", ou o número de série de data do Excel. */
export function dataDoTexto(texto: string): string | null {
  const m = texto.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/);
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const mes = Number(m[2]), dia = Number(m[1]);
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  const serial = texto.match(/^\s*(4\d{4}|5\d{4})(\.0+)?\s*$/);
  if (serial) {
    // O Excel conta dias desde 30/12/1899.
    return new Date(Date.UTC(1899, 11, 30) + Number(serial[1]) * 86400000).toISOString().slice(0, 10);
  }
  return null;
}

/** "ANESTESISTA DR: Alessandra" → "Alessandra". */
export function anestesistaDoTitulo(texto: string): string | null {
  const m = texto.match(/anestesista\s*(?:\(a\))?\s*(?:dra?\.?)?\s*[:\-–]?\s*(?:dra?\.?)?\s*[:\-–]?\s*([\p{L}][\p{L} .]{1,60})/iu);
  return m ? m[1].trim().replace(/\s+/g, " ") : null;
}

const vazio = (s: string | undefined) => !s || !s.trim() || /^[-_—–]+$/.test(s.trim());

const CONHECIDOS = ["SUS", ...CONVENIOS];

/**
 * O convênio na grafia que o sistema já usa: "UNIMED" e "unimed" viram
 * "Unimed", para o resumo do dia não contar o mesmo convênio duas vezes. O que
 * não está na lista fica em maiúsculas, como no mapa ("SUS C"). A leitura de
 * foto às vezes dobra uma letra solta ("sus Cc"): letra repetida sozinha volta
 * a ser uma.
 */
export function convenioLimpo(s: string): string {
  const t = s.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR")
    .split(" ").map((p) => (/^(\p{L})\1{1,2}$/u.test(p) ? p[0] : p)).join(" ");
  return CONHECIDOS.find((c) => normalizar(c) === normalizar(t)) ?? t;
}

/**
 * Os pacientes da grade. A linha dos títulos é a primeira com três títulos
 * conhecidos; o que vem acima é o título do mapa (data e anestesista).
 * Paciente sem cirurgia não entra — vai para a contagem de ignoradas, para a
 * conferência avisar.
 */
export function lerMapa(grade: string[][]): MapaImportado | null {
  let iCab = -1;
  let mapa = new Map<Campo, number>();
  for (let i = 0; i < grade.length && iCab < 0; i++) {
    const achados = new Map<Campo, number>();
    grade[i].forEach((cel, j) => { const c = campoDoTitulo(cel ?? ""); if (c && !achados.has(c)) achados.set(c, j); });
    if (achados.size >= 3 && achados.has("paciente")) { iCab = i; mapa = achados; }
  }
  if (iCab < 0) return null;
  const titulo = grade.slice(0, iCab).flat().filter(Boolean).join(" ");
  const celula = (linha: string[], c: Campo) => { const j = mapa.get(c); return j == null ? "" : String(linha[j] ?? "").trim(); };

  const linhas: LinhaImportada[] = [];
  let ignoradas = 0;
  grade.slice(iCab + 1).forEach((linha, k) => {
    const paciente = celula(linha, "paciente");
    if (vazio(paciente)) return;
    const procedimento = celula(linha, "procedimento");
    if (vazio(procedimento)) { ignoradas++; return; }
    const idade = Number(celula(linha, "idade").replace(/\D/g, ""));
    const texto = (c: Campo) => (vazio(celula(linha, c)) ? null : celula(linha, c).replace(/\s+/g, " "));
    linhas.push({
      linha: k + 1,
      horario: horaDaCelula(celula(linha, "hora")),
      paciente: nomeProprio(paciente),
      idade: celula(linha, "idade") && Number.isInteger(idade) && idade <= 130 ? idade : null,
      convenio: texto("convenio") && convenioLimpo(texto("convenio")!),
      cirurgiao: texto("cirurgiao"),
      sala: nomeDaSala(celula(linha, "sala")),
      procedimento: procedimento.replace(/\s+/g, " "),
      leito: texto("leito"),
    });
  });
  return { data: dataDoTexto(titulo), anestesista: anestesistaDoTitulo(titulo), linhas, ignoradas };
}

/** A sala do arquivo entre as cadastradas: "SALA 4" acha "Sala 4". */
export function casarSala<T extends { nome: string }>(nome: string | null, salas: T[]): T | null {
  if (!nome) return null;
  const n = normalizar(nome).replace(/^sala\s*/, "");
  return salas.find((s) => normalizar(s.nome).replace(/^sala\s*/, "") === n) ?? null;
}

/** A anestesista do título entre as da casa: "Alessandra" acha "DRA ALESSANDRA". */
export function casarAnestesista<T extends { nome: string }>(nome: string | null, pessoas: T[]): T | null {
  if (!nome) return null;
  const alvo = normalizar(nome).replace(/^dra?\.?\s+/, "").split(" ")[0];
  if (!alvo || alvo.length < 3) return null;
  const achadas = pessoas.filter((p) => normalizar(p.nome).replace(/^dra?\.?\s+/, "").split(" ").includes(alvo));
  return achadas.length === 1 ? achadas[0] : null;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** CSV com ponto e vírgula (o do Excel em português) ou vírgula, e aspas. */
export function gradeDoCsv(texto: string): string[][] {
  const primeira = texto.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let linha: string[] = [];
  let cel = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { cel += '"'; i++; }
      else if (ch === '"') aspas = false;
      else cel += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(cel); cel = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      linha.push(cel); linhas.push(linha); linha = []; cel = "";
    } else cel += ch;
  }
  if (cel || linha.length) { linha.push(cel); linhas.push(linha); }
  return linhas;
}
