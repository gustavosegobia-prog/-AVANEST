/**
 * Via aérea pediátrica: tamanho e profundidade do tubo.
 *
 * Duas lógicas separadas de propósito. Acima de um ano vale a fórmula da
 * idade; abaixo dela, não — em recém-nascido a idade não diz nada sobre o
 * calibre da traqueia, e aplicar a fórmula de criança maior num neonato erra
 * para cima. Por isso a faixa neonatal sai de uma tabela por peso, mantida
 * fora do código de cálculo para poder ser revista sem mexer na lógica.
 *
 * Nada aqui substitui confirmação clínica. As funções devolvem estimativa
 * inicial, e a interface é obrigada a dizer isso junto.
 */

export type FaixaNeonatal = { pesoMinKg: number; pesoMaxKg: number; diMm: number; diMaxMm?: number };

/** Tabela por peso para neonatos e lactentes pequenos. Editável. */
export const TABELA_NEONATAL: FaixaNeonatal[] = [
  { pesoMinKg: 0, pesoMaxKg: 1, diMm: 2.5 },
  { pesoMinKg: 1, pesoMaxKg: 2, diMm: 3.0 },
  { pesoMinKg: 2, pesoMaxKg: 3, diMm: 3.0, diMaxMm: 3.5 },
  { pesoMinKg: 3, pesoMaxKg: Infinity, diMm: 3.5 },
];

/** Calibres disponíveis, para sugerir a opção acima e a abaixo. */
export const CALIBRES = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0];

export type Paciente = { idadeAnos?: number; idadeMeses?: number; pesoKg?: number };

const informado = (valor?: number): valor is number =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= 0;

const arredonda = (valor: number, casas = 1) => {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
};

/** Idade total em meses, aceitando anos e meses preenchidos juntos. */
export function idadeEmMeses(p: Paciente): number | undefined {
  const anos = informado(p.idadeAnos) ? p.idadeAnos : 0;
  const meses = informado(p.idadeMeses) ? p.idadeMeses : 0;
  if (!informado(p.idadeAnos) && !informado(p.idadeMeses)) return undefined;
  return anos * 12 + meses;
}

/** Arredonda para o calibre de tubo que existe de verdade. */
export function calibreMaisProximo(di: number): number {
  return CALIBRES.reduce((melhor, atual) =>
    Math.abs(atual - di) < Math.abs(melhor - di) ? atual : melhor,
  );
}

export function vizinhos(di: number): { abaixo?: number; sugerido: number; acima?: number } {
  const sugerido = calibreMaisProximo(di);
  const indice = CALIBRES.indexOf(sugerido);
  return { abaixo: CALIBRES[indice - 1], sugerido, acima: CALIBRES[indice + 1] };
}

export type SugestaoTubo = {
  origem: "fórmula da idade" | "tabela por peso";
  comCuff?: { calculado: number; abaixo?: number; sugerido: number; acima?: number };
  semCuff?: { calculado: number; abaixo?: number; sugerido: number; acima?: number };
  /** Faixa única, usada na tabela neonatal quando ela dá um intervalo. */
  faixaNeonatal?: { de: number; ate: number };
  aviso?: string;
};

/**
 * Acima de 12 meses vale a fórmula da idade; abaixo, a tabela por peso. O
 * corte não é arbitrário: é onde a fórmula da idade deixa de ter significado.
 */
export function sugerirTubo(p: Paciente): SugestaoTubo | undefined {
  const meses = idadeEmMeses(p);
  const usaTabela = (meses !== undefined && meses < 12) || (meses === undefined && informado(p.pesoKg));

  if (usaTabela) {
    if (!informado(p.pesoKg)) {
      return { origem: "tabela por peso", aviso: "Informe o peso: abaixo de 1 ano o calibre vem do peso, não da idade." };
    }
    const faixa = TABELA_NEONATAL.find((f) => p.pesoKg! >= f.pesoMinKg && p.pesoKg! < f.pesoMaxKg);
    if (!faixa) return undefined;
    return {
      origem: "tabela por peso",
      semCuff: { calculado: faixa.diMm, ...vizinhos(faixa.diMm) },
      faixaNeonatal: faixa.diMaxMm ? { de: faixa.diMm, ate: faixa.diMaxMm } : undefined,
    };
  }

  if (meses === undefined) return undefined;
  const anos = meses / 12;

  const cuff = arredonda(anos / 4 + 3.5, 2);
  const semCuff = arredonda(anos / 4 + 4, 2);

  return {
    origem: "fórmula da idade",
    comCuff: { calculado: cuff, ...vizinhos(cuff) },
    semCuff: { calculado: semCuff, ...vizinhos(semCuff) },
  };
}

export type Profundidade = {
  pelaIdade?: number;
  peloTubo?: number;
  sugerida: string;
};

/**
 * Duas estimativas independentes, mostradas lado a lado. Quando concordam, a
 * confiança é maior; quando divergem, quem decide vê a divergência em vez de
 * receber um número único que esconde a dúvida.
 */
export function profundidadeOral(p: Paciente, diMm?: number): Profundidade | undefined {
  const meses = idadeEmMeses(p);
  const pelaIdade = meses !== undefined && meses >= 24 ? arredonda(12 + meses / 12 / 2) : undefined;
  const peloTubo = informado(diMm) ? arredonda(3 * diMm) : undefined;

  if (pelaIdade === undefined && peloTubo === undefined) return undefined;

  const valores = [pelaIdade, peloTubo].filter((v): v is number => v !== undefined);
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const sugerida = menor === maior ? `${arredonda(menor)} cm` : `${arredonda(menor)}–${arredonda(maior)} cm`;

  return { pelaIdade, peloTubo, sugerida };
}

export const AVISO_CLINICO =
  "Valor estimado. Confirmar tamanho e posição do tubo clinicamente, por capnografia, ausculta e demais métodos disponíveis.";
