"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function LoginForm({ passwordChanged = false }: { passwordChanged?: boolean }) {
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
    router.push("/dashboard");
    router.refresh();
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
      <a className="avnForgotPassword" href="/recuperar-senha">Esqueci minha senha</a>
      <button className="avnLoginSubmit" type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
