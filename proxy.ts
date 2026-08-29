import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

// O `sw.js` e o manifesto ficam de fora, e não é detalhe de desempenho.
//
// O service worker é buscado pelo navegador sem sessão nenhuma, e é conferido
// de novo a cada 24 horas. Passá-lo por aqui faz cada uma dessas idas gastar
// uma chamada ao Supabase para renovar um cookie que ninguém vai usar — e, no
// dia em que este middleware ganhar um redirecionamento para /login, o
// registro do worker quebra: a especificação PROÍBE que o script do service
// worker venha de um redirecionamento, e o erro que o navegador dá não diz
// isso. Melhor a exceção existir antes do problema.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
