import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";

// Para onde o Mercado Pago devolve o cliente depois do checkout.
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
  const liberada = assinatura?.liberada === true;

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnOnboardingCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>Obrigado por assinar o AVANEST.</p>
        </div>
        <div className="avnLoginContent">
          <h1>{liberada ? "Tudo certo, acesso liberado." : "Recebemos seu pedido de assinatura."}</h1>
          <p>
            {liberada
              ? "Sua assinatura está ativa. Pode voltar ao sistema e seguir trabalhando."
              : "A confirmação do Mercado Pago pode levar alguns minutos. Assim que o pagamento for aprovado, o acesso é liberado sozinho — não precisa pagar de novo."}
          </p>
          <Link className="avnLoginSubmit" href="/dashboard">Voltar ao sistema</Link>
          {!liberada && <Link className="avnLoginCancel" href="/assinatura">Ver situação da assinatura</Link>}
        </div>
      </section>
    </main>
  );
}
