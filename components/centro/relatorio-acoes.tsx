"use client";

import { Icone } from "@/components/icone";
import { baixarXLSX, type Celula } from "@/lib/xlsx";
import estilos from "./relatorio.module.css";

/** Imprimir e baixar a planilha: os dois botões do relatório que rodam no navegador. */
export function AcoesDoRelatorio({ planilha, arquivo }: { planilha: Celula[][]; arquivo: string }) {
  return (
    <div className={estilos.acoes}>
      <button type="button" className="outlineClinical compact" onClick={() => window.print()}>
        <Icone nome="imprimir" tamanho={16} /> Imprimir
      </button>
      <button type="button" className="primaryClinical compact" disabled={planilha.length < 2}
        onClick={() => baixarXLSX(arquivo, planilha, "Centro cirúrgico")}>
        <Icone nome="nota" tamanho={16} /> Baixar planilha
      </button>
    </div>
  );
}
