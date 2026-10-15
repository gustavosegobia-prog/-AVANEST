"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Pergunta de novo ao servidor a cada poucos segundos, por um minuto.
 *
 * Quem acabou de cadastrar o cartão volta do Stripe antes de o aviso do
 * checkout chegar ao banco — uma diferença de segundos. Sem isto a tela ficaria
 * parada em "confirmando", e a pessoa clicaria em voltar ao sistema e seria
 * mandada de novo para o pagamento. Com isto, a página se atualiza sozinha e
 * mostra "acesso liberado" assim que o banco souber.
 */
export function AtualizarSozinho({ segundos = 4, vezes = 15 }: { segundos?: number; vezes?: number }) {
  const router = useRouter();
  useEffect(() => {
    let feitas = 0;
    const id = window.setInterval(() => {
      feitas += 1;
      router.refresh();
      if (feitas >= vezes) window.clearInterval(id);
    }, segundos * 1000);
    return () => window.clearInterval(id);
  }, [router, segundos, vezes]);
  return null;
}
