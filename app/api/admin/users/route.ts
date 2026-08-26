import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";

const ALLOWED_ROLES = new Set(["recepcao", "medico", "financeiro", "admin"]);
/** Quem não entra na escala, e por isso não tem por que ter CRM no cadastro. */
const SEM_ESCALA = new Set(["recepcao", "financeiro"]);

/** O cliente com a chave de serviço, num lugar só para o tipo casar. */
function clienteAdmin(serviceKey: string) {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
type Admin = ReturnType<typeof clienteAdmin>;

type Criado = { id: string } | { erro: string; status: number };

/** O caminho de sempre: o Supabase manda o e-mail e a pessoa cria a senha. */
async function convidarPorEmail(
  admin: Admin,
  email: string, nome: string, institutionId: string, role: string,
  request: NextRequest,
): Promise<Criado> {
  const redirectTo = new URL("/auth/callback?next=/atualizar-senha", request.nextUrl.origin).toString();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { nome, institution_id: institutionId, role },
  });
  if (error || !data.user) {
    const duplicado = error?.message.toLowerCase().includes("already");
    return {
      erro: duplicado
        ? "Este e-mail já possui um acesso cadastrado."
        : "O Supabase não conseguiu enviar o convite. Confira o e-mail e as configurações de envio.",
      status: 400,
    };
  }
  return { id: data.user.id };
}

/**
 * O profissional que não usa o sistema.
 *
 * A conta de autenticação nasce porque todo o RLS é construído sobre
 * `perfis.id = auth.uid()` — um perfil com id de outra origem obrigaria a
 * revisar o isolamento entre organizações em toda tabela.
 *
 * Ela nasce inútil, de propósito, e são três travas:
 *
 * O endereço vai em `.invalid`, domínio que a RFC 2606 reserva para nunca
 * existir. Nenhuma mensagem sai daqui e nenhuma recuperação de senha chega a
 * lugar nenhum — nem por engano, nem por invasão.
 *
 * A senha é aleatória de 32 bytes e não é devolvida a ninguém: some no fim
 * desta função. Não há como alguém "descobrir a senha da Dra. Ana" porque
 * ninguém nunca a teve.
 *
 * `email_confirm: true` fecha a última porta: sem confirmação pendente, não
 * existe link de confirmação para ser reenviado a lugar nenhum.
 */
async function criarSemAcesso(
  admin: Admin,
  nome: string, institutionId: string,
): Promise<Criado> {
  const marca = crypto.randomUUID();
  const senha = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email: `sem-acesso.${marca}@avanest.invalid`,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, institution_id: institutionId, role: "medico", sem_acesso: true },
  });
  if (error || !data.user) {
    return { erro: "Não foi possível criar o cadastro. Tente de novo.", status: 500 };
  }
  return { id: data.user.id };
}


export async function POST(request: NextRequest) {
  // Confere a origem antes de qualquer outra coisa: é a conta do Supabase que
  // dispara o e-mail de convite, e é o nosso domínio que aparece nele.
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  // Vinte convites por hora por administrador. Um administrador legítimo
  // cadastra a equipe uma vez; uma conta tomada usaria esta rota para disparar
  // e-mail em massa saindo do nosso domínio — e quem paga a fatura de
  // reputação é o AVANEST, com os e-mails dos clientes indo para spam.
  const excedeu = enforceRateLimit(`convite-usuario:${user.id}`, { limit: 20, windowMs: 3_600_000 });
  if (excedeu) return excedeu;

  const { data: actor } = await supabase
    .from("perfis")
    .select("id,institution_id,role,status")
    .eq("id", user.id)
    .single();
  if (!actor || actor.status !== "ativo" || !["admin", "owner"].includes(actor.role)) {
    return NextResponse.json({ error: "Você não tem permissão para adicionar usuários." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const nome = String(body?.nome ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = String(body?.role ?? "");
  const semAcesso = body?.sem_acesso === true;
  const crm = String(body?.crm ?? "").trim();
  const rqe = String(body?.rqe ?? "").trim();

  if (!nome || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Confira nome e área de acesso." }, { status: 400 });
  }
  if (semAcesso) {
    // Sem acesso só faz sentido para quem entra na escala. Um cadastro sem
    // login e sem CRM produz alguém que não consegue entrar no sistema nem ser
    // escalado — existe na lista da equipe e não serve para nada.
    if (role !== "medico") {
      return NextResponse.json({
        error: "Cadastro sem acesso é para anestesiologista. Recepção e financeiro precisam entrar no sistema para trabalhar.",
      }, { status: 400 });
    }
    if (!crm) {
      return NextResponse.json({
        error: "Informe o CRM. Sem ele o profissional não entra na escala, e é para isso que este cadastro existe.",
      }, { status: 400 });
    }
  } else if (!email.includes("@")) {
    return NextResponse.json({ error: "Confira o e-mail." }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({
      error: "A criação de usuários ainda não foi habilitada no servidor. Configure a chave administrativa do Supabase na Vercel.",
    }, { status: 503 });
  }

  const admin = clienteAdmin(serviceKey);
  const criado = semAcesso
    ? await criarSemAcesso(admin, nome, actor.institution_id)
    : await convidarPorEmail(admin, email, nome, actor.institution_id, role, request);
  if ("erro" in criado) {
    return NextResponse.json({ error: criado.erro }, { status: criado.status });
  }

  const { error: profileError } = await admin.from("perfis").insert({
    id: criado.id,
    institution_id: actor.institution_id,
    nome,
    // Sem e-mail no perfil: o endereço em .invalid é um detalhe de como a
    // conta foi criada, e mostrá-lo na tela da equipe seria oferecer para o
    // administrador um contato que não existe.
    email: semAcesso ? null : email,
    role,
    status: "ativo",
    // Quem nunca vê tela de login não tem senha para trocar.
    must_reset: !semAcesso,
    permissoes: [],
    sem_acesso: semAcesso,
    // O CRM entra já no convite, e não só no cadastro sem acesso.
    //
    // O perfil nasce aqui, no instante do convite — antes de a pessoa clicar
    // no e-mail. Só que a escala só oferece quem tem CRM, então o convidado
    // ficava invisível para o coordenador até ativar a conta e preencher o
    // próprio cadastro. Quem monta a escala do mês seguinte precisa dela hoje,
    // e a saída era cadastrar a mesma pessoa duas vezes: uma "sem acesso" para
    // escalar agora, outra de verdade depois — e então mudar os plantões de
    // dono na mão. Com o CRM aqui, o convidado entra na escala no mesmo dia, e
    // quando ele ativa a conta os plantões já são dele.
    //
    // Continua opcional: quem não souber o CRM na hora convida assim mesmo, e
    // a pessoa preenche no primeiro acesso.
    //
    // Recepção e financeiro ficam de fora: eles não entram na escala, e um CRM
    // guardado ali seria dado sem uso à espera de confundir alguém.
    ...(crm && !SEM_ESCALA.has(role) ? { crm, rqe: rqe || null } : {}),
  });
  if (profileError) {
    return NextResponse.json({ error: "O usuário foi convidado, mas o perfil não pôde ser criado. Revise a tabela de perfis." }, { status: 500 });
  }

  await supabase.from("auditoria").insert({
    institution_id: actor.institution_id,
    actor_id: actor.id,
    entidade: "perfil",
    entidade_id: criado.id,
    acao: semAcesso ? "profissional_sem_acesso_criado" : "usuario_convidado",
    detalhes: semAcesso ? { nome, crm, role } : { email, role },
  });

  return NextResponse.json({ ok: true });
}
