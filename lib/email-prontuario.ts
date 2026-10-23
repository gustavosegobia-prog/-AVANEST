// O PDF DA AVALIAÇÃO, ENVIADO AO PRONTUÁRIO DO HOSPITAL.
//
// Por que e-mail, e não integração com o Tasy (ou outro prontuário): integrar
// exige a TI de cada hospital, homologação e meses. E-mail funciona no dia em
// que o hospital informa um endereço, e quem anexa no prontuário é o próprio
// hospital — que é quem conhece o sistema dele. Integração direta fica para
// quando um cliente pedir.
//
// QUEM DECIDE O DESTINO É O CADASTRO DO LOCAL, NUNCA A TELA. O endereço mora
// em locais_atendimento.email_prontuario, preenchido por quem administra o
// local, e o servidor lê de lá. Se o navegador pudesse dizer para onde mandar,
// qualquer conta logada mandaria ficha de paciente para qualquer endereço.
//
// SEM ENDEREÇO, NADA SAI. O campo vazio é o padrão, e é ele que impede que um
// local cadastrado antes desta funcionalidade comece a mandar dado clínico por
// e-mail sem ninguém ter pedido. O `email` de contato do local NÃO serve de
// destino: ele foi preenchido para outra coisa (recepção, faturamento), e dado
// clínico só vai para quem foi indicado para recebê-lo.
//
// O CORPO DIZ O MÍNIMO. O documento é o anexo; o texto só identifica o
// paciente para quem vai arquivar, e nada além disso. Diagnóstico, alergia ou
// medicamento no corpo de um e-mail ficariam espalhados pela caixa de entrada,
// pelas pré-visualizações e pelos encaminhamentos.

import { enderecoValido } from "./email.ts";

/** A ação gravada na auditoria a cada envio que deu certo. */
export const ACAO_ENVIADA = "avaliacao_enviada_prontuario";
/** E a cada tentativa que falhou — para o rastro dizer também o que não chegou. */
export const ACAO_FALHOU = "avaliacao_envio_prontuario_falhou";

/**
 * O teto do PDF.
 *
 * A função da Vercel aceita corpo de até 4,5 MB, e o PDF chega em base64, que
 * engorda um terço. 3 MB de arquivo cabem com folga; a ficha costuma ter
 * algumas centenas de KB.
 */
export const PDF_MAXIMO = 3 * 1024 * 1024;

/**
 * Até quanto tempo depois da conclusão a tela manda sozinha.
 *
 * Sem limite, abrir para reimprimir uma avaliação de março num local que
 * acabou de ganhar e-mail mandaria a ficha de março sem ninguém pedir. As
 * antigas continuam podendo ser enviadas — pelo botão.
 */
export const JANELA_AUTOMATICA_MS = 24 * 60 * 60 * 1000;

/** O endereço do cadastro, limpo; null quando não há destino válido. */
export function destinoDoProntuario(valor: unknown): string | null {
  const endereco = String(valor ?? "").trim().toLowerCase();
  return endereco && enderecoValido(endereco) ? endereco : null;
}

/**
 * "prontuario@hospital.com.br" -> "pr•••@hospital.com.br".
 *
 * A tela mostra para onde foi sem expor o endereço inteiro a quem só está
 * imprimindo — o domínio basta para conferir que é o hospital certo.
 */
export function mascararEmail(endereco: string): string {
  const [usuario, dominio] = String(endereco ?? "").split("@");
  if (!dominio) return "";
  return `${usuario.slice(0, 2)}•••@${dominio}`;
}

/** Deve a tela mandar sozinha agora? */
export function envioAutomatico(dados: {
  concluidaEm: string | null | undefined;
  enviadaEm: string | null | undefined;
  configurado: boolean;
  agora?: number;
}): boolean {
  if (!dados.configurado || dados.enviadaEm || !dados.concluidaEm) return false;
  const concluida = new Date(dados.concluidaEm).getTime();
  if (Number.isNaN(concluida)) return false;
  return (dados.agora ?? Date.now()) - concluida <= JANELA_AUTOMATICA_MS;
}

/**
 * O arquivo é mesmo um PDF, e cabe?
 *
 * Confere pelos primeiros bytes, e não pelo nome: o nome quem escolhe é o
 * navegador, e o que vai para a caixa do hospital tem de ser o que diz ser.
 */
export function pdfAceito(bytes: Uint8Array): "ok" | "vazio" | "grande" | "formato" {
  if (!bytes.length) return "vazio";
  if (bytes.length > PDF_MAXIMO) return "grande";
  const cabeca = String.fromCharCode(...bytes.subarray(0, 5));
  return cabeca === "%PDF-" ? "ok" : "formato";
}

/** "2026-10-23T14:30:00Z" -> "23/10/2026", no fuso do serviço. */
function dataBR(iso: string | null | undefined) {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** "Maria da Silva" -> "avaliacao-pre-anestesica-maria-da-silva-23-10-2026.pdf". */
export function nomeDoArquivo(paciente: string, concluidaEm?: string | null) {
  const base = String(paciente ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ").slice(0, 4).join("-").toLowerCase();
  const data = dataBR(concluidaEm).replace(/\//g, "-");
  return ["avaliacao-pre-anestesica", base, data].filter(Boolean).join("-") + ".pdf";
}

const seguro = (texto: string) => String(texto ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export type DadosDoEnvio = {
  paciente: string;
  /** Quem avaliou, como saiu na ficha. */
  anestesiologista?: string | null;
  crm?: string | null;
  /** O hospital como aparece no cadastro do local. */
  local?: string | null;
  concluidaEm?: string | null;
  /** "AVA-1a2b3c4d · v2" — o mesmo código impresso no cabeçalho da ficha. */
  referencia?: string | null;
};

/** Assunto, HTML e texto puro da mensagem. */
export function mensagemDoProntuario(dados: DadosDoEnvio) {
  const paciente = String(dados.paciente ?? "").trim() || "Paciente";
  const data = dataBR(dados.concluidaEm);
  const medico = [String(dados.anestesiologista ?? "").trim(), String(dados.crm ?? "").trim()]
    .filter(Boolean).join(" · ");

  const assunto = `Avaliação pré-anestésica — ${paciente}${data ? ` — ${data}` : ""}`;

  const linhas: Array<[string, string]> = ([
    ["Paciente", paciente],
    ["Data da avaliação", data],
    ["Anestesiologista", medico],
    ["Local", String(dados.local ?? "").trim()],
    ["Referência", String(dados.referencia ?? "").trim()],
  ] as Array<[string, string]>).filter(([, valor]) => valor);

  const texto = [
    "Segue em anexo a ficha de avaliação pré-anestésica, em PDF, para arquivo no prontuário do paciente.",
    "",
    ...linhas.map(([rotulo, valor]) => `${rotulo}: ${valor}`),
    "",
    "Mensagem enviada automaticamente pela AVANEST ao concluir a avaliação.",
    "Contém dados de saúde protegidos pela LGPD. Se você recebeu por engano, avise o remetente e apague esta mensagem.",
  ].join("\n");

  const FONTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f2f5f9;font-family:${FONTE};color:#0f2438">`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4ed;border-radius:12px">`
    + `<tr><td style="padding:24px 26px">`
    + `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Segue em anexo a ficha de avaliação pré-anestésica, em PDF, para arquivo no prontuário do paciente.</p>`
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;line-height:1.5">`
    + linhas.map(([rotulo, valor]) => `<tr><td style="padding:3px 12px 3px 0;color:#5a7086;white-space:nowrap;vertical-align:top">${seguro(rotulo)}</td>`
      + `<td style="padding:3px 0;font-weight:600">${seguro(valor)}</td></tr>`).join("")
    + `</table>`
    + `<p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#5a7086">Mensagem enviada automaticamente pela AVANEST ao concluir a avaliação. `
    + `Contém dados de saúde protegidos pela LGPD. Se você recebeu por engano, avise o remetente e apague esta mensagem.</p>`
    + `</td></tr></table></body></html>`;

  return { assunto, html, texto };
}
