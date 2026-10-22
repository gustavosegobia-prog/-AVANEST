// O TEMA ESCURO, GUARDADO NO APARELHO.
//
// Antes ele era só um estado da tela do painel: abrir a ficha anestésica (que
// é outra página) ou recarregar o painel devolvia tudo ao claro. Agora a
// escolha fica no localStorage e vira `data-tema="escuro"` no <html> ANTES da
// primeira pintura (roteiro abaixo, posto no app/layout.tsx), e o CSS escurece
// toda página do sistema que tenha `.temaApp` — o painel e as telas da ficha.
// As páginas públicas e a folha de impressão não têm `.temaApp` e continuam
// claras.

export const CHAVE_DO_TEMA = "avanest:tema";

/**
 * O fundo da TV do centro cirúrgico, separado do tema de quem usa o sistema:
 * é escolha do aparelho ligado à TV, e o padrão é o escuro (na TV, branco
 * ofusca). Vira `data-tv-tema="claro"` no <html>, pelo mesmo roteiro.
 */
export const CHAVE_DO_TEMA_DA_TV = "avanest:tv-tema";
const EVENTO_DO_TEMA_DA_TV = "avanest:tv-tema";

/** Roda no <head>, antes de pintar: sem ele a tela piscaria clara a cada página. */
export const ROTEIRO_DO_TEMA =
  `try{if(localStorage.getItem("${CHAVE_DO_TEMA}")==="escuro")document.documentElement.dataset.tema="escuro";` +
  `if(localStorage.getItem("${CHAVE_DO_TEMA_DA_TV}")==="claro")document.documentElement.dataset.tvTema="claro"}catch(e){}`;

export function temaEscuroGuardado(): boolean {
  try { return localStorage.getItem(CHAVE_DO_TEMA) === "escuro"; } catch { return false; }
}

export function guardarTemaEscuro(escuro: boolean) {
  try { localStorage.setItem(CHAVE_DO_TEMA, escuro ? "escuro" : "claro"); } catch { /* sem armazenamento: vale só nesta página */ }
  if (escuro) document.documentElement.dataset.tema = "escuro";
  else delete document.documentElement.dataset.tema;
}

/** A TV está de fundo claro? Lê o que o roteiro (ou a última troca) pôs no <html>. */
export const tvClara = () => document.documentElement.dataset.tvTema === "claro";

/** Avisa quem mostra o botão de troca (useSyncExternalStore) quando o fundo da TV muda. */
export function assinarTemaDaTv(aviso: () => void) {
  window.addEventListener(EVENTO_DO_TEMA_DA_TV, aviso);
  return () => window.removeEventListener(EVENTO_DO_TEMA_DA_TV, aviso);
}

export function guardarTvClara(clara: boolean) {
  try { localStorage.setItem(CHAVE_DO_TEMA_DA_TV, clara ? "claro" : "escuro"); } catch { /* sem armazenamento: vale só nesta página */ }
  if (clara) document.documentElement.dataset.tvTema = "claro";
  else delete document.documentElement.dataset.tvTema;
  window.dispatchEvent(new Event(EVENTO_DO_TEMA_DA_TV));
}
