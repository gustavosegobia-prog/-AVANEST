import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppLogo } from "@/components/app-logo";
import { createClient } from "@/utils/supabase/server";
import { MESES_DE_TESTE, dataPorExtenso, fimDoTeste } from "@/lib/teste-gratis";
import { CAMINHO_DA_CAMPANHA, origemDoLink } from "@/lib/link-da-campanha";

// A porta da campanha dos dois meses.
//
// Existe porque NÃO HAVIA PORTA: a promessa estava na capa e no /planos, mas
// /criar-conta sem convite e sem plano respondia "Cadastro por convite — peça
// o link a quem administra o sistema". Quem lesse a campanha e quisesse
// experimentar batia nessa parede.
//
// É uma página de UMA DECISÃO SÓ, e por isso não tem menu, não tem link para
// os planos e não tem preço. Ela chega pelo direct do Instagram, é lida no
// telefone em poucos segundos, e tudo que não leva ao botão está competindo
// com ele. O preço está a um clique dali para frente, na hora em que ele
// importa — que é quando os dois meses acabam.
//
// O QUE ELA NÃO ESCONDE: que o teste abre a ficha e a escala, e não o sistema
// inteiro. Vender "dois meses grátis" e entregar metade sem avisar é a forma
// mais rápida de transformar um teste em reclamação — e uma reclamação vinda
// do Instagram volta pelo mesmo caminho, em público.

export const metadata: Metadata = {
  title: "2 meses grátis no AVANEST",
  description:
    "Crie sua conta e use o AVANEST por 2 meses grátis: avaliação pré-anestésica completa e escala do serviço. Sem cartão de crédito para começar.",
  alternates: { canonical: CAMINHO_DA_CAMPANHA },
};

export default async function DoisMesesPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string }>;
}) {
  const { de } = await searchParams;
  const origem = origemDoLink(de);

  // Quem já tem conta não precisa ler oferta nenhuma: vai para o sistema. É o
  // caso do próprio anestesiologista que testa o link antes de mandar, e o de
  // quem clica de novo no direct semanas depois.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  // A data por extenso, e não "60 dias": "até 30 de novembro" é uma promessa
  // que a pessoa consegue conferir. A conta é a MESMA de quem cria a conta de
  // verdade — lib/teste-gratis.ts —, então a data desta página é a data que
  // vai valer, e não uma estimativa de propaganda.
  const ate = dataPorExtenso(fimDoTeste(new Date()));

  return (
    <main className="avnLoginPage">
      <section className="avnLoginCard avnCampanhaCard">
        <div className="avnLoginIllustration">
          <AppLogo />
          <p>Avaliação pré-anestésica, escala e financeiro do serviço de anestesia em um sistema só.</p>
        </div>
        <div className="avnLoginContent avnCampanha">
          <p className="avnCampanhaSelo">Oferta de lançamento</p>
          <h1>Use por {MESES_DE_TESTE} meses grátis.<br/>Se gostar, assine.</h1>
          <p className="avnCampanhaLead">
            Sem cartão de crédito para começar, sem cobrança automática e sem fidelidade.
            Criando sua conta hoje, o teste vale até <b>{ate}</b>.
          </p>

          <ul className="avnCampanhaLista">
            <li><b>Avaliação pré-anestésica completa</b>
              <span>Nove etapas, com ASA, índice de Lee, STOP-Bang e Apfel calculados a partir
              do que você já respondeu. No fim saem a ficha, o termo de consentimento e as
              orientações, impressos no timbre do hospital.</span></li>
            <li><b>Escala do serviço</b>
              <span>Uma escala por instituição e a sua reunindo todas. O plantão não se apaga:
              é transferido a um colega, com autor, data e resposta registrados.</span></li>
          </ul>

          {/* O ESCOPO, dito ANTES do botão e não descoberto lá dentro. Uma
              linha discreta, mas presente: quem descobre depois sente que
              faltou combinar, e tem razão. */}
          <p className="avnCampanhaEscopo">
            No teste você usa a ficha anestésica e a escala. Recepção e Financeiro abrem ao assinar.
          </p>

          <Link className="avnLoginSubmit avnCampanhaBotao" href={`/criar-conta?origem=${origem}`}>
            Criar minha conta grátis
          </Link>
          <p className="avnCampanhaRodape">
            No fim dos {MESES_DE_TESTE} meses você decide. <b>Nada é apagado</b> se você não
            assinar — seus pacientes e documentos continuam aqui e voltam a ser editáveis
            quando quiser.
          </p>
          <Link className="avnLoginCancel" href="/login">Já tenho conta — entrar</Link>
        </div>
      </section>
    </main>
  );
}
