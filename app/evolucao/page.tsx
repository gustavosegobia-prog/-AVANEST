import type { Metadata } from "next";
import { exigirAcessoAEvolucao } from "@/lib/evolucao/acesso";
import { InicioDasFolhas, type FolhaResumo } from "./inicio-das-folhas";

export const metadata: Metadata = {
  title: "Ficha anestésica | AVANEST",
  robots: { index: false, follow: false },
};

// Só o que a lista mostra: o cabeçalho inteiro da ficha fica no banco.
const CAMPOS = "id, versao, inicio_em, encerrada_em, procedimento:dados->>procedimento, sala:dados->>sala, pacientes(nome)";

type Linha = {
  id: string; versao: number; inicio_em: string; encerrada_em: string | null;
  procedimento: string | null; sala: string | null;
  pacientes: { nome?: string } | Array<{ nome?: string }> | null;
};

const resumo = (l: Linha): FolhaResumo => {
  const p = Array.isArray(l.pacientes) ? l.pacientes[0] : l.pacientes;
  return {
    id: l.id, versao: l.versao, inicio_em: l.inicio_em, encerrada_em: l.encerrada_em,
    paciente: p?.nome || "Paciente", procedimento: l.procedimento?.trim() ?? "", sala: l.sala?.trim() ?? "",
  };
};

const agoraMs = () => Date.now();

export default async function FichasPage() {
  const { supabase, perfil } = await exigirAcessoAEvolucao();
  const tabela = () => supabase.from("evolucoes_anestesicas").select(CAMPOS);
  const [abertas, encerradas] = await Promise.all([
    tabela().eq("status", "aberta").order("inicio_em", { ascending: false }).limit(30),
    tabela().eq("status", "encerrada").order("encerrada_em", { ascending: false, nullsFirst: false }).limit(20),
  ]);

  return (
    <InicioDasFolhas
      institutionId={perfil.institution_id as string}
      abertas={((abertas.data ?? []) as unknown as Linha[]).map(resumo)}
      encerradas={((encerradas.data ?? []) as unknown as Linha[]).map(resumo)}
      semBanco={Boolean(abertas.error)}
      agora={agoraMs()}
    />
  );
}
