// Mandar e-mail.
//
// O AVANEST não mandava nenhum. O único que saía era o convite de equipe, e
// esse é do Supabase — o produto em si nunca falou com o cliente por e-mail.
// Para um sistema que agora tem assinante pagante isso é um buraco: a pessoa
// paga, fecha a aba e não tem NADA escrito dizendo o que contratou, por quanto
// e até quando. Se ela esquecer o endereço do site, acabou.
//
// POR QUE RESEND. É um POST com JSON e uma chave — cabe em quarenta linhas de
// `fetch`, sem SDK, como o Stripe e o Web Push deste mesmo projeto. Trocar de
// serviço depois é reescrever só a função de entrega.
//
// SEM CHAVE, NÃO MANDA E NÃO QUEBRA. Mesma regra das notificações: e-mail é
// acessório, e derrubar uma assinatura paga porque o serviço de e-mail está
// fora do ar seria trocar a função pela cortesia.

const API = "https://api.resend.com/emails";

/** Quem assina. O domínio precisa estar verificado no Resend, ou nada sai. */
const REMETENTE = () => process.env.EMAIL_REMETENTE || "AVANEST <contato@avanest.com.br>";

export const emailConfigurado = () => Boolean(process.env.RESEND_API_KEY);

export type Mensagem = {
  para: string;
  assunto: string;
  /** O corpo bonito. */
  html: string;
  /**
   * O mesmo conteúdo em texto puro.
   *
   * Não é enfeite: mensagem só-HTML pontua alto em filtro de spam, e um
   * sistema clínico que cai na caixa de lixo do cliente não tem segunda
   * chance de dizer que a assinatura está ativa.
   */
  texto: string;
};

export type Resultado =
  | { ok: true; id: string | null }
  | { ok: false; erro: string };

/** Um endereço que vale a pena tentar. Recusar aqui poupa uma ida à rede. */
export const enderecoValido = (email: string) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email ?? "").trim());

/**
 * Entrega a mensagem.
 *
 * Nunca lança. Quem chama está sempre no meio de outra coisa — confirmar um
 * pagamento, criar uma conta — e essa outra coisa não pode falhar porque o
 * e-mail falhou.
 */
export async function enviarEmail(mensagem: Mensagem): Promise<Resultado> {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) return { ok: false, erro: "e-mail não configurado" };
  if (!enderecoValido(mensagem.para)) return { ok: false, erro: "endereço inválido" };
  try {
    const resposta = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: REMETENTE(),
        to: [mensagem.para],
        subject: mensagem.assunto,
        html: mensagem.html,
        text: mensagem.texto,
      }),
    });
    if (!resposta.ok) {
      return { ok: false, erro: `${resposta.status} ${(await resposta.text().catch(() => "")).slice(0, 200)}` };
    }
    const dados = await resposta.json().catch(() => null) as { id?: string } | null;
    return { ok: true, id: dados?.id ?? null };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}
