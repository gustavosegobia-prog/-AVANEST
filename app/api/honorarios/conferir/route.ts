import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";

// O Financeiro dá por conferido o honorário calculado: é o valor que vai para
// a cobrança. Só o que o médico já enviou, só na clínica de quem confere, e
// só o que está calculado — pendente não se confere. Gravado com a chave de
// serviço porque é o único caminho que o banco aceita para o honorário
// (gatilho protege_honorario_da_producao), com quem conferiu e quando. Mudar
// depois a urgência, as marcas, o convênio ou os códigos desfaz a conferência.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const erro = (mensagem: string, status: number) => NextResponse.json({ error: mensagem }, { status });

export async function POST(request: NextRequest) {
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erro("Entre de novo para conferir.", 401);
  const excedeu = enforceRateLimit(`honorario-conferir:${user.id}`, { limit: 120, windowMs: 3_600_000 });
  if (excedeu) return excedeu;

  const { data: perfil } = await supabase
    .from("perfis").select("institution_id, status").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo" || !perfil.institution_id) return erro("Conta sem organização ativa.", 403);
  const { data: pode } = await supabase.rpc("pode_tabelas_honorarios", { p_institution_id: perfil.institution_id });
  if (pode !== true) return erro("Só o Financeiro da clínica confere o honorário.", 403);

  const corpo = await request.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(corpo?.ids)
    ? [...new Set(corpo.ids.filter((i): i is string => typeof i === "string" && UUID.test(i)))].slice(0, 500)
    : [];
  if (!ids.length) return erro("Nenhuma anestesia informada.", 400);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return erro("A conferência ainda não foi habilitada no servidor.", 503);
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } });

  const { data, error } = await admin.from("producao_do_dia")
    .update({ honorario_situacao: "conferido", conferido_por: user.id, conferido_em: new Date().toISOString() })
    .in("id", ids)
    .eq("institution_id", perfil.institution_id)
    .not("enviado_em", "is", null)
    .eq("honorario_situacao", "calculado")
    .select("id");
  if (error) return erro("Não foi possível conferir agora. Tente de novo.", 500);
  return NextResponse.json({ conferidas: (data ?? []).map((d) => (d as { id: string }).id) });
}
