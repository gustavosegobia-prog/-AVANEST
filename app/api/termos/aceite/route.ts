import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";
import { VERSAO_DOS_TERMOS, ipDaRequisicao, navegadorDaRequisicao } from "@/lib/termos";

// O aceite de um texto novo dos Termos, pelo painel (components/aceite-dos-termos).
//
// Grava a prova em aceites_de_termos com a chave de serviço: a tabela não
// aceita escrita da sessão, para que ninguém registre um aceite com data ou
// versão escolhidas no navegador. Quem é, quando e de onde vêm daqui — da
// sessão, do relógio do banco e dos cabeçalhos da requisição.

const erro = (mensagem: string, status: number) => NextResponse.json({ error: mensagem }, { status });

export async function POST(request: NextRequest) {
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return erro("Entre de novo para aceitar os Termos.", 401);
  const excedeu = enforceRateLimit(`termos-aceite:${user.id}`, { limit: 10, windowMs: 600_000 });
  if (excedeu) return excedeu;

  // A versão que a pessoa leu na tela. Se o texto mudou com a página aberta,
  // o aceite não vale para o texto novo, que ela não viu.
  const corpo = await request.json().catch(() => null) as { versao?: unknown } | null;
  if (corpo?.versao !== VERSAO_DOS_TERMOS) {
    return erro("Os Termos mudaram enquanto a página estava aberta. Recarregue para ler a versão atual.", 409);
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return erro("Não foi possível registrar o aceite agora.", 503);
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: ja, error: erroLeitura } = await admin.from("aceites_de_termos")
    .select("id").eq("user_id", user.id).eq("versao", VERSAO_DOS_TERMOS).limit(1);
  if (erroLeitura) return erro("Não foi possível registrar o aceite agora.", 500);
  if (ja?.length) return NextResponse.json({ ok: true });

  const { data: perfil } = await supabase.from("perfis").select("institution_id").eq("id", user.id).maybeSingle();
  const { error } = await admin.from("aceites_de_termos").insert({
    user_id: user.id, email: user.email ?? null,
    institution_id: (perfil as { institution_id: string | null } | null)?.institution_id ?? null,
    versao: VERSAO_DOS_TERMOS, origem: "painel",
    ip: ipDaRequisicao(request.headers), navegador: navegadorDaRequisicao(request.headers),
  });
  if (error) {
    console.error("[termos/aceite]", error);
    return erro("Não foi possível registrar o aceite agora.", 500);
  }
  return NextResponse.json({ ok: true });
}
