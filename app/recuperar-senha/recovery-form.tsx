"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function RecoveryForm({ invalidLink = false }: { invalidLink?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(invalidLink ? "O link expirou ou é inválido. Solicite um novo e-mail." : "");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const redirectTo = `${window.location.origin}/auth/callback?next=/atualizar-senha`;
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (resetError) {
      setError("Não foi possível enviar agora. Confira o e-mail e tente novamente em alguns minutos.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="recoveryConfirmation" role="status">
        <strong>Confira seu e-mail</strong>
        <p>Se esse endereço estiver cadastrado, você receberá o link para criar uma nova senha. Verifique também a pasta de spam.</p>
      </div>
    );
  }

  return (
    <form className="loginForm" onSubmit={handleSubmit}>
      <label htmlFor="recovery-email">E-mail cadastrado</label>
      <input id="recovery-email" name="email" type="email" autoComplete="email" placeholder="seu e-mail" required />
      {error && <p className="loginError" role="alert">{error}</p>}
      <button className="avnLoginSubmit" type="submit" disabled={loading}>
        {loading ? "Enviando..." : "Enviar link de recuperação"}
      </button>
    </form>
  );
}
