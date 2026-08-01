"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const LINK_INVALIDO = "Este link expirou ou já foi utilizado. Solicite um novo link de recuperação.";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;

    function liberar() {
      if (!ativo) return;
      setChecking(false);
      setLinkInvalido(false);
      setError("");
    }

    // Quando a sessão vem no fragmento da URL, o cliente do Supabase precisa de
    // um instante para lê-la. Perguntar na hora acusaria "link expirado" antes
    // de o navegador terminar de entrar, que era o defeito antigo.
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (sessao) liberar();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      if (data.session) return liberar();
      espera = setTimeout(async () => {
        if (!ativo) return;
        const { data: segundaTentativa } = await supabase.auth.getSession();
        if (!ativo) return;
        if (segundaTentativa.session) return liberar();
        setChecking(false);
        setLinkInvalido(true);
        setError(LINK_INVALIDO);
      }, 1500);
    });

    return () => {
      ativo = false;
      if (espera) clearTimeout(espera);
      assinatura.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 8) {
      setError("A nova senha precisa ter pelo menos oito caracteres.");
      setLoading(false);
      return;
    }
    if (password !== confirmation) {
      setError("As duas senhas não são iguais.");
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Não foi possível alterar a senha. Solicite um novo link de recuperação.");
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    router.replace("/login?senha=alterada");
    router.refresh();
  }

  return (
    <form className="loginForm" onSubmit={handleSubmit}>
      <label htmlFor="new-password">Nova senha</label>
      <div className="avnPasswordField">
        <input id="new-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Nova senha" minLength={8} required disabled={checking || linkInvalido} />
        <button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? "Ocultar" : "Mostrar"}</button>
      </div>
      <label htmlFor="password-confirmation">Confirme a nova senha</label>
      <input id="password-confirmation" name="confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Digite novamente" minLength={8} required disabled={checking || linkInvalido} />
      {error && <p className="loginError" role="alert">{error}</p>}
      <button className="avnLoginSubmit" type="submit" disabled={loading || checking || linkInvalido}>
        {loading ? "Alterando..." : checking ? "Validando link..." : "Salvar nova senha"}
      </button>
      <a className="avnLoginCancel" href="/recuperar-senha">Solicitar outro link</a>
    </form>
  );
}
