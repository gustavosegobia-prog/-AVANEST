import type { Metadata } from "next";
import Link from "next/link";
import { AppLogo } from "@/components/app-logo";

export const metadata: Metadata = {
  title: "O que o AVANEST faz | Sistema para anestesiologistas",
  description:
    "Avaliação pré-anestésica, escala por hospital, produção do plantão e faturamento "
    + "— o dia inteiro do anestesiologista num sistema só.",
};

/**
 * A apresentação do sistema, para quem ainda não é cliente.
 *
 * Escrita para anestesiologista, e não para comprador de software: o que
 * convence um colega não é "solução completa e integrada", é reconhecer o
 * próprio dia no texto — a ficha que ele preenche de pé, a escala que ele
 * monta em planilha, a produção que ele anota num papel no bolso do pijama.
 *
 * Cada linha aqui corresponde a algo que existe no sistema hoje. Página de
 * produto que promete o que ainda não está pronto vira reclamação na primeira
 * semana de uso, e num sistema clínico vira desconfiança do resto.
 */

type Bloco = { titulo: string; itens: [string, string][] };

const BLOCOS: Bloco[] = [
  {
    titulo: "A avaliação pré-anestésica",
    itens: [
      ["Nove etapas, salvas enquanto você digita",
        "Identificação, anamnese, exame físico, via aérea, exames, medicamentos, escores, "
        + "planejamento e conclusão. O texto é salvo sozinho: fechar a tela no meio não perde nada."],
      ["Via aérea com os preditores que mudam a conduta",
        "Mallampati, distância tireomentoniana, abertura bucal, mobilidade cervical e o histórico "
        + "de intubação difícil. O resumo sai escrito, do jeito que vai para a ficha."],
      ["Risco cardíaco pelo RCRI",
        "O índice de Lee com os seis critérios, calculado a partir do que já foi respondido na "
        + "anamnese — sem repetir pergunta que a tela já fez."],
      ["Medicamentos de uso contínuo com orientação de suspensão",
        "A base diz quantos dias antes suspender cada antitrombótico e quando reintroduzir. "
        + "Você confere e ajusta; a orientação sai na ficha que o paciente leva para casa."],
      ["Via aérea pediátrica por idade — e por peso no neonato",
        "Acima de um ano vale a fórmula da idade. Abaixo de um ano, não: o tamanho do tubo passa "
        + "a sair de tabela por peso, porque aplicar a fórmula de criança maior em recém-nascido "
        + "erra para cima."],
    ],
  },
  {
    titulo: "O que sai impresso",
    itens: [
      ["Ficha, termo de consentimento e orientações",
        "Os três com o logo e o nome do hospital onde o paciente foi atendido — não os do último "
        + "hospital em que você entrou no sistema. Reimprimir hoje um documento de março não o "
        + "carimba com o hospital de hoje."],
      ["A sua assinatura, com CRM e RQE",
        "Campo vazio não é impresso: a ficha sai do tamanho do caso, sem páginas de espaço em branco."],
    ],
  },
  {
    titulo: "A escala do serviço",
    itens: [
      ["Uma escala por hospital, e a sua com todos juntos",
        "O grupo não tem uma escala: tem a da Santa Casa, a da Unimed, a do Instituto. A sua junta "
        + "tudo num calendário só, porque ali a pergunta é outra: onde eu trabalho este mês."],
      ["O dia dividido em manhã, tarde e noite",
        "O turno continua sendo lançado no horário que você quiser. Quem fica até às 13h aparece na "
        + "manhã; quem faz o dia todo, na manhã e na tarde. A faixa vazia fica à vista: é o buraco "
        + "na cobertura."],
      ["Escalar é clicar no nome e clicar no turno",
        "Quem monta a escala escolhe a pessoa numa fila de botões e lança o turno. A escolha "
        + "permanece de um lançamento para o outro, porque montar escala é repetir o mesmo nome em "
        + "vários dias. No calendário aparece o primeiro nome de cada um, e não iniciais."],
      ["Plantão do grupo não se apaga — se passa",
        "Sair de um turno tem um caminho só: oferecer a um colega e esperar que ele aceite. "
        + "Enquanto ninguém aceita, o plantão continua seu — quem abandona um turno sem avisar deixa "
        + "o buraco para ser descoberto no dia da cirurgia."],
      ["Plantão só seu, que ninguém do grupo enxerga",
        "Sedação em consultório, hospital que não é do serviço, cobertura particular. Entra na sua "
        + "escala e no seu mês; não aparece para o grupo, nem para quem administra."],
      ["No seu celular e na parede do hospital",
        "A escala sai impressa em paisagem, sempre em uma folha só, para pregar na parede. E vai "
        + "para o Calendário do iPhone e para o Google Agenda num arquivo único, e não um evento de "
        + "cada vez. Os feriados nacionais já vêm marcados no calendário."],
    ],
  },
  {
    titulo: "O dinheiro do plantão",
    itens: [
      ["A produção do dia, anotada com o jaleco ainda vestido",
        "Nome, convênio e cirurgia de cada paciente numa linha só, com o cursor voltando para o "
        + "campo do nome depois de salvar. Se anotar oito pacientes custar mais do que rabiscar num "
        + "papel, o dado não chega a existir."],
      ["A ficha de internação lida pela foto",
        "O laudo de AIH do SUS e as fichas de convênio: fotografe, e os campos vêm preenchidos. O "
        + "reconhecimento do texto acontece dentro do seu aparelho, e a imagem é descartada ao final "
        + "— a ficha traz dados de saúde, e dado de saúde não precisa viajar."],
      ["A lista é sua até você mandar",
        "Ninguém do faturamento vê a sua produção enquanto você não clicar em Enviar. O envio é por mês, "
        + "só o que você enviou, e dá para desfazer."],
      ["Confirmar o plantão no dia em que ele acontece",
        "Um toque, de quem trabalhou. A escala é um plano: o turno trocado na véspera e o cancelado "
        + "por sala fechada continuam nela iguais ao que estava previsto. Só quem fez o plantão pode "
        + "confirmá-lo, e não se confirma plantão que ainda não aconteceu."],
      ["O fechamento do mês, pronto para o financeiro",
        "Dia, horário, horas e valor de cada profissional, com o total de cada um. Só o que foi confirmado "
        + "entra na conta a pagar; o que ficou sem confirmar aparece marcado, e não sumido — turno "
        + "esquecido não pode desaparecer da conta de alguém sem ninguém ver."],
      ["Quanto entrou, quanto falta receber",
        "O valor de cada turno, o que já foi pago e o total do mês — com um botão em forma de olho "
        + "que esconde os números quando alguém está olhando por cima do seu ombro."],
    ],
  },
  {
    titulo: "O que o sistema avisa",
    itens: [
      ["Um sino, em todas as telas",
        "Plantão oferecido ao grupo, resposta ao turno que você ofereceu, mensagem nova da equipe e "
        + "resposta do suporte. O aviso nasce numa área e é lido em outra: quem está na recepção "
        + "cadastrando paciente precisa ver o plantão oferecido sem abrir a escala."],
      ["O número conta só o que espera resposta sua",
        "Notícia não entra na conta: ganha apenas um ponto, que some assim que você abre a caixa. Um contador que "
        + "nunca zera é um contador que se aprende a ignorar, inclusive no dia em que ele estiver certo."],
      ["Lembrete do que ficou para trás no dinheiro",
        "Paciente anestesiado e ainda não cobrado, o que foi faturado e não voltou como pagamento, "
        + "plantão trabalhado e não pago. Só de mês fechado: cobrar um paciente de anteontem não é "
        + "atraso, é o trabalho normal."],
    ],
  },
  {
    titulo: "O grupo",
    itens: [
      ["Recepção, médico, financeiro e administração",
        "Cada um vê o que precisa ver. A recepção conduz a fila do dia sem abrir conteúdo clínico."],
      ["Quem entra na escala é médico com CRM",
        "A escala é o documento de quem responde pela anestesia, e o registro faz parte dela. Quem "
        + "está sem CRM no cadastro não fica de fora em silêncio: aparece num aviso, pelo nome, "
        + "indicando onde preencher."],
      ["O colega que não usa o sistema também entra",
        "O anestesiologista que não tem e-mail é cadastrado do mesmo jeito. Ele aparece na escala e "
        + "no faturamento, e não recebe login nenhum."],
      ["Conversa da equipe, separada por instituição",
        "Uma sala de conversa por organização. Quem é de uma não lê a sala da outra."],
    ],
  },
  {
    titulo: "O que sustenta tudo isso",
    itens: [
      ["O isolamento é do banco, não da tela",
        "Cada consulta ao banco carrega a organização de quem perguntou. Esconder um botão impede o "
        + "clique, não o pedido — a regra mora onde o dado mora."],
      ["Registro de quem fez o quê",
        "Criação, alteração e exclusão ficam registradas com autor, data e hora."],
      ["Dado clínico com o mínimo de gente por perto",
        "Cada perfil recebe apenas o que precisa para trabalhar — o princípio da necessidade, "
        + "previsto na LGPD. O que a recepção não precisa ver, ela não recebe."],
      ["O que a fonte não diz, o sistema não inventa",
        "Nenhum valor de corte foi arredondado, presumido ou obtido pela média entre referências. "
        + "Onde a referência não existe, o campo fica vazio — e vazio é uma resposta honesta."],
    ],
  },
];

export default function RecursosPage() {
  const whatsappUrl =
    "https://wa.me/5541997870810?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20conversa%20de%2015%20minutos%20sobre%20o%20AVANEST.";

  return (
    <main className="avnLanding">
      <header className="avnNav">
        <Link href="/" aria-label="AVANEST"><AppLogo /></Link>
        <nav>
          <a className="avnLogin" href="/login">Login</a>
          <a className="avnPrimary" href="/planos">Ver planos</a>
        </nav>
      </header>

      <section className="recHero">
        <p className="avnEyebrow">O SISTEMA POR DENTRO</p>
        <h1>O dia inteiro do anestesiologista, num sistema só.</h1>
        <p className="avnLead">
          Da avaliação pré-anestésica ao valor que entra no fim do mês — passando pela
          escala do serviço, pelos documentos que o paciente leva para casa e pelo
          fechamento que vai para o financeiro.
        </p>
      </section>

      {BLOCOS.map((bloco) => (
        <section className="recBloco" key={bloco.titulo}>
          <h2>{bloco.titulo}</h2>
          <div className="recGrade">
            {bloco.itens.map(([titulo, texto]) => (
              <article key={titulo}>
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </article>
            ))}
          </div>
        </section>
      ))}

      <section className="recFim">
        <h2>Feito por quem passa o plantão dentro do centro cirúrgico.</h2>
        <p>
          O AVANEST nasceu no serviço de anestesiologia de Campo Mourão, para resolver o
          que atrapalhava o dia por lá. Cada detalhe desta página existe porque faltou
          num plantão.
        </p>
        <div className="avnActions">
          <a className="avnPrimary" href="/planos">Ver planos e preços</a>
          <a className="avnSecondary" href={whatsappUrl} target="_blank" rel="noreferrer">
            Conversar 15 minutos
          </a>
        </div>
      </section>

      <footer className="avnFooter">
        <span>G. Segobia Serviços Médicos Ltda. — CNPJ 55.965.276/0001-04</span>
        <nav className="avnFooterLinks">
          <Link href="/">Início</Link>
          <a href="/termos">Termos de Uso</a>
          <a href="/privacidade">Política de Privacidade</a>
        </nav>
      </footer>
    </main>
  );
}
