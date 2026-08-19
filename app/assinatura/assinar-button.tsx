"use client";

import { useState } from "react";
import Link from "next/link";

// Abre o checkout do provedor de pagamento. Vai daqui qual plano se quer e o aceite dos
// documentos, nunca quanto custa: o preço é decidido e congelado no banco.
//
// O botão só acende com a caixa marcada, mas quem recusa de verdade é o
// servidor — a trava da tela é conveniência, não garantia.
export function AssinarButton({ plano, rotulo }: { plano: string; rotulo: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aceite, setAceite] = useState(false);

  async function assinar() {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await fetch("/api/assinatura/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano, aceite }),
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
      <label className="aceiteTermos">
        <input
          type="checkbox"
          checked={aceite}
          onChange={(evento) => { setAceite(evento.target.checked); setErro(""); }}
        />
        <span>
          Li e concordo com os <Link href="/termos" target="_blank">Termos de Uso</Link> e a{" "}
          <Link href="/privacidade" target="_blank">Política de Privacidade</Link>.
        </span>
      </label>
      <button className="avnLoginSubmit" onClick={assinar} disabled={carregando || !aceite}>
        {carregando ? "Abrindo o pagamento..." : rotulo}
      </button>
    </>
  );
}
