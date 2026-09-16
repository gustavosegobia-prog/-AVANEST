import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import {
  assuntoDoRelatorio, htmlDoRelatorio, montarRelatorio, textoDoRelatorio,
  type UsuarioDoUso,
} from "@/lib/relatorio-diario";

// O relatório diário, e a pausa das contas paradas da campanha.
//
// DUAS COISAS NA MESMA ROTINA de propósito: quem pausa é quem conta. Separadas,
// o dono do produto descobriria pelo relatório de amanhã uma conta pausada
// ontem — ou pior, descobriria pelo cliente reclamando.
//
// A PAUSA SÓ ALCANÇA CONTA DE CAMPANHA, e a trava está na função do banco, não
// aqui: `pausar_inativos_da_campanha` exige origem preenchida, plano em teste e
// dono da própria organização. Escrita só nesta rota, bastaria um parâmetro
// errado para pausar a equipe da casa.
//
// GET porque quem chama é o agendador da Vercel, com o mesmo CRON_SECRET da
// rota de lembretes. Sem o segredo ela não roda: é uma rota que lê o uso de
// todo mundo e desliga contas.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dias sem entrar antes de a conta da campanha ser pausada.
 *
 * Começou em 3 e virou 14. Três dias é o intervalo NORMAL de quem faz plantão:
 * a ficha sai em dia de ambulatório, a escala na virada do mês, o financeiro no
 * fechamento — e a regra de três dias, rodada contra a base real, pegava 14 dos
 * 19 usuários ativos no primeiro dia. Catorze dias é um prazo que o próprio
 * anestesiologista reconhece como abandono, e não como uma semana cheia.
 *
 * O relatório continua listando quem parou a partir de 3 dias: ver
 * DIAS_PARA_APARECER_PARADO. Aparecer na lista é aviso; ser pausado é ação, e
 * as duas coisas não precisam do mesmo prazo.
 */
const DIAS_PARA_PAUSAR = 14;

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error("[api/admin/relatorio-diario] CRON_SECRET não configurado");
    return NextResponse.json({ error: "Rota não configurada." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ ok: true, motivo: "sem-chave" });

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });

  // A PAUSA VEM ANTES DA LEITURA, para o relatório do dia já sair com ela
  // dentro. Ao contrário, quem fosse pausado hoje apareceria como ativo no
  // e-mail de hoje e pausado no de amanhã, sem nada explicando a diferença.
  //
  // `?pausar=nao` deixa rodar só o relatório — é como se confere a rotina sem
  // desligar a conta de ninguém.
  const pausarAgora = request.nextUrl.searchParams.get("pausar") !== "nao";
  let pausados: { nome: string; email: string; dias: number }[] = [];
  if (pausarAgora) {
    const { data, error } = await admin
      .rpc("pausar_inativos_da_campanha", { p_dias: DIAS_PARA_PAUSAR });
    if (error) console.error("[api/admin/relatorio-diario] pausar", error);
    else pausados = (data ?? []) as typeof pausados;
  }

  const { data: uso, error: erroUso } = await admin.rpc("relatorio_de_uso");
  if (erroUso) {
    console.error("[api/admin/relatorio-diario] uso", erroUso);
    return NextResponse.json({ ok: true, motivo: "falha-consulta" });
  }
  const todos = (uso ?? []) as UsuarioDoUso[];
  // O recorte pedido: só quem chegou por um link de campanha. A equipe da casa
  // o dono acompanha de perto; quem entrou pelo Instagram é quem ele não
  // conhece. O total geral vai junto só para dar escala ao número.
  const daCampanha = todos.filter((u) => String(u.origem ?? "").trim() !== "");

  const relatorio = montarRelatorio(daCampanha, new Date(),
    { totalGeral: todos.length, pausados });

  // Para quem vai: os super-admins, lidos do banco. Um endereço escrito no
  // código vira e-mail perdido no dia em que ele mudar, e obriga a um deploy
  // para acrescentar um sócio.
  const { data: donos } = await admin
    .from("perfis").select("email").eq("super_admin", true).eq("status", "ativo");
  const destinos = [...new Set((donos ?? [])
    .map((d) => String(d.email ?? "").trim()).filter(Boolean))];

  if (!emailConfigurado() || !destinos.length) {
    // Sem e-mail configurado a rotina NÃO é um fracasso: a pausa já aconteceu e
    // o relatório volta no corpo da resposta, que é onde quem chamou consegue
    // lê-lo. Falhar aqui esconderia o que já foi feito.
    return NextResponse.json({
      ok: true, motivo: emailConfigurado() ? "sem-destinatario" : "email-nao-configurado",
      pausados: pausados.length, relatorio: textoDoRelatorio(relatorio),
    });
  }

  // UM E-MAIL POR PESSOA, e não um com todos em cópia: `enviarEmail` recebe um
  // endereço só, e pôr dois sócios no mesmo "para" mostraria o endereço de um
  // ao outro sem que nenhum tivesse pedido isso.
  const idas = await Promise.all(destinos.map((para) => enviarEmail({
    para,
    assunto: assuntoDoRelatorio(relatorio),
    texto: textoDoRelatorio(relatorio),
    html: htmlDoRelatorio(relatorio),
  })));
  const entregues = idas.filter((r) => r.ok).length;
  for (const r of idas) {
    if (!r.ok) console.error("[api/admin/relatorio-diario] e-mail", r);
  }

  return NextResponse.json({
    ok: true,
    enviado: entregues,
    para: destinos.length,
    pausados: pausados.length,
    contasDaCampanha: relatorio.total,
    novas: relatorio.novos.length,
    ativas: relatorio.ativos.length,
  });
}
