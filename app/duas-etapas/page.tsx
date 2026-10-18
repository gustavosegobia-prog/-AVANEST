import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { DUAS_ETAPAS_LIGADA, destinoSeguro, exigeDuasEtapas } from "@/lib/duas-etapas";
import { DuasEtapas } from "./duas-etapas";

export const metadata: Metadata = {
  title: "Verificação em duas etapas | AVANEST",
  robots: { index: false },
};

export default async function DuasEtapasPage({ searchParams }: { searchParams: Promise<{ depois?: string }> }) {
  const { depois } = await searchParams;
  const destino = destinoSeguro(depois);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const temCodigo = user.factors?.some((f) => f.status === "verified") ?? false;
  // Com a verificação desligada, só quem ainda tem um código cadastrado passa
  // por aqui (para digitá-lo); ninguém é levado a cadastrar um novo.
  if (!DUAS_ETAPAS_LIGADA && !temCodigo) redirect(destino);
  // Com o código ativo e a sessão ainda sem ele, o banco recusa esta consulta
  // (é a tranca funcionando) e o perfil vem vazio — mas aí a tela só pede o
  // código, e não precisa saber se ele é obrigatório.
  const { data: perfil } = await supabase
    .from("perfis").select("role, super_admin, permissoes").eq("id", user.id).maybeSingle();

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnOnboardingCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>A senha sozinha não abre mais a sua conta: falta o código que só o seu celular gera.</p>
        </div>
        <div className="avnLoginContent">
          <DuasEtapas modo={temCodigo ? "verificar" : "cadastrar"} obrigatorio={exigeDuasEtapas(perfil)} depois={destino} />
        </div>
      </section>
    </main>
  );
}
