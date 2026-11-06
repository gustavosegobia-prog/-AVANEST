import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { hoje } from "@/lib/data-local";
import { apelidosDaEquipe } from "@/lib/escala";
import { CAMPOS_DO_CASO, abreOCentro, noHospital, type Caso, type Sala } from "@/lib/centro-cirurgico";
import { PainelTv } from "@/components/centro/painel-tv";
import { casaDaSessao } from "../casa";

export const metadata: Metadata = {
  title: "Centro cirúrgico na TV | AVANEST",
  robots: { index: false, follow: false },
};

const agoraMs = () => Date.now();

// O mapa de HOJE na TV do corredor: o computador logado, o navegador em tela
// cheia e o cabo na TV. Quem vê é a mesma pergunta do mapa — abreOCentro().
export default async function TvDoCentroPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis").select("id, institution_id, status, super_admin").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo" || !perfil.institution_id) redirect("/dashboard");
  const inst = perfil.institution_id as string;
  const { data: podeVer } = await supabase.rpc("pode_ver_centro", { p_institution_id: inst });
  if (!abreOCentro(podeVer)) redirect("/dashboard");

  const dia = hoje();
  // O nome, a marca d'água e o hospital do mapa: o escolhido nesta sessão, ou a casa.
  const casa = await casaDaSessao(supabase, inst, perfil.super_admin);
  const [salas, casos, equipe] = await Promise.all([
    noHospital(supabase.from("centro_salas").select("id, nome, ordem, ativa").eq("institution_id", inst), casa.localId).order("ordem"),
    noHospital(supabase.from("centro_casos").select(CAMPOS_DO_CASO).eq("institution_id", inst).eq("data", dia), casa.localId),
    supabase.from("perfis").select("id, nome").eq("institution_id", inst),
  ]);
  const apelidos = apelidosDaEquipe((equipe.data ?? []) as Array<{ id: string; nome: string }>);

  return (
    <PainelTv
      institutionId={inst}
      localId={casa.localId}
      dia={dia}
      nomeDaCasa={casa.nome}
      salasIniciais={(salas.data ?? []) as Sala[]}
      casosIniciais={(casos.data ?? []) as unknown as Caso[]}
      apelidos={Object.fromEntries(apelidos)}
      marca={casa.marca}
      agora={agoraMs()}
    />
  );
}
