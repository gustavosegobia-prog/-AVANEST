import type { Metadata } from "next";
import Link from "next/link";
import { AppLogo } from "@/components/app-logo";

export const metadata: Metadata = {
  title: "O que o AVANEST faz | Sistema para anestesiologistas",
  description:
    "Avaliação pré-anestésica, calculadoras com fonte citada, escala por hospital, "
    + "produção do plantão e faturamento — o dia inteiro do anestesiologista num sistema só.",
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
    ],
  },
  {
    titulo: "As contas que se faz no corredor",
    itens: [
      ["Doses por peso, sem multiplicar o que é dose fixa",
        "O cálculo respeita a apresentação do medicamento. Dose fixa não é multiplicada pelo peso, "
        + "e a reversão do bloqueio pede a profundidade em vez de decidir sozinha pelo peso."],
      ["Gasometria pela foto do laudo",
        "Fotografe o papel térmico e os valores entram nos campos. Número fora do que existe em ser "
        + "humano é descartado em vez de preenchido — campo vazio você vê e corrige; número errado passa."],
      ["Distúrbios eletrolíticos, osmolaridade e Fick",
        "Correção de sódio, potássio, cálcio e magnésio; gap osmolar que não confunde ureia com BUN; "
        + "débito cardíaco que diz se o VO₂ foi medido ou presumido, porque isso muda o peso do resultado."],
      ["ROTEM e PCA com a plataforma e a fonte na tela",
        "Intervalo de referência é por plataforma, e o sistema recusa transportar um da delta para a "
        + "sigma. Cada número tem obra e página anotadas; o que a fonte não afirma fica em branco."],
      ["Via aérea pediátrica por idade — e por peso no neonato",
        "Acima de um ano vale a fórmula da idade. Abaixo dela não vale, e o cálculo passa a sair de "
        + "tabela por peso: aplicar fórmula de criança maior em recém-nascido erra para cima."],
    ],
  },
  {
    titulo: "O que sai impresso",
    itens: [
      ["Ficha, termo de consentimento e orientações",
        "Os três com o cabeçalho do hospital onde o paciente foi atendido — não o do último hospital "
        + "em que você entrou no sistema. Reimprimir um documento de março não o carimba com hoje."],
      ["A sua assinatura, com CRM e RQE",
        "Campo vazio não é impresso: a ficha sai do tamanho do caso, sem página de espaço em branco."],
    ],
  },
  {
    titulo: "A escala do serviço",
    itens: [
      ["Uma escala por hospital, e a sua com todos juntos",
        "O grupo não tem uma escala: tem a da Santa Casa, a da Unimed, a do Instituto. A sua junta "
        + "tudo num calendário só, porque a pergunta ali é outra — onde eu estou este mês."],
      ["O dia dividido em manhã, tarde e noite",
        "O turno continua sendo lançado com a hora que você quiser. Quem fica até as 13h aparece na "
        + "manhã; quem faz o dia todo, na manhã e na tarde. A faixa vazia fica à vista: é o buraco de cobertura."],
      ["Escalar é clicar no nome e clicar no turno",
        "Quem monta a escala escolhe a pessoa numa fila de botões e lança o turno. A escolha fica de "
        + "pé entre um lançamento e outro, porque montar escala é pôr o mesmo nome em vários dias."],
      ["Plantão do grupo não se apaga — se passa",
        "Sair de um turno tem um caminho só: oferecer a um colega e esperar ele aceitar. Enquanto "
        + "ninguém aceita, o plantão continua seu. Quem some de um turno sem avisar deixa o buraco para o dia da cirurgia."],
      ["Plantão só seu, que ninguém do grupo enxerga",
        "Sedação em consultório, hospital que não é do serviço, cobertura particular. Entra na sua "
        + "escala e no seu mês; não aparece para o grupo, nem para quem administra."],
      ["No seu celular e na parede do hospital",
        "A escala imprime em paisagem para pregar na parede, e exporta para o Calendário do iPhone e "
        + "para o Google Agenda num arquivo só — não um evento por vez."],
    ],
  },
  {
    titulo: "O dinheiro do plantão",
    itens: [
      ["A produção do dia, anotada com o jaleco ainda vestido",
        "Nome, convênio e cirurgia de cada paciente numa linha só, com o foco voltando para o campo "
        + "do nome depois de salvar. Se anotar oito pacientes custar mais que rabiscar num papel, o dado não existe."],
      ["A ficha de internação lida pela foto",
        "O laudo de AIH do SUS e as fichas de convênio: fotografe e os campos entram preenchidos. "
        + "O reconhecimento acontece no seu aparelho e a imagem é descartada no fim — a ficha traz dado de saúde e não precisa viajar."],
      ["A lista é sua até você mandar",
        "Ninguém do faturamento vê a produção enquanto você não clicar em enviar. O envio é por mês, "
        + "só o que você enviou, e dá para desfazer."],
      ["Quanto entrou, quanto falta receber",
        "O valor de cada turno, o que já foi pago e o total do mês — com um olho para esconder os "
        + "números quando alguém estiver olhando por cima do ombro."],
    ],
  },
  {
    titulo: "O grupo",
    itens: [
      ["Recepção, médico, financeiro e administração",
        "Cada um vê o que precisa. A recepção opera a fila do dia sem abrir conteúdo clínico."],
      ["Quem entra na escala é médico com CRM",
        "A escala é o documento de quem responde pela anestesia, e o registro faz parte dela. Médico "
        + "sem CRM no cadastro não some calado: aparece num aviso, com o nome, apontando onde preencher."],
      ["O colega que não usa sistema também entra",
        "Anestesista sem e-mail é cadastrado assim mesmo. Ele aparece na escala e no faturamento, e "
        + "não recebe login nenhum."],
      ["Conversa da equipe, separada por instituição",
        "Uma sala por organização. Quem é de uma não lê a da outra."],
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
        "Separação de acesso por perfil, conforme a LGPD. O que a recepção não precisa ver, ela não recebe."],
      ["O que a fonte não diz, o sistema não inventa",
        "Nenhum gatilho numérico foi arredondado, presumido ou tirado de média entre livros. Onde a "
        + "referência não existe, o campo fica vazio — e vazio é uma resposta honesta."],
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
          escala do serviço, pelas contas que você faz no corredor e pelos documentos
          que o paciente leva para casa.
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
