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
import { hoje as hojeNoBrasil, somarMeses } from "@/lib/data-local";

// O lembrete que ninguém dispara.
//
// A outra rota de push (avisar) tem sempre um clique por trás: alguém ofereceu
// um plantão, alguém respondeu, alguém publicou a escala. Os avisos daqui não
// têm. "19 plantões esperando sua confirmação" e "9 plantões de julho sem
// receber" não são eventos — são o estado do mundo, e ninguém aperta nada para
// que virem verdade. Só chegam ao telefone se alguém for olhar de tempos em
// tempos, e é isso que esta rota é: o alguém.
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
  if (!forcado && !dentroDoHorario(agora)) {
    return NextResponse.json({ ok: true, enviadas: 0, motivo: "fora-de-horario" });
  }

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
  ] = await Promise.all([
    admin.from("perfis").select("id").in("id", perfis).eq("status", "ativo"),
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

  const mortas: string[] = [];
  const entregues: string[] = [];
  const recibosNovos: { perfil_id: string; chave: string; enviado_em: string }[] = [];
  let enviadas = 0;
  let pessoas = 0;

  for (const { id: perfilId } of ativos ?? []) {
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

    const escolhidos = paraNotificar({
      avisos: visiveis,
      enviados: new Map((recibosDe.get(perfilId) ?? [])
        .map((r) => [r.chave, r.enviado_em])),
      agora,
    });
    if (!escolhidos.length) continue;

    const aparelhos = aparelhosDe.get(perfilId) ?? [];
    let algumChegou = false;
    for (const aviso of escolhidos) {
      const notificacao: Notificacao = notificacaoDoAviso(aviso);
      // Todos os aparelhos da pessoa, em paralelo: o celular e o tablet do
      // consultório são duas inscrições do mesmo perfil, e a pendência é a
      // mesma nos dois.
      const idas = await Promise.all(aparelhos.map(async (linha) => {
        const resultado = await enviar(
          chaves, linha as unknown as Inscricao, notificacao,
        );
        if (resultado.ok) { entregues.push(linha.id); return true; }
        if (resultado.expirou) mortas.push(linha.id);
        else console.error("[api/push/lembretes]", resultado.status, resultado.detalhe);
        return false;
      }));
      // O RECIBO SÓ SAI SE ALGUM APARELHO ACEITOU. Carimbar um envio que
      // falhou calaria o aviso por sete dias sem ele nunca ter tocado — e o
      // defeito seria invisível, porque a tabela diria que foi entregue.
      if (idas.some(Boolean)) {
        enviadas++;
        algumChegou = true;
        recibosNovos.push({
          perfil_id: perfilId, chave: chaveDoAviso(aviso),
          enviado_em: agora.toISOString(),
        });
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
    pessoas,
    removidas: mortas.length,
    motivo: enviadas === 0 ? "nada-pendente" : undefined,
  });
}
