/**
 * Lê o que o anestesiologista escreveu à mão sobre os remédios do paciente.
 *
 * Nas perguntas do bloco de medicamentos ele digita como fala: "Ozempic 1 mg,
 * semanal", "metformina 850mg 2x/dia; sinvastatina 20 mg à noite". A lista
 * abaixo precisa disso repartido — nome de um lado, dose de outro, frequência
 * de um terceiro — para casar com o guia, calcular o prazo de suspensão e não
 * obrigar ninguém a digitar o mesmo remédio duas vezes.
 *
 * O que existia antes cortava em toda vírgula e toda barra. "12,5 mg" virava
 * dois pedaços, "2x/dia" virava "2x" e "dia", e a tela cadastrava um
 * medicamento chamado "dia". Daí as duas regras deste arquivo:
 *
 *   - vírgula entre dígitos não separa nada, é decimal;
 *   - barra não separa: mora dentro de "2x/dia", de "8/8h" e do nome dos
 *     combinados, como losartana/hidroclorotiazida.
 *
 * Sobrou fora do escopo de propósito: quem escreve "losartana/AAS" querendo
 * dizer dois remédios vai ver um cadastro só. É o preço de não cadastrar mais
 * um medicamento chamado "dia" — e o nome errado salta aos olhos na lista,
 * enquanto o "dia" passava batido.
 */

export type MedicamentoEscrito = {
  nome: string;
  dose: string;
  frequencia: string;
};

/**
 * Rótulos de categoria que a própria ficha oferece como resposta rápida. Não
 * são remédios, e não viram cadastro.
 */
const CATEGORIAS = new Set([
  "anti-hipertensivo", "antidiabetico", "anticoagulante", "psicofarmaco",
  "caneta emagrecedora", "fitoterapico", "outro", "outros",
]);

/**
 * Dose: número (com vírgula ou ponto decimal), podendo ser combinação com
 * barra — "50/12,5 mg" —, seguido de unidade. A unidade é obrigatória; sem
 * ela, um "2" solto seria confundido com a frequência.
 */
const DOSE = /\b\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*\s*(?:mcg|µg|ug|mg|g|ui|u\.i\.|ml|mmol|%)\b/i;

/**
 * Frequência: como o remédio é tomado. Cada padrão foi tirado de como se
 * escreve receita no Brasil, e não de uma gramática geral.
 */
const FREQUENCIAS = [
  /\b\d+\s*x\s*(?:ao|por|\/)?\s*(?:dia|semana|mes|mês)\b/i,   // 2x/dia, 1x ao dia
  /\b(?:de\s*)?\d+\s*\/\s*\d+\s*h(?:oras)?\b/i,               // de 8/8h
  /\b(?:a\s*)?cada\s*\d+\s*h(?:oras)?\b/i,                    // cada 12 horas
  /\b(?:1|uma)?\s*vez(?:es)?\s*(?:ao|por)\s*(?:dia|semana|mes|mês)\b/i,
  /\bsemanal(?:mente)?\b/i,
  /\bquinzenal(?:mente)?\b/i,
  /\bmensal(?:mente)?\b/i,
  /\bdi[aá]ri(?:o|a|amente)\b/i,
  // Nem \b antes nem \b depois: \b se apoia em [A-Za-z0-9_], e nem o "à" de
  // "à noite" nem o "ã" de "manhã" são caracteres de palavra. Com as bordas
  // padrão, "losartana 50 mg de manhã" virava um remédio chamado
  // "losartana de manhã".
  /(?:^|\s)(?:pela\s+|de\s+|[àa]\s+|ao\s+)?(?:manh[ãa]|tarde|noite)(?![a-zà-ú])/i,
  /\bem\s*jejum\b/i,
  /\bs\.?o\.?s\.?\b/i,
  /\bse\s*necess[aá]rio\b/i,
];

const semAcento = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Reparte o texto de uma pergunta na lista de remédios que ele descreve.
 *
 * Devolve só o que sobrou de pé: um pedaço que era apenas frequência, apenas
 * dose, ou um rótulo de categoria não vira medicamento nenhum.
 */
export function lerMedicamentosEscritos(texto: string): MedicamentoEscrito[] {
  return separarPedacos(texto)
    .map(lerUmMedicamento)
    .filter((item): item is MedicamentoEscrito => item !== null);
}

/**
 * Corta o texto em pedaços, um por remédio.
 *
 * A vírgula entre dígitos fica de fora porque é decimal. A barra não corta
 * nunca — ver o comentário do topo.
 */
function separarPedacos(texto: string): string[] {
  return String(texto || "")
    .split(/[;\n]|(?<!\d),|,(?!\d)|\s\+\s/)
    .map((pedaco) => pedaco.trim())
    .filter(Boolean);
}

/**
 * Lê um pedaço só. Devolve null quando não sobra nome nenhum.
 */
export function lerUmMedicamento(pedaco: string): MedicamentoEscrito | null {
  let resto = String(pedaco || "").replace(/\s+/g, " ").trim();
  if (!resto) return null;

  const dose = resto.match(DOSE)?.[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (dose) resto = resto.replace(DOSE, " ");

  let frequencia = "";
  for (const padrao of FREQUENCIAS) {
    const achou = resto.match(padrao);
    if (!achou) continue;
    // Uma receita pode ter mais de uma marca de horário — "de manhã e à
    // noite". Vale guardar as duas, na ordem em que foram escritas.
    frequencia = frequencia ? `${frequencia} ${achou[0].trim()}` : achou[0].trim();
    resto = resto.replace(padrao, " ");
  }

  // Sobras de ligação que só faziam sentido colando dose e frequência ao nome.
  const nome = resto
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—.:]+|[\s\-–—.:]+$/g, "")
    .replace(/\b(?:de|do|da|ao|à|a|por|em|e)\b\s*$/i, "")
    .trim();

  if (nome.length < 2) return null;
  if (CATEGORIAS.has(semAcento(nome))) return null;
  // Um pedaço que virou só número perdeu o remédio pelo caminho.
  if (!/[a-zà-ú]/i.test(nome)) return null;

  return { nome, dose, frequencia: frequencia.replace(/\s+/g, " ").trim() };
}

/**
 * Compara nomes de medicamento ignorando acento, caixa e espaço em excesso.
 * É o que decide se um remédio já está na lista.
 */
export function mesmoMedicamento(a: string, b: string) {
  return semAcento(a).replace(/\s+/g, " ").trim() === semAcento(b).replace(/\s+/g, " ").trim();
}

/**
 * Converte a data de uma pergunta (só o dia) no formato que o campo de última
 * dose usa (dia e hora).
 *
 * O meio-dia não é um palpite sobre o horário real: é o valor menos capaz de
 * mudar a conta de dias para qualquer fuso, e fica à vista para ser corrigido.
 * Um campo em branco obrigaria a digitar de novo o que já foi respondido; uma
 * hora inventada de madrugada mentiria com mais convicção.
 */
export function diaParaMomento(dia: string) {
  const limpo = String(dia || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(limpo) ? `${limpo}T12:00` : "";
}
