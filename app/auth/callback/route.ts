import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { destinoInterno } from "@/lib/destino-seguro";
import { destinoComOCodigo, fluxoDoLink, PARAM_FLUXO } from "@/lib/troca-do-codigo";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const erro = request.nextUrl.searchParams.get("error");

  // O destino é conferido por origem, não por como o texto começa. A regra
  // antiga era `next.startsWith("/")`, e "//evil.com" começa com "/" — o
  // navegador resolvia para https://evil.com e reanexava ali o fragmento
  // #access_token=... que o Supabase devolve. Ou seja: entregava a sessão da
  // pessoa a quem tivesse reescrito o link do e-mail. Detalhe em
  // lib/destino-seguro.ts, com os casos em lib/destino-seguro.test.ts.
  const next = destinoInterno(request.nextUrl.searchParams.get("next"), request.nextUrl);

  // O Supabase avisa por aqui quando o próprio link venceu ou já foi usado.
  if (erro) return NextResponse.redirect(new URL("/recuperar-senha?erro=link-invalido", request.url));

  if (code) {
    const supabase = await createClient();

    // O `sb_flow_id` diz QUAL pedido este código é. Sem ele a biblioteca
    // procura o comprovante numa gaveta de compatibilidade que guarda só o
    // último pedido — e quem pediu três e-mails e clicou no primeiro não
    // entrava nunca. Detalhe em lib/troca-do-codigo.ts.
    const fluxo = fluxoDoLink(request.nextUrl.searchParams.get(PARAM_FLUXO));
    const { error } = await supabase.auth.exchangeCodeForSession(
      code, fluxo ? { flowId: fluxo } : undefined,
    );
    if (!error) return NextResponse.redirect(new URL(next, request.url));

    // O servidor falhou, e isso NÃO QUER DIZER que o link está ruim: o caso
    // que motivou esta correção é o cookie do comprovante não chegar até aqui,
    // com o link íntegro. Quem tem esse cookie garantidamente é o navegador,
    // que lê os próprios sem depender do salto entre sites — então o código
    // segue para a página de destino e ela termina o serviço.
    //
    // `next` já passou por `destinoInterno` acima; é o que impede o código de
    // autorização de viajar para fora do site.
    return NextResponse.redirect(new URL(destinoComOCodigo(next, code, fluxo), request.url));
  }

  // Sem "code" o link não está necessariamente quebrado: o Supabase também
  // devolve a sessão no fragmento da URL (#access_token=...), que o servidor
  // nunca enxerga — fragmento não é enviado ao servidor. O navegador reanexa
  // o fragmento ao destino do redirecionamento, então quem consegue ler é a
  // página de destino. Se não houver sessão nenhuma, é ela que avisa.
  //
  // É exatamente por isso que o destino acima precisa ser interno: este
  // caminho entrega a sessão a quem quer que seja o destino.
  return NextResponse.redirect(new URL(next, request.url));
}
