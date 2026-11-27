import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { COOKIE_LOCAL, decidirLocalDaSessao, nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";

// Quem entra nas telas da ficha anestésica.
//
// A mesma pergunta que as políticas do banco fazem: pode_evolucao() — ficha
// liberada (super-admin, liberada para a organização ou para todas), acesso
// clínico (médico, administrador, proprietário) e a própria instituição. A
// trava de verdade está no banco; esta só evita mostrar uma tela que o banco
// vai recusar. Liberar para outra organização é uma linha em
// `recursos_por_instituicao`.
export async function exigirAcessoAEvolucao() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, nome, crm, rqe, role, status, super_admin, institution_id, permissoes")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || perfil.status !== "ativo") redirect("/dashboard");
  const { data: pode } = await supabase.rpc("pode_evolucao", { p_institution_id: perfil.institution_id });
  if (pode !== true) redirect("/dashboard");
  return { supabase, perfil };
}

/**
 * Quem pode IMPRIMIR a ficha (27/11/2026): quem faz a ficha (pode_evolucao)
 * ou a recepção, só a segunda via da ficha ENCERRADA (pode_segunda_via). A
 * trava de verdade é a regra do banco: para a recepção, a ficha aberta nem
 * volta da consulta. `clinico` diz se quem imprime é do acesso clínico — a
 * página registra a segunda via na auditoria quando não é.
 */
export async function exigirAcessoAImpressao() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, nome, crm, rqe, role, status, super_admin, institution_id, permissoes")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || perfil.status !== "ativo") redirect("/dashboard");
  const [{ data: clinico }, { data: segundaVia }] = await Promise.all([
    supabase.rpc("pode_evolucao", { p_institution_id: perfil.institution_id }),
    supabase.rpc("pode_segunda_via", { p_institution_id: perfil.institution_id }),
  ]);
  if (clinico !== true && segundaVia !== true) redirect("/dashboard");
  return { supabase, perfil, clinico: clinico === true };
}

export type LocalDaSessao = { id: string; nome: string };

/**
 * O hospital em que a pessoa está atendendo nesta sessão — o escolhido em
 * "Onde você vai atender hoje?", o do alfinete no topo do painel. A mesma
 * decisão do painel (lib/local-ativo.ts), sem perguntar: aqui só se lê. Sem
 * local cadastrado, null: as telas ficam com o grupo inteiro e o nome dele.
 */
export async function localDaSessao(supabase: Awaited<ReturnType<typeof createClient>>): Promise<LocalDaSessao | null> {
  const { data } = await supabase.rpc("meus_locais");
  const ativos = ((data ?? []) as LocalDisponivel[]).filter((l) => l.ativo);
  const { local } = decidirLocalDaSessao((await cookies()).get(COOKIE_LOCAL)?.value, ativos, { pergunta: false });
  return local ? { id: local.id, nome: nomeDoLocal(local) } : null;
}

export { fichasDoLocal } from "./local";
