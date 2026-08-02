"use client";

import { useState } from "react";

// Abre o checkout do Mercado Pago. Vai daqui qual plano se quer, nunca quanto
// custa: o preço é decidido e congelado no banco.
export function AssinarButton({ plano, rotulo }: { plano: string; rotulo: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function assinar() {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/assinatura/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok || !dados?.url) {
        setErro(dados?.error ?? "Não foi possível abrir o pagamento agora.");
        setCarregando(false);
        return;
      }
      window.location.href = dados.url;
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
      setCarregando(false);
    }
  }

  return (
    <>
      {erro && <p className="clinicalError" role="alert">{erro}</p>}
      <button className="avnLoginSubmit" onClick={assinar} disabled={carregando}>
        {carregando ? "Abrindo o Mercado Pago..." : rotulo}
      </button>
    </>
  );
}
