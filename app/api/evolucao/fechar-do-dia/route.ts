import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { segredoConfere } from "@/lib/portaria";

// A ficha esquecida aberta fecha sozinha depois da virada do dia (14/11/2026:
// "já mudou o dia… não era para ter arquivado quem fez e excluído quem não fez?").
//
// Roda de hora em hora, pelo agendador da Vercel (vercel.json). A regra está no
// banco (migração 202611140001): só a ficha aberta antes de hoje, sem nada
// escrito há 3 horas; vazia é excluída, com registro é encerrada
// automaticamente. A cirurgia que atravessa a meia-noite fecha só depois.
//
// GET porque quem chama é o agendador, com o mesmo CRON_SECRET das outras
// rotinas. Sem o segredo não roda.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error("[api/evolucao/fechar-do-dia] CRON_SECRET não configurado");
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
  const { data, error } = await admin.rpc("fechar_fichas_esquecidas");
  if (error) {
    console.error("[api/evolucao/fechar-do-dia]", error);
    return NextResponse.json({ ok: false, motivo: "falha" }, { status: 500 });
  }
  const r = (data ?? {}) as { encerradas?: number; excluidas?: number };
  return NextResponse.json({ ok: true, encerradas: Number(r.encerradas) || 0, excluidas: Number(r.excluidas) || 0 });
}
