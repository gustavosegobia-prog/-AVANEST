// Planilha para mandar ao contador.
//
// A Escala já imprimia duas folhas — plantões por hospital e faturamento por
// pagador —, e elas resolvem o caso de levar papel ao hospital. Não resolvem o
// outro: mandar por e-mail para quem emite a nota. Contador não redigita PDF,
// e ninguém quer conferir vinte plantões a olho antes de somar.
//
// CSV, e não .xlsx. O formato do Excel é um zip de XML com estilos e relações
// entre arquivos, e gerá-lo à mão significaria carregar uma biblioteca inteira
// no navegador para um arquivo de trinta linhas. O CSV daqui abre com dois
// cliques no Excel, no LibreOffice e no Google Planilhas, e é o que o contador
// consegue reimportar no sistema dele.
//
// Três detalhes fazem esse CSV abrir certo em português, e cada um deles é um
// bug conhecido de quem gera planilha:
//
//   BOM       sem ele o Excel do Windows lê UTF-8 como Latin-1 e "anestésica"
//             vira "anestÃ©sica" na primeira coluna.
//   ponto e   o Excel em pt-BR usa a vírgula como separador DECIMAL, então o
//   vírgula   separador de coluna tem de ser ";". Com vírgula, "1,50" vira
//             duas células.
//   CRLF      o fim de linha do Windows, que é onde a planilha é aberta.

/** Uma linha da planilha. Cada item vira uma célula. */
export type LinhaDePlanilha = Array<string | number>;

/** Número no formato que o Excel em português entende como número. */
export const numeroBR = (valor: number) =>
  Number(valor || 0).toFixed(2).replace(".", ",");

/**
 * Uma célula segura.
 *
 * Tudo entre aspas, sempre — e não só o que tem ponto e vírgula. Campo livre
 * como o nome do paciente ou a observação do plantão pode conter aspas, quebra
 * de linha ou o próprio separador, e a regra "só cita quando precisa" erra
 * justamente nesses. Aspas de dentro viram aspas dobradas, que é como o CSV as
 * escapa.
 */
const celula = (valor: string | number) => `"${String(valor ?? "").replaceAll('"', '""')}"`;

/** Junta as linhas no texto final do arquivo. */
export function paraCSV(linhas: LinhaDePlanilha[]) {
  return "﻿" + linhas.map((linha) => linha.map(celula).join(";")).join("\r\n");
}

// ── As duas planilhas ───────────────────────────────────────────────────────

export type PlantaoParaPlanilha = {
  data: string;
  local: string;
  turno: string;
  horas: number;
  valor: number;
  situacao: string;
  profissional?: string;
};

const SITUACAO_PLANTAO: Record<string, string> = {
  escalado: "Escalado", realizado: "Realizado", pago: "Pago", cancelado: "Cancelado",
};

const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/**
 * A planilha dos plantões do mês.
 *
 * Uma linha por plantão e uma de TOTAL no fim. O total vem pronto de propósito:
 * a folha impressa passou a trazê-lo depois de você pedir, e uma planilha que
 * obrigasse a somar de novo devolveria o trabalho que a folha tinha tirado.
 *
 * A coluna do profissional só aparece quando há mais de um — num serviço de uma
 * pessoa ela seria o mesmo nome repetido trinta vezes, e coluna que não separa
 * nada só atrapalha quem vai ler.
 */
export function planilhaDePlantoes(plantoes: PlantaoParaPlanilha[]): LinhaDePlanilha[] {
  const varios = new Set(plantoes.map((p) => p.profissional).filter(Boolean)).size > 1;
  const cabecalho = ["Data", "Local", "Turno", "Horas", "Valor", "Situação"];
  if (varios) cabecalho.splice(1, 0, "Profissional");

  const linhas: LinhaDePlanilha[] = [cabecalho];
  for (const p of plantoes) {
    const linha: LinhaDePlanilha = [
      dataBR(p.data), p.local, p.turno, numeroBR(p.horas), numeroBR(p.valor),
      SITUACAO_PLANTAO[p.situacao] ?? p.situacao,
    ];
    if (varios) linha.splice(1, 0, p.profissional ?? "");
    linhas.push(linha);
  }

  const horas = plantoes.reduce((s, p) => s + Number(p.horas || 0), 0);
  const valor = plantoes.reduce((s, p) => s + Number(p.valor || 0), 0);
  const total: LinhaDePlanilha = ["TOTAL", "", "", numeroBR(horas), numeroBR(valor), ""];
  if (varios) total.splice(1, 0, "");
  linhas.push(total);
  return linhas;
}

export type ProducaoParaPlanilha = {
  data: string;
  paciente: string;
  convenio: string;
  procedimento?: string | null;
  local?: string | null;
  pagador?: string | null;
  valor: number;
  situacao: string;
};

const SITUACAO_PRODUCAO: Record<string, string> = {
  a_cobrar: "A cobrar", faturado: "Faturado", recebido: "Recebido", glosado: "Glosado",
};

const ROTULO_PAGADOR: Record<string, string> = {
  direto: "Paciente", hospital: "Hospital", convenio: "Convênio",
};

/**
 * A planilha do que foi anestesiado no mês.
 *
 * É a que vai para quem emite a nota: paciente, convênio, quem paga e valor.
 * Sem procedimento em coluna própria quando ninguém preencheu — coluna vazia em
 * planilha enviada por e-mail parece dado que se perdeu no caminho.
 */
export function planilhaDeFaturamento(itens: ProducaoParaPlanilha[]): LinhaDePlanilha[] {
  const temProcedimento = itens.some((i) => i.procedimento?.trim());
  const temLocal = itens.some((i) => i.local?.trim());

  const cabecalho = ["Data", "Paciente", "Convênio"];
  if (temProcedimento) cabecalho.push("Procedimento");
  if (temLocal) cabecalho.push("Local");
  cabecalho.push("Quem paga", "Valor", "Situação");

  const linhas: LinhaDePlanilha[] = [cabecalho];
  for (const i of itens) {
    const linha: LinhaDePlanilha = [dataBR(i.data), i.paciente, i.convenio];
    if (temProcedimento) linha.push(i.procedimento ?? "");
    if (temLocal) linha.push(i.local ?? "");
    linha.push(
      i.pagador ? (ROTULO_PAGADOR[i.pagador] ?? i.pagador) : "",
      numeroBR(i.valor),
      SITUACAO_PRODUCAO[i.situacao] ?? i.situacao,
    );
    linhas.push(linha);
  }

  const valor = itens.reduce((s, i) => s + Number(i.valor || 0), 0);
  const total: LinhaDePlanilha = ["TOTAL", "", ""];
  if (temProcedimento) total.push("");
  if (temLocal) total.push("");
  total.push("", numeroBR(valor), "");
  linhas.push(total);
  return linhas;
}

/**
 * Um nome de arquivo que se organiza sozinho na pasta de downloads.
 *
 * Ano-mês, e não mês-ano: assim a ordem alfabética é a ordem cronológica, e
 * doze meses de plantão ficam em sequência em vez de agrupados por mês de anos
 * diferentes.
 */
export const nomeDoArquivo = (assunto: string, mes: string) =>
  `avanest-${assunto}-${mes}.csv`;

/**
 * Manda o arquivo para a pasta de downloads.
 *
 * Só roda no navegador. `revokeObjectURL` no fim porque a URL do Blob segura o
 * conteúdo inteiro na memória da aba até ser solta — uma planilha por mês
 * durante uma sessão longa vira lixo acumulado que ninguém vê.
 */
export function baixarCSV(nome: string, linhas: LinhaDePlanilha[]) {
  const url = URL.createObjectURL(
    new Blob([paraCSV(linhas)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
