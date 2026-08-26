"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Escolha = "individual" | "grupo" | "convite";

const OPCOES: Array<{ valor: Escolha; titulo: string; descricao: string }> = [
  { valor: "individual", titulo: "Sou anestesiologista individual",
    descricao: "Crio minha própria organização e trabalho sozinho." },
  { valor: "grupo", titulo: "Vou criar um grupo",
    descricao: "Crio a organização do grupo e convido a equipe depois." },
  { valor: "convite", titulo: "Recebi um convite",
    descricao: "Já faço parte de um grupo e tenho um link ou código." },
];

export function OnboardingForm({ email, plano = "" }: { email: string; plano?: string }) {
  const router = useRouter();
  const [escolha, setEscolha] = useState<Escolha>("individual");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErro("");
    const form = new FormData(event.currentTarget);
    const texto = (campo: string) => String(form.get(campo) ?? "").trim();

    if (escolha === "convite") {
      // Aceita tanto o link inteiro quanto só o código.
      const informado = texto("token");
      const token = informado.split("/").filter(Boolean).pop() ?? "";
      if (!token) { setErro("Cole o link ou o código do convite."); setBusy(false); return; }
      router.push(`/convite/${encodeURIComponent(token)}`);
      return;
    }

    const { error } = await createClient().rpc("criar_organizacao", {
      p_tipo: escolha,
      p_nome_organizacao: escolha === "grupo" ? texto("organizacao") : null,
      p_nome_usuario: texto("nome"),
      p_crm: texto("crm") || null,
      p_rqe: texto("rqe") || null,
    });
    if (error) { setErro(error.message); setBusy(false); return; }
    // Quem chegou da vitrine com um plano segue direto para o pagamento; os
    // demais entram no trial e decidem depois. Sem isso, quem acabou de
    // escolher um plano cairia no painel e teria de procurar onde pagar.
    router.replace(plano ? `/assinatura?plano=${encodeURIComponent(plano)}` : "/dashboard");
    router.refresh();
  }

  return (
    <form className="loginForm avnOnboarding" onSubmit={enviar}>
      <p className="avnOnboardingEmail">Conta: <b>{email}</b></p>

      <div className="avnOnboardingChoices">
        {OPCOES.map((opcao) => (
          <label key={opcao.valor} className={escolha === opcao.valor ? "selected" : ""}>
            <input type="radio" name="escolha" value={opcao.valor}
              checked={escolha === opcao.valor}
              onChange={() => { setEscolha(opcao.valor); setErro(""); }} />
            <span><b>{opcao.titulo}</b><small>{opcao.descricao}</small></span>
          </label>
        ))}
      </div>

      {escolha === "convite" ? (
        <>
          <label htmlFor="token">Link ou código do convite</label>
          <input id="token" name="token" required autoComplete="off"
            placeholder="Cole aqui o link que você recebeu" />
        </>
      ) : (
        <>
          {escolha === "grupo" && (
            <>
              <label htmlFor="organizacao">Nome do grupo</label>
              <input id="organizacao" name="organizacao" required
                placeholder="Ex.: Grupo de Anestesia São Lucas" />
            </>
          )}
          <label htmlFor="nome">Seu nome completo</label>
          <input id="nome" name="nome" required placeholder="Ex.: Dra. Helena Martins" />
          <label htmlFor="crm">CRM / UF <small className="optionalField">Opcional</small></label>
          <input id="crm" name="crm" placeholder="Ex.: CRM/PR 41235" />
          <label htmlFor="rqe">RQE <small className="optionalField">Opcional</small></label>
          <input id="rqe" name="rqe" placeholder="Ex.: RQE 18422" />
        </>
      )}

      {erro && <p className="loginError" role="alert">{erro}</p>}
      <button className="avnLoginSubmit" type="submit" disabled={busy}>
        {busy ? "Criando..."
          : escolha === "convite" ? "Continuar"
          : plano ? "Criar organização e ir para o pagamento"
          : "Criar organização e entrar"}
      </button>
    </form>
  );
}
