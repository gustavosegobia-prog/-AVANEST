"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

export function SignUpForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmeEmail, setConfirmeEmail] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErro("");
    const form = new FormData(event.currentTarget);
    const senha = String(form.get("senha") ?? "");
    if (senha !== String(form.get("repetir") ?? "")) {
      setErro("As duas senhas não são iguais.");
      setBusy(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: `${window.location.origin}/convite/${encodeURIComponent(token)}` },
    });
    if (error) {
      setErro(
        error.message.toLowerCase().includes("already")
          ? "Já existe uma conta com este e-mail. Volte e use a opção de entrar."
          : error.message,
      );
      setBusy(false);
      return;
    }

    // Com confirmação de e-mail ligada, o Supabase não devolve sessão agora.
    if (!data.session) {
      setConfirmeEmail(true);
      setBusy(false);
      return;
    }
    router.replace(`/convite/${encodeURIComponent(token)}`);
    router.refresh();
  }

  if (confirmeEmail) {
    return (
      <div className="loginForm">
        <p className="loginSuccess" role="status">
          Conta criada. Enviamos um e-mail de confirmação para <b>{email}</b>.
          Abra a mensagem e clique no link para concluir e aceitar o convite.
        </p>
        <Link className="avnLoginCancel" href="/login">Voltar para o login</Link>
      </div>
    );
  }

  return (
    <form className="loginForm" onSubmit={enviar}>
      <label htmlFor="email">E-mail do convite</label>
      <input id="email" value={email} readOnly aria-readonly="true" />
      <small className="avnOnboardingEmail">A conta precisa usar exatamente este e-mail.</small>

      <label htmlFor="senha">Crie uma senha</label>
      <div className="avnPasswordField">
        <input id="senha" name="senha" type={mostrarSenha ? "text" : "password"}
          minLength={8} required autoComplete="new-password" placeholder="Mínimo de 8 caracteres" />
        <button type="button" onClick={() => setMostrarSenha((v) => !v)}>
          {mostrarSenha ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      <label htmlFor="repetir">Repita a senha</label>
      <input id="repetir" name="repetir" type={mostrarSenha ? "text" : "password"}
        minLength={8} required autoComplete="new-password" />

      {erro && <p className="loginError" role="alert">{erro}</p>}
      <button className="avnLoginSubmit" type="submit" disabled={busy}>
        {busy ? "Criando..." : "Criar conta e continuar"}
      </button>
      <Link className="avnLoginCancel" href={`/login?convite=${encodeURIComponent(token)}`}>
        Já tenho conta — entrar
      </Link>
    </form>
  );
}
