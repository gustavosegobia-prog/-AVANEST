// O outro lado do caixa.
//
// O Financeiro só tinha entrada. A pergunta que um dono de serviço faz no fim
// do mês não é "quanto entrou", é "sobrou quanto" — e ela precisa dos dois
// lados.

export type CategoriaId =
  | "pessoal" | "impostos" | "estrutura" | "material" | "equipamento"
  | "seguro" | "formacao" | "software" | "transporte" | "outra";

/**
 * As categorias, com exemplo.
 *
 * O exemplo não é enfeite: sem ele cada pessoa classifica de um jeito, e no
 * terceiro mês "estrutura" e "outra" viram a mesma coisa — aí o relatório por
 * categoria deixa de responder qualquer pergunta. A ordem é a de quanto pesa
 * no bolso de um serviço de anestesiologia, não a alfabética.
 */
export const CATEGORIAS: Array<{ id: CategoriaId; nome: string; exemplo: string }> = [
  { id: "pessoal", nome: "Pessoal", exemplo: "secretária, encargos, quem trabalha para o serviço" },
  { id: "impostos", nome: "Impostos e contador", exemplo: "ISS, IRPJ, honorários contábeis" },
  { id: "estrutura", nome: "Estrutura", exemplo: "aluguel, água, luz, internet, telefone" },
  { id: "material", nome: "Material", exemplo: "medicamentos, descartáveis, gases" },
  { id: "equipamento", nome: "Equipamento", exemplo: "compra, manutenção, calibração" },
  { id: "seguro", nome: "Seguro", exemplo: "responsabilidade civil profissional" },
  { id: "formacao", nome: "Formação e registros", exemplo: "CRM, sociedade, congresso, curso" },
  { id: "software", nome: "Sistemas", exemplo: "assinaturas e programas, este incluído" },
  { id: "transporte", nome: "Transporte", exemplo: "combustível e deslocamento entre hospitais" },
  { id: "outra", nome: "Outra", exemplo: "o que não coube acima" },
];

export const NOME_DA_CATEGORIA = new Map(CATEGORIAS.map((c) => [c.id, c.nome]));

export type Despesa = {
  id: string;
  /** Null = despesa do serviço, rateada. Preenchido = de uma pessoa. */
  perfil_id: string | null;
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  recorrente: boolean;
};

const numero = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const despesasDoMes = (despesas: Despesa[], competencia: string) =>
  despesas.filter((d) => d.data.slice(0, 7) === competencia);

export const somarDespesas = (despesas: Despesa[]) =>
  despesas.reduce((soma, d) => soma + numero(d.valor), 0);

/** Do serviço: as que se rateiam. Sem dono é o que as marca. */
export const doServico = (despesas: Despesa[]) => despesas.filter((d) => !d.perfil_id);
/** De uma pessoa: as que só entram na conta dela. */
export const deAlguem = (despesas: Despesa[]) => despesas.filter((d) => d.perfil_id);

export type LinhaDeCategoria = {
  id: CategoriaId; nome: string; valor: number; linhas: number; fatia: number | null;
};

/**
 * Quanto foi para cada categoria.
 *
 * Devolve SÓ as categorias com gasto, e ordenadas por valor. Mostrar as dez
 * sempre, a maioria zerada, esconderia as três que importam no meio de uma
 * lista — o oposto do que a tabela existe para fazer. (É o contrário da regra
 * das origens de receita, e de propósito: lá são três fixas, e uma faltando é
 * uma pergunta; aqui são dez opcionais, e uma zerada não é notícia.)
 *
 * `fatia` é null quando não houve gasto nenhum: dividir por zero daria
 * Infinity, e "∞% em impostos" numa tela de dono de clínica é pior que nada.
 */
export function porCategoria(despesas: Despesa[]): LinhaDeCategoria[] {
  const total = somarDespesas(despesas);
  const mapa = new Map<string, { valor: number; linhas: number }>();
  for (const d of despesas) {
    const chave = NOME_DA_CATEGORIA.has(d.categoria as CategoriaId) ? d.categoria : "outra";
    const atual = mapa.get(chave) ?? { valor: 0, linhas: 0 };
    atual.valor += numero(d.valor);
    atual.linhas += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.entries()]
    .map(([id, { valor, linhas }]) => ({
      id: id as CategoriaId,
      nome: NOME_DA_CATEGORIA.get(id as CategoriaId) ?? "Outra",
      valor, linhas,
      fatia: total > 0 ? (valor / total) * 100 : null,
    }))
    .sort((a, b) => b.valor - a.valor);
}

export type Resultado = {
  receita: number;
  despesa: number;
  resultado: number;
  /** Quanto de cada real faturado sobrou. Null quando não houve receita. */
  margem: number | null;
};

/**
 * O número que fecha o mês.
 *
 * Usa o FATURADO, e não o recebido. São duas perguntas diferentes e as duas
 * valem: "o mês deu lucro" se responde com o que foi produzido no mês, porque
 * é o trabalho daquele mês contra o custo daquele mês. O recebido responde
 * "tenho dinheiro em caixa", que é a pergunta do envelhecimento e do saldo a
 * receber — e um serviço pode ter um mês excelente e o caixa apertado, o que é
 * exatamente o que as duas telas juntas mostram.
 */
export function resultadoDoMes(receitaFaturada: number, despesaTotal: number): Resultado {
  const receita = numero(receitaFaturada);
  const despesa = numero(despesaTotal);
  const resultado = receita - despesa;
  return {
    receita, despesa, resultado,
    margem: receita > 0 ? (resultado / receita) * 100 : null,
  };
}

/**
 * As despesas que se repetem e ainda não foram lançadas neste mês.
 *
 * O sistema não lança sozinho de propósito: uma linha que aparece no
 * fechamento sem ninguém ter mandado é uma linha que quem confere não sabe se
 * foi paga. Em vez disso, lembra — compara o que foi marcado como recorrente
 * em qualquer mês anterior com o que já existe neste.
 *
 * A comparação é por descrição sem espaços e sem caixa: "Aluguel" e "aluguel "
 * são a mesma conta, e cobrar o lançamento de uma despesa já lançada é o jeito
 * mais rápido de a pessoa parar de olhar para o aviso.
 */
export function recorrentesFaltando(despesas: Despesa[], competencia: string) {
  const chave = (d: Despesa) => d.descricao.trim().toLowerCase();
  const jaLancadas = new Set(despesasDoMes(despesas, competencia).map(chave));
  const vistas = new Map<string, Despesa>();
  for (const d of despesas) {
    if (!d.recorrente) continue;
    if (d.data.slice(0, 7) >= competencia) continue;
    // A mais recente ganha: o valor do aluguel de agora vale mais que o de um
    // ano atrás para lembrar quanto se costuma pagar.
    const anterior = vistas.get(chave(d));
    if (!anterior || d.data > anterior.data) vistas.set(chave(d), d);
  }
  return [...vistas.entries()]
    .filter(([k]) => !jaLancadas.has(k))
    .map(([, d]) => d)
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
}
