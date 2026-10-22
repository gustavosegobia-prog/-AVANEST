import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { hoje } from "@/lib/data-local";
import { CAMPOS_DO_CASO, abreOCentro, mostraACasa, type Caso, type Sala } from "@/lib/centro-cirurgico";
import { diasDoMes, mesValido, planilhaDoRelatorio, relatorioDoMes } from "@/lib/centro-relatorio";
import { Icone } from "@/components/icone";
import { RelatorioDoMes } from "@/components/centro/relatorio";
import { AssinaturaAvanest } from "@/components/centro/assinatura";
import estilos from "@/components/centro/relatorio.module.css";

export const metadata: Metadata = {
  title: "Relatório do centro cirúrgico | AVANEST",
  robots: { index: false, follow: false },
};

// O relatório do mês: quantas cirurgias, e o tempo de cada uma em sala e na
// RPA. Só para quem monta o mapa — abreOCentro(), sobre pode_montar_centro()
// das políticas do banco (202610210001). Lê o que o mapa já gravou; não escreve.
export default async function RelatorioDoCentroPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis").select("id, institution_id, status, super_admin").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo" || !perfil.institution_id) redirect("/dashboard");
  const inst = perfil.institution_id as string;
  const { data: podeMontar } = await supabase.rpc("pode_montar_centro", { p_institution_id: inst });
  if (!abreOCentro(podeMontar)) redirect("/dashboard");
  const casa = mostraACasa(perfil.super_admin);

  const { mes: pedido } = await searchParams;
  const dia = hoje();
  const mesDeHoje = dia.slice(0, 7);
  const mes = mesValido(pedido) ? pedido : mesDeHoje;
  const dias = diasDoMes(mes);

  // O mês em páginas de mil: é o teto de linhas por pedido do banco.
  const casos: Caso[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from("centro_casos").select(CAMPOS_DO_CASO).eq("institution_id", inst)
      .gte("data", dias[0]).lte("data", dias.at(-1)!).order("data").order("id").range(de, de + 999);
    if (error || !data) break;
    casos.push(...(data as unknown as Caso[]));
    if (data.length < 1000) break;
  }
  const [instituicao, salas, equipe] = await Promise.all([
    supabase.from("instituicoes").select("nome").eq("id", inst).maybeSingle(),
    supabase.from("centro_salas").select("id, nome, ordem, ativa").eq("institution_id", inst).order("ordem"),
    supabase.from("perfis").select("id, nome").eq("institution_id", inst),
  ]);
  const nomes = new Map(((equipe.data ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]));

  const r = relatorioDoMes({ mes, hoje: dia, casos, salas: (salas.data ?? []) as Sala[], nomeDoAnestesista: (id) => nomes.get(id) });

  return (
    <div className="fcFundo temaApp">
      <main className={`fcPagina ${estilos.pagina}`}>
        <header className="fcTopo">
          <Link href="/centro-cirurgico" className="fcVoltar">
            <Icone nome="voltar" tamanho={18} /> Mapa cirúrgico
          </Link>
        </header>
        <RelatorioDoMes r={r} nomeDaCasa={casa ? (instituicao.data?.nome as string | undefined) ?? "" : ""} mesDeHoje={mesDeHoje}
          planilha={planilhaDoRelatorio(r)} />
      </main>
      <AssinaturaAvanest />
    </div>
  );
}
