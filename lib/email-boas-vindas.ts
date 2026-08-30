// O e-mail que o cliente recebe ao assinar.
//
// Ele existe para responder, por escrito e sem depender do site, as quatro
// perguntas que a pessoa faz depois de pagar: o que eu contratei, quanto vou
// pagar, a partir de quando, e por onde eu entro. Fechada a aba do checkout,
// a resposta a todas elas é este e-mail — e sem ele o cliente que esqueceu o
// endereço do sistema não tem para onde voltar.
//
// A DATA DA PRIMEIRA COBRANÇA É O CENTRO DA MENSAGEM. Período grátis sem data
// escrita é origem de contestação de cartão: a pessoa esquece, vê o débito
// dois meses depois, não reconhece e abre disputa. Dizer "R$ 129,00 a partir
// de 29/10" custa uma linha e evita isso.
//
// O texto mora aqui, e não dentro da rota do webhook, porque é conteúdo — e
// conteúdo que fala de dinheiro merece teste. Uma data mal formatada ou um
// valor com ponto no lugar da vírgula é um cliente ligando.

// Com a extensão, e por isso o `allowImportingTsExtensions` no tsconfig: o
// Next resolve "./escala" sem ela, mas o executor de testes do Node roda os
// .ts direto e resolve por caminho real. Sem o ".ts" era escolher entre
// compilar e testar.
import { money } from "./escala.ts";

export type BoasVindas = {
  /** Como chamar a pessoa. Vazio vira um cumprimento sem nome. */
  nome?: string | null;
  organizacao: string;
  plano: string;
  valorMensal: number;
  /** "AAAA-MM-DD" do primeiro dia cobrado. Nulo quando não há período grátis. */
  primeiraCobranca?: string | null;
  /** Onde entrar. */
  url?: string;
};

const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** "Dr. GUSTAVO SEGOBIA DA SILVA" -> "Dr. Gustavo". Cumprimento, não cadastro. */
function tratamento(nome?: string | null) {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  const titulo = /^(dr|dra)\.?$/i.test(partes[0]) ? partes[0].replace(/\.?$/, ".") : "";
  const proprio = titulo ? partes[1] : partes[0];
  if (!proprio) return titulo;
  const capital = proprio.charAt(0).toUpperCase() + proprio.slice(1).toLowerCase();
  return titulo ? `${titulo} ${capital}` : capital;
}

export function boasVindas(dados: BoasVindas) {
  const url = dados.url || "https://www.avanest.com.br/login";
  const quem = tratamento(dados.nome);
  const ola = quem ? `Olá, ${quem}.` : "Olá.";

  // A frase do dinheiro, montada uma vez e usada nos dois formatos: HTML e
  // texto puro dizendo coisas diferentes sobre cobrança seria o pior lugar
  // possível para uma divergência.
  const cobranca = dados.primeiraCobranca
    ? `O seu período grátis vai até ${dataBR(dados.primeiraCobranca)}. `
      + `A partir dessa data, ${money(dados.valorMensal)} por mês.`
    : `${money(dados.valorMensal)} por mês, a partir de agora.`;

  const linhas = [
    ola,
    `A sua assinatura do AVANEST está ativa — plano ${dados.plano}, para ${dados.organizacao}.`,
    cobranca,
    `Entre em ${url}`,
    "Você pode cancelar quando quiser, em Admin → Assinatura, sem falar com ninguém.",
    "Qualquer dúvida, é só responder este e-mail.",
  ];

  return {
    assunto: `Sua assinatura do AVANEST está ativa — ${dados.organizacao}`,
    texto: linhas.join("\n\n"),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;`
      + `max-width:520px;margin:0 auto;padding:28px 24px;color:#0b2239;line-height:1.6">`
      + `<p style="font-size:15px;margin:0 0 18px">${ola}</p>`
      + `<h1 style="font-size:20px;margin:0 0 14px;line-height:1.3">Sua assinatura está ativa</h1>`
      + `<p style="margin:0 0 18px;font-size:15px">Plano <strong>${dados.plano}</strong>, `
      + `para <strong>${dados.organizacao}</strong>.</p>`
      // O quadro do dinheiro é destacado de propósito: é a informação que a
      // pessoa vai procurar quando reabrir este e-mail daqui a dois meses.
      + `<p style="margin:0 0 22px;padding:14px 16px;background:#f1f6fb;border-radius:10px;`
      + `font-size:15px">${cobranca}</p>`
      + `<p style="margin:0 0 22px"><a href="${url}" style="display:inline-block;`
      + `background:#0f5fa8;color:#fff;text-decoration:none;padding:12px 22px;`
      + `border-radius:9px;font-weight:700;font-size:15px">Entrar no AVANEST</a></p>`
      + `<p style="margin:0 0 8px;font-size:13.5px;color:#4a6180">`
      + `Você pode cancelar quando quiser, em Admin → Assinatura, sem falar com ninguém.</p>`
      + `<p style="margin:0;font-size:13.5px;color:#4a6180">`
      + `Qualquer dúvida, é só responder este e-mail.</p>`
      + `</div>`,
  };
}
