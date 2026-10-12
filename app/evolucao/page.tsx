import type { Metadata } from "next";
import { avaliacoesDoLocal, exigirAcessoAEvolucao, fichasDoLocal, localDaSessao } from "@/lib/evolucao/acesso";
import { fimDaAnestesia } from "@/lib/evolucao/folha";
import { vigentes, type Registro } from "@/lib/evolucao/registros";
import { InicioDasFolhas, type FolhaResumo } from "./inicio-das-folhas";
import type { Achado } from "./nova-folha";

export const metadata: Metadata = {
  title: "Ficha anestésica | AVANEST",
  robots: { index: false, follow: false },
};

// Só o que a lista mostra: o cabeçalho inteiro da ficha fica no banco.
const CAMPOS = "id, patient_id, versao, inicio_em, encerrada_em, procedimento:dados->>procedimento, sala:dados->>sala, pacientes(nome)";
// Os avaliados dos últimos dias, com o que a ficha precisa para nascer.
const RECENTES = "patient_id, created_at, concluida_at, cirurgia:dados->>cirurgia, "
  + "pacientes(id, nome, data_nascimento, idade_anos, sexo, convenio, hospital, cirurgia, procedimento)";
const DIAS_RECENTES = 14;

type Linha = {
  id: string; patient_id: string; versao: number; inicio_em: string; encerrada_em: string | null;
  procedimento: string | null; sala: string | null;
  pacientes: { nome?: string } | Array<{ nome?: string }> | null;
};

const resumo = (l: Linha, fim: string | null = null): FolhaResumo => {
  const p = Array.isArray(l.pacientes) ? l.pacientes[0] : l.pacientes;
  return {
    id: l.id, versao: l.versao, inicio_em: l.inicio_em, encerrada_em: l.encerrada_em,
    paciente: p?.nome || "Paciente", procedimento: l.procedimento?.trim() ?? "", sala: l.sala?.trim() ?? "", fim,
  };
};

type Recente = {
  patient_id: string; created_at: string; concluida_at: string; cirurgia: string | null;
  pacientes: Omit<Achado, "avaliacao" | "aberta"> | Array<Omit<Achado, "avaliacao" | "aberta">> | null;
};

const agoraMs = () => Date.now();

export default async function FichasPage() {
  const { supabase, perfil } = await exigirAcessoAEvolucao();
  const agora = agoraMs();
  // O hospital escolhido em "Onde você vai atender hoje?": as fichas e os
  // avaliados de um hospital não aparecem no outro.
  const local = await localDaSessao(supabase);
  const tabela = () => {
    const q = supabase.from("evolucoes_anestesicas").select(CAMPOS);
    return local ? q.or(fichasDoLocal(local.id)) : q;
  };
  const [abertas, encerradas, avaliados] = await Promise.all([
    tabela().eq("status", "aberta").order("inicio_em", { ascending: false }).limit(30),
    tabela().eq("status", "encerrada").order("encerrada_em", { ascending: false, nullsFirst: false }).limit(20),
    (local ? supabase.from("avaliacoes").select(RECENTES).or(avaliacoesDoLocal(local.id)) : supabase.from("avaliacoes").select(RECENTES))
      .eq("versao_vigente", true).not("concluida_at", "is", null)
      .gte("concluida_at", new Date(agora - DIAS_RECENTES * 86_400_000).toISOString())
      .order("concluida_at", { ascending: false }).limit(40),
  ]);
  const linhasAbertas = (abertas.data ?? []) as unknown as Linha[];
  // Os eventos das fichas abertas, para saber quais já terminaram (fim da
  // anestesia ou saída da sala): nessas o relógio para e a linha pede o
  // encerramento. Correções e exclusões vêm junto — `vigentes` resolve.
  const eventosAbertas = linhasAbertas.length
    ? await supabase.from("evolucao_registros")
      .select("id, evolucao_id, tipo, momento, dados, origem, substitui_id, anulado, motivo, created_by, created_at")
      .in("evolucao_id", linhasAbertas.map((l) => l.id)).eq("tipo", "evento")
    : { data: [] };
  const eventosDa = new Map<string, Registro[]>();
  for (const r of (eventosAbertas.data ?? []) as unknown as Registro[]) {
    eventosDa.set(r.evolucao_id, [...(eventosDa.get(r.evolucao_id) ?? []), r]);
  }
  // A ficha aberta de cada paciente: quem já tem uma continua nela.
  const abertaDo = new Map(linhasAbertas.map((l) => [l.patient_id, l.id]));
  // Um paciente por linha (a avaliação mais recente), até doze.
  const vistos = new Set<string>();
  const recentes: Achado[] = [];
  for (const a of (avaliados.data ?? []) as unknown as Recente[]) {
    const p = Array.isArray(a.pacientes) ? a.pacientes[0] : a.pacientes;
    if (!p || vistos.has(p.id) || recentes.length >= 12) continue;
    vistos.add(p.id);
    recentes.push({
      ...p,
      avaliacao: { em: a.concluida_at, rascunho: false, cirurgia: a.cirurgia?.trim() ?? "" },
      aberta: abertaDo.get(p.id) ?? null,
    });
  }

  return (
    <InicioDasFolhas
      institutionId={perfil.institution_id as string}
      abertas={linhasAbertas.map((l) => resumo(l, fimDaAnestesia(vigentes(eventosDa.get(l.id) ?? []))))}
      encerradas={((encerradas.data ?? []) as unknown as Linha[]).map((l) => resumo(l))}
      semBanco={Boolean(abertas.error)}
      agora={agora}
      recentes={recentes}
      local={local}
    />
  );
}
