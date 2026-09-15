// ===========================================================================
// O valor gruda no hospital
// ===========================================================================
// Quem faz seis plantões em Cianorte recebe o mesmo por todos eles, e até aqui
// digitava o número seis vezes. Pior: quando é o administrador que lança para o
// colega, o sistema grava VALOR ZERO de propósito — quanto o colega recebe é
// combinado dele com quem paga —, e o colega abre a escala com seis linhas
// zeradas para preencher uma a uma.
//
// A regra nova é simples de dizer: o valor de um plantão novo nasce do último
// valor que AQUELA PESSOA usou NAQUELE hospital. Não é adivinhação nem média —
// é a repetição do que ela mesma já lançou.
//
// ---------------------------------------------------------------------------
// O QUE É "O MESMO HOSPITAL", E POR QUE ISSO NÃO É ÓBVIO
//
// O lugar de um plantão mora em dois campos: `local_id`, que aponta para o
// cadastro, e `local_texto`, digitado à mão quando o hospital não está
// cadastrado. Os dois existem na mesma tabela e nunca ao mesmo tempo.
//
// Comparar só por `local_id` deixaria de fora justamente quem escreve o nome à
// mão — que é quem mais digita valor repetido, porque não tem modelo salvo.
// Comparar só por texto juntaria dois hospitais de nome parecido. Então:
// `local_id` manda quando existe, e o texto entra normalizado (sem acento, sem
// caixa, sem espaço dobrado) apenas quando não há id dos dois lados.
//
// ---------------------------------------------------------------------------
// NUNCA SOBRESCREVER VALOR JÁ DIGITADO
//
// `zeradosNoMesmoLocal` devolve só os que estão em zero. Um valor digitado é
// decisão de alguém — um plantão de feriado que valeu mais, uma diária
// negociada —, e dinheiro sobrescrito em silêncio é o tipo de erro que só
// aparece no fechamento do mês, quando já virou nota emitida.
// ===========================================================================

export type PlantaoComValor = {
  id: string;
  data: string;
  valor: number;
  local_id?: string | null;
  local_texto?: string | null;
  situacao?: string | null;
};

/** Sem acento, sem caixa, sem espaço dobrado — para comparar nome digitado. */
export const normalizarLocal = (texto: string | null | undefined) =>
  String(texto ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim().toLowerCase();

/**
 * A identidade do lugar de um plantão, para comparação.
 *
 * Devolve "" quando não há lugar nenhum — e "" NUNCA casa com "", justamente
 * para que dois plantões sem local não sejam tratados como do mesmo hospital.
 * Ver `mesmoLocal`.
 */
export function chaveDoLocal(p: PlantaoComValor): string {
  if (p.local_id) return `id:${p.local_id}`;
  const texto = normalizarLocal(p.local_texto);
  return texto ? `txt:${texto}` : "";
}

/**
 * Estes dois plantões são no mesmo hospital?
 *
 * Sem lugar dos dois lados é FALSO, e não verdadeiro. "Plantão sem local
 * cadastrado" não é um hospital — é a ausência de um —, e tratar a ausência
 * como identidade faria o valor da sedação no consultório vazar para o plantão
 * do hospital que ninguém cadastrou ainda.
 */
export function mesmoLocal(a: PlantaoComValor, b: PlantaoComValor): boolean {
  const chave = chaveDoLocal(a);
  return chave !== "" && chave === chaveDoLocal(b);
}

/**
 * O último valor que esta pessoa usou neste hospital.
 *
 * Zero quando não há nenhum — e zero aqui quer dizer "não sei", que é
 * exatamente o que o sistema já fazia antes. A diferença é que agora ele só
 * não sabe quando de fato nunca houve.
 *
 * Só olha plantão com valor > 0: um plantão zerado não é informação sobre
 * quanto o hospital paga, é a falta dela. E ignora cancelado, que é um plantão
 * que não aconteceu.
 *
 * O MAIS RECENTE, e não o mais frequente. Valor de plantão sobe: pegar a média
 * ou a moda de doze meses devolveria o preço do ano passado justamente para
 * quem acabou de renegociar.
 */
export function ultimoValorNoLocal(
  historico: readonly PlantaoComValor[], alvo: PlantaoComValor,
): number {
  let melhor: PlantaoComValor | null = null;
  for (const p of historico) {
    if (Number(p.valor) <= 0) continue;
    if (String(p.situacao ?? "") === "cancelado") continue;
    if (!mesmoLocal(p, alvo)) continue;
    // Empate de data resolve pelo id, só para a resposta não depender da ordem
    // em que o banco devolveu as linhas.
    if (!melhor || p.data > melhor.data
        || (p.data === melhor.data && p.id > melhor.id)) melhor = p;
  }
  return melhor ? Number(melhor.valor) : 0;
}

/**
 * Os outros plantões do mesmo hospital que ainda estão zerados.
 *
 * É a lista que o botão "aplicar aos outros" vai preencher. O próprio plantão
 * de origem fica de fora, e os que já têm valor também — ver o cabeçalho.
 */
export function zeradosNoMesmoLocal(
  plantoes: readonly PlantaoComValor[], origem: PlantaoComValor,
): PlantaoComValor[] {
  return plantoes.filter((p) =>
    p.id !== origem.id
    && Number(p.valor) === 0
    && String(p.situacao ?? "") !== "cancelado"
    && mesmoLocal(p, origem));
}

/**
 * "Repetir nos outros 5 plantões do Santa Casa?" — a pergunta.
 *
 * O CONTEXTO VAI NA PERGUNTA, E NÃO NO BOTÃO. A primeira versão punha tudo no
 * botão — valor, quantidade e hospital — e no telefone ele virava uma frase de
 * três linhas cortada pela altura fixa do botão: a pessoa lia "aos outros 5
 * plantões do HOSPITAL SANTA" e o resto sumia. Pergunta em cima, ação curta
 * embaixo, que é como todo diálogo de confirmação funciona.
 */
export function perguntaDeRepetir(quantos: number, local: string): string {
  const onde = String(local ?? "").trim();
  return `Repetir ${quantos === 1 ? "no outro plantão" : `nos outros ${quantos} plantões`}`
    + `${onde ? ` do ${onde}` : " do mesmo local"}?`;
}

/** "Aplicar R$ 1.200,00" — o botão, curto o bastante para caber numa linha. */
export const botaoDeRepetir = (valor: number) =>
  `Aplicar ${Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
