// A coluna de medicação da folha de papel, e as faixas pré-impressas.
//
// Na ficha do serviço a coluna da direita vem impressa com os medicamentos de
// sempre, por momento da anestesia — antibioticoprofilaxia, sedação, raqui,
// geral, bloqueio, outras drogas — e o anestesiologista marca o que fez. A
// tela mostra a lista INTEIRA, para marcar com um toque; a impressão leva só
// o que foi administrado.
//
// SEM DOSE. A lista tem nome, nome comercial, unidade de escrita e a via de
// costume do grupo (raqui é intratecal; bloqueio é perineural). A dose é
// sempre a que o médico digita.

import { mesmoFarmaco, type UnidadeDeDose } from "./medicamentos.ts";
import type { Registro } from "./registros.ts";

export type CodigoDoGrupo = "antibiotico" | "sedacao" | "neuroeixo" | "geral" | "bloqueio" | "outras";

export type ItemDaLista = {
  nome: string;
  /** Como aparece na lista, quando difere do nome (ex.: o nome comercial do papel). */
  rotulo?: string;
  unidade: UnidadeDeDose;
  via?: string;
  apresentacao?: string;
};

export type GrupoDaLista = {
  codigo: CodigoDoGrupo;
  titulo: string;
  via: string;
  forma: "bolus" | "neuroeixo" | "bloqueio";
  indicacao?: string;
  itens: ItemDaLista[];
};

export const LISTA_DA_FOLHA: GrupoDaLista[] = [
  {
    codigo: "antibiotico", titulo: "Antibioticoprofilaxia", via: "EV", forma: "bolus", indicacao: "Antibioticoprofilaxia",
    itens: [{ nome: "Cefazolina", rotulo: "Cefazolina (Kefazol)", unidade: "g" }],
  },
  {
    codigo: "sedacao", titulo: "Sedação", via: "EV", forma: "bolus",
    itens: [
      { nome: "Midazolam", rotulo: "Midazolam (Dormonid)", unidade: "mg" },
      { nome: "Fentanil", unidade: "mcg" },
      { nome: "Cetamina", unidade: "mg" },
      { nome: "Propofol", unidade: "mg" },
      { nome: "Lidocaína", rotulo: "Lidocaína s/ vaso", unidade: "mg" },
      { nome: "Dexmedetomidina", rotulo: "Dexmedetomidina (Precedex)", unidade: "mcg" },
      { nome: "Droperidol", unidade: "mg" },
    ],
  },
  {
    codigo: "neuroeixo", titulo: "Raqui / peridural", via: "intratecal", forma: "neuroeixo",
    itens: [
      { nome: "Bupivacaína", rotulo: "Bupivacaína pesada (Neocaína)", unidade: "mg", apresentacao: "pesada (hiperbárica)" },
      { nome: "Bupivacaína", rotulo: "Bupivacaína isobárica", unidade: "mg", apresentacao: "isobárica" },
      { nome: "Morfina", rotulo: "+ Morfina (Dimorf)", unidade: "mcg" },
      { nome: "Fentanil", rotulo: "+ Fentanil", unidade: "mcg" },
      { nome: "Clonidina", rotulo: "+ Clonidina", unidade: "mcg" },
    ],
  },
  {
    codigo: "geral", titulo: "Anestesia geral", via: "EV", forma: "bolus",
    itens: [
      { nome: "Midazolam", rotulo: "Midazolam (Dormonid)", unidade: "mg" },
      { nome: "Fentanil", unidade: "mcg" },
      { nome: "Propofol", unidade: "mg" },
      { nome: "Lidocaína", rotulo: "Lidocaína s/ vaso", unidade: "mg" },
      { nome: "Succinilcolina", rotulo: "Succinilcolina (Quelicin)", unidade: "mg" },
      { nome: "Cisatracúrio", unidade: "mg" },
      { nome: "Atracúrio", unidade: "mg" },
      { nome: "Rocurônio", unidade: "mg" },
      { nome: "Cetamina", unidade: "mg" },
      { nome: "Etomidato", unidade: "mg" },
      { nome: "Remifentanil", unidade: "mcg" },
      { nome: "Dexmedetomidina", rotulo: "Dexmedetomidina (Precedex)", unidade: "mcg" },
    ],
  },
  {
    codigo: "bloqueio", titulo: "Bloqueio", via: "perineural", forma: "bloqueio",
    itens: [
      { nome: "Lidocaína", rotulo: "Lidocaína c/ ou s/ vaso", unidade: "mg" },
      { nome: "Levobupivacaína", rotulo: "Levobupivacaína c/ ou s/ vaso", unidade: "mg" },
      { nome: "Bupivacaína", rotulo: "Bupivacaína c/ ou s/ vaso", unidade: "mg" },
      { nome: "Ropivacaína", unidade: "mg" },
    ],
  },
  {
    codigo: "outras", titulo: "Outras drogas", via: "EV", forma: "bolus",
    itens: [
      { nome: "Metaraminol", rotulo: "Metaraminol (Aramin)", unidade: "mg" },
      { nome: "Efedrina", unidade: "mg" },
      { nome: "Dexametasona", unidade: "mg" },
      { nome: "Bromoprida", unidade: "mg" },
      { nome: "Metoclopramida", rotulo: "Metoclopramida (Plasil)", unidade: "mg" },
      { nome: "Ondansetrona", rotulo: "Ondansetrona (Vonau)", unidade: "mg" },
      { nome: "Dipirona", unidade: "g" },
      { nome: "Tenoxicam", rotulo: "Tenoxicam (Tilatil)", unidade: "mg" },
      { nome: "Cetorolaco", unidade: "mg" },
      { nome: "Ocitocina", unidade: "UI" },
      { nome: "Metilergometrina", unidade: "mg", via: "IM" },
      { nome: "Hidrocortisona", unidade: "mg" },
      { nome: "Metadona", unidade: "mg" },
      { nome: "Morfina", rotulo: "Morfina (Dimorf)", unidade: "mg" },
      { nome: "Atropina", unidade: "mg" },
      { nome: "Neostigmina", unidade: "mg" },
      { nome: "Sugamadex", unidade: "mg" },
      { nome: "Ácido tranexâmico", rotulo: "Ácido tranexâmico (Transamin)", unidade: "g" },
      { nome: "Noradrenalina", unidade: "mcg" },
      { nome: "Escopolamina", rotulo: "Escopolamina (Buscopan)", unidade: "mg" },
    ],
  },
];

export const TITULO_DO_GRUPO = Object.fromEntries(LISTA_DA_FOLHA.map((g) => [g.codigo, g.titulo])) as Record<CodigoDoGrupo, string>;

const naLista = (codigo: CodigoDoGrupo, nome: string) =>
  LISTA_DA_FOLHA.find((g) => g.codigo === codigo)!.itens.some((i) => mesmoFarmaco(i.nome, nome));

/**
 * Em que grupo do papel uma administração aparece. O grupo tocado na lista
 * fica gravado no registro e manda; sem ele (veio da busca), a via decide
 * (intratecal/peridural → raqui; perineural → bloqueio), depois a indicação, e
 * por fim a técnica da folha separa sedação de anestesia geral.
 */
export function grupoDaAdministracao(r: Registro, tecnicas: readonly string[]): CodigoDoGrupo {
  const d = r.dados;
  const gravado = String(d.grupo ?? "");
  if (LISTA_DA_FOLHA.some((g) => g.codigo === gravado)) return gravado as CodigoDoGrupo;
  const via = String(d.via ?? "");
  const nome = String(d.nome ?? "");
  if (via === "intratecal" || via === "peridural" || d.forma === "neuroeixo") return "neuroeixo";
  if (via === "perineural" || d.forma === "bloqueio") return "bloqueio";
  if (d.indicacao === "Antibioticoprofilaxia" || naLista("antibiotico", nome)) return "antibiotico";
  const geral = tecnicas.some((t) => t.startsWith("geral"));
  const sedacao = tecnicas.includes("sedacao");
  if (naLista("geral", nome) && (geral || !sedacao)) return "geral";
  if (naLista("sedacao", nome)) return "sedacao";
  return "outras";
}

/**
 * Em que linha do grupo a administração entra. O mesmo fármaco pode ter duas
 * linhas no papel (bupivacaína pesada e isobárica): a apresentação gravada
 * escolhe; sem ela, a primeira linha do fármaco. -1 quando não está na lista.
 */
export function itemDaAdministracao(
  grupo: GrupoDaLista, a: { nome: string }, r?: Registro,
): number {
  const apresentacao = String(r?.dados.apresentacao ?? "");
  const mesmos = grupo.itens.map((it, i) => ({ it, i })).filter(({ it }) => mesmoFarmaco(it.nome, a.nome));
  if (!mesmos.length) return -1;
  return (mesmos.find(({ it }) => it.apresentacao && it.apresentacao === apresentacao) ?? mesmos[0]).i;
}

// ---------------------------------------------------------------------------
// As faixas pré-impressas do registro
// ---------------------------------------------------------------------------
/** As infusões que o papel já traz escritas na faixa de "drogas em infusão contínua". */
export const INFUSOES_DA_FOLHA = ["Noradrenalina", "Vasopressina", "Remifentanil", "Dexmedetomidina", "Propofol"];
/** Os líquidos que o papel já traz escritos. */
export const LIQUIDOS_DA_FOLHA = ["Soro fisiológico 0,9%", "Ringer lactato"];

// ---------------------------------------------------------------------------
// Aldrete e Kroulik — a alta da RPA do papel
// ---------------------------------------------------------------------------
export const ALDRETE: Array<{ chave: string; nome: string; opcoes: [string, string, string] }> = [
  { chave: "atividade", nome: "Atividade", opcoes: ["Não move os membros", "Move 2 membros", "Move os 4 membros"] },
  { chave: "respiracao", nome: "Respiração", opcoes: ["Apneia", "Dispneia ou respiração limitada", "Respira e tosse livremente"] },
  { chave: "circulacao", nome: "Circulação (PA)", opcoes: ["Variação > 50% da inicial", "Variação de 20 a 49%", "Até 20% da inicial"] },
  { chave: "consciencia", nome: "Consciência", opcoes: ["Não responde", "Desperta ao chamado", "Lúcido e orientado"] },
  { chave: "saturacao", nome: "Saturação", opcoes: ["< 90% mesmo com O₂", "> 90% com O₂", "> 92% em ar ambiente"] },
];

/** A soma, só com os cinco critérios marcados; nulo enquanto faltar algum. */
export function somaAldrete(pontos: Record<string, unknown> | null | undefined): number | null {
  if (!pontos) return null;
  let total = 0;
  for (const c of ALDRETE) {
    const v = pontos[c.chave];
    if (v !== 0 && v !== 1 && v !== 2) return null;
    total += v;
  }
  return total;
}
