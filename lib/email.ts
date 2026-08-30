// Mandar e-mail.
//
// O AVANEST não mandava nenhum. O único que saía era o convite de equipe, e
// esse é do Supabase — o produto em si nunca falou com o cliente por e-mail.
// Para um sistema que agora tem assinante pagante isso é um buraco: a pessoa
// paga, fecha a aba e não tem NADA escrito dizendo o que contratou, por quanto
// e até quando. Se ela esquecer o endereço do site, acabou.
//
// DOIS PROVEDORES, E NÃO POR SIMETRIA VAZIA. O mesmo desenho da camada de
// pagamento, pelo mesmo motivo — lá foram três gateways em um ano. Aqui o
// motivo apareceu antes de a primeira mensagem sair: o DNS do avanest.com.br
// é gerenciado pelo Wix, o Wix NÃO deixa criar registro MX em subdomínio, e o
// Resend exige exatamente isso (um MX em `send.avanest.com.br`, para tratar
// devoluções). O domínio não verifica, e nenhum e-mail sai.
//
// O SendGrid autentica o domínio com três CNAME, que o Wix aceita sem
// reclamar. Então o sistema fala os dois: quem tiver chave configurada manda.
// Trocar de serviço é mexer numa função de entrega, não no resto.
//
// SEM CHAVE, NÃO MANDA E NÃO QUEBRA. Mesma regra das notificações: e-mail é
// acessório, e derrubar uma assinatura paga porque o serviço de e-mail está
// fora do ar seria trocar a função pela cortesia.

export type Provedor = "resend" | "sendgrid";

/** Quem assina. O domínio precisa estar verificado no provedor, ou nada sai. */
const REMETENTE = () => process.env.EMAIL_REMETENTE || "AVANEST <contato@avanest.com.br>";

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
  | { ok: true; id: string | null; provedor: Provedor }
  | { ok: false; erro: string };

/** Um endereço que vale a pena tentar. Recusar aqui poupa uma ida à rede. */
export const enderecoValido = (email: string) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email ?? "").trim());

/**
 * "AVANEST <contato@avanest.com.br>" -> { nome, email }.
 *
 * O Resend engole a linha inteira; o SendGrid quer nome e endereço em campos
 * separados e recusa o JSON se vier tudo junto. A configuração continua sendo
 * UMA variável de ambiente, no formato que todo mundo já conhece, e quem
 * precisa das partes separa aqui.
 */
export function separarRemetente(texto: string): { nome: string; email: string } {
  const bruto = String(texto ?? "").trim();
  const comNome = bruto.match(/^(.*)<\s*([^>]+)\s*>$/);
  if (!comNome) return { nome: "", email: bruto };
  return {
    // As aspas do formato `"Nome Com, Vírgula" <a@b.c>` não fazem parte do nome.
    nome: comNome[1].trim().replace(/^"(.*)"$/, "$1").trim(),
    email: comNome[2].trim(),
  };
}

/**
 * Qual serviço manda.
 *
 * EMAIL_PROVEDOR força um deles, para o dia da migração em que os dois estão
 * configurados ao mesmo tempo. Sem ele, quem tiver chave manda. Devolve null
 * quando não há nenhum — e aí ninguém tenta nada.
 */
export function provedorDeEmail(): Provedor | null {
  const escolhido = process.env.EMAIL_PROVEDOR as Provedor | undefined;
  if (escolhido === "resend") return process.env.RESEND_API_KEY ? "resend" : null;
  if (escolhido === "sendgrid") return process.env.SENDGRID_API_KEY ? "sendgrid" : null;
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  return null;
}

export const emailConfigurado = () => provedorDeEmail() !== null;

/**
 * Entrega a mensagem.
 *
 * Nunca lança. Quem chama está sempre no meio de outra coisa — confirmar um
 * pagamento, criar uma conta — e essa outra coisa não pode falhar porque o
 * e-mail falhou.
 */
export async function enviarEmail(mensagem: Mensagem): Promise<Resultado> {
  const provedor = provedorDeEmail();
  if (!provedor) return { ok: false, erro: "e-mail não configurado" };
  if (!enderecoValido(mensagem.para)) return { ok: false, erro: "endereço inválido" };
  try {
    return provedor === "resend" ? await porResend(mensagem) : await porSendGrid(mensagem);
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
  }
}

/** O corpo do erro, curto o bastante para caber num log e longo o bastante para servir. */
async function motivo(resposta: Response) {
  return `${resposta.status} ${(await resposta.text().catch(() => "")).slice(0, 200)}`;
}

async function porResend(mensagem: Mensagem): Promise<Resultado> {
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: REMETENTE(),
      to: [mensagem.para],
      subject: mensagem.assunto,
      html: mensagem.html,
      text: mensagem.texto,
    }),
  });
  if (!resposta.ok) return { ok: false, erro: await motivo(resposta) };
  const dados = await resposta.json().catch(() => null) as { id?: string } | null;
  return { ok: true, id: dados?.id ?? null, provedor: "resend" };
}

async function porSendGrid(mensagem: Mensagem): Promise<Resultado> {
  const de = separarRemetente(REMETENTE());
  const resposta = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: mensagem.para }] }],
      from: de.nome ? { email: de.email, name: de.nome } : { email: de.email },
      subject: mensagem.assunto,
      // A ORDEM IMPORTA: o SendGrid manda a última parte como preferida, e
      // texto puro depois do HTML faria o cliente de e-mail mostrar a versão
      // sem formatação. Invertido, é o que o Resend já fazia sozinho.
      content: [
        { type: "text/plain", value: mensagem.texto },
        { type: "text/html", value: mensagem.html },
      ],
    }),
  });
  // O SendGrid responde 202 com corpo VAZIO. Tentar ler JSON aqui daria erro
  // num envio que deu certo.
  if (!resposta.ok) return { ok: false, erro: await motivo(resposta) };
  return { ok: true, id: resposta.headers?.get?.("x-message-id") ?? null, provedor: "sendgrid" };
}
