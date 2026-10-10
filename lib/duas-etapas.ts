// Verificação em duas etapas (código de 6 dígitos do aplicativo autenticador).
//
// POR QUE EXISTE. Quem é proprietário ou administrador enxerga e muda a
// organização inteira: a equipe, os acessos, a cobrança, e os dados clínicos
// de todos os pacientes. Uma senha vazada ou anotada no computador do centro
// cirúrgico bastava para tudo isso. Com a segunda etapa, a senha sozinha não
// abre mais nada: falta o código que só o telefone da pessoa gera.
//
// ONDE MORA A TRANCA. A tela que pede o código é o caminho, não a tranca. A
// tranca é o banco (supabase/migrations/202610100003_duas_etapas.sql): para
// quem tem a verificação ativa, toda chamada à API com sessão sem o código
// confirmado ("aal1") é recusada — inclusive quem tentar a chave pública
// direto, sem passar por estas telas. O proxy só redireciona antes, para a
// pessoa ver a tela do código e não uma página quebrada.
//
// QUEM É OBRIGADO. Proprietário, administrador e o operador da plataforma.
// Para o resto da equipe é opcional, em Minha conta.

type QuemEntra = {
  role?: string | null;
  super_admin?: boolean | null;
  permissoes?: string[] | null;
};

/** Esta pessoa precisa ter a verificação em duas etapas ativa para entrar? */
export function exigeDuasEtapas(perfil: QuemEntra | null | undefined): boolean {
  if (!perfil) return false;
  if (perfil.super_admin === true) return true;
  if (perfil.role === "owner" || perfil.role === "admin") return true;
  return (perfil.permissoes ?? []).some((p) => p === "owner" || p === "admin");
}

/**
 * As rotas que o proxy confere. São as do sistema por dentro; as páginas
 * públicas (capa, planos, termos) e o próprio login ficam de fora — mandar
 * para a tela do código quem só abriu a capa seria estranho, e a tranca de
 * verdade está no banco.
 *
 * /atualizar-senha fica de fora de propósito: o link de recuperação depende
 * do código na URL, e um redirecionamento no meio o perderia. A tela trata
 * sozinha a recusa do Supabase ("insufficient_aal") e manda confirmar o
 * código antes.
 */
const PROTEGIDAS = ["/dashboard", "/locais", "/avaliacoes", "/assinatura", "/organizacoes", "/comecar", "/convite", "/calculos", "/api/"];

export function rotaPedeDuasEtapas(caminho: string): boolean {
  return PROTEGIDAS.some((p) => p.endsWith("/") ? caminho.startsWith(p) : caminho === p || caminho.startsWith(`${p}/`));
}

/**
 * Para onde voltar depois do código. Só caminho interno: um `?depois=` que
 * aceitasse "https://outro-site" ou "//outro-site" transformaria a tela do
 * código num redirecionador para página falsa de login.
 */
export function destinoSeguro(depois: string | null | undefined, padrao = "/locais"): string {
  const d = String(depois ?? "");
  if (!d.startsWith("/") || d.startsWith("//") || d.startsWith("/\\") || d.startsWith("/duas-etapas")) return padrao;
  return d;
}

/** O segredo em grupos de quatro, para digitar à mão no aplicativo. */
export const segredoEmGrupos = (segredo: string) =>
  String(segredo ?? "").replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();

/** Só os dígitos, até seis: o que a pessoa colou ou digitou com espaço. */
export const codigoDigitado = (texto: string) => String(texto ?? "").replace(/\D/g, "").slice(0, 6);
