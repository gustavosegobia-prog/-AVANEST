import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { CalculosClient } from "./calculos-client";

// Ferramentas de apoio, e não prontuário: nada aqui lê ou escreve dados de
// paciente. É o que permite abrir a aba no meio de um caso sem risco de
// encostar na avaliação de alguém.

export const metadata: Metadata = {
  title: "Cálculos extras | AvaNEST",
  description: "Gasometria e via aérea pediátrica: apoio rápido à decisão em sala.",
};

export default async function CalculosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <CalculosClient />;
}
