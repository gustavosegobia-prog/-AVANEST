import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { validateMutationRequest } from "@/lib/request-security";
import { chavesDoAmbiente, enviar, type Inscricao, type Notificacao } from "@/lib/push";
import { nomeCurto } from "@/lib/escala";
import { ultimoDiaDoMes } from "@/lib/data-local";

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

  const alvos: Alvo[] = [];

  if (tipo === "troca" || tipo === "troca_resolvida") {
    if (!id) return NextResponse.json({ error: "Falta a troca." }, { status: 400 });
    const { data: troca } = await supabase
      .from("trocas_plantao")
      .select("id, plantao_id, solicitante_id, destinatario_id, status, mensagem")
      .eq("id", id).maybeSingle();
    // Nulo aqui é o RLS dizendo que esta pessoa não vê esta troca. A resposta é
    // a mesma de "não existe", de propósito: distinguir as duas confirmaria a
    // existência de uma troca de outra organização.
    if (!troca) return NextResponse.json({ error: "Troca não encontrada." }, { status: 404 });

    // O local do plantão vem de dois lugares: `local_texto`, digitado à mão, ou
    // `local_id`, apontando para o cadastro. A escala aceita os dois, e o
    // aviso precisa dizer ONDE — "o plantão de 05/09" sem hospital não ajuda
    // quem cobre três casas na mesma semana.
    const { data: plantao } = await supabase
      .from("plantoes").select("data, hora_inicio, local_texto, local_id")
      .eq("id", troca.plantao_id).maybeSingle();
    let nomeDoLocal = plantao?.local_texto ?? "";
    if (!nomeDoLocal && plantao?.local_id) {
      const { data: local } = await supabase
        .from("locais_atendimento").select("nome_fantasia, nome").eq("id", plantao.local_id).maybeSingle();
      nomeDoLocal = local?.nome_fantasia || local?.nome || "";
    }
    const quando = plantao?.data
      ? `${plantao.data.split("-").reverse().slice(0, 2).join("/")}${plantao.hora_inicio ? ` às ${String(plantao.hora_inicio).slice(0, 5)}` : ""}`
      : "";
    const onde = nomeDoLocal ? ` no ${nomeDoLocal}` : "";
    const eu = nomeCurto(euPerfil.nome ?? "");

    if (tipo === "troca") {
      const notificacao: Notificacao = {
        titulo: troca.destinatario_id ? "Convite de plantão" : "Plantão oferecido",
        corpo: `${eu} ${troca.destinatario_id ? "convidou você para" : "ofereceu"} o plantão de ${quando}${onde}.`,
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
          titulo: troca.status === "aceita" ? "Plantão assumido" : "Plantão recusado",
          corpo: `${eu} ${troca.status === "aceita" ? "assumiu" : "recusou"} o seu plantão de ${quando}${onde}.`,
          url: "/dashboard?area=plantoes",
          tag: `troca-${troca.id}`,
        },
      });
    }
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
    const { data: plantoes, error: erroPlantoes } = await supabase
      .from("plantoes").select("perfil_id")
      .gte("data", `${mes}-01`).lte("data", ultimoDiaDoMes(mes)).neq("situacao", "cancelado");
    // Erro de consulta não é "ninguém para avisar". Confundir os dois foi
    // exatamente o que escondeu o defeito acima por semanas.
    if (erroPlantoes) {
      console.error("[api/push/avisar] plantões do mês", erroPlantoes);
      return NextResponse.json({ ok: true, enviadas: 0, motivo: "falha-consulta" });
    }
    const nomeDoMes = new Date(`${mes}-02T12:00:00Z`)
      .toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
    const notificacao: Notificacao = {
      titulo: "Escala publicada",
      corpo: `A escala de ${nomeDoMes} está no ar. Confira os seus plantões.`,
      url: "/dashboard?area=plantoes",
      // Uma tag por mês: republicar a escala substitui o aviso anterior em vez
      // de empilhar mais um.
      tag: `escala-${mes}`,
    };
    for (const p of new Set((plantoes ?? []).map((x) => x.perfil_id))) {
      if (p && p !== euPerfil.id) alvos.push({ perfilId: p, notificacao });
    }
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
  const { data: inscricoes } = await admin
    .from("push_inscricoes")
    .select("id, perfil_id, endpoint, p256dh, auth")
    .in("perfil_id", [...new Set(alvos.map((a) => a.perfilId))])
    // Nunca fora da organização de quem pediu, mesmo com a chave de serviço na
    // mão: o RLS não protege aqui, então a condição é escrita à mão.
    .eq("institution_id", euPerfil.institution_id);

  const porPerfil = new Map<string, Notificacao>();
  for (const alvo of alvos) porPerfil.set(alvo.perfilId, alvo.notificacao);

  const mortas: string[] = [];
  const entregues: string[] = [];
  let enviadas = 0;
  // Em paralelo: dez aparelhos em série somariam dez idas ao serviço de push
  // dentro do clique de quem ofereceu o plantão.
  await Promise.all((inscricoes ?? []).map(async (linha) => {
    const notificacao = porPerfil.get(linha.perfil_id);
    if (!notificacao) return;
    const resultado = await enviar(chaves, linha as unknown as Inscricao, notificacao);
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

  return NextResponse.json({
    ok: true,
    enviadas,
    removidas: mortas.length,
    // Alvos existiam e nenhum tinha aparelho: ESTE é o caso em que a mensagem
    // sobre a equipe não ter ligado as notificações é verdadeira.
    motivo: enviadas === 0 ? "sem-aparelho" : undefined,
    alvos: alvos.length,
  });
}
