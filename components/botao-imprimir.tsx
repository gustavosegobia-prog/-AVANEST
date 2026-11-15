"use client";

// O único pedaço de cliente da página da ficha: o botão que abre a impressão.
// O modelo em si é HTML do servidor — o buscador lê os campos, e quem desligou
// o JavaScript ainda imprime pelo menu do navegador.
//
// `alvo`: a página tem duas folhas (intraoperatório e pré-anestésica). O botão
// marca no <html> qual delas imprimir, e o CSS de impressão (site.css, "fichaModelo")
// esconde a outra. Sem a marca — impressão pelo menu do navegador — saem as duas,
// cada uma na sua folha.
export function BotaoImprimir({ rotulo, className = "avnPrimary", alvo }: {
  rotulo: string;
  className?: string;
  alvo?: "pre" | "intra";
}) {
  function imprimir() {
    const raiz = document.documentElement;
    if (alvo) {
      raiz.dataset.imprimir = alvo;
      window.addEventListener("afterprint", () => { delete raiz.dataset.imprimir; }, { once: true });
    }
    window.print();
  }
  return (
    <button type="button" className={className} onClick={imprimir}>
      {rotulo}
    </button>
  );
}
