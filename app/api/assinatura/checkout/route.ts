import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { provedorAtivo } from "@/lib/pagamentos";

// A data de vigência dos documentos publicados. Fica junto do código que
// grava o aceite para não sair de sincronia com o texto: mudou /termos ou
// /privacidade, muda aqui, e os aceites novos passam a apontar para a versão
// nova sem mexer nos antigos.
const VERSAO_DOCUMENTOS = "2026-08-19";

// Abre o checkout da assinatura mensal.
//
// O navegador manda qual plano quer, nunca quanto vai pagar. Quem decide o
// preço é reservar_plano, no banco, com a campanha travada — é lá que a vaga
// de fundador é disputada e o valor fica congelado.

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  const corpo = await request.json().catch(() => null) as { plano?: unknown; aceite?: unknown } | null;
  const codigo = typeof corpo?.plano === "string" ? corpo.plano.trim() : "";
  if (!codigo) {
    return NextResponse.json({ error: "Escolha um plano antes de continuar." }, { status: 400 });
  }
  // O aceite é conferido aqui, e não só na tela: caixa marcada no navegador
  // não é prova de nada, e quem chamar esta rota por fora também precisa
  // passar por ela. Sem aceite, não abre pagamento.
  if (corpo?.aceite !== true) {
    return NextResponse.json(
      { error: "É preciso aceitar os Termos de Uso e a Política de Privacidade antes de assinar." },
      { status: 400 },
    );
  }

  const { data: perfil } = await supabase
    .from("perfis").select("id,institution_id,role,status").eq("id", user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo") {
    return NextResponse.json({ error: "Perfil inativo." }, { status: 403 });
  }
  if (!["owner", "admin"].includes(perfil.role)) {
    return NextResponse.json(
      { error: "Só o responsável pela organização pode contratar a assinatura." },
      { status: 403 },
    );
  }

  // Quem já tem assinatura ativa não abre outra. Duas assinaturas na mesma
  // organização cobrariam duas vezes, e a segunda passaria a mandar no
  // vínculo — a renovação da primeira chegaria sem dono. Trocar de plano ou
  // encerrar é pelo painel da conta.
  const { data: atual } = await supabase
    .from("instituicoes").select("plano,pagamento_assinatura_id")
    .eq("id", perfil.institution_id).maybeSingle();
  if (atual?.plano === "ativo" && atual.pagamento_assinatura_id) {
    return NextResponse.json({
      error: "Esta organização já tem uma assinatura ativa. Para trocar de plano ou encerrar, use o painel da conta.",
    }, { status: 409 });
  }

  const provedor = provedorAtivo();
  if (!provedor) {
    return NextResponse.json(
      { error: "O pagamento online ainda não foi habilitado. Fale com o AVANEST pelo WhatsApp." },
      { status: 503 },
    );
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "O servidor não está configurado para registrar a assinatura." },
      { status: 503 },
    );
  }

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Reserva antes de falar com o gateway: a vaga de fundador e o preço
  // saem daqui, e a função recusa plano inexistente, plano sob consulta e
  // equipe maior do que o plano comporta.
  const { data: reservaData, error: erroReserva } = await admin.rpc("reservar_plano", {
    p_institution_id: perfil.institution_id,
    p_codigo: codigo,
  });
  if (erroReserva) {
    console.error("[assinatura/checkout] reservar", erroReserva);
    // A mensagem da função é escrita para o cliente ler ("o plano X atende
    // até N"), então vale mais do que um texto genérico.
    return NextResponse.json({ error: erroReserva.message }, { status: 400 });
  }
  const reserva = Array.isArray(reservaData) ? reservaData[0] : reservaData;
  const valorMensal = Number(reserva?.preco ?? 0);
  if (!(valorMensal > 0)) {
    return NextResponse.json({ error: "Não foi possível calcular o valor do plano." }, { status: 500 });
  }

  // Carimba o aceite antes de falar com o gateway. A função só preenche
  // se ainda estiver vazio, então o registro guarda a primeira vez — que é a
  // que importa — e não a última tentativa de checkout.
  const { error: erroAceite } = await admin.rpc("registrar_aceite_termos", {
    p_institution_id: perfil.institution_id,
    p_perfil_id: perfil.id,
    p_versao: VERSAO_DOCUMENTOS,
  });
  if (erroAceite) {
    console.error("[assinatura/checkout] aceite", erroAceite);
    return NextResponse.json({ error: "Não foi possível registrar o aceite dos termos." }, { status: 500 });
  }

  const { data: assinaturaData } = await supabase.rpc("minha_assinatura");
  const assinatura = Array.isArray(assinaturaData) ? assinaturaData[0] : assinaturaData;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://avanest.com.br";

  let criada;
  try {
    criada = await provedor.criarAssinatura({
      institutionId: perfil.institution_id,
      organizacao: String(assinatura?.organizacao ?? "Organização"),
      plano: String(reserva?.plano_nome ?? codigo),
      emailPagador: user.email ?? "",
      valorMensal,
      retornoSucesso: `${site}/assinatura/retorno`,
      retornoCancelado: `${site}/dashboard`,
    });
  } catch (erro) {
    // O motivo real vai para o log do servidor; o cliente recebe algo útil.
    console.error("[assinatura/checkout]", provedor.nome, erro);
    return NextResponse.json({
      error: "Não foi possível abrir o pagamento agora. Tente de novo ou fale com o AVANEST.",
    }, { status: 502 });
  }

  // Guarda o vínculo com a chave de serviço: as colunas são protegidas contra
  // escrita pelo cliente, e é isso que impede alguém de se dar acesso grátis.
  const { error } = await admin.rpc("vincular_assinatura", {
    p_institution_id: perfil.institution_id,
    p_provedor: criada.provedor,
    p_assinatura_id: criada.referencia,
    p_cliente_id: criada.clienteId ?? null,
    p_email: user.email ?? "",
  });
  if (error) {
    console.error("[assinatura/checkout] vincular", error);
    return NextResponse.json({ error: "A assinatura foi criada, mas não ficou registrada. Fale com o AVANEST." }, { status: 500 });
  }

  return NextResponse.json({ url: criada.url });
}
