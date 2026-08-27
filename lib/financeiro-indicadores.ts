// Os indicadores que decidem o mês no faturamento médico.
//
// A tela mostrava faturado e recebido DO MÊS. Em faturamento por convênio essa
// não é a pergunta: o dinheiro do mês passado ainda está na rua, e o mês
// corrente quase não tem recebimento nenhum — a nota foi emitida há dez dias e
// o convênio paga em quarenta. Uma tela que só olha o mês corrente mostra uma
// operação sempre no vermelho e uma sempre no azul dizerem a mesma coisa.
//
// O que decide é o SALDO e a IDADE dele. Por isso quase tudo aqui trabalha
// sobre o histórico inteiro, e não sobre uma competência.
//
// Funções puras de propósito: elas são a parte que erra caro — um saldo somado
// errado vira cobrança indevida a um convênio — e são o que dá para travar com
// teste sem subir banco nem navegador.

/** O que estas contas precisam de um atendimento. Deliberadamente menos do que
 *  a tabela tem: assim o módulo não depende do formato da tela. */
export type ItemFinanceiro = {
  convenio: string;
  valor: number;
  recebido: number;
  status: string;
  nota_emitida_at?: string | null;
  nota_vencimento_at?: string | null;
  glosa_valor?: number;
  periodo?: string | null;
  created_at: string;
};

export type PagamentoRecebido = {
  atendimento_id: string;
  valor: number;
  paid_at: string;
};

const numero = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Quanto falta receber de um atendimento.
 *
 * Nunca negativo: um pagamento a maior — acontece quando o convênio deposita
 * um lote fechado e a baixa é lançada item a item — não pode virar saldo
 * negativo que abate a dívida de outro paciente.
 */
export const saldoDoItem = (item: ItemFinanceiro) =>
  Math.max(0, numero(item.valor) - numero(item.recebido));

/**
 * Um atendimento ainda cobrável.
 *
 * Cancelado sai da conta: não é dinheiro a receber, é linha que não existe
 * mais. Glosa FICA — ela é exatamente o dinheiro que se está tentando
 * recuperar, e tirá-la do saldo esconderia o problema em vez de mostrá-lo.
 */
export const emAberto = (item: ItemFinanceiro) =>
  item.status !== "cancelado" && saldoDoItem(item) > 0;

/** O total ainda a receber, de todo o histórico. */
export function saldoAReceber(itens: ItemFinanceiro[]) {
  return itens.filter(emAberto).reduce((soma, item) => soma + saldoDoItem(item), 0);
}

/**
 * Desde quando este atendimento espera pagamento.
 *
 * A régua é o vencimento quando ele existe. Quando não existe, vale a emissão
 * da nota — e quando nem nota houve, a criação do lançamento. Esta última é a
 * que mais aparece na prática, e é de propósito: atendimento lançado há
 * noventa dias sem nota emitida é um problema de faturamento, não um acerto
 * "que ainda não venceu". Ignorá-lo faria a conta mais bonita e menos útil.
 */
export function referenciaDeIdade(item: ItemFinanceiro): string {
  return item.nota_vencimento_at || item.nota_emitida_at || item.created_at.slice(0, 10);
}

/** Dias inteiros entre duas datas em formato AAAA-MM-DD. */
export function diasEntre(de: string, ate: string) {
  const inicio = Date.parse(`${de.slice(0, 10)}T12:00:00Z`);
  const fim = Date.parse(`${ate.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return 0;
  return Math.round((fim - inicio) / 86_400_000);
}

/** Há quantos dias este atendimento espera. Negativo quando ainda não venceu. */
export const idadeDoItem = (item: ItemFinanceiro, hoje: string) =>
  diasEntre(referenciaDeIdade(item), hoje);

/**
 * O saldo cujo prazo já passou.
 *
 * Só conta o que tem vencimento declarado. Sem essa condição, todo lançamento
 * novo entraria como vencido no dia seguinte e o número perderia o sentido de
 * "alguém não cumpriu o combinado".
 */
export function saldoVencido(itens: ItemFinanceiro[], hoje: string) {
  return itens
    .filter((item) => emAberto(item) && item.nota_vencimento_at && item.nota_vencimento_at < hoje)
    .reduce((soma, item) => soma + saldoDoItem(item), 0);
}

// ── Envelhecimento (aging) ──────────────────────────────────────────────────

export const FAIXAS_DE_IDADE = [
  { id: "ate30", rotulo: "0 a 30 dias", min: 0, max: 30 },
  { id: "ate60", rotulo: "31 a 60 dias", min: 31, max: 60 },
  { id: "ate90", rotulo: "61 a 90 dias", min: 61, max: 90 },
  { id: "acima90", rotulo: "mais de 90 dias", min: 91, max: Infinity },
] as const;

export type FaixaId = (typeof FAIXAS_DE_IDADE)[number]["id"];

export type LinhaDeEnvelhecimento = {
  convenio: string;
  faixas: Record<FaixaId, number>;
  total: number;
};

/**
 * O saldo em aberto de cada convênio, repartido por há quanto tempo espera.
 *
 * É o instrumento que diz para quem ligar na segunda-feira. Um total de
 * R$ 40.000 a receber não diz nada sozinho: quarenta mil com trinta dias é
 * operação saudável, quarenta mil com cento e vinte é dinheiro em risco.
 *
 * Idade negativa — a receber, mas ainda dentro do prazo — cai na primeira
 * faixa. Ela é "no prazo", que é o mesmo lugar de quem venceu ontem para efeito
 * de cobrança: nenhum dos dois exige ligação hoje.
 */
export function envelhecimento(itens: ItemFinanceiro[], hoje: string): LinhaDeEnvelhecimento[] {
  const porConvenio = new Map<string, LinhaDeEnvelhecimento>();

  for (const item of itens) {
    if (!emAberto(item)) continue;
    const convenio = item.convenio || "Particular";
    const linha = porConvenio.get(convenio) ?? {
      convenio,
      faixas: { ate30: 0, ate60: 0, ate90: 0, acima90: 0 },
      total: 0,
    };
    const idade = Math.max(0, idadeDoItem(item, hoje));
    const faixa = FAIXAS_DE_IDADE.find((f) => idade >= f.min && idade <= f.max) ?? FAIXAS_DE_IDADE[0];
    const saldo = saldoDoItem(item);
    linha.faixas[faixa.id] += saldo;
    linha.total += saldo;
    porConvenio.set(convenio, linha);
  }

  // Maior saldo primeiro: é por onde se começa a cobrar.
  return [...porConvenio.values()].sort((a, b) => b.total - a.total);
}

/** A soma de cada coluna, para o rodapé da tabela. */
export function totaisDoEnvelhecimento(linhas: LinhaDeEnvelhecimento[]) {
  const faixas: Record<FaixaId, number> = { ate30: 0, ate60: 0, ate90: 0, acima90: 0 };
  let total = 0;
  for (const linha of linhas) {
    for (const f of FAIXAS_DE_IDADE) faixas[f.id] += linha.faixas[f.id];
    total += linha.total;
  }
  return { faixas, total };
}

// ── Glosa ───────────────────────────────────────────────────────────────────

/**
 * Glosa em dinheiro e como fatia do faturado.
 *
 * A tela contava glosas em UNIDADES. Três glosas de R$ 80 e três de R$ 8.000
 * apareciam idênticas, e a diferença entre elas é a diferença entre um
 * aborrecimento e um mês perdido.
 *
 * O percentual só sai quando há faturamento: dividir por zero devolveria
 * Infinity, e "∞% de glosa" numa tela de dono de clínica é pior que não
 * mostrar nada.
 */
export function glosa(itens: ItemFinanceiro[]) {
  const faturado = itens.reduce((soma, item) => soma + numero(item.valor), 0);
  const emGlosa = itens.filter((item) => item.status === "glosa");
  // Quando o valor glosado não foi preenchido, vale o saldo em aberto do
  // atendimento: é o que o convênio deixou de pagar, que é o que a glosa é.
  const valor = emGlosa.reduce(
    (soma, item) => soma + (numero(item.glosa_valor) || saldoDoItem(item)), 0);
  return {
    quantidade: emGlosa.length,
    valor,
    percentual: faturado > 0 ? (valor / faturado) * 100 : null,
  };
}

// ── Comparação com o mês anterior ───────────────────────────────────────────

/** A competência anterior a "2026-08" é "2026-07". */
export function mesAnterior(periodo: string) {
  const [ano, mes] = periodo.split("-").map(Number);
  if (!ano || !mes) return periodo;
  const d = new Date(Date.UTC(ano, mes - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** A competência de um atendimento: a declarada, ou o mês em que foi lançado. */
export const competenciaDoItem = (item: ItemFinanceiro) =>
  item.periodo || item.created_at.slice(0, 7);

/**
 * A variação percentual entre dois valores.
 *
 * `null` quando a base é zero — de zero para dez mil não é "aumento de mil por
 * cento", é o primeiro mês. Mostrar um percentual ali só produziria uma seta
 * verde gigante sem significado.
 */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

// ── Prazo médio de recebimento ──────────────────────────────────────────────

export type PrazoDeConvenio = {
  convenio: string;
  dias: number;
  pagamentos: number;
  valor: number;
};

/**
 * Quantos dias, em média, cada convênio leva para pagar.
 *
 * Conta da emissão da nota até a entrada do dinheiro, e pesa cada pagamento
 * pelo seu valor: um convênio que paga R$ 50 em cinco dias e R$ 50.000 em
 * noventa não leva "47 dias e meio" na prática — leva quase noventa, porque é
 * onde o dinheiro está. Média simples aqui daria um número bonito e uma
 * projeção de caixa errada.
 *
 * Só entram pagamentos de atendimentos com nota emitida: sem data de emissão
 * não há de onde contar, e usar a criação do lançamento misturaria demora do
 * convênio com demora do próprio faturamento — que é outro problema, e aparece
 * no envelhecimento.
 */
export function prazoMedioPorConvenio(
  itens: Array<ItemFinanceiro & { id: string }>,
  pagamentos: PagamentoRecebido[],
): PrazoDeConvenio[] {
  const porId = new Map(itens.map((item) => [item.id, item]));
  const acumulado = new Map<string, { peso: number; valor: number; pagamentos: number }>();

  for (const pagamento of pagamentos) {
    const item = porId.get(pagamento.atendimento_id);
    if (!item?.nota_emitida_at) continue;
    const dias = diasEntre(item.nota_emitida_at, pagamento.paid_at);
    // Pagamento com data anterior à emissão é erro de digitação, não um
    // convênio que paga adiantado. Entra como zero em vez de puxar a média
    // para baixo com um número negativo.
    const validos = Math.max(0, dias);
    const valor = numero(pagamento.valor);
    if (valor <= 0) continue;
    const convenio = item.convenio || "Particular";
    const atual = acumulado.get(convenio) ?? { peso: 0, valor: 0, pagamentos: 0 };
    atual.peso += validos * valor;
    atual.valor += valor;
    atual.pagamentos += 1;
    acumulado.set(convenio, atual);
  }

  return [...acumulado.entries()]
    .map(([convenio, a]) => ({
      convenio,
      dias: a.valor > 0 ? Math.round(a.peso / a.valor) : 0,
      pagamentos: a.pagamentos,
      valor: a.valor,
    }))
    // O mais demorado primeiro: é o que trava o caixa e o que vale renegociar.
    .sort((a, b) => b.dias - a.dias);
}

/** O ticket médio de uma competência. */
export function ticketMedio(itens: ItemFinanceiro[]) {
  if (!itens.length) return 0;
  return itens.reduce((soma, item) => soma + numero(item.valor), 0) / itens.length;
}
