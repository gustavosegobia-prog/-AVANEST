import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { COOKIE_LOCAL, type LocalDisponivel } from "@/lib/local-ativo";
import { SeletorDeLocal } from "./seletor-local";

// "Onde você vai atender hoje?"
//
// A lista vem de meus_locais(), que já devolve recentes primeiro e esconde os
// arquivados de quem não administra. A tela não decide nada disso: se decidisse,
// haveria duas regras de visibilidade — uma no banco, outra aqui — e um dia
// elas discordariam.

export const dynamic = "force-dynamic";

export default async function LocaisPage({
  searchParams,
}: {
  searchParams: Promise<{ trocar?: string }>;
}) {
  const { trocar } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis").select("id,nome,role,permissoes,status,institution_id")
    .eq("id", user.id).maybeSingle();
  if (!perfil) redirect("/comecar");
  if (perfil.status !== "ativo") redirect("/login");

  const { data, error } = await supabase.rpc("meus_locais");
  // Enquanto a migration não tiver rodado, a função não existe. Mandar a pessoa
  // para o painel é melhor do que mostrar uma tela de erro por causa de uma
  // funcionalidade que ela ainda nem sabe que existe.
  if (error) {
    console.error("[locais] meus_locais", error);
    redirect("/dashboard");
  }
  const locais = (data ?? []) as LocalDisponivel[];

  const disponiveis = locais.filter((local) => local.ativo);
  // Um local só, e a pessoa não veio trocar de propósito: escolher entre uma
  // opção não é escolher. Entra direto.
  if (disponiveis.length === 1 && trocar !== "1") {
    redirect(`/dashboard?local=${encodeURIComponent(disponiveis[0].id)}`);
  }

  const cookieStore = await cookies();
  const ativo = cookieStore.get(COOKIE_LOCAL)?.value ?? null;

  const podeCadastrarCompartilhado = ["owner", "admin"].includes(perfil.role)
    || (Array.isArray(perfil.permissoes) && perfil.permissoes.includes("admin"));

  return (
    <SeletorDeLocal
      nome={perfil.nome}
      locais={locais}
      ativo={ativo}
      podeCadastrarCompartilhado={podeCadastrarCompartilhado}
    />
  );
}
