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

/** O nome que aparece na tela: o fantasia quando existe, senão a razão social. */
export function nomeDoLocal(local: { nome: string; nome_fantasia?: string | null }): string {
  return (local.nome_fantasia || local.nome || "").trim();
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
