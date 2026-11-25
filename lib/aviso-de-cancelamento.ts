// O aviso ao dono do AVANEST quando um assinante cancela (25/11/2026).
//
// Antes o cancelamento só ficava anotado no banco: ninguém era avisado, e a
// devolução prometida na tela ("o valor deste mês será devolvido") dependia de
// alguém abrir o Stripe por acaso. Agora sai um e-mail na hora, dizendo o que
// fazer — devolver, encerrar a cobrança à mão, ou nada.

export type Cancelamento = {
  organizacao: string;
  plano: string | null;
  quem: { nome: string; email: string } | null;
  motivo: string | null;
  /** Até quando o acesso continua (ISO), ou nulo. */
  acessoAte: string | null;
  emTeste: boolean;
  reembolsoDevido: boolean;
  /** O último pagamento acima de zero, que é o que se devolve. */
  ultimoPagamento: number | null;
  /** A cobrança recorrente foi encerrada no Stripe? false = fazer à mão. */
  cobrancaEncerrada: boolean;
};

const dataBr = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null;
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** O que fazer, numa linha: é a primeira coisa do e-mail. */
export function oQueFazer(c: Cancelamento): string {
  const partes: string[] = [];
  if (c.reembolsoDevido) {
    partes.push(`Devolver ${c.ultimoPagamento ? reais(c.ultimoPagamento) : "o último pagamento"} pelo Stripe (cancelou dentro do prazo de devolução).`);
  }
  if (!c.cobrancaEncerrada) partes.push("Encerrar a cobrança recorrente à mão no Stripe: o sistema não conseguiu.");
  if (!partes.length) {
    partes.push(c.emTeste ? "Nada a fazer: cancelou no período grátis, nada foi cobrado." : "Nada a fazer: fora do prazo de devolução, e a cobrança já foi encerrada.");
  }
  return partes.join(" ");
}

export function emailDeCancelamento(c: Cancelamento): { assunto: string; texto: string; html: string } {
  const assunto = `${c.reembolsoDevido ? "[DEVOLVER] " : ""}Cancelamento: ${c.organizacao}`;
  const linhas = [
    `O QUE FAZER: ${oQueFazer(c)}`,
    "",
    `Organização: ${c.organizacao}${c.plano ? ` (plano ${c.plano})` : ""}`,
    c.quem ? `Quem cancelou: ${c.quem.nome} (${c.quem.email})` : "",
    `Situação: ${c.emTeste ? "no período grátis" : "assinatura paga"}`,
    dataBr(c.acessoAte) ? `Acesso até: ${dataBr(c.acessoAte)}` : "",
    `Motivo: ${c.motivo?.trim() || "não informado"}`,
  ].filter((l) => l !== "");
  const texto = linhas.join("\n");
  const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="max-width:560px;margin:0 auto;padding:20px;font:14px/1.6 system-ui;color:#0f2438">`
    + `<p style="margin:0 0 12px;padding:10px 12px;border-radius:8px;background:${c.reembolsoDevido || !c.cobrancaEncerrada ? "#fff4e0" : "#eef6f2"}">`
    + `<b>O que fazer:</b> ${escapar(oQueFazer(c))}</p>`
    + linhas.slice(2).map((l) => `<div>${escapar(l)}</div>`).join("")
    + `</div>`;
  return { assunto, texto, html };
}
