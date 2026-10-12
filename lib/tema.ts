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

/** Roda no <head>, antes de pintar: sem ele a tela piscaria clara a cada página. */
export const ROTEIRO_DO_TEMA =
  `try{if(localStorage.getItem("${CHAVE_DO_TEMA}")==="escuro")document.documentElement.dataset.tema="escuro"}catch(e){}`;

export function temaEscuroGuardado(): boolean {
  try { return localStorage.getItem(CHAVE_DO_TEMA) === "escuro"; } catch { return false; }
}

export function guardarTemaEscuro(escuro: boolean) {
  try { localStorage.setItem(CHAVE_DO_TEMA, escuro ? "escuro" : "claro"); } catch { /* sem armazenamento: vale só nesta página */ }
  if (escuro) document.documentElement.dataset.tema = "escuro";
  else delete document.documentElement.dataset.tema;
}
