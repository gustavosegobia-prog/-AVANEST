"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useCaptcha } from "@/components/turnstile";
import Link from "next/link";
import { codigoDigitado, exigeDuasEtapas } from "@/lib/duas-etapas";

export function LoginForm({ passwordChanged = false, convite = "", plano = "" }: { passwordChanged?: boolean; convite?: string; plano?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tentou, setTentou] = useState(false);
  const [pedeCodigo, setPedeCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");
  // O token vale UMA vez. Depois de uma senha errada, a segunda tentativa
  // precisa de um token NOVO — e o botão espera por ele em vez de enviar sem,
  // que era o que fazia a tela dizer "a verificação de segurança falhou" para
  // quem tinha acabado de digitar a senha certa.
  const captcha = useCaptcha("light");  // o cartão de login é sempre branco, mesmo no tema escuro

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setTentou(true);
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
    // VERIFICAÇÃO EM DUAS ETAPAS. Quem ativou o código entra com a senha numa
    // sessão "aal1", que o banco recusa para tudo. O código vem aqui mesmo,
    // na mesma tela, antes de qualquer outra consulta — inclusive a da
    // assinatura logo abaixo, que voltaria vazia.
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (nivel?.nextLevel === "aal2" && nivel.currentLevel !== "aal2") {
      setPedeCodigo(true);
      setLoading(false);
      return;
    }
    await seguir(entrada.user?.id ?? null);
  }

  async function confirmarCodigo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (codigo.length !== 6) { setError("O código tem 6 dígitos."); return; }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { data: fatores } = await supabase.auth.mfa.listFactors();
    const fator = fatores?.totp.find((f) => f.status === "verified");
    if (!fator) { setLoading(false); setError("Nenhum aplicativo autenticador encontrado nesta conta."); return; }
    const { error: erroDoCodigo } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
    if (erroDoCodigo) {
      setCodigo("");
      setLoading(false);
      setError(/rate|too many/i.test(erroDoCodigo.message)
        ? "Muitas tentativas seguidas. Espere um minuto e tente de novo."
        : "Código incorreto ou vencido. Use o código que está no aplicativo agora — ele muda a cada 30 segundos.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    await seguir(user?.id ?? null);
  }

  async function seguir(userId: string | null) {
    const supabase = createClient();
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
    // QUEM ESTÁ NO TESTE ENTRA NO SISTEMA. Antes esta linha era
    // `["trial","cancelado"].includes(plano)`, e com isso todo mundo em teste
    // caía na tela de pagamento — o "teste grátis" era uma porta fechada, e
    // cada conta precisava ser aberta na mão como cortesia.
    //
    // Agora quem decide é `liberada`, que o banco calcula: plano não cancelado
    // nem suspenso, e dentro da data. Trial com prazo correndo entra; trial
    // vencido vai para a assinatura, como cancelado. Uma regra só, no banco,
    // em vez de uma lista de nomes de plano repetida em três telas.
    //
    // Se a consulta falhar, o painel é o destino seguro — ele já barra sozinho
    // quem está vencido.
    const { data } = await supabase.rpc("minha_assinatura");
    const assinatura = Array.isArray(data) ? data[0] : data;
    const precisaContratar = assinatura ? assinatura.liberada === false : false;
    // Depois de entrar, a pergunta é "onde você vai atender hoje?". Quem
    // trabalha em três hospitais começa cada manhã numa instituição
    // diferente, e o local ativo decide o cabeçalho de todo documento
    // impresso no dia. /locais responde sozinha quando não há o que
    // perguntar: com um local só, ou nenhum, ela segue direto para o painel.
    // A recepção entra direto: ela atende sempre no mesmo lugar, e a pergunta
    // "onde você vai atender hoje?" é do anestesiologista que roda hospitais.
    const { data: quem } = userId
      ? await supabase.from("perfis").select("role, super_admin, permissoes").eq("id", userId).maybeSingle()
      : { data: null };
    const escolheLocal = quem?.role !== "recepcao";
    const destino = precisaContratar ? "/assinatura" : escolheLocal ? "/locais" : "/dashboard";
    // Proprietário e administrador sem o código ativo cadastram agora, antes
    // de entrar. A pergunta é feita aqui porque a conta ainda não tem fator:
    // a consulta do perfil passa.
    const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (exigeDuasEtapas(quem) && nivel?.nextLevel !== "aal2") {
      router.replace(`/duas-etapas?depois=${encodeURIComponent(destino)}`);
      return;
    }
    router.replace(destino);
  }

  if (pedeCodigo) {
    return (
      <form className="loginForm" onSubmit={confirmarCodigo}>
        <p className="loginSuccess" role="status">Senha conferida. Agora o código do aplicativo autenticador do seu celular.</p>
        <label htmlFor="codigo">Código de 6 dígitos</label>
        <input id="codigo" className="duasEtapasCodigo" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]*" placeholder="000000" autoFocus value={codigo}
          onChange={(e) => setCodigo(codigoDigitado(e.target.value))} />
        {error && <p className="loginError" role="alert">{error}</p>}
        <button className="avnLoginSubmit" type="submit" disabled={loading || codigo.length !== 6}>
          {loading ? "Confirmando..." : "Entrar"}
        </button>
        <button type="button" className="avnLoginCancel" onClick={async () => {
          await createClient().auth.signOut();
          setPedeCodigo(false); setCodigo(""); setError("");
        }}>Usar outra conta</button>
      </form>
    );
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
      {/* A recusa do Turnstile só aparece DEPOIS de uma tentativa de entrar.
          Antes disso é alarme falso: o navegador não tem como saber se o
          servidor exige CAPTCHA, e com ele desligado a pessoa entraria sem
          problema nenhum — mas leria um aviso vermelho dizendo que a
          verificação de segurança falhou. Assustar quem vai conseguir entrar é
          pior do que não avisar.

          Depois de falhar, a informação vira a mais útil da tela: é a única
          causa que ninguém adivinha sozinho. */}
      {tentou && captcha.recusa && (
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
