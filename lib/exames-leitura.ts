/**
 * Leitura dos exames laboratoriais a partir do texto de uma foto ou PDF anexado.
 *
 * Irmã de `lib/calculos/gasometria-leitura.ts`, e de propósito: o reconhecimento
 * da imagem acontece em outro lugar, aqui entra texto bruto e saem os campos da
 * ficha. É essa separação que torna a coisa testável — dá para escrever o laudo
 * de um laboratório à mão e conferir o que sai, sem foto nenhuma.
 *
 * A REGRA QUE SUSTENTA A SEGURANÇA DISTO É A FAIXA PLAUSÍVEL. OCR de foto de
 * papel erra, e erra feio: troca 1,05 por 105, lê o valor de REFERÊNCIA em vez
 * do resultado, cola dois números da mesma linha. Um valor fora do que existe em
 * ser humano é descartado em vez de preenchido — campo vazio quem enxerga é o
 * anestesiologista, e ele digita; campo com número errado passa despercebido e
 * vira conduta errada.
 *
 * E o que já está preenchido NUNCA é sobrescrito. Quem digitou a creatinina
 * digitou por algum motivo — tinha o laudo na mão, corrigiu uma leitura torta —,
 * e uma foto anexada depois não desfaz isso pelas costas.
 */

/** Os campos da ficha que esta leitura sabe preencher. */
export type CampoDeExame =
  | "hemoglobina" | "hematocrito" | "plaquetas"
  | "tap" | "inr" | "ttpa"
  | "creatinina" | "ureia" | "sodio" | "potassio"
  | "glicemia" | "hba1c";

/**
 * Como cada exame aparece nos laudos, e em que faixa o valor faz sentido.
 *
 * Os apelidos cobrem o que os laboratórios de fato imprimem. O acento some na
 * normalização, então basta a forma sem ele. "hb" e "ht" são curtos e perigosos
 * — casam dentro de outras palavras —, mas `valorApos` só aceita rótulo
 * delimitado, o que os torna seguros.
 */
const CAMPOS: Array<{
  campo: CampoDeExame;
  apelidos: string[];
  min: number;
  max: number;
  /** Palavras que, logo depois do apelido, querem dizer OUTRO exame. */
  naoSeguidoDe?: string[];
  /** Rótulo humano, para a tela dizer o que não usou. */
  nome: string;
}> = [
  // O "naoSeguidoDe" existe por causa de um laudo real: "Hemoglobina glicada"
  // começa com "hemoglobina", e sem isto o 5,4 da glicada era testado como
  // hemoglobina — anemia grave inventada no campo que decide se opera.
  { campo: "hemoglobina", nome: "hemoglobina", min: 2, max: 25,
    apelidos: ["hemoglobina", "hb"], naoSeguidoDe: ["glicada", "a1c", "corpuscular"] },
  { campo: "hematocrito", nome: "hematócrito", min: 8, max: 75,
    apelidos: ["hematocrito", "ht", "hct"] },
  { campo: "plaquetas", nome: "plaquetas", min: 5_000, max: 2_000_000,
    apelidos: ["plaquetas", "plaquetometria", "plt"] },
  { campo: "tap", nome: "TAP", min: 5, max: 120,
    apelidos: ["tempo de protrombina", "tap", "tp"] },
  // INR antes de TAP na leitura seria indiferente; o que importa é o apelido
  // mais longo vencer dentro do mesmo campo — ver a ordenação no laço.
  { campo: "inr", nome: "INR", min: 0.5, max: 12,
    apelidos: ["inr", "rni", "razao normatizada"] },
  { campo: "ttpa", nome: "TTPa", min: 10, max: 200,
    apelidos: ["ttpa", "ttp", "tempo de tromboplastina", "kptt", "ptta"] },
  { campo: "creatinina", nome: "creatinina", min: 0.1, max: 20,
    apelidos: ["creatinina", "creat"] },
  { campo: "ureia", nome: "ureia", min: 5, max: 300,
    apelidos: ["ureia", "uréia"] },
  { campo: "sodio", nome: "sódio", min: 90, max: 200,
    // "na" sozinho NÃO entra: é preposição em português ("coletado na\n    // unidade") e casaria com qualquer número da frase seguinte.
    apelidos: ["sodio", "na+"] },
  { campo: "potassio", nome: "potássio", min: 1, max: 10,
    apelidos: ["potassio", "k+", "k"] },
  { campo: "glicemia", nome: "glicemia", min: 20, max: 900,
    apelidos: ["glicemia de jejum", "glicemia", "glicose", "glic"] },
  { campo: "hba1c", nome: "HbA1c", min: 3, max: 20,
    apelidos: ["hemoglobina glicada", "hba1c", "hb a1c", "a1c", "glicada"] },
];

/** Tira acento, baixa a caixa e uniformiza os separadores. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Primeiro número depois do rótulo, aceitando vírgula, ponto de milhar e sinal.
 *
 * O limite de 24 caracteres entre o rótulo e o número existe para não capturar
 * valor de outra linha: laudo em coluna costuma ter o resultado logo ao lado, e
 * o que estiver longe disso quase sempre é de outro exame. É o mesmo número da
 * leitura de gasometria, que roda em produção há tempo.
 */
/** Um número como o laudo escreve: 12,47 · 205.400 · 0.4 · 14 */
const NUMERO = /-?\d{1,3}(?:[.\s]\d{3})+|-?\d+(?:[.,]\d+)?/g;

/**
 * O valor do exame, pulando a faixa de referência.
 *
 * O QUE ENSINOU ESTA FUNÇÃO foi um laudo de verdade. No PDF do laboratório o
 * texto sai em ordem de coluna, e a faixa de referência vem ANTES do resultado:
 *
 *     Uréia   15,0 a 40,0 mg/dL   Resultado...........: 14 mg/dL
 *     Creatinina   0.4 a 1.4 mg/dl   Resultado...........: 0,54 mg/dL
 *
 * Pegar "o primeiro número depois do rótulo" — que é o que a leitura de
 * gasometria faz, e funciona bem numa fita de aparelho — escrevia 15 no campo
 * de ureia e 0,4 no de creatinina. Os dois plausíveis, os dois errados, os dois
 * a um dígito de mudar conduta. Nenhuma faixa de valor pega isso: 15 é uma
 * ureia perfeitamente possível.
 *
 * O SINAL QUE SEPARA OS DOIS É A FORMA, e não o tamanho: referência é FAIXA —
 * "X a Y" —, resultado é número solto. Então os dois lados de uma faixa são
 * descartados, e vale o primeiro número que não pertence a nenhuma.
 *
 * E a busca para em "Resultados Anteriores": dali para baixo é o mesmo exame
 * de outro dia. Usar aquele número seria decidir sobre o paciente certo na
 * data errada.
 */
function valorDoExame(texto: string, apelido: string, naoSeguidoDe: string[] = []): string | undefined {
  const escapado = apelido.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const veto = naoSeguidoDe.length
    ? `(?!\\s*(?:${naoSeguidoDe.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`
    : "";
  // `(?![a-z])` fecha o rótulo pela direita, e não é detalhe: sem ele "na"
  // casava dentro de "Data Nasc...: 04/07/2005" e o sódio saía 4 — descartado
  // por implausível, mas enchendo a tela de um aviso sobre um exame que o
  // laboratório nem fez.
  const rotulo = new RegExp(`(?:^|[^a-z0-9])${escapado}${veto}(?![a-z])`, "i");
  const achadoRotulo = rotulo.exec(texto);
  if (!achadoRotulo) return undefined;

  let janela = texto.slice(achadoRotulo.index + achadoRotulo[0].length, achadoRotulo.index + achadoRotulo[0].length + 140);
  const corte = janela.search(/resultados?\s+anteriores/i);
  if (corte > 0) janela = janela.slice(0, corte);

  NUMERO.lastIndex = 0;
  let numero: RegExpExecArray | null;
  while ((numero = NUMERO.exec(janela)) !== null) {
    const depois = janela.slice(numero.index + numero[0].length);
    const antes = janela.slice(0, numero.index);
    // Primeiro lado da faixa: "15,0 a 40,0"
    if (/^\s*a\s+-?\d/i.test(depois)) continue;
    // Segundo lado: o que vem logo depois de "<número> a "
    if (/-?[\d.,]+\s+a\s*$/i.test(antes)) continue;
    return numero[0];
  }
  return undefined;
}

/**
 * Converte o número escrito no laudo.
 *
 * O SEPARADOR DE MILHAR É A ARMADILHA DESTE ARQUIVO. Em laudo brasileiro
 * "250.000" é duzentos e cinquenta mil, e "1,05" é um vírgula zero cinco — o
 * ponto agrupa, a vírgula decide a casa decimal. Ler ingenuamente com
 * `Number("250.000")` devolve 250, que é plaqueta de quem está sangrando.
 *
 * A regra: grupos de exatamente três dígitos depois de ponto ou espaço são
 * milhar; vírgula é sempre decimal.
 */
export function lerNumero(bruto: string): number | undefined {
  const limpo = bruto.trim();
  // Milhar: 250.000 · 1.234.567 · 250 000
  if (/^-?\d{1,3}(?:[.\s]\d{3})+$/.test(limpo)) {
    const valor = Number(limpo.replace(/[.\s]/g, ""));
    return Number.isFinite(valor) ? valor : undefined;
  }
  const valor = Number(limpo.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(valor) ? valor : undefined;
}

/**
 * Plaqueta escrita em milhares vira a contagem cheia.
 *
 * Laboratório imprime das duas formas: "250.000/mm³" e "250 mil/mm³" — e há
 * quem imprima só "250", na unidade 10³/µL do aparelho. Todas querem dizer a
 * mesma coisa, e a ficha guarda uma só. O corte em 3.000 é folgado de sobra:
 * ninguém tem 3.000 plaquetas por mm³ e sobrevive à cirurgia eletiva, e
 * ninguém tem 3.000 mil (três milhões) fora de um caso de relato.
 */
export function plaquetasCheias(valor: number): number {
  return valor < 3_000 ? valor * 1_000 : valor;
}

export type LeituraDeExames = {
  /** Campo da ficha → texto já formatado para o input. */
  valores: Partial<Record<CampoDeExame, string>>;
  /** Exames que apareceram no texto com valor fora do plausível. */
  descartados: string[];
};

/** Escreve o número do jeito que o brasileiro lê. */
function paraOCampo(campo: CampoDeExame, valor: number): string {
  if (campo === "plaquetas") return valor.toLocaleString("pt-BR");
  return String(valor).replace(".", ",");
}

/**
 * Extrai o que der do texto reconhecido.
 *
 * Os apelidos são testados do MAIS LONGO para o mais curto dentro de cada
 * exame — "glicemia de jejum" antes de "glicemia", "hemoglobina glicada" antes
 * de "glicada" —, senão o rótulo curto casaria primeiro e traria o número
 * errado.
 */
export function lerExames(textoBruto: string): LeituraDeExames {
  const texto = normalizar(textoBruto);
  const valores: Partial<Record<CampoDeExame, string>> = {};
  const descartados: string[] = [];

  for (const { campo, apelidos, min, max, nome, naoSeguidoDe } of CAMPOS) {
    const ordenados = [...apelidos].sort((a, b) => b.length - a.length);
    for (const apelido of ordenados) {
      const bruto = valorDoExame(texto, apelido, naoSeguidoDe);
      if (bruto === undefined) continue;
      let valor = lerNumero(bruto);
      if (valor === undefined) continue;
      if (campo === "plaquetas") valor = plaquetasCheias(valor);

      if (valor < min || valor > max) {
        // Achou o rótulo mas o número não existe em ser humano: quase sempre é
        // erro de leitura. Fica de fora, e a tela diz qual conferir.
        if (!descartados.includes(nome)) descartados.push(nome);
        continue;
      }
      valores[campo] = paraOCampo(campo, valor);
      break;
    }
  }

  return { valores, descartados };
}

/**
 * O que de fato vai para a ficha, dado o que já está escrito nela.
 *
 * NUNCA SOBRESCREVE. É a mesma decisão do valor do plantão por hospital: dado
 * clínico trocado em silêncio só aparece depois que virou conduta.
 */
// A chave é `string`, e não `CampoDeExame`: a data da coleta passa por aqui
// também, e ela não é um exame. O que a função garante não é o nome do campo —
// é que nada preenchido seja perdido.
export function apenasOsVazios(
  lidos: Record<string, string>,
  atuais: Partial<Record<string, unknown>>,
): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [campo, valor] of Object.entries(lidos)) {
    if (String(atuais[campo] ?? "").trim() === "") saida[campo] = valor;
  }
  return saida;
}

/**
 * A data da COLETA, que é a que importa na ficha.
 *
 * O laudo traz três datas e elas não são a mesma coisa: "Coletado em" é quando
 * o sangue saiu do paciente, "Emitido em" é quando o laboratório imprimiu, e
 * "Data Entra" é quando a amostra chegou. Para decidir se um exame ainda vale
 * na véspera da cirurgia, a única que responde é a da coleta — um hemograma
 * colhido há trinta dias e impresso hoje continua sendo de trinta dias atrás.
 *
 * Por isso a ordem aqui é de preferência, e não uma lista qualquer.
 */
export function lerDataDaColeta(textoBruto: string): string | undefined {
  const texto = normalizar(textoBruto);
  for (const rotulo of ["coletado em", "data da coleta", "coleta", "data entra", "emitido em"]) {
    const achado = new RegExp(`${rotulo}[^0-9]{0,8}?(\\d{2})/(\\d{2})/(\\d{4})`, "i").exec(texto);
    if (!achado) continue;
    const [, dia, mes, ano] = achado;
    const d = Number(dia), m = Number(mes);
    if (d < 1 || d > 31 || m < 1 || m > 12) continue;
    return `${ano}-${mes}-${dia}`;
  }
  return undefined;
}

export const AVISO_LEITURA_DE_EXAMES =
  "Valores lidos do anexo. Confira cada um contra o laudo antes de concluir — "
  + "a leitura automática erra, e todos os campos continuam editáveis.";
