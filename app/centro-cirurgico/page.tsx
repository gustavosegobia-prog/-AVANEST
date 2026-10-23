import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { hoje, somarDias } from "@/lib/data-local";
import { apelidosDaEquipe } from "@/lib/escala";
import { CAMPOS_DO_CASO, abreOCentro, type Caso, type PlantaoDaEscala, type Sala } from "@/lib/centro-cirurgico";
import { casaDaSessao } from "./casa";
import { MapaCirurgico, type Anestesista } from "@/components/centro/mapa-cirurgico";

export const metadata: Metadata = {
  title: "Mapa cirúrgico | AVANEST",
  robots: { index: false, follow: false },
};

const agoraMs = () => Date.now();

// O mapa cirúrgico do dia: o enfermeiro chefe monta, o paciente anda pelas
// etapas, e no fim do dia sai a lista dos atos por anestesista e convênio.
//
// Quem entra é a mesma pergunta das políticas do banco (202610210001):
// pode_ver_centro() — o recurso ligado para a organização, e acesso de centro
// ou clínico. Quem monta é pode_montar_centro(). A trava de verdade é o banco;
// esta só evita abrir uma tela que ele vai recusar.
export default async function MapaCirurgicoPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis").select("id, institution_id, status, super_admin, role").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo" || !perfil.institution_id) redirect("/dashboard");
  const inst = perfil.institution_id as string;
  const [{ data: podeVer }, { data: podeMontar }] = await Promise.all([
    supabase.rpc("pode_ver_centro", { p_institution_id: inst }),
    supabase.rpc("pode_montar_centro", { p_institution_id: inst }),
  ]);
  if (!abreOCentro(podeVer)) redirect("/dashboard");

  const { data: pedido } = await searchParams;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(pedido ?? "") ? (pedido as string) : hoje();

  const [casa, salas, casos, equipe, plantoes] = await Promise.all([
    // O nome e a marca d'água: o hospital escolhido nesta sessão, ou a casa.
    casaDaSessao(supabase, inst, perfil.super_admin),
    supabase.from("centro_salas").select("id, nome, ordem, ativa").eq("institution_id", inst).order("ordem"),
    supabase.from("centro_casos").select(CAMPOS_DO_CASO).eq("institution_id", inst).eq("data", dia),
    supabase.from("perfis").select("id, nome, role, status, atuacao_medica").eq("institution_id", inst),
    // Ontem também: a cirurgia das 5h é do plantão de 24h que começou ontem às 7h.
    supabase.from("plantoes").select("data, hora_inicio, hora_fim, perfil_id, situacao")
      .eq("institution_id", inst).eq("privado", false).gte("data", somarDias(dia, -1)).lte("data", dia),
  ]);

  // Quem anestesia: o médico da casa, e quem atua como médico. Recepção e
  // enfermagem ficam fora da lista de quem se escolhe para o paciente.
  const pessoas = (equipe.data ?? []) as Array<{ id: string; nome: string; role: string; status: string; atuacao_medica: boolean | null }>;
  const anestesistas = pessoas.filter((p) => p.status === "ativo" && (p.role === "medico" || p.atuacao_medica === true));
  const apelidos = apelidosDaEquipe(anestesistas);
  const lista: Anestesista[] = anestesistas
    .map((p) => ({ id: p.id, nome: p.nome, apelido: apelidos.get(p.id) ?? p.nome }))
    .sort((a, b) => a.apelido.localeCompare(b.apelido, "pt-BR"));

  return (
    <MapaCirurgico
      key={dia}
      institutionId={inst}
      nomeDaCasa={casa.nome}
      dia={dia}
      hoje={hoje()}
      salasIniciais={(salas.data ?? []) as Sala[]}
      casosIniciais={(casos.data ?? []) as unknown as Caso[]}
      anestesistas={lista}
      plantoes={(plantoes.data ?? []) as PlantaoDaEscala[]}
      podeMontar={podeMontar === true}
      semBanco={Boolean(casos.error)}
      soMapa={perfil.role === "centro"}
      marca={casa.marca}
      agora={agoraMs()}
    />
  );
}
