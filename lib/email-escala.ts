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
// doze sabe que precisa abrir e conferir.
//
// E ELA TAMBÉM VENDE O SISTEMA, de propósito. Este é o único e-mail que um
// anestesiologista do grupo recebe com certeza — ele chega antes de a pessoa
// ter qualquer motivo para abrir o AVANEST sozinha. Se a mensagem só entregar
// a lista, ela terá ensinado que o AVANEST é um lugar de onde chega escala por
// e-mail, e a pessoa nunca vai descobrir que pode pedir troca, oferecer um
// plantão ou receber lembrete. Por isso os dois botões, e por isso o de
// instalar vem antes: sem o aplicativo na tela de início, o iPhone não entrega
// notificação nenhuma, e metade do produto fica invisível.
//
// O QUE NÃO ENTRA, pela mesma razão do push: o VALOR do plantão. E-mail é
// encaminhado, impresso e lido por cima do ombro — quanto um anestesista
// recebe por plantão não é assunto de quem estiver por perto.
//
// ── SOBRE O HTML ────────────────────────────────────────────────────────────
//
// TABELAS, e não `div` com flex. Não é gosto antiquado: o Outlook do Windows
// renderiza e-mail com o motor do Word, que ignora `flex`, `grid` e metade do
// CSS moderno. Um layout que fica bonito no Gmail e desmonta no Outlook do
// administrador do hospital é um layout quebrado.
//
// ESTILO NA LINHA, e não em `<style>`: o Gmail descarta folhas de estilo.
// Sem `@media` também, pelo mesmo motivo — a responsividade aqui vem de
// `max-width` com largura percentual, que funciona sem media query nenhuma.

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
  /** Onde a escala se abre. */
  url?: string;
  /** Onde se aprende a pôr o AVANEST na tela de início. */
  urlApp?: string;
};

export const URL_ESCALA = "https://www.avanest.com.br/dashboard?area=plantoes";
export const URL_APP = "https://www.avanest.com.br/app";

/** "2026-10" -> "outubro de 2026". Com o ano: e-mail se lê meses depois. */
export function mesPorExtenso(mes: string): string {
  return new Date(`${mes}-02T12:00:00Z`)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
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
 * e não precisa conferir se são o mesmo plantão. No HTML ela é quebrada em
 * três pedaços, mas o texto puro continua sendo esta.
 */
export const linhaDoPlantao = (p: PlantaoDoEmail) =>
  [quandoPlantao(p), String(p.local ?? "").trim()].filter(Boolean).join(" · ");

/**
 * O que se pode fazer no AVANEST além de olhar a escala.
 *
 * Escrito como GANHO de quem lê, e não como lista de funcionalidades: "peça
 * troca de plantão sem depender do grupo do WhatsApp" diz por que vale a pena;
 * "módulo de trocas" não diz nada a quem nunca usou.
 */
const O_QUE_DA_PARA_FAZER = [
  "Pedir troca de plantão e responder aos pedidos dos colegas, direto pela plataforma",
  "Oferecer um plantão para outro profissional assumir",
  "Acompanhar escalas, alterações e plantões num lugar só",
  "Receber lembretes dos próximos plantões",
  "Consultar sua escala pelo celular, a qualquer hora",
] as const;

const MARCA = "#1668b3";
const MARCA_FORTE = "#0d5493";
/**
 * O fundo da FAIXA é o fundo do próprio arquivo do logo.
 *
 * A arte veio em JPEG, sem transparência: ela carrega o próprio retângulo
 * azul-escuro. Numa faixa de outra cor, esse retângulo aparece recortado em
 * volta do logo, e o e-mail abre com um defeito de montagem no lugar mais
 * visível da mensagem. Amostrado do canto do arquivo, e não escolhido a olho.
 */
const FAIXA = "#071c30";
export const URL_LOGO = "https://www.avanest.com.br/avanest-email.png";
const MARCA_SUAVE = "#eaf2fb";
const TINTA = "#0f2438";
const TINTA_FRACA = "#5a7086";
const BORDA = "#dbe4ed";
const FUNDO = "#f2f5f9";

const FONTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Um botão que o Outlook também desenha: tabela de uma célula, não `<button>`. */
function botao(texto: string, url: string, cheio: boolean) {
  const fundo = cheio ? MARCA : "#ffffff";
  const cor = cheio ? "#ffffff" : MARCA_FORTE;
  const borda = cheio ? MARCA : BORDA;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"`
    + ` style="margin:0 0 10px">`
    + `<tr><td align="center" bgcolor="${fundo}"`
    + ` style="border-radius:10px;border:1px solid ${borda}">`
    + `<a href="${seguro(url)}" style="display:block;padding:15px 20px;font-family:${FONTE};`
    + `font-size:16px;font-weight:700;color:${cor};text-decoration:none;letter-spacing:.01em">`
    + `${seguro(texto)}</a></td></tr></table>`;
}

/** Uma linha da escala: dia à esquerda, horário à direita, hospital embaixo. */
function linhaHtml(p: PlantaoDoEmail, ultima: boolean) {
  const iso = String(p.data ?? "").slice(0, 10);
  const inteira = quandoPlantao(p);
  // "Sábado, 03/10 · 07:00–19:00" -> os dois lados da linha. O separador é o
  // mesmo que `quandoPlantao` já usa, e partir aqui evita uma segunda regra de
  // formatação de data vivendo neste arquivo.
  const [quando, horario] = inteira.split(" · ");
  const local = String(p.local ?? "").trim();
  const borda = ultima ? "" : `border-bottom:1px solid ${BORDA};`;
  return `<tr><td style="${borda}padding:13px 16px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>`
    + `<td style="font-family:${FONTE};font-size:15px;font-weight:700;color:${TINTA};`
    + `line-height:1.4">${seguro(quando ?? iso)}</td>`
    + `<td align="right" style="font-family:${FONTE};font-size:15px;font-weight:700;`
    + `color:${MARCA_FORTE};line-height:1.4;white-space:nowrap;padding-left:10px">`
    + `${seguro(horario ?? "")}</td>`
    + `</tr>`
    + (local
      ? `<tr><td colspan="2" style="font-family:${FONTE};font-size:13.5px;color:${TINTA_FRACA};`
        + `padding-top:3px">${seguro(local)}</td></tr>`
      : "")
    + `</table></td></tr>`;
}

export function escalaPublicadaEmail(dados: EscalaPublicadaEmail) {
  const url = dados.url || URL_ESCALA;
  const urlApp = dados.urlApp || URL_APP;
  const quem = tratamento(dados.nome);
  const ola = quem ? `Olá, ${quem}!` : "Olá!";
  const mes = mesPorExtenso(dados.mes);
  const quantos = dados.plantoes.length;
  // DUAS FORMAS DA MESMA CONTAGEM. No assunto não há sujeito, e o "seus" é o
  // que diz que a mensagem é sobre a escala DA PESSOA e não a do grupo. Na
  // abertura já existe o "Você tem", e repetir dá "Você tem 3 plantões seus".
  const plantoes = quantos === 1 ? "1 plantão seu" : `${quantos} plantões seus`;
  const contagem = quantos === 1 ? "1 plantão" : `${quantos} plantões`;
  const titulo = `Sua escala de ${mes} foi publicada`;
  const abertura = `A escala do ${dados.organizacao} já está disponível na AVANEST. `
    + `Você tem ${contagem} neste mês:`;

  // O nome de quem montou fecha a mensagem, e não abre: ele é a resposta à
  // última frase — "fale com o responsável" sem dizer quem é o responsável
  // manda a pessoa perguntar no grupo quem montou a escala.
  const porQuem = String(dados.autor ?? "").trim();
  const errado = "Caso identifique alguma informação incorreta na escala, entre em contato "
    + `com o responsável pela elaboração da escala${porQuem ? ` (${porQuem})` : ""}.`;
  const convite = "Tenha sua escala sempre à mão. Instale o AVANEST no seu celular.";

  const texto = [
    ola,
    titulo.toUpperCase(),
    abertura,
    dados.plantoes.map((p) => `• ${linhaDoPlantao(p)}`).join("\n"),
    "GERENCIE SEUS PLANTÕES PELA AVANEST",
    O_QUE_DA_PARA_FAZER.map((l) => `• ${l}`).join("\n"),
    `📱 ${convite}`,
    `Instalar o AVANEST: ${urlApp}`,
    `Acessar minha escala: ${url}`,
    errado,
    "AVANEST\nSua escala. Seus plantões. Tudo em um só lugar.",
  ].join("\n\n");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    // O IPHONE TRANSFORMAVA A ESCALA EM LINKS. O Mail do iOS reconhece data e
    // hora no texto e as converte em atalhos tocáveis — e "Quinta, 01/10" e
    // "19:00–07:00" viravam azul sublinhado, um em cada linha da escala. O
    // resultado é uma lista que parece cheia de links quebrados, e um toque
    // acidental abre o Calendário em vez de ler o plantão.
    + `<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">`
    // E o Mail em modo escuro INVERTIA a faixa da marca: o azul-escuro virava
    // azul-claro e o logo branco escurecia. Declarar o esquema é o que faz
    // ele parar de inverter por conta própria e respeitar o que foi escrito.
    + `<meta name="color-scheme" content="light">`
    + `<meta name="supported-color-schemes" content="light">`
    + `<title>${seguro(titulo)}</title>`
    // ESTE <style> É A ÚNICA EXCEÇÃO à regra de estilo na linha, e existe
    // porque o que ele desliga NÃO TEM equivalente inline: os atalhos que o
    // iOS injeta são criados depois, no cliente, e só se alcançam por seletor.
    // O Gmail descarta esta folha, e tudo bem — ele não faz essa conversão.
    // Nenhuma regra de layout mora aqui: layout continua na linha, senão o
    // Gmail desmonta a mensagem.
    + `<style>`
    + `a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;`
    + `font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;`
    + `line-height:inherit!important}`
    + `:root{color-scheme:light;supported-color-schemes:light}`
    + `</style></head>`
    + `<body style="margin:0;padding:0;background:${FUNDO};-webkit-text-size-adjust:100%">`
    // O resumo da caixa de entrada. Escondido na mensagem, ele é o que o Gmail
    // mostra ao lado do assunto — sem ele, aparece o começo do HTML.
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0">`
    + `${seguro(`${contagem} em ${mes}. Confira e gerencie pela AVANEST.`)}</div>`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"`
    + ` style="background:${FUNDO};padding:24px 12px">`
    + `<tr><td align="center">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"`
    + ` style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;`
    + `border:1px solid ${BORDA}">`

    // ── Faixa da marca ──────────────────────────────────────────────────────
    //
    // O LOGO É IMAGEM, E O ALT É A MARCA ESCRITA. Metade dos clientes de
    // e-mail bloqueia imagem até a pessoa mandar carregar — e uma faixa vazia
    // no alto faz a mensagem parecer de origem duvidosa, que é o contrário do
    // que ela precisa parecer. Com o alt, quem tem imagem desligada lê
    // "AVANEST" no mesmo lugar.
    + `<tr><td bgcolor="${FAIXA}" style="padding:18px 24px;background:${FAIXA}">`
    + `<img src="${URL_LOGO}" width="220" height="53" alt="AVANEST" `
    + `style="display:block;border:0;outline:none;text-decoration:none;`
    + `width:220px;height:auto;max-width:100%">`
    + `</td></tr>`

    // ── Cumprimento e título ────────────────────────────────────────────────
    + `<tr><td style="padding:28px 28px 0">`
    + `<p style="margin:0 0 6px;font-family:${FONTE};font-size:15px;color:${TINTA}">`
    + `${seguro(ola)}</p>`
    + `<h1 style="margin:0 0 12px;font-family:${FONTE};font-size:23px;line-height:1.3;`
    + `color:${TINTA};font-weight:800">${seguro(titulo)}</h1>`
    + `<p style="margin:0 0 18px;font-family:${FONTE};font-size:15px;line-height:1.6;`
    + `color:${TINTA}">${seguro(abertura)}</p>`
    + `</td></tr>`

    // ── A escala ────────────────────────────────────────────────────────────
    //
    // O CORPO DA MENSAGEM. É a este bloco que a pessoa volta daqui a três
    // semanas para conferir o sábado, e por isso ele é o único com moldura.
    + `<tr><td style="padding:0 28px">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"`
    + ` style="background:${MARCA_SUAVE};border-radius:12px;border:1px solid ${BORDA}">`
    + dados.plantoes.map((p, i) => linhaHtml(p, i === dados.plantoes.length - 1)).join("")
    + `</table></td></tr>`

    // ── O que mais dá para fazer ────────────────────────────────────────────
    + `<tr><td style="padding:26px 28px 0">`
    + `<h2 style="margin:0 0 10px;font-family:${FONTE};font-size:17px;line-height:1.35;`
    + `color:${TINTA};font-weight:800">Gerencie seus plantões pela AVANEST</h2>`
    + `<p style="margin:0 0 12px;font-family:${FONTE};font-size:14.5px;line-height:1.6;`
    + `color:${TINTA_FRACA}">A escala é só o começo. Pela plataforma você também pode:</p>`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">`
    + O_QUE_DA_PARA_FAZER.map((linha) =>
      `<tr>`
      + `<td valign="top" style="width:22px;font-family:${FONTE};font-size:15px;`
      + `line-height:1.55;color:${MARCA};font-weight:800;padding:0 0 8px">&#10003;</td>`
      + `<td style="font-family:${FONTE};font-size:14.5px;line-height:1.55;color:${TINTA};`
      + `padding:0 0 8px">${seguro(linha)}</td>`
      + `</tr>`).join("")
    + `</table></td></tr>`

    // ── Os dois botões ──────────────────────────────────────────────────────
    //
    // INSTALAR VEM PRIMEIRO, e é o botão cheio. Sem o AVANEST na tela de
    // início o iPhone não entrega notificação nenhuma — o lembrete de plantão,
    // o aviso de troca e a própria escala publicada ficam invisíveis. Quem já
    // instalou perde dois segundos lendo; quem não instalou ganha o produto
    // inteiro.
    + `<tr><td style="padding:22px 28px 0">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"`
    + ` style="background:${MARCA_SUAVE};border-radius:12px"><tr><td style="padding:18px 18px 8px">`
    + `<p style="margin:0 0 14px;font-family:${FONTE};font-size:15px;line-height:1.55;`
    + `color:${TINTA};font-weight:650">&#128241; ${seguro(convite)}</p>`
    + botao("Baixar o app AVANEST", urlApp, true)
    + botao("Acessar minha escala", url, false)
    + `</td></tr></table></td></tr>`

    // ── Rodapé ──────────────────────────────────────────────────────────────
    + `<tr><td style="padding:22px 28px 26px">`
    + `<p style="margin:0 0 16px;font-family:${FONTE};font-size:13px;line-height:1.6;`
    + `color:${TINTA_FRACA}">${seguro(errado)}</p>`
    + `<div style="border-top:1px solid ${BORDA};padding-top:16px">`
    + `<p style="margin:0;font-family:${FONTE};font-size:14px;font-weight:800;color:${MARCA_FORTE};`
    + `letter-spacing:.1em">AVANEST</p>`
    + `<p style="margin:3px 0 0;font-family:${FONTE};font-size:13px;color:${TINTA_FRACA}">`
    + `Sua escala. Seus plantões. Tudo em um só lugar.</p>`
    + `</div></td></tr>`

    + `</table></td></tr></table></body></html>`;

  return {
    // O NÚMERO NO ASSUNTO. É o que a pessoa quer saber, e metade das caixas de
    // entrada do celular mostram só o assunto: "Escala de outubro publicada"
    // obriga a abrir para descobrir se são dois ou catorze plantões.
    assunto: `Escala de ${mes} — ${plantoes}`,
    texto,
    html,
  };
}
