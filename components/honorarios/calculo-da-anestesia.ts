import { createClient } from "@/utils/supabase/client";
import { nomeSimples, type Memoria, type Pendencia } from "@/lib/honorarios";
import { codigosSugeridos, emLotes } from "@/lib/honorarios-telas";
import { Recusa } from "./comum";

// O caminho de uma anestesia da Produção até o honorário calculado, dividido
// entre a gaveta de uma anestesia e o "Calcular o mês": os códigos que já
// estão gravados, a sugestão pelo que o médico usou antes, gravar os códigos
// na ordem e pedir a conta ao servidor (app/api/honorarios/calcular).

export type Codigo = { codigo: string; descricao: string };

export type Resultado = {
  situacao: "calculado" | "pendente"; valorPrevisto: number | null; mensagem: string | null;
  pendencias: Pendencia[]; memoria: Memoria;
};

export type Sugestao = { codigos: Codigo[]; data: string };

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

/**
 * Os códigos da última anotação do médico com o mesmo procedimento escrito,
 * para cada anestesia pedida. Só as anotações dele: a Produção é pessoal, e
 * quem tem o Financeiro também lê as enviadas dos colegas.
 */
export async function sugestoesDeCodigos(
  anestesias: Array<{ id: string; procedimento: string | null }>,
): Promise<Map<string, Sugestao>> {
  const r = new Map<string, Sugestao>();
  const comNome = anestesias.filter((a) => nomeSimples(a.procedimento));
  if (!comNome.length) return r;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return r;
  const { data } = await supabase.from("producao_do_dia").select("id, data, procedimento")
    .eq("perfil_id", user.id).not("procedimento", "is", null)
    .order("data", { ascending: false }).limit(500);
  const anteriores = (data ?? []) as Array<{ id: string; data: string; procedimento: string | null }>;
  const chaves = new Set(comNome.map((a) => nomeSimples(a.procedimento)));
  // Até 20 anotações por procedimento bastam: a mais recente com código vence.
  const porChave = new Map<string, string[]>();
  for (const a of anteriores) {
    const k = nomeSimples(a.procedimento);
    if (!chaves.has(k)) continue;
    const lista = porChave.get(k) ?? [];
    if (lista.length < 20) porChave.set(k, [...lista, a.id]);
  }
  const ids = [...porChave.values()].flat();
  if (!ids.length) return r;
  const procs: LinhaDoProcedimento[] = [];
  for (const lote of emLotes(ids, 100)) {
    const { data: deles } = await supabase.from("producao_procedimentos").select("producao_id, ordem, tuss_codigo, descricao")
      .in("producao_id", lote);
    procs.push(...((deles ?? []) as LinhaDoProcedimento[]));
  }
  for (const a of comNome) {
    const s = codigosSugeridos(a, anteriores, procs);
    if (s) r.set(a.id, s);
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

/** A conta no servidor, com o contrato do convênio — que o médico não abre. */
export async function calcularNoServidor(producaoId: string, urgencia: boolean): Promise<Resultado> {
  const resposta = await fetch("/api/honorarios/calcular", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ producaoId, urgencia }),
  });
  const corpo = await resposta.json().catch(() => ({})) as Resultado & { error?: string };
  if (!resposta.ok) throw new Recusa(corpo.error || "Não foi possível calcular agora.");
  return corpo;
}
