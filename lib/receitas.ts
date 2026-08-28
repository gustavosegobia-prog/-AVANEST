// De onde vem o dinheiro do serviço — todas as fontes, num formato só.
//
// O Financeiro nasceu enxergando UMA fonte: a consulta pré-anestésica cobrada
// por convênio. Só que um serviço de anestesiologia ganha de três jeitos, e
// para a maioria dos grupos a consulta é a menor fatia:
//
//   consulta   avaliação pré-anestésica cobrada do convênio ou do paciente
//   produção   o que foi anestesiado no dia e precisa ser cobrado
//   plantão    o valor combinado do turno, pago pelo hospital
//
// As duas últimas existiam no sistema e não chegavam a conta nenhuma: a
// produção aparecia como lista de leitura, o plantão vivia só na Escala. O
// painel mostrava a menor fatia e chamava de faturamento.
//
// Aqui elas viram um tipo só. O resto da tela — total, por origem, por
// profissional — trabalha sobre `Receita` e não sabe de onde cada linha veio.

export type Origem = "consulta" | "producao" | "plantao";

export const ROTULO_ORIGEM: Record<Origem, string> = {
  consulta: "Consultas pré-anestésicas",
  producao: "Produção anestésica",
  plantao: "Plantões",
};

export type Receita = {
  id: string;
  origem: Origem;
  /** AAAA-MM-DD. */
  data: string;
  /** AAAA-MM. */
  competencia: string;
  /**
   * De quem é esta receita.
   *
   * É o que permite responder "quanto é meu" num grupo. Cada uma das três
   * fontes já guarda o dono — `medico_id` na consulta, `perfil_id` na produção
   * e no plantão —, então a pergunta é respondível sem nada novo no banco.
   */
  donoId: string | null;
  descricao: string;
  /** Quem paga: convênio, hospital ou o próprio paciente. */
  pagador: string;
  valor: number;
  recebido: number;
  /**
   * Emissão e vencimento da nota, quando a fonte tem isso.
   *
   * Só a consulta tem hoje. Plantão e produção não passam por emissão de nota
   * dentro do sistema — o hospital paga pelo combinado do mês —, e por isso vêm
   * nulos. Quem consome trata a ausência: no envelhecimento, sem vencimento
   * vale a data do próprio atendimento; no prazo médio, sem emissão a linha nem
   * entra, porque não há de onde contar.
   */
  emissao?: string | null;
  vencimento?: string | null;
};

const numero = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const competenciaDe = (data: string) => data.slice(0, 7);

// ── As três entradas ────────────────────────────────────────────────────────

export type ConsultaBruta = {
  id: string; convenio: string; hospital?: string | null;
  valor: number; recebido: number; status: string;
  medico_id?: string | null; periodo?: string | null; created_at: string;
  nota_emitida_at?: string | null; nota_vencimento_at?: string | null;
};

/**
 * A consulta pré-anestésica.
 *
 * A competência é a declarada quando existe: o financeiro fecha por mês de
 * atendimento, e um lançamento criado em setembro para uma consulta de agosto
 * pertence a agosto. Cancelado sai — não é receita, é linha que não existe.
 */
export function deConsulta(item: ConsultaBruta, nomeDoPaciente?: string): Receita | null {
  if (item.status === "cancelado") return null;
  const data = (item.periodo ? `${item.periodo}-01` : item.created_at.slice(0, 10));
  return {
    id: `consulta:${item.id}`,
    origem: "consulta",
    data,
    competencia: item.periodo || competenciaDe(item.created_at),
    donoId: item.medico_id ?? null,
    descricao: nomeDoPaciente || "Consulta pré-anestésica",
    pagador: item.convenio || "Particular",
    valor: numero(item.valor),
    recebido: numero(item.recebido),
    emissao: item.nota_emitida_at ?? null,
    vencimento: item.nota_vencimento_at ?? null,
  };
}

export type ProducaoBruta = {
  id: string; perfil_id: string; data: string; paciente: string;
  convenio: string; procedimento?: string | null; valor: number; situacao: string;
};

/**
 * A anestesia anotada no dia.
 *
 * `recebido` só conta quando o dinheiro entrou de fato. Glosado FICA na
 * receita com recebido zero: é dinheiro que se está tentando recuperar, e
 * tirá-lo esconderia a perda em vez de mostrá-la — o mesmo critério do resto
 * do financeiro.
 */
export function deProducao(item: ProducaoBruta): Receita | null {
  if (item.situacao === "cancelado") return null;
  return {
    id: `producao:${item.id}`,
    origem: "producao",
    data: item.data,
    competencia: competenciaDe(item.data),
    donoId: item.perfil_id,
    descricao: item.procedimento ? `${item.paciente} — ${item.procedimento}` : item.paciente,
    pagador: item.convenio || "Particular",
    valor: numero(item.valor),
    recebido: item.situacao === "recebido" ? numero(item.valor) : 0,
  };
}

export type PlantaoBruto = {
  id: string; perfil_id: string; data: string; valor: number;
  situacao: string;
  /**
   * Onde foi o plantão, nas duas formas que o sistema guarda.
   *
   * `local_id` aponta para o cadastro; `local_texto` é o plantão de fora —
   * sedação em consultório, cobertura num hospital que não é do serviço —, que
   * guarda o lugar escrito à mão. Quem chama resolve o id para `local_nome`,
   * porque só a tela tem a lista de locais.
   */
  local_id?: string | null;
  local_texto?: string | null;
  local_nome?: string | null;
};

/**
 * O turno combinado.
 *
 * `escalado` é plantão que ainda não aconteceu: entra como zero, e não como
 * receita a receber. Contar o mês inteiro da escala como faturamento no dia 1º
 * daria um número que se desfaz a cada cancelamento — e a tela do financeiro
 * existe para dizer o que É, não o que talvez venha a ser.
 *
 * `realizado` é trabalho feito e ainda não pago: valor cheio, recebido zero.
 * `pago` é valor cheio recebido. `cancelado` sai.
 */
export function dePlantao(item: PlantaoBruto): Receita | null {
  if (item.situacao === "cancelado" || item.situacao === "escalado") return null;
  const onde = item.local_nome || item.local_texto || "Local não informado";
  return {
    id: `plantao:${item.id}`,
    origem: "plantao",
    data: item.data,
    competencia: competenciaDe(item.data),
    donoId: item.perfil_id,
    descricao: `Plantão — ${onde}`,
    pagador: onde,
    valor: numero(item.valor),
    recebido: item.situacao === "pago" ? numero(item.valor) : 0,
  };
}

// ── Somas ───────────────────────────────────────────────────────────────────

export type Soma = { valor: number; recebido: number; aReceber: number; linhas: number };

const somaVazia = (): Soma => ({ valor: 0, recebido: 0, aReceber: 0, linhas: 0 });

function acumular(alvo: Soma, receita: Receita) {
  alvo.valor += receita.valor;
  alvo.recebido += receita.recebido;
  alvo.aReceber += Math.max(0, receita.valor - receita.recebido);
  alvo.linhas += 1;
  return alvo;
}

export const somar = (receitas: Receita[]) => receitas.reduce(acumular, somaVazia());

export const doMes = (receitas: Receita[], competencia: string) =>
  receitas.filter((r) => r.competencia === competencia);

/** Quanto veio de cada uma das três fontes. Sempre as três, mesmo zeradas —
 *  uma origem que some da tabela vira uma pergunta ("cadê os plantões?") em vez
 *  de uma resposta ("os plantões deram zero"). */
export function porOrigem(receitas: Receita[]): Array<{ origem: Origem; rotulo: string } & Soma> {
  const mapa = new Map<Origem, Soma>(
    (Object.keys(ROTULO_ORIGEM) as Origem[]).map((o) => [o, somaVazia()]));
  for (const receita of receitas) acumular(mapa.get(receita.origem)!, receita);
  return (Object.keys(ROTULO_ORIGEM) as Origem[])
    .map((origem) => ({ origem, rotulo: ROTULO_ORIGEM[origem], ...mapa.get(origem)! }));
}

export type FatiaDeProfissional = { donoId: string | null; nome: string } & Soma;

/**
 * Quanto é de cada um.
 *
 * A REGRA DE DIVISÃO MORA AQUI, e é uma só: cada um leva o que produziu. O
 * plantão é de quem plantonou, a consulta de quem avaliou, a anestesia de quem
 * anestesiou — que é como a maioria dos grupos de anestesia acerta entre si, e
 * o único modelo que o banco já suporta sem cadastro novo, porque toda linha
 * já nasce com dono.
 *
 * Outros grupos dividem diferente — bolo comum por cotas de sociedade, ou
 * misto. Quando isso for configurável, é esta função que ganha o parâmetro; o
 * resto da tela não muda, porque só consome o resultado.
 *
 * Receita sem dono não é jogada fora: vira uma linha "Sem profissional
 * vinculado". São os lançamentos antigos, feitos antes de o sistema guardar
 * quem atendeu. Somem-nas no silêncio e o total da tela deixa de bater com o
 * total do grupo — que é o tipo de diferença que ninguém consegue explicar
 * depois.
 */
export function porProfissional(
  receitas: Receita[],
  nomes: Map<string, string>,
): FatiaDeProfissional[] {
  const mapa = new Map<string, { nome: string; soma: Soma }>();
  for (const receita of receitas) {
    const chave = receita.donoId ?? "";
    const atual = mapa.get(chave) ?? {
      nome: receita.donoId ? (nomes.get(receita.donoId) || "Profissional") : "Sem profissional vinculado",
      soma: somaVazia(),
    };
    acumular(atual.soma, receita);
    mapa.set(chave, atual);
  }
  return [...mapa.entries()]
    .map(([chave, { nome, soma }]) => ({ donoId: chave || null, nome, ...soma }))
    .sort((a, b) => b.valor - a.valor);
}

/** O que é de uma pessoa só. Usada na visão de quem não é administrador. */
export const minhaFatia = (receitas: Receita[], perfilId: string) =>
  somar(receitas.filter((r) => r.donoId === perfilId));

/**
 * A receita no formato que os indicadores de recebível entendem.
 *
 * O envelhecimento e o prazo médio nasceram lendo `financeiro_atendimentos` e
 * foram escritos e testados contra aquele formato. Em vez de duplicá-los para
 * um segundo tipo — duas implementações da mesma regra é onde nasce a
 * divergência silenciosa —, a receita se traduz para o formato deles.
 *
 * O `status` sai sempre "aguardando" de propósito: cancelado já foi filtrado na
 * conversão de cada fonte, e "glosa" é estado da cobrança da consulta, não da
 * receita. Marcar plantão como glosa daria uma taxa de glosa que não existe.
 */
export const paraRecebivel = (receita: Receita) => ({
  id: receita.id,
  convenio: receita.pagador,
  valor: receita.valor,
  recebido: receita.recebido,
  status: "aguardando",
  nota_emitida_at: receita.emissao ?? null,
  nota_vencimento_at: receita.vencimento ?? null,
  // Sem vencimento nem emissão — plantão e produção —, a idade conta da data do
  // atendimento. É a data em que o serviço foi prestado, que é quando o
  // dinheiro passou a ser devido.
  created_at: `${receita.data}T12:00:00Z`,
});
