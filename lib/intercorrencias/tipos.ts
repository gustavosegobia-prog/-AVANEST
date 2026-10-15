/**
 * INTERCORRÊNCIAS ANESTÉSICAS — a forma de um protocolo.
 *
 * Um protocolo é DADO, não código: só texto, números e ids, sem função
 * nenhuma. É o que permite guardar no banco o instantâneo exato que o revisor
 * aprovou (lib/intercorrencias/situacao.ts) e mostrar esse instantâneo mesmo
 * depois que a versão do código mudou — a aprovação vale para o conteúdo que
 * foi lido, não para o que veio depois.
 *
 * As doses usam o mesmo motor da calculadora (lib/calculos/doses.ts): a mesma
 * DosePorKg, a mesma Apresentacao, o mesmo teto. Nenhuma fórmula nova.
 */

import type { Apresentacao, DosePorKg, Teto } from "../calculos/doses.ts";
import type { BaseDePeso } from "../calculos/peso.ts";

export type Categoria = "cardiovascular" | "respiratorio" | "medicamentos" | "obstetricia" | "pediatria" | "outras";

/** De quem é o protocolo (ou o passo, ou a dose). */
export type Populacao = "adulto" | "gestante" | "pediatrico" | "neonatal";

/** Os cinco estados de um protocolo; só "aprovado" é conteúdo clínico validado. */
export type Situacao = "rascunho" | "pendente" | "aprovado" | "necessita_atualizacao" | "suspenso";

/**
 * Uma referência verificável. `localizacao` é o trecho (cartão, seção,
 * quadro) onde o número está; nula quando ainda não foi conferida no texto
 * original — e então a tela diz que falta, em vez de inventar página.
 */
export type Referencia = {
  id: string;
  titulo: string;
  autoria: string;
  publicacao: string;
  /** Nulo quando o ano da edição ainda não foi conferido. */
  ano: number | null;
  edicao?: string;
  doi?: string;
  link?: string;
  localizacao: string | null;
  /** O texto original (ou o DOI) foi aberto e conferido por quem cadastrou. */
  conferida: boolean;
  observacao?: string;
};

export type Passo = {
  texto: string;
  /** Linha menor, embaixo: o porquê ou o como. */
  detalhe?: string;
  /** Só para estas populações (o deslocamento uterino é da gestante). */
  so?: Populacao[];
};

/**
 * Uma apresentação do protocolo: a da calculadora, mais as vias em que ela
 * pode ser usada. A ampola pura de adrenalina (1 mg/mL) é IM; em bolus IV,
 * é erro de dez a cem vezes — e o alerta sai daqui.
 */
export type ApresentacaoDoProtocolo = Apresentacao & {
  vias?: string[];
  /** Como preparar, quando é diluída. */
  preparo?: string;
  /**
   * A diluição depende do peso: `quantidade` é por kg do paciente, em `mL`
   * mililitros ("noradrenalina 0,15 mg/kg em 50 mL" da criança).
   */
  porPeso?: true;
};

/** Volume de cristaloide: por kg (criança) ou fixo (adulto). */
export type VolumeDoProtocolo = {
  id: string;
  indicacao: string;
  populacao: "adulto" | "pediatrico" | "todas";
  mlPorKg?: { min?: number; max?: number };
  mlFixo?: { min?: number; max?: number };
  repeticao?: string;
  referencias: string[];
};

export type DoseDoProtocolo = {
  id: string;
  farmaco: string;
  /** Para quê, dentro do protocolo: "reação moderada", "sem acesso venoso". */
  indicacao: string;
  /** "todas" vale para qualquer idade (dose por kg igual). */
  populacao: "adulto" | "pediatrico" | "todas";
  /** Faixa de idade, para dose fixa por idade (adrenalina IM na criança). */
  idadeAnos?: { min?: number; max?: number };
  via: string;
  dose: DosePorKg;
  tetoAbsoluto?: Teto;
  apresentacoes: ApresentacaoDoProtocolo[];
  pesoBase?: BaseDePeso;
  /** Pede confirmação da concentração e da via antes de mostrar o volume. */
  altoRisco?: boolean;
  repeticao?: string;
  /** Tempo de administração ou ritmo de infusão. */
  velocidade?: string;
  /** Contraindicações e cuidados. */
  cuidados?: string[];
  /** O id da dose equivalente na outra faixa etária, para mostrar a diferença. */
  par?: string;
  /** Ao menos uma: toda dose tem de onde veio. */
  referencias: string[];
};

/** Duas fontes dizem coisas diferentes: as duas ficam, lado a lado, para o revisor. */
export type Divergencia = {
  tema: string;
  posicoes: Array<{ texto: string; referencia: string }>;
  /** Qual o protocolo seguiu, e por quê. */
  escolha: string;
};

export type Protocolo = {
  id: string;
  titulo: string;
  categoria: Categoria;
  populacoes: Populacao[];
  versao: number;
  /** AAAA-MM-DD da última mudança de conteúdo. */
  atualizadoEm: string;
  /** Outros nomes: "anafilaxia", "choque anafilático", "reação alérgica grave". */
  sinonimos: string[];
  /** O que se vê na sala, para a busca: "rash", "PA caindo", "chiado". */
  sinais: string[];
  resumo: string;
  reconhecer: string[];
  agirAgora: Passo[];
  medicamentos: DoseDoProtocolo[];
  volumes: VolumeDoProtocolo[];
  pensarEm: string[];
  depois: string[];
  divergencias: Divergencia[];
  referencias: string[];
};

/** Um título das seis categorias que ainda não tem protocolo escrito. */
export type Previsto = { titulo: string; categoria: Categoria; sinonimos?: string[] };
