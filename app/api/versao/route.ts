import { NextResponse } from "next/server";
import { VERSAO_DO_SITE } from "@/lib/versao";

// A versão publicada agora (lib/versao.ts). Quem pergunta é a TV do centro
// cirúrgico, que fica dias aberta: se a resposta for outra que a dela, ela
// recarrega. Não diz nada além do commit, que já é público no código do site.
export function GET() {
  return NextResponse.json({ versao: VERSAO_DO_SITE }, { headers: { "Cache-Control": "no-store" } });
}
