import type { Metadata } from "next";
import { paginaPublica } from "@/lib/metadados";

// Título próprio: herdava o da capa, igual ao de /login e /comecar. Ver o
// comentário em app/login/page.tsx.
export const metadata: Metadata = paginaPublica({
  titulo: "Criar conta no AVANEST",
  descricao: "Crie sua conta no AVANEST e comece a usar a avaliação pré-anestésica, a escala do serviço e o controle financeiro em um sistema só.",
  caminho: "/criar-conta",
});

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { SignUpForm } from "./sign-up-form";
import { MESES_DE_TESTE, dataPorExtenso, fimDoTeste } from "@/lib/teste-gratis";
import { origemDoLink } from "@/lib/link-da-campanha";

const PAPEIS: Record<string, string> = {
  admin: "Administrador", medico: "Anestesiologista",
  recepcao: "Recepção", financeiro: "Financeiro",
};

export default async function CriarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ convite?: string; plano?: string; origem?: string }>;
}) {
  const { convite: token, plano, origem: origemBruta } = await searchParams;
  // A campanha dos dois meses. Sem plano e sem convite, era aqui que a pessoa
  // batia na parede do "cadastro por convite" — a promessa da capa não tinha
  // porta. Ver lib/link-da-campanha.ts.
  const origem = origemBruta ? origemDoLink(origemBruta) : "";
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
                {" "}— com <b>{MESES_DE_TESTE} meses grátis</b>: a primeira cobrança só vence quando o teste acabar.
                {" "}Depois de criar a conta você escolhe individual ou grupo e conclui a assinatura.
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

  // A CAMPANHA DOS DOIS MESES. Sem plano nenhum e sem cartão: a pessoa cria a
  // conta, usa, e decide no fim. Este ramo é a porta que faltava — sem ele o
  // caminho terminava no muro do "cadastro por convite" logo abaixo, e a
  // promessa da capa não levava a lugar nenhum.
  if (!token && origem) {
    const ate = dataPorExtenso(fimDoTeste(new Date()));
    return (
      <main className="avnLoginPage">
        <section className="avnLoginCard avnOnboardingCard">
          <div className="avnLoginIllustration">
            <AppLogo />
            <p>Sua organização nasce com seus próprios pacientes e documentos, sem acesso aos dados de ninguém.</p>
          </div>
          <div className="avnLoginContent">
            <h1>Criar sua conta grátis</h1>
            <p>
              <b>{MESES_DE_TESTE} meses grátis</b>, até <b>{ate}</b>. Sem cartão de crédito e sem
              cobrança automática — no fim do período você decide se assina.
            </p>
            <SignUpForm token="" email="" origem={origem} />
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
            {/* Quem chegou aqui sem convite e não faz parte de equipe nenhuma
                — o anestesiologista que quer conhecer o sistema — batia nesta
                parede sem saída. O teste grátis é a porta dele. */}
            <p>Ainda não usa o AVANEST? Crie a sua conta pelo teste de {MESES_DE_TESTE} meses grátis.</p>
            <Link className="avnLoginSubmit avnCampanhaBotao" href="/2meses?de=cadastro">Começar o teste grátis</Link>
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
