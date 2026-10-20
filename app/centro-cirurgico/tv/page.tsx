import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { hoje } from "@/lib/data-local";
import { apelidosDaEquipe } from "@/lib/escala";
import { CAMPOS_DO_CASO, type Caso, type Sala } from "@/lib/centro-cirurgico";
import { PainelTv } from "@/components/centro/painel-tv";

export const metadata: Metadata = {
  title: "Centro cirúrgico na TV | AVANEST",
  robots: { index: false, follow: false },
};

const agoraMs = () => Date.now();

// O mapa de HOJE na TV do corredor: o computador logado, o navegador em tela
// cheia e o cabo na TV. Quem vê é a mesma pergunta do mapa — pode_ver_centro().
export default async function TvDoCentroPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis").select("id, institution_id, status").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo" || !perfil.institution_id) redirect("/dashboard");
  const inst = perfil.institution_id as string;
  const { data: podeVer } = await supabase.rpc("pode_ver_centro", { p_institution_id: inst });
  if (podeVer !== true) redirect("/dashboard");

  const dia = hoje();
  const [instituicao, salas, casos, equipe] = await Promise.all([
    supabase.from("instituicoes").select("nome").eq("id", inst).maybeSingle(),
    supabase.from("centro_salas").select("id, nome, ordem, ativa").eq("institution_id", inst).order("ordem"),
    supabase.from("centro_casos").select(CAMPOS_DO_CASO).eq("institution_id", inst).eq("data", dia),
    supabase.from("perfis").select("id, nome").eq("institution_id", inst),
  ]);
  const apelidos = apelidosDaEquipe((equipe.data ?? []) as Array<{ id: string; nome: string }>);

  return (
    <PainelTv
      institutionId={inst}
      dia={dia}
      nomeDaCasa={(instituicao.data?.nome as string | undefined) ?? ""}
      salasIniciais={(salas.data ?? []) as Sala[]}
      casosIniciais={(casos.data ?? []) as unknown as Caso[]}
      apelidos={Object.fromEntries(apelidos)}
      agora={agoraMs()}
    />
  );
}
