import type { Metadata } from "next";

// Título próprio, e não o da capa.
//
// Esta página herdava "AVANEST | Gestão em anestesiologia" — o MESMO título e a
// mesma descrição da capa, de /criar-conta e de /comecar. Quatro endereços
// idênticos aos olhos do buscador é o caminho mais curto para ele escolher um
// e ignorar os outros. E "avanest login" é busca real: quem já é cliente
// procura assim, e merece cair aqui em vez de na vitrine.
export const metadata: Metadata = {
  title: "Entrar no AVANEST",
  description: "Acesso ao AVANEST, sistema de gestão em anestesiologia: avaliação pré-anestésica, escala do serviço e controle do que foi faturado e recebido.",
  alternates: { canonical: "/login" },
};

import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ senha?: string; convite?: string; plano?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    if (query.convite) redirect(`/convite/${encodeURIComponent(query.convite)}`);
    // Quem entrou para contratar um plano vai para o pagamento, mesmo já
    // tendo organização — foi o que ele pediu ao clicar em Assinar.
    if (query.plano) redirect(`/comecar?plano=${encodeURIComponent(query.plano)}`);
    // Mesma regra do formulário: sem contrato, a porta de entrada é a tela
    // de assinatura; cortesia e plano pago seguem para o painel.
    const { data } = await supabase.rpc("minha_assinatura");
    const assinatura = Array.isArray(data) ? data[0] : data;
    const precisaContratar = ["trial", "cancelado"].includes(String(assinatura?.plano ?? ""));
    // Mesmo destino do formulário: a escolha do local vem antes do painel,
    // menos para a recepção, que atende sempre no mesmo lugar.
    const { data: quem } = await supabase.from("perfis").select("role").eq("id", user.id).maybeSingle();
    const escolheLocal = quem?.role !== "recepcao";
    redirect(precisaContratar ? "/assinatura" : escolheLocal ? "/locais" : "/dashboard");
  }

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <div className="avnLoginMonitor" aria-hidden="true">
            <svg viewBox="0 0 190 42">
              <path d="M0 27 H56 L66 27 73 9 83 37 91 18 97 27 H190" />
            </svg>
            <div className="avnMonitorScreen">
              <i /><i /><i />
            </div>
            <div className="avnMonitorFeet"><i /><i /></div>
          </div>
          <p>A escala, a avaliação e o que você tem a receber, em um sistema só.</p>
        </div>
        <div className="avnLoginContent">
          <h1>Entrar no AVANEST</h1>
          <p>Acesso individual, definido pela sua conta.</p>
          <LoginForm passwordChanged={query.senha === "alterada"} convite={query.convite ?? ""} plano={query.plano ?? ""} />
          {/* Sem esta saída, quem chega no login sem conta fica preso: a tela
              não oferecia nenhum caminho para criar uma. */}
          <p className="avnLoginAlt">
            Ainda não tem conta? <Link href="/planos">Veja os planos e comece</Link>.
          </p>
          <Link className="avnLoginCancel" href="/">Cancelar</Link>
        </div>
      </section>
    </main>
  );
}
