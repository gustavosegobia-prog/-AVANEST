"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

export function LoginForm({ passwordChanged = false, convite = "" }: { passwordChanged?: boolean; convite?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (signInError) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }
    // Quem chegou por um convite volta para a tela de aceite.
    router.replace(convite ? `/convite/${encodeURIComponent(convite)}` : "/dashboard");
  }

  return (
    <form className="loginForm" onSubmit={handleSubmit}>
      {passwordChanged && <p className="loginSuccess" role="status">Senha alterada com sucesso. Entre usando a nova senha.</p>}
      <label htmlFor="email">Usuário ou e-mail</label>
      <input id="email" name="email" type="email" autoComplete="email" placeholder="seu.usuario ou e-mail" required />
      <label htmlFor="password">Senha</label>
      <div className="avnPasswordField">
        <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Sua senha" required />
        <button type="button" onClick={() => setShowPassword((value) => !value)}>
          {showPassword ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {error && <p className="loginError" role="alert">{error}</p>}
      <Link className="avnForgotPassword" href="/recuperar-senha">Esqueci minha senha</Link>
      <button className="avnLoginSubmit" type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
