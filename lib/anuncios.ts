// A medição do Google Ads.
//
// TRÊS TRAVAS, e cada uma existe por um motivo diferente.
//
// 1. SÓ NAS PÁGINAS PÚBLICAS. Dentro do sistema os endereços carregam o
//    identificador de pacientes e avaliações (/avaliacoes/<id>), e a tag do
//    Google envia o endereço da página em toda chamada. Dado de saúde não sai
//    para empresa de publicidade nem como pedaço de URL — a política de
//    privacidade promete isso, e esta lista é o que cumpre a promessa.
//
// 2. SÓ DEPOIS DO "ACEITO". Cookie de publicidade tem como base legal o
//    consentimento (LGPD, art. 7º, I). Sem resposta, ou com "recuso", a tag nem
//    é baixada — nada de carregar e "desligar depois".
//
// 3. DESLIGADA SEM O ID. Sem NEXT_PUBLIC_GOOGLE_ADS_ID na Vercel, nada disso
//    existe para o visitante: nem aviso, nem script. Ligar a medição é
//    cadastrar a variável; desligar é apagá-la.

/** "AW-" e os dígitos da conta, como o Google Ads mostra em Ferramentas → Conversões. */
export const ID_GOOGLE_ADS = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";

/** Os rótulos de cada conversão (o pedaço depois da barra em "AW-123/abcDEF"). */
export const ROTULOS = {
  cadastro: process.env.NEXT_PUBLIC_GOOGLE_ADS_ROTULO_CADASTRO ?? "",
  whatsapp: process.env.NEXT_PUBLIC_GOOGLE_ADS_ROTULO_WHATSAPP ?? "",
} as const;

export type Conversao = keyof typeof ROTULOS;

export const CHAVE_DO_CONSENTIMENTO = "avanest:cookies-de-anuncio";
export type Consentimento = "aceito" | "recusado";

export function idValido(id: string): boolean {
  return /^AW-\d{6,14}$/.test(id);
}

// As páginas de fora do sistema: as que o anúncio pode trazer e as do caminho
// até o cadastro. Lista de PERMITIDAS, e não de proibidas: uma tela nova do
// sistema que ninguém lembrou de proibir ficaria exposta; aqui ela nasce fora.
const PUBLICAS = [
  "/recursos", "/planos", "/2meses", "/escores", "/avaliacao-pre-anestesica",
  "/avaliacao-pre-anestesica-digital", "/ficha-anestesica", "/escala-medica", "/app",
  "/criar-conta", "/termos", "/privacidade",
];

export function rotaAceitaAnuncios(caminho: string): boolean {
  if (caminho === "/") return true;
  return PUBLICAS.some((p) => caminho === p || caminho.startsWith(`${p}/`));
}

/** O `send_to` da conversão, ou nada quando falta o ID ou o rótulo. */
export function destinoDaConversao(id: string, rotulo: string): string | null {
  if (!idValido(id) || !/^[\w-]{4,40}$/.test(rotulo)) return null;
  return `${id}/${rotulo}`;
}

type JanelaComGtag = Window & { gtag?: (...args: unknown[]) => void };

export function lerConsentimento(): Consentimento | null {
  try {
    const v = localStorage.getItem(CHAVE_DO_CONSENTIMENTO);
    return v === "aceito" || v === "recusado" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Registra uma conversão, se houver o que registrar.
 *
 * Não faz nada — sem erro — quando a pessoa recusou, quando a tag não foi
 * carregada ou quando o rótulo não foi configurado. Quem chama não precisa
 * saber de nada disso: o cadastro funciona igual com ou sem medição.
 *
 * Devolve uma promessa que se resolve quando o Google confirma o envio, ou em
 * no máximo 800 ms. Quem vai trocar de página logo em seguida espera por ela:
 * sair antes cancelaria o envio, e o cadastro vindo do anúncio sumiria da conta.
 */
export function registrarConversao(qual: Conversao): Promise<void> {
  return new Promise((pronto) => {
    if (typeof window === "undefined" || lerConsentimento() !== "aceito") return pronto();
    const destino = destinoDaConversao(ID_GOOGLE_ADS, ROTULOS[qual]);
    const gtag = (window as JanelaComGtag).gtag;
    if (!destino || !gtag) return pronto();
    const limite = setTimeout(pronto, 800);
    gtag("event", "conversion", {
      send_to: destino,
      event_callback: () => { clearTimeout(limite); pronto(); },
    });
  });
}
