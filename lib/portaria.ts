/**
 * As decisões da portaria da API, sem o HTTP em volta.
 *
 * Toda rota que grava alguma coisa passa por três perguntas antes de olhar o
 * corpo do pedido: veio de onde eu espero, está no formato certo, e cabe no
 * tamanho? E as rotas sensíveis passam por uma quarta: esta pessoa já bateu
 * aqui vezes demais no último minuto?
 *
 * As quatro moravam dentro de `request-security.ts`, que importa `next/server`
 * — e por causa desse import o arquivo não carrega fora do Next. Resultado: o
 * código que guarda TODAS as rotas de API era o único crítico sem um único
 * teste. Não por descuido: por impossibilidade.
 *
 * Aqui não há NextRequest nem NextResponse. Entram valores, saem decisões. O
 * `request-security.ts` continua sendo quem lê os cabeçalhos e monta a resposta
 * de erro — a divisão é essa, e é ela que torna a regra conferível.
 */

/** O teto padrão de corpo de requisição: 32 KB. */
export const TAMANHO_MAXIMO = 32_768;

/**
 * A origem do pedido é uma das que esta instalação aceita?
 *
 * Duas origens válidas, e não uma. `esperada` é montada a partir dos
 * cabeçalhos `x-forwarded-*`, que é o que chega quando há um proxy na frente —
 * e há: a Vercel. `doNextUrl` é a origem que o próprio Next calculou. Aceitar
 * só a segunda quebraria atrás do proxy; aceitar só a primeira quebraria em
 * desenvolvimento.
 *
 * Sem `Origin` nenhum é recusa. O navegador manda esse cabeçalho em toda
 * requisição que grava; quem não manda não é navegador em uso normal.
 *
 * A linha do `!origin` é redundante — provada assim: apagando-a, nenhum teste
 * quebra, porque `null` também não é igual a nenhuma das duas origens. Fica
 * como declaração: quem lê a função descobre a regra sem ter de deduzi-la de
 * uma comparação que dá falso por acidente.
 *
 * `sec-fetch-site: cross-site` é recusa mesmo com origem batendo: é o próprio
 * navegador dizendo que o pedido nasceu noutro site.
 */
export function origemAceita(entrada: {
  origin: string | null;
  esperada: string;
  doNextUrl: string;
  fetchSite: string | null;
}): boolean {
  const { origin, esperada, doNextUrl, fetchSite } = entrada;
  if (!origin) return false;
  if (fetchSite === "cross-site") return false;
  return origin === esperada || origin === doNextUrl;
}

/**
 * O formato é o exigido?
 *
 * `startsWith` porque o cabeçalho real vem com o charset colado:
 * "application/json; charset=utf-8". Comparar por igualdade recusaria pedidos
 * corretos de navegadores que anexam o charset — que é a maioria.
 */
export function formatoAceito(contentType: string | null, exigeJson: boolean): boolean {
  if (!exigeJson) return true;
  return (contentType ?? "").toLowerCase().startsWith("application/json");
}

/**
 * O tamanho declarado cabe?
 *
 * O cabeçalho ausente vale zero, e zero passa: há rotas que gravam sem corpo.
 *
 * A checagem de "é número finito" também é redundante, e a prova é a mesma:
 * apagá-la não quebra teste nenhum. NaN escapa de "maior que", mas não escapa
 * de `>= 0`, que dá falso — e Infinity não passa do teto. Fica pelo mesmo
 * motivo do `!origin`: dizer a regra em voz alta é melhor do que confiar num
 * acidente aritmético que a próxima pessoa a mexer aqui não tem como adivinhar.
 */
export function tamanhoAceito(contentLength: string | null, maximo = TAMANHO_MAXIMO): boolean {
  const bytes = Number(contentLength ?? "0");
  if (!Number.isFinite(bytes)) return false;
  return bytes >= 0 && bytes <= maximo;
}

export type Tentativas = { count: number; resetAt: number };

export type Veredito =
  | { permitido: true; entrada: Tentativas }
  | { permitido: false; esperarSegundos: number };

/**
 * Quantas vezes já bateram nesta porta dentro da janela.
 *
 * A janela é fixa, e não deslizante: a primeira tentativa marca o fim dela, e
 * quando esse fim passa a contagem recomeça do zero. Janela deslizante seria
 * mais justa e exigiria guardar o horário de cada tentativa — memória por
 * pessoa, num processo que é reciclado a toda hora.
 *
 * O `esperarSegundos` nunca é zero — e nem poderia ser: quando o fim da janela
 * já passou, a função devolve permitido antes de chegar aqui. O `Math.max(1,…)`
 * é cinto sobre suspensório, e está declarado por isso: um `Retry-After: 0`
 * convidaria a repetir na mesma hora, que é o oposto do que o limite faz.
 */
export function contarTentativa(
  atual: Tentativas | undefined,
  agora: number,
  limite: number,
  janelaMs: number,
): Veredito {
  if (!atual || atual.resetAt <= agora) {
    return { permitido: true, entrada: { count: 1, resetAt: agora + janelaMs } };
  }
  if (atual.count >= limite) {
    return { permitido: false, esperarSegundos: Math.max(1, Math.ceil((atual.resetAt - agora) / 1000)) };
  }
  return { permitido: true, entrada: { count: atual.count + 1, resetAt: atual.resetAt } };
}
