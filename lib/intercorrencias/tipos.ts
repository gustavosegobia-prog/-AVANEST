/**
 * INTERCORRÊNCIAS ANESTÉSICAS — a forma de um protocolo.
 *
 * Um protocolo é DADO, não código: só texto, números e ids, sem função
 * nenhuma. A tela só lê; cada mudança de conteúdo sobe a versão e a data.
 *
 * As doses usam o mesmo motor da calculadora (lib/calculos/doses.ts): a mesma
 * DosePorKg, a mesma Apresentacao, o mesmo teto. Nenhuma fórmula nova.
 */

import type { Apresentacao, DosePorKg, Teto } from "../calculos/doses.ts";
import type { BaseDePeso } from "../calculos/peso.ts";

export type Categoria = "cardiovascular" | "respiratorio" | "medicamentos" | "obstetricia" | "pediatria" | "outras" | "apoio";

/** De quem é o protocolo (ou o passo, ou a dose). */
export type Populacao = "adulto" | "gestante" | "pediatrico" | "neonatal";

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
  /**
   * O caminho a que o passo pertence, quando o protocolo tem mais de um
   * ("A. Fogo na via aérea", "B. Fogo no campo"): a tela abre um título para
   * cada caminho e recomeça a numeração.
   */
  caminho?: string;
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

/**
 * O que não é fármaco mas se calcula pelo paciente: cristaloide e
 * hemocomponente (mL), carga do choque (J), crioprecipitado (unidades).
 * Por kg ou fixo; `maximo` segura a conta por kg.
 */
export type VolumeDoProtocolo = {
  id: string;
  /** O título do grupo na tela, quando não é o automático (cristaloide, hemocomponentes, desfibrilação). */
  grupo?: string;
  /** O nome no cartão: "Cristaloide", "Choque", "Plasma fresco congelado". Sem ele, cristaloide. */
  rotulo?: string;
  indicacao: string;
  populacao: "adulto" | "pediatrico" | "todas";
  /** "mL/h" é ritmo de bomba: por kg, a conta sai em mL/h ("15 mL/kg/h" da emulsão lipídica). */
  unidade?: "mL" | "mL/h" | "J" | "unidades" | "mg";
  porKg?: { min?: number; max?: number };
  fixo?: { min?: number; max?: number };
  maximo?: number;
  repeticao?: string;
  referencias: string[];
};

/** Um traçado de monitor para reconhecer o ritmo (desenhado pelo AVANEST, não é foto). */
export type Ritmo = "fv" | "tv" | "aesp" | "assistolia";
export type RitmoDoProtocolo = { ritmo: Ritmo; nome: string; legenda: string; chocavel: boolean };

/** "Na criança, use o SAV pediátrico": o protocolo certo para a faixa do paciente. */
export type VejaTambem = { protocolo: string; quando: Populacao[]; texto: string };

/** O protocolo que costuma vir em seguida (da máscara difícil para o não ventilo, não intubo): um toque para abrir. */
export type Relacionado = { protocolo: string; texto: string };

export type DoseDoProtocolo = {
  id: string;
  farmaco: string;
  /** Para quê, dentro do protocolo: "reação moderada", "sem acesso venoso". */
  indicacao: string;
  /** "todas" vale para qualquer idade (dose por kg igual). */
  populacao: "adulto" | "pediatrico" | "todas";
  /** Faixa de idade, para dose fixa por idade (adrenalina IM na criança). */
  idadeAnos?: { min?: number; max?: number };
  /**
   * Faixa de peso, em kg, para dose fixa por peso (glucagon abaixo ou a partir
   * de 25 kg). Com o peso, a dose de fora da faixa some; na criança sem peso,
   * não há conta.
   */
  faixaDePeso?: { aPartirDe?: number; acimaDe?: number; abaixoDe?: number; ate?: number };
  via: string;
  dose: DosePorKg;
  tetoAbsoluto?: Teto;
  /** Piso por dose: a conta pelo peso que fica abaixo dele sobe até ele (atropina da criança, mínimo de 0,1 mg). */
  doseMinima?: Teto;
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
  /**
   * Sem apresentação cadastrada, o que a caixa do volume diz no lugar do
   * número: "Comprimidos de 200 mcg", "Pela bula do fabricante".
   */
  semVolume?: string;
  /** Ao menos uma: toda dose tem de onde veio. */
  referencias: string[];
};

/** Duas fontes dizem coisas diferentes: as duas ficam, lado a lado, com a escolha do protocolo. */
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
  /**
   * O que a seção de doses diz além dos números: o que não é rotina, o que
   * depende do serviço, o cuidado que vale para todas. Num cartão sem fármaco
   * (via aérea, listas), é tudo o que a seção mostra.
   */
  notasDeDose?: string[];
  pensarEm: string[];
  depois: string[];
  divergencias: Divergencia[];
  referencias: string[];
  veja?: VejaTambem[];
  relacionados?: Relacionado[];
  /** Os ritmos do monitor que o protocolo ensina a reconhecer (PCR). */
  ritmos?: RitmoDoProtocolo[];
  /** AAAA-MM-DD da última revisão científica (fontes reabertas e conferidas). */
  revisadoEm?: string;
  /**
   * Falso quando o protocolo não se apoia na bibliografia geral do módulo (Manual
   * de Crises e Tratado SAESP): a tela lista só as referências do próprio
   * protocolo, sem atribuir a uma obra o que não foi localizado nela.
   */
  bibliografiaGeral?: false;
};

/** Um título das seis categorias que ainda não tem protocolo escrito. */
export type Previsto = { titulo: string; categoria: Categoria; sinonimos?: string[] };
