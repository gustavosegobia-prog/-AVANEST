// Números clínicos digitados: vírgula ou ponto, e o aviso quando não fazem
// sentido.
//
// Os campos eram `type="number"`. O navegador descarta a vírgula — e o
// brasileiro digita vírgula: "72,5" no peso virava 725, "36,5" na temperatura
// virava 365, conforme o navegador e o idioma. A calculadora de doses mostrava
// propofol para 725 kg sem alerta nenhum. Agora o campo é texto com teclado
// decimal, guarda com ponto (o que o resto do sistema lê) e mostra com vírgula.
//
// A faixa é AVISO, não bloqueio: o valor fora dela pode ser real (a criança de
// 3 kg, o paciente de 250 kg). O que não pode é passar calado.

/** O que a pessoa digitou, guardado do jeito que Number() lê: só dígitos e um ponto. */
export function normalizarDecimal(texto: string): string {
  const limpo = String(texto ?? "").replace(/[^\d.,]/g, "").replace(/,/g, ".");
  const i = limpo.indexOf(".");
  return i < 0 ? limpo : limpo.slice(0, i + 1) + limpo.slice(i + 1).replace(/\./g, "");
}

/** O valor guardado (com ponto), mostrado com vírgula. */
export const decimalNaTela = (valor: unknown) => String(valor ?? "").replace(".", ",");

/** O número do texto, ou null se vazio ou ilegível. */
export function lerDecimal(texto: unknown): number | null {
  const s = normalizarDecimal(String(texto ?? ""));
  if (!s || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type Faixa = { min: number; max: number; unidade: string };

export const FAIXAS_CLINICAS: Record<string, Faixa> = {
  peso: { min: 1, max: 350, unidade: "kg" },
  altura: { min: 40, max: 250, unidade: "cm" },
  pa_sistolica: { min: 50, max: 260, unidade: "mmHg" },
  pa_diastolica: { min: 20, max: 160, unidade: "mmHg" },
  fc: { min: 25, max: 220, unidade: "bpm" },
  fr: { min: 4, max: 60, unidade: "irpm" },
  spo2: { min: 50, max: 100, unidade: "%" },
  temperatura: { min: 30, max: 43, unidade: "°C" },
  glicemia_capilar: { min: 20, max: 800, unidade: "mg/dL" },
  circ_cervical: { min: 20, max: 70, unidade: "cm" },
};

const br = (n: number) => String(n).replace(".", ",");

/** O aviso do campo, ou null quando o valor está vazio ou dentro do esperado. */
export function avisoDeFaixa(campo: string, valor: unknown): string | null {
  const faixa = FAIXAS_CLINICAS[campo];
  const n = lerDecimal(valor);
  if (!faixa || n === null) return null;
  // O erro mais comum de unidade: altura em metros no campo de centímetros.
  if (campo === "altura" && n > 0 && n < 3) return `Parece estar em metros. O campo é em centímetros (ex.: ${br(Math.round(n * 100))}).`;
  if (campo === "temperatura" && n > 300 && n < 450) return `Confira a vírgula: ${br(n)} °C. Talvez ${br(n / 10)}?`;
  if (n < faixa.min || n > faixa.max) return `Fora da faixa esperada (${br(faixa.min)}–${br(faixa.max)} ${faixa.unidade}). Confira o valor e a unidade.`;
  return null;
}

/** Sistólica menor ou igual à diastólica: quase sempre os campos trocados. */
export function avisoDePressao(sistolica: unknown, diastolica: unknown): string | null {
  const s = lerDecimal(sistolica), d = lerDecimal(diastolica);
  if (s === null || d === null) return null;
  return s <= d ? "A sistólica está menor ou igual à diastólica. Os campos podem estar trocados." : null;
}

/** Peso e altura plausíveis para entrar em IMC e peso ideal. */
export function antropometriaPlausivel(peso: number | null, altura: number | null): boolean {
  return peso !== null && altura !== null
    && peso >= FAIXAS_CLINICAS.peso.min && peso <= FAIXAS_CLINICAS.peso.max
    && altura >= FAIXAS_CLINICAS.altura.min && altura <= FAIXAS_CLINICAS.altura.max;
}
