// A ficha de avaliação pré-anestésica do hospital, lida da foto, para a ficha
// anestésica (11/11/2026: "como enviar essa ficha e já puxar lá para fazer a
// ficha anestésica do paciente").
//
// O hospital imprime a avaliação do sistema dele num desenho fixo: rótulo em
// negrito ("Tem diabetes?", "Peso", "ASA"…) e, logo abaixo, a resposta numa
// caixa. Às vezes dois ou três rótulos lado a lado, cada um com a sua caixa.
// O OCR do aparelho (components/evolucao/ler-ficha-do-hospital.ts) devolve as
// palavras com a posição; aqui:
//
//   1. a foto torta é endireitada pela inclinação das próprias palavras;
//   2. as palavras viram linhas, e as linhas com rótulos conhecidos viram
//      "linhas de rótulo", cada rótulo dono da coluna que começa nele;
//   3. a resposta de cada rótulo é o que está abaixo dele, na coluna dele,
//      até a próxima linha de rótulos;
//   4. o "Qual?" sozinho numa linha completa a pergunta da linha de cima.
//
// Daí sai a PROPOSTA: cada campo da ficha anestésica com o texto que iria
// para ele. O médico confere e corrige antes; e só o campo vazio é
// preenchido — o que já está na ficha nunca é trocado.
//
// Tudo puro. Nenhum dado de paciente real nos testes: o modelo do hospital
// foi conferido no aparelho, e os testes usam palavras fictícias.

import { normalizar, type Palavra } from "../centro-importar.ts";
import { asaRomana, camposDoPapel, type CampoDoPapel } from "./pre-papel.ts";

export type PalavraComConfianca = Palavra & { c: number };

export type Pergunta =
  | "peso" | "altura" | "cirurgia" | "cirurgias" | "qual" | "reacao" | "medicacao" | "anticoagulante"
  | "cardiovascular" | "capacidade" | "sintomas" | "respiratoria" | "apneia" | "diabetes" | "neuro"
  | "outras" | "aguda" | "protese" | "alergias" | "habitos" | "glaucoma"
  | "pas" | "pad" | "asa" | "mallampati" | "abertura" | "dtm" | "dentes";

/**
 * As duas leituras do OCR (modo automático e texto esparso) numa só. Onde as
 * duas acharam palavra no mesmo lugar, fica a de maior confiança; o resto
 * entra de cada uma — uma acha o que a outra perdeu ("78" e "170" só no
 * esparso; o "BX DE" com confiança baixa nas duas).
 */
export function juntarComConfianca(a: PalavraComConfianca[], b: PalavraComConfianca[]): PalavraComConfianca[] {
  const area = (p: Palavra) => Math.max(1, (p.x1 - p.x0) * (p.y1 - p.y0));
  // A mesma palavra nas duas: caixas quase iguais, ou uma dentro da outra
  // com o mesmo texto ("PROSTAT" e "PROSTAT,"). Caixa grande com texto
  // diferente por dentro (">=" lido por cima de "CM") não apaga a pequena.
  const sobrepoe = (p: PalavraComConfianca, q: PalavraComConfianca) => {
    const w = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0), h = Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0);
    if (w <= 0 || h <= 0) return false;
    const comum = w * h;
    if (comum / (area(p) + area(q) - comum) > 0.45) return true;
    const [tp, tq] = [normalizar(p.t), normalizar(q.t)];
    return comum / Math.min(area(p), area(q)) > 0.85 && (tp.includes(tq) || tq.includes(tp));
  };
  // Confiança muito baixa é quase sempre sujeira; a exceção é a palavra longa em
  // maiúsculas, que o OCR lê certo e marca com zero por causa da borda colada
  // ("(OMEPRAZOL").
  const fica = (p: PalavraComConfianca) => p.c >= 25 || /^[([|]?\p{Lu}{5,}[,.]?$/u.test(p.t.trim());
  const todas = [...a, ...b].filter(fica).sort((p, q) => q.c - p.c);
  const ficam: PalavraComConfianca[] = [];
  for (const p of todas) {
    const i = ficam.findIndex((q) => sobrepoe(p, q));
    if (i < 0) { ficam.push(p); continue; }
    // A mais confiante leu só o começo ("N" por cima de "Não"): fica a inteira.
    const [curta, longa] = [normalizar(ficam[i].t), normalizar(p.t)];
    if (p.c >= 30 && longa.length > curta.length && longa.startsWith(curta)) ficam[i] = p;
  }
  return ficam;
}

/** Os rótulos do modelo, no texto sem acento e em minúsculas. Tolerantes ao OCR que cola palavras. */
const ROTULOS: Array<[Pergunta, RegExp]> = [
  ["peso", /\bpeso\b/],
  ["altura", /\baltura\b/],
  ["cirurgia", /cirurgia ?proposta/],
  ["cirurgias", /ja ?fez ?alguma ?cirur/],
  ["reacao", /reacao ?a ?algum ?tipo|apresentou ?reacao/],
  ["medicacao", /medicacao ?de ?uso/],
  ["anticoagulante", /anticoagul/],
  ["cardiovascular", /doenca ?cardiovascular/],
  ["capacidade", /capacidade/],
  ["sintomas", /sintomas ?cardiovasc/],
  ["respiratoria", /doenca ?respirator/],
  ["apneia", /apneia ?obstrutiva/],
  ["diabetes", /tem ?diabetes/],
  ["neuro", /neurologicos|psiquiatricos/],
  ["outras", /outras ?doencas/],
  ["aguda", /doenca ?aguda/],
  ["protese", /protese ?dentaria/],
  ["alergias", /tem ?alergias/],
  ["habitos", /tabagista|etilista|toxicomano/],
  ["glaucoma", /glaucoma/],
  ["pas", /arterial ?sistolica/],
  ["pad", /arterial ?diastolica/],
  ["asa", /\basa\b/],
  ["mallampati", /ma\w{0,2}ampat/],
  ["abertura", /abertura ?b[ou]cal/],
  ["dtm", /distancia ?(m ?t\b|tireo)/],
  ["dentes", /\bdentes\b/],
  // Por último: "Qual?" só é rótulo quando nenhum outro começa no mesmo lugar.
  ["qual", /\bqua[il1]\b/],
];

/** Linhas que encerram uma resposta sem serem rótulo: as faixas de seção e o rodapé. */
const FAIXA = /\b(anamnese|exame fisico|hospital|rodovia)\b/;

export type FichaDoHospital = {
  paciente: { nome: string; nascimento: string; sexo: string; convenio: string; prontuario: string };
  /** Quem fez a avaliação no hospital, para a ficha dizer de onde veio. */
  autor: { crm: string; nome: string; quando: string };
  /** A resposta de cada pergunta, como lida (o "Sim", o "Não", o número, o texto). */
  respostas: Partial<Record<Pergunta, string>>;
  /** O "Qual?" de cada pergunta que tinha um. */
  detalhes: Partial<Record<Pergunta, string>>;
};

type Linha = { y: number; palavras: PalavraComConfianca[]; norm: string; inicioDe: number[] };

const LIXO_NAS_PONTAS = /^[|¦[\](){}“”"'`’‘_—–=~;:,.!]+|[|¦[\]{}“”"'`’‘_—–~;:,!]+$/g;

/** Tira a borda da caixa grudada ("|Não", "[Sim") e o que é só pontuação ("-", "+" e "//" ficam: separam o texto). */
function limpar(palavras: PalavraComConfianca[]): PalavraComConfianca[] {
  return palavras
    .map((p) => ({ ...p, t: p.t.trim().replace(LIXO_NAS_PONTAS, "").replace(/(?<![<>])=+$/, "") }))
    .filter((p) => p.t && /[\p{L}\p{N}+/<>-]/u.test(p.t))
    // Letra sozinha e duvidosa é sujeira da borda da foto; número sozinho é resposta (ASA 2).
    .filter((p) => p.t.length > 1 || /\d/.test(p.t) || p.c >= 70);
}

/**
 * A inclinação da foto, pela mediana das palavras vizinhas: cada palavra com
 * a próxima à direita na mesma altura dá um pedaço da linha de texto.
 */
export function inclinacao(palavras: Palavra[]): number {
  const alt = mediana(palavras.map((p) => p.y1 - p.y0)) || 1;
  const centro = (p: Palavra) => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2] as const;
  const inclinacoes: number[] = [];
  for (const a of palavras) {
    const [ax, ay] = centro(a);
    let melhor: Palavra | null = null;
    for (const b of palavras) {
      if (b === a || b.x0 <= a.x1 - 2 || b.x0 - a.x1 > alt * 3) continue;
      if (Math.abs(centro(b)[1] - ay) > alt * 0.6) continue;
      if (!melhor || b.x0 < melhor.x0) melhor = b;
    }
    if (melhor) {
      const [bx, by] = centro(melhor);
      if (bx - ax > alt) inclinacoes.push((by - ay) / (bx - ax));
    }
  }
  return inclinacoes.length >= 5 ? mediana(inclinacoes) : 0;
}

function mediana(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** As palavras endireitadas e agrupadas em linhas, de cima para baixo. */
function linhasDe(palavras: PalavraComConfianca[]): Linha[] {
  const tg = inclinacao(palavras);
  const retas = palavras.map((p) => {
    const d = ((p.x0 + p.x1) / 2) * tg;
    return { ...p, y0: p.y0 - d, y1: p.y1 - d };
  });
  const alt = mediana(retas.map((p) => p.y1 - p.y0)) || 1;
  const ordem = [...retas].sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  const grupos: Array<{ y: number; palavras: PalavraComConfianca[] }> = [];
  for (const p of ordem) {
    const y = (p.y0 + p.y1) / 2;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && Math.abs(y - ultimo.y) <= alt * 0.55) {
      ultimo.palavras.push(p);
      ultimo.y = ultimo.palavras.reduce((s, q) => s + (q.y0 + q.y1) / 2, 0) / ultimo.palavras.length;
    } else grupos.push({ y, palavras: [p] });
  }
  return grupos.map((g) => {
    const ps = g.palavras.sort((a, b) => a.x0 - b.x0);
    const inicioDe: number[] = [];
    let norm = "";
    for (const p of ps) {
      if (norm) norm += " ";
      inicioDe.push(norm.length);
      norm += normalizar(p.t).replace(/[^a-z0-9<>=/+.-]/g, "");
    }
    return { y: g.y, palavras: ps, norm, inicioDe };
  });
}

/**
 * Os rótulos de uma linha, cada um com o x em que a coluna dele começa. Os
 * rótulos de uma linha vêm colados ("Tem diabetes? Tem problemas
 * neurológicos…"): a coluna de cada um começa na primeira palavra depois do
 * rótulo anterior — o "Tem", e não o "neurológicos" que a busca achou.
 */
function rotulosDa(linha: Linha): Array<{ pergunta: Pergunta; x: number }> {
  const palavraEm = (pos: number) => {
    let i = 0;
    while (i + 1 < linha.inicioDe.length && linha.inicioDe[i + 1] <= pos) i++;
    return i;
  };
  // O mesmo texto sem os espaços, com o começo de cada palavra nele.
  const pedacos = linha.norm.split(" ");
  const inicioCompacto: number[] = [];
  let compacto = "";
  for (const p of pedacos) { inicioCompacto.push(compacto.length); compacto += p; }
  const palavraNoCompacto = (pos: number) => {
    let i = 0;
    while (i + 1 < inicioCompacto.length && inicioCompacto[i + 1] <= pos) i++;
    return i;
  };
  const achados: Array<{ pergunta: Pergunta; de: number; ate: number }> = [];
  const anotar = (pergunta: Pergunta, de: number, ate: number) => {
    // Duas buscas na mesma palavra: fica a primeira da lista (o "qual" é a última).
    if (!achados.some((a) => de <= a.ate && ate >= a.de)) achados.push({ pergunta, de, ate });
  };
  for (const [pergunta, re] of ROTULOS) {
    const g = new RegExp(re.source, "g");
    let m: RegExpExecArray | null;
    let achou = false;
    while ((m = g.exec(linha.norm))) {
      achou = true;
      anotar(pergunta, palavraEm(m.index), palavraEm(m.index + m[0].length - 1));
      if (pergunta !== "qual") break;
    }
    // Rótulo longo que o OCR partiu no meio: procura no texto colado.
    const fonte = re.source.replace(/ \?/g, "").replace(/\\b/g, "");
    if (!achou && fonte.replace(/[^a-z]/g, "").length >= 8) {
      const c = new RegExp(fonte).exec(compacto);
      if (c) anotar(pergunta, palavraNoCompacto(c.index), palavraNoCompacto(c.index + c[0].length - 1));
    }
  }
  achados.sort((a, b) => a.de - b.de);
  const primeira = Math.max(0, Math.min(achados[0]?.de ?? 0, linha.palavras.findIndex((p) => p.t.length >= 2 && p.c >= 50)));
  return achados.map((a, k) => ({ pergunta: a.pergunta, x: linha.palavras[k === 0 ? primeira : achados[k - 1].ate + 1]?.x0 ?? linha.palavras[a.de].x0 }));
}

/** As perguntas de resposta escrita, que podem ocupar mais de uma linha. */
const TEXTO_LIVRE = new Set<Pergunta>(["cirurgia", "qual", "anticoagulante"]);

/**
 * A borda da foto deixa letras soltas no fim da linha ("Normais to É."): a
 * palavra curta e duvidosa, longe da anterior, sai.
 */
function semSujeiraNoFim(ps: PalavraComConfianca[], alt: number): PalavraComConfianca[] {
  const r = [...ps];
  while (r.length > 1) {
    const u = r[r.length - 1], a = r[r.length - 2];
    const curta = u.t.replace(/[^\p{L}\p{N}]/gu, "").length <= 2 && !/^\d+$/.test(u.t);
    if (curta && (u.c < 75 || u.x0 - a.x1 > alt * 2)) r.pop();
    else break;
  }
  return r;
}

// Na caixa de Sim/Não, a letra sozinha que sobrou da leitura ainda diz qual foi.
const SIM = /^(s[il1]m|[il1]m|s)$/;
const NAO = /^(n[aã][o0]|nao|na0|nega\w*|negou|n)$/;

/** "Sim", "Não" ou vazio, do texto da resposta. */
export function simOuNao(v: string | undefined): "Sim" | "Não" | "" {
  for (const p of normalizar(v ?? "").split(/[^a-z0-9]+/)) {
    if (SIM.test(p)) return "Sim";
    if (NAO.test(p)) return "Não";
  }
  return "";
}

/** O número de uma resposta ("78", "120 mmHg", "1,70"), com as trocas comuns do OCR. */
export function numeroDe(v: string | undefined): number | null {
  const comoAlgarismo: Record<string, string> = { o: "0", O: "0", B: "8", S: "5", l: "1", I: "1", "|": "1", Z: "2", G: "6" };
  // A palavra de 2 ou 3 sinais em que só cabem algarismos ("Bo" antes de mmHg) vira número.
  const trocado = String(v ?? "").replace(/(?<![\p{L}\d])[\doOBSlI|ZG]{2,3}(?![\p{L}\d])/gu,
    (w) => (/\d/.test(w) || /mmhg/i.test(String(v)) ? w.replace(/[oOBSlI|ZG]/g, (x) => comoAlgarismo[x]) : w));
  const m = /(\d+(?:[.,]\d+)?)/.exec(trocado.replace(/(?<=\d)[oO]|[oO](?=\d)/g, "0").replace(/(?<=\d)[lI|]|[lI|](?=\d)/g, "1"));
  return m ? Number(m[1].replace(",", ".")) : null;
}

/** Lê as palavras da foto (ou do PDF) da ficha do hospital. */
export function lerFichaDoHospital(palavrasBrutas: PalavraComConfianca[]): FichaDoHospital {
  const linhas = linhasDe(limpar(palavrasBrutas));
  const alt = mediana(limpar(palavrasBrutas).map((p) => p.y1 - p.y0)) || 1;
  const respostas: FichaDoHospital["respostas"] = {};
  const detalhes: FichaDoHospital["detalhes"] = {};

  const comRotulos = linhas.map((l) => (FAIXA.test(l.norm) && !rotulosDa(l).length ? null : rotulosDa(l)));
  let anteriores: Array<{ pergunta: Pergunta; x: number }> = [];
  for (let i = 0; i < linhas.length; i++) {
    const rotulos = comRotulos[i];
    if (!rotulos || !rotulos.length) continue;
    // As linhas de resposta: até a próxima linha de rótulos ou faixa.
    const abaixo: Linha[] = [];
    for (let j = i + 1; j < linhas.length; j++) {
      if (comRotulos[j] === null || (comRotulos[j] && comRotulos[j]!.length)) break;
      abaixo.push(linhas[j]);
    }
    const colunas = rotulos.map((r, k) => ({
      ...r,
      de: r.x - (k === 0 ? alt * 2 : alt * 1.2),
      ate: k + 1 < rotulos.length ? rotulos[k + 1].x - alt * 1.2 : Number.POSITIVE_INFINITY,
    }));
    const valorDe = (c: (typeof colunas)[number]) => {
      const pedacos: PalavraComConfianca[][] = [];
      let ultimaY = -1;
      for (const l of abaixo) {
        const ps = l.palavras.filter((p) => p.x0 >= c.de && p.x0 < c.ate
          && (p.t.length > 1 || /[\d+/<>-]/.test(p.t) || c.pergunta === "asa" || c.pergunta === "mallampati"
            || (/^[NS]$/.test(p.t) && !TEXTO_LIVRE.has(c.pergunta))));
        if (!ps.length) continue;
        // A resposta da caixa ocupa uma linha; só o texto livre ("Qual?",
        // "Cirurgia proposta") desce para a linha de baixo, colada nela.
        if (pedacos.length && (!TEXTO_LIVRE.has(c.pergunta) || l.y - ultimaY > alt * 1.9 || pedacos.length >= 3)) break;
        pedacos.push(semSujeiraNoFim(ps, alt));
        ultimaY = l.y;
      }
      return pedacos.map((ps) => ps.map((p) => p.t).join(" ")).join(" ").replace(/\s+/g, " ").trim();
    };

    if (rotulos.length === 1 && rotulos[0].pergunta === "qual") {
      // O "Qual?" de uma linha só: completa a pergunta de cima.
      const texto = valorDe(colunas[0]);
      if (texto) {
        const dona = donoDoQual(anteriores, respostas, texto);
        if (dona) detalhes[dona] = texto;
      }
      continue;
    }
    for (const c of colunas) {
      const texto = valorDe(c);
      if (!texto) continue;
      if (c.pergunta === "qual") {
        // "Já fez alguma cirurgia? | Qual?": o qual é da pergunta à esquerda.
        const esquerda = colunas.filter((x) => x.x < c.x && x.pergunta !== "qual").pop();
        if (esquerda) detalhes[esquerda.pergunta] = texto;
      } else if (!respostas[c.pergunta]) respostas[c.pergunta] = texto;
    }
    anteriores = rotulos.filter((r) => r.pergunta !== "qual");
  }

  return { paciente: pacienteDo(linhas), autor: autorDo(linhas), respostas, detalhes };
}

/** De quem é o "Qual?" sozinho: a capacidade funcional quando é faixa de METs; senão, o "Sim" da linha de cima. */
function donoDoQual(anteriores: Array<{ pergunta: Pergunta }>, respostas: FichaDoHospital["respostas"], texto: string): Pergunta | null {
  if (anteriores.some((a) => a.pergunta === "capacidade") && /^\s*(<|>|menos|mais)?\s*\d+\s*(a|-|e)?\s*\d*\s*(mets?)?\s*$/i.test(texto)) {
    return "capacidade";
  }
  return anteriores.find((a) => simOuNao(respostas[a.pergunta]) === "Sim")?.pergunta ?? anteriores[0]?.pergunta ?? null;
}

const MAIUSCULA = /^[A-ZÀ-ÖØ-Ý'’.-]+$/;

function pacienteDo(linhas: Linha[]): FichaDoHospital["paciente"] {
  const p = { nome: "", nascimento: "", sexo: "", convenio: "", prontuario: "" };
  for (const l of linhas) {
    const textos = l.palavras.map((x) => x.t);
    const iProntuario = l.norm.split(" ").findIndex((w) => /^prontu/.test(w));
    if (!p.nome && iProntuario > 0) {
      const iPaciente = l.norm.split(" ").findIndex((w) => /^paciente/.test(w));
      const nome = textos.slice(iPaciente >= 0 ? iPaciente + 1 : 0, iProntuario).filter((t) => MAIUSCULA.test(t) && t.length > 1);
      p.nome = nome.join(" ");
      const n = /prontu\w*\s+([\d.]+)/.exec(l.norm);
      if (n) p.prontuario = n[1];
    }
    if (!p.nascimento && /nascimento/.test(l.norm)) {
      const d = /(\d{2})\/(\d{2})\/(\d{4})/.exec(l.norm.slice(l.norm.indexOf("nascimento")));
      if (d) p.nascimento = `${d[3]}-${d[2]}-${d[1]}`;
    }
    if (!p.sexo && !rotulosDa(l).length) {
      const s = /\b(masculino|feminino)\b/.exec(l.norm);
      if (s) p.sexo = s[1] === "masculino" ? "Masculino" : "Feminino";
    }
    if (!p.convenio && /convenio/.test(l.norm)) {
      const depois = textos.slice(l.norm.split(" ").findIndex((w) => /convenio/.test(w)) + 1).join(" ");
      p.convenio = depois.replace(/^[\s\d:.-]+/, "").split(/\s+/)[0]?.replace(/^-+/, "") ?? "";
    }
  }
  return p;
}

function autorDo(linhas: Linha[]): FichaDoHospital["autor"] {
  const a = { crm: "", nome: "", quando: "" };
  for (const l of linhas) {
    if (!a.crm) {
      const i = l.palavras.findIndex((p) => /^crm/i.test(p.t));
      if (i >= 0) {
        const resto = l.palavras.slice(i + 1).map((p) => p.t).join(" ");
        const m = /^[:;\s]*([A-Z]{2})\s*[-–]?\s*(\d{3,7})\s+(.+)$/.exec(resto);
        if (m) {
          a.crm = `${m[1]} ${m[2]}`;
          a.nome = m[3].split(/\s+/).filter((t) => MAIUSCULA.test(t) && t.length > 1).join(" ");
        }
      }
    }
    if (!a.quando && /evento/.test(l.norm)) {
      const m = /(\d{2}\/\d{2}\/\d{4})\D{0,3}(\d{2}:\d{2})/.exec(l.palavras.map((p) => p.t).join(" "));
      if (m) a.quando = `${m[1]} ${m[2]}`;
    }
  }
  return a;
}

// ── A proposta para a ficha anestésica ────────────────────────────────────

export type ChaveDaProposta =
  | "procedimento" | "peso_kg" | "altura_cm" | "asa" | "alergias"
  | "papel_convenio" | "papel_pa" | "papel_medicacao_uso" | "papel_anestesia_anterior"
  | "papel_ap_circulatorio" | "papel_ap_respiratorio" | "papel_ap_endocrino" | "papel_estado_mental"
  | "papel_observacoes_pre";

export type CampoProposto = { chave: ChaveDaProposta; rotulo: string; valor: string };

const juntar = (partes: Array<string | false | null | undefined>, sep = "; ") => partes.filter(Boolean).join(sep);
const mmhg = (v: string | undefined) => {
  const n = numeroDe(v);
  return n !== null && n >= 30 && n <= 300 ? String(n) : "";
};

/** Mallampati e ASA em romano, com as confusões do OCR (l, 1, |). */
function romano(v: string | undefined, max: number): string {
  const s = String(v ?? "").trim().toUpperCase().replace(/[L1|]/g, "I").replace(/[^IV]/g, "");
  const romanos = ["I", "II", "III", "IV", "V", "VI"].slice(0, max);
  if (romanos.includes(s)) return s;
  const n = numeroDe(v);
  return n !== null && Number.isInteger(n) && n >= 1 && n <= max ? romanos[n - 1] : "";
}

/** O que a ficha do hospital diz, campo a campo da ficha anestésica. Campo sem resposta não aparece. */
export function propostaDaFicha(f: FichaDoHospital): CampoProposto[] {
  const r = f.respostas, d = f.detalhes;
  const sn = (k: Pergunta) => simOuNao(r[k]);
  const sim = (k: Pergunta, padrao: string) => (sn(k) === "Sim" ? d[k] || padrao : "");
  const campos: CampoProposto[] = [];
  const por = (chave: ChaveDaProposta, rotulo: string, valor: string) => {
    if (valor.trim()) campos.push({ chave, rotulo, valor: valor.trim() });
  };

  por("procedimento", "Cirurgia", r.cirurgia ?? "");
  const peso = numeroDe(r.peso);
  por("peso_kg", "Peso (kg)", peso !== null && peso > 0 && peso <= 400 ? String(peso).replace(".", ",") : "");
  let altura = numeroDe(r.altura);
  if (altura !== null && altura > 0.4 && altura < 2.6) altura = Math.round(altura * 100);
  por("altura_cm", "Altura (cm)", altura !== null && altura >= 40 && altura <= 250 ? String(altura) : "");
  por("asa", "ASA", romano(r.asa, 6));
  const pas = mmhg(r.pas), pad = mmhg(r.pad);
  por("papel_pa", "Pressão arterial", pas && pad ? `${pas}/${pad}` : "");
  por("alergias", "Alergias", sn("alergias") === "Não" ? "Nega" : sim("alergias", "Sim (sem detalhe na ficha do hospital)"));
  por("papel_convenio", "Convênio", f.paciente.convenio);

  const anticoag = r.anticoagulante?.trim() ?? "";
  por("papel_medicacao_uso", "Medicação em uso", juntar([
    sn("medicacao") === "Não" ? "Nega medicação contínua" : sim("medicacao", "Sim (sem detalhe na ficha do hospital)"),
    anticoag && (simOuNao(anticoag) === "Não" ? "nega anticoagulante" : `anticoagulante: ${anticoag}`),
  ]));
  por("papel_anestesia_anterior", "Anestesia anterior", juntar([
    sn("cirurgias") === "Não" ? "Nega cirurgias anteriores" : sim("cirurgias", "Cirurgia anterior (sem detalhe)"),
    sn("reacao") === "Não" ? "nega reação a anestesia (pessoal e familiar)" : sn("reacao") === "Sim" && `reação a anestesia: ${d.reacao || "sim"}`,
  ]));
  const mets = d.capacidade?.trim();
  por("papel_ap_circulatorio", "Ap. circulatório", juntar([
    sn("cardiovascular") === "Não" ? "Nega doença cardiovascular" : sim("cardiovascular", "Doença cardiovascular"),
    sn("sintomas") === "Sim" && "sintomas cardiovasculares",
    mets && `capacidade funcional ${mets.toLowerCase().replace(/\s*a\s*/, " a ")} METs`.replace(/mets?\s+METs/i, "METs"),
  ]));
  por("papel_ap_respiratorio", "Ap. respiratório", juntar([
    sn("respiratoria") === "Não" ? "Nega doença respiratória" : sim("respiratoria", "Doença respiratória"),
    sn("apneia") === "Sim" ? "apneia obstrutiva do sono" : sn("apneia") === "Não" && "nega apneia do sono",
  ]));
  por("papel_ap_endocrino", "Ap. endócrino", sn("diabetes") === "Não" ? "Nega diabetes" : sim("diabetes", "Diabetes"));
  por("papel_estado_mental", "Estado mental", sn("neuro") === "Não"
    ? "Nega doença neurológica ou psiquiátrica" : sim("neuro", "Doença neurológica ou psiquiátrica"));

  const negou = ([["aguda", "doença aguda"], ["habitos", "tabagismo, etilismo e drogas"], ["glaucoma", "glaucoma"]] as const)
    .filter(([k]) => sn(k) === "Não").map(([, nome]) => nome);
  // O Mallampati vem em romano, e a borda da caixa come um traço do "II": lido
  // com um sinal só ("1", "I"), não dá para saber se era I, II ou III. Aí fica
  // de fora, para o médico escrever; errar para menos é o erro perigoso.
  const lidoMallampati = String(r.mallampati ?? "").replace(/\s/g, "");
  const mallampati = lidoMallampati.length >= 2 ? romano(lidoMallampati, 4) : "";
  const viaAerea = juntar([
    mallampati && `Mallampati ${mallampati}`,
    r.abertura && `abertura bucal ${r.abertura.toLowerCase()}`,
    r.dtm && `DTM ${r.dtm.toLowerCase()}`,
    r.dentes && `dentes ${r.dentes.toLowerCase()}`,
    sn("protese") === "Sim" && "prótese dentária removível",
  ], ", ");
  por("papel_observacoes_pre", "Observações", juntar([
    sn("outras") === "Sim" && `Outras doenças: ${d.outras || "sim"}`,
    sn("aguda") === "Sim" && `Doença aguda: ${d.aguda || "sim"}`,
    sn("habitos") === "Sim" && `Tabagismo/etilismo/drogas: ${d.habitos || "sim"}`,
    sn("glaucoma") === "Sim" && "Glaucoma",
    negou.length > 0 && `Nega ${negou.join(", ").replace(/, ([^,]*)$/, " e $1")}`,
    viaAerea && `Via aérea: ${viaAerea}`,
    origemDaFicha(f),
  ]));
  return campos;
}

/** A linha que diz de onde veio: quem avaliou no hospital, e quando. */
export function origemDaFicha(f: FichaDoHospital): string {
  const quem = juntar([f.autor.crm && `CRM ${f.autor.crm}`, f.autor.nome], " ");
  return juntar(["Avaliação pré-anestésica de origem (foto)", quem, f.autor.quando], ", ") + ".";
}

/**
 * A folha da foto é deste paciente? Basta o primeiro e o último nome da
 * ficha aparecerem no nome lido (o OCR pode errar uma letra do meio). Sem
 * nome lido, não há o que conferir.
 */
export function mesmoPaciente(daFicha: string, daFoto: string): boolean {
  const partes = (s: string) => normalizar(s).split(" ").filter((p) => p.length > 2);
  const [a, b] = [partes(daFicha), partes(daFoto)];
  if (!a.length || !b.length) return true;
  return b.includes(a[0]) && b.includes(a[a.length - 1]);
}

// ── Preencher a ficha: só o que está vazio ────────────────────────────────

type Dados = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** O campo da ficha anestésica já tem alguma coisa? Então fica como está. */
export function jaPreenchido(dados: Dados, chave: ChaveDaProposta): boolean {
  switch (chave) {
    case "procedimento": return Boolean(texto(dados.procedimento));
    case "peso_kg": case "altura_cm": return typeof dados[chave] === "number";
    case "asa": return Boolean(asaRomana(dados.asa));
    case "alergias": return dados.nega_alergia === true || Boolean(texto(dados.alergias));
    default: return Boolean(camposDoPapel(dados)[chave.replace(/^papel_/, "") as CampoDoPapel]);
  }
}

/** O que a ficha já tem no campo, como se lê na tela (para a conferência mostrar o que fica). */
export function valorNaFolha(dados: Dados, chave: ChaveDaProposta): string {
  switch (chave) {
    case "procedimento": return texto(dados.procedimento);
    case "peso_kg": case "altura_cm": return typeof dados[chave] === "number" ? String(dados[chave]).replace(".", ",") : "";
    case "asa": return asaRomana(dados.asa);
    case "alergias": return dados.nega_alergia === true ? "Nega" : texto(dados.alergias);
    default: return camposDoPapel(dados)[chave.replace(/^papel_/, "") as CampoDoPapel];
  }
}

/**
 * O que gravar na ficha: os campos conferidos (o médico pode ter corrigido o
 * texto), convertidos para o formato da ficha, só onde está vazio.
 */
export function preencherAFolha(dados: Dados, campos: Array<{ chave: ChaveDaProposta; valor: string }>, lidaEm: Date, f?: FichaDoHospital): Dados {
  const parcial: Dados = {};
  for (const { chave, valor } of campos) {
    const v = valor.trim();
    if (!v || jaPreenchido(dados, chave)) continue;
    if (chave === "peso_kg" || chave === "altura_cm") {
      const n = numeroDe(v);
      const ok = n !== null && (chave === "peso_kg" ? n > 0 && n <= 400 : n >= 40 && n <= 250);
      if (ok) parcial[chave] = n;
    } else if (chave === "asa") {
      const a = asaRomana(v);
      if (a) parcial.asa = a;
    } else if (chave === "alergias") {
      Object.assign(parcial, /^nega/i.test(v) ? { nega_alergia: true, alergias: "" } : { alergias: v, nega_alergia: false });
    } else parcial[chave] = v;
  }
  if (Object.keys(parcial).length) {
    parcial.ficha_do_hospital = { lida_em: lidaEm.toISOString(), ...(f ? { crm: f.autor.crm, medico: f.autor.nome, avaliada_em: f.autor.quando } : {}) };
  }
  return parcial;
}
