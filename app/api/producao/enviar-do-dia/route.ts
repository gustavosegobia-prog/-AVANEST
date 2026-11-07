import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { hoje, somarDias } from "@/lib/data-local";
import { segredoConfere } from "@/lib/portaria";

// A produção que vai sozinha ao financeiro (07/11/2026: "enviar todo final do
// dia, ele vai acumulando para o financeiro").
//
// Roda depois da meia-noite, pelo agendador da Vercel (vercel.json), e manda o
// que é de ONTEM para trás, de quem ligou "Enviar sozinho" na própria tela de
// produção (migração 202611070003). O dia que está começando fica aberto; o
// lançado tarde vai na noite seguinte.
//
// GET porque quem chama é o agendador, com o mesmo CRON_SECRET das outras
// rotinas. Sem o segredo não roda.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error("[api/producao/enviar-do-dia] CRON_SECRET não configurado");
    return NextResponse.json({ error: "Rota não configurada." }, { status: 503 });
  }
  if (!segredoConfere(request.headers.get("authorization"), segredo)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ ok: true, motivo: "sem-chave" });

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });
  // Ontem, no fuso do serviço: a rotina passa da meia-noite de Brasília.
  const ate = somarDias(hoje(), -1);
  const { data, error } = await admin.rpc("enviar_producao_sozinha", { p_ate: ate });
  if (error) {
    console.error("[api/producao/enviar-do-dia]", error);
    return NextResponse.json({ ok: false, motivo: "falha" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ate, enviados: Number(data) || 0 });
}
