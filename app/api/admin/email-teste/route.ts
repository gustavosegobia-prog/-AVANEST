import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { enforceRateLimit, validateMutationRequest } from "@/lib/request-security";
import { emailConfigurado, enviarEmail, provedorDeEmail } from "@/lib/email";
import { emailDeTeste } from "@/lib/email-teste";

// Manda o e-mail de boas-vindas para quem está configurando, para provar que
// o caminho funciona antes de um cliente pagante depender dele.
//
// O DESTINO NUNCA VEM DO NAVEGADOR. É sempre o endereço da própria sessão,
// e essa é a regra que segura a rota inteira: aceitar um destinatário de fora
// transformaria isto num disparador de mensagens com o remetente
// avanest.com.br, assinado com o nosso DKIM. Quem quiser testar outro
// endereço entra com aquela conta.
//
// Diferente do webhook, aqui a falha é dita em voz alta. O webhook engole o
// erro de e-mail de propósito, porque não pode derrubar um pagamento; este
// existe SÓ para encontrar o erro, e um "não deu certo" genérico não serviria
// para nada — o valor está em dizer se foi a chave, o domínio ou o remetente.

export async function POST(request: NextRequest) {
  const origemInvalida = validateMutationRequest(request, { requireJson: true });
  if (origemInvalida) return origemInvalida;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  const { data: perfil } = await supabase
    .from("perfis").select("nome,institution_id,role,status").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo" || !["owner", "admin"].includes(perfil.role)) {
    return NextResponse.json(
      { error: "Só o responsável pela organização pode mandar o teste." },
      { status: 403 },
    );
  }

  // Teste se faz uma vez, confere e pronto. O limite existe porque cada envio
  // gasta cota do provedor, e porque um botão que dispara e-mail sem freio é
  // um jeito de queimar a reputação do próprio domínio.
  const excedeu = enforceRateLimit(`email-teste:${user.id}`, { limit: 5, windowMs: 3_600_000 });
  if (excedeu) return excedeu;

  if (!emailConfigurado()) {
    return NextResponse.json({
      error: "Falta a chave do serviço de e-mail nas variáveis de ambiente da Vercel "
        + "(RESEND_API_KEY ou SENDGRID_API_KEY). Depois de adicionar, faça um redeploy.",
    }, { status: 503 });
  }

  const { data: instituicao } = await supabase
    .from("instituicoes").select("nome,tipo,valor_por_profissional")
    .eq("id", perfil.institution_id).maybeSingle();

  const mensagem = emailDeTeste({
    nome: perfil.nome,
    organizacao: instituicao?.nome ?? "Sua organização",
    plano: instituicao?.tipo === "grupo" ? "Grupo" : "Solo",
    valorMensal: Number(instituicao?.valor_por_profissional ?? 0) || 129,
  });

  const resultado = await enviarEmail({ para: user.email, ...mensagem });

  if (!resultado.ok) {
    // O motivo cru do provedor vai junto. É feio de ler e é o que resolve:
    // "403 domain is not verified" e "401 API key is invalid" pedem coisas
    // opostas, e sem o texto os dois viram a mesma tarde perdida.
    console.error("[admin/email-teste]", resultado.erro);
    return NextResponse.json({
      error: `O provedor recusou o envio: ${resultado.erro}`,
      dica: dicaPara(resultado.erro),
      provedor: provedorDeEmail(),
    }, { status: 502 });
  }

  return NextResponse.json({ ok: true, para: user.email, provedor: resultado.provedor });
}

/** Traduz os erros que de fato aparecem nesta configuração. */
function dicaPara(erro: string) {
  const texto = erro.toLowerCase();
  if (texto.includes("401") || texto.includes("api key")) {
    return "A chave parece inválida. Confira se foi colada inteira na Vercel e se houve redeploy depois.";
  }
  if (texto.includes("403") || texto.includes("not verified") || texto.includes("domain")) {
    return "O domínio ainda não está verificado no provedor, ou o EMAIL_REMETENTE usa um domínio diferente do verificado.";
  }
  if (texto.includes("422") || texto.includes("from")) {
    return "O remetente foi recusado. O EMAIL_REMETENTE deve ser no formato: AVANEST <contato@avanest.com.br>";
  }
  if (texto.includes("429")) return "Cota do provedor esgotada por agora. Tente mais tarde.";
  return "";
}
