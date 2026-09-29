/**
 * Esta sessão nasceu de um link de recuperação, ou de uma senha digitada?
 *
 * A PERGUNTA QUE FALTAVA. A tela de criar nova senha exigia apenas que
 * HOUVESSE uma sessão — e trocava a senha. Num computador compartilhado, que
 * é o normal no hospital, qualquer pessoa que encontrasse o navegador aberto
 * podia abrir aquele endereço e ficar com a conta do médico para sempre: senha
 * nova, acesso permanente, e o dono descobrindo só no dia em que não
 * conseguisse entrar.
 *
 * O SINAL É ASSINADO, e não um parâmetro na URL. Um `?recuperacao=1` seria
 * digitado por quem quisesse; o `amr` do token vem do Supabase, que registra
 * em `auth.mfa_amr_claims` se a sessão veio de `password` ou de `recovery`, e
 * assina o token inteiro. Não se forja sem a chave do projeto.
 *
 * ATÉ ONDE ISTO PROTEGE, e é importante ser honesto: contra quem encontra o
 * navegador aberto, protege. Contra quem abre o console do navegador e chama
 * a API do Supabase direto, não — nada que rode no navegador protegeria, e
 * quem já tem a sessão já pode ler tudo de qualquer forma; o que a troca de
 * senha acrescenta é PERMANÊNCIA. A tranca de verdade é do lado do servidor:
 * "Secure password change" nas configurações de autenticação do Supabase, que
 * passa a exigir reautenticação para trocar senha — menos, justamente, quando
 * a sessão veio de recuperação.
 */

/** Como o Supabase nomeia o método no `amr`. */
const RECUPERACAO = "recovery";

type MetodoDoToken = string | { method?: unknown };

/**
 * O miolo do token, sem conferir assinatura.
 *
 * NÃO VALIDA NADA, e não precisa: quem valida o token é o Supabase, a cada
 * chamada. Aqui só se lê o que ele já disse, para a TELA decidir o que
 * mostrar. Conferir assinatura no navegador seria teatro — a chave pública
 * estaria ao lado do código que a usa.
 */
function miolo(token: string): Record<string, unknown> | null {
  const partes = String(token ?? "").split(".");
  if (partes.length !== 3) return null;
  try {
    // base64url -> base64. O `atob` não entende `-` e `_`, e o preenchimento
    // com `=` some na codificação para URL.
    const base = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const cheio = base + "=".repeat((4 - (base.length % 4)) % 4);
    const cru = atob(cheio);
    // O JSON pode ter acento — nome de gente tem. `atob` devolve bytes, e ler
    // como texto direto quebraria "José" em dois caracteres.
    const bytes = Uint8Array.from(cru, (c) => c.charCodeAt(0));
    const texto = new TextDecoder("utf-8").decode(bytes);
    const dados = JSON.parse(texto) as unknown;
    return dados && typeof dados === "object" ? dados as Record<string, unknown> : null;
  } catch {
    // Token malformado é "não veio de recuperação", e não um erro na tela: o
    // resultado prático é o mesmo — esta pessoa não troca a senha por aqui.
    return null;
  }
}

/**
 * `true` só quando o token diz, ele mesmo, que a sessão veio de recuperação.
 *
 * O `amr` aceita dois formatos — lista de textos ou lista de objetos com
 * `method` —, e a biblioteca do Supabase documenta os dois. Ler só um deles
 * faria a tela recusar um link bom no dia em que o formato mudasse, que é o
 * pior defeito possível aqui: manda a pessoa pedir outro e-mail que também
 * não vai funcionar.
 */
export function sessaoVeioDeRecuperacao(accessToken: string | null | undefined): boolean {
  if (!accessToken) return false;
  const dados = miolo(accessToken);
  const amr = dados?.amr;
  if (!Array.isArray(amr)) return false;
  return amr.some((entrada: MetodoDoToken) => {
    if (typeof entrada === "string") return entrada === RECUPERACAO;
    return entrada && typeof entrada === "object" && entrada.method === RECUPERACAO;
  });
}
