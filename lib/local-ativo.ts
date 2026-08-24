// Onde o profissional está atendendo nesta sessão.
//
// Mora num cookie, e não no localStorage, por um motivo concreto: quem decide
// se a tela de escolha aparece é o /dashboard, que roda no servidor. Do
// localStorage o servidor não lê nada, e a decisão só poderia ser tomada
// depois da página já ter sido montada — o usuário veria o painel piscar e
// ser substituído pela tela de escolha.
//
// O cookie guarda apenas o id. Guardar o nome junto pareceria uma economia,
// mas um nome copiado envelhece: o hospital muda de razão social e o cabeçalho
// do sistema continua exibindo o nome antigo até alguém sair e entrar de novo.
//
// E guardar não é autorizar. O id do cookie é conferido no servidor a cada
// entrada, contra os locais que a pessoa realmente pode usar — quem saiu do
// grupo, ou teve o local arquivado, continuaria com um cookie perfeitamente
// válido.

export const COOKIE_LOCAL = "avanest_local";

/** Um mês. Tempo suficiente para não perguntar todo dia, curto para não virar herança. */
export const COOKIE_LOCAL_MAX_AGE = 60 * 60 * 24 * 30;

export type LocalDisponivel = {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  tipo: string;
  cidade: string | null;
  estado: string | null;
  logo_url: string | null;
  grupo_anestesia: string | null;
  particular: boolean;
  ativo: boolean;
  usado_em: string | null;
};

export const TIPOS_DE_LOCAL = [
  ["hospital", "Hospital"],
  ["clinica", "Clínica"],
  ["consultorio", "Consultório"],
  ["centro_cirurgico", "Centro cirúrgico"],
  ["outro", "Outro"],
] as const;

export function rotuloDoTipo(tipo: string | null | undefined): string {
  return TIPOS_DE_LOCAL.find(([valor]) => valor === tipo)?.[1] ?? "Outro";
}

/**
 * O nome que aparece na tela: o fantasia quando existe, senão a razão social.
 *
 * O trim vem ANTES da escolha, e não depois. Um nome fantasia com só espaços
 * dentro é texto verdadeiro para o `||`, e a versão que aparava no fim
 * devolvia string vazia: o local sumia do calendário, do seletor e do
 * cabeçalho do documento que o paciente leva para casa.
 */
export function nomeDoLocal(local: { nome: string; nome_fantasia?: string | null }): string {
  return (local.nome_fantasia ?? "").trim() || (local.nome ?? "").trim();
}

/**
 * O local do cookie ainda vale?
 *
 * Devolve o local quando ele está na lista de quem pode usá-lo, e null quando
 * não está — inclusive quando foi arquivado. Null significa "pergunte de novo",
 * nunca "siga assim mesmo".
 */
export function localAindaVale(
  id: string | undefined,
  disponiveis: LocalDisponivel[],
): LocalDisponivel | null {
  if (!id) return null;
  return disponiveis.find((local) => local.id === id && local.ativo) ?? null;
}

/**
 * Qual local vale para esta entrada no painel — sem escrever nada.
 *
 * Esta função existe por causa de um erro 500 em produção. O painel resolvia o
 * local escrevendo o cookie durante a renderização, e Server Component não
 * pode escrever cookie: o Next recusa com "Cookies can only be modified in a
 * Server Action or Route Handler" e a página inteira cai. Quem tinha um local
 * só batia nisso toda vez que entrava.
 *
 * A saída não foi mover a escrita para outro lugar: foi perceber que ela não
 * precisava existir. O cookie é conveniência para quem escolhe entre vários;
 * quem tem um só não escolheu nada, e a lista de meus_locais() já é consultada
 * a cada entrada de qualquer forma. Sem escrita, não há o que falhar.
 *
 * Devolver a decisão em vez de executá-la é o que permite conferir aqui, no
 * teste, os casos que só apareceriam em produção: cookie de local arquivado,
 * profissional que saiu do grupo, organização que ainda não cadastrou nada.
 *
 * `precisaEscolher` significa mandar para /locais. Ele nunca é verdadeiro
 * quando existe um único local disponível — era esse o pingue-pongue entre
 * /dashboard e /locais.
 */
export function decidirLocalDaSessao(
  preferido: string | undefined,
  disponiveis: LocalDisponivel[],
  opcoes: { pergunta?: boolean } = {},
): { local: LocalDisponivel | null; precisaEscolher: boolean } {
  const ativos = disponiveis.filter((item) => item.ativo);
  // A pergunta é do anestesiologista, que amanhece num hospital diferente a
  // cada dia. Quem fica na recepção da clínica trabalha sempre no mesmo lugar:
  // perguntar todo login é uma porta a mais para abrir e nenhuma decisão a
  // tomar. Para essas pessoas o sistema resolve sozinho — e não erra
  // cabeçalho de documento clínico, porque não é quem os imprime.
  const pergunta = opcoes.pergunta ?? true;

  const doPreferido = localAindaVale(preferido, ativos);
  if (doPreferido) return { local: doPreferido, precisaEscolher: false };

  // Organização que ainda não cadastrou local nenhum entra como sempre entrou.
  // A funcionalidade se liga sozinha quando o primeiro local nascer.
  if (ativos.length === 0) return { local: null, precisaEscolher: false };

  // Escolher entre uma opção não é escolher.
  if (ativos.length === 1) return { local: ativos[0], precisaEscolher: false };

  // Quem não escolhe fica com o último lugar onde esteve, ou o primeiro da
  // lista — que meus_locais() já devolve com os recentes na frente.
  if (!pergunta) {
    const maisRecente = [...ativos]
      .sort((a, b) => String(b.usado_em ?? "").localeCompare(String(a.usado_em ?? "")))[0];
    return { local: maisRecente ?? null, precisaEscolher: false };
  }

  // Mais de um local e nenhum escolhido nesta sessão: pergunta.
  //
  // Chegou a existir aqui uma regra que adotava sozinha o último lugar onde a
  // pessoa tinha atendido. Foi retirada: o hospital ativo decide o cabeçalho
  // de todo documento impresso no dia, e quem trabalha em três instituições
  // começa cada manhã numa diferente. Herdar a escolha de ontem imprime o
  // nome do hospital errado na ficha que o paciente leva assinado para casa —
  // e ninguém confere um cabeçalho que sempre esteve certo.
  //
  // Quem escolhe é a tela de locais, e só ela. Uma regra, sem surpresa.
  return { local: null, precisaEscolher: true };
}
