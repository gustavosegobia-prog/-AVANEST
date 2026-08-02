import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { AppLogo } from "@/components/app-logo";
import { Icone } from "@/components/icone";

// Vitrine pública de preços.
//
// Nada aqui é decidido no navegador: a tabela de planos e o estado da campanha
// vêm do banco, e o preço que a pessoa vê é o mesmo que reservar_plano vai
// cobrar no checkout. Trocar um valor é mexer na tela administrativa, não no
// código.

export const metadata: Metadata = {
  title: "Planos e preços | AvaNEST",
  description:
    "Avaliação pré-anestésica digital do anestesiologista sozinho à clínica inteira. Oferta de lançamento para os 100 primeiros.",
};

// A página mostra contagem de vagas: cachear daria número velho.
export const dynamic = "force-dynamic";

const WHATSAPP = "https://wa.me/5541997870810?text=";
const propostaHospital =
  WHATSAPP + encodeURIComponent("Olá! Gostaria de uma proposta do AVANEST para a minha estrutura hospitalar.");
// O cadastro do AVANEST é por convite, não por autoatendimento. Quem ainda não
// tem conta não consegue chegar ao checkout, então o botão dele abre a
// conversa em vez de um login que não leva a lugar nenhum.
const querPlano = (nome: string) =>
  WHATSAPP + encodeURIComponent(`Olá! Quero contratar o plano ${nome} do AVANEST.`);

type Plano = {
  codigo: string;
  nome: string;
  descricao: string;
  preco_mensal: number | null;
  min_profissionais: number;
  max_profissionais: number | null;
  destaque: boolean;
  sob_consulta: boolean;
};

type Vagas = {
  ativa: boolean;
  limite: number;
  ocupadas: number;
  restantes: number;
  preco: number;
  preco_padrao: number | null;
  rotulo: string;
  plano_codigo: string;
};

const INCLUSO = [
  "Atualizações gratuitas",
  "Suporte",
  "Impressão ilimitada",
  "Avaliações ilimitadas",
  "Backup automático",
  "Segurança LGPD",
  "Atualizações constantes",
];

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function PlanosPage() {
  const supabase = await createClient();

  const [{ data: planosData }, { data: vagasData }, { data: { user } }] = await Promise.all([
    supabase.from("planos").select("*").eq("ativo", true).order("ordem"),
    supabase.rpc("vagas_fundador"),
    supabase.auth.getUser(),
  ]);

  // Só quem responde pela organização consegue contratar; para os demais o
  // botão vira conversa, que é o caminho real de quem ainda não é cliente.
  const { data: perfil } = user
    ? await supabase.from("perfis").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const podeContratar = ["owner", "admin"].includes(String(perfil?.role ?? ""));

  const planos = (planosData ?? []) as Plano[];
  const vagas = (Array.isArray(vagasData) ? vagasData[0] : vagasData) as Vagas | null;

  // A campanha só vale enquanto está ligada E sobra vaga. Depois disso a
  // página inteira passa a falar no preço de tabela, sem nenhuma edição.
  const campanhaVale = Boolean(vagas?.ativa) && Number(vagas?.restantes ?? 0) > 0;
  const planoDaCampanha = vagas?.plano_codigo ?? "";

  return (
    <main className="avnLanding planosPage">
      <header className="avnNav">
        <Link href="/"><AppLogo /></Link>
        <nav>
          <a className="avnLogin" href="/login">Login</a>
          <a className="avnPrimary" href="#planos">Ver planos</a>
        </nav>
      </header>

      <section className="planosHero">
        {campanhaVale && (
          <p className="planosCampanha">
            <Icone nome="estrela" tamanho={18} />
            <span>
              <b>Promoção para os {vagas!.limite} primeiros.</b> Garantem{" "}
              {reais(Number(vagas!.preco))}/mês para sempre.
              {vagas!.preco_padrao != null && (
                <> Depois: {reais(Number(vagas!.preco_padrao))}/mês.</>
              )}
            </span>
          </p>
        )}
        <h1>Um preço para cada tamanho de equipe.</h1>
        <p className="planosLead">
          Do anestesiologista que trabalha sozinho à clínica com recepção, financeiro e
          administração. Sem taxa de instalação, sem fidelidade, cancele quando quiser.
        </p>

        {/* O contador de vagas saiu da vitrine a pedido: mostrar "restam 100 de
            100" no primeiro dia denuncia que ninguém assinou ainda. A contagem
            continua existindo no banco e na tela de administração, que é onde
            ela serve para decidir quando encerrar a campanha. */}
      </section>

      <section className="planosGrade" id="planos">
        {planos.map((plano) => {
          const daCampanha = campanhaVale && plano.codigo === planoDaCampanha;
          const preco = daCampanha ? Number(vagas!.preco) : plano.preco_mensal;

          return (
            <article
              key={plano.codigo}
              className={`planoCard${plano.destaque ? " destacado" : ""}${plano.sob_consulta ? " sobConsulta" : ""}`}
            >
              <div className="planoSelos">
                {plano.destaque && <span className="planoSelo escolhido">Mais escolhido</span>}
                {daCampanha && (
                  <span className="planoSelo fundador">
                    <Icone nome="estrela" tamanho={13} /> {vagas!.rotulo}
                  </span>
                )}
              </div>

              <h2>{plano.nome}</h2>
              <p className="planoEquipe">{plano.descricao}</p>

              {plano.sob_consulta ? (
                <p className="planoSobConsulta">
                  Entre em contato para uma proposta personalizada.
                </p>
              ) : (
                <p className="planoPreco">
                  {daCampanha && plano.preco_mensal != null && (
                    <s aria-label={`De ${reais(Number(plano.preco_mensal))} por mês`}>
                      {reais(Number(plano.preco_mensal))}
                    </s>
                  )}
                  <strong>{reais(Number(preco))}</strong>
                  <span>/mês</span>
                </p>
              )}

              {daCampanha && (
                <p className="planoFundadorNota">
                  Preço garantido para sempre enquanto a assinatura seguir ativa.
                </p>
              )}

              {plano.sob_consulta ? (
                <a className="planoBotao" href={propostaHospital} target="_blank" rel="noreferrer">
                  Solicitar proposta
                </a>
              ) : podeContratar ? (
                <Link className="planoBotao" href={`/assinatura?plano=${plano.codigo}`}>
                  Assinar {plano.nome}
                </Link>
              ) : (
                <a className="planoBotao" href={querPlano(plano.nome)} target="_blank" rel="noreferrer">
                  Quero o {plano.nome}
                </a>
              )}
            </article>
          );
        })}
      </section>

      <section className="planosIncluso">
        <h2>Em todos os planos, sem custo extra</h2>
        <ul>
          {INCLUSO.map((item) => (
            <li key={item}>
              <Icone nome="confirmado" tamanho={17} />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <footer className="avnFooter">
        <span>G. Segobia Serviços Médicos LTDA — CNPJ 55.965.276/0001-04</span>
      </footer>
    </main>
  );
}
