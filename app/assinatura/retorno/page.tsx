import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { faltaCartao } from "@/lib/teste-gratis";
import { AtualizarSozinho } from "./atualizar-sozinho";

// Para onde o provedor de pagamento devolve o cliente depois do checkout.
//
// A confirmação de verdade vem pelo webhook, não por esta volta — o navegador
// pode voltar antes de o pagamento ser processado. Por isso a tela fala em
// "pode levar alguns minutos" em vez de garantir a liberação.
export default async function RetornoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase.rpc("minha_assinatura");
  const assinatura = Array.isArray(data) ? data[0] : data;
  // Quem acabou de cadastrar o cartão para começar o teste só entra quando o
  // aviso do Stripe chegar e a assinatura ficar ativa — até lá, "confirmando".
  const { data: perfil } = await supabase.from("perfis").select("institution_id").eq("id", user.id).maybeSingle();
  const { data: org } = perfil?.institution_id
    ? await supabase.from("instituicoes").select("plano, created_at").eq("id", perfil.institution_id).maybeSingle()
    : { data: null };
  const semCartao = faltaCartao({ plano: org?.plano, criadaEm: org?.created_at });
  const liberada = assinatura?.liberada === true && !semCartao;

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnOnboardingCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>Obrigado por escolher o AVANEST.</p>
        </div>
        <div className="avnLoginContent">
          <h1>{liberada ? "Tudo certo, acesso liberado." : semCartao ? "Confirmando o seu cartão…" : "Recebemos seu pedido de assinatura."}</h1>
          <p>
            {liberada
              ? "Sua assinatura está ativa. Pode voltar ao sistema e seguir trabalhando."
              : semCartao
                ? "Leva só alguns segundos: esta página se atualiza sozinha e libera o acesso assim que o Stripe confirmar. Não precisa cadastrar de novo."
                : "A confirmação do pagamento pode levar alguns minutos. Assim que o pagamento for aprovado, o acesso é liberado sozinho — não precisa pagar de novo."}
          </p>
          {semCartao && <AtualizarSozinho />}
          {semCartao
            ? <Link className="avnLoginSubmit" href="/assinatura/retorno">Atualizar agora</Link>
            : <Link className="avnLoginSubmit" href="/dashboard">{liberada ? "Entrar no sistema" : "Voltar ao sistema"}</Link>}
          {!liberada && <Link className="avnLoginCancel" href="/assinatura">Ver situação da assinatura</Link>}
        </div>
      </section>
    </main>
  );
}
