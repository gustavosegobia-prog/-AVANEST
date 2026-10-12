"use client";

import { useEffect, useRef, useState } from "react";
import { GRAFICO_MAXIMO, GRAFICO_MINIMO, GRAFICO_PADRAO, RegistroImpresso } from "./registro-impresso";

// A FOLHA INTEIRA, COMO NO PAPEL DE REFERÊNCIA.
//
// A ficha de papel (FOLHA DE ANESTESIA, a planilha do Matheus) ocupa o A4 de
// ponta a ponta: o gráfico de pressão leva perto de 30% da página. Aqui o
// gráfico nascia com altura fixa e, quando o resto da folha era curto, sobrava
// uma faixa em branco antes do rodapé. Agora cada folha mede o que sobrou
// entre o último bloco e o rodapé — depois de a fonte carregar, porque é ela
// que decide quantas linhas cada texto ocupa — e o gráfico cresce exatamente
// isso, com uma folga para a diferença entre tela e impressora. E o caminho
// contrário: se a folha passou do A4 (legendas longas, muitos medicamentos),
// o gráfico encolhe o que passou, até um mínimo legível — senão o rodapé ia
// sozinho para uma segunda página.
//
// Quando termina, marca a folha com `data-ajustada`: quem manda imprimir
// (imprimir-ficha.tsx, imprimir-ao-abrir.tsx) espera essa marca.

const PX_POR_MM = 96 / 25.4;
const FOLGA_MM = 4;

type Props = Omit<Parameters<typeof RegistroImpresso>[0], "grafico">;

export function RegistroQueEnche(props: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [grafico, setGrafico] = useState(GRAFICO_PADRAO);
  const [ajustado, setAjustado] = useState(false);

  useEffect(() => {
    let vale = true;
    const medir = (segundaVez = false) => {
      if (!vale) return;
      const folha = caixa.current?.closest<HTMLElement>(".imprFolha");
      const rodape = folha?.querySelector(":scope > .imprRodape");
      const antes = rodape?.previousElementSibling;
      if (folha && rodape && antes) {
        const estilo = getComputedStyle(folha);
        const alvo = parseFloat(estilo.minHeight);
        const conteudo = folha.clientHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom);
        if (alvo && conteudo > alvo + 1) {
          // Passou da folha: encolhe o que passou, mais a folga. A folha é
          // uma só, sempre: se nem o gráfico no mínimo resolve (lista de
          // medicação muito longa), a letra das listas diminui um pouco e a
          // conta é refeita.
          const excessoMm = (conteudo - alvo) / PX_POR_MM + FOLGA_MM;
          if (!segundaVez && GRAFICO_PADRAO - excessoMm < GRAFICO_MINIMO && !folha.classList.contains("imprCompacta")) {
            folha.classList.add("imprCompacta");
            requestAnimationFrame(() => medir(true));
            return;
          }
          setGrafico((g) => Math.max(GRAFICO_MINIMO, Math.round(g - excessoMm)));
        } else {
          const lacuna = parseFloat(estilo.rowGap) || 0;
          const sobraMm = (rodape.getBoundingClientRect().top - antes.getBoundingClientRect().bottom - lacuna) / PX_POR_MM - FOLGA_MM;
          if (sobraMm > 1) setGrafico((g) => Math.min(GRAFICO_MAXIMO, Math.round(g + sobraMm)));
        }
      }
      setAjustado(true);
    };
    (document.fonts?.ready ?? Promise.resolve()).then(() => medir(), () => medir());
    return () => { vale = false; };
  }, []);

  useEffect(() => {
    if (ajustado) caixa.current?.closest(".imprFolha")?.setAttribute("data-ajustada", "1");
  }, [ajustado, grafico]);

  return (
    <div ref={caixa} className="imprRegistroCaixa">
      <RegistroImpresso {...props} grafico={grafico} />
    </div>
  );
}

/** Espera todas as folhas da página terminarem de se ajustar (até 3 s). */
export async function folhasProntas(doc: Document) {
  for (let i = 0; i < 30; i += 1) {
    if (!doc.querySelector(".imprFolha:not([data-ajustada])")) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}
