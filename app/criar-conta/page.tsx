import type { Metadata } from "next";

// Título próprio: herdava o da capa, igual ao de /login e /comecar. Ver o
// comentário em app/login/page.tsx.
export const metadata: Metadata = {
  title: "Criar conta no AVANEST",
  description: "Crie sua conta no AVANEST e comece a usar a avaliação pré-anestésica, a escala do serviço e o controle financeiro em um sistema só.",
  alternates: { canonical: "/criar-conta" },
};

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { SignUpForm } from "./sign-up-form";

const PAPEIS: Record<string, string> = {
  admin: "Administrador", medico: "Anestesiologista",
  recepcao: "Recepção", financeiro: "Financeiro",
};

export default async function CriarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string; plano?: string }>;
}) {
  const { convite: token, plano } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    if (token) redirect(`/convite/${encodeURIComponent(token)}`);
    redirect(plano ? `/comecar?plano=${encodeURIComponent(plano)}` : "/dashboard");
  }

  // Quem vem da vitrine com um plano escolhido cria a conta aqui mesmo. Antes
  // esse caminho não existia: o visitante clicava em Assinar, caía no login e
  // não tinha como seguir. O plano viaja junto até o checkout.
  if (!token && plano) {
    const { data: planoData } = await supabase
      .from("planos").select("nome,preco_mensal,preco_por_profissional")
      .eq("codigo", plano).eq("ativo", true).maybeSingle();
    const { data: vagasData } = await supabase.rpc("vagas_fundador");
    const vagas = Array.isArray(vagasData) ? vagasData[0] : vagasData;
    // A campanha vale para qualquer plano agora: são meses grátis, não um
    // preço especial de um plano só. A data de término já entra no `ativa`.
    const mesesGratis = Number(vagas?.meses_gratis ?? 0);
    const naCampanha = vagas?.ativa === true && mesesGratis > 0;
    const reais = (valor: number) =>
      Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    return (
      <main className="avnLoginPage">
        <section className="avnLoginCard avnOnboardingCard">
          <div className="avnLoginIllustration">
            <AppLogo />
            <p>Sua organização nasce com seus próprios pacientes e documentos, sem acesso aos dados de ninguém.</p>
          </div>
          <div className="avnLoginContent">
            <h1>Criar sua conta</h1>
            {planoData ? (
              <p>
                Plano <b>{planoData.nome}</b>{" "}
                {planoData.preco_por_profissional != null
                  ? <>por <b>{reais(Number(planoData.preco_por_profissional))} por anestesiologista/mês</b></>
                  : <>por <b>{reais(Number(planoData.preco_mensal))}/mês</b></>}
                {naCampanha && <> — com <b>{mesesGratis} {mesesGratis === 1 ? "mês" : "meses"} grátis</b> pela campanha de lançamento</>}.
                {" "}Depois de criar a conta você escolhe individual ou grupo e conclui o pagamento.
              </p>
            ) : (
              <p>Crie sua conta para escolher o plano e concluir a assinatura.</p>
            )}
            <SignUpForm token="" email="" plano={plano} />
          </div>
        </section>
      </main>
    );
  }

  // Sem convite e sem plano não há cadastro aberto: as contas nascem de um
  // convite ou da escolha de um plano na vitrine.
  if (!token) {
    return (
      <main className="avnLoginPage">
        <section className="avnLoginCard avnOnboardingCard">
          <div className="avnLoginIllustration"><AppLogo /></div>
          <div className="avnLoginContent">
            <h1>Cadastro por convite</h1>
            <p>O acesso ao AVANEST é criado a partir de um convite enviado pelo responsável da sua organização. Peça o link a quem administra o sistema.</p>
            <Link className="avnLoginCancel" href="/login">Voltar para o login</Link>
          </div>
        </section>
      </main>
    );
  }

  const { data } = await supabase.rpc("convite_info", { p_token: token });
  const convite = Array.isArray(data) ? data[0] : data;
  const invalido = !convite || convite.valido !== true;

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnOnboardingCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>Sua conta dá acesso apenas à organização que convidou você.</p>
        </div>
        <div className="avnLoginContent">
          {invalido ? (
            <>
              <h1>Convite indisponível</h1>
              <p>Este convite não existe, já foi utilizado ou passou da validade. Peça um novo ao responsável pelo grupo.</p>
              <Link className="avnLoginCancel" href="/login">Voltar para o login</Link>
            </>
          ) : (
            <>
              <h1>Criar sua conta</h1>
              <p>
                Convite de <b>{convite.organizacao}</b> como{" "}
                <b>{PAPEIS[convite.papel] ?? convite.papel}</b>.
              </p>
              <SignUpForm token={token} email={String(convite.email)} />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
