import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { chavesDoAmbiente, enviar, type Inscricao, type Notificacao } from "@/lib/push";
import {
  lembreteDeConfirmacao, lembretesDoDinheiro, montarAvisos, semOsAdiados,
  chaveDoAviso, type Aviso,
} from "@/lib/avisos";
import {
  DIAS_DE_SILENCIO, dentroDoHorario, notificacaoDoAviso, paraNotificar,
} from "@/lib/aviso-no-telefone";
import { dataLocal, horaLocal, hoje as hojeNoBrasil, somarDias, somarMeses } from "@/lib/data-local";
import {
  chaveDoLembrete, destinoDoLembrete, deveAvisar, textoDoLembrete,
  type PlantaoParaLembrar,
} from "@/lib/lembrete-de-plantao";
import { aceita, comPadrao, comoTocar } from "@/lib/preferencias-de-aviso";

// O lembrete que ninguém dispara.
//
// A outra rota de push (avisar) tem sempre um clique por trás: alguém ofereceu
// um plantão, alguém respondeu, alguém publicou a escala. Os avisos daqui não
// têm. "19 plantões esperando sua confirmação" e "9 plantões de julho sem
// receber" não são eventos — são o estado do mundo, e ninguém aperta nada para
// que virem verdade. Só chegam ao telefone se alguém for olhar de tempos em
// tempos, e é isso que esta rota é: o alguém.
//
// ESTA ROTA FAZ DUAS COISAS, e elas têm relógios diferentes.
//
//   1. AS PENDÊNCIAS ("19 plantões esperando confirmação"). Não têm hora certa:
//      só não podem chegar de madrugada. Uma vez por dia basta, e a trava de
//      sete dias em lib/aviso-no-telefone cuida do ritmo.
//
//   2. O LEMBRETE DE PLANTÃO ("você tem plantão hoje às 19h"). Esse TEM hora
//      certa — 7h para o turno da noite, 19h da véspera para o da manhã — e é
//      por isso que a janela das 8h às 21h não vale para ele: ela barraria
//      justamente o aviso das 7h, que é o mais importante dos dois.
//
// É também por causa do lembrete que o agendador passou a rodar de hora em
// hora. Antes era uma vez por dia, às 22h UTC, que não cai nem às 7h nem às 19h
// de Brasília em época nenhuma do ano.
//
// GET, e não POST, porque quem chama é o agendador da Vercel — e ele só sabe
// fazer GET. Não muda dado do usuário; escreve apenas o recibo do que mandou.
//
// A CHAVE DE SERVIÇO É INEVITÁVEL AQUI, e é o que torna o segredo obrigatório.
// Não há sessão: a rota lê o plantão e a produção de todo mundo para descobrir
// quem tem pendência, e o RLS, que existe justamente para impedir isso, precisa
// ficar de fora. Uma rota assim aberta seria um botão para tocar o telefone de
// toda a base — por isso, sem CRON_SECRET configurado, ela não roda. Recusar é
// a única resposta honesta: rodar "só desta vez" é o que transforma um segredo
// esquecido em porta aberta permanente.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quantas inscrições a rota examina por execução. Ver o comentário no corpo. */
const TETO_DE_APARELHOS = 2000;

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error("[api/push/lembretes] CRON_SECRET não configurado");
    return NextResponse.json({ error: "Rota não configurada." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const chaves = chavesDoAmbiente();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chaves || !serviceKey) {
    return NextResponse.json({ ok: true, enviadas: 0, motivo: "sem-chave" });
  }

  // A JANELA DE HORÁRIO É CONFERIDA AQUI, e não só no agendador.
  //
  // O agendador da Vercel fala em UTC, e o Brasil já teve horário de verão. Um
  // cron cravado em "22:00 UTC" acerta as 19h hoje e as 20h no ano em que o
  // horário voltar — e uma execução manual, para testar, cairia a qualquer
  // hora. A conta de que horas são em São Paulo é feita uma vez, em
  // lib/aviso-no-telefone, e vale para os dois casos.
  const agora = new Date();
  const forcado = request.nextUrl.searchParams.get("agora") === "1";
  // A JANELA SÓ VALE PARA AS PENDÊNCIAS, e não mais para a rota inteira.
  //
  // Ela barrava a execução antes de qualquer coisa acontecer — e com o cron de
  // hora em hora isso mataria justamente a das 7h, que é quando o aviso do
  // plantão da noite sai. Pendência de faturamento não pode chegar às 3h da
  // manhã; "você tem plantão hoje às 19h" às 7h é exatamente o ponto.
  const janelaDasPendencias = forcado || dentroDoHorario(agora);
  // O relógio de Brasília em texto ordenável, que é a moeda de lib/lembrete-de-
  // plantao: os três lados da comparação ficam no mesmo fuso e não se converte
  // nada no meio.
  const agoraLocal = `${dataLocal(agora)}T${horaLocal(agora)}`;

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });

  // QUEM TEM APARELHO, e só. Calcular a pendência de quem nunca ligou as
  // notificações seria varrer o banco inteiro para não mandar nada.
  const { data: inscricoes, error: erroInscricoes } = await admin
    .from("push_inscricoes")
    .select("id, perfil_id, institution_id, endpoint, p256dh, auth")
    // O teto não é otimização, é freio: esta rota roda sem ninguém olhando, e
    // uma execução que tenta somar seis meses de plantão de dez mil perfis de
    // uma vez estoura o tempo da função e não manda nada — falhando em
    // silêncio, que é o pior modo de falhar de um lembrete.
    .limit(TETO_DE_APARELHOS);
  if (erroInscricoes) {
    console.error("[api/push/lembretes] inscrições", erroInscricoes);
    return NextResponse.json({ ok: true, enviadas: 0, motivo: "falha-consulta" });
  }
  if (!inscricoes?.length) {
    return NextResponse.json({ ok: true, enviadas: 0, motivo: "sem-aparelho" });
  }

  const perfis = [...new Set(inscricoes.map((i) => i.perfil_id))];
  const hoje = hojeNoBrasil();
  // A JANELA DO LEMBRETE É DE DOIS DIAS, e não mais.
  //
  // O aviso mais adiantado que existe é o do plantão da manhã de amanhã, que
  // sai às 19h de hoje; o mais atrasado é o do plantão da manhã de hoje, que
  // devia ter saído ontem às 19h e ainda vale até ele começar. Fora de [hoje,
  // amanhã] não há nada a avisar, e trazer o mês inteiro seria carregar
  // trezentas linhas por pessoa para olhar duas.
  const amanha = somarDias(hoje, 1);
  const seisMesesAtras = `${somarMeses(hoje.slice(0, 7), -6)}-01`;
  // O silêncio olha sete dias para trás; recibo mais velho que isso já não
  // decide nada e não precisa vir.
  const desdeORecibo = new Date(agora.getTime() - DIAS_DE_SILENCIO * 86400_000)
    .toISOString();

  // TUDO DE UMA VEZ, e não uma consulta por pessoa. Com dez da equipe seriam
  // cinquenta idas ao banco para montar um lembrete — e o custo cresce com a
  // equipe, que é justamente quando ele precisa continuar cabendo no tempo da
  // função.
  const [
    { data: ativos }, { data: plantoes }, { data: producao },
    { data: chamados }, { data: adiados }, { data: recibos },
    { data: plantoesDaJanela },
  ] = await Promise.all([
    admin.from("perfis").select("id,preferencias_aviso").in("id", perfis).eq("status", "ativo"),
    admin.from("plantoes").select("perfil_id,data,situacao,valor,confirmado_em")
      .in("perfil_id", perfis).gte("data", seisMesesAtras),
    admin.from("producao_do_dia").select("perfil_id,data,situacao,valor")
      .in("perfil_id", perfis).gte("data", seisMesesAtras),
    admin.from("chamados").select("id,aberto_por,assunto,status,ultima_em,visto_autor_em")
      .in("aberto_por", perfis).eq("status", "respondido"),
    admin.from("avisos_adiados").select("perfil_id,chave,ate")
      .in("perfil_id", perfis).gte("ate", hoje),
    admin.from("avisos_enviados").select("perfil_id,chave,enviado_em")
      .in("perfil_id", perfis).gte("enviado_em", desdeORecibo),
    // Os plantões de hoje e amanhã, com o que for preciso para escrever o
    // aviso. `cancelado` fica de fora já na consulta: plantão cancelado não
    // tem lembrete, e é assim que cancelar um plantão apaga o aviso dele sem
    // haver nada agendado para cancelar.
    admin.from("plantoes")
      .select("id,perfil_id,data,hora_inicio,hora_fim,situacao,local_texto,local_id")
      .in("perfil_id", perfis).gte("data", hoje).lte("data", amanha)
      .neq("situacao", "cancelado"),
  ]);

  const porPerfil = <T extends { [k: string]: unknown }>(
    linhas: T[] | null, campo: keyof T,
  ) => {
    const mapa = new Map<string, T[]>();
    for (const l of linhas ?? []) {
      const id = String(l[campo]);
      const antes = mapa.get(id);
      if (antes) antes.push(l); else mapa.set(id, [l]);
    }
    return mapa;
  };

  const plantoesDe = porPerfil(plantoes, "perfil_id");
  const producaoDe = porPerfil(producao, "perfil_id");
  const chamadosDe = porPerfil(chamados, "aberto_por");
  const adiadosDe = porPerfil(adiados, "perfil_id");
  const recibosDe = porPerfil(recibos, "perfil_id");

  const aparelhosDe = porPerfil(inscricoes, "perfil_id");

  // O NOME DO HOSPITAL, resolvido uma vez para todos os plantões da janela.
  //
  // Ele mora em dois lugares: `local_texto`, digitado à mão na escala, ou
  // `local_id`, apontando para o cadastro. A notificação não pode sair sem ele
  // — "plantão hoje às 19h" sem dizer onde não serve a quem cobre três casas
  // na mesma semana, e é o caso de quase todo mundo que usa a escala.
  const idsDeLocais = [...new Set(
    (plantoesDaJanela ?? []).map((p) => p.local_id).filter(Boolean) as string[],
  )];
  const nomeDoLocal = new Map<string, string>();
  if (idsDeLocais.length) {
    const { data: locais } = await admin.from("locais_atendimento")
      .select("id,nome,nome_fantasia").in("id", idsDeLocais);
    for (const l of locais ?? []) {
      nomeDoLocal.set(String(l.id), String(l.nome_fantasia || l.nome || ""));
    }
  }
  const lembretesDe = porPerfil((plantoesDaJanela ?? []).map((p) => ({
    perfil_id: String(p.perfil_id),
    plantao: {
      id: String(p.id), data: String(p.data),
      hora_inicio: p.hora_inicio, hora_fim: p.hora_fim, situacao: p.situacao,
      local: (p.local_texto || (p.local_id ? nomeDoLocal.get(String(p.local_id)) : "") || "").trim(),
    } as PlantaoParaLembrar,
  })), "perfil_id");

  const mortas: string[] = [];
  const entregues: string[] = [];
  const recibosNovos: { perfil_id: string; chave: string; enviado_em: string }[] = [];
  let enviadas = 0;
  let pessoas = 0;

  let lembretesEnviados = 0;

  for (const perfilAtivo of ativos ?? []) {
    const perfilId = String(perfilAtivo.id);
    const aparelhos = aparelhosDe.get(perfilId) ?? [];
    if (!aparelhos.length) continue;

    // O QUE ESTA PESSOA ESCOLHEU RECEBER. Nulo é o estado de quem nunca abriu
    // a tela de preferências — e quer dizer "tudo", que é como o sistema
    // funcionava antes de a tela existir. Ver lib/preferencias-de-aviso.
    const preferencias = comPadrao(
      (perfilAtivo as { preferencias_aviso?: unknown }).preferencias_aviso,
    );
    const toque = comoTocar(preferencias);
    const jaEnviados = new Map((recibosDe.get(perfilId) ?? [])
      .map((r) => [String(r.chave), String(r.enviado_em)]));

    let algumChegou = false;

    /**
     * Manda para TODOS os aparelhos desta pessoa e diz se algum aceitou.
     *
     * O celular e o tablet do consultório são duas inscrições do mesmo perfil,
     * e o aviso é o mesmo nos dois. O recibo depende do "algum aceitou": ver o
     * comentário na chamada.
     */
    const mandar = async (notificacao: Notificacao) => {
      const idas = await Promise.all(aparelhos.map(async (linha) => {
        const resultado = await enviar(
          chaves, linha as unknown as Inscricao, { ...notificacao, ...toque },
        );
        if (resultado.ok) { entregues.push(linha.id); return true; }
        if (resultado.expirou) mortas.push(linha.id);
        else console.error("[api/push/lembretes]", resultado.status, resultado.detalhe);
        return false;
      }));
      return idas.some(Boolean);
    };

    // O RECIBO SÓ SAI SE ALGUM APARELHO ACEITOU. Carimbar um envio que falhou
    // calaria o aviso sem ele nunca ter tocado — e o defeito seria invisível,
    // porque a tabela diria que foi entregue.
    const anotar = (chave: string) => {
      enviadas++;
      algumChegou = true;
      recibosNovos.push({
        perfil_id: perfilId, chave, enviado_em: agora.toISOString(),
      });
    };

    // ── 1. O LEMBRETE DE PLANTÃO ──────────────────────────────────────────
    //
    // Fora da janela das pendências de propósito: o aviso do plantão da noite
    // sai às 7h, e a janela começa às 8h. Cada plantão é um aviso próprio, com
    // a sua chave — dois plantões no mesmo dia em hospitais diferentes chegam
    // como duas notificações, e nenhuma substitui a outra.
    //
    // NÃO EXISTE LEMBRETE AGENDADO PARA CANCELAR. A lista sai da escala como
    // ela está agora: plantão cancelado não vem na consulta, plantão repassado
    // vem na lista do novo dono e some da do antigo, plantão movido de dia é
    // lido no dia novo. Ver o cabeçalho de lib/lembrete-de-plantao.
    if (aceita(preferencias, "lembrete_plantao")) {
      for (const { plantao } of lembretesDe.get(perfilId) ?? []) {
        const chave = chaveDoLembrete(plantao);
        // O recibo é o que impede a repetição: a rota roda de hora em hora, e
        // a janela de envio é de várias horas.
        if (jaEnviados.has(chave)) continue;
        if (!deveAvisar(plantao, agoraLocal)) continue;
        const { titulo, corpo } = textoDoLembrete(plantao, hoje);
        if (await mandar({ titulo, corpo, url: destinoDoLembrete(plantao), tag: chave })) {
          anotar(chave);
          lembretesEnviados++;
        }
      }
    }

    // ── 2. AS PENDÊNCIAS ──────────────────────────────────────────────────
    if (janelaDasPendencias) {
      // O SINO DESTA PESSOA, montado pelas mesmas funções que a tela usa.
      //
      // Reescrever a regra aqui — "plantão sem pagar há mais de um mês" — daria
      // um telefone que avisa de uma coisa e um sino que mostra outra. As
      // funções são puras exatamente para poderem rodar nos dois lugares.
      const meusPlantoes = plantoesDe.get(perfilId) ?? [];
      const avisos: Aviso[] = [
        // `montarAvisos` sem troca, sem chat e sem nomes: aqui ele responde uma
        // pergunta só — "o suporte respondeu e a pessoa ainda não viu?". Troca e
        // chat saem no instante em que acontecem, pela rota `avisar`, e repetir
        // à noite faria a mesma notícia tocar duas vezes.
        ...montarAvisos({
          perfilId, trocas: [], plantoes: new Map(), nomes: new Map(),
          chat: { novas: 0, ultima: null },
          chamados: chamadosDe.get(perfilId) ?? [], vistoEm: null,
        }),
        ...lembretesDoDinheiro({
          hoje, producao: producaoDe.get(perfilId) ?? [], plantoes: meusPlantoes,
        }),
        ...lembreteDeConfirmacao({ hoje, plantoes: meusPlantoes }),
      ];

      // O ADIAR VALE PARA O TELEFONE TAMBÉM. Quem mandou o lembrete de julho
      // voltar semana que vem não quer ouvi-lo hoje à noite — e um adiar que
      // silencia a tela e não silencia o telefone é um botão que mente.
      const visiveis = semOsAdiados(
        avisos,
        new Map((adiadosDe.get(perfilId) ?? []).map((a) => [a.chave, a.ate])),
        hoje,
      );

      const escolhidos = paraNotificar({ avisos: visiveis, enviados: jaEnviados, agora });
      for (const aviso of escolhidos) {
        if (await mandar(notificacaoDoAviso(aviso))) anotar(chaveDoAviso(aviso));
      }
    }

    if (algumChegou) pessoas++;
  }

  if (recibosNovos.length) {
    // `upsert` porque a chave primária é (perfil, chave): o mesmo lembrete
    // tocando de novo daqui a sete dias atualiza a linha em vez de duplicar.
    const { error } = await admin.from("avisos_enviados")
      .upsert(recibosNovos, { onConflict: "perfil_id,chave" });
    if (error) console.error("[api/push/lembretes] recibos", error);
  }
  if (mortas.length) await admin.from("push_inscricoes").delete().in("id", mortas);
  if (entregues.length) {
    await admin.from("push_inscricoes")
      .update({ ultimo_envio_em: agora.toISOString() })
      .in("id", [...new Set(entregues)]);
  }

  return NextResponse.json({
    ok: true,
    enviadas,
    lembretesDePlantao: lembretesEnviados,
    pessoas,
    removidas: mortas.length,
    janelaDasPendencias,
    motivo: enviadas === 0 ? "nada-pendente" : undefined,
  });
}
