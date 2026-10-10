"use client";

import { Icone } from "@/components/icone";

/**
 * O retorno de uma ação — erro ou confirmação — onde a pessoa está olhando.
 *
 * No computador ele fica no fluxo da página, como sempre. No celular ele flutua
 * no pé da tela (ver `.avisoFlutuante` em globals.css): quem tocou em
 * "Registrar chegada" na décima linha da agenda não via a mensagem, que saía
 * no topo, uma tela e meia acima. O X fecha; a próxima ação também limpa.
 */
export function AvisoFlutuante({ tipo, texto, onFechar }: {
  tipo: "erro" | "ok"; texto: string; onFechar?: () => void;
}) {
  return (
    <p className={`${tipo === "erro" ? "clinicalError" : "financeSuccess"} avisoFlutuante`} role={tipo === "erro" ? "alert" : "status"}>
      <span>{texto}</span>
      {onFechar && (
        <button type="button" className="avisoFechar" aria-label="Fechar aviso" onClick={onFechar}>
          <Icone nome="fechar" tamanho={14} />
        </button>
      )}
    </p>
  );
}
