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
  title: "Planos e preços | AVANEST",
  // Sem número de vagas aqui: metadata é estática, e um "100 primeiros"
  // escrito à mão sobrevive à mudança da campanha e passa a mentir. O número
  // que vale aparece na página, vindo do banco.
  description:
    "Escala, avaliação pré-anestésica, produção e recebimento — do anestesiologista sozinho ao serviço inteiro. Oferta de lançamento por tempo limitado.",
};

// A página mostra contagem de vagas: cachear daria número velho.
export const dynamic = "force-dynamic";

const WHATSAPP = "https://wa.me/5541997870810?text=";
const propostaHospital =
  WHATSAPP + encodeURIComponent("Olá! Gostaria de uma proposta do AVANEST para a minha estrutura hospitalar.");
// O cadastro do AVANEST é por convite, não por autoatendimento. Quem ainda não
// tem conta não consegue chegar ao checkout, então o botão dele abre a
// conversa em vez de um login que não leva a lugar nenhum.
const duvida =
  WHATSAPP + encodeURIComponent("Olá! Tenho uma dúvida sobre o AVANEST antes de assinar.");
const querPlano = (nome: string) =>
  WHATSAPP + encodeURIComponent(`Olá! Quero contratar o plano ${nome} do AVANEST.`);

/**
 * Perguntas frequentes.
 *
 * O texto é comercial, mas os números não são escritos à mão: o limite da
 * campanha e os dois preços saem do banco, os mesmos que o cartão do plano
 * mostra logo acima. Um FAQ que diz "25 primeiros" enquanto a promoção vale
 * para 100 é pior do que não ter FAQ — e é exatamente o que acontece quando o
 * número é digitado uma segunda vez.
 */
const perguntas = (a: {
  mesesGratis: number | null;
  terminaEm: string | null;
  suporte: string;
}) => [
  {
    p: "Preciso pagar taxa de instalação ou assinar contrato de fidelidade?",
    r: "Não. O AVANEST não cobra taxa de instalação e não exige fidelidade. O cancelamento é feito pela sua própria conta, em Admin › Assinatura, a qualquer momento e sem passar por atendimento: não há nova cobrança, e o acesso continua até o fim do período que você já pagou.",
  },
  {
    p: "Se eu cancelar, recebo o dinheiro de volta?",
    r: "Cancelando nos primeiros 14 dias depois da cobrança, o valor daquele mês é devolvido pela mesma forma de pagamento. Depois disso o mês em curso não é reembolsado, mas o acesso continua até o fim dele e não há nova cobrança. A tela mostra em que dia do mês você está antes de confirmar o cancelamento.",
  },
  a.mesesGratis
    ? {
        p: `Como funciona a campanha de ${a.mesesGratis} ${a.mesesGratis === 1 ? "mês" : "meses"} grátis?`,
        r:
          `Quem contrata durante a campanha não paga os ${a.mesesGratis} primeiros ${a.mesesGratis === 1 ? "mês" : "meses"}: ` +
          `a assinatura fica ativa desde o primeiro dia e a primeira cobrança só vence depois desse período. ` +
          `Não é desconto no valor — o preço mensal segue o do seu plano, e não sobe na renovação por causa da campanha.` +
          (a.terminaEm ? ` A campanha vale para quem assinar até ${a.terminaEm}.` : ""),
      }
    : null,
  {
    p: "Como escolho o plano certo?",
    r: "Pelo tamanho da equipe. Cada plano atende a uma faixa de anestesiologistas, indicada no próprio cartão aqui em cima, e o preço é fechado: não varia com a quantidade de avaliações nem com o número de pacientes. Só contam anestesiologistas ativos com CRM — recepção, financeiro e administração não ocupam vaga.",
  },
  {
    p: "E se a minha equipe crescer depois de eu assinar?",
    r: "Você troca de plano quando passar da faixa contratada, e a troca é feita pelo painel da conta, sem precisar falar com atendimento. Acima da maior faixa da tabela, o plano é montado sob medida: fale com a gente e preparamos uma proposta.",
  },
  {
    p: "Como o AVANEST protege os dados dos pacientes?",
    r: "O sistema segue os princípios da LGPD. O acesso é separado por perfil: a recepção organiza a fila e o cadastro sem enxergar conteúdo clínico, e o financeiro trabalha com valores sem abrir a avaliação. Backup automático está em todos os planos.",
  },
  {
    p: "Dá para migrar as fichas ou o sistema que uso hoje?",
    r: "Sim. Se você já mantém as avaliações em papel, a escala numa planilha ou a produção num caderno, fale com a gente antes de assinar: combinamos como trazer o que já existe.",
  },
  {
    p: "O suporte está incluído em todos os planos?",
    r: "Sim. Suporte, atualizações e impressão ilimitada de fichas, termos e orientações entram em todos os planos, sem custo extra.",
  },
  {
    p: "Como faço para começar?",
    r: "Você pode falar 15 minutos com a gente pelo WhatsApp antes de decidir ou escolher agora mesmo, aqui em cima, o plano do tamanho da sua equipe.",
  },
];

type Plano = {
  codigo: string;
  nome: string;
  descricao: string;
  preco_mensal: number | null;
  preco_por_profissional: number | null;
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
  meses_gratis: number;
  termina_em: string | null;
  preco: number;
  preco_padrao: number | null;
  rotulo: string;
  plano_codigo: string;
};

const INCLUSO = [
  "Suporte",
  "Atualizações gratuitas",
  "Avaliações ilimitadas",
  "Impressão ilimitada",
  "Backup automático",
  "Segurança e conformidade com a LGPD",
];

const reais = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function PlanosPage() {
  const supabase = await createClient();

  const [{ data: planosData }, { data: vagasData }, { data: { user } }] = await Promise.all([
    supabase.from("planos").select("*,preco_por_profissional").eq("ativo", true).order("ordem"),
    supabase.rpc("vagas_fundador"),
    supabase.auth.getUser(),
  ]);

  const { data: perfil } = user
    ? await supabase.from("perfis").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  // Quem responde pela organização contrata direto. Visitante sem conta vai
  // criar a dele levando o plano escolhido — antes esse caminho terminava no
  // login sem saída, e quem quis pagar não tinha como. Quem já está logado
  // mas não responde pela organização continua caindo na conversa: mudar o
  // plano do grupo não é decisão de quem só usa o sistema.
  const podeContratar = ["owner", "admin"].includes(String(perfil?.role ?? ""));
  const visitante = !user;
  const destinoDoPlano = (codigo: string) =>
    podeContratar ? `/assinatura?plano=${codigo}` : `/criar-conta?plano=${codigo}`;

  const planos = (planosData ?? []) as Plano[];
  const vagas = (Array.isArray(vagasData) ? vagasData[0] : vagasData) as Vagas | null;

  // A campanha só vale enquanto está ligada E sobra vaga. Depois disso a
  // página inteira passa a falar no preço de tabela, sem nenhuma edição.
  // A data de término já entra no `ativa` que a função devolve, então aqui
  // basta perguntar se a campanha está valendo e se ela dá algum mês.
  const campanhaVale = Boolean(vagas?.ativa) && Number(vagas?.meses_gratis ?? 0) > 0;
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
              <b>{vagas!.meses_gratis} {vagas!.meses_gratis === 1 ? "mês grátis" : "meses grátis"}</b>{" "}
              para quem assinar
              {vagas!.termina_em
                ? <> até {new Date(`${vagas!.termina_em}T12:00:00`).toLocaleDateString("pt-BR")}</>
                : " durante a campanha"}.
              {" "}A primeira cobrança só vence depois desse período.
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
          // A campanha agora vale para qualquer plano: são meses grátis, não um
          // preço especial de um plano só.
          const daCampanha = campanhaVale;
          const porProfissional = plano.preco_por_profissional;
          const preco = plano.preco_mensal;

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
                  {/* Quando o plano é por profissional, o número grande é o
                      valor por cabeça — é ele que o cliente usa para fazer a
                      conta da equipe dele. O piso aparece embaixo, como "a
                      partir de", porque é o mínimo que a fatura terá. */}
                  <strong>{reais(Number(porProfissional ?? preco))}</strong>
                  <span>{porProfissional != null ? "/profissional/mês" : "/mês"}</span>
                </p>
              )}

              {porProfissional != null && preco != null && (
                <p className="planoEquipe" style={{ marginTop: 0 }}>
                  A partir de {reais(Number(preco))}/mês
                </p>
              )}

              {daCampanha && (
                <p className="planoFundadorNota">
                  {vagas!.meses_gratis} {vagas!.meses_gratis === 1 ? "mês" : "meses"} sem cobrança para quem assinar durante a campanha.
                </p>
              )}

              {plano.sob_consulta ? (
                <a className="planoBotao" href={propostaHospital} target="_blank" rel="noreferrer">
                  Solicitar proposta
                </a>
              ) : podeContratar || visitante ? (
                <Link className="planoBotao" href={destinoDoPlano(plano.codigo)}>
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

      <section className="planosFaq" id="faq">
        <h2>Perguntas frequentes</h2>
        {/* <details> em vez de um acordeão escrito à mão: abre por clique, por
            Enter e por Espaço, o leitor de tela anuncia recolhido/expandido, e
            o buscador enxerga a resposta mesmo fechada. */}
        <div className="planosFaqLista">
          {perguntas({
            mesesGratis: campanhaVale ? Number(vagas!.meses_gratis) : null,
            terminaEm: vagas?.termina_em
              ? new Date(`${vagas.termina_em}T12:00:00`).toLocaleDateString("pt-BR")
              : null,
            suporte: WHATSAPP,
          })
            .filter((item) => item !== null)
            .map((item) => (
              <details key={item!.p}>
                <summary>
                  {item!.p}
                  <Icone nome="seta" tamanho={16} />
                </summary>
                <p>{item!.r}</p>
              </details>
            ))}
        </div>
        <p className="planosFaqRodape">
          Ficou alguma dúvida que não está aqui?{" "}
          <a href={duvida} target="_blank" rel="noreferrer">Fale com a gente no WhatsApp</a>.
        </p>
      </section>

      <footer className="avnFooter">
        <span>G. Segobia Serviços Médicos Ltda. — CNPJ 55.965.276/0001-04</span>
        <nav className="avnFooterLinks">
          <Link href="/termos">Termos de Uso</Link>
          <Link href="/privacidade">Política de Privacidade</Link>
        </nav>
      </footer>
    </main>
  );
}
