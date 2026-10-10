"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

/**
 * A verificação em duas etapas, em Minha conta.
 *
 * Mostra se está ativa e leva à tela de cadastro. Desativar só aparece para
 * quem não é obrigado: proprietário e administrador desligariam aqui a única
 * coisa que segura uma senha vazada.
 */
export function DuasEtapasNaConta({ obrigatorio }: { obrigatorio: boolean }) {
  const [ativa, setAtiva] = useState<boolean | null>(null);
  const [fatorId, setFatorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let vivo = true;
    void createClient().auth.mfa.listFactors().then(({ data }) => {
      if (!vivo) return;
      const fator = data?.totp.find((f) => f.status === "verified");
      setAtiva(Boolean(fator));
      setFatorId(fator?.id ?? null);
    });
    return () => { vivo = false; };
  }, []);

  async function desativar() {
    if (!fatorId) return;
    setBusy(true); setMsg("");
    const { error } = await createClient().auth.mfa.unenroll({ factorId: fatorId });
    setBusy(false);
    if (error) { setMsg(`Não foi possível desativar: ${error.message}`); return; }
    setAtiva(false); setFatorId(null);
    setMsg("Verificação desativada. A entrada volta a pedir só a senha.");
  }

  return (
    <section className="contaDuasEtapas" aria-labelledby="conta-duas-etapas">
      <h3 id="conta-duas-etapas">Verificação em duas etapas</h3>
      {ativa === null ? <p>Conferindo…</p> : ativa ? (
        <p><b className="contaDuasEtapasAtiva">● Ativa</b> — a entrada pede o código do aplicativo autenticador do seu celular.
          {obrigatorio && " Obrigatória para quem administra a organização."}</p>
      ) : (
        <p>Desativada. Com ela, quem descobrir a sua senha não entra sem o código do seu celular.</p>
      )}
      {msg && <p className="financeSuccess" role="status">{msg}</p>}
      <div className="patientModalActions">
        {ativa === false && <Link className="primaryClinical compact" href="/duas-etapas?depois=%2Fdashboard">Ativar</Link>}
        {ativa && !obrigatorio && (
          <button type="button" className="outlineClinical" onClick={desativar} disabled={busy}>
            {busy ? "Desativando..." : "Desativar"}
          </button>
        )}
      </div>
    </section>
  );
}
