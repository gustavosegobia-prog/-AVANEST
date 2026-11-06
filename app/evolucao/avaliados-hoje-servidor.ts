// Os pacientes avaliados hoje, neste hospital, que ainda não têm ficha: a lista
// do dia de quem não tem mapa cirúrgico — o ambulatório, onde a consulta
// pré-anestésica vem logo antes do procedimento (lib/evolucao/entrada.ts).
//
// Com a sessão de quem está logado: o banco decide o que ele vê. Qualquer
// falha devolve a lista vazia, e a entrada fica como era (só a busca).

import type { createClient } from "@/utils/supabase/server";
import { dataLocal, hoje as hojeLocal } from "@/lib/data-local";
import { fichasDoLocal } from "@/lib/evolucao/local";
import { avaliadosDeHoje, type AvaliacaoDoDia, type PacienteAchado } from "@/lib/evolucao/entrada";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function avaliadosHojeNaFicha(supabase: Supabase, o: {
  local: { id: string; nome: string } | null;
  /** Os pacientes que já aparecem no mapa do dia: não se repetem. */
  noMapa?: string[];
}): Promise<PacienteAchado[]> {
  const dia = hojeLocal();
  // Uma janela folgada (36 h); o dia certo é conferido no fuso do serviço, em
  // avaliadosDeHoje. updated_at cobre a avaliação começada ontem e concluída hoje.
  const desde = new Date(Date.now() - 36 * 3600000).toISOString();
  try {
    const { data, error } = await supabase.from("avaliacoes")
      .select("patient_id, created_at, concluida_at, local_atendimento_id, cirurgia:dados->>cirurgia, paciente:pacientes(id, nome, data_nascimento, idade_anos, sexo, convenio, hospital, cirurgia, procedimento)")
      .eq("versao_vigente", true)
      .gte("updated_at", desde)
      .order("updated_at", { ascending: false })
      .limit(60);
    if (error || !data?.length) return [];
    // As deste hospital, e as de antes de haver hospital (como as fichas, lib/evolucao/local.ts).
    const avaliacoes = (data as unknown as Array<AvaliacaoDoDia & { local_atendimento_id: string | null }>)
      .filter((a) => !o.local || !a.local_atendimento_id || a.local_atendimento_id === o.local.id);
    if (!avaliacoes.length) return [];

    const ids = [...new Set(avaliacoes.map((a) => a.patient_id))];
    const fichas = await (o.local
      ? supabase.from("evolucoes_anestesicas").select("patient_id, inicio_em").or(fichasDoLocal(o.local.id))
      : supabase.from("evolucoes_anestesicas").select("patient_id, inicio_em"))
      .in("patient_id", ids).gte("inicio_em", desde);
    // Sem saber quem já tem ficha, melhor não sugerir ninguém.
    if (fichas.error) return [];
    const comFichaHoje = ((fichas.data ?? []) as Array<{ patient_id: string; inicio_em: string }>)
      .filter((f) => dataLocal(new Date(f.inicio_em)) === dia)
      .map((f) => f.patient_id);
    return avaliadosDeHoje(avaliacoes, { hoje: dia, comFichaHoje, noMapa: o.noMapa });
  } catch {
    return [];
  }
}
