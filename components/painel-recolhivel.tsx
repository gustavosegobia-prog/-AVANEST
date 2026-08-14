"use client";

import { ReactNode } from "react";
import { Icone } from "@/components/icone";

/**
 * Um painel que recolhe, e que lembra a escolha de quem recolheu.
 *
 * O padrão já existia solto em três lugares — auditoria, valores por convênio,
 * extrato de pagamentos —, cada um repetindo o mesmo <details> com o mesmo
 * <summary> e a mesma setinha desenhada com um caractere. Aqui vira um lugar
 * só, e ganha o que faltava nos três: memória. Quem fecha o Faturamento por
 * convênio na segunda-feira não quer reabrir e refechar toda vez que entra no
 * Financeiro.
 *
 * É <details> de verdade, e não um div com onClick: clique, Enter, Espaço e o
 * anúncio de "recolhido/expandido" para o leitor de tela vêm do elemento. Nada
 * disso precisaria ser reescrito à mão, e à mão sairia pior.
 */
export function PainelRecolhivel({
  chave,
  titulo,
  legenda,
  extra,
  abrePadrao = true,
  className = "",
  classeCabecalho = "panelTitle",
  children,
}: {
  /** Identidade do painel no armazenamento local. Precisa ser estável. */
  chave: string;
  titulo: ReactNode;
  legenda?: ReactNode;
  /** Vai à direita, antes da seta — um total, uma contagem, um selo. */
  extra?: ReactNode;
  abrePadrao?: boolean;
  className?: string;
  /**
   * A barra do painel usa `panelTitle` em quase todo lugar. Os grupos por
   * convênio do Financeiro têm barra própria, com o total à direita — por
   * isso a classe é trocável em vez de fixa.
   */
  classeCabecalho?: string;
  children: ReactNode;
}) {
  return (
    <details
      className={`clinicalPanel painelRecolhivel ${className}`.trim()}
      ref={(elemento) => aplicarEscolha(elemento, chave, abrePadrao)}
      onToggle={(evento) => guardarEscolha(chave, evento.currentTarget.open)}
    >
      <summary className={classeCabecalho}>
        <strong>{titulo}</strong>
        {legenda && <span>{legenda}</span>}
        {/* Sempre presente, mesmo vazio: é a margem automática dele que empurra
            o conteúdo da direita — e a seta atrás — para a borda. Sem esta
            caixa, um painel sem `extra` deixaria a seta encostada no texto. */}
        <span className="painelExtra">{extra}</span>
        <Icone nome="seta" tamanho={16} className="painelSeta" />
      </summary>
      {children}
    </details>
  );
}

const PREFIXO = "avanest:painel:";

/**
 * Aplica a escolha salva antes de o navegador pintar.
 *
 * É função de ref, e não useEffect, de propósito: a de ref roda no commit,
 * antes da pintura, então o painel já nasce no estado certo. Um useEffect
 * abriria e fecharia à vista de quem está olhando.
 */
function aplicarEscolha(elemento: HTMLDetailsElement | null, chave: string, abrePadrao: boolean) {
  if (!elemento) return;
  try {
    const guardado = window.localStorage.getItem(PREFIXO + chave);
    elemento.open = guardado === null ? abrePadrao : guardado === "aberto";
  } catch {
    // Aba privada, ou armazenamento bloqueado pela política do aparelho: vale
    // o padrão. Não se derruba um painel inteiro por causa da memória de uma
    // preferência de layout.
    elemento.open = abrePadrao;
  }
}

function guardarEscolha(chave: string, aberto: boolean) {
  try {
    window.localStorage.setItem(PREFIXO + chave, aberto ? "aberto" : "fechado");
  } catch {
    // Sem onde guardar, a escolha vale só para esta visita.
  }
}
