import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirAcessoAEvolucao } from "@/lib/evolucao/acesso";
import { FolhaAnestesica } from "@/components/evolucao/folha-anestesica";
import type { Registro } from "@/lib/evolucao/registros";
import type { RegraDeDose } from "@/lib/evolucao/doses";

export const metadata: Metadata = {
  title: "Folha de anestesia | AVANEST",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FolhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, perfil } = await exigirAcessoAEvolucao();

  const { data: folha } = await supabase
    .from("evolucoes_anestesicas")
    .select("id, institution_id, patient_id, avaliacao_id, status, dados, lock_version, versao, intervalo_minutos, inicio_em, encerrada_em, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!folha) notFound();

  const [{ data: paciente }, { data: registros }, { data: regras }, { data: equipe }] = await Promise.all([
    supabase.from("pacientes")
      .select("id, nome, data_nascimento, idade_anos, sexo, convenio, hospital, cirurgia, procedimento")
      .eq("id", folha.patient_id).maybeSingle(),
    // Todos, inclusive os substituídos: é deles que sai o histórico de cada ponto.
    supabase.from("evolucao_registros").select("*").eq("evolucao_id", id).order("momento").limit(5000),
    supabase.from("regras_de_dose").select("*").eq("aprovada", true),
    supabase.from("perfis").select("id, nome, crm, role, permissoes, status")
      .eq("institution_id", folha.institution_id).eq("status", "ativo").order("nome"),
  ]);
  if (!paciente) notFound();

  const medicos = (equipe ?? []).filter((p) => ["medico", "admin", "owner"].includes(p.role)
    || (Array.isArray(p.permissoes) && (p.permissoes.includes("medico") || p.permissoes.includes("todos"))))
    .map((p) => ({ id: p.id, nome: p.nome, crm: p.crm ?? "" }));

  return (
    <FolhaAnestesica
      folhaInicial={folha}
      paciente={paciente}
      registrosIniciais={(registros ?? []) as Registro[]}
      regras={(regras ?? []) as RegraDeDose[]}
      medicos={medicos}
      eu={{ id: perfil.id, nome: perfil.nome, crm: perfil.crm ?? "" }}
    />
  );
}
