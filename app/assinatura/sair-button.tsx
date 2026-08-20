"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

// O "Sair" da tela de assinatura.
//
// Existe porque antes ele era um <Link href="/login"> — e um link não desloga
// ninguém. Quem estava com a assinatura vencida clicava, o /login via que a
// sessão continuava válida e devolvia para o painel, o painel devolvia para
// cá. A pessoa girava entre três telas sem conseguir trocar de conta, num
// momento em que trocar de conta é justamente o que ela precisa fazer.
//
// Encerrar a sessão de verdade é o que faz a porta abrir.

export function SairButton() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // Falhou falar com o servidor? Sair local ainda é melhor do que ficar
      // preso: o replace abaixo leva para o login de qualquer jeito.
    }
    // replace, e não push: sem isto o "voltar" do navegador traz a pessoa de
    // volta para a tela de bloqueio que ela acabou de deixar.
    router.replace("/login");
  }

  return (
    <button type="button" className="avnLoginCancel" onClick={sair} disabled={saindo}>
      {saindo ? "Saindo..." : "Sair"}
    </button>
  );
}
