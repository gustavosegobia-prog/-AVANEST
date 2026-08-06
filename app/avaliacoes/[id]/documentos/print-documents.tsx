import { findMedicationGuideEntry } from "@/lib/medication-guide";

/**
 * Como o prazo de suspensão é dito no papel.
 *
 * O guia registra o raciocínio inteiro — em que situação interromper, a faixa
 * de dias, o que fazer no neuroeixo. Isso serve à decisão do anestesiologista,
 * na tela da avaliação. Depois que a conduta é "suspender", quem lê a ficha ou
 * recebe a mensagem precisa de uma coisa só: quando parar.
 *
 * O prazo escolhido é sempre o mais longo que o guia admite. O clopidogrel
 * aceita de 5 a 7 dias; quem parar 7 dias antes atende às duas pontas, e quem
 * parar 5 não atende. Arredondar para o lado seguro é o que evita adiar a
 * cirurgia na porta do centro cirúrgico.
 *
 * Devolve vazio quando o guia não conhece o medicamento — aí vale a orientação
 * escrita na avaliação, porque não há prazo de referência para resumir.
 */
export function suspensionSummary(name: string) {
  const days = findMedicationGuideEntry(name)?.suspendDays;
  if (days === undefined) return "";
  if (days === 0) return "Suspender na manhã da cirurgia.";
  if (days === 1) return "Suspender 1 dia antes da cirurgia.";
  return `Suspender ${days} dias antes da cirurgia.`;
}
