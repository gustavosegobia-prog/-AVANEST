import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardClient, type DashboardView } from "./dashboard-client";
import { COOKIE_LOCAL, COOKIE_LOCAL_MAX_AGE, localAindaVale, type LocalDisponivel } from "@/lib/local-ativo";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; novo?: string; iniciar?: string; local?: string }>;
}) {
  const { area, novo, iniciar, local: localDaUrl } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, institution_id, nome, role, permissoes, status, must_reset, super_admin")
    .eq("id", user.id)
    .maybeSingle();
  // Conta criada mas ainda sem organização: conclui o cadastro antes de entrar.
  if (!perfil) redirect("/comecar");
  if (perfil.status !== "ativo") redirect("/login");

  const { data: instituicao } = await supabase
    .from("instituicoes")
    .select("nome, tipo, telefone, email")
    .eq("id", perfil.institution_id)
    .maybeSingle();

  // Trava comercial: assinatura vencida ou suspensa impede o uso do sistema.
  // O isolamento entre organizações continua a cargo do RLS.
  // ------------------------------------------------------------------
  // Local de atendimento da sessão
  //
  // A regra de não atrapalhar quem ainda não usa isto: só existindo local
  // cadastrado é que a escolha passa a ser exigida. Organização sem nenhum
  // local entra no painel como sempre entrou — a funcionalidade se liga
  // sozinha quando o primeiro local nascer, e ninguém fica preso numa tela
  // de cadastro no meio de um dia de trabalho.
  //
  // O erro da RPC é engolido de propósito: enquanto a migration não tiver
  // rodado, a função não existe, e derrubar o painel inteiro por causa disso
  // seria trocar um recurso novo por todos os antigos.
  const { data: locaisData } = await supabase.rpc("meus_locais");
  const locais = (locaisData ?? []) as LocalDisponivel[];
  const disponiveis = locais.filter((item) => item.ativo);

  const cookieStore = await cookies();
  const idDoCookie = cookieStore.get(COOKIE_LOCAL)?.value;
  // A URL manda quando vem de /locais com um local só — o cookie ainda não foi
  // gravado nesse caminho, e mandar de volta para a escolha faria um pingue-
  // pongue entre as duas telas.
  let localAtivo = localAindaVale(localDaUrl ?? idDoCookie, disponiveis);
  if (!localAtivo && disponiveis.length > 0) redirect("/locais");
  if (localAtivo && localDaUrl) {
    // Grava o que veio pela URL, para a próxima entrada não passar por /locais.
    cookieStore.set(COOKIE_LOCAL, localAtivo.id, {
      httpOnly: true, sameSite: "lax", path: "/",
      secure: process.env.NODE_ENV === "production", maxAge: COOKIE_LOCAL_MAX_AGE,
    });
  }

  const { data: assinaturaData } = await supabase.rpc("minha_assinatura");
  const assinatura = Array.isArray(assinaturaData) ? assinaturaData[0] : assinaturaData;
  if (assinatura && assinatura.liberada === false) redirect("/assinatura");

  // Médico primeiro: é a área de trabalho do anestesiologista, e a ordem daqui
  // decide tanto os botões da barra quanto em qual área o sistema abre. Quem
  // não tem Médico continua abrindo na própria área — a lista é filtrada pelo
  // que a pessoa pode ver, então nunca sobra ninguém sem aba.
  // Plantões logo depois de Médico: é trabalho, não administração. Quem tem
  // acesso clínico tem plantão — recepção e financeiro não fazem turno.
  //
  // ATENÇÃO: esta lista tem uma gêmea em dashboard-client.tsx. Área nova
  // acrescentada só aqui carrega os dados e não desenha o botão; só lá,
  // desenha o botão e não carrega os dados. As duas precisam concordar.
  const permissionOrder: DashboardView[] = ["medico", "plantoes", "recepcao", "financeiro", "admin"];
  const assignedPermissions = Array.isArray(perfil.permissoes) ? perfil.permissoes : [];
  const hasLegacyFullAccess = ["admin", "owner"].includes(perfil.role) || assignedPermissions.includes("todos");
  const allowedViews: DashboardView[] = hasLegacyFullAccess
    ? permissionOrder
    : permissionOrder.filter((view) => perfil.role === view || assignedPermissions.includes(view)
        // Plantões acompanha o acesso Médico: não é uma permissão à parte.
        || (view === "plantoes" && (perfil.role === "medico" || assignedPermissions.includes("medico"))));
  if (allowedViews.length === 0) allowedViews.push("medico");
  const canManage = allowedViews.includes("admin");
  const canFinance = allowedViews.includes("financeiro");
  const requestedView = ["recepcao", "medico", "plantoes", "financeiro", "admin"].includes(area ?? "")
    ? area as DashboardView
    : undefined;
  const initialView = requestedView && allowedViews.includes(requestedView)
    ? requestedView
    : allowedViews[0];
  const needsClinicalData = initialView === "recepcao" || initialView === "medico";
  const needsFinanceData = initialView === "financeiro" && canFinance;
  const needsAdminData = initialView === "admin" && canManage;
  const needsProfiles = needsAdminData || initialView === "plantoes" || (initialView === "medico" && canManage);

  const [
    { data: pacientes },
    { data: avaliacoes },
    { data: agendamentos },
    { data: financeiro },
    { data: pagamentos },
    { data: perfis },
    { data: auditoria },
    { data: periodos },
    { data: convenioValores },
  ] = await Promise.all([
    needsFinanceData && perfil.role === "financeiro"
      ? supabase.rpc("financeiro_listar_pacientes")
      : needsClinicalData || needsFinanceData
        ? supabase.from("pacientes").select("*").order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    needsClinicalData || needsFinanceData
      ? supabase.from("avaliacoes").select("id,patient_id,created_by,status,versao,updated_at,created_at,concluida_at,dados,local_atendimento_id").order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    needsClinicalData
      ? supabase.from("agendamentos").select("*").order("data", { ascending: true }).order("horario", { ascending: true })
      : Promise.resolve({ data: [] }),
    needsFinanceData ? supabase.from("financeiro_atendimentos").select("*").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    needsFinanceData ? supabase.from("financeiro_pagamentos").select("*").order("paid_at", { ascending: false }) : Promise.resolve({ data: [] }),
    needsProfiles ? supabase.from("perfis").select("id,institution_id,nome,email,role,status,crm,rqe,permissoes,created_at,updated_at").order("nome") : Promise.resolve({ data: [] }),
    needsAdminData ? supabase.from("auditoria").select("id,actor_id,entidade,entidade_id,acao,detalhes,created_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    needsFinanceData ? supabase.from("financeiro_periodos").select("*").order("periodo", { ascending: false }) : Promise.resolve({ data: [] }),
    // A recepção também precisa: é a lista de convênios do cadastro do
    // paciente, e um convênio adicionado no financeiro tem de aparecer lá.
    needsClinicalData || needsFinanceData || needsAdminData ? supabase.from("convenio_valores").select("*").order("convenio").order("procedimento") : Promise.resolve({ data: [] }),
  ]);

  return (
    <DashboardClient
      perfil={perfil}
      // Vem do servidor, que já tem a sessão. Buscar no navegador deixaria a
      // tela "carregando..." — e o botão de trocar senha travado — sempre que
      // a chamada demorasse ou falhasse.
      email={user.email ?? ""}
      organizacao={instituicao ?? null}
      localAtivo={localAtivo}
      locais={disponiveis}
      totalDeLocais={disponiveis.length}
      pacientes={pacientes ?? []}
      avaliacoes={avaliacoes ?? []}
      agendamentos={agendamentos ?? []}
      financeiro={financeiro ?? []}
      pagamentos={pagamentos ?? []}
      perfis={perfis ?? []}
      auditoria={auditoria ?? []}
      periodos={periodos ?? []}
      convenioValores={convenioValores ?? []}
      initialView={initialView}
      initialNewPatient={novo === "1"}
      autoStartAssessment={novo === "1" && iniciar === "1"}
    />
  );
}
