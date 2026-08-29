import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { DashboardClient, type DashboardView } from "./dashboard-client";
import { COOKIE_LOCAL, decidirLocalDaSessao, type LocalDisponivel } from "@/lib/local-ativo";
import { escalaPublicada, lembreteDeConfirmacao, lembretesDoDinheiro, montarAvisos } from "@/lib/avisos";
import { nomeCurto } from "@/lib/escala";
import { hoje as hojeNoBrasil, mesAtual, somarMeses } from "@/lib/data-local";
import { areasLiberadas, modulosDaOrganizacao } from "@/lib/modulos";

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
    .select("nome, tipo, telefone, email, modulos")
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

  // NÃO ESCREVA COOKIE AQUI. Este é um Server Component, e o Next recusa a
  // escrita com "Cookies can only be modified in a Server Action or Route
  // Handler" — não é aviso, é exceção, e derruba o painel inteiro com erro
  // 500. Foi exatamente o que aconteceu em produção. Quem grava o cookie do
  // local é POST /api/local, que é Route Handler e ainda confere no banco, via
  // selecionar_local, se a pessoa pode usar aquele local.
  //
  // Aqui só se decide, e a decisão é pura para poder ser testada.
  const cookieStore = await cookies();
  const { local: localEscolhido, precisaEscolher } = decidirLocalDaSessao(
    localDaUrl ?? cookieStore.get(COOKIE_LOCAL)?.value,
    disponiveis,
    // A recepção não roda hospitais: fica na clínica onde está o ambulatório.
    { pergunta: perfil.role !== "recepcao" },
  );
  if (precisaEscolher) redirect("/locais");
  const localAtivo = localEscolhido;

  const { data: assinaturaData } = await supabase.rpc("minha_assinatura");
  const assinatura = Array.isArray(assinaturaData) ? assinaturaData[0] : assinaturaData;
  if (assinatura && assinatura.liberada === false) redirect("/assinatura");

  // Médico primeiro: é a área de trabalho do anestesiologista, e a ordem daqui
  // decide tanto os botões da barra quanto em qual área o sistema abre. Quem
  // não tem Médico continua abrindo na própria área — a lista é filtrada pelo
  // que a pessoa pode ver, então nunca sobra ninguém sem aba.
  // A Escala fica por último na barra, e não logo depois de Médico. É a área
  // que se abre para consultar — onde eu trabalho este mês, quem cobre o dia
  // 12 —, e não aquela em que se passa o dia; as do meio do caminho são as
  // que recebem paciente e faturam. Quem tem acesso clínico tem Escala:
  // recepção e financeiro não fazem plantão.
  //
  // A ordem desta lista também decide em que área o sistema ABRE, pelo
  // primeiro item. Médico continua na frente — mover a Escala para o fim não
  // muda a tela de entrada de ninguém.
  //
  // ATENÇÃO: esta lista tem uma gêmea em dashboard-client.tsx. Área nova
  // acrescentada só aqui carrega os dados e não desenha o botão; só lá,
  // desenha o botão e não carrega os dados. As duas precisam concordar.
  const permissionOrder: DashboardView[] = ["medico", "recepcao", "financeiro", "admin", "plantoes"];
  const assignedPermissions = Array.isArray(perfil.permissoes) ? perfil.permissoes : [];
  const hasLegacyFullAccess = ["admin", "owner"].includes(perfil.role) || assignedPermissions.includes("todos");
  const doPapel: DashboardView[] = hasLegacyFullAccess
    ? permissionOrder
    : permissionOrder.filter((view) => perfil.role === view || assignedPermissions.includes(view)
        // Plantões acompanha o acesso Médico: não é uma permissão à parte.
        || (view === "plantoes" && (perfil.role === "medico" || assignedPermissions.includes("medico"))));
  if (doPapel.length === 0) doPapel.push("medico");
  // O segundo filtro, e ele vem DEPOIS do papel: o que a organização contratou.
  // Um hospital que comprou ficha e escala não mostra Financeiro nem para o
  // próprio administrador — não é permissão de pessoa, é o contrato da casa.
  const modulos = modulosDaOrganizacao(instituicao?.modulos);
  const allowedViews = areasLiberadas(doPapel, modulos);
  const canManage = allowedViews.includes("admin");
  const canFinance = allowedViews.includes("financeiro");
  const requestedView = ["recepcao", "medico", "plantoes", "financeiro", "admin"].includes(area ?? "")
    ? area as DashboardView
    : undefined;
  // Pode não sobrar área nenhuma — um recepcionista numa organização que não
  // contratou recepção. `initialView` fica indefinido e o cliente diz isso na
  // cara, em vez de abrir uma tela que a organização não comprou.
  const initialView = requestedView && allowedViews.includes(requestedView)
    ? requestedView
    : allowedViews[0];
  const needsClinicalData = initialView === "recepcao" || initialView === "medico";
  const needsFinanceData = initialView === "financeiro" && canFinance;
  const needsAdminData = initialView === "admin" && canManage;
  // O Financeiro entrou na lista porque a tela passou a dizer quanto é de cada
  // um: sem os nomes, a tabela por profissional sairia com uma coluna de
  // identificadores.
  const needsProfiles = needsAdminData || initialView === "plantoes"
    || needsFinanceData || (initialView === "medico" && canManage);

  // Seis meses para trás. O lembrete só olha os três últimos meses fechados;
  // o resto seria carregar anos de linhas para somar três números.
  // A Vercel roda em UTC: um `new Date()` aqui é o relógio de Greenwich, e
  // depois das 21h ele já está no dia seguinte. O painel montado no servidor
  // discordava do calendário desenhado no navegador de quem estava no Brasil.
  const hoje = hojeNoBrasil();
  const mes = mesAtual();
  const seisMesesAtras = `${somarMeses(mes, -6)}-01`;
  // Doze meses para a receita do Financeiro: o envelhecimento olha o que está
  // em aberto, e conta de mais de um ano é caso de perda contábil e não de
  // cobrança.
  const dozeMesesAtras = `${somarMeses(mes, -12)}-01`;
  // Dois meses cobrem a troca mais antiga que ainda faz sentido responder.
  const doisMesesAtras = `${somarMeses(mes, -2)}-01`;

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
    { count: trocasEsperando },
    { data: trocasDoAviso },
    { data: plantoesDoAviso },
    { data: equipeDoAviso },
    { data: leituraDoChat },
    { data: chamadosDoAviso },
    { data: avisosVistos },
    { data: producaoDoAviso },
    { data: plantoesDoDinheiro },
    { data: plantoesDaReceita },
    { data: producaoDaReceita },
    { data: despesas },
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
    needsProfiles ? supabase.from("perfis").select("id,institution_id,nome,email,role,status,crm,rqe,permissoes,sem_acesso,na_escala,created_at,updated_at").order("nome") : Promise.resolve({ data: [] }),
    needsAdminData ? supabase.from("auditoria").select("id,actor_id,entidade,entidade_id,acao,detalhes,created_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    needsFinanceData ? supabase.from("financeiro_periodos").select("*").order("periodo", { ascending: false }) : Promise.resolve({ data: [] }),
    // A recepção também precisa: é a lista de convênios do cadastro do
    // paciente, e um convênio adicionado no financeiro tem de aparecer lá.
    needsClinicalData || needsFinanceData || needsAdminData ? supabase.from("convenio_valores").select("*").order("convenio").order("procedimento") : Promise.resolve({ data: [] }),
    // Plantões oferecidos que esperam a MINHA resposta. Vem para o topo da
    // tela, e não só para dentro da Escala: um turno oferecido que ninguém vê
    // é o buraco chegando no dia da cirurgia. Quem está na Recepção ou no
    // Financeiro precisa saber que tem alguém esperando resposta.
    //
    // Só a contagem: a lista inteira já é carregada pela Escala, e trazer duas
    // vezes o mesmo dado é uma consulta a mais em toda abertura do painel.
    supabase.from("trocas_plantao")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .neq("solicitante_id", user.id)
      .or(`destinatario_id.is.null,destinatario_id.eq.${user.id}`),

    // ---------------------------------------------------------------------
    // A caixa de avisos
    //
    // Seis consultas, e nenhuma tabela de notificação: os avisos são
    // DERIVADOS do que já é verdade. Uma troca pendente é um aviso porque
    // está pendente, e para de ser no instante em que alguém responde — não
    // há cópia para sincronizar nem linha para apagar.
    //
    // Elas entram no mesmo Promise.all das outras: em paralelo, custam o
    // tempo da mais lenta, e o topo da tela precisa dos avisos em QUALQUER
    // área — o plantão oferecido não pode depender de a pessoa abrir a
    // Escala para aparecer.
    //
    // Todas com teto e recorte curtos. Esta consulta roda em toda abertura do
    // painel, e uma caixa de avisos que pesa mais que a tela que ela enfeita
    // é um recurso que a pessoa desliga.
    // ---------------------------------------------------------------------
    supabase.from("trocas_plantao")
      .select("id,plantao_id,solicitante_id,destinatario_id,status,respondido_por,respondido_em,created_at")
      .order("created_at", { ascending: false }).limit(40),
    // Os plantões citados pelas trocas — é deles que sai o "12/09, 07h–19h"
    // do aviso. Sem o dia, o aviso obriga a abrir a escala para descobrir de
    // que plantão se trata, que é o trabalho que ele deveria poupar.
    //
    // O recorte é por DATA, e não por um teto de linhas. Havia um limit(400)
    // aqui, e ele quebra com o grupo grande: vinte anestesiologistas em três
    // turnos passam de mil e oitocentos plantões num mês, e as 400 primeiras
    // linhas seriam as de algum canto do ano — o aviso da troca de amanhã
    // ficaria sem data. Ninguém troca o plantão do ano passado, e a janela de
    // dois meses cobre a troca mais antiga que ainda faz sentido responder.
    supabase.from("plantoes").select("id,data,hora_inicio,hora_fim")
      .gte("data", doisMesesAtras),
    // O nome de quem oferece. A lista completa de perfis só é carregada em
    // algumas áreas; o aviso aparece em todas.
    supabase.from("perfis").select("id,nome").eq("status", "ativo"),
    supabase.from("sala_leitura").select("lido_em").eq("perfil_id", user.id).maybeSingle(),
    supabase.from("chamados")
      .select("id,assunto,status,ultima_em,visto_autor_em")
      .eq("aberto_por", user.id).order("ultima_em", { ascending: false }).limit(20),
    supabase.from("avisos_leitura").select("lido_em").eq("perfil_id", user.id).maybeSingle(),

    // Os lembretes de dinheiro saem daqui: o que você anestesiou e ainda não
    // cobrou, o que cobrou e não recebeu, o plantão que trabalhou e não foi
    // pago. Só os SEUS — o RLS já garante, e a conta é da pessoa, não do grupo.
    //
    // Seis meses para trás bastam: o lembrete só olha os três últimos meses
    // fechados, e trazer o histórico inteiro seria carregar anos de linhas para
    // somar três números.
    supabase.from("producao_do_dia").select("data,situacao,valor")
      .eq("perfil_id", user.id).gte("data", seisMesesAtras),
    // Os mesmos plantões servem a três avisos diferentes, e por isso a consulta
    // é uma só: o que falta receber, o que falta confirmar e a escala do mês
    // que alguém acabou de lançar. `created_at` e `created_by` são deste
    // último — é a diferença entre "entrou plantão meu" e "eu lancei um
    // plantão", e sem o autor o coordenador receberia aviso da própria escala.
    supabase.from("plantoes").select("data,situacao,valor,confirmado_em,created_at,created_by")
      .eq("perfil_id", user.id).gte("data", seisMesesAtras),

    // As outras duas fontes de receita do serviço, para o Financeiro.
    //
    // Sem `.eq("perfil_id", user.id)`, ao contrário das duas consultas acima:
    // aquelas são lembretes da pessoa, esta é a conta do serviço. Quem pode ver
    // é o RLS que decide — no individual só existe você, no grupo o financeiro
    // precisa do todo para dividir.
    //
    // Doze meses para trás. O envelhecimento olha o que está em aberto, e uma
    // conta de mais de um ano é caso de perda contábil, não de cobrança; puxar
    // o histórico inteiro seria carregar anos de plantão para somar um mês.
    needsFinanceData
      ? supabase.from("plantoes")
          .select("id,perfil_id,data,valor,situacao,local_id,local_texto")
          .gte("data", dozeMesesAtras).order("data", { ascending: false })
      : Promise.resolve({ data: [] }),
    // Pela função, e NÃO pela tabela.
    //
    // `producao_do_dia` tem política `perfil_id = auth.uid()` sem exceção para
    // administrador, e isso é deliberado: a lista de pacientes que um colega
    // anestesiou não é informação de gestão. Consultar a tabela direto daqui
    // não dá erro — devolve menos linhas. Num grupo, a receita de produção
    // sairia só a do próprio usuário, sem aviso nenhum de que faltava o resto.
    //
    // A função soma o que foi ENVIADO ao financeiro, com a permissão certa.
    needsFinanceData
      ? supabase.rpc("producao_do_periodo", { p_de: dozeMesesAtras, p_ate: hoje })
      : Promise.resolve({ data: [] }),

    // O outro lado do caixa. Doze meses porque o lembrete de despesa recorrente
    // olha o histórico para saber o que se repete — com um mês só, toda conta
    // pareceria nova.
    needsFinanceData
      ? supabase.from("despesas")
          .select("id,perfil_id,data,descricao,categoria,valor,recorrente,local_id,observacoes")
          .gte("data", dozeMesesAtras).order("data", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  // As mensagens da sala depois do seu último olhar. Vem em consulta separada
  // porque depende do resultado da anterior — e é `head`, só a contagem: o
  // texto das mensagens é da tela do chat, não do aviso.
  //
  // O erro é engolido de propósito, aqui e nas seis acima: enquanto a migration
  // de avisos_leitura não tiver rodado a tabela não existe, e derrubar o painel
  // inteiro por causa de um sino seria trocar um recurso novo por todos os
  // antigos. Sem os dados, a caixa fica vazia — que é exatamente o que ela
  // mostra quando não há aviso nenhum.
  const desde = leituraDoChat?.lido_em ?? null;
  const { count: chatNovas } = await supabase.from("sala_mensagens")
    .select("id", { count: "exact", head: true })
    .neq("autor_id", user.id)
    .gt("created_at", desde ?? "1970-01-01T00:00:00Z");
  const { data: ultimaDoChat } = await supabase.from("sala_mensagens")
    .select("created_at").neq("autor_id", user.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  // O nome já sai encurtado daqui. "GUSTAVO SEGOBIA DA SILVA" é como o cadastro
  // guarda; "Gustavo Segobia" é como o colega é chamado — e é o mesmo nome que
  // o calendário da escala mostra, porque sai da mesma função.
  const avisos = montarAvisos({
    perfilId: user.id,
    trocas: trocasDoAviso ?? [],
    plantoes: new Map((plantoesDoAviso ?? []).map((p) => [p.id, p])),
    nomes: new Map((equipeDoAviso ?? []).map((p) => [p.id, nomeCurto(p.nome)])),
    chat: { novas: chatNovas ?? 0, ultima: ultimaDoChat?.created_at ?? null },
    chamados: chamadosDoAviso ?? [],
    vistoEm: avisosVistos?.lido_em ?? null,
  }).concat(lembretesDoDinheiro({
    hoje,
    producao: producaoDoAviso ?? [],
    plantoes: plantoesDoDinheiro ?? [],
  })).concat(lembreteDeConfirmacao({
    hoje,
    plantoes: plantoesDoDinheiro ?? [],
  })).concat(escalaPublicada({
    perfilId: user.id,
    plantoes: plantoesDoDinheiro ?? [],
    nomes: new Map((equipeDoAviso ?? []).map((p) => [p.id, nomeCurto(p.nome)])),
    vistoEm: avisosVistos?.lido_em ?? null,
    hoje,
  })).sort((a, b) => b.quando.localeCompare(a.quando));

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
      trocasEsperando={trocasEsperando ?? 0}
      avisos={avisos}
      auditoria={auditoria ?? []}
      periodos={periodos ?? []}
      convenioValores={convenioValores ?? []}
      plantoesDaReceita={plantoesDaReceita ?? []}
      producaoDaReceita={producaoDaReceita ?? []}
      despesas={despesas ?? []}
      initialView={initialView}
      // A chave PÚBLICA do VAPID. Vem do servidor em vez de NEXT_PUBLIC_ para
      // manter uma variável de ambiente só, e porque ela muda de valor no dia
      // em que o par for trocado — prop é lida a cada render, NEXT_PUBLIC_ é
      // congelada na compilação.
      chavePush={process.env.VAPID_PUBLIC_KEY ?? ""}
      initialNewPatient={novo === "1"}
      autoStartAssessment={novo === "1" && iniciar === "1"}
    />
  );
}
