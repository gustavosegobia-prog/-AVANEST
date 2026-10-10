"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { temCodigoNaUrl } from "@/lib/troca-do-codigo";
import { senhaRecusada } from "@/lib/senha-recusada";
import { sessaoVeioDeRecuperacao } from "@/lib/sessao-de-recuperacao";

// A mensagem antiga era "Este link expirou ou já foi utilizado", e ela MENTIA
// no caso mais comum: quem pede vários e-mails fica com vários pedidos abertos
// disputando o mesmo comprovante no navegador, e só o do último e-mail casa.
// O link dos anteriores está íntegro — ele só não é o que o navegador sabe
// abrir. Mandar essa pessoa "solicitar um novo link" era mandá-la repetir
// exatamente o que a travou.
const LINK_INVALIDO =
  "Não conseguimos validar este link. Se você pediu mais de um e-mail, abra o link do ÚLTIMO que chegou — só o mais recente funciona.";

/**
 * ESTA TELA É SÓ PARA QUEM CHEGOU PELO E-MAIL.
 *
 * Ela pedia apenas que HOUVESSE uma sessão, e trocava a senha. Num computador
 * compartilhado — o normal no hospital — quem encontrasse o navegador aberto
 * podia abrir este endereço e ficar com a conta do médico para sempre.
 *
 * Quem está logado e quer trocar a senha tem outro caminho, e ele PEDE a senha
 * atual. Por isso a frase manda para lá em vez de mandar pedir outro link:
 * pedir link a quem já está dentro é empurrar para o caminho errado.
 */
const SEM_RECUPERACAO =
  "Esta tela é só para quem chegou pelo link do e-mail de recuperação. "
  + "Para trocar a senha com a conta já aberta, use Minha conta → Alterar senha — "
  + "lá a senha atual é pedida.";

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
    // O QUE MUDOU: não basta HAVER sessão — ela precisa ter nascido de um link
    // de recuperação. O Supabase registra isso no próprio token (`amr`), e é
    // um sinal assinado por ele: ver lib/sessao-de-recuperacao.ts.
    const { data: assinatura } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      if (sessaoVeioDeRecuperacao(sessao?.access_token)) liberar();
    });

    // Quando o servidor não conseguiu trocar o código, ele o repassa para cá
    // (ver lib/troca-do-codigo.ts) e quem termina é o cliente do Supabase desta
    // página, sozinho, ao carregar. Isso é uma IDA À REDE, e no 4G do plantão
    // ela não cabe em um segundo e meio: com a espera curta a tela acusava
    // "link inválido" enquanto a troca ainda estava no ar — e o link estava bom.
    const comCodigo = temCodigoNaUrl(window.location.search);
    const prazo = comCodigo ? 15000 : 1500;

    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      if (sessaoVeioDeRecuperacao(data.session?.access_token)) return liberar();
      espera = setTimeout(async () => {
        if (!ativo) return;
        const { data: segundaTentativa } = await supabase.auth.getSession();
        if (!ativo) return;
        if (sessaoVeioDeRecuperacao(segundaTentativa.session?.access_token)) return liberar();
        setChecking(false);
        setLinkInvalido(true);
        // DUAS RECUSAS DIFERENTES, e confundi-las manda a pessoa para o lugar
        // errado. Sem sessão nenhuma é link que não abriu — peça outro. COM
        // sessão que não veio de recuperação é alguém já logado nesta tela: o
        // caminho dele é Minha conta, que pede a senha atual.
        setError(segundaTentativa.session ? SEM_RECUPERACAO : LINK_INVALIDO);
      }, prazo);
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
      // Senha fraca ou vazada não é link vencido: mandar pedir outro link faria
      // a pessoa refazer tudo e esbarrar na mesma senha.
      setError(senhaRecusada(updateError) ?? "Não foi possível alterar a senha. Solicite um novo link de recuperação.");
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
