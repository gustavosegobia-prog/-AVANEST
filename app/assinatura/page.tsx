import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { AssinarButton } from "./assinar-button";
import { SairButton } from "./sair-button";

const WHATSAPP = "https://wa.me/5541997870810";

// A PRIMEIRA FRASE QUE A PESSOA LÊ ao ser trazida para cá. É o fim de um
// caminho: ela criou a conta, usou dois meses, e o sistema a trouxe. Dizer
// "período de teste" seria falar do sistema; dizer "2 meses" é falar do que
// foi combinado com ela na capa.
const MOTIVOS: Record<string, string> = {
  trial: "Seus 2 meses de teste terminaram.",
  ativo: "Sua assinatura venceu.",
  suspenso: "Sua assinatura está suspensa.",
  cancelado: "Sua assinatura foi cancelada.",
  cortesia: "Seu período de cortesia terminou.",
};

type Plano = {
  codigo: string;
  nome: string;
  descricao: string;
  preco_mensal: number | null;
  max_profissionais: number | null;
  sob_consulta: boolean;
};

type Vagas = {
  ativa: boolean; limite: number; restantes: number; meses_gratis: number; termina_em: string | null;
  preco: number; rotulo: string; plano_codigo: string;
};

const dinheiro = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (valor: string | null) =>
  valor ? new Date(valor).toLocaleDateString("pt-BR") : null;

export default async function AssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const { plano: escolhido } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: resultado } = await supabase.rpc("minha_assinatura");
  const assinatura = Array.isArray(resultado) ? resultado[0] : resultado;
  if (!assinatura) redirect("/comecar");

  const [{ data: perfil }, { data: planosData }, { data: vagasData }] = await Promise.all([
    supabase.from("perfis").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("planos").select("*").eq("ativo", true).order("ordem"),
    supabase.rpc("vagas_fundador"),
  ]);
  const podeContratar = ["owner", "admin"].includes(String(perfil?.role ?? ""));

  const planos = (planosData ?? []) as Plano[];
  const vagas = (Array.isArray(vagasData) ? vagasData[0] : vagasData) as Vagas | null;

  const liberada = assinatura.liberada === true;
  const profissionais = Number(assinatura.profissionais ?? 0);
  const ate = data(assinatura.assinatura_ate ?? null);
  const situacao = String(assinatura.plano ?? "");
  const jaEFundador = assinatura.preco_fundador === true;
  const emTeste = liberada && situacao === "trial";

  // O plano em foco é o que veio da vitrine; sem isso, o que a organização já
  // contratou; sem isso, a sugestão do banco pelo tamanho da equipe.
  const alvo =
    planos.find((p) => p.codigo === escolhido && !p.sob_consulta)
    ?? planos.find((p) => p.codigo === assinatura.plano_codigo);

  // O valor mostrado espelha o que reservar_plano cobra no checkout. A
  // campanha antiga não aparece mais para o cliente (a oferta é só o teste de
  // 2 meses), mas uma organização antiga que tenha preço contratado continua
  // vendo — e pagando — o valor dela.
  const campanhaVale = Boolean(vagas?.ativa) && Number(vagas?.meses_gratis ?? 0) > 0;
  const alvoNaCampanha = Boolean(alvo) && alvo!.codigo === vagas?.plano_codigo;
  const precoFundador = jaEFundador && alvoNaCampanha;
  const precoDaCampanha = alvoNaCampanha && (campanhaVale || jaEFundador);

  const mensal = precoFundador
    ? Number(assinatura.preco_contratado ?? vagas!.preco)
    : precoDaCampanha
      ? Number(vagas!.preco)
      : Number(alvo?.preco_mensal ?? assinatura.valor_mensal ?? 0);

  const cabe =
    !alvo || alvo.max_profissionais === null || profissionais <= alvo.max_profissionais;

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnOnboardingCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>
            {liberada
              ? "Sua organização está em dia. Você pode contratar a assinatura mensal a qualquer momento — os dias que ainda restam são somados, não perdidos."
              : "Seus dados continuam guardados e intactos. Nada é apagado enquanto a assinatura estiver parada."}
          </p>
        </div>
        <div className="avnLoginContent">
          <h1>
            {liberada
              ? situacao === "trial" ? "Você está no teste grátis." : "Sua assinatura está ativa."
              : MOTIVOS[situacao] ?? "Assinatura inativa."}
          </h1>
          <p>
            {liberada
              ? <>Acesso liberado em <b>{assinatura.organizacao}</b>{ate ? <> até <b>{ate}</b></> : null}.</>
              : <>Para continuar usando o AVANEST em <b>{assinatura.organizacao}</b>, regularize a assinatura.</>}
          </p>

          {alvo ? (
            <>
              <div className="avnPlanoEscolhido">
                <div className="avnPlanoEscolhidoTopo">
                  <strong>Plano {alvo.nome}</strong>
                </div>
                <small>{alvo.descricao}</small>
                <p className="avnPlanoValor">
                  <strong>{dinheiro(mensal)}</strong><span>/mês</span>
                </p>
                {/* A nota diz quando vence a primeira cobrança, que é o que a
                    pessoa precisa saber aqui. Antes falava em "preço de
                    fundador" e em "promoção para os N primeiros" — e N era o
                    limite técnico da campanha, um número de dez dígitos. */}
                {emTeste && ate ? (
                  <p className="avnPlanoNota sucesso">
                    Você está no teste grátis: assinando agora, a primeira cobrança só vence em {ate}.
                  </p>
                ) : null}
              </div>

              <div className="avnPlanoResumo">
                <div>
                  <small>ANESTESIOLOGISTAS ATIVOS</small>
                  <strong>{profissionais}</strong>
                </div>
                <div>
                  <small>LIMITE DO PLANO</small>
                  <strong>{alvo.max_profissionais ?? "Ilimitado"}</strong>
                </div>
                <div className="destaque">
                  <small>TOTAL MENSAL</small>
                  <strong>{dinheiro(mensal)}<span>/mês</span></strong>
                </div>
              </div>

              {!cabe && (
                <p className="clinicalError" role="alert">
                  A organização tem {profissionais} anestesiologistas e o plano {alvo.nome} atende
                  até {alvo.max_profissionais}. Escolha um plano maior.
                </p>
              )}

              {podeContratar && cabe
                ? <AssinarButton
                    plano={alvo.codigo}
                    rotulo={liberada ? `Contratar o plano ${alvo.nome}` : `Assinar o plano ${alvo.nome}`}
                    valorMensal={mensal}
                  />
                : !podeContratar
                  ? <p className="avnOnboardingEmail">
                      Só o responsável pela organização pode contratar a assinatura.
                    </p>
                  : null}
            </>
          ) : (
            <p className="avnOnboardingEmail">
              Escolha um plano para continuar. A cobrança considera apenas anestesiologistas
              ativos com CRM: recepção, financeiro e administração não ocupam vaga.
            </p>
          )}

          <Link className="avnLoginCancel" href="/planos">Ver todos os planos</Link>
          <a className="avnLoginCancel" href={WHATSAPP} target="_blank" rel="noreferrer">
            Falar com o AVANEST no WhatsApp
          </a>
          {/* Quem chega aqui com a assinatura vencida quase sempre tem uma
              pergunta de cobrança — cartão que não passou, nota fiscal, valor
              diferente do esperado. O WhatsApp resolve o urgente; isto dá o
              endereço de quem trata disso, e deixa registro escrito dos dois
              lados. */}
          <a className="avnLoginCancel" href="mailto:financeiro@avanest.com.br">
            Dúvida de cobrança ou nota fiscal
          </a>
          {liberada
            ? <Link className="avnLoginCancel" href="/dashboard">Voltar ao sistema</Link>
            : <SairButton/>}
        </div>
      </section>
    </main>
  );
}
