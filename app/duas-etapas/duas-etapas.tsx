"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { codigoDigitado, segredoEmGrupos } from "@/lib/duas-etapas";

const SUPORTE = "https://wa.me/5541997870810?text=" +
  encodeURIComponent("Olá! Perdi o acesso ao código da verificação em duas etapas do AVANEST.");

type Cadastro = { id: string; qr: string; segredo: string; uri: string };

/** A frase para o código recusado — o Supabase responde em inglês. */
function motivo(mensagem: string) {
  if (/invalid|verification failed|expired/i.test(mensagem))
    return "Código incorreto ou vencido. Use o código que está na tela do aplicativo agora — ele muda a cada 30 segundos — e confira se o horário do celular está automático.";
  if (/rate|too many/i.test(mensagem)) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  return `Não foi possível confirmar: ${mensagem}`;
}

export function DuasEtapas({ modo, obrigatorio, depois }: {
  modo: "verificar" | "cadastrar"; obrigatorio: boolean; depois: string;
}) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);

  function seguir() {
    // replace + refresh: a sessão agora é "aal2", e as páginas do servidor
    // precisam ser lidas de novo com ela — o banco recusava a anterior.
    router.replace(depois);
    router.refresh();
  }

  async function gerar() {
    setBusy(true); setErro("");
    const supabase = createClient();
    // Uma tentativa anterior abandonada deixa um fator "não verificado" que
    // não serve para nada e pode atrapalhar o novo. Sai antes.
    const { data: fatores } = await supabase.auth.mfa.listFactors();
    for (const f of fatores?.all ?? []) {
      if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `AVANEST ${new Date().toLocaleString("pt-BR")}`,
      issuer: "AVANEST",
    });
    setBusy(false);
    if (error || !data) { setErro(`Não foi possível gerar o código: ${error?.message ?? "tente de novo"}.`); return; }
    setCadastro({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret, uri: data.totp.uri });
  }

  async function confirmar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (codigo.length !== 6) { setErro("O código tem 6 dígitos."); return; }
    setBusy(true); setErro("");
    const supabase = createClient();
    let factorId = cadastro?.id;
    if (!factorId) {
      const { data } = await supabase.auth.mfa.listFactors();
      factorId = data?.totp.find((f) => f.status === "verified")?.id;
    }
    if (!factorId) { setBusy(false); setErro("Nenhum aplicativo autenticador cadastrado nesta conta."); return; }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
    if (error) { setBusy(false); setCodigo(""); setErro(motivo(error.message)); return; }
    seguir();
  }

  async function sair() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  const campoDoCodigo = (
    <>
      <label htmlFor="codigo">Código de 6 dígitos</label>
      <input id="codigo" className="duasEtapasCodigo" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]*" placeholder="000000" autoFocus value={codigo}
        onChange={(e) => setCodigo(codigoDigitado(e.target.value))} aria-describedby={erro ? "erro-codigo" : undefined} />
      {erro && <p id="erro-codigo" className="loginError" role="alert">{erro}</p>}
    </>
  );

  if (modo === "verificar") {
    return (
      <>
        <h1>Confirme que é você</h1>
        <p>Abra o aplicativo autenticador do seu celular e digite o código do AVANEST.</p>
        <form className="loginForm" onSubmit={confirmar}>
          {campoDoCodigo}
          <button className="avnLoginSubmit" type="submit" disabled={busy || codigo.length !== 6}>
            {busy ? "Confirmando..." : "Confirmar"}
          </button>
        </form>
        <p className="duasEtapasAjuda">
          Perdeu o celular ou trocou de aparelho? <a href={SUPORTE} target="_blank" rel="noreferrer">Fale com o suporte</a> —
          o acesso é refeito depois de confirmarmos quem você é.
        </p>
        <button type="button" className="avnLoginCancel" onClick={sair}>Sair da conta</button>
      </>
    );
  }

  return (
    <>
      <h1>Ative a verificação em duas etapas</h1>
      {obrigatorio
        ? <p>Quem administra a organização enxerga a equipe, a cobrança e os dados de todos os pacientes. Por isso a sua conta precisa de um segundo passo além da senha.</p>
        : <p>Além da senha, a entrada passa a pedir um código do seu celular. Quem descobrir a sua senha não entra sem ele.</p>}

      {!cadastro ? (
        <>
          <ol className="duasEtapasPassos">
            <li>Instale um aplicativo autenticador no celular: <b>Google Authenticator</b>, <b>Microsoft Authenticator</b> ou <b>Authy</b> (grátis).</li>
            <li>Gere o QR code aqui e leia com o aplicativo.</li>
            <li>Digite o código de 6 dígitos que aparecer.</li>
          </ol>
          {erro && <p className="loginError" role="alert">{erro}</p>}
          <button type="button" className="avnLoginSubmit" onClick={gerar} disabled={busy}>
            {busy ? "Gerando..." : "Gerar QR code"}
          </button>
        </>
      ) : (
        <form className="loginForm" onSubmit={confirmar}>
          <div className="duasEtapasQr">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG gerado pelo Supabase, em data URI */}
            <img src={cadastro.qr} alt="QR code para o aplicativo autenticador" width={196} height={196} />
            <div>
              <p>Leia este QR code com o aplicativo autenticador.</p>
              <p className="duasEtapasAjuda">
                Está no celular? <a href={cadastro.uri}>Abrir no aplicativo</a>. Ou digite esta chave no aplicativo:
              </p>
              <code className="duasEtapasSegredo">{segredoEmGrupos(cadastro.segredo)}</code>
            </div>
          </div>
          {campoDoCodigo}
          <button className="avnLoginSubmit" type="submit" disabled={busy || codigo.length !== 6}>
            {busy ? "Ativando..." : "Confirmar e ativar"}
          </button>
        </form>
      )}

      {obrigatorio
        ? <button type="button" className="avnLoginCancel" onClick={sair}>Sair da conta</button>
        : <button type="button" className="avnLoginCancel" onClick={() => router.replace(depois)}>Agora não</button>}
    </>
  );
}
