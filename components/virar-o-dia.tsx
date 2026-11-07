"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dataLocal } from "@/lib/data-local";

// A tela que fica aberta vira o dia sozinha (07/11/2026: "deu meia-noite, tem
// que sair tudo esses daí para aparecer o dia de amanhã"). O mapa do centro
// cirúrgico fica ligado na TV do balcão e a entrada da ficha no celular; as
// duas listas são montadas no servidor com o dia de quando a tela abriu, e
// sem isto passavam a madrugada mostrando o dia de ontem.
//
// A cada 30 s, e ao voltar para a aba, compara o dia de agora (no fuso do
// serviço, lib/data-local.ts) com o dia da tela. Mudou: `aoVirar` (o padrão é
// pedir a página de novo ao servidor, que já monta o dia novo).
export function useVirarODia(dia: string, aoVirar?: () => void, ligado = true) {
  const router = useRouter();
  useEffect(() => {
    if (!ligado) return;
    const conferir = () => {
      if (dataLocal() === dia) return;
      if (aoVirar) aoVirar();
      else router.refresh();
    };
    const id = window.setInterval(conferir, 30_000);
    const aoVoltar = () => { if (document.visibilityState === "visible") conferir(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [dia, aoVirar, ligado, router]);
}

/** Para uma página do servidor: só vira o dia, não desenha nada. */
export function VirarODia({ dia }: { dia: string }) {
  useVirarODia(dia);
  return null;
}
