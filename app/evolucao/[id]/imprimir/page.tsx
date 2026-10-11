import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAcessoAEvolucao } from "@/lib/evolucao/acesso";
import { vigentes, type Registro } from "@/lib/evolucao/registros";
import { FolhaImpressa } from "@/components/evolucao/folha-impressa";
import { BotaoImprimir } from "@/components/botao-imprimir";

export const metadata: Metadata = {
  title: "Imprimir folha de anestesia | AVANEST",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A folha impressa sai do servidor, dos registros VIGENTES no banco — não do
// que está na tela de quem clicou. Lançamento que ainda não sincronizou não
// aparece no papel, e a barra de cima diz isso.
export default async function ImprimirFolhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, perfil } = await exigirAcessoAEvolucao();

  const { data: folha } = await supabase
    .from("evolucoes_anestesicas")
    .select("id, institution_id, patient_id, status, dados, versao, intervalo_minutos, inicio_em, encerrada_em, encerrada_por, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!folha) notFound();

  const [{ data: paciente }, { data: registros }, { data: instituicao }, { data: quemEncerrou }] = await Promise.all([
    supabase.from("pacientes").select("nome, data_nascimento, idade_anos, sexo").eq("id", folha.patient_id).maybeSingle(),
    supabase.from("evolucao_registros").select("*").eq("evolucao_id", id).order("momento").limit(5000),
    supabase.from("instituicoes").select("nome").eq("id", folha.institution_id).maybeSingle(),
    folha.encerrada_por
      ? supabase.from("perfis").select("nome").eq("id", folha.encerrada_por).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!paciente) notFound();

  return (
    <main className="imprPagina">
      <div className="imprBarra">
        <Link href={`/evolucao/${id}`} className="evoBotao fantasma">← Voltar à folha</Link>
        <p>
          A4 retrato. Sai o que está salvo no servidor: lançamento ainda pendente na tela não entra.
          {folha.status === "aberta" && " A folha está aberta — a impressão sai marcada como rascunho."}
        </p>
        <BotaoImprimir rotulo="Imprimir ou salvar PDF" className="evoBotao" />
      </div>
      <FolhaImpressa
        folha={folha}
        paciente={paciente}
        vigentes={vigentes((registros ?? []) as Registro[])}
        instituicao={instituicao?.nome ?? ""}
        impressoPor={perfil.nome ?? ""}
        encerradaPor={(quemEncerrou as { nome?: string } | null)?.nome ?? null}
        agora={new Date().toISOString()}
      />
    </main>
  );
}
