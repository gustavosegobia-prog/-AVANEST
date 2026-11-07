// O mapa cirúrgico de hoje, do hospital da sessão, pronto para a entrada da
// ficha anestésica: cada paciente do mapa com o cadastro parecido e a
// avaliação pré-anestésica dele já procurados (lib/evolucao/mapa-do-dia.ts).
//
// Tudo com a sessão de quem está logado: o banco decide o que ele vê (o mapa
// pede pode_ver_centro; os pacientes, a política deles). Se o mapa não está
// liberado, ou a migração 202611060001 ainda não rodou, a lista volta vazia e
// a seção não aparece — a ficha continua como era.
//
// O MAPA DO HOSPITAL (07/11/2026). Quando o centro cirúrgico monta o mapa na
// organização do hospital, e o hospital autorizou por escrito, os pacientes
// de hoje desse mapa vêm junto, pela função mapa_compartilhado_do_dia
// (migração 202611070001). Sem ligação autorizada, ou antes da migração, ela
// não devolve nada. Essas linhas são só leitura: nada volta para o mapa do
// hospital, e a ficha encerrada é achada aqui, pelo cadastro (fichaDeHoje).

import type { createClient } from "@/utils/supabase/server";
import { dataLocal, hoje as hojeLocal } from "@/lib/data-local";
import { apelidosDaEquipe } from "@/lib/escala";
import { MAPA_POR_HOSPITAL, doHospital } from "@/lib/centro-cirurgico";
import { fichasDoLocal } from "@/lib/evolucao/local";
import {
  comparacaoDoParecido, fichaDeHoje, ordenarMapaDaFicha, principalDoCaso, semRepetirOMapaDaCasa,
  type AvaliacaoResumo, type CadastroSugerido, type CasoComCadastro, type CasoDoMapaNaFicha, type EtapaDoMapa,
} from "@/lib/evolucao/mapa-do-dia";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type LinhaDoMapa = {
  id: string; data: string; horario: string | null; ordem: number | null; paciente: string; idade: number | null;
  data_nascimento: string | null; procedimento: string | null; cirurgiao: string | null; convenio: string | null; anestesista_id: string | null;
  etapa: EtapaDoMapa; patient_id: string | null; evolucao_id: string | null;
  sala: { nome?: string } | Array<{ nome?: string }> | null;
  /** O nome do hospital, quando a linha vem do mapa dele (mapa_compartilhado_do_dia). */
  doHospital?: string;
};

/** O que mapa_compartilhado_do_dia devolve: só o que a ficha usa. */
type LinhaDoHospital = {
  id: string; data: string; horario: string | null; ordem: number | null; sala: string | null; paciente: string; idade: number | null;
  data_nascimento: string | null; procedimento: string | null; cirurgiao: string | null; convenio: string | null;
  etapa: EtapaDoMapa; hospital: string | null;
};

type Cadastro = Omit<CadastroSugerido, "avaliacao" | "aberta" | "comparacao">;
const CAMPOS_DO_CADASTRO = "id, nome, data_nascimento, idade_anos, sexo, convenio, hospital, cirurgia, procedimento";

export async function mapaDoDiaNaFicha(supabase: Supabase, o: {
  institutionId: string;
  local: { id: string; nome: string } | null;
  perfilId: string;
}): Promise<CasoComCadastro[]> {
  // Desligado até a migração 202611060001 rodar (lib/centro-cirurgico.ts).
  if (!MAPA_POR_HOSPITAL) return [];
  const dia = hojeLocal();
  try {
    let consulta = supabase.from("centro_casos")
      .select("id, data, horario, ordem, paciente, idade, data_nascimento, procedimento, cirurgiao, convenio, anestesista_id, etapa, patient_id, evolucao_id, sala:centro_salas(nome)")
      .eq("institution_id", o.institutionId).eq("data", dia).neq("etapa", "cancelado");
    if (o.local) consulta = consulta.or(doHospital(o.local.id));
    const [daCasa, doMapaDoHospital] = await Promise.all([
      consulta.then((r) => (r.error ? [] : (r.data ?? []) as unknown as LinhaDoMapa[]), () => [] as LinhaDoMapa[]),
      o.local
        ? supabase.rpc("mapa_compartilhado_do_dia", { p_local: o.local.id })
          .then((r) => (r.error ? [] : (r.data ?? []) as LinhaDoHospital[]), () => [] as LinhaDoHospital[])
        : Promise.resolve([] as LinhaDoHospital[]),
    ]);
    const linhas: LinhaDoMapa[] = [
      ...daCasa,
      ...semRepetirOMapaDaCasa(daCasa, doMapaDoHospital).map((l) => ({
        ...l, sala: { nome: l.sala ?? "" }, anestesista_id: null, patient_id: null, evolucao_id: null,
        doHospital: l.hospital?.trim() || "Hospital",
      })),
    ];
    if (!linhas.length) return [];
    const temDoHospital = linhas.some((l) => l.doHospital);

    const idsDeFicha = linhas.map((l) => l.evolucao_id).filter((x): x is string => Boolean(x));
    const ligados = [...new Set(linhas.map((l) => l.patient_id).filter((x): x is string => Boolean(x)))];
    const semCadastro = linhas.filter((l) => !l.patient_id && !l.evolucao_id);

    const [equipe, fichas, cadastrosLigados, parecidos] = await Promise.all([
      supabase.from("perfis").select("id, nome").eq("institution_id", o.institutionId),
      idsDeFicha.length
        ? supabase.from("evolucoes_anestesicas").select("id, status").in("id", idsDeFicha)
        : Promise.resolve({ data: [] as Array<{ id: string; status: string }> }),
      ligados.length
        ? supabase.from("pacientes").select(CAMPOS_DO_CADASTRO).in("id", ligados)
        : Promise.resolve({ data: [] as Cadastro[] }),
      // Um pedido por paciente do mapa sem cadastro ligado: o mapa do dia de um
      // hospital tem dezenas, não centenas.
      Promise.all(semCadastro.map(async (l) => {
        const r = await supabase.rpc("pacientes_parecidos", { p_nome: l.paciente });
        return [l.id, (r.error ? [] : (r.data ?? [])) as Cadastro[]] as const;
      })),
    ]);

    const apelidos = apelidosDaEquipe((equipe.data ?? []) as Array<{ id: string; nome: string }>);
    const statusDa = new Map(((fichas.data ?? []) as Array<{ id: string; status: string }>).map((f) => [f.id, f.status]));
    const cadastroPorId = new Map(((cadastrosLigados.data ?? []) as Cadastro[]).map((c) => [c.id, c]));
    const parecidosDe = new Map(parecidos);

    // A avaliação mais recente e a ficha aberta neste hospital, de todos os cadastros de uma vez.
    const todos = [...new Set([...cadastroPorId.keys(), ...parecidos.flatMap(([, lista]) => lista.map((c) => c.id))])];
    const fichasDosCadastros = () => (o.local
      ? supabase.from("evolucoes_anestesicas").select("id, patient_id, status, inicio_em").or(fichasDoLocal(o.local.id))
      : supabase.from("evolucoes_anestesicas").select("id, patient_id, status, inicio_em")).in("patient_id", todos);
    const [avaliacoes, abertas, recentes] = todos.length
      ? await Promise.all([
        supabase.from("avaliacoes").select("patient_id, created_at, concluida_at, cirurgia:dados->>cirurgia")
          .in("patient_id", todos).eq("versao_vigente", true).order("created_at", { ascending: false }),
        fichasDosCadastros().eq("status", "aberta"),
        // As fichas de hoje, abertas ou encerradas, de quem veio do mapa do
        // hospital. Uma janela folgada; o dia é conferido no fuso do serviço.
        temDoHospital
          ? fichasDosCadastros().gte("inicio_em", new Date(Date.now() - 36 * 3600000).toISOString())
          : Promise.resolve({ data: [] }),
      ])
      : [{ data: [] }, { data: [] }, { data: [] }];
    const fichasRecentes = (recentes.data ?? []) as Array<{ id: string; patient_id: string; status: string; inicio_em: string }>;
    const avaliacaoDe = new Map<string, AvaliacaoResumo>();
    for (const a of (avaliacoes.data ?? []) as Array<{ patient_id: string; created_at: string; concluida_at: string | null; cirurgia: string | null }>) {
      if (!avaliacaoDe.has(a.patient_id)) {
        avaliacaoDe.set(a.patient_id, { em: a.concluida_at ?? a.created_at, rascunho: !a.concluida_at, cirurgia: a.cirurgia?.trim() ?? "" });
      }
    }
    const abertaDe = new Map(((abertas.data ?? []) as Array<{ id: string; patient_id: string }>).map((f) => [f.patient_id, f.id]));

    const casos: CasoComCadastro[] = linhas.map((l) => {
      const sala = Array.isArray(l.sala) ? l.sala[0] : l.sala;
      const base: CasoDoMapaNaFicha = {
        id: l.id, data: l.data, horario: l.horario, ordem: l.ordem, sala: sala?.nome?.trim() ?? "",
        paciente: l.paciente, idade: l.idade, nascimento: l.data_nascimento ?? null, procedimento: l.procedimento ?? "", cirurgiao: l.cirurgiao ?? "",
        convenio: l.convenio ?? "", anestesista: l.anestesista_id ? apelidos.get(l.anestesista_id) ?? "" : "",
        meu: l.anestesista_id === o.perfilId, etapa: l.etapa, patientId: l.patient_id,
        ficha: l.evolucao_id && statusDa.has(l.evolucao_id)
          ? { id: l.evolucao_id, status: statusDa.get(l.evolucao_id) === "encerrada" ? "encerrada" : "aberta" }
          : null,
        ...(l.doHospital ? { doHospital: l.doHospital } : {}),
      };
      const candidatos = l.patient_id
        ? [cadastroPorId.get(l.patient_id)].filter((c): c is Cadastro => Boolean(c))
        : parecidosDe.get(l.id) ?? [];
      const sugestoes: CadastroSugerido[] = candidatos.map((c) => ({
        ...c,
        avaliacao: avaliacaoDe.get(c.id) ?? null,
        aberta: abertaDe.get(c.id) ?? null,
        comparacao: comparacaoDoParecido(base, c, dia),
      }));
      const principal = principalDoCaso(base, sugestoes);
      if (base.doHospital && principal) {
        const ficha = fichaDeHoje(principal.id, fichasRecentes, dia, (iso) => dataLocal(new Date(iso)));
        if (ficha) return { ...base, ficha, sugestoes, principal };
      }
      return { ...base, sugestoes, principal };
    });
    return ordenarMapaDaFicha(casos);
  } catch {
    return [];
  }
}
