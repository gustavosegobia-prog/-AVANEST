"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

// Dois modos. Com token, o e-mail vem do convite e não pode ser trocado — a
// conta precisa nascer no endereço convidado. Com plano, o visitante digita o
// próprio e-mail e segue para escolher individual ou grupo antes de pagar.
export function SignUpForm({ token, email, plano = "" }: { token: string; email: string; plano?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmeEmail, setConfirmeEmail] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const porConvite = Boolean(token);
  const destino = porConvite
    ? `/convite/${encodeURIComponent(token)}`
    : `/comecar${plano ? `?plano=${encodeURIComponent(plano)}` : ""}`;

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErro("");
    const form = new FormData(event.currentTarget);
    const senha = String(form.get("senha") ?? "");
    const endereco = porConvite ? email : String(form.get("email") ?? "").trim();
    if (senha !== String(form.get("repetir") ?? "")) {
      setErro("As duas senhas não são iguais.");
      setBusy(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: endereco,
      password: senha,
      options: { emailRedirectTo: `${window.location.origin}${destino}` },
    });
    if (error) {
      const texto = error.message.toLowerCase();
      setErro(
        texto.includes("already")
          ? "Já existe uma conta com este e-mail. Use a opção de entrar."
          // O cadastro é desligado no painel do Supabase, não no código; sem
          // esta mensagem a pessoa recebe "Signups not allowed" em inglês.
          : texto.includes("signup") && texto.includes("not allowed")
            ? "O cadastro de novas contas está desativado no momento. Fale com o AVANEST pelo WhatsApp."
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
    router.replace(destino);
    router.refresh();
  }

  if (confirmeEmail) {
    return (
      <div className="loginForm">
        <p className="loginSuccess" role="status">
          Conta criada. Enviamos um e-mail de confirmação. Abra a mensagem e clique no link para
          {porConvite ? " concluir e aceitar o convite." : " continuar e concluir a assinatura."}
        </p>
        <Link className="avnLoginCancel" href="/login">Voltar para o login</Link>
      </div>
    );
  }

  return (
    <form className="loginForm" onSubmit={enviar}>
      <label htmlFor="email">{porConvite ? "E-mail do convite" : "Seu e-mail"}</label>
      <input
        id="email" name="email" type="email" required autoComplete="email"
        defaultValue={email} readOnly={porConvite} aria-readonly={porConvite || undefined}
        placeholder={porConvite ? undefined : "voce@exemplo.com.br"}
      />
      {porConvite && <small className="avnOnboardingEmail">A conta precisa usar exatamente este e-mail.</small>}

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
      <Link className="avnLoginCancel" href={porConvite
        ? `/login?convite=${encodeURIComponent(token)}`
        : `/login${plano ? `?plano=${encodeURIComponent(plano)}` : ""}`}>
        Já tenho conta — entrar
      </Link>
    </form>
  );
}
