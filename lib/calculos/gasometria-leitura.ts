/**
 * Leitura dos valores a partir do texto reconhecido numa foto de gasometria.
 *
 * O reconhecimento da imagem é feito em outro lugar; aqui entra o texto bruto
 * e sai a gasometria. A separação é o que torna esta parte testável: dá para
 * escrever o texto de um laudo à mão e conferir o que sai, sem foto nenhuma.
 *
 * A regra que sustenta a segurança disto é a faixa plausível. OCR de foto de
 * papel térmico erra, e erra feio: troca 7,25 por 725, lê o valor de
 * referência em vez do resultado, cola dois números. Um valor fora do que
 * existe em ser humano é descartado em vez de preenchido — campo vazio quem
 * enxerga é o anestesiologista, e ele preenche; campo com número errado passa
 * despercebido e vira conta errada.
 */

import type { Gasometria } from "./gasometria";

type Campo = keyof Gasometria;

/**
 * Como cada campo aparece nos laudos, e em que faixa o valor faz sentido.
 * Os apelidos cobrem as variações que os aparelhos imprimem — pCO2, PCO2,
 * PaCO2 — e o acento some na normalização, então basta a forma sem ele.
 */
const CAMPOS: Array<{ campo: Campo; apelidos: string[]; min: number; max: number }> = [
  { campo: "ph", apelidos: ["ph"], min: 6.5, max: 8 },
  { campo: "paco2", apelidos: ["paco2", "pco2", "paco 2", "pco 2"], min: 5, max: 150 },
  { campo: "pao2", apelidos: ["pao2", "po2", "pao 2", "po 2"], min: 10, max: 700 },
  { campo: "hco3", apelidos: ["hco3", "hco3-", "bicarbonato", "hco 3"], min: 3, max: 60 },
  { campo: "be", apelidos: ["be", "beecf", "be ecf", "excesso de base", "sbe"], min: -40, max: 40 },
  { campo: "na", apelidos: ["na", "na+", "sodio"], min: 90, max: 200 },
  { campo: "k", apelidos: ["k", "k+", "potassio"], min: 1, max: 10 },
  { campo: "cl", apelidos: ["cl", "cl-", "cloro", "cloreto"], min: 60, max: 160 },
  { campo: "lactato", apelidos: ["lactato", "lac", "lact"], min: 0, max: 30 },
  { campo: "fio2", apelidos: ["fio2", "fio 2"], min: 0.15, max: 100 },
  { campo: "sao2", apelidos: ["sao2", "so2", "sat", "saturacao", "sao 2"], min: 40, max: 100 },
  { campo: "albumina", apelidos: ["albumina", "alb"], min: 0.5, max: 7 },
];

/** Tira acento, baixa a caixa e uniformiza os separadores. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Primeiro número depois do rótulo, aceitando vírgula e sinal negativo.
 *
 * O limite de 24 caracteres entre o rótulo e o número existe para não capturar
 * um valor de outra linha: laudo em coluna costuma ter o resultado logo ao
 * lado, e o que estiver longe disso quase sempre é de outro campo.
 */
function valorApos(texto: string, apelido: string): number | undefined {
  const escapado = apelido.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const padrao = new RegExp(`(?:^|[^a-z0-9])${escapado}\\s*[:=]?[^0-9\\-]{0,24}?(-?\\d+(?:[.,]\\d+)?)`, "i");
  const achado = padrao.exec(texto);
  if (!achado) return undefined;
  const valor = Number(achado[1].replace(",", "."));
  return Number.isFinite(valor) ? valor : undefined;
}

export type Leitura = {
  valores: Gasometria;
  /** Campos que apareceram no texto mas com valor fora da faixa plausível. */
  descartados: string[];
};

/**
 * Extrai o que der do texto reconhecido.
 *
 * Os apelidos são testados do mais específico para o mais curto — "paco2"
 * antes de "pco2" —, e os campos de nome curto como "k" e "na" só casam
 * delimitados, senão qualquer palavra com essas letras viraria resultado.
 */
export function lerGasometria(textoBruto: string): Leitura {
  const texto = normalizar(textoBruto);
  const valores: Gasometria = {};
  const descartados: string[] = [];

  for (const { campo, apelidos, min, max } of CAMPOS) {
    const ordenados = [...apelidos].sort((a, b) => b.length - a.length);
    for (const apelido of ordenados) {
      const valor = valorApos(texto, apelido);
      if (valor === undefined) continue;

      if (valor < min || valor > max) {
        // Achou o rótulo mas o número não existe em ser humano: quase sempre é
        // erro de leitura. Fica de fora, e a tela avisa qual campo conferir.
        if (!descartados.includes(campo)) descartados.push(campo);
        continue;
      }
      valores[campo] = valor;
      break;
    }
  }

  return { valores, descartados };
}

export const AVISO_LEITURA =
  "Confira os valores reconhecidos antes de calcular. A leitura automática erra, e todos os campos continuam editáveis.";
