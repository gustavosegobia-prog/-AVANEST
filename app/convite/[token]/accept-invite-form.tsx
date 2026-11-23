"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { AVISO_CELULAR, celularValido } from "@/lib/celular";
import { avisoDoCpf, digitosDoCpf } from "@/lib/cpf";

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

    if (!celularValido(texto("celular"))) { setErro(AVISO_CELULAR); setBusy(false); return; }
    const avisoCpf = avisoDoCpf(texto("cpf"));
    if (avisoCpf) { setErro(avisoCpf); setBusy(false); return; }

    const supabase = createClient();
    const { error } = await supabase.rpc("aceitar_convite", {
      p_token: token,
      p_nome_usuario: texto("nome"),
      p_crm: texto("crm") || null,
      p_rqe: texto("rqe") || null,
    });
    if (error) { setErro(error.message); setBusy(false); return; }
    // Depois do aceite, quando o perfil já é da organização. Falha aqui não trava a entrada.
    await supabase.rpc("definir_meu_celular", { p_celular: texto("celular") });
    await supabase.rpc("definir_meu_cpf", { p_cpf: digitosDoCpf(texto("cpf")) });
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="loginForm" onSubmit={enviar}>
      <label htmlFor="nome">Seu nome completo</label>
      <input id="nome" name="nome" required placeholder="Ex.: Dra. Helena Martins" />
      <label htmlFor="cpf">CPF</label>
      <input id="cpf" name="cpf" required inputMode="numeric" maxLength={14} autoComplete="off"
        placeholder="000.000.000-00" aria-describedby="cpf-dica" />
      <small id="cpf-dica" className="loginDica">Só você vê o seu CPF.</small>
      <label htmlFor="celular">Celular com DDD</label>
      <input id="celular" name="celular" type="tel" inputMode="tel" required autoComplete="tel-national"
        placeholder="Ex.: (41) 99999-9999" />
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
        {busy ? "Entrando…" : "Aceitar convite e entrar"}
      </button>
    </form>
  );
}
