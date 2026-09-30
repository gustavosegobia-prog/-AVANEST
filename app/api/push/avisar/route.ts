import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";
import { chavesDoAmbiente, enviar, type Inscricao, type Notificacao } from "@/lib/push";
import { nomeCurto } from "@/lib/escala";
import { ultimoDiaDoMes } from "@/lib/data-local";
import { ondeEQuando, quantosPlantoes } from "@/lib/aviso-plantao";
import { destinoDoLembrete } from "@/lib/lembrete-de-plantao";
import { aceita, comPadrao, comoTocar } from "@/lib/preferencias-de-aviso";
import { enviarEmail, emailConfigurado, enderecoValido } from "@/lib/email";
import { escalaPublicadaEmail, type PlantaoDoEmail } from "@/lib/email-escala";
import { recusaDoAvisoDePlantao, recusaDoAvisoDeTroca } from "@/lib/aviso-autorizado";

// Toca o telefone de quem precisa saber.
//
// O NAVEGADOR NÃO ESCREVE A NOTIFICAÇÃO. Ele diz apenas "a troca tal
// aconteceu"; o servidor vai ao banco, confere que o fato existe, descobre
// sozinho quem deve ser avisado e monta o texto. Se o conteúdo viesse pronto
// do navegador, qualquer pessoa com uma sessão válida poderia fazer o sistema
// mandar o que quisesse para o telefone de um colega — com o nome do AVANEST
// em cima.
//
// A LEITURA DO FATO USA A SESSÃO DE QUEM PEDIU, e não a chave de serviço: o
// RLS confere de graça que a pessoa realmente enxerga aquela troca. Só o envio
// usa a chave de serviço, porque ler o endereço de push de um colega é
// justamente o que o RLS proíbe — e com razão.

export const runtime = "nodejs";

type Alvo = { perfilId: string; notificacao: Notificacao };

export async function POST(request: NextRequest) {
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const chaves = chavesDoAmbiente();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Sem chave configurada o sistema segue funcionando sem notificar. Notificação
  // é acessório: derrubar o pedido de troca porque o push não está configurado
  // seria trocar a função pela decoração.
  if (!chaves || !serviceKey) {
    return NextResponse.json({ ok: true, enviadas: 0, motivo: "sem-chave" });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  const corpo = await request.json().catch(() => null) as
    { tipo?: unknown; id?: unknown; mes?: unknown } | null;
  const tipo = typeof corpo?.tipo === "string" ? corpo.tipo : "";
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  const mes = typeof corpo?.mes === "string" ? corpo.mes : "";

  const { data: euPerfil } = await supabase
    .from("perfis").select("id, nome, institution_id").eq("id", user.id).maybeSingle();
  if (!euPerfil) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });

  // ── QUEM PODE DISPARAR, E QUANTAS VEZES ────────────────────────────────
  //
  // O BOTÃO ESTAVA ESCONDIDO NA TELA, E SÓ. "Avisar a equipe" só aparece para
  // quem administra, mas tela não é fronteira de segurança: bastava um POST
  // com `{tipo:"escala"}` para qualquer pessoa da organização tocar o telefone
  // e mandar e-mail para todos os colegas escalados no mês — com o remetente
  // avanest.com.br e o nosso DKIM em cima.
  //
  // A regra é a MESMA que decide quem monta a escala, e vem do banco: avisar
  // que a escala saiu é parte de publicá-la, e duas regras diferentes para o
  // mesmo ato divergem na primeira mudança.
  if (tipo === "escala") {
    const { data: podePublicar } = await supabase.rpc("pode_montar_escala");
    if (podePublicar !== true) {
      return NextResponse.json(
        { error: "Só quem monta a escala pode avisar a equipe." },
        { status: 403 },
      );
    }
  }

  // DOIS LIMITES, porque são dois usos com ritmos opostos.
  //
  // O aviso de escala publicada é um disparo em massa: dez e-mails e dez
  // telefones de uma vez. Cinco por hora é folgado para quem publica de
  // verdade — e fecha a porta de quem descobrisse que pode usar o botão para
  // incomodar a equipe, ou para queimar a reputação do domínio.
  //
  // Os outros avisos acompanham o uso normal: montar a escala do mês são
  // trinta lançamentos, e cada um manda o seu. Um teto apertado aqui
  // silenciaria a metade de baixo do mês.
  const excedeu = tipo === "escala"
    ? enforceRateLimit(`avisar-escala:${user.id}`, { limit: 5, windowMs: 3_600_000 })
    : enforceRateLimit(`avisar:${user.id}`, { limit: 150, windowMs: 3_600_000 });
  if (excedeu) return excedeu;

  const alvos: Alvo[] = [];
  // A ESCALA DE CADA UM, só preenchida no aviso de escala publicada. É o que o
  // e-mail leva dentro; os outros avisos não têm lista para mandar.
  const escalaDoMes = new Map<string, PlantaoDoEmail[]>();

  if (tipo === "troca" || tipo === "troca_resolvida") {
    if (!id) return NextResponse.json({ error: "Falta a troca." }, { status: 400 });
    const { data: troca } = await supabase
      .from("trocas_plantao")
      .select("id, plantao_id, solicitante_id, destinatario_id, status, mensagem, respondido_por")
      .eq("id", id).maybeSingle();
    // Nulo aqui é o RLS dizendo que esta pessoa não vê esta troca. A resposta é
    // a mesma de "não existe", de propósito: distinguir as duas confirmaria a
    // existência de uma troca de outra organização.
    if (!troca) return NextResponse.json({ error: "Troca não encontrada." }, { status: 404 });
    // O aviso sai em nome de quem pede. Só sai de quem pediu a troca, ou de
    // quem a respondeu — ver lib/aviso-autorizado.
    const recusaTroca = recusaDoAvisoDeTroca(tipo, troca, euPerfil.id);
    if (recusaTroca) return NextResponse.json({ error: recusaTroca }, { status: 403 });

    // O local do plantão vem de dois lugares: `local_texto`, digitado à mão, ou
    // `local_id`, apontando para o cadastro. A escala aceita os dois, e o
    // aviso precisa dizer ONDE — "o plantão de 05/09" sem hospital não ajuda
    // quem cobre três casas na mesma semana.
    const { data: plantao } = await supabase
      .from("plantoes").select("data, hora_inicio, hora_fim, local_texto, local_id")
      .eq("id", troca.plantao_id).maybeSingle();
    let nomeDoLocal = plantao?.local_texto ?? "";
    if (!nomeDoLocal && plantao?.local_id) {
      const { data: local } = await supabase
        .from("locais_atendimento").select("nome_fantasia, nome").eq("id", plantao.local_id).maybeSingle();
      nomeDoLocal = local?.nome_fantasia || local?.nome || "";
    }
    // "Quarta, 02/09 · 07:00–19:00 · Santa Casa" — ver lib/aviso-plantao.
    const linhaDoPlantao = ondeEQuando(plantao ?? {}, nomeDoLocal);
    const eu = nomeCurto(euPerfil.nome ?? "");

    if (tipo === "troca") {
      // QUEM e O QUÊ no título; QUANDO e ONDE no corpo.
      //
      // Antes o título dizia "Convite de plantão" e o corpo repetia "convidou
      // você para o plantão" — metade da linha visível gasta dizendo duas
      // vezes a mesma coisa. Na tela bloqueada cabem duas linhas: o que estiver
      // depois do corte não existe.
      const notificacao: Notificacao = {
        titulo: troca.destinatario_id
          ? `${eu} convidou você para um plantão`
          : `${eu} ofereceu um plantão`,
        corpo: linhaDoPlantao || "Toque para ver os detalhes.",
        url: "/dashboard?area=plantoes",
        tag: `troca-${troca.id}`,
      };
      if (troca.destinatario_id) {
        alvos.push({ perfilId: troca.destinatario_id, notificacao });
      } else {
        // Oferta aberta: toda a equipe da escala, menos quem ofereceu.
        const { data: equipe } = await supabase
          .from("perfis").select("id").eq("institution_id", euPerfil.institution_id)
          .eq("status", "ativo").neq("id", euPerfil.id);
        for (const p of equipe ?? []) alvos.push({ perfilId: p.id, notificacao });
      }
    } else {
      // Quem ofereceu é quem espera a resposta.
      alvos.push({
        perfilId: troca.solicitante_id,
        notificacao: {
          titulo: `${eu} ${troca.status === "aceita" ? "assumiu" : "recusou"} o seu plantão`,
          corpo: linhaDoPlantao || "Toque para ver os detalhes.",
          url: "/dashboard?area=plantoes",
          tag: `troca-${troca.id}`,
        },
      });
    }
  } else if (tipo === "chat") {
    // MENSAGEM DA SALA DA EQUIPE, no instante em que foi escrita.
    //
    // Este é o único aviso do sino que não pode esperar o lembrete da noite:
    // mensagem de equipe que chega doze horas depois não é aviso, é
    // arqueologia. Quem pergunta "alguém cobre a sala 2 amanhã?" precisa da
    // resposta hoje.
    if (!id) return NextResponse.json({ error: "Falta a mensagem." }, { status: 400 });
    // O TEXTO É LIDO DO BANCO, com a sessão de quem mandou — nunca do corpo do
    // pedido. É a mesma regra da troca, e aqui ela pesa mais: o conteúdo vai
    // aparecer na tela bloqueada de toda a equipe, com o nome do AVANEST em
    // cima. Aceitar texto pronto do navegador seria dar a qualquer sessão
    // válida um megafone com a marca da casa.
    const { data: mensagem } = await supabase
      .from("sala_mensagens").select("id, texto, autor_id, institution_id")
      .eq("id", id).maybeSingle();
    if (!mensagem) return NextResponse.json({ error: "Mensagem não encontrada." }, { status: 404 });
    // Só o autor dispara o aviso da própria mensagem. Sem isto, qualquer pessoa
    // da sala poderia reenviar a notificação de uma mensagem antiga à vontade.
    if (mensagem.autor_id !== euPerfil.id) {
      return NextResponse.json({ error: "Mensagem de outra pessoa." }, { status: 403 });
    }
    const texto = String(mensagem.texto ?? "").trim();
    const notificacao: Notificacao = {
      titulo: `${nomeCurto(euPerfil.nome ?? "")} na sala da equipe`,
      // Cortado, porque a tela bloqueada corta de qualquer jeito — e cortar
      // aqui deixa reticências no lugar de uma frase que termina no nada.
      corpo: texto.length > 140 ? `${texto.slice(0, 139)}…` : (texto || "Nova mensagem."),
      url: "/dashboard?chat=equipe",
      // UMA TAG SÓ PARA A SALA INTEIRA: dez mensagens numa conversa animada
      // substituem uma à outra e o telefone mostra a última, em vez de dez
      // linhas iguais que a pessoa apaga sem ler.
      tag: "chat-equipe",
    };
    const { data: equipe } = await supabase
      .from("perfis").select("id").eq("institution_id", euPerfil.institution_id)
      .eq("status", "ativo").neq("id", euPerfil.id);
    for (const p of equipe ?? []) alvos.push({ perfilId: p.id, notificacao });
  } else if (tipo === "escala") {
    if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
    // Quem tem plantão no mês recebe. Ninguém mais: avisar a equipe inteira de
    // uma escala em que a pessoa não entrou é o tipo de aviso que ensina a
    // ignorar os próximos.
    // O FIM DO MÊS VEM DO CALENDÁRIO, e não de um "31" fixo.
    //
    // Era `${mes}-31`, e "2026-09-31" não existe: o Postgres recusa a
    // comparação inteira, a consulta volta vazia, e o sistema conclui que não
    // há ninguém a avisar. Quebrava em abril, junho, setembro, novembro e
    // fevereiro — cinco meses dos doze —, sempre em silêncio e sempre culpando
    // a equipe pela ausência de avisos.
    // O PLANTÃO INTEIRO, e não só de quem ele é. O push cabe num número — "8
    // plantões seus" —, mas o e-mail leva a escala dentro, e para isso precisa
    // do dia, do horário e do lugar de cada um. Ver lib/email-escala.ts.
    const { data: plantoes, error: erroPlantoes } = await supabase
      .from("plantoes").select("perfil_id, data, hora_inicio, hora_fim, local_id, local_texto")
      .gte("data", `${mes}-01`).lte("data", ultimoDiaDoMes(mes)).neq("situacao", "cancelado")
      .order("data").order("hora_inicio");
    // Erro de consulta não é "ninguém para avisar". Confundir os dois foi
    // exatamente o que escondeu o defeito acima por semanas.
    if (erroPlantoes) {
      console.error("[api/push/avisar] plantões do mês", erroPlantoes);
      return NextResponse.json({ ok: true, enviadas: 0, motivo: "falha-consulta" });
    }
    const nomeDoMes = new Date(`${mes}-02T12:00:00Z`)
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

    // UMA MENSAGEM POR PESSOA, com o número dela.
    //
    // Antes era a mesma frase para todo mundo — "a escala está no ar, confira
    // os seus plantões" —, que manda abrir o sistema para descobrir a única
    // coisa que a pessoa quer saber. Quem tem doze plantões e quem tem um
    // recebiam o mesmo aviso, e os dois precisavam abrir para saber qual era.
    const quantos = new Map<string, number>();
    for (const linha of plantoes ?? []) {
      if (linha.perfil_id) quantos.set(linha.perfil_id, (quantos.get(linha.perfil_id) ?? 0) + 1);
    }
    // A MESMA LISTA, guardada para o e-mail. O nome do hospital é resolvido
    // uma vez para a organização toda: resolver por plantão seria uma consulta
    // por linha num mês de trinta.
    const { data: locaisDoMes } = await supabase
      .from("locais_atendimento").select("id, nome_fantasia, nome")
      .eq("institution_id", euPerfil.institution_id);
    const nomeDoLocal = new Map((locaisDoMes ?? []).map(
      (l) => [String(l.id), String(l.nome_fantasia || l.nome || "")],
    ));
    for (const linha of plantoes ?? []) {
      if (!linha.perfil_id) continue;
      const lista = escalaDoMes.get(linha.perfil_id) ?? [];
      lista.push({
        data: linha.data, hora_inicio: linha.hora_inicio, hora_fim: linha.hora_fim,
        local: linha.local_texto || nomeDoLocal.get(String(linha.local_id ?? "")) || "",
      });
      escalaDoMes.set(linha.perfil_id, lista);
    }
    for (const [perfilId, total] of quantos) {
      if (perfilId === euPerfil.id) continue;
      alvos.push({
        perfilId,
        notificacao: {
          titulo: `Escala de ${nomeDoMes} publicada`,
          corpo: `${quantosPlantoes(total, mes)} Toque para conferir.`,
          url: "/dashboard?area=plantoes",
          // Uma tag por mês: republicar a escala substitui o aviso anterior em
          // vez de empilhar mais um.
          tag: `escala-${mes}`,
        },
      });
    }
  } else if (tipo === "plantao_novo" || tipo === "plantao_alterado" || tipo === "plantao_cancelado") {
    // O QUE ACONTECEU COM UM PLANTÃO SEU, sem você ter feito nada.
    //
    // Escala publicada avisa uma vez, no dia em que sai. Depois dela a escala
    // continua se mexendo — alguém escala você para cobrir a quarta, alguém
    // cancela o seu sábado — e nada disso chegava ao telefone: a pessoa
    // descobria abrindo o sistema, se abrisse.
    if (!id) return NextResponse.json({ error: "Falta o plantão." }, { status: 400 });
    // Lido do banco, com a sessão de quem pediu — nunca do corpo do pedido. É a
    // mesma regra da troca e do chat: conteúdo pronto vindo do navegador é um
    // megafone com a marca da casa entregue a qualquer sessão válida.
    const { data: plantao } = await supabase
      .from("plantoes")
      .select("id, perfil_id, data, hora_inicio, hora_fim, local_texto, local_id, situacao")
      .eq("id", id).maybeSingle();
    // Nulo é o RLS dizendo que esta pessoa não vê este plantão. A resposta é a
    // mesma de "não existe", para não confirmar a existência de um plantão de
    // outra organização.
    if (!plantao) return NextResponse.json({ error: "Plantão não encontrado." }, { status: 404 });

    // QUEM RECEBE É O DONO DO PLANTÃO, e ninguém mais. É a regra do pedido —
    // "cada profissional recebe somente notificações dos próprios plantões" —
    // e a razão de o alvo sair do banco e não do navegador.
    //
    // E não se avisa quem mexeu: quem acabou de cancelar o próprio sábado não
    // precisa de um telefone tocando para contar o que ele mesmo fez.
    if (!plantao.perfil_id || plantao.perfil_id === euPerfil.id) {
      return NextResponse.json({ ok: true, enviadas: 0, motivo: "sem-alvo" });
    }
    // Plantão de colega: só quem monta a escala mexe nele, e "cancelado" só
    // sai se ele está cancelado de fato — ver lib/aviso-autorizado.
    const { data: podeMontar } = await supabase.rpc("pode_montar_escala");
    const recusaPlantao = recusaDoAvisoDePlantao(tipo, plantao, podeMontar === true);
    if (recusaPlantao) return NextResponse.json({ error: recusaPlantao }, { status: 403 });

    let ondeFica = plantao.local_texto ?? "";
    if (!ondeFica && plantao.local_id) {
      const { data: local } = await supabase
        .from("locais_atendimento").select("nome_fantasia, nome")
        .eq("id", plantao.local_id).maybeSingle();
      ondeFica = local?.nome_fantasia || local?.nome || "";
    }
    const comOLocal = (frente: string) =>
      [frente, String(ondeFica).trim()].filter(Boolean).join(" — ");

    const titulo = tipo === "plantao_cancelado" ? comOLocal("❌ Plantão cancelado")
      : tipo === "plantao_novo" ? comOLocal("🗓️ Plantão na sua escala")
      : comOLocal("🔄 Alteração de plantão");

    alvos.push({
      perfilId: plantao.perfil_id,
      notificacao: {
        titulo,
        // "Quinta, 17/09 · 19:00–07:00" — a mesma linha da troca, e com a
        // mesma razão: a decisão de quem lê depende de saber que dia da semana
        // é e a que horas termina.
        corpo: `${ondeEQuando(plantao, "")} · por ${nomeCurto(euPerfil.nome ?? "")}.`.trim(),
        // Abre o plantão, e não o mês: quem recebe "seu plantão foi cancelado"
        // quer ver aquele turno, não procurar num calendário.
        url: destinoDoLembrete({ id: String(plantao.id), data: String(plantao.data) }),
        // Uma tag por plantão E POR TIPO: um cancelamento não pode apagar da
        // tela o aviso da alteração de meia hora antes — são dois fatos.
        tag: `${tipo}-${plantao.id}`,
      },
    });
  } else {
    return NextResponse.json({ error: "Tipo desconhecido." }, { status: 400 });
  }

  // ZERO ALVOS NÃO É ZERO APARELHOS, e a diferença é a informação inteira.
  //
  // A tela dizia "ninguém da equipe ligou as notificações" sempre que o total
  // saía zero — culpando a equipe por três situações diferentes, duas das
  // quais não têm nada a ver com ela: a chave do push faltando no servidor, e
  // não haver ninguém a avisar. Quem lê aquilo vai cobrar os colegas por um
  // defeito de configuração.
  if (alvos.length === 0) {
    return NextResponse.json({ ok: true, enviadas: 0, motivo: "sem-alvo" });
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });
  const idsDosAlvos = [...new Set(alvos.map((a) => a.perfilId))];
  const [{ data: inscricoes }, { data: perfisDosAlvos }] = await Promise.all([
    admin.from("push_inscricoes")
      .select("id, perfil_id, endpoint, p256dh, auth")
      .in("perfil_id", idsDosAlvos)
      // Nunca fora da organização de quem pediu, mesmo com a chave de serviço na
      // mão: o RLS não protege aqui, então a condição é escrita à mão.
      .eq("institution_id", euPerfil.institution_id),
    // O QUE CADA DESTINATÁRIO ESCOLHEU RECEBER. Sem isto, o interruptor da tela
    // de preferências só valeria para o lembrete diário — e quem desligasse
    // "plantão trocado" continuaria recebendo troca, que é a metade das
    // notificações do sistema.
    admin.from("perfis").select("id, preferencias_aviso")
      .in("id", idsDosAlvos).eq("institution_id", euPerfil.institution_id),
  ]);
  const preferenciaDe = new Map((perfisDosAlvos ?? []).map(
    (p) => [String(p.id), comPadrao(p.preferencias_aviso)],
  ));

  const porPerfil = new Map<string, Notificacao>();
  for (const alvo of alvos) porPerfil.set(alvo.perfilId, alvo.notificacao);

  const mortas: string[] = [];
  const entregues: string[] = [];
  let enviadas = 0;
  let recusadas = 0;
  // Em paralelo: dez aparelhos em série somariam dez idas ao serviço de push
  // dentro do clique de quem ofereceu o plantão.
  await Promise.all((inscricoes ?? []).map(async (linha) => {
    const notificacao = porPerfil.get(linha.perfil_id);
    if (!notificacao) return;
    // A PREFERÊNCIA DE QUEM RECEBE, e não a de quem manda. Perfil que não veio
    // na consulta cai no padrão — tudo ligado —, que é como o sistema
    // funcionava antes de a tela de preferências existir.
    const preferencia = preferenciaDe.get(linha.perfil_id) ?? comPadrao(null);
    if (!aceita(preferencia, tipo)) { recusadas++; return; }
    const resultado = await enviar(chaves, linha as unknown as Inscricao,
      { ...notificacao, ...comoTocar(preferencia) });
    if (resultado.ok) { enviadas++; entregues.push(linha.id); return; }
    // 404 e 410 = navegador desinstalado ou dados limpos. A inscrição morreu e
    // insistir nela é gastar uma requisição por aviso, para sempre.
    if (resultado.expirou) mortas.push(linha.id);
    else console.error("[api/push/avisar]", resultado.status, resultado.detalhe);
  }));

  if (mortas.length) await admin.from("push_inscricoes").delete().in("id", mortas);

  // Carimba quem recebeu. A coluna existia e NINGUÉM a preenchia: `ultimo_envio_em`
  // ficava nula para sempre, e olhar a tabela dava a impressão de que nada
  // nunca tinha sido enviado. Uma coluna que mente é pior que uma coluna que
  // falta — a que falta pelo menos não engana quem for investigar.
  if (entregues.length) {
    await admin.from("push_inscricoes")
      .update({ ultimo_envio_em: new Date().toISOString() })
      .in("id", entregues);
  }

  // ── O MESMO AVISO, POR E-MAIL ──────────────────────────────────────────
  //
  // O push só chega a quem instalou o AVANEST na tela de início e autorizou a
  // notificação — no iPhone, o Safari comum não recebe nada. Numa equipe
  // recém-cadastrada isso é NINGUÉM, e o botão fazia o trabalho certo para uma
  // plateia vazia. O e-mail é o único canal que já existe no dia em que a
  // pessoa entra: ela deu o endereço para ser convidada.
  //
  // VAI PARA TODOS, inclusive para quem recebeu o push. São coisas diferentes:
  // o push some da tela em segundos e serve para avisar AGORA; o e-mail fica na
  // caixa e é onde se volta a conferir o sábado daqui a três semanas.
  //
  // SÓ NO AVISO DE ESCALA PUBLICADA. Troca e alteração de plantão são assunto
  // de minutos, e um e-mail que chega depois da decisão é ruído.
  const mandarOsEmails = async (): Promise<number> => {
    if (!emailConfigurado()) return 0;
    const { data: destinatarios } = await admin
      .from("perfis").select("id, nome, email")
      .in("id", idsDosAlvos).eq("institution_id", euPerfil.institution_id);
    const { data: organizacao } = await admin
      .from("instituicoes").select("nome").eq("id", euPerfil.institution_id).maybeSingle();

    const saiu = await Promise.all((destinatarios ?? []).map(async (pessoa) => {
      const endereco = String(pessoa.email ?? "").trim();
      // O MEMBRO SÓ-NOME NÃO TEM PARA ONDE RECEBER. Quem entra na escala sem
      // acesso ganha um endereço interno (`…@avanest.invalid`), que existe para
      // o banco ter uma chave — não para receber mensagem. Mandar para lá
      // devolveria uma devolução por pessoa, e devolução em excesso é o que
      // derruba a reputação do domínio inteiro.
      if (!enderecoValido(endereco) || /\.invalid$/i.test(endereco)) return false;
      // A PREFERÊNCIA DE QUEM RECEBE vale aqui também. Quem desligou "nova
      // escala publicada" desligou o aviso, e não o meio: trocar o telefone
      // pelo e-mail para entregar a mesma coisa é desrespeitar a escolha por
      // via oblíqua.
      const preferencia = preferenciaDe.get(String(pessoa.id)) ?? comPadrao(null);
      if (!aceita(preferencia, "escala")) return false;
      const meus = escalaDoMes.get(String(pessoa.id)) ?? [];
      if (!meus.length) return false;
      const mensagem = escalaPublicadaEmail({
        nome: pessoa.nome, organizacao: organizacao?.nome ?? "grupo", mes,
        plantoes: meus, autor: euPerfil.nome,
      });
      const resultado = await enviarEmail({ para: endereco, ...mensagem });
      // Falha de e-mail não derruba o aviso: o push já saiu, e a escala está
      // publicada de qualquer forma. Mas fica no log — um domínio não
      // verificado recusa TODOS, e sem rastro isso vira "o sistema não avisa".
      if (!resultado.ok) console.error("[api/push/avisar] e-mail", resultado.erro);
      return resultado.ok;
    }));
    return saiu.filter(Boolean).length;
  };
  const emails = tipo === "escala" ? await mandarOsEmails() : 0;
  // Nem aparelho nem e-mail: o único zero que é configuração do servidor e não
  // escolha da equipe.
  const semCanalNenhum = tipo === "escala" && !emailConfigurado();

  return NextResponse.json({
    ok: true,
    enviadas,
    emails,
    removidas: mortas.length,
    recusadas,
    // Alvos existiam e nenhum tinha aparelho: ESTE é o caso em que a mensagem
    // sobre a equipe não ter ligado as notificações é verdadeira.
    //
    // "Desligaram este aviso" é OUTRA coisa, e precisa de outro nome: dizer a
    // quem publicou a escala que a equipe não ligou as notificações, quando na
    // verdade ela ligou e escolheu não receber este aviso, faz a pessoa cobrar
    // os colegas por uma decisão que eles tomaram de propósito.
    // O MOTIVO SÓ EXISTE QUANDO NADA SAIU POR CANAL NENHUM. Dizer "a equipe
    // não ligou o aviso no aparelho" depois de mandar onze e-mails é contar
    // um fracasso onde houve entrega — e faria quem publicou a escala cobrar
    // os colegas por um aviso que eles receberam.
    //
    // NUMA LINHA SÓ, de propósito: lib/avisos-push.test.ts lê os motivos que
    // esta rota é capaz de devolver procurando as linhas que falam de motivo,
    // e é esse teste que garante que cada um tem frase na tela. Quebrado em
    // quatro linhas, o último sumia da leitura e a tela podia ficar sem a
    // frase — exatamente o defeito que o teste existe para pegar.
    motivo: enviadas > 0 || emails > 0 ? undefined : recusadas > 0 ? "desligado" : semCanalNenhum ? "sem-aparelho-nem-email" : "sem-aparelho",
    alvos: alvos.length,
  });
}
