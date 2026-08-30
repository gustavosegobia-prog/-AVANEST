"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useCaptcha } from "@/components/turnstile";
import Link from "next/link";

export function LoginForm({ passwordChanged = false, convite = "", plano = "" }: { passwordChanged?: boolean; convite?: string; plano?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // O token vale UMA vez. Depois de uma senha errada, a segunda tentativa
  // precisa de um token NOVO — e o botão espera por ele em vez de enviar sem,
  // que era o que fazia a tela dizer "a verificação de segurança falhou" para
  // quem tinha acabado de digitar a senha certa.
  const captcha = useCaptcha();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    // Espera o token aqui, e não travando o botão: se ele não vier, seguimos
    // e o servidor diz o motivo. Botão preso não tem saída.
    const marca = await captcha.esperarToken();
    const { data: entrada, error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      options: marca ? { captchaToken: marca } : undefined,
    });
    if (signInError) {
      // A recusa do CAPTCHA é dita com todas as letras. Escondê-la atrás de
      // "senha inválida" mandaria a pessoa trocar uma senha que estava certa.
      // Quando o Turnstile recusou, a razão DELE vale mais do que a do
      // Supabase: o servidor só sabe dizer "faltou o token", e o navegador
      // sabe por quê o token não existiu.
      setError(/captcha/i.test(signInError.message)
        ? "A verificação de segurança falhou. Tente de novo em alguns segundos."
        : "E-mail ou senha inválidos.");
      captcha.reiniciar();
      setLoading(false);
      return;
    }
    // Quem chegou por um convite volta para a tela de aceite.
    if (convite) {
      router.replace(`/convite/${encodeURIComponent(convite)}`);
      return;
    }
    // Quem veio da vitrine para contratar segue para o plano escolhido.
    if (plano) {
      router.replace(`/comecar?plano=${encodeURIComponent(plano)}`);
      return;
    }
    // Quem ainda não contratou entra pela tela de assinatura, não pelo painel:
    // é ali que está o pagamento, e o "Voltar ao sistema" continua disponível
    // para quem só quer usar o trial. Cortesia e plano pago vão direto ao
    // painel. Se a consulta falhar, o painel é o destino seguro — ele já
    // barra sozinho quem está vencido.
    const { data } = await supabase.rpc("minha_assinatura");
    const assinatura = Array.isArray(data) ? data[0] : data;
    const precisaContratar = ["trial", "cancelado"].includes(String(assinatura?.plano ?? ""));
    // Depois de entrar, a pergunta é "onde você vai atender hoje?". Quem
    // trabalha em três hospitais começa cada manhã numa instituição
    // diferente, e o local ativo decide o cabeçalho de todo documento
    // impresso no dia. /locais responde sozinha quando não há o que
    // perguntar: com um local só, ou nenhum, ela segue direto para o painel.
    // A recepção entra direto: ela atende sempre no mesmo lugar, e a pergunta
    // "onde você vai atender hoje?" é do anestesiologista que roda hospitais.
    const { data: quem } = entrada.user
      ? await supabase.from("perfis").select("role").eq("id", entrada.user.id).maybeSingle()
      : { data: null };
    const escolheLocal = quem?.role !== "recepcao";
    router.replace(precisaContratar ? "/assinatura" : escolheLocal ? "/locais" : "/dashboard");
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
      {captcha.widget}
      {/* A recusa do Turnstile aparece SEMPRE que existe, e não só quando não
          há outro erro. Escondê-la atrás de "e-mail ou senha inválidos" foi um
          engano: são causas independentes, as duas podem estar acontecendo ao
          mesmo tempo, e a do CAPTCHA é a única que a pessoa não tem como
          adivinhar sozinha. */}
      {captcha.recusa && (
        <p className="loginError" role="alert">Verificação de segurança: {captcha.recusa}.</p>
      )}
      {error && <p className="loginError" role="alert">{error}</p>}
      <Link className="avnForgotPassword" href="/recuperar-senha">Esqueci minha senha</Link>
      <button className="avnLoginSubmit" type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
