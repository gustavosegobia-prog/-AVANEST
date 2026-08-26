"use client";

import { useCallback, useEffect, useState } from "react";
import { Icone } from "@/components/icone";

/**
 * Esconder os números da tela.
 *
 * A escala e o faturamento são abertos no corredor do centro cirúrgico, na
 * recepção, na sala de café — com gente ao lado. O que se esconde é quanto se
 * recebe e quanto se trabalhou; os rótulos ficam, porque cartão em branco não
 * diz o que está escondido e a pessoa mostra tudo de novo só para lembrar o
 * que era.
 *
 * Mora no APARELHO, e não na conta. É sobre quem está olhando por cima do
 * ombro agora, não sobre quem está logado: por isso localStorage, e por isso
 * a mesma chave para todas as telas — escondeu numa, escondeu em todas, que é
 * o que a pessoa espera de um interruptor.
 *
 * Todo acesso vai dentro de try/catch. Aba anônima, navegador com dados de
 * site bloqueados e algumas capturas de tela fazem o acesso lançar exceção, e
 * uma tela de escala não pode cair por causa disso — no pior caso os números
 * ficam à vista, que é o estado de sempre.
 */
const CHAVE = "avanest_esconder_valores";

export function useValoresOcultos() {
  const [oculto, setOculto] = useState(false);

  // Lido depois da montagem, e não no useState inicial, porque estas telas são
  // renderizadas no servidor: lá localStorage não existe, e inicializar por ele
  // faria o HTML do servidor discordar do primeiro render do navegador.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado do aparelho, só existe depois de montar
    try { setOculto(localStorage.getItem(CHAVE) === "1"); } catch { /* segue à vista */ }
  }, []);

  const alternar = useCallback((esconder: boolean) => {
    setOculto(esconder);
    try { localStorage.setItem(CHAVE, esconder ? "1" : "0"); } catch { /* só nesta sessão */ }
  }, []);

  /** O valor, ou os pontinhos. */
  const mascara = useCallback((texto: string) => (oculto ? "•••" : texto), [oculto]);

  return { oculto, alternar, mascara };
}

/**
 * O botão.
 *
 * Só o ícone, no canto inferior do último cartão da fileira. Com texto ao lado
 * ele subia para o topo e passava por cima do próprio valor que existe para
 * esconder. O que ele faz está no title e no aria-label.
 *
 * O desenho é SVG, e não emoji. Aqui moravam 👁 e 🙈 — e o macaco que tapa os
 * olhos, ao lado de "R$ 12.400,00 a receber", lê como piada num sistema que
 * trata de saúde e de dinheiro. Emoji também não é ilustração confiável: cada
 * sistema desenha o seu, e o mesmo botão saía diferente no iPhone, no Android e
 * no Windows. O traço vem do mesmo conjunto do resto da interface e acompanha a
 * cor do texto ao lado.
 */
export function OlhoValores({
  oculto, onAlternar,
}: {
  oculto: boolean;
  onAlternar: (esconder: boolean) => void;
}) {
  const rotulo = oculto ? "Mostrar os números" : "Esconder os números";
  return (
    <button
      type="button" className="plantaoOlho"
      onClick={() => onAlternar(!oculto)}
      aria-pressed={oculto} aria-label={rotulo} title={rotulo}
    >
      <Icone nome={oculto ? "olhoFechado" : "olho"} tamanho={20} />
    </button>
  );
}
