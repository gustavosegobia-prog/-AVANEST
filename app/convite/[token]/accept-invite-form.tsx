"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function AcceptInviteForm({ token, papel }: { token: string; papel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const medico = papel === "Anestesiologista";

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErro("");
    const form = new FormData(event.currentTarget);
    const texto = (campo: string) => String(form.get(campo) ?? "").trim();

    const { error } = await createClient().rpc("aceitar_convite", {
      p_token: token,
      p_nome_usuario: texto("nome"),
      p_crm: texto("crm") || null,
      p_rqe: texto("rqe") || null,
    });
    if (error) { setErro(error.message); setBusy(false); return; }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="loginForm" onSubmit={enviar}>
      <label htmlFor="nome">Seu nome completo</label>
      <input id="nome" name="nome" required placeholder="Ex.: Dra. Helena Martins" />
      {medico && (
        <>
          <label htmlFor="crm">CRM / UF <small className="optionalField">Opcional</small></label>
          <input id="crm" name="crm" placeholder="Ex.: CRM/PR 41235" />
          <label htmlFor="rqe">RQE <small className="optionalField">Opcional</small></label>
          <input id="rqe" name="rqe" placeholder="Ex.: RQE 18422" />
        </>
      )}
      {erro && <p className="loginError" role="alert">{erro}</p>}
      <button className="avnLoginSubmit" type="submit" disabled={busy}>
        {busy ? "Entrando..." : "Aceitar convite e entrar"}
      </button>
    </form>
  );
}
