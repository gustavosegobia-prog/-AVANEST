// Para onde é seguro mandar o navegador depois do login.
//
// O /auth/callback recebe um parâmetro `next` que diz para onde ir depois de
// trocar o código por sessão. Quem monta esse link é o Supabase, a partir do
// `redirectTo` que o servidor pede — mas o link chega ao usuário por e-mail e
// pode ser reescrito por qualquer um antes de ele clicar.
//
// A verificação que existia era `next.startsWith("/")`. Ela deixa passar o
// endereço relativo a protocolo:
//
//     new URL("//evil.com", "https://www.avanest.com.br/auth/callback")
//       -> https://evil.com/
//
// Começa com "/", então passava. E `/\evil.com` também: o padrão de URL manda
// a contrabarra virar barra em esquemas http e https, então vira "//evil.com".
//
// Por que isso não é só um redirecionamento chato: o Supabase devolve a sessão
// no fragmento da URL (#access_token=...), e o navegador reanexa o fragmento ao
// destino do redirecionamento. Mandar a pessoa para fora depois de autenticar
// entrega o token de acesso dela ao dono do outro site. É tomada de conta, não
// phishing de aparência.
//
// A regra correta não é conferir como o texto começa: é resolver o endereço
// contra o site e conferir a ORIGEM do resultado. Assim não existe truque de
// escrita que passe, porque quem decide o destino é o mesmo resolvedor que o
// navegador vai usar.

const PADRAO = "/dashboard";

export function destinoInterno(bruto: string | null | undefined, base: string | URL): string {
  if (!bruto) return PADRAO;

  // Só caminho absoluto. Não é a proteção — a proteção é a conferência de
  // origem lá embaixo, e sozinha esta linha seria justamente o bug antigo.
  // É previsibilidade: sem ela, um `next` relativo resolve contra /auth/, e
  // "dashboard" viraria "/auth/dashboard", que não existe. Melhor cair no
  // painel do que numa página em branco.
  if (!bruto.startsWith("/")) return PADRAO;

  let origem: URL;
  try {
    origem = base instanceof URL ? base : new URL(base);
  } catch {
    return PADRAO;
  }

  let destino: URL;
  try {
    destino = new URL(bruto, origem);
  } catch {
    // `new URL` lança em entrada malformada — "//attacker.tld%2f.." derrubava
    // a rota com 500 em vez de mandar para o painel.
    return PADRAO;
  }

  if (destino.origin !== origem.origin) return PADRAO;

  // Devolve caminho e busca, nunca o endereço absoluto: o chamador resolve de
  // novo contra a própria URL, e um absoluto aqui só daria margem a erro.
  // O fragmento fica de fora de propósito — quem o reanexa é o navegador, e é
  // por ali que a sessão viaja.
  return `${destino.pathname}${destino.search}` || PADRAO;
}
