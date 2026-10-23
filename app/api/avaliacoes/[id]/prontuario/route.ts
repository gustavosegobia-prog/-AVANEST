import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import {
  ACAO_ENVIADA, ACAO_FALHOU, PDF_MAXIMO, destinoDoProntuario, mascararEmail,
  mensagemDoProntuario, nomeDoArquivo, pdfAceito,
} from "@/lib/email-prontuario";

// O ENVIO DA AVALIAÇÃO AO PRONTUÁRIO DO HOSPITAL (lib/email-prontuario.ts).
//
// GET diz à tela se este local manda, para onde (mascarado) e se já foi.
// POST recebe o PDF que a tela montou e manda para o endereço do CADASTRO DO
// LOCAL — o corpo do pedido nunca diz o destino.
//
// O PDF é montado no navegador, e não aqui, porque a ficha já existe pronta na
// tela de documentos, com o mesmo desenho do papel. Refazê-la no servidor
// seria manter dois desenhos da mesma ficha, e um deles sairia diferente.

type RouteContext = { params: Promise<{ id: string }> };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEM_CACHE = { "Cache-Control": "no-store" };

const resposta = (corpo: unknown, status = 200) =>
  NextResponse.json(corpo, { status, headers: SEM_CACHE });

type Contexto =
  | { erro: NextResponse }
  | {
      erro?: undefined;
      admin: SupabaseClient;
      ator: { id: string; institution_id: string; nome: string | null };
      avaliacao: {
        id: string; status: string; versao: number | null; concluida_at: string | null;
        local_atendimento_id: string | null;
        snapshot_conclusao: Record<string, unknown> | null;
        dados: Record<string, unknown> | null;
        local_snapshot: Record<string, unknown> | null;
        pacientes: { nome?: string | null } | null;
      };
      destino: string | null;
    };

/** Quem pede, se pode, e a avaliação com o destino do local dela. */
async function carregar(id: string): Promise<Contexto> {
  if (!UUID_PATTERN.test(id)) return { erro: resposta({ error: "Identificador de avaliação inválido." }, 400) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: resposta({ error: "Sua sessão expirou. Entre novamente." }, 401) };

  const { data: ator } = await supabase
    .from("perfis")
    .select("id,institution_id,role,status,permissoes,nome")
    .eq("id", user.id)
    .single();
  // A mesma regra de quem conclui avaliação (rota de faturar): quem pode
  // concluir pode mandar o documento que acabou de concluir.
  const extras: string[] = Array.isArray(ator?.permissoes) ? ator.permissoes : [];
  const fazAvaliacao = Boolean(ator)
    && (["medico", "admin", "owner"].includes(ator!.role) || extras.includes("medico") || extras.includes("todos"));
  if (!ator || ator.status !== "ativo" || !fazAvaliacao) {
    return { erro: resposta({ error: "Perfil sem permissão para enviar avaliações." }, 403) };
  }

  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) return { erro: resposta({ error: "O envio ao prontuário não está configurado no servidor." }, 503) };
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: avaliacao } = await admin
    .from("avaliacoes")
    .select("id,status,versao,concluida_at,local_atendimento_id,snapshot_conclusao,dados,local_snapshot,pacientes(nome)")
    .eq("id", id)
    .eq("institution_id", ator.institution_id)
    .maybeSingle();
  if (!avaliacao) return { erro: resposta({ error: "Avaliação não encontrada." }, 404) };

  // Consulta à parte e com o erro tolerado: enquanto a migration da coluna não
  // tiver rodado, o PostgREST recusa a consulta inteira. Aí o local fica sem
  // destino — nada é enviado — em vez de a tela de documentos quebrar.
  let destino: string | null = null;
  if (avaliacao.local_atendimento_id) {
    const { data: local, error } = await admin
      .from("locais_atendimento")
      .select("email_prontuario")
      .eq("id", avaliacao.local_atendimento_id)
      .eq("institution_id", ator.institution_id)
      .maybeSingle();
    if (error) console.error("[prontuario] local", error.message);
    destino = destinoDoProntuario(local?.email_prontuario);
  }

  return {
    admin,
    ator: { id: ator.id, institution_id: ator.institution_id, nome: ator.nome ?? null },
    avaliacao: avaliacao as unknown as Extract<Contexto, { admin: SupabaseClient }>["avaliacao"],
    destino,
  };
}

/** O último envio que deu certo desta avaliação, se houve. */
async function ultimoEnvio(admin: SupabaseClient, institutionId: string, id: string) {
  const { data } = await admin
    .from("auditoria")
    .select("created_at,detalhes")
    .eq("institution_id", institutionId)
    .eq("entidade", "avaliacao")
    .eq("entidade_id", id)
    .eq("acao", ACAO_ENVIADA)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const para = (data.detalhes as { para?: string } | null)?.para ?? "";
  return { em: data.created_at as string, para: para ? mascararEmail(para) : "" };
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const ctx = await carregar(id);
  if (ctx.erro) return ctx.erro;
  const envio = await ultimoEnvio(ctx.admin, ctx.ator.institution_id, id);
  return resposta({
    configurado: Boolean(ctx.destino),
    // Local com destino, mas servidor sem chave de e-mail: a tela avisa em
    // vez de tentar e falhar.
    emailAtivo: emailConfigurado(),
    destino: ctx.destino ? mascararEmail(ctx.destino) : null,
    concluida: ctx.avaliacao.status === "concluida",
    concluidaEm: ctx.avaliacao.concluida_at,
    enviadaEm: envio?.em ?? null,
    enviadaPara: envio?.para ?? null,
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  // Base64 engorda um terço; o resto é folga para o JSON em volta.
  const recusado = validateMutationRequest(request, { requireJson: true, maxBytes: Math.ceil(PDF_MAXIMO * 1.4) });
  if (recusado) return recusado;

  const { id } = await params;
  const ctx = await carregar(id);
  if (ctx.erro) return ctx.erro;
  const { admin, ator, avaliacao, destino } = ctx;

  // Cada envio é uma ficha de paciente saindo do sistema. Poucos por minuto
  // bastam para o uso real e travam um laço de conta tomada.
  const excedeu = enforceRateLimit(`avaliacao-prontuario:${ator.id}`, { limit: 10, windowMs: 60_000 });
  if (excedeu) return excedeu;

  if (avaliacao.status !== "concluida") {
    return resposta({ error: "Só a avaliação concluída vai para o prontuário." }, 409);
  }
  if (!destino) {
    return resposta({ error: "Este local não tem e-mail de prontuário cadastrado." }, 409);
  }
  if (!emailConfigurado()) {
    return resposta({ error: "O envio de e-mail não está configurado no servidor." }, 503);
  }

  const corpo = await request.json().catch(() => null) as { pdf?: unknown; reenviar?: unknown } | null;
  const base64 = typeof corpo?.pdf === "string" ? corpo.pdf.replace(/^data:[^,]*,/, "") : "";
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  const veredito = pdfAceito(bytes);
  if (veredito !== "ok") {
    const motivo = veredito === "grande" ? "O PDF passou do tamanho permitido." : "O arquivo enviado não é um PDF válido.";
    return resposta({ error: motivo }, veredito === "grande" ? 413 : 400);
  }

  // Uma vez por avaliação, a menos que alguém peça de novo pelo botão. Abrir a
  // tela duas vezes não pode encher a caixa do hospital com a mesma ficha.
  const anterior = await ultimoEnvio(admin, ator.institution_id, avaliacao.id);
  if (anterior && corpo?.reenviar !== true) {
    return resposta({ ok: true, jaEnviada: true, enviadaEm: anterior.em, enviadaPara: anterior.para });
  }

  const dados = (avaliacao.snapshot_conclusao || avaliacao.dados || {}) as Record<string, unknown>;
  const local = avaliacao.local_snapshot ?? {};
  const paciente = String(avaliacao.pacientes?.nome ?? "").trim();
  const mensagem = mensagemDoProntuario({
    paciente,
    anestesiologista: String(dados.anestesiologista ?? dados.concluido_por_nome ?? ""),
    crm: String(dados.crm ?? dados.concluido_por_crm ?? ""),
    local: String(local.nome_fantasia || local.nome || ""),
    concluidaEm: avaliacao.concluida_at,
    referencia: `AVA-${avaliacao.id.slice(0, 8)} · v${avaliacao.versao ?? 1}`,
  });

  const resultado = await enviarEmail({
    para: destino,
    assunto: mensagem.assunto,
    html: mensagem.html,
    texto: mensagem.texto,
    anexos: [{
      nome: nomeDoArquivo(paciente, avaliacao.concluida_at),
      base64: Buffer.from(bytes).toString("base64"),
      tipo: "application/pdf",
    }],
  });

  // O rastro responde "quem mandou a ficha de quem, para onde, e chegou?".
  // O endereço vai inteiro para a auditoria (só administradores leem); a tela
  // recebe a versão mascarada.
  await admin.from("auditoria").insert({
    institution_id: ator.institution_id,
    actor_id: ator.id,
    user_id: ator.id,
    entidade: "avaliacao",
    entidade_id: avaliacao.id,
    acao: resultado.ok ? ACAO_ENVIADA : ACAO_FALHOU,
    detalhes: resultado.ok
      ? { para: destino, provedor: resultado.provedor, mensagem_id: resultado.id, reenvio: Boolean(anterior), enviado_por: ator.nome }
      : { para: destino, erro: resultado.erro.slice(0, 300), enviado_por: ator.nome },
  });

  if (!resultado.ok) {
    console.error("[prontuario] envio", resultado.erro);
    return resposta({ error: "Não foi possível enviar o e-mail agora. Tente novamente." }, 502);
  }
  return resposta({ ok: true, enviadaEm: new Date().toISOString(), enviadaPara: mascararEmail(destino) });
}
