import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { segredoConfere } from "@/lib/portaria";

// O plantão que terminou vira "realizado" sozinho (22/11/2026: "esse negócio de
// confirmar todo dia é ruim… na hora que lançar os plantões da equipe, ele tem
// que olhar e já confirmar"). A confirmação é dada quando a escala sai; passado
// o fim do turno sem ser cancelado, o plantão conta como feito e entra no
// financeiro. O que não aconteceu, quem monta a escala marca como cancelado.
//
// Roda de hora em hora, pelo agendador da Vercel (vercel.json). A regra está no
// banco (realizar_plantoes_passados, migração 202611220001): só o escalado cujo
// fim, no relógio de Brasília, já passou — o noturno termina no dia seguinte.
//
// GET porque quem chama é o agendador, com o mesmo CRON_SECRET das outras
// rotinas. Sem o segredo não roda.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error("[api/escala/realizar-passados] CRON_SECRET não configurado");
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
  const { data, error } = await admin.rpc("realizar_plantoes_passados");
  // Antes da migração 202611220001 entrar no banco, a função não existe: nada a fazer.
  if (error?.code === "PGRST202") return NextResponse.json({ ok: true, motivo: "sem-funcao" });
  if (error) {
    console.error("[api/escala/realizar-passados]", error);
    return NextResponse.json({ ok: false, motivo: "falha" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, realizados: Number(data ?? 0) });
}
