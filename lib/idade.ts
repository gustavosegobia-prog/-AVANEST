/**
 * A idade do paciente, vinda de dois caminhos.
 *
 * Nem sempre a data de nascimento está à mão. Paciente idoso que não lembra,
 * ficha de internação que só traz "78 anos", encaixe de última hora na
 * recepção — em todos esses a avaliação não pode parar por causa de um campo.
 * Então existem dois campos, e um resultado só.
 *
 * A data de nascimento sempre vence. Ela é exata, e continua exata no mês que
 * vem; a idade digitada é uma fotografia do dia em que alguém digitou. Quando
 * as duas existem, a data manda — e a idade digitada fica só como o registro
 * do que foi informado.
 *
 * Isto aqui não é enfeite de tela: é a idade que entra no STOP-Bang, na via
 * aérea pediátrica e no que mais vier. Por isso mora num arquivo com teste, e
 * não repetido em quatro telas.
 */

export const IDADE_MAXIMA = 130;

export type FonteDaIdade = "nascimento" | "informada" | "ausente";

export type IdadeDoPaciente = {
  anos: number | null;
  meses: number | undefined;
  fonte: FonteDaIdade;
  /** Verdadeiro quando há data de nascimento, mas ela não é uma data válida. */
  nascimentoInvalido: boolean;
};

/**
 * Idade em anos completos a partir da data de nascimento.
 * Devolve null quando a data não existe ou não faz sentido.
 */
export function idadePorNascimento(dataIso?: string | null, hoje = new Date()): number | null {
  if (!dataIso) return null;
  const nascimento = new Date(`${dataIso}T12:00:00`);
  if (Number.isNaN(nascimento.getTime())) return null;
  const anos =
    hoje.getFullYear() -
    nascimento.getFullYear() -
    (hoje < new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate()) ? 1 : 0);
  return Number.isFinite(anos) && anos >= 0 && anos <= IDADE_MAXIMA ? anos : null;
}

/**
 * Idade em meses completos a partir da data de nascimento.
 * É a conta que a via aérea pediátrica precisa — em lactente, um mês muda a
 * lâmina e o tubo.
 */
export function mesesPorNascimento(dataIso?: string | null, hoje = new Date()): number | undefined {
  if (!dataIso) return undefined;
  const nascimento = new Date(`${dataIso}T12:00:00`);
  if (Number.isNaN(nascimento.getTime())) return undefined;
  const meses =
    (hoje.getFullYear() - nascimento.getFullYear()) * 12 +
    (hoje.getMonth() - nascimento.getMonth()) -
    (hoje.getDate() < nascimento.getDate() ? 1 : 0);
  if (!Number.isFinite(meses) || meses < 0 || meses > IDADE_MAXIMA * 12) return undefined;
  return meses;
}

/** Aceita só um número inteiro de anos dentro do possível. */
export function lerIdadeInformada(valor: unknown): number | null {
  const texto = String(valor ?? "").trim();
  // Sem esta linha, Number("") devolve 0 — e campo em branco viraria "0 anos",
  // com o paciente entrando nos cálculos como recém-nascido. É o tipo de erro
  // que não aparece na tela: o número 0 parece um dado.
  if (!texto) return null;
  const numero = Number(texto);
  if (!Number.isFinite(numero)) return null;
  const anos = Math.trunc(numero);
  return anos >= 0 && anos <= IDADE_MAXIMA ? anos : null;
}

/**
 * A idade que vale, com a origem declarada.
 *
 * A origem importa: a tela precisa dizer se aquele número foi calculado ou
 * digitado, e o cálculo pediátrico precisa saber que meses derivados de anos
 * digitados são uma aproximação — daí `meses` ficar indefinido quando a idade
 * veio digitada e o paciente tem menos de dois anos, faixa em que a conta por
 * ano inteiro não serve para escolher tubo nem lâmina.
 */
export function idadeDoPaciente(
  paciente: { data_nascimento?: string | null; idade_anos?: number | null },
  hoje = new Date(),
): IdadeDoPaciente {
  const temNascimento = Boolean(String(paciente?.data_nascimento ?? "").trim());
  const porNascimento = idadePorNascimento(paciente?.data_nascimento, hoje);

  if (porNascimento !== null) {
    return {
      anos: porNascimento,
      meses: mesesPorNascimento(paciente?.data_nascimento, hoje),
      fonte: "nascimento",
      nascimentoInvalido: false,
    };
  }

  const informada = lerIdadeInformada(paciente?.idade_anos);
  if (informada !== null) {
    return {
      anos: informada,
      // Abaixo de dois anos, "1 ano" pode ser 12 ou 23 meses, e a diferença
      // troca o tamanho do tubo. Nessa faixa a conta só sai da data.
      meses: informada >= 2 ? informada * 12 : undefined,
      fonte: "informada",
      nascimentoInvalido: temNascimento,
    };
  }

  return { anos: null, meses: undefined, fonte: "ausente", nascimentoInvalido: temNascimento };
}
