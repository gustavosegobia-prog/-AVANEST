import { NextRequest, NextResponse } from "next/server";
import {
  contarTentativa, formatoAceito, origemAceita, tamanhoAceito, TAMANHO_MAXIMO,
} from "./portaria.ts";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalWithRateLimit = globalThis as typeof globalThis & {
  __avanestRateLimit?: Map<string, RateLimitEntry>;
};

const rateLimitStore =
  globalWithRateLimit.__avanestRateLimit ??
  (globalWithRateLimit.__avanestRateLimit = new Map<string, RateLimitEntry>());

function expectedOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

/**
 * Este arquivo lê cabeçalhos e monta respostas de erro. QUEM DECIDE é
 * `lib/portaria.ts`.
 *
 * A divisão não é enfeite de arquitetura: o import de `next/server` aqui em
 * cima impede este arquivo de carregar fora do Next, e foi por isso que o
 * código que guarda todas as rotas de API passou a existir sem um único teste.
 * As regras mudaram de casa para poderem ser conferidas; a encanação ficou.
 */
export function validateMutationRequest(
  request: NextRequest,
  options: { requireJson?: boolean; maxBytes?: number } = {},
) {
  if (!origemAceita({
    origin: request.headers.get("origin"),
    esperada: expectedOrigin(request),
    doNextUrl: request.nextUrl.origin,
    fetchSite: request.headers.get("sec-fetch-site"),
  })) {
    return NextResponse.json(
      { error: "A origem desta solicitação não é permitida." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!formatoAceito(request.headers.get("content-type"), Boolean(options.requireJson))) {
    return NextResponse.json(
      { error: "Formato de solicitação inválido." },
      { status: 415, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!tamanhoAceito(request.headers.get("content-length"), options.maxBytes ?? TAMANHO_MAXIMO)) {
    return NextResponse.json(
      { error: "A solicitação é maior que o limite permitido." },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  return null;
}

// Quantas chaves vencidas varrer a cada chamada.
//
// O mapa é a memória do processo e nunca era limpo: cada usuário que passasse
// por uma rota limitada deixava uma entrada para sempre. Num processo que fica
// horas de pé, isso é um vazamento — devagar, mas que só cresce.
//
// A varredura é parcial de propósito. Percorrer o mapa inteiro a cada
// requisição transformaria o limitador no gargalo justamente quando há muita
// gente usando. Vinte chaves por chamada limpam mais rápido do que entram.
const VARREDURA = 20;

function limparVencidas(agora: number) {
  let vistas = 0;
  for (const [chave, entrada] of rateLimitStore) {
    if (entrada.resetAt <= agora) rateLimitStore.delete(chave);
    if (++vistas >= VARREDURA) break;
  }
}

export function enforceRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
) {
  const now = Date.now();
  limparVencidas(now);
  const veredito = contarTentativa(rateLimitStore.get(key), now, options.limit, options.windowMs);

  if (!veredito.permitido) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(veredito.esperarSegundos),
        },
      },
    );
  }

  rateLimitStore.set(key, veredito.entrada);
  return null;
}
