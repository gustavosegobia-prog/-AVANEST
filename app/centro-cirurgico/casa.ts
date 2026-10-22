import { cookies } from "next/headers";
import type { createClient } from "@/utils/supabase/server";
import { COOKIE_LOCAL, decidirLocalDaSessao, type LocalDisponivel } from "@/lib/local-ativo";
import { casaDoCentro } from "@/lib/centro-cirurgico";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * O nome e a marca d'água do mapa, da TV e do relatório (casaDoCentro): o
 * hospital escolhido nesta sessão, ou a organização.
 *
 * O hospital é o do cookie do local ativo, conferido contra meus_locais(), ou
 * o único que a pessoa tem. Entre vários sem escolha, nenhum: a TV não
 * adivinha em qual hospital está.
 */
export async function casaDaSessao(supabase: Supabase, inst: string, superAdmin: boolean | null | undefined) {
  const [instituicao, locais, meus, cookieStore] = await Promise.all([
    supabase.from("instituicoes").select("nome").eq("id", inst).maybeSingle(),
    supabase.from("locais_atendimento").select("nome, logo_url").eq("institution_id", inst).eq("ativo", true)
      .not("logo_url", "is", null),
    supabase.rpc("meus_locais"),
    cookies(),
  ]);
  const { local } = decidirLocalDaSessao(cookieStore.get(COOKIE_LOCAL)?.value, (meus.data ?? []) as LocalDisponivel[]);
  return casaDoCentro({
    local,
    organizacao: (instituicao.data?.nome as string | undefined) ?? "",
    locais: (locais.data ?? []) as Array<{ nome: string; logo_url: string | null }>,
    superAdmin,
  });
}
