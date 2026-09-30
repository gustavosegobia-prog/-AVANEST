"use client";

import { useId, useRef } from "react";
import { Icone } from "@/components/icone";
import { useFocoPreso, useTravaDeRolagem } from "@/components/admin-ui";

export { useTravaDeRolagem };

// A janela modal do sistema.
//
// DUAS CAIXAS, e não uma. A de fora desenha o contorno — raio, borda e sombra
// — e NÃO rola (overflow:hidden). A de dentro rola. Quando a própria caixa
// arredondada rolava, a barra de rolagem ocupava a borda direita e os dois
// cantos daquele lado saíam retos; e o fundo dos blocos internos passava por
// cima do contorno. Com a rolagem por dentro, o cabeçalho e o botão de fechar
// ficam sempre à vista e os quatro cantos são iguais em qualquer ponto da
// rolagem.
//
// O recuo é um só (--recuo-modal: 24px; 16px no celular) e mora no corpo: os
// blocos dentro dele não trazem margem lateral própria, e por isso título,
// texto, cartões, campos e botões começam na mesma linha.

export function Janela({
  titulo, subtitulo, onFechar, rodape, children, largura = "media", fecharNoFundo = false,
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  onFechar: () => void;
  rodape?: React.ReactNode;
  children: React.ReactNode;
  largura?: "estreita" | "media" | "larga";
  /** Fechar clicando fora. Desligado por padrão: formulário meio preenchido não some por um clique errado. */
  fecharNoFundo?: boolean;
}) {
  const caixa = useRef<HTMLElement>(null);
  const id = useId();
  useFocoPreso(true, caixa, onFechar);
  useTravaDeRolagem(true);
  return (
    <div className="janelaFundo" role="presentation"
      onMouseDown={(e) => { if (fecharNoFundo && e.target === e.currentTarget) onFechar(); }}>
      <section ref={caixa} className={`janela ${largura}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
        <header className="janelaTopo">
          <div>
            <h2 id={`${id}-t`}>{titulo}</h2>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          <button type="button" className="janelaFechar" onClick={onFechar} aria-label="Fechar">
            <Icone nome="fechar" tamanho={18} />
          </button>
        </header>
        <div className="janelaCorpo">{children}</div>
        {rodape && <div className="janelaRodape">{rodape}</div>}
      </section>
    </div>
  );
}
