import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { Icone } from "@/components/icone";
import { AssinarButton } from "./assinar-button";

const WHATSAPP = "https://wa.me/5541997870810";

const MOTIVOS: Record<string, string> = {
  trial: "Seu período de teste terminou.",
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
  ativa: boolean; limite: number; restantes: number;
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

  // O plano em foco é o que veio da vitrine; sem isso, o que a organização já
  // contratou; sem isso, a sugestão do banco pelo tamanho da equipe.
  const alvo =
    planos.find((p) => p.codigo === escolhido && !p.sob_consulta)
    ?? planos.find((p) => p.codigo === assinatura.plano_codigo);

  // Enquanto a campanha valer e a organização couber nela, o preço mostrado é
  // o de lançamento. Quem já é fundador mantém o preço congelado que contratou.
  const campanhaVale = Boolean(vagas?.ativa) && Number(vagas?.restantes ?? 0) > 0;
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
                  {precoFundador && (
                    <span className="planoSelo fundador">
                      <Icone nome="estrela" tamanho={13} /> {vagas!.rotulo}
                    </span>
                  )}
                </div>
                <small>{alvo.descricao}</small>
                <p className="avnPlanoValor">
                  <strong>{dinheiro(mensal)}</strong><span>/mês</span>
                </p>
                {precoFundador ? (
                  <p className="avnPlanoNota sucesso">
                    Preço de fundador garantido enquanto a assinatura seguir ativa.
                  </p>
                ) : precoDaCampanha ? (
                  <p className="avnPlanoNota sucesso">
                    Promoção para os {vagas!.limite} primeiros: este valor fica
                    travado para sempre enquanto a assinatura seguir ativa.
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
          <Link className="avnLoginCancel" href={liberada ? "/dashboard" : "/login"}>
            {liberada ? "Voltar ao sistema" : "Sair"}
          </Link>
        </div>
      </section>
    </main>
  );
}
