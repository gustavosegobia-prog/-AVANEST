import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { MAX_FOTOS } from "@/lib/questionario-pre";

// A foto da receita (ou da caixa do remédio) que o paciente manda junto do
// questionário (migração 202611100001).
//
// O paciente não tem login, e o Storage só aceita quem tem. Por isso o arquivo
// passa por aqui: o token do link diz qual questionário é, e a chave do
// servidor grava no bucket privado, na pasta da organização. Quem lê depois é
// só o médico da mesma organização (política do bucket).
//
// A página do paciente reduz a foto antes de mandar (até 1600 px, JPEG), e é
// sempre JPEG que chega aqui. Mais de 5 MB, ou outro formato, é recusado.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ token: string }> };
const LIMITE = 5 * 1024 * 1024;

function servidor() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) return null;
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, { auth: { persistSession: false } });
}

async function questionarioAberto(admin: NonNullable<ReturnType<typeof servidor>>, token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await admin.from("questionarios_pre")
    .select("id,institution_id,status,expires_at,fotos").eq("token", token).maybeSingle();
  if (!data || data.status !== "enviado" || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data as { id: string; institution_id: string; fotos: string[] };
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { token } = await params;
  const admin = servidor();
  if (!admin) return NextResponse.json({ error: "Envio de foto indisponível agora." }, { status: 503 });
  const q = await questionarioAberto(admin, token);
  if (!q) return NextResponse.json({ error: "Este link venceu ou já foi respondido." }, { status: 410 });
  if (q.fotos.length >= MAX_FOTOS) {
    return NextResponse.json({ error: `Dá para mandar até ${MAX_FOTOS} fotos.` }, { status: 409 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  const ehJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!ehJpeg) return NextResponse.json({ error: "Não consegui ler esta foto. Tente outra." }, { status: 415 });
  if (bytes.length > LIMITE) return NextResponse.json({ error: "Foto grande demais." }, { status: 413 });

  const caminho = `${q.institution_id}/${q.id}/${randomUUID()}.jpg`;
  const envio = await admin.storage.from("questionarios").upload(caminho, bytes, { contentType: "image/jpeg", upsert: false });
  if (envio.error) {
    console.error("[api/questionario/foto] upload", envio.error.message);
    return NextResponse.json({ error: "Não foi possível guardar a foto. Tente de novo." }, { status: 502 });
  }
  const { data: n, error } = await admin.rpc("anexar_foto_do_questionario", { p_id: q.id, p_caminho: caminho });
  if (error) {
    // Sem registro, o arquivo não serve para ninguém: sai junto.
    await admin.storage.from("questionarios").remove([caminho]);
    return NextResponse.json({ error: `Dá para mandar até ${MAX_FOTOS} fotos.` }, { status: 409 });
  }
  return NextResponse.json({ ok: true, caminho, fotos: n });
}

export async function DELETE(request: NextRequest, { params }: Contexto) {
  const { token } = await params;
  const admin = servidor();
  if (!admin) return NextResponse.json({ error: "Indisponível agora." }, { status: 503 });
  const q = await questionarioAberto(admin, token);
  if (!q) return NextResponse.json({ error: "Este link venceu ou já foi respondido." }, { status: 410 });
  const caminho = request.nextUrl.searchParams.get("caminho") ?? "";
  if (!q.fotos.includes(caminho)) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  const { data: n, error } = await admin.rpc("tirar_foto_do_questionario", { p_id: q.id, p_caminho: caminho });
  if (error) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  await admin.storage.from("questionarios").remove([caminho]);
  return NextResponse.json({ ok: true, fotos: n });
}
