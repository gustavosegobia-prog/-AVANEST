// ===========================================================================
// "Planos a partir de R$ X/mês" — o preço de entrada que a capa mostra
// ===========================================================================
// O número sai da mesma tabela que a página de planos lê (`planos`, só os
// ativos), e nunca é digitado: preço escrito à mão na capa vira mentira no
// primeiro reajuste feito na tela administrativa.
//
// A capa é estática, e continua sendo: a consulta vai pelo cache do Next por
// uma hora (`next.revalidate`), sem cookie e sem sessão, então a página não
// passa a ser renderizada a cada visita. Reajuste de preço aparece na capa em
// até uma hora; na página de planos, na hora.
//
// Se a consulta falhar ou demorar, a linha simplesmente não aparece. Um preço
// errado ou um "R$ NaN" na primeira tela é pior do que nenhum preço.
// ===========================================================================

/** De quanto em quanto tempo a capa pergunta o preço de novo, em segundos. */
export const REVALIDAR_PRECO_DA_CAPA = 3600;

/** Quanto a capa espera pela tabela antes de desistir da linha do preço. */
const ESPERA_MAXIMA_MS = 3000;

export type LinhaDePlano = {
  preco_mensal: number | string | null;
  ativo?: boolean | null;
  sob_consulta?: boolean | null;
};

/**
 * O menor `preco_mensal` entre os planos ativos.
 *
 * Fica de fora o plano sob consulta (o hospital, sem preço de tabela) e o
 * inativo — o "Teste interno" de R$ 5 é inativo, e é justamente o que não pode
 * aparecer na capa. O Postgres devolve `numeric`, que pode chegar como texto.
 */
export function menorPrecoMensal(planos: readonly LinhaDePlano[] | null | undefined): number | null {
  const precos = (planos ?? [])
    .filter((p) => p.ativo !== false && p.sob_consulta !== true && p.preco_mensal != null)
    .map((p) => Number(p.preco_mensal))
    .filter((v) => Number.isFinite(v) && v > 0);
  return precos.length ? Math.min(...precos) : null;
}

/** "R$ 129,00" — o mesmo formato dos cartões da página de planos. */
export const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "Planos a partir de R$ 129,00/mês", ou nada quando não há preço. */
export function fraseDoPrecoDeEntrada(valor: number | null): string | null {
  return valor == null ? null : `Planos a partir de ${reais(valor)}/mês`;
}

/**
 * O preço de entrada, pela API pública do banco, com a chave publicável — a
 * mesma leitura que um visitante faz na página de planos.
 */
export async function precoDeEntrada(): Promise<number | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) return null;
  const endereco = `${url}/rest/v1/planos?select=preco_mensal,ativo,sob_consulta`
    + "&ativo=eq.true&sob_consulta=eq.false&preco_mensal=not.is.null";
  // A espera vai por fora do fetch: um `signal` tiraria a consulta da
  // memoização do Next.
  let desistir: ReturnType<typeof setTimeout> | undefined;
  const tempoEsgotado = new Promise<null>((resolve) => { desistir = setTimeout(() => resolve(null), ESPERA_MAXIMA_MS); });
  const consulta = (async () => {
    try {
      const resposta = await fetch(endereco, {
        headers: { apikey: chave },
        next: { revalidate: REVALIDAR_PRECO_DA_CAPA, tags: ["planos"] },
      });
      if (!resposta.ok) return null;
      return menorPrecoMensal(await resposta.json() as LinhaDePlano[]);
    } catch {
      return null;
    }
  })();
  try {
    return await Promise.race([consulta, tempoEsgotado]);
  } finally {
    clearTimeout(desistir);
  }
}
