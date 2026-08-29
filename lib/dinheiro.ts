// Ler o dinheiro do jeito que a pessoa digita.
//
// O campo de valor é livre de propósito: obrigar "1100.00" numa recepção com
// fila é obrigar a pessoa a pensar no formato do computador em vez de no que o
// paciente pagou. Aqui entram "1.100,00", "1100", "R$ 1.100" e "1100,5", e sai
// o mesmo número.
//
// A REGRA DIFÍCIL É O PONTO. Em português ele é separador de MILHAR, e em
// inglês é o decimal. "1.100" é mil e cem aqui e um vírgula um lá. A escolha
// deste arquivo é a brasileira, com uma exceção: ponto seguido de dois dígitos
// no fim, como "1100.50", é gente copiando de um sistema em inglês, e tratá-lo
// como milhar transformaria R$ 1.100,50 em R$ 110.050,00.

/** "1.100,00", "R$ 1100", "1100.50" -> 1100 / 1100 / 1100.5. Nunca negativo. */
export function lerDinheiro(bruto: string | number | null | undefined): number {
  if (typeof bruto === "number") return Number.isFinite(bruto) && bruto > 0 ? bruto : 0;
  let texto = String(bruto ?? "").replace(/[^\d,.]/g, "");
  if (!texto) return 0;

  if (texto.includes(",")) {
    // Tem vírgula: ela é o decimal, e todo ponto é milhar.
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else {
    const pontos = texto.split(".").length - 1;
    const ultimo = texto.lastIndexOf(".");
    const casasNoFim = ultimo === -1 ? 0 : texto.length - ultimo - 1;
    // Um ponto só, com uma ou duas casas depois: decimal copiado de fora.
    // Qualquer outro arranjo é separador de milhar do português.
    if (!(pontos === 1 && (casasNoFim === 1 || casasNoFim === 2))) {
      texto = texto.replace(/\./g, "");
    }
  }

  const valor = Number(texto);
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}
