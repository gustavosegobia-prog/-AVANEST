import { createClient } from "@/utils/supabase/client";
import { nomeSimples, type Memoria, type Pendencia } from "@/lib/honorarios";
import {
  codigosPeloNome, codigosSugeridos, emLotes, entradaDaLista, type MarcaDaClinica, type ProcedimentoDaClinica,
} from "@/lib/honorarios-telas";
import { Recusa } from "./comum";

// O caminho de uma anestesia da Produção até o honorário calculado, dividido
// entre a gaveta de uma anestesia e o "Calcular o mês" — do médico, na
// Produção dele, e do Financeiro, na produção que a equipe enviou: os códigos
// que já estão gravados, a sugestão pelo nome do procedimento (a lista da
// clínica, e depois o que já foi usado antes), gravar os códigos na ordem e
// pedir a conta ao servidor (app/api/honorarios/calcular).

export type Codigo = { codigo: string; descricao: string };

export type Resultado = {
  situacao: "calculado" | "pendente"; valorPrevisto: number | null; mensagem: string | null;
  pendencias: Pendencia[]; memoria: Memoria;
};

/**
 * De onde veio a sugestão: da lista da clínica (que o Financeiro mantém) ou
 * de uma anotação anterior com o mesmo procedimento (`data`).
 */
export type Sugestao = { codigos: Codigo[]; data: string | null; daLista: boolean };

/** Quem está calculando: o médico, a própria Produção; o Financeiro, a da equipe. */
export type Modo = "medico" | "financeiro";

type LinhaDoProcedimento = { producao_id: string; ordem: number; tuss_codigo: string | null; descricao: string | null };

/** A versão da TUSS em uso; null quando nenhuma foi publicada. */
export async function tussEmUso(): Promise<string | null> {
  const { data } = await createClient().from("tuss_versoes").select("id").eq("tabela", "22").eq("situacao", "vigente").maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Os códigos já gravados de cada anestesia, na ordem escolhida. */
export async function codigosSalvos(ids: string[]): Promise<Map<string, Codigo[]>> {
  const r = new Map<string, Codigo[]>();
  const supabase = createClient();
  for (const lote of emLotes(ids, 100)) {
    const { data } = await supabase.from("producao_procedimentos").select("producao_id, ordem, tuss_codigo, descricao")
      .in("producao_id", lote).order("ordem");
    for (const p of (data ?? []) as LinhaDoProcedimento[]) {
      if (!p.tuss_codigo) continue;
      r.set(p.producao_id, [...(r.get(p.producao_id) ?? []), { codigo: p.tuss_codigo, descricao: p.descricao ?? "" }]);
    }
  }
  return r;
}

/** As marcas da clínica (as ativas primeiro, na ordem combinada). Sem a migração, nenhuma. */
export async function marcasDaClinica(): Promise<MarcaDaClinica[]> {
  const { data, error } = await createClient().from("marcas_da_clinica")
    .select("id, nome, tuss_codigo, descricao, ativo, ordem").order("ordem").order("nome");
  return error ? [] : (data ?? []) as MarcaDaClinica[];
}

/** A lista da clínica para estes procedimentos. */
async function listaDaClinica(chaves: string[]): Promise<ProcedimentoDaClinica[]> {
  if (!chaves.length) return [];
  const supabase = createClient();
  const r: ProcedimentoDaClinica[] = [];
  for (const lote of emLotes(chaves, 100)) {
    const { data, error } = await supabase.from("procedimentos_da_clinica").select("chave, nome, codigos").in("chave", lote);
    if (error) return r;
    r.push(...((data ?? []) as ProcedimentoDaClinica[]));
  }
  return r;
}

/**
 * Os códigos sugeridos para cada anestesia, pelo procedimento escrito na
 * ficha. Primeiro a lista da clínica, que o Financeiro vai ensinando a cada
 * conferência; sem ela, a anotação anterior mais recente com o mesmo
 * procedimento — do próprio médico (a Produção é pessoal) ou, no Financeiro,
 * de toda a produção que a equipe enviou.
 */
export async function sugestoesDeCodigos(
  anestesias: Array<{ id: string; procedimento: string | null }>, modo: Modo = "medico",
): Promise<Map<string, Sugestao>> {
  const r = new Map<string, Sugestao>();
  const comNome = anestesias.filter((a) => nomeSimples(a.procedimento));
  if (!comNome.length) return r;
  const chaves = [...new Set(comNome.map((a) => nomeSimples(a.procedimento)))];

  const lista = await listaDaClinica(chaves);
  for (const a of comNome) {
    const c = codigosPeloNome(a.procedimento, lista);
    if (c) r.set(a.id, { codigos: c, data: null, daLista: true });
  }
  const faltam = comNome.filter((a) => !r.has(a.id));
  if (!faltam.length) return r;

  const supabase = createClient();
  const base = () => supabase.from("producao_do_dia").select("id, data, procedimento").not("procedimento", "is", null);
  let data: unknown[] | null = null;
  if (modo === "medico") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return r;
    ({ data } = await base().eq("perfil_id", user.id).order("data", { ascending: false }).limit(500));
  } else {
    ({ data } = await base().not("enviado_em", "is", null).order("data", { ascending: false }).limit(500));
  }
  const anteriores = (data ?? []) as Array<{ id: string; data: string; procedimento: string | null }>;
  const chavesQueFaltam = new Set(faltam.map((a) => nomeSimples(a.procedimento)));
  // Até 20 anotações por procedimento bastam: a mais recente com código vence.
  const porChave = new Map<string, string[]>();
  for (const a of anteriores) {
    const k = nomeSimples(a.procedimento);
    if (!chavesQueFaltam.has(k)) continue;
    const ids = porChave.get(k) ?? [];
    if (ids.length < 20) porChave.set(k, [...ids, a.id]);
  }
  const ids = [...porChave.values()].flat();
  if (!ids.length) return r;
  const procs: LinhaDoProcedimento[] = [];
  for (const lote of emLotes(ids, 100)) {
    const { data: deles } = await supabase.from("producao_procedimentos").select("producao_id, ordem, tuss_codigo, descricao")
      .in("producao_id", lote);
    procs.push(...((deles ?? []) as LinhaDoProcedimento[]));
  }
  for (const a of faltam) {
    const s = codigosSugeridos(a, anteriores, procs);
    if (s) r.set(a.id, { ...s, daLista: false });
  }
  return r;
}

/** Os procedimentos, na ordem escolhida: o que estava se apaga e entra de novo. */
export async function gravarCodigos(producaoId: string, codigos: Codigo[], tussId: string | null) {
  if (!codigos.length) throw new Recusa("Escolha ao menos o código TUSS do procedimento principal.");
  const supabase = createClient();
  const apagar = await supabase.from("producao_procedimentos").delete().eq("producao_id", producaoId);
  if (apagar.error) throw apagar.error;
  const inserir = await supabase.from("producao_procedimentos").insert(codigos.map((c, i) => ({
    producao_id: producaoId, ordem: i + 1, tuss_codigo: c.codigo, tuss_versao_id: tussId, descricao: c.descricao || null,
  })));
  if (inserir.error) throw inserir.error;
}

/**
 * A conferência do Financeiro ensina a lista da clínica: o procedimento como
 * foi escrito na ficha passa a puxar estes códigos para todo o grupo. Falhar
 * aqui não desfaz o cálculo — a lista só deixa de aprender desta vez.
 */
export async function ensinarProcedimento(procedimento: string | null, codigos: Codigo[]) {
  const entrada = entradaDaLista(procedimento, codigos);
  const institutionId = entrada ? await instituicaoAtual() : null;
  if (!entrada || !institutionId) return;
  await createClient().from("procedimentos_da_clinica")
    .upsert({ institution_id: institutionId, ...entrada }, { onConflict: "institution_id,chave" });
}

/** A organização de quem está na tela, lida uma vez por página. */
let organizacao: Promise<string | null> | null = null;
function instituicaoAtual(): Promise<string | null> {
  organizacao ??= (async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("perfis").select("institution_id").eq("id", user.id).maybeSingle();
    return (data as { institution_id: string | null } | null)?.institution_id ?? null;
  })();
  return organizacao;
}

/** A conta no servidor, com o contrato do convênio — que o médico não abre. */
export async function calcularNoServidor(producaoId: string, urgencia?: boolean, marcas?: string[]): Promise<Resultado> {
  const resposta = await fetch("/api/honorarios/calcular", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ producaoId, urgencia, marcas }),
  });
  const corpo = await resposta.json().catch(() => ({})) as Resultado & { error?: string };
  if (!resposta.ok) throw new Recusa(corpo.error || "Não foi possível calcular agora.");
  return corpo;
}

/** O Financeiro dá por conferido o que está calculado. Devolve os ids conferidos. */
export async function conferirNoServidor(ids: string[]): Promise<string[]> {
  const resposta = await fetch("/api/honorarios/conferir", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const corpo = await resposta.json().catch(() => ({})) as { conferidas?: string[]; error?: string };
  if (!resposta.ok) throw new Recusa(corpo.error || "Não foi possível conferir agora.");
  return corpo.conferidas ?? [];
}
