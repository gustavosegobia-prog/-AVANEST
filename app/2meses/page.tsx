import type { Metadata } from "next";
import { paginaPublica } from "@/lib/metadados";
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
// O QUE ELA NÃO ESCONDE: que o cartão é cadastrado no início. Desde 15/10/2026
// os 2 meses começam com o cartão, e a primeira cobrança vence no fim deles.
// Dizer isso antes do botão — com a data — é o que evita a surpresa no
// cadastro e a contestação no fim; uma reclamação vinda do Instagram volta
// pelo mesmo caminho, em público.

export const metadata: Metadata = paginaPublica({
  titulo: "2 meses grátis no AVANEST",
  descricao: "Crie sua conta e use o AVANEST por 2 meses grátis, com o sistema completo. O cartão é cadastrado no início e a primeira cobrança só vence depois dos 2 meses.",
  caminho: CAMINHO_DA_CAMPANHA,
});

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
          <p>Recepção, consulta pré-anestésica, ficha anestésica, crises, escala e financeiro em um sistema só.</p>
        </div>
        <div className="avnLoginContent avnCampanha">
          <p className="avnCampanhaSelo">Teste grátis</p>
          <h1>Use por {MESES_DE_TESTE} meses grátis.<br/>Só paga se continuar.</h1>
          <p className="avnCampanhaLead">
            Você cadastra o cartão no início, e a primeira cobrança só vence em <b>{ate}</b>,
            criando a conta hoje. Cancele antes e não paga nada. Sem fidelidade.
          </p>

          {/* OS SEIS MÓDULOS, uma linha cada: lida no telefone, a lista mostra
              tudo o que entra nos 2 meses sem empurrar o botão para longe. */}
          <ul className="avnCampanhaLista">
            <li><b>Recepção</b>
              <span>A agenda do dia por médico e por hospital.</span></li>
            <li><b>Consulta pré-anestésica</b>
              <span>Lee, STOP-Bang e Apfel calculados, e os documentos no timbre do hospital.</span></li>
            <li><b>Ficha anestésica</b>
              <span>No tablet, dentro da sala, impressa em A4.</span></li>
            <li><b>Manejo de crises</b>
              <span>34 protocolos com as doses pelo peso do paciente.</span></li>
            <li><b>Escala pessoal e do grupo</b>
              <span>Uma por hospital e a sua reunindo todas, com a troca de plantão registrada.</span></li>
            <li><b>Financeiro pessoal e do grupo</b>
              <span>O que você fez, recebeu e tem a receber, e o fechamento do grupo.</span></li>
          </ul>

          {/* O ESCOPO, dito ANTES do botão. Com o cartão cadastrado, os 2 meses
              já são da assinatura: o sistema inteiro, e não só uma parte. */}
          <p className="avnCampanhaEscopo">
            Nos {MESES_DE_TESTE} meses você usa o sistema completo, com os seis módulos.
          </p>

          <Link className="avnLoginSubmit avnCampanhaBotao" href={`/criar-conta?origem=${origem}`}>
            Começar meus {MESES_DE_TESTE} meses grátis
          </Link>
          <p className="avnCampanhaRodape">
            Para não ser cobrado, cancele antes de {ate} em Admin › Assinatura, sem falar com
            ninguém. <b>Nada é apagado</b> se você cancelar — seus pacientes e documentos
            continuam guardados.
          </p>
          <Link className="avnLoginCancel" href="/login">Já tenho conta — entrar</Link>
        </div>
      </section>
    </main>
  );
}
