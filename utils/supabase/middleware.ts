import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rotaPedeDuasEtapas } from "@/lib/duas-etapas";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  // A SESSÃO É CONFERIDA AQUI MESMO, SEM IR AO SUPABASE. Este proxy roda em
  // toda troca de página e em toda pré-carga de link; com getUser() cada uma
  // esperava uma ida e volta ao servidor de login antes de a página começar.
  // As chaves do projeto são assimétricas (ES256): getClaims() confere a
  // assinatura do token com a chave pública, guardada em memória, e só vai à
  // rede para renovar um token vencido — que é a outra função deste proxy.
  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims?.sub);

  // VERIFICAÇÃO EM DUAS ETAPAS PENDENTE. Quem ativou o código e entrou só com
  // a senha tem a API inteira recusada pelo banco (lib/duas-etapas.ts). Sem
  // este desvio a pessoa veria o painel quebrado — ou, pior, seria mandada
  // para /comecar, porque a consulta do próprio perfil volta vazia.
  //
  // O nível sai da própria sessão: o atual vem do token, e os fatores
  // ativados, do usuário guardado com ela. Um código ativado agora em OUTRO
  // aparelho só aparece aqui quando esta sessão renovar (até uma hora) — até
  // lá quem tranca é o banco, como antes.
  if (logado && rotaPedeDuasEtapas(request.nextUrl.pathname)) {
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel?.nextLevel === "aal2" && nivel.currentLevel !== "aal2") {
      const desvio = request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Confirme o código da verificação em duas etapas para continuar." }, { status: 401 })
        : NextResponse.redirect(new URL(
            `/duas-etapas?depois=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`,
            request.url,
          ));
      // A sessão pode ter sido renovada agora mesmo: os cookies novos vão
      // junto, ou a pessoa chegaria na tela do código já deslogada.
      response.cookies.getAll().forEach((c) => desvio.cookies.set(c));
      return desvio;
    }
  }
  return response;
}
