// Abrir uma ficha anestésica para um paciente: um caminho só, para a busca por
// nome (nova-folha.tsx) e para o mapa cirúrgico do dia (mapa-do-dia.tsx).
//
// A ficha nasce com a avaliação pré-anestésica mais recente do paciente no
// topo, no hospital da sessão. Do mapa, vem o que é do dia — data, sala,
// cirurgia, cirurgião e convênio (lib/evolucao/importar.ts, DoMapa). De "outro
// dia ou horário", vêm o início e o fim já marcados, pela mesma porta dos
// outros registros (a que confere no servidor).

import { createClient } from "@/utils/supabase/client";
import { cabecalhoInicial, type DoMapa, type PacienteDaFolha } from "@/lib/evolucao/importar";
import { motivoAoAbrirFolha } from "@/lib/evolucao/fila";
import type { HorarioDaFicha } from "@/lib/evolucao/folha";
import { preencherAFolha, type ChaveDaProposta, type FichaDoHospital } from "@/lib/evolucao/ficha-do-hospital";

export type PacienteParaAbrir = PacienteDaFolha & { id: string };

export async function abrirFicha({ institutionId, local, paciente, horario = null, doMapa, daFoto }: {
  institutionId: string;
  local: { id: string; nome: string } | null;
  paciente: PacienteParaAbrir;
  horario?: Extract<HorarioDaFicha, { ok: true }> | null;
  doMapa?: DoMapa;
  /** A ficha pré-anestésica do hospital, lida da foto e conferida: preenche o que a avaliação do sistema não trouxe. */
  daFoto?: { ficha: FichaDoHospital; campos: Array<{ chave: ChaveDaProposta; valor: string }> };
}): Promise<{ id: string } | { erro: string }> {
  const supabase = createClient();
  const { data: avaliacao } = await supabase
    .from("avaliacoes")
    .select("id, dados, concluida_at, created_at")
    .eq("patient_id", paciente.id)
    .eq("versao_vigente", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const dados = {
    ...cabecalhoInicial(paciente, avaliacao ? { id: avaliacao.id, dados: avaliacao.dados } : null, new Date(), doMapa),
    ...(local ? { local_atendimento_id: local.id, local_atendimento: local.nome } : {}),
    ...(horario ? { data_procedimento: horario.data } : {}),
  };
  if (daFoto) Object.assign(dados, preencherAFolha(dados, daFoto.campos, new Date(), daFoto.ficha));
  const { data, error } = await supabase
    .from("evolucoes_anestesicas")
    .insert({
      institution_id: institutionId, patient_id: paciente.id, avaliacao_id: avaliacao?.id ?? null, dados,
      ...(horario ? { inicio_em: horario.inicioIso } : {}),
    })
    .select("id")
    .single();
  if (error || !data) return { erro: motivoAoAbrirFolha(error) };

  // Ficha de outro horário: início e fim da anestesia já marcados.
  if (horario) {
    const marcos = [{ codigo: "inicio_anestesia", momento: horario.inicioIso },
      ...(horario.fimIso ? [{ codigo: "fim_anestesia", momento: horario.fimIso }] : [])];
    for (const m of marcos) {
      await fetch("/api/evolucao/registrar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: crypto.randomUUID(), evolucao_id: data.id, tipo: "evento", momento: m.momento,
          dados: { codigo: m.codigo }, origem: "manual" }),
      }).catch(() => null);
    }
  }
  return { id: data.id as string };
}
