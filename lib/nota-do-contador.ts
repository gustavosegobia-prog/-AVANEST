// ===========================================================================
// A folha que vai para o contador
// ===========================================================================
// O plantão é pago pelo hospital contra nota fiscal, e quem emite a nota é o
// contador — que não tem acesso ao sistema e não deve ter. O que ele precisa
// receber é uma lista fechada: quem presta, para quem, de que competência,
// quais dias, quantas horas, quanto no total.
//
// Hoje isso é feito de memória ou por um print de tela, e as duas formas erram
// do mesmo jeito: um plantão a menos na lista é uma nota emitida a menor, e o
// erro só aparece quando o dinheiro não bate — semanas depois, quando ninguém
// mais lembra de qual mês era.
//
// ---------------------------------------------------------------------------
// A REGRA MAIS IMPORTANTE DESTE ARQUIVO: NÃO INVENTAR DOCUMENTO.
//
// CNPJ ausente vira um traço e um aviso na própria folha, nunca um palpite. O
// contador que recebe um CNPJ errado emite a nota para a empresa errada, e
// desfazer isso custa muito mais do que preencher o cadastro. Um campo em
// branco pede uma pergunta; um campo errado não pede nada — e é por isso que
// ele é pior.
// ===========================================================================

import type { LinhaDePlanilha } from "./planilha.ts";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
               "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-08" -> "agosto de 2026" */
export const competenciaPorExtenso = (mes: string) =>
  `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes} de ${mes.slice(0, 4)}`;

const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/**
 * O CNPJ como se escreve, a partir do que estiver guardado.
 *
 * O cadastro aceita os dois jeitos — "06339994000151" e "06.339.994/0001-51" —
 * porque foi digitado por gente diferente em momentos diferentes. Na folha do
 * contador ele sai sempre pontuado: é assim que se confere contra um documento,
 * e catorze dígitos corridos é onde o olho troca um número sem perceber.
 *
 * O que não tiver catorze dígitos volta como está. Corrigir um CNPJ malformado
 * seria adivinhar qual dígito falta.
 */
export function cnpjEscrito(bruto: string | null | undefined): string {
  const so = String(bruto ?? "").replace(/\D/g, "");
  if (so.length !== 14) return String(bruto ?? "").trim();
  return `${so.slice(0, 2)}.${so.slice(2, 5)}.${so.slice(5, 8)}/${so.slice(8, 12)}-${so.slice(12)}`;
}

export type PlantaoDaNota = {
  data: string;
  /** "07h–19h", já escrito. Quem monta sabe o formato; aqui é texto. */
  turno: string;
  horas: number;
  valor: number;
};

export type DadosDaNota = {
  /** A pessoa jurídica que emite. Nome e CNPJ podem faltar. */
  prestador: { nome: string; cnpj?: string | null };
  /** Quem assina o trabalho: nome e registro. */
  profissional: { nome: string; crm?: string | null };
  /** O hospital que vai pagar. */
  tomador: { nome: string; cnpj?: string | null };
  /** "AAAA-MM" do mês dos plantões. */
  competencia: string;
  /** "AAAA-MM-DD" da emissão, quando já houve. */
  emitidaEm?: string | null;
  plantoes: PlantaoDaNota[];
};

const SEM_DADO = "—";

/**
 * O que falta preencher antes de mandar.
 *
 * Sai na própria folha, e em português de gente: o contador abre a planilha e
 * já sabe o que perguntar, em vez de responder um e-mail dois dias depois. A
 * lista é curta de propósito — só o que impede a nota de ser emitida.
 */
export function faltaPreencher(dados: DadosDaNota): string[] {
  const falta: string[] = [];
  if (!String(dados.prestador.cnpj ?? "").trim()) {
    falta.push("CNPJ do prestador (cadastre em Admin › Organização)");
  }
  if (!String(dados.tomador.cnpj ?? "").trim()) {
    falta.push(`CNPJ de ${dados.tomador.nome} (cadastre em Locais de atendimento)`);
  }
  return falta;
}

/**
 * A folha inteira, pronta para virar planilha.
 *
 * CABEÇALHO EM PARES rótulo/valor, e não uma linha de colunas: são seis
 * informações que não se repetem, e postas em colunas obrigariam quem lê a
 * rolar para o lado para achar o CNPJ. A tabela dos plantões começa depois de
 * uma linha em branco — que é o que faz o Excel entender as duas partes como
 * duas coisas.
 *
 * OS NÚMEROS SAEM COMO NÚMERO, e não como texto formatado. É o que permite ao
 * contador somar a coluna, filtrar e conferir por conta própria; uma planilha
 * com "R$ 2.000,00" em cada célula é uma imagem de planilha.
 */
export function folhaDaNota(dados: DadosDaNota): LinhaDePlanilha[] {
  const linhas: LinhaDePlanilha[] = [
    ["RELATÓRIO PARA EMISSÃO DE NOTA FISCAL"],
    [],
    ["Prestador", dados.prestador.nome || SEM_DADO],
    ["CNPJ do prestador", cnpjEscrito(dados.prestador.cnpj) || SEM_DADO],
    ["Profissional", dados.profissional.nome || SEM_DADO],
    ["CRM", String(dados.profissional.crm ?? "").trim() || SEM_DADO],
    ["Tomador", dados.tomador.nome || SEM_DADO],
    ["CNPJ do tomador", cnpjEscrito(dados.tomador.cnpj) || SEM_DADO],
    ["Competência", competenciaPorExtenso(dados.competencia)],
    ["Serviço", "Plantões de anestesiologia"],
  ];
  if (dados.emitidaEm) linhas.push(["Nota emitida em", dataBR(dados.emitidaEm)]);

  const pendencias = faltaPreencher(dados);
  if (pendencias.length) {
    linhas.push([]);
    linhas.push(["FALTA PREENCHER, confira antes de emitir:"]);
    for (const p of pendencias) linhas.push(["", p]);
  }

  linhas.push([]);
  linhas.push(["Data", "Turno", "Horas", "Valor (R$)"]);
  // Por data, do primeiro ao último dia: é a ordem em que o hospital confere
  // contra a própria escala, e a ordem em que a pessoa lembra do mês.
  const ordenados = [...dados.plantoes].sort((a, b) => a.data.localeCompare(b.data));
  for (const p of ordenados) {
    linhas.push([dataBR(p.data), p.turno, Number(p.horas || 0), Number(p.valor || 0)]);
  }

  const horas = ordenados.reduce((s, p) => s + Number(p.horas || 0), 0);
  const valor = ordenados.reduce((s, p) => s + Number(p.valor || 0), 0);
  linhas.push([
    `TOTAL — ${ordenados.length} ${ordenados.length === 1 ? "plantão" : "plantões"}`,
    "", horas, valor,
  ]);
  return linhas;
}

/**
 * O nome do arquivo que chega ao contador.
 *
 * O nome do tomador entra, e é o que resolve a caixa de entrada dele: três
 * hospitais no mesmo mês produziriam três arquivos de nome igual, e o segundo
 * sobrescreveria o primeiro na pasta de downloads sem avisar.
 */
export function nomeDaFolhaDaNota(tomador: string, competencia: string): string {
  const limpo = tomador
    // Os acentos saem pela faixa de marcas combinantes, escrita por código:
    // o mesmo caractere digitado direto na expressão é invisível no editor
    // e some numa cópia descuidada.
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `avanest-nota-${limpo || "plantoes"}-${competencia}.xlsx`;
}
