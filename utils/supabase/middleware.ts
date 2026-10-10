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
  const { data: { user } } = await supabase.auth.getUser();

  // VERIFICAÇÃO EM DUAS ETAPAS PENDENTE. Quem ativou o código e entrou só com
  // a senha tem a API inteira recusada pelo banco (lib/duas-etapas.ts). Sem
  // este desvio a pessoa veria o painel quebrado — ou, pior, seria mandada
  // para /comecar, porque a consulta do próprio perfil volta vazia.
  //
  // Os fatores vêm do getUser(), que acabou de ir ao servidor: um código
  // ativado em outro aparelho já conta aqui, sem esperar a sessão renovar.
  const temCodigo = user?.factors?.some((f) => f.status === "verified") ?? false;
  if (temCodigo && rotaPedeDuasEtapas(request.nextUrl.pathname)) {
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel?.currentLevel !== "aal2") {
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
