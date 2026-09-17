// Quem termina a troca do código por sessão: o servidor, e o navegador quando
// o servidor não consegue.
//
// O QUE QUEBROU. O link de recuperação de senha traz `?code=...`. O
// /auth/callback troca esse código por sessão no servidor, e para isso precisa
// do COMPROVANTE (o code verifier do PKCE) que o navegador guardou em cookie
// quando pediu o e-mail. Em produção esse comprovante não chegava ao servidor:
// o registro do Supabase mostra o link sendo aceito e NENHUMA troca de código
// chegando depois — o erro nasce dentro do servidor, antes de virar rede,
// porque o cookie não estava lá. A pessoa era devolvida para
// /recuperar-senha?erro=link-invalido com o link perfeitamente válido na mão.
//
// SÃO DUAS FALHAS SOMADAS, e esta correção ataca as duas.
//
// 1. O SERVIDOR PROCURAVA O COMPROVANTE ERRADO. Desde que a biblioteca passou
//    a permitir vários pedidos ao mesmo tempo, cada um grava o seu comprovante
//    numa gaveta própria, endereçada por `sb_flow_id` — que o Supabase devolve
//    na URL do callback. Sem passar esse número, a biblioteca cai numa gaveta
//    antiga de compatibilidade que guarda apenas O ÚLTIMO pedido. Quem pediu
//    três e-mails (foi o caso aqui) e clicou no primeiro encontrava o
//    comprovante do terceiro. Agora o número é lido da URL e repassado.
//
// 2. O COMPROVANTE PODE SIMPLESMENTE NÃO CHEGAR. O cookie é gravado por
//    JavaScript sem `Secure` e viaja numa navegação que vem de outro site (o
//    Supabase redireciona para cá), e nem todo navegador o envia nesse salto —
//    o caso relatado é Safari no iPhone, pedindo e abrindo no mesmo aparelho.
//    Não dá para consertar isso do lado do servidor, então o servidor deixa de
//    ser o único que pode terminar: falhou, o código segue para a página de
//    destino e QUEM TERMINA É O NAVEGADOR, que lê os próprios cookies sem
//    depender de nenhum salto entre sites.
//
// O caminho que já funcionava não muda: o servidor continua tentando primeiro,
// e só quando ele falha é que o código é repassado adiante.

// O nome do parâmetro é da biblioteca (auth-js, `PKCE_FLOW_ID_PARAM`). Fica
// escrito aqui uma vez só para não haver duas grafias soltas pelo código.
export const PARAM_CODIGO = "code";
export const PARAM_FLUXO = "sb_flow_id";

// Mesma forma que a biblioteca aceita: ela gera 32 dígitos hexadecimais, e
// recusa qualquer coisa fora desta faixa. Conferir aqui também evita repassar
// lixo adiante — um valor recusado vira ausência, e a busca volta para a
// gaveta de compatibilidade, que é o comportamento de antes.
const FLUXO_VALIDO = /^[A-Za-z0-9_-]{8,64}$/;

export function fluxoDoLink(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  return FLUXO_VALIDO.test(bruto) ? bruto : null;
}

// Monta o destino levando junto o código, para o navegador terminar o serviço.
//
// `destino` já vem conferido por `destinoInterno` — é sempre caminho interno,
// nunca outro site. Isso importa: o código de autorização vai na URL, e mandá-lo
// para fora seria entregar a conta. A função não confere de novo; ela EXIGE que
// a conferência já tenha acontecido, e é por isso que o único chamador é a rota
// do callback, logo depois de chamar `destinoInterno`.
export function destinoComOCodigo(
  destino: string,
  codigo: string,
  fluxo: string | null,
): string {
  // Base fictícia: só existe para o parser funcionar. O que sai é caminho +
  // busca, do mesmo jeito que `destinoInterno` devolve, e quem resolve contra o
  // site de verdade é quem chama.
  const url = new URL(destino, "https://exemplo.invalido");
  url.searchParams.set(PARAM_CODIGO, codigo);
  if (fluxo) url.searchParams.set(PARAM_FLUXO, fluxo);
  return `${url.pathname}${url.search}`;
}

// A página de destino sabe que vai receber um código quando ele está na URL.
// Serve para ela esperar a troca terminar em vez de acusar "link inválido"
// enquanto a conversa com o Supabase ainda está no ar.
export function temCodigoNaUrl(busca: string): boolean {
  return new URLSearchParams(busca).has(PARAM_CODIGO);
}
