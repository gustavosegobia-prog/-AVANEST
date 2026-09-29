// O e-mail que avisa que a escala do mês saiu.
//
// POR QUE E-MAIL, SE JÁ EXISTE O PUSH. O push só chega a quem instalou o
// AVANEST na tela de início e autorizou a notificação — no iPhone, o Safari
// comum não recebe nada. Numa equipe recém-cadastrada isso é ninguém, e o
// botão "Avisar a equipe" fazia o trabalho certo para uma plateia vazia. O
// e-mail é o único canal que já existe no dia em que a pessoa entra: ela deu
// o endereço para ser convidada.
//
// A MENSAGEM TRAZ A ESCALA DENTRO, e não um convite para ir ver. "A escala de
// outubro está publicada, entre para conferir" devolve à pessoa exatamente o
// trabalho que ela faria sem e-mail nenhum. Com os plantões escritos, quem
// tem um sábado no mês resolve isso na tela bloqueada do telefone, e quem tem
// doze sabe que precisa abrir e conferir. Os dois são atendidos pela mesma
// mensagem, e nenhum dos dois precisa abrir para descobrir qual é o seu caso.
//
// O QUE NÃO ENTRA, pela mesma razão do push: o VALOR do plantão. E-mail é
// encaminhado, impresso e lido por cima do ombro — quanto um anestesista
// recebe por plantão não é assunto de quem estiver por perto.

import { quandoPlantao } from "./aviso-plantao.ts";

export type PlantaoDoEmail = {
  data?: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  /** O hospital, já resolvido em nome. Vazio quando o plantão não diz onde é. */
  local?: string | null;
};

export type EscalaPublicadaEmail = {
  /** Como chamar a pessoa. Vazio vira um cumprimento sem nome. */
  nome?: string | null;
  /** O grupo dono da escala — é ele que a pessoa reconhece, não o AVANEST. */
  organizacao: string;
  /** "AAAA-MM". */
  mes: string;
  /** Só os plantões DESTA pessoa, já ordenados por dia. */
  plantoes: PlantaoDoEmail[];
  /** Quem montou. Vazio quando foram várias mãos — ver o comentário abaixo. */
  autor?: string | null;
  url?: string;
};

/** "2026-10" -> "outubro de 2026". Com o ano: e-mail se lê meses depois. */
export function mesPorExtenso(mes: string): string {
  const nome = new Date(`${mes}-02T12:00:00Z`)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return nome;
}

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

/** O que sobra de um texto de banco antes de virar HTML. */
const seguro = (texto: string) => String(texto ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

/**
 * "Quarta, 02/09 · 07:00–19:00 · Santa Casa" — a mesma linha do push.
 *
 * De propósito a mesma: quem recebe os dois lê a mesma frase nos dois lugares,
 * e não precisa conferir se são o mesmo plantão.
 */
export const linhaDoPlantao = (p: PlantaoDoEmail) =>
  [quandoPlantao(p), String(p.local ?? "").trim()].filter(Boolean).join(" · ");

export function escalaPublicadaEmail(dados: EscalaPublicadaEmail) {
  const url = dados.url || "https://www.avanest.com.br/dashboard?area=plantoes";
  const quem = tratamento(dados.nome);
  const ola = quem ? `Olá, ${quem}.` : "Olá.";
  const mes = mesPorExtenso(dados.mes);
  const quantos = dados.plantoes.length;
  // DUAS FORMAS DA MESMA CONTAGEM. No assunto não há sujeito, e o "seus" é o
  // que diz que a mensagem é sobre a escala DA PESSOA e não a do grupo. Na
  // abertura já existe o "Você tem", e repetir dá "Você tem 3 plantões seus".
  const plantoes = quantos === 1 ? "1 plantão seu" : `${quantos} plantões seus`;
  const contagem = quantos === 1 ? "1 plantão" : `${quantos} plantões`;

  // O nome de quem montou, quando há um só. Ele responde para quem reclamar de
  // um plantão trocado, e isso vale mais que a formalidade de dizer "a
  // coordenação": no grupo pequeno, reclama-se com uma pessoa.
  const porQuem = String(dados.autor ?? "").trim();
  const abertura = `A escala de ${mes} do ${dados.organizacao} está publicada`
    + (porQuem ? `, montada por ${porQuem}` : "")
    + `. Você tem ${contagem}:`;

  const linhas = dados.plantoes.map(linhaDoPlantao).filter(Boolean);

  return {
    // O NÚMERO NO ASSUNTO. É o que a pessoa quer saber, e metade das caixas de
    // entrada do celular mostram só o assunto: "Escala de outubro publicada"
    // obriga a abrir para descobrir se são dois ou catorze plantões.
    assunto: `Escala de ${mes} — ${plantoes}`,
    texto: [
      ola,
      abertura,
      linhas.map((l) => `• ${l}`).join("\n"),
      `Confira em ${url}`,
      "Se algum plantão estiver errado, fale com quem monta a escala — este "
        + "e-mail é automático.",
    ].join("\n\n"),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;`
      + `max-width:520px;margin:0 auto;padding:28px 24px;color:#0b2239;line-height:1.6">`
      + `<p style="font-size:15px;margin:0 0 18px">${seguro(ola)}</p>`
      + `<h1 style="font-size:20px;margin:0 0 14px;line-height:1.3">`
      + `Escala de ${seguro(mes)} publicada</h1>`
      + `<p style="margin:0 0 18px;font-size:15px">${seguro(abertura)}</p>`
      // A LISTA É O CORPO DA MENSAGEM, e por isso é o bloco destacado — é ela
      // que a pessoa volta a abrir daqui a três semanas para conferir o
      // sábado.
      + `<ul style="margin:0 0 22px;padding:14px 16px 14px 34px;background:#f1f6fb;`
      + `border-radius:10px;font-size:15px">`
      + linhas.map((l) => `<li style="margin:0 0 6px">${seguro(l)}</li>`).join("")
      + `</ul>`
      + `<p style="margin:0 0 22px"><a href="${seguro(url)}" style="display:inline-block;`
      + `background:#0f5fa8;color:#fff;text-decoration:none;padding:12px 22px;`
      + `border-radius:9px;font-weight:700;font-size:15px">Ver minha escala</a></p>`
      + `<p style="margin:0;font-size:13.5px;color:#4a6180">`
      + `Se algum plantão estiver errado, fale com quem monta a escala — `
      + `este e-mail é automático.</p>`
      + `</div>`,
  };
}
