"use client";

// O único pedaço de cliente da página da ficha: o botão que abre a impressão.
// O modelo em si é HTML do servidor — o buscador lê os campos, e quem desligou
// o JavaScript ainda imprime pelo menu do navegador.
export function BotaoImprimir({ rotulo }: { rotulo: string }) {
  return (
    <button type="button" className="avnPrimary" onClick={() => window.print()}>
      {rotulo}
    </button>
  );
}
