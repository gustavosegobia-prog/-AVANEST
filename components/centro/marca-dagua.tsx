"use client";

import { useEffect, useState } from "react";
import { pintarDeAzul } from "@/lib/marca-dagua";

/**
 * A marca d'água do hospital no mapa e na TV — só quando o logo combina.
 *
 * A marca é o logo bem claro, misturado ao fundo (multiply): o branco do
 * logo some e fica só o desenho. O logo de fundo ESCURO (texto claro num
 * círculo azul-marinho) faz o contrário — o fundo vira um disco cinza atrás
 * da tela inteira. Antes de mostrar, o logo é lido num quadradinho de 32 px:
 * se o que ele tem de opaco é escuro na média, fica sem marca.
 *
 * O logo que passa é repintado de um azul só, bem clarinho (pintarDeAzul):
 * a mesma marca em qualquer hospital, no tema claro e no escuro. Se o
 * navegador não deixar ler a imagem, vai o logo como veio, misturado.
 */
export function MarcaDagua({ src, className }: { src: string | null; className: string }) {
  const [serve, setServe] = useState<boolean | null>(null);
  const [azul, setAzul] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    let vivo = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!vivo) return;
      const claro = logoClaro(img);
      setServe(claro);
      setAzul(claro ? logoAzul(img) : null);
    };
    img.onerror = () => { if (vivo) setServe(false); };
    img.src = src;
    return () => { vivo = false; };
  }, [src]);

  if (!src || !serve) return null;
  return (
    <div className={className} aria-hidden="true" data-pintado={azul ? "" : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element -- logo enviado pelo hospital, de qualquer tamanho */}
      <img src={azul ?? src} alt="" crossOrigin="anonymous" />
    </div>
  );
}

/** A luminância média do que o logo tem de opaco passa da metade. */
function logoClaro(img: HTMLImageElement): boolean {
  try {
    const lado = 32;
    const canvas = document.createElement("canvas");
    canvas.width = lado;
    canvas.height = lado;
    const g = canvas.getContext("2d");
    if (!g) return true;
    g.drawImage(img, 0, 0, lado, lado);
    const px = g.getImageData(0, 0, lado, lado).data;
    let soma = 0;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      soma += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      n++;
    }
    return n === 0 || soma / n > 0.55;
  } catch {
    // Sem poder ler a imagem (servidor sem permissão de leitura), vale o logo.
    return true;
  }
}

/** O logo repintado de azul, em PNG transparente; até 1200 px no lado maior. */
function logoAzul(img: HTMLImageElement): string | null {
  try {
    const escala = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const largura = Math.max(1, Math.round(img.naturalWidth * escala));
    const altura = Math.max(1, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const g = canvas.getContext("2d");
    if (!g) return null;
    g.drawImage(img, 0, 0, largura, altura);
    const quadro = g.getImageData(0, 0, largura, altura);
    pintarDeAzul(quadro.data);
    g.putImageData(quadro, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
