import type { Metadata } from "next";
import { exigirAcessoAEvolucao, fichasDoLocal, localDaSessao } from "@/lib/evolucao/acesso";
import { fimDaAnestesia } from "@/lib/evolucao/folha";
import { vigentes, type Registro } from "@/lib/evolucao/registros";
import { InicioDasFolhas, type FolhaResumo } from "./inicio-das-folhas";
import { mapaDoDiaNaFicha } from "./mapa-do-dia-servidor";
import { avaliadosHojeNaFicha } from "./avaliados-hoje-servidor";
import { MAPA_POR_HOSPITAL } from "@/lib/centro-cirurgico";
import { hoje } from "@/lib/data-local";
import { VirarODia } from "@/components/virar-o-dia";

export const metadata: Metadata = {
  title: "Ficha anestésica | AVANEST",
  robots: { index: false, follow: false },
};

// Só o que a lista mostra: o cabeçalho inteiro da ficha fica no banco.
const CAMPOS = "id, patient_id, versao, inicio_em, encerrada_em, procedimento:dados->>procedimento, sala:dados->>sala, pacientes(nome)";

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

const agoraMs = () => Date.now();

export default async function FichasPage() {
  const { supabase, perfil } = await exigirAcessoAEvolucao();
  const agora = agoraMs();
  // O hospital escolhido em "Onde você vai atender hoje?": as fichas de um
  // hospital não aparecem no outro.
  const local = await localDaSessao(supabase);
  const tabela = () => {
    const q = supabase.from("evolucoes_anestesicas").select(CAMPOS);
    return local ? q.or(fichasDoLocal(local.id)) : q;
  };
  const [abertas, encerradas, mapa, podeMontarMapa, podeVerMapa] = await Promise.all([
    tabela().eq("status", "aberta").order("inicio_em", { ascending: false }).limit(30),
    tabela().eq("status", "encerrada").order("encerrada_em", { ascending: false, nullsFirst: false }).limit(20),
    // O mapa cirúrgico de hoje deste hospital, com o cadastro e a avaliação de cada paciente (06/11/2026).
    mapaDoDiaNaFicha(supabase, { institutionId: perfil.institution_id as string, local, perfilId: perfil.id as string }),
    // O mapa de dentro da ficha (07/11/2026): quem monta importa daqui; quem vê
    // tem o atalho. As mesmas perguntas da tela do centro cirúrgico.
    supabase.rpc("pode_montar_centro", { p_institution_id: perfil.institution_id }).then((r) => r.data === true, () => false),
    supabase.rpc("pode_ver_centro", { p_institution_id: perfil.institution_id }).then((r) => r.data === true, () => false),
  ]);
  // Os avaliados hoje que ainda não têm ficha: a lista do dia de quem não tem
  // mapa (o ambulatório). Quem já está no mapa não se repete.
  const noMapa = mapa.flatMap((c) => [c.patientId, c.principal?.id]).filter((x): x is string => Boolean(x));
  const linhasAbertas = (abertas.data ?? []) as unknown as Linha[];
  // Os eventos das fichas abertas, para saber quais já terminaram (fim da
  // anestesia ou saída da sala): nessas o relógio para e a linha pede o
  // encerramento. Correções e exclusões vêm junto — `vigentes` resolve.
  const [avaliadosHoje, eventosAbertas] = await Promise.all([
    avaliadosHojeNaFicha(supabase, { local, noMapa }),
    linhasAbertas.length
      ? supabase.from("evolucao_registros")
        .select("id, evolucao_id, tipo, momento, dados, origem, substitui_id, anulado, motivo, created_by, created_at")
        .in("evolucao_id", linhasAbertas.map((l) => l.id)).eq("tipo", "evento")
      : Promise.resolve({ data: [] }),
  ]);
  const eventosDa = new Map<string, Registro[]>();
  for (const r of (eventosAbertas.data ?? []) as unknown as Registro[]) {
    eventosDa.set(r.evolucao_id, [...(eventosDa.get(r.evolucao_id) ?? []), r]);
  }

  return (
    <>
      {/* À meia-noite a entrada vira o dia: o mapa e os avaliados de hoje são outros. */}
      <VirarODia dia={hoje()} />
      <InicioDasFolhas
        institutionId={perfil.institution_id as string}
        abertas={linhasAbertas.map((l) => resumo(l, fimDaAnestesia(vigentes(eventosDa.get(l.id) ?? []))))}
        encerradas={((encerradas.data ?? []) as unknown as Linha[]).map((l) => resumo(l))}
        semBanco={Boolean(abertas.error)}
        agora={agora}
        local={local}
        mapa={mapa}
        avaliadosHoje={avaliadosHoje}
        podeImportarMapa={MAPA_POR_HOSPITAL && podeMontarMapa}
        podeVerMapa={podeVerMapa}
      />
    </>
  );
}
