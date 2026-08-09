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
  // Vírgula, não ponto: "13.5 cm" numa ficha em português é erro de leitura
  // esperando acontecer.
  const escrever = (v: number) => String(arredonda(v)).replace(".", ",");
  const sugerida = menor === maior ? `${escrever(menor)} cm` : `${escrever(menor)}–${escrever(maior)} cm`;

  return { pelaIdade, peloTubo, sugerida };
}

export const AVISO_CLINICO =
  "Valor estimado. Confirmar tamanho e posição do tubo clinicamente, por capnografia, ausculta e demais métodos disponíveis.";

/* ------------------------------------------------------------------ *
 * Uso dentro da ficha pré-anestésica.
 *
 * A ficha já tem peso e data de nascimento; a sugestão aparece ali, no
 * planejamento, em vez de obrigar a trocar de tela no meio da indução.
 * ------------------------------------------------------------------ */

/**
 * Até que idade a ficha oferece a sugestão de tubo pediátrico.
 *
 * Este 12 é do AVANEST, não de fonte: é o corte a partir do qual a fórmula da
 * idade deixa de ser a referência prática para a maioria dos serviços. Fica
 * isolado aqui para o serviço trocar sem caçar pelo código.
 */
export const IDADE_MAX_PEDIATRICA_ANOS = 12;

/**
 * Idade em meses a partir da data de nascimento.
 *
 * A ficha calcula idade em anos inteiros, e para tubo isso não serve: um
 * lactente de 8 meses viraria "0 ano", e abaixo de 1 ano o calibre vem da
 * tabela por peso, não da fórmula.
 */
export function idadeEmMesesPorNascimento(dataIso?: string | null, hoje = new Date()): number | undefined {
  if (!dataIso) return undefined;
  const nascimento = new Date(`${dataIso}T12:00:00`);
  if (Number.isNaN(nascimento.getTime())) return undefined;
  const meses =
    (hoje.getFullYear() - nascimento.getFullYear()) * 12 +
    (hoje.getMonth() - nascimento.getMonth()) -
    (hoje.getDate() < nascimento.getDate() ? 1 : 0);
  if (!Number.isFinite(meses) || meses < 0 || meses > 130 * 12) return undefined;
  return meses;
}

export const ehPediatrico = (meses?: number): boolean =>
  meses !== undefined && meses <= IDADE_MAX_PEDIATRICA_ANOS * 12;

const comVirgula = (v: number) => String(v).replace(".", ",");

export type TipoTubo = "comCuff" | "semCuff";

/**
 * A linha que vai para a ficha, quando o anestesiologista escolhe uma das
 * opções. Curta de propósito: é uma linha de planejamento impressa, não um
 * parágrafo.
 */
export function textoDoTubo(p: Paciente, tipo: TipoTubo): string | undefined {
  const s = sugerirTubo(p);
  const opcao = s?.[tipo];
  if (!s || !opcao) return undefined;

  const calibre =
    tipo === "semCuff" && s.faixaNeonatal
      ? `${comVirgula(s.faixaNeonatal.de)}–${comVirgula(s.faixaNeonatal.ate)}`
      : comVirgula(opcao.sugerido);

  const profundidade = profundidadeOral(p, opcao.sugerido);
  const rotulo = tipo === "comCuff" ? "com cuff" : "sem cuff";
  const base = `Tubo ${calibre} ${rotulo}`;
  return profundidade ? `${base} · profundidade ${profundidade.sugerida}` : base;
}

/** As opções que a ficha mostra lado a lado. Vazio quando não há o que sugerir. */
export function opcoesDeTubo(p: Paciente): Array<{ tipo: TipoTubo; texto: string }> {
  const s = sugerirTubo(p);
  if (!s) return [];
  const saida: Array<{ tipo: TipoTubo; texto: string }> = [];
  for (const tipo of ["comCuff", "semCuff"] as TipoTubo[]) {
    if (!s[tipo]) continue;
    const texto = textoDoTubo(p, tipo);
    if (texto) saida.push({ tipo, texto });
  }
  return saida;
}
