// O que a folha impressa precisa saber e a tela não: em quantas folhas A4 o
// procedimento se divide, o que cabe em cada coluna de 15 minutos, e como se
// escreve em uma linha a técnica, a saída da sala e a idade.
//
// O papel não reinterpreta nada. Os pontos, as doses e os horários são os
// mesmos registros vigentes da tela; aqui só se decide a diagramação.

import { num, type Registro } from "./registros.ts";
import { TECNICAS, rotuloDoEvento } from "./folha.ts";
import {
  CATALOGO, CATEGORIAS, agruparPorMedicamento, mesmoMedicamento,
  type Administracao, type Agrupado, type Categoria,
} from "./medicamentos.ts";
import { lerAjuste } from "./sevoflurano.ts";
import { rotuloDoLiquido } from "./liquidos.ts";

type Dados = Record<string, unknown>;
const t = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const sub = (d: Dados, k: string) => ((d[k] as Dados | undefined) ?? {});
const juntar = (partes: Array<string | false | null | undefined>, sep = ", ") =>
  partes.filter((p): p is string => Boolean(p && p.trim())).join(sep);

// ---------------------------------------------------------------------------
// Números e horários no papel
// ---------------------------------------------------------------------------
export function numero(v: number, casas = 2) {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
const DIA_ISO = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" });
export const hora = (iso: string | number) => HORA.format(new Date(iso));
export const dataHora = (iso: string | number) => `${DATA.format(new Date(iso))} ${HORA.format(new Date(iso))}`;

/** "2026-10-11" → "11/10/2026", sem passar por fuso (é uma data, não um instante). */
export function dataDoDia(iso: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * A idade como o anestesiologista lê: dias no recém-nascido, meses até os
 * dois anos, anos e meses até os doze, anos daí em diante. Em pediatria a
 * diferença entre "1 ano" e "1 ano e 11 meses" muda a conta.
 */
export function idadeParaImpressao(nascimento: string | null | undefined, em: Date, idadeAnos?: number | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nascimento ?? "");
  if (!m) return typeof idadeAnos === "number" ? `${idadeAnos} ${idadeAnos === 1 ? "ano" : "anos"}` : "";
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [ha, hm, hd] = DIA_ISO.format(em).split("-").map(Number);
  const hoje = { a: ha, m: hm, d: hd };
  let meses = (hoje.a - a) * 12 + (hoje.m - mes);
  if (hoje.d < d) meses -= 1;
  if (meses < 0) return "";
  if (meses < 1) {
    const dias = Math.round((Date.UTC(hoje.a, hoje.m - 1, hoje.d) - Date.UTC(a, mes - 1, d)) / 86400000);
    return `${dias} ${dias === 1 ? "dia" : "dias"}`;
  }
  if (meses < 24) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12), resto = meses % 12;
  if (anos < 12 && resto) return `${anos} anos e ${resto} ${resto === 1 ? "mês" : "meses"}`;
  return `${anos} anos`;
}

// ---------------------------------------------------------------------------
// As folhas e as colunas
// ---------------------------------------------------------------------------
/** Uma coluna da folha de papel é 15 minutos; doze colunas, três horas. */
export const COLUNA_MIN = 15;
export const COLUNAS_POR_FOLHA = 12;

export type Janela = { inicio: number; fim: number };

/**
 * As folhas do procedimento. A primeira começa na coluna cheia antes do
 * primeiro registro; cada uma cobre três horas; a última vai até o fim da
 * anestesia (ou até a impressão, com a folha aberta). Sempre ao menos uma.
 */
export function janelasDaImpressao(inicioMs: number, fimMs: number): Janela[] {
  const passo = COLUNA_MIN * 60000;
  const largura = passo * COLUNAS_POR_FOLHA;
  const comeco = Math.floor(inicioMs / passo) * passo;
  const saida: Janela[] = [];
  for (let i = comeco; saida.length === 0 || i < fimMs; i += largura) saida.push({ inicio: i, fim: i + largura });
  return saida;
}

/**
 * O que se escreve numa coluna de uma linha (SpO₂, EtCO₂, temperatura). Todos
 * os valores, na ordem do horário, enquanto couberem na coluna (um
 * centímetro); se não couberem, o menor e o maior — nenhum valor some sem
 * deixar rastro: o extremo fica. Valores iguais viram um só.
 */
export function textoDaColuna(valores: readonly number[], casas = 0, caberMax = 9): string {
  if (!valores.length) return "";
  const f = (v: number) => numero(v, casas);
  const todos = valores.map(f).join(" ");
  if (todos.length <= caberMax) return todos;
  const min = Math.min(...valores), max = Math.max(...valores);
  return min === max ? f(min) : `${f(min)}–${f(max)}`;
}

/** Os valores de um parâmetro de linha, coluna a coluna, numa folha. */
export function colunasDeValores(
  vigentes: readonly Registro[], parametro: string, janela: Janela,
): number[][] {
  const colunas: number[][] = Array.from({ length: COLUNAS_POR_FOLHA }, () => []);
  for (const r of vigentes) {
    if (r.tipo !== "sinal" || r.dados.parametro !== parametro) continue;
    const v = num(r.dados.valor);
    const ms = Date.parse(r.momento);
    if (v === null || ms < janela.inicio || ms >= janela.fim) continue;
    colunas[Math.floor((ms - janela.inicio) / (COLUNA_MIN * 60000))].push(v);
  }
  return colunas;
}

// ---------------------------------------------------------------------------
// Eventos: X para a anestesia, O para a operação — o código da folha de papel
// ---------------------------------------------------------------------------
export type MarcaDeEvento = { id: string; momento: string; simbolo: string; rotulo: string };

export function marcasDeEvento(vigentes: readonly Registro[]): MarcaDeEvento[] {
  let n = 0;
  return vigentes.filter((r) => r.tipo === "evento")
    .sort((a, b) => Date.parse(a.momento) - Date.parse(b.momento))
    .map((r) => {
      const codigo = String(r.dados.codigo ?? "");
      const rotulo = rotuloDoEvento(codigo, t(r.dados.descricao));
      const simbolo = codigo === "inicio_anestesia" || codigo === "fim_anestesia" ? "X"
        : codigo === "inicio_cirurgia" || codigo === "fim_cirurgia" ? "O"
          : String(++n);
      return { id: r.id, momento: r.momento, simbolo, rotulo };
    });
}

/**
 * A faixa dos eventos tem duas pistas. Marcas a menos de `distancia` uma da
 * outra (em mm no papel) vão para a outra pista, em vez de se sobreporem — a
 * indução dois minutos depois do início da anestesia tem de ser legível.
 */
export function pistasDeEventos(xs: readonly number[], distancia: number, pistas = 2): number[] {
  const ultimo = Array.from({ length: pistas }, () => Number.NEGATIVE_INFINITY);
  return xs.map((x) => {
    let pista = ultimo.findIndex((u) => x - u >= distancia);
    if (pista < 0) pista = ultimo.indexOf(Math.min(...ultimo));
    ultimo[pista] = x;
    return pista;
  });
}

// ---------------------------------------------------------------------------
// Gases: o ajuste vale até o próximo
// ---------------------------------------------------------------------------
export type LinhaDeGas = {
  chave: "o2" | "ar" | "n2o" | "sevo"; rotulo: string;
  passos: Array<{ momento: string; valor: number; id: string }>;
};

/**
 * Cada linha mostra o valor só quando ele MUDA — repetir "2" em toda coluna
 * é ruído. O₂ e sevoflurano aparecem sempre; ar e N₂O, só se usados.
 */
export function linhasDeGas(vigentes: readonly Registro[]): LinhaDeGas[] {
  const ajustes = vigentes.filter((r) => r.tipo === "gas")
    .map((r) => ({ ...lerAjuste(r)!, id: r.id }))
    .sort((a, b) => Date.parse(a.momento) - Date.parse(b.momento));
  const linha = (chave: LinhaDeGas["chave"], rotulo: string, ler: (a: (typeof ajustes)[number]) => number): LinhaDeGas => {
    const passos: LinhaDeGas["passos"] = [];
    for (const a of ajustes) {
      const v = ler(a);
      // Zero no começo é "ainda não ligou": não se escreve.
      if (!passos.length && v === 0) continue;
      if (passos.length && passos[passos.length - 1].valor === v) continue;
      passos.push({ momento: a.momento, valor: v, id: a.id });
    }
    return { chave, rotulo, passos };
  };
  const todas = [
    linha("o2", "O₂ (L/min)", (a) => a.o2),
    linha("ar", "Ar comprimido (L/min)", (a) => a.ar),
    linha("n2o", "N₂O (L/min)", (a) => a.n2o),
    linha("sevo", "Sevoflurano (%)", (a) => a.sevoPct),
  ];
  return todas.filter((l) => l.chave === "o2" || l.chave === "sevo" || l.passos.length > 0);
}

// ---------------------------------------------------------------------------
// Líquidos: uma linha por solução, os volumes na coluna do horário
// ---------------------------------------------------------------------------
export type LinhaDeLiquido = {
  rotulo: string; sentido: "entrada" | "saida"; total: number;
  /** A categoria do primeiro registro da linha — para o próximo da mesma solução. */
  categoria: string;
  itens: Array<{ momento: string; volume: number; id: string }>;
};

export function linhasDeLiquido(vigentes: readonly Registro[]): LinhaDeLiquido[] {
  const linhas: LinhaDeLiquido[] = [];
  for (const r of vigentes) {
    if (r.tipo !== "liquido") continue;
    const v = num(r.dados.volume_ml);
    if (v === null) continue;
    const sentido = r.dados.sentido === "saida" ? "saida" : "entrada";
    const rotulo = rotuloDoLiquido(r.dados);
    let l = linhas.find((x) => x.sentido === sentido && mesmoMedicamento(x.rotulo, rotulo));
    if (!l) { l = { rotulo, sentido, total: 0, categoria: String(r.dados.categoria ?? ""), itens: [] }; linhas.push(l); }
    l.itens.push({ momento: r.momento, volume: v, id: r.id });
    l.total = Math.round((l.total + v) * 10) / 10;
  }
  // Entradas primeiro; a diurese sempre tem linha, como no papel.
  if (!linhas.some((l) => l.rotulo === "Diurese")) linhas.push({ rotulo: "Diurese", sentido: "saida", total: 0, categoria: "diurese", itens: [] });
  return [...linhas.filter((l) => l.sentido === "entrada"), ...linhas.filter((l) => l.sentido === "saida")];
}

// ---------------------------------------------------------------------------
// Medicação: só o que foi administrado, por grupo, com horário e total
// ---------------------------------------------------------------------------
export function categoriaDe(nome: string): Categoria {
  const item = CATALOGO.find((c) => mesmoMedicamento(c.nome, nome) || c.sinonimos.some((s) => mesmoMedicamento(s, nome)));
  return item?.categoria ?? "outros";
}

export type GrupoDeMedicacao = { categoria: Categoria; titulo: string; medicamentos: Agrupado[] };

/** Na ordem dos grupos do catálogo; grupo sem nada administrado não aparece. */
export function medicacaoPorGrupo(lista: readonly Administracao[]): GrupoDeMedicacao[] {
  const ordem = Object.keys(CATEGORIAS) as Categoria[];
  return ordem.map((categoria) => ({
    categoria,
    titulo: CATEGORIAS[categoria],
    medicamentos: agruparPorMedicamento(lista.filter((a) => categoriaDe(a.nome) === categoria)),
  })).filter((g) => g.medicamentos.length);
}

// ---------------------------------------------------------------------------
// Técnica, posição e saída em texto corrido
// ---------------------------------------------------------------------------
/**
 * Uma linha por técnica feita, só com o que foi preenchido. A folha de papel
 * tem todas as opções com bolinhas; a impressão dinâmica escreve o que
 * aconteceu — o que não se fez não ocupa linha.
 */
export function descreverTecnica(dados: Dados): string[] {
  const tecnicas = (dados.tecnicas as string[] | undefined) ?? [];
  const det = sub(dados, "tecnica_detalhes");
  const g = sub(det, "geral"), r = sub(det, "raqui"), p = sub(det, "peridural"), s = sub(det, "sedacao"), b = sub(det, "bloqueio");
  const rotulo = (c: string) => TECNICAS.find((x) => x.codigo === c)?.rotulo ?? c;
  const linhas: string[] = [];

  const gerais = tecnicas.filter((c) => c.startsWith("geral"));
  if (gerais.length) {
    const via = juntar([
      t(g.dispositivo) && `${t(g.dispositivo)}${t(g.numero) ? ` ${t(g.numero)}` : ""}`,
      t(g.cormack) && `Cormack-Lehane ${t(g.cormack)}`,
      t(g.laringoscopia),
    ]);
    const vent = juntar([
      t(g.modo) && `ventilação ${t(g.modo)}`,
      t(g.vc) && `VC ${t(g.vc)} mL`,
      t(g.pcv) && `pressão ${t(g.pcv)}`,
      t(g.peep) && `PEEP ${t(g.peep)}`,
      t(g.fr) && `FR ${t(g.fr)}`,
    ]);
    linhas.push(juntar([`Anestesia ${gerais.map((c) => rotulo(c).toLowerCase()).join(" + ")}`, via, vent], "; "));
  }
  if (tecnicas.includes("raquianestesia") || tecnicas.includes("combinada")) {
    linhas.push(juntar([
      tecnicas.includes("combinada") ? "Raqui-peridural combinada — raqui" : "Raquianestesia",
      t(r.espaco), t(r.agulha) && `agulha ${t(r.agulha)}`, t(r.abordagem).toLowerCase(),
      r.puncao_unica === true && "punção única", r.lcr_claro === true && "LCR claro", t(r.obs),
    ]));
  }
  if (tecnicas.includes("peridural") || tecnicas.includes("combinada")) {
    linhas.push(juntar([
      "Peridural", t(p.espaco), t(p.agulha) && `agulha ${t(p.agulha)}`, t(p.identificacao),
      p.cateter === true && `cateter${t(p.cateter_cm) ? ` a ${t(p.cateter_cm)} cm na pele` : ""}`,
      t(p.dose_teste) && `dose-teste ${t(p.dose_teste)}`,
    ]));
  }
  if (tecnicas.includes("sedacao")) {
    const v = (s.ventilacao as string[] | undefined) ?? [];
    linhas.push(juntar(["Sedação", v.length > 0 && `ventilação: ${v.join(", ").toLowerCase()}`]));
  }
  if (tecnicas.includes("bloqueio_periferico")) {
    const tipos = (b.tipos as string[] | undefined) ?? [];
    linhas.push(juntar([
      "Bloqueio periférico", tipos.join(", ").toLowerCase(), t(b.lado) && `lado ${t(b.lado)}`,
      b.usg === true && "guiado por ultrassom", b.neuroestimulador === true && "neuroestimulador",
      t(b.agulha) && `agulha ${t(b.agulha)}`,
    ]));
  }
  if (tecnicas.includes("local_assistida")) linhas.push("Local assistida");
  return linhas;
}

export function descreverPosicao(dados: Dados): string {
  const posicoes = (dados.posicoes as string[] | undefined) ?? [];
  const protecoes = (dados.protecoes as string[] | undefined) ?? [];
  return juntar([
    posicoes.length > 0 && `Posição: ${posicoes.join(", ")}`,
    protecoes.length > 0 && `Proteções: ${protecoes.join(", ").toLowerCase()}`,
  ], " · ");
}

export function descreverSaida(dados: Dados): string {
  const s = sub(dados, "saida");
  const destino = s.destino === "Outro" ? t(s.destino_outro) || "outro destino" : t(s.destino);
  return juntar([
    destino && `Alta da sala para ${destino}`,
    t(s.consciencia) && t(s.consciencia).toLowerCase(),
    s.estavel === true && "estável",
    t(s.pa) && `PA ${t(s.pa)}`,
    t(s.fc) && `FC ${t(s.fc)}`,
    t(s.spo2) && `SpO₂ ${t(s.spo2).replace(/%$/, "")}%`,
    t(s.oxigenio) && t(s.oxigenio).replace("Sem", "sem").replace("Com", "com"),
  ]);
}
