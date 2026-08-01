import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { AssinarButton } from "./assinar-button";

const WHATSAPP = "https://wa.me/5544998143820";

const MOTIVOS: Record<string, string> = {
  trial: "Seu período de teste terminou.",
  ativo: "Sua assinatura venceu.",
  suspenso: "Sua assinatura está suspensa.",
  cancelado: "Sua assinatura foi cancelada.",
  cortesia: "Seu período de cortesia terminou.",
};

const dinheiro = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (valor: string | null) =>
  valor ? new Date(valor).toLocaleDateString("pt-BR") : null;

export default async function AssinaturaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: resultado } = await supabase.rpc("minha_assinatura");
  const assinatura = Array.isArray(resultado) ? resultado[0] : resultado;
  if (!assinatura) redirect("/comecar");

  const { data: perfil } = await supabase
    .from("perfis").select("role").eq("id", user.id).maybeSingle();
  const podeContratar = ["owner", "admin"].includes(String(perfil?.role ?? ""));

  const liberada = assinatura.liberada === true;
  const profissionais = Number(assinatura.profissionais ?? 0);
  const mensal = Number(assinatura.valor_mensal ?? 0);
  const ate = data(assinatura.assinatura_ate ?? null);
  const plano = String(assinatura.plano ?? "");

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnOnboardingCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>
            {liberada
              ? "Sua organização está em dia. Você pode contratar a assinatura mensal a qualquer momento — os dias que ainda restam são somados, não perdidos."
              : "Seus dados continuam guardados e intactos. Nada é apagado enquanto a assinatura estiver parada."}
          </p>
        </div>
        <div className="avnLoginContent">
          <h1>
            {liberada
              ? plano === "trial" ? "Você está no teste grátis." : "Sua assinatura está ativa."
              : MOTIVOS[plano] ?? "Assinatura inativa."}
          </h1>
          <p>
            {liberada
              ? <>Acesso liberado em <b>{assinatura.organizacao}</b>{ate ? <> até <b>{ate}</b></> : null}.</>
              : <>Para continuar usando o AVANEST em <b>{assinatura.organizacao}</b>, regularize a assinatura.</>}
          </p>

          <div className="avnPlanoResumo">
            <div>
              <small>ANESTESIOLOGISTAS ATIVOS</small>
              <strong>{profissionais}</strong>
            </div>
            <div>
              <small>VALOR POR ANESTESIOLOGISTA</small>
              <strong>{dinheiro(49.99)}<span>/mês</span></strong>
            </div>
            <div className="destaque">
              <small>TOTAL MENSAL</small>
              <strong>{dinheiro(mensal)}<span>/mês</span></strong>
            </div>
          </div>

          <p className="avnOnboardingEmail">
            A cobrança considera apenas usuários ativos com CRM cadastrado.
            Recepção e financeiro não entram na conta. O valor é recalculado
            quando a equipe muda.
          </p>

          {podeContratar
            ? <AssinarButton rotulo={liberada ? "Contratar assinatura mensal" : "Pagar com Mercado Pago"} />
            : <p className="avnOnboardingEmail">
                Só o responsável pela organização pode contratar a assinatura.
              </p>}

          <a className="avnLoginCancel" href={WHATSAPP} target="_blank" rel="noreferrer">
            Falar com o AVANEST no WhatsApp
          </a>
          <Link className="avnLoginCancel" href={liberada ? "/dashboard" : "/login"}>
            {liberada ? "Voltar ao sistema" : "Sair"}
          </Link>
        </div>
      </section>
    </main>
  );
}
