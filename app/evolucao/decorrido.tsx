"use client";

import { useEffect, useState } from "react";

const formatar = (ms: number) => {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h} h ${String(resto).padStart(2, "0")}` : `${h} h`;
};

// Há quanto tempo a ficha está aberta, andando sozinho enquanto a lista fica
// na tela. Começa no "agora" do servidor, para o primeiro desenho bater com o
// HTML que veio pronto, e passa ao relógio do aparelho logo depois.
export function Decorrido({ desde, agoraDoServidor }: { desde: string; agoraDoServidor: number }) {
  const [agora, setAgora] = useState(agoraDoServidor);
  useEffect(() => {
    const andar = () => setAgora(Date.now());
    const primeiro = setTimeout(andar, 0);
    const relogio = setInterval(andar, 30_000);
    return () => { clearTimeout(primeiro); clearInterval(relogio); };
  }, []);
  return <time dateTime={desde}>{formatar(agora - new Date(desde).getTime())}</time>;
}
