import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { CalculosClient } from "./calculos-client";

// A calculadora de doses: apoio, e não prontuário. Nada aqui lê ou escreve
// dados de paciente, o que permite abrir a aba no meio de um caso sem risco de
// encostar na avaliação de alguém.
//
// Enquanto amadurece, a aba é só do super-admin. E a restrição
// mora aqui, no servidor, não só no menu: esconder o link não impede ninguém
// de digitar /calculos na barra de endereço.

export const metadata: Metadata = {
  title: "Calculadora de doses | AVANEST",
  description: "Idade e peso, e as doses saem em mg e em mL: apoio rápido em sala.",
};

export default async function CalculosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis").select("super_admin, status").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo" || perfil.super_admin !== true) redirect("/dashboard");

  return <CalculosClient />;
}
