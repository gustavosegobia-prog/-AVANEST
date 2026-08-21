import { NextRequest, NextResponse } from "next/server";

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

export function validateMutationRequest(
  request: NextRequest,
  options: { requireJson?: boolean; maxBytes?: number } = {},
) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (
    !origin ||
    (origin !== expectedOrigin(request) && origin !== request.nextUrl.origin) ||
    fetchSite === "cross-site"
  ) {
    return NextResponse.json(
      { error: "A origem desta solicitação não é permitida." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (options.requireJson) {
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("application/json")) {
      return NextResponse.json(
        { error: "Formato de solicitação inválido." },
        { status: 415, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  const maxBytes = options.maxBytes ?? 32_768;
  if (!Number.isFinite(contentLength) || contentLength < 0 || contentLength > maxBytes) {
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
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (current.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return null;
}
